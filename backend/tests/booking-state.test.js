const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/config/database');
const BookingService = require('../src/services/booking.service');

test('Task 4 & 5: Happy path booking flow creates TXG reference and confirms booking', async () => {
  await db.initialize();

  const bookingResult = await BookingService.createBooking({
    flightDetails: {
      flightNumber: 'AI482',
      origin: 'AMD',
      destination: 'DEL',
      departureTime: '2026-10-15T10:30:00'
    },
    supplierResultId: 'TBO001',
    supplierCode: 'TBO',
    travellers: [
      {
        title: 'MR',
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul.sharma@example.com',
        phone: '+919876543210'
      }
    ],
    customerPrice: {
      baseFare: 5200,
      taxes: 950,
      serviceFee: 299,
      discount: 200,
      totalAmount: 6249,
      currency: 'INR'
    },
    supplierCost: { baseFare: 5200, taxes: 950, totalSupplierCost: 6150 },
    idempotencyKey: `IDEM_${Date.now()}`
  });

  assert.strictEqual(bookingResult.success, true);
  assert.strictEqual(bookingResult.status, 'BOOKING_CONFIRMED');
  assert.match(bookingResult.bookingReference, /^TXG-\d{6}$/);
  assert.ok(bookingResult.pnr);

  // Verify DB state
  const stored = await db.getBookingByReference(bookingResult.bookingReference);
  assert.strictEqual(stored.paymentStatus, 'PAYMENT_SUCCESS');
  assert.strictEqual(stored.bookingStatus, 'BOOKING_CONFIRMED');
  assert.strictEqual(stored.ticketingStatus, 'ISSUED');
});

test('Task 5: Customer payment succeeds but supplier booking fails -> Auto-refund initiated', async () => {
  await db.initialize();

  const bookingResult = await BookingService.createBooking({
    flightDetails: { flightNumber: 'AI482', origin: 'AMD', destination: 'DEL' },
    supplierResultId: 'TBO001',
    supplierCode: 'TBO',
    travellers: [{ firstName: 'Amit', lastName: 'Patel', email: 'amit@example.com', phone: '+919999999999' }],
    customerPrice: { totalAmount: 6249, currency: 'INR' },
    supplierCost: { totalSupplierCost: 6150 },
    simulationOptions: { forceSupplierFailure: true } // Trigger failure
  });

  assert.strictEqual(bookingResult.success, false);
  assert.strictEqual(bookingResult.status, 'SUPPLIER_BOOKING_FAILED');
  assert.strictEqual(bookingResult.paymentStatus, 'REFUNDED');
  assert.ok(bookingResult.refundReference);

  const stored = await db.getBookingByReference(bookingResult.bookingReference);
  assert.strictEqual(stored.bookingStatus, 'SUPPLIER_BOOKING_FAILED');
  assert.strictEqual(stored.paymentStatus, 'REFUNDED');
});

test('Task 6: Supplier timeout moves to SUPPLIER_UNKNOWN and reconciles safely without duplicate PNR', async () => {
  await db.initialize();

  // 1. Trigger booking with simulated timeout
  const bookingResult = await BookingService.createBooking({
    flightDetails: { flightNumber: 'AI482', origin: 'AMD', destination: 'DEL' },
    supplierResultId: 'TBO001',
    supplierCode: 'TBO',
    travellers: [{ firstName: 'Sneha', lastName: 'Desai', email: 'sneha@example.com', phone: '+919111111111' }],
    customerPrice: { totalAmount: 6249, currency: 'INR' },
    supplierCost: { totalSupplierCost: 6150 },
    simulationOptions: { forceSupplierTimeout: true }
  });

  assert.strictEqual(bookingResult.success, false);
  assert.strictEqual(bookingResult.status, 'SUPPLIER_UNKNOWN');
  assert.strictEqual(bookingResult.bookingStatus, 'SUPPLIER_UNKNOWN');

  // Verify in database: status is SUPPLIER_UNKNOWN, not confirmed or failed
  const stored = await db.getBookingByReference(bookingResult.bookingReference);
  assert.strictEqual(stored.bookingStatus, 'SUPPLIER_UNKNOWN');

  // 2. Perform safe reconciliation (checks supplier without re-booking)
  const reconResult = await BookingService.reconcileBooking(bookingResult.bookingReference);
  assert.strictEqual(reconResult.status, 'RESOLVED_CONFIRMED');
  assert.ok(reconResult.pnr);

  // Verify finalized state in database
  const reconciledBooking = await db.getBookingByReference(bookingResult.bookingReference);
  assert.strictEqual(reconciledBooking.bookingStatus, 'BOOKING_CONFIRMED');
  assert.strictEqual(reconciledBooking.ticketingStatus, 'ISSUED');
});

test.after(async () => {
  await db.close();
});
