const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/booking.controller');

// Task 4, 5, 6: Create booking
router.post('/', BookingController.createBooking);

// List all bookings
router.get('/', BookingController.listBookings);

// Task 4: Retrieve booking details
router.get('/:reference', BookingController.getBooking);

// Task 6: Reconcile unknown state
router.post('/:reference/reconcile', BookingController.reconcileBooking);

// Task 7: Cancellation quote and confirmation
router.get('/:reference/cancel-quote', BookingController.getCancellationQuote);
router.post('/:reference/cancel', BookingController.cancelBooking);

module.exports = router;
