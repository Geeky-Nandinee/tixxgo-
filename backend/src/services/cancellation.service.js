const db = require('../config/database');
const supplierGateway = require('../suppliers/supplier.gateway');
const paymentGateway = require('./payment.service');

class CancellationService {
  /**
   * Task 7: Step 1 - Obtain cancellation conditions & charges quote before confirmation.
   * Calculates airline penalty, Tixxgo fee, and net estimated refund.
   */
  static async getCancellationQuote(bookingReference) {
    const booking = await db.getBookingByReference(bookingReference);
    if (!booking) {
      throw new Error(`Booking ${bookingReference} not found`);
    }

    if (booking.bookingStatus !== 'BOOKING_CONFIRMED') {
      throw new Error(`Booking cannot be cancelled. Current status: ${booking.bookingStatus}`);
    }

    const totalPaid = Number(booking.customerPrice.totalAmount);
    
    // Airline / Supplier Penalty (e.g. standard domestic cancellation fee INR 3,000)
    const airlineCancellationPenalty = 3000;
    // Tixxgo platform administrative cancellation fee
    const tixxgoCancellationFee = 250;

    const estimatedRefund = Math.max(0, totalPaid - airlineCancellationPenalty - tixxgoCancellationFee);

    return {
      bookingReference,
      flightNumber: booking.flightDetails?.flightNumber || 'AI482',
      pnr: booking.pnr,
      totalPaid,
      breakdown: {
        airlineCancellationPenalty,
        tixxgoCancellationFee,
        estimatedRefund
      },
      currency: booking.customerPrice.currency || 'INR',
      terms: 'Refund will be credited to the original payment method within 5-7 business days.'
    };
  }

  /**
   * Task 7: Step 2 - Execute cancellation and track full state progression:
   * CANCELLATION_REQUESTED -> CANCELLED -> REFUND_PENDING -> REFUNDED
   */
  static async cancelBooking(bookingReference, reason = 'Customer requested cancellation') {
    const booking = await db.getBookingByReference(bookingReference);
    if (!booking) {
      throw new Error(`Booking ${bookingReference} not found`);
    }

    if (booking.bookingStatus === 'CANCELLED') {
      throw new Error(`Booking ${bookingReference} is already cancelled`);
    }

    // 1. State: CANCELLATION_REQUESTED
    booking.bookingStatus = 'CANCELLATION_REQUESTED';
    await db.saveBooking(booking);
    await db.logAudit({
      bookingReference,
      action: 'CANCELLATION_REQUESTED',
      previousStatus: 'BOOKING_CONFIRMED',
      newStatus: 'CANCELLATION_REQUESTED',
      reason
    });

    // 2. Submit cancellation with travel supplier
    const supplierCancelResult = await supplierGateway.cancelBooking(booking.supplierCode, {
      supplierBookingId: booking.supplierBookingId || booking.supplierResultId,
      pnr: booking.pnr
    });

    // 3. State: CANCELLED
    booking.bookingStatus = 'CANCELLED';
    booking.ticketingStatus = 'CANCELLED';
    await db.saveBooking(booking);
    await db.logAudit({
      bookingReference,
      action: 'SUPPLIER_TICKET_CANCELLED',
      previousStatus: 'CANCELLATION_REQUESTED',
      newStatus: 'CANCELLED',
      metadata: supplierCancelResult
    });

    // 4. Calculate Net Refund
    const airlinePenalty = supplierCancelResult.supplierPenaltyAmount || 3000;
    const tixxgoFee = 250;
    const refundAmount = Math.max(0, booking.customerPrice.totalAmount - airlinePenalty - tixxgoFee);

    // 5. State: REFUND_PENDING
    booking.paymentStatus = 'REFUND_PENDING';
    await db.saveBooking(booking);
    await db.logAudit({
      bookingReference,
      action: 'REFUND_QUEUED',
      previousStatus: 'PAYMENT_SUCCESS',
      newStatus: 'REFUND_PENDING',
      reason: `Eligible refund calculated: INR ${refundAmount}`
    });

    // 6. Initiate Payment Gateway Refund -> REFUNDED
    const refundTxn = await paymentGateway.initiateRefund({
      paymentId: `PAY_ORIG_${bookingReference}`,
      amount: refundAmount,
      reason: `Customer cancellation refund for ${bookingReference}`,
      idempotencyKey: `RFD_CNX_${bookingReference}`
    });

    booking.paymentStatus = 'REFUNDED';
    await db.saveBooking(booking);
    await db.logAudit({
      bookingReference,
      action: 'REFUND_COMPLETED',
      previousStatus: 'REFUND_PENDING',
      newStatus: 'REFUNDED',
      metadata: {
        refundId: refundTxn.refundId,
        amount: refundAmount
      }
    });

    const cancellationRecord = {
      id: require('crypto').randomUUID(),
      bookingReference,
      supplierPenalty: airlinePenalty,
      tixxgoFee,
      refundAmount,
      status: 'REFUNDED',
      refundReference: refundTxn.refundId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.saveCancellation(cancellationRecord);

    return {
      success: true,
      bookingReference,
      status: 'REFUNDED',
      cancellationRecord,
      message: `Booking successfully cancelled. Refund of INR ${refundAmount} initiated (Ref: ${refundTxn.refundId}).`
    };
  }
}

module.exports = CancellationService;
