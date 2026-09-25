const express = require('express');
const cors = require('cors');
const flightRoutes = require('./routes/flight.routes');
const bookingRoutes = require('./routes/booking.routes');
const supplierRoutes = require('./routes/supplier.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

const path = require('path');

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../../frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'tixxgo-backend',
    timestamp: new Date().toISOString()
  });
});

// Core API endpoints
app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/suppliers', supplierRoutes);

// Fallback for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Error Handler
app.use(errorHandler);

module.exports = app;
