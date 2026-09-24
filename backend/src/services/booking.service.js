const db = require('../config/database');
const supplierGateway = require('../suppliers/supplier.gateway');
const paymentGateway = require('./payment.service');
const PricingEngine = require('./pricing.service');
const crypto = require('crypto');

class BookingService {
  /**
   * Generates a unique, professional Tixxgo booking reference (e.g. TXG-123456)
   */
  static generateBookingReference() {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `TXG-${randomNum}`;
  }

  /**
   * Complete End-to-End Booking Creation & Orchestration Workflow
   * Covers Tasks 4, 5, and 6.
   */
  static async createBooking({
    flightDetails,
    supplierResultId,
    supplierCode = 'TBO',
    travellers,
    customerPrice,
    supplierCost,
    idempotencyKey,
    simulationOptions = {}
  }) {
    // 1. Idempotency Check: Prevent duplicate bookings if client double-submits
    if (idempotencyKey) {
      const existing = await db.getBookingByIdempotencyKey(idempotencyKey);
      if (existing) {
        console.log(`[BookingService] Idempotent request detected for key ${idempotencyKey}. Returning existing booking ${existing.bookingReference}`);
        return {
          isIdempotentReplay: true,
          booking: existing,
          travellers: await db.getTravellers(existing.bookingReference),
          auditLogs: await db.getAuditLogs(existing.bookingReference)
        };
      }
    }

    const bookingReference = this.generateBookingReference();
    const trackingId = `TRK-${bookingReference}`;
    const bookingId = crypto.randomUUID();

    // 2. Initialize Booking Record in Database (Task 4)
    // Initial State: PAYMENT_PENDING
    let bookingRecord = {
      id: bookingId,
      bookingReference,
      pnr: null,
      supplierCode,
      supplierResultId,
      flightDetails,
      supplierCost,
      customerPrice,
      paymentStatus: 'PAYMENT_PENDING',
      bookingStatus: 'INITIATED',
      ticketingStatus: 'PENDING',
      idempotencyKey: idempotencyKey || null,
      trackingId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.saveBooking(bookingRecord);
    await db.saveTravellers(bookingReference, travellers);
    await db.logAudit({
      bookingReference,
      action: 'BOOKING_INITIATED',
      previousStatus: null,
      newStatus: 'INITIATED',
      reason: 'Customer initiated checkout'
    });

    // 3. Process Customer Payment (Task 5: PAYMENT_PENDING -> PAYMENT_SUCCESS)
    console.log(`[BookingService] Processing payment for ${bookingReference} amount ${customerPrice.totalAmount} ${customerPrice.currency}...`);
    const paymentResult = await paymentGateway.processPayment({
      amount: customerPrice.totalAmount,
      currency: customerPrice.currency,
      customerEmail: travellers[0]?.email || 'customer@example.com',
      idempotencyKey: idempotencyKey ? `PAY_${idempotencyKey}` : null,
      simulatePaymentFailure: simulationOptions.forcePaymentFailure || false
    });

    if (paymentResult.status !== 'PAYMENT_SUCCESS') {
      bookingRecord.paymentStatus = 'PAYMENT_FAILED';
      bookingRecord.bookingStatus = 'BOOKING_FAILED';
      await db.saveBooking(bookingRecord);
      await db.logAudit({
        bookingReference,
        action: 'PAYMENT_FAILED',
        previousStatus: 'PAYMENT_PENDING',
        newStatus: 'PAYMENT_FAILED',
        reason: paymentResult.errorMessage || 'Payment declined by gateway'
      });

      return {
        success: false,
        status: 'PAYMENT_FAILED',
        error: paymentResult.errorMessage || 'Customer payment was declined',
        booking: bookingRecord
      };
    }

    // Payment Successful!
    bookingRecord.paymentStatus = 'PAYMENT_SUCCESS';
    bookingRecord.bookingStatus = 'SUPPLIER_BOOKING';
    await db.saveBooking(bookingRecord);
    await db.logAudit({
      bookingReference,
      action: 'PAYMENT_CAPTURED',
      previousStatus: 'PAYMENT_PENDING',
      newStatus: 'PAYMENT_SUCCESS',
      metadata: { paymentId: paymentResult.paymentId, amount: paymentResult.amount }
    });

    // 4. Request Booking with Travel Supplier Gateway (Task 5 & 6)
    console.log(`[BookingService] Calling SupplierGateway for ${supplierCode} with trackingId ${trackingId}...`);

    try {
      const supplierBookingResponse = await supplierGateway.createBooking(supplierCode, {
        supplierResultId,
        travellers,
        trackingId,
        forceTimeout: simulationOptions.forceSupplierTimeout || false,
        forceFailure: simulationOptions.forceSupplierFailure || false
      });

      // Supplier Confirmed! (Happy path: SUPPLIER_BOOKING -> BOOKING_CONFIRMED)
      bookingRecord.bookingStatus = 'BOOKING_CONFIRMED';
      bookingRecord.ticketingStatus = supplierBookingResponse.ticketingStatus || 'ISSUED';
      bookingRecord.pnr = supplierBookingResponse.pnr;
      bookingRecord.supplierBookingId = supplierBookingResponse.supplierBookingId;
      await db.saveBooking(bookingRecord);

      await db.logAudit({
        bookingReference,
        action: 'BOOKING_CONFIRMED',
        previousStatus: 'SUPPLIER_BOOKING',
        newStatus: 'BOOKING_CONFIRMED',
        metadata: {
          pnr: bookingRecord.pnr,
          supplierBookingId: supplierBookingResponse.supplierBookingId
        }
      });

      return {
        success: true,
        status: 'BOOKING_CONFIRMED',
        bookingReference,
        pnr: bookingRecord.pnr,
        booking: bookingRecord,
        travellers
      };
    } catch (supplierError) {
      console.error(`[BookingService] Supplier booking encounter:`, supplierError.message);

      // Task 6: Supplier Timeout / Unknown Booking State
      if (supplierError.isTimeout || supplierError.code === 'ETIMEDOUT') {
        console.warn(`[BookingService] TIMEOUT with supplier ${supplierCode}. Transitioning to SUPPLIER_UNKNOWN / BOOKING_IN_PROGRESS to prevent duplicate PNR.`);
        
        bookingRecord.bookingStatus = 'SUPPLIER_UNKNOWN';
        bookingRecord.ticketingStatus = 'PENDING';
        bookingRecord.needsReconciliation = true;
        await db.saveBooking(bookingRecord);

        await db.logAudit({
          bookingReference,
          action: 'SUPPLIER_TIMEOUT',
          previousStatus: 'SUPPLIER_BOOKING',
          newStatus: 'SUPPLIER_UNKNOWN',
          reason: 'Supplier API timed out. Placed in reconciliation queue without re-submitting order.',
          metadata: { error: supplierError.message, trackingId }
        });

        return {
          success: false,
          status: 'SUPPLIER_UNKNOWN',
          bookingReference,
          bookingStatus: 'SUPPLIER_UNKNOWN',
          message: 'Your payment was successful, but the supplier inventory response is pending. Our automated reconciliation service is verifying status to prevent duplicate charges.',
          trackingId,
          booking: bookingRecord
        };
      }

      // Task 5: Customer payment succeeded, but supplier booking failed!
      // (e.g. airline class closed, fare sold out)
      console.warn(`[BookingService] Payment succeeded but supplier inventory failed! Initiating automated refund...`);
      bookingRecord.bookingStatus = 'SUPPLIER_BOOKING_FAILED';
      await db.saveBooking(bookingRecord);

      await db.logAudit({
        bookingReference,
        action: 'SUPPLIER_REJECTED',
        previousStatus: 'SUPPLIER_BOOKING',
        newStatus: 'SUPPLIER_BOOKING_FAILED',
        reason: supplierError.message || 'Supplier rejected booking'
      });

      // Initiate Automatic Refund to protect customer funds
      const refundResult = await paymentGateway.initiateRefund({
        paymentId: paymentResult.paymentId,
        amount: customerPrice.totalAmount,
        reason: 'Automated refund: Supplier failed to confirm flight inventory.',
        idempotencyKey: `RFD_${bookingReference}`
      });

      bookingRecord.paymentStatus = 'REFUNDED';
      bookingRecord.refundReference = refundResult.refundId;
      await db.saveBooking(bookingRecord);

      await db.logAudit({
        bookingReference,
        action: 'AUTOMATIC_REFUND_INITIATED',
        previousStatus: 'PAYMENT_SUCCESS',
        newStatus: 'REFUNDED',
        reason: 'Automated remediation for failed inventory fulfillment',
        metadata: { refundId: refundResult.refundId, amount: refundResult.amount }
      });

      return {
        success: false,
        status: 'SUPPLIER_BOOKING_FAILED',
        bookingReference,
        paymentStatus: 'REFUNDED',
        refundReference: refundResult.refundId,
        message: 'The flight inventory could not be confirmed by the airline. Your payment of ' + customerPrice.currency + ' ' + customerPrice.totalAmount + ' has been automatically refunded to your original payment method.',
        booking: bookingRecord
      };
    }
  }

  /**
   * Reconcile an unknown or pending booking (Task 6)
   */
  static async reconcileBooking(bookingReference) {
    const booking = await db.getBookingByReference(bookingReference);
    if (!booking) {
      throw new Error(`Booking reference ${bookingReference} not found`);
    }

    if (booking.bookingStatus !== 'SUPPLIER_UNKNOWN' && booking.bookingStatus !== 'BOOKING_IN_PROGRESS') {
      return {
        message: `Booking is already in terminal state: ${booking.bookingStatus}`,
        booking
      };
    }

    console.log(`[BookingService] Reconciling unknown booking ${bookingReference} with supplier ${booking.supplierCode}...`);

    // Inquire order status safely using tracking ID (avoids duplicate PNR creation)
    const trackingLookupKey = booking.trackingId || booking.idempotencyKey || `TRK-${bookingReference}`;
    const inquiryResult = await supplierGateway.checkBookingStatus(
      booking.supplierCode,
      trackingLookupKey,
      booking.supplierResultId
    );

    if (inquiryResult.found && inquiryResult.status === 'CONFIRMED') {
      // Booking was actually fulfilled by supplier during the timeout!
      booking.bookingStatus = 'BOOKING_CONFIRMED';
      booking.ticketingStatus = 'ISSUED';
      booking.pnr = inquiryResult.pnr;
      booking.supplierBookingId = inquiryResult.supplierBookingId;
      await db.saveBooking(booking);

      await db.logAudit({
        bookingReference,
        action: 'RECONCILIATION_RESOLVED_CONFIRMED',
        previousStatus: 'SUPPLIER_UNKNOWN',
        newStatus: 'BOOKING_CONFIRMED',
        reason: 'Supplier inquiry confirmed ticket was issued. No duplicate booking created.',
        metadata: { pnr: booking.pnr }
      });

      return {
        status: 'RESOLVED_CONFIRMED',
        bookingReference,
        pnr: booking.pnr,
        booking
      };
    } else {
      // Supplier never received or discarded the order: safely refund
      booking.bookingStatus = 'BOOKING_FAILED';
      await db.saveBooking(booking);

      const refundResult = await paymentGateway.initiateRefund({
        paymentId: `PAY_UNKNOWN_${bookingReference}`,
        amount: booking.customerPrice.totalAmount,
        reason: 'Reconciliation confirmed order was not created with supplier. Initiating safe refund.',
        idempotencyKey: `RFD_RECON_${bookingReference}`
      });

      booking.paymentStatus = 'REFUNDED';
      booking.refundReference = refundResult.refundId;
      await db.saveBooking(booking);

      await db.logAudit({
        bookingReference,
        action: 'RECONCILIATION_RESOLVED_REFUNDED',
        previousStatus: 'SUPPLIER_UNKNOWN',
        newStatus: 'REFUNDED',
        reason: 'Supplier confirmed order does not exist. Customer refunded safely.'
      });

      return {
        status: 'RESOLVED_REFUNDED',
        bookingReference,
        message: 'Order was not created by supplier. Customer has been refunded.',
        booking
      };
    }
  }

  /**
   * Get single booking with all details and audit trail
   */
  static async getBooking(bookingReference) {
    const booking = await db.getBookingByReference(bookingReference);
    if (!booking) return null;
    const travellers = await db.getTravellers(bookingReference);
    const auditLogs = await db.getAuditLogs(bookingReference);
    const cancellation = await db.getCancellation(bookingReference);

    return {
      ...booking,
      travellers,
      auditLogs,
      cancellation
    };
  }
}

module.exports = BookingService;
