const BookingService = require('../services/booking.service');
const CancellationService = require('../services/cancellation.service');
const db = require('../config/database');

class BookingController {

  // POST /api/bookings
  static async createBooking(req, res, next) {
    try {
      const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
      const {
        flightDetails,
        supplierResultId,
        supplierCode = 'TBO',
        travellers,
        customerPrice,
        supplierCost,
        simulationOptions = {}
      } = req.body;

      if (!flightDetails || !supplierResultId || !travellers || !travellers.length || !customerPrice) {
        return res.status(400).json({
          error: 'Missing required booking fields (flightDetails, supplierResultId, travellers, customerPrice)'
        });
      }

      const result = await BookingService.createBooking({
        flightDetails,
        supplierResultId,
        supplierCode,
        travellers,
        customerPrice,
        supplierCost: supplierCost || { baseFare: 5200, taxes: 950, totalSupplierCost: 6150 },
        idempotencyKey,
        simulationOptions
      });

      if (!result.success && result.status === 'PAYMENT_FAILED') {
        return res.status(402).json(result);
      }

      if (!result.success && result.status === 'SUPPLIER_UNKNOWN') {
        // HTTP 202 Accepted: Request received and in processing / reconciliation
        return res.status(202).json(result);
      }

      if (!result.success && result.status === 'SUPPLIER_BOOKING_FAILED') {
        // HTTP 409 Conflict / 422 Unprocessable: Supplier booking failed, auto-refund issued
        return res.status(409).json(result);
      }

      // Confirmed!
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Task 4: Retrieve Booking by Reference
   * GET /api/bookings/:reference
   */
  static async getBooking(req, res, next) {
    try {
      const { reference } = req.params;
      const booking = await BookingService.getBooking(reference);

      if (!booking) {
        return res.status(404).json({
          error: `Booking with reference ${reference} not found.`
        });
      }

      return res.status(200).json({
        success: true,
        data: booking
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all bookings for dashboard and evaluation
   * GET /api/bookings
   */
  static async listBookings(req, res, next) {
    try {
      const bookings = await db.listAllBookings();
      return res.status(200).json({
        success: true,
        count: bookings.length,
        data: bookings
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Task 6: Reconcile Unknown Booking State
   * POST /api/bookings/:reference/reconcile
   */
  static async reconcileBooking(req, res, next) {
    try {
      const { reference } = req.params;
      const result = await BookingService.reconcileBooking(reference);
      return res.status(200).json({
        success: true,
        result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Task 7: Step 1 - Get Cancellation Quote
   * GET /api/bookings/:reference/cancel-quote
   */
  static async getCancellationQuote(req, res, next) {
    try {
      const { reference } = req.params;
      const quote = await CancellationService.getCancellationQuote(reference);
      return res.status(200).json({
        success: true,
        data: quote
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Task 7: Step 2 - Execute Cancellation
   * POST /api/bookings/:reference/cancel
   */
  static async cancelBooking(req, res, next) {
    try {
      const { reference } = req.params;
      const { reason } = req.body;
      const result = await CancellationService.cancelBooking(reference, reason);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BookingController;
