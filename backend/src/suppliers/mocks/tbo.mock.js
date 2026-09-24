/**
 * Mock TBO Supplier Service
 * Simulates real-world behavior of travel wholesaler APIs:
 * - Search inventory
 * - Fare revalidation (with dynamic price change triggers)
 * - Booking fulfillment (with timeout and failure simulation triggers)
 * - Order inquiry (for safe post-timeout reconciliation)
 * - Cancellation terms and execution
 */

class TboMockService {
  constructor() {
    this.supplierOrders = new Map();
    // Pre-seed some default behavior flags
    this.simulationState = {
      priceChangeActive: true, // For Task 3 demonstration
      simulateTimeoutNext: false, // For Task 6 demonstration
      simulateFailureNext: false // For Task 5 failed booking demonstration
    };
  }

  setSimulationFlag(flag, value) {
    this.simulationState[flag] = value;
  }

  getSimulationFlags() {
    return { ...this.simulationState };
  }

  async searchFlights({ origin = 'AMD', destination = 'DEL', departureDate = '2026-10-15' }) {
    // Return raw TBO API schema (supplier-specific keys)
    return [
      {
        supplier: 'TBO',
        supplierResultId: 'TBO001',
        airline: 'AI',
        airlineName: 'Air India',
        flightNumber: 'AI482',
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departure: `${departureDate}T10:30:00`,
        arrival: `${departureDate}T12:10:00`,
        duration: '1h 40m',
        baseFare: 5200,
        taxes: 950,
        baggage: '15 KG',
        cabinBaggage: '7 KG',
        refundable: true,
        seatsRemaining: 9
      },
      {
        supplier: 'TBO',
        supplierResultId: 'TBO002',
        airline: '6E',
        airlineName: 'IndiGo',
        flightNumber: '6E204',
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departure: `${departureDate}T06:15:00`,
        arrival: `${departureDate}T07:55:00`,
        duration: '1h 40m',
        baseFare: 4800,
        taxes: 850,
        baggage: '15 KG',
        cabinBaggage: '7 KG',
        refundable: false,
        seatsRemaining: 4
      },
      {
        supplier: 'TBO',
        supplierResultId: 'TBO003_AI101',
        airline: 'AI',
        airlineName: 'Air India',
        flightNumber: 'AI101',
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departure: `${departureDate}T14:00:00`,
        arrival: `${departureDate}T15:45:00`,
        duration: '1h 45m',
        baseFare: 7500,
        taxes: 950,
        baggage: '15 KG',
        cabinBaggage: '7 KG',
        refundable: true,
        seatsRemaining: 6
      }
    ];
  }

  async revalidateFare(supplierResultId) {
    // Task 3: Simulate supplier price change between search and booking
    // Original TBO001: base 5200 + taxes 950 + service fee 299 - promo 200 = 6249
    // When priceChangeActive is true: base becomes 5400 (+200) -> customer total becomes 6449!
    if (supplierResultId === 'TBO001' && this.simulationState.priceChangeActive) {
      return {
        supplier: 'TBO',
        supplierResultId: 'TBO001',
        isValid: true,
        priceChanged: true,
        freshBaseFare: 5400, // +200 increase from 5200
        freshTaxes: 950,
        baggage: '15 KG',
        refundable: true,
        availableSeats: 5,
        quoteValiditySeconds: 900 // 15 min lock
      };
    }

    // Default: confirm existing price
    return {
      supplier: 'TBO',
      supplierResultId,
      isValid: true,
      priceChanged: false,
      freshBaseFare: 5200,
      freshTaxes: 950,
      baggage: '15 KG',
      refundable: true,
      availableSeats: 8,
      quoteValiditySeconds: 900
    };
  }

  async bookTicket({ supplierResultId, travellers, trackingId, forceTimeout = false, forceFailure = false }) {
    // Task 6: Simulate supplier timeout
    if (forceTimeout || this.simulationState.simulateTimeoutNext) {
      this.simulationState.simulateTimeoutNext = false;
      
      // In a real-world scenario, the supplier background process may still commit or fail
      // We simulate that the order was actually created in supplier DB, but network timed out before response
      const simulatedPnr = `TBO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      this.supplierOrders.set(trackingId, {
        supplierOrderRef: `TBORD-${Date.now()}`,
        trackingId,
        pnr: simulatedPnr,
        status: 'CONFIRMED',
        ticketIssued: true,
        createdAt: new Date()
      });

      const err = new Error('TBO Gateway Timeout: No response from airline GDS within 30000ms');
      err.code = 'ETIMEDOUT';
      err.isTimeout = true;
      throw err;
    }

    // Task 5: Simulate payment success but supplier booking fails
    if (forceFailure || this.simulationState.simulateFailureNext) {
      this.simulationState.simulateFailureNext = false;
      const err = new Error('Supplier Booking Failed: Airline class inventory closed (ERR_CLASS_UNAVAILABLE)');
      err.code = 'ERR_INVENTORY_EXHAUSTED';
      err.isInventoryFailed = true;
      throw err;
    }

    // Normal happy path
    const pnr = `TBO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const supplierOrderRef = `TBORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const orderData = {
      supplierOrderRef,
      trackingId,
      pnr,
      supplierResultId,
      status: 'CONFIRMED',
      ticketIssued: true,
      travellers,
      createdAt: new Date()
    };

    this.supplierOrders.set(trackingId, orderData);

    return {
      supplier: 'TBO',
      success: true,
      supplierBookingId: supplierOrderRef,
      pnr,
      ticketingStatus: 'ISSUED',
      message: 'Booking confirmed and e-ticket generated successfully.'
    };
  }

  async checkOrderStatus(trackingId) {
    // Task 6: Inquire order status safely using tracking ID (idempotency key)
    const existing = this.supplierOrders.get(trackingId);
    if (existing) {
      return {
        supplier: 'TBO',
        found: true,
        supplierBookingId: existing.supplierOrderRef,
        pnr: existing.pnr,
        status: existing.status,
        ticketingStatus: existing.ticketIssued ? 'ISSUED' : 'PENDING'
      };
    }
    return {
      supplier: 'TBO',
      found: false,
      status: 'NOT_FOUND',
      message: 'No booking record found for this tracking ID.'
    };
  }

  async cancelTicket({ supplierBookingId, pnr }) {
    // Task 7: Supplier cancellation simulation
    return {
      supplier: 'TBO',
      supplierBookingId,
      pnr,
      cancellationStatus: 'CONFIRMED',
      supplierPenaltyAmount: 3000, // Standard airline cancellation penalty
      refundableSupplierCost: 3150, // 6150 - 3000
      cancellationReference: `TBO-CNX-${Math.floor(100000 + Math.random() * 900000)}`
    };
  }
}

const tboMock = new TboMockService();
module.exports = tboMock;
