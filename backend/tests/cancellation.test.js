const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/config/database');
const BookingService = require('../src/services/booking.service');
const CancellationService = require('../src/services/cancellation.service');

test('Task 7: Cancellation & Refund workflow generates quote and executes state flow', async () => {
  await db.initialize();

  // 1. Create a confirmed booking first
  const booking = await BookingService.createBooking({
    flightDetails: { flightNumber: 'AI482', origin: 'AMD', destination: 'DEL' },
    supplierResultId: 'TBO001',
    supplierCode: 'TBO',
    travellers: [{ firstName: 'Pooja', lastName: 'Mehta', email: 'pooja@example.com', phone: '+919222222222' }],
    customerPrice: {
      baseFare: 5200,
      taxes: 950,
      serviceFee: 299,
      discount: 200,
      totalAmount: 6249,
      currency: 'INR'
    },
    supplierCost: { baseFare: 5200, taxes: 950, totalSupplierCost: 6150 }
  });

  const ref = booking.bookingReference;

  // 2. Obtain Cancellation Quote
  const quote = await CancellationService.getCancellationQuote(ref);
  assert.strictEqual(quote.bookingReference, ref);
  assert.strictEqual(quote.totalPaid, 6249);
  assert.strictEqual(quote.breakdown.airlineCancellationPenalty, 3000);
  assert.strictEqual(quote.breakdown.tixxgoCancellationFee, 250);
  assert.strictEqual(quote.breakdown.estimatedRefund, 2999);

  // 3. Confirm Cancellation
  const cancelResult = await CancellationService.cancelBooking(ref, 'Personal schedule conflict');
  assert.strictEqual(cancelResult.success, true);
  assert.strictEqual(cancelResult.status, 'REFUNDED');
  assert.strictEqual(cancelResult.cancellationRecord.refundAmount, 2999);

  // 4. Verify Final Database Record and Audit Trail
  const updatedBooking = await BookingService.getBooking(ref);
  assert.strictEqual(updatedBooking.bookingStatus, 'CANCELLED');
  assert.strictEqual(updatedBooking.paymentStatus, 'REFUNDED');
  assert.strictEqual(updatedBooking.ticketingStatus, 'CANCELLED');

  const auditActions = updatedBooking.auditLogs.map(l => l.action);
  assert.ok(auditActions.includes('CANCELLATION_REQUESTED'));
  assert.ok(auditActions.includes('SUPPLIER_TICKET_CANCELLED'));
  assert.ok(auditActions.includes('REFUND_QUEUED'));
  assert.ok(auditActions.includes('REFUND_COMPLETED'));
});
