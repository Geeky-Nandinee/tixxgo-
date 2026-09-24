const express = require('express');
const router = express.Router();
const FlightController = require('../controllers/flight.controller');

// Task 1: Search flights
router.post('/search', FlightController.searchFlights);

// Task 3: Fare revalidation
router.post('/revalidate', FlightController.revalidateFare);

// Task 8: Registered suppliers
router.get('/suppliers', FlightController.getSuppliers);

// Testing & evaluation simulation controls
router.get('/simulation-flags', FlightController.getSimulationFlags);
router.post('/simulation-flags', FlightController.setSimulationFlags);

module.exports = router;
