/**
 * Mock TBO Supplier Service
 * Dynamically generates realistic flight inventory based on searched origin, destination, date, and cabin class.
 * Preserves the exact benchmark flights for AMD -> DEL (Task 1, 2, 3, 9) while supporting any global airport route.
 */

const AIRPORTS = {
  AMD: { city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel Intl' },
  DEL: { city: 'Delhi', name: 'Indira Gandhi Intl' },
  BOM: { city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj Intl' },
  BLR: { city: 'Bengaluru', name: 'Kempegowda Intl' },
  GOA: { city: 'Goa', name: 'Goa Intl (Dabolim/Mopa)' },
  GOI: { city: 'Goa', name: 'Dabolim Airport' },
  GOX: { city: 'Goa', name: 'Manohar Intl (Mopa)' },
  HYD: { city: 'Hyderabad', name: 'Rajiv Gandhi Intl' },
  CCU: { city: 'Kolkata', name: 'Netaji Subhash Chandra Bose Intl' },
  MAA: { city: 'Chennai', name: 'Chennai Intl' },
  PNQ: { city: 'Pune', name: 'Pune Airport' },
  JAI: { city: 'Jaipur', name: 'Jaipur Intl' },
  COK: { city: 'Kochi', name: 'Cochin Intl' },
  LKO: { city: 'Lucknow', name: 'Chaudhary Charan Singh Intl' },
  SXR: { city: 'Srinagar', name: 'Sheikh ul-Alam Intl' },
  DXB: { city: 'Dubai', name: 'Dubai Intl' },
  SIN: { city: 'Singapore', name: 'Changi Airport' },
  LHR: { city: 'London', name: 'Heathrow Airport' }
};

function getCity(code) {
  const c = code.toUpperCase();
  return AIRPORTS[c] ? AIRPORTS[c].city : c;
}

class TboMockService {
  constructor() {
    this.supplierOrders = new Map();
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

  async searchFlights({ origin = 'AMD', destination = 'DEL', departureDate = '2026-10-15', cabinClass = 'ECONOMY' }) {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();
    const isBusiness = cabinClass.toUpperCase() === 'BUSINESS';
    const multiplier = isBusiness ? 2.6 : 1.0;

    // Check if searching benchmark route (AMD -> DEL on 2026-10-15)
    if (orig === 'AMD' && dest === 'DEL' && !isBusiness) {
      return [
        {
          supplier: 'TBO',
          supplierResultId: 'TBO001',
          airline: 'AI',
          airlineName: 'Air India',
          flightNumber: 'AI482',
          origin: orig,
          destination: dest,
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
          origin: orig,
          destination: dest,
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
          origin: orig,
          destination: dest,
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

    // Dynamic generation for ANY searched route (e.g. GOA -> DEL, BOM -> BLR, etc.)
    const routeHash = (orig.charCodeAt(0) + dest.charCodeAt(0) + orig.charCodeAt(1)) % 10;
    const baseRate = Math.round((4200 + routeHash * 350) * multiplier);
    const taxRate = Math.round(750 + routeHash * 40);

    return [
      {
        supplier: 'TBO',
        supplierResultId: `TBO_${orig}_${dest}_AI`,
        airline: 'AI',
        airlineName: 'Air India',
        flightNumber: `AI${Math.floor(400 + routeHash * 23)}`,
        origin: orig,
        destination: dest,
        departure: `${departureDate}T09:15:00`,
        arrival: `${departureDate}T11:45:00`,
        duration: '2h 30m',
        baseFare: baseRate + 400,
        taxes: taxRate + 120,
        baggage: isBusiness ? '30 KG' : '15 KG',
        cabinBaggage: isBusiness ? '12 KG' : '7 KG',
        refundable: true,
        seatsRemaining: 7
      },
      {
        supplier: 'TBO',
        supplierResultId: `TBO_${orig}_${dest}_6E`,
        airline: '6E',
        airlineName: 'IndiGo',
        flightNumber: `6E${Math.floor(200 + routeHash * 31)}`,
        origin: orig,
        destination: dest,
        departure: `${departureDate}T06:30:00`,
        arrival: `${departureDate}T09:00:00`,
        duration: '2h 30m',
        baseFare: baseRate - 300,
        taxes: taxRate,
        baggage: isBusiness ? '25 KG' : '15 KG',
        cabinBaggage: '7 KG',
        refundable: false,
        seatsRemaining: 9
      },
      {
        supplier: 'TBO',
        supplierResultId: `TBO_${orig}_${dest}_UK`,
        airline: 'UK',
        airlineName: 'Vistara',
        flightNumber: `UK${Math.floor(700 + routeHash * 19)}`,
        origin: orig,
        destination: dest,
        departure: `${departureDate}T15:45:00`,
        arrival: `${departureDate}T18:15:00`,
        duration: '2h 30m',
        baseFare: baseRate + 600,
        taxes: taxRate + 150,
        baggage: isBusiness ? '35 KG' : '20 KG',
        cabinBaggage: isBusiness ? '12 KG' : '7 KG',
        refundable: true,
        seatsRemaining: 5
      },
      // Shared flight offer for Multi-Supplier deduplication on this route (Task 9)
      {
        supplier: 'TBO',
        supplierResultId: `TBO_${orig}_${dest}_SHARED`,
        airline: 'AI',
        airlineName: 'Air India',
        flightNumber: `AI101`,
        origin: orig,
        destination: dest,
        departure: `${departureDate}T14:00:00`,
        arrival: `${departureDate}T16:30:00`,
        duration: '2h 30m',
        baseFare: Math.round(7500 * multiplier),
        taxes: 950,
        baggage: isBusiness ? '30 KG' : '15 KG',
        cabinBaggage: '7 KG',
        refundable: true,
        seatsRemaining: 6
      }
    ];
  }

  async revalidateFare(supplierResultId) {
    if (supplierResultId.includes('TBO001') && this.simulationState.priceChangeActive) {
      return {
        supplier: 'TBO',
        supplierResultId,
        isValid: true,
        priceChanged: true,
        freshBaseFare: 5400,
        freshTaxes: 950,
        baggage: '15 KG',
        refundable: true,
        availableSeats: 5,
        quoteValiditySeconds: 900
      };
    }

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
    if (forceTimeout || this.simulationState.simulateTimeoutNext) {
      this.simulationState.simulateTimeoutNext = false;
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

    if (forceFailure || this.simulationState.simulateFailureNext) {
      this.simulationState.simulateFailureNext = false;
      const err = new Error('Supplier Booking Failed: Airline class inventory closed (ERR_CLASS_UNAVAILABLE)');
      err.code = 'ERR_INVENTORY_EXHAUSTED';
      err.isInventoryFailed = true;
      throw err;
    }

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
    return {
      supplier: 'TBO',
      supplierBookingId,
      pnr,
      cancellationStatus: 'CONFIRMED',
      supplierPenaltyAmount: 3000,
      refundableSupplierCost: 3150,
      cancellationReference: `TBO-CNX-${Math.floor(100000 + Math.random() * 900000)}`
    };
  }
}

const tboMock = new TboMockService();
module.exports = tboMock;
