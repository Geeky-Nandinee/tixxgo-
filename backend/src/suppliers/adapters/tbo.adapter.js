const ISupplierAdapter = require('../supplier.interface');
const tboMock = require('../mocks/tbo.mock');
const PricingEngine = require('../../services/pricing.service');

const AIRPORT_CITIES = {
  AMD: 'Ahmedabad',
  DEL: 'Delhi',
  BOM: 'Mumbai',
  BLR: 'Bengaluru',
  GOA: 'Goa (Dabolim/Mopa)',
  GOI: 'Goa (Dabolim)',
  GOX: 'Goa (Mopa)',
  HYD: 'Hyderabad',
  CCU: 'Kolkata',
  MAA: 'Chennai',
  PNQ: 'Pune',
  JAI: 'Jaipur',
  COK: 'Kochi',
  LKO: 'Lucknow',
  SXR: 'Srinagar',
  DXB: 'Dubai',
  SIN: 'Singapore',
  LHR: 'London'
};

function resolveCityName(code) {
  return AIRPORT_CITIES[code?.toUpperCase()] || code;
}

class TboSupplierAdapter extends ISupplierAdapter {
  constructor() {
    super('TBO', 'Travel Boutique Online');
    // Supplier performance SLA metrics for Task 9 scoring
    this.metrics = {
      historicalSuccessRate: 0.985, // 98.5% booking confirmation reliability
      averageLatencyMs: 420,
      commissionRate: 0.03 // 3% negotiated supplier commission
    };
  }

  /**
   * Search and normalize TBO flight inventory
   */
  async search(searchParams) {
    const rawFlights = await tboMock.searchFlights(searchParams);

    return rawFlights.map(raw => {
      // Pass raw supplier base fare and taxes through Tixxgo Pricing Engine
      const pricing = PricingEngine.calculateFare({
        baseFare: raw.baseFare,
        taxes: raw.taxes,
        adults: searchParams.adults || 1
      });



      return {
        id: `TXG-FL-TBO-${raw.supplierResultId}`,
        supplierCode: this.supplierCode,
        supplierResultId: raw.supplierResultId,
        airline: {
          code: raw.airline,
          name: raw.airlineName || (raw.airline === 'AI' ? 'Air India' : raw.airline === '6E' ? 'IndiGo' : 'Airline')
        },
        flightNumber: raw.flightNumber,
        origin: {
          code: raw.origin,
          city: resolveCityName(raw.origin)
        },
        destination: {
          code: raw.destination,
          city: resolveCityName(raw.destination)
        },
        departureTime: raw.departure,
        arrivalTime: raw.arrival,
        duration: raw.duration,
        cabinClass: searchParams.cabinClass || 'ECONOMY',
        baggage: {
          checkIn: raw.baggage || '15 KG',
          cabin: raw.cabinBaggage || '7 KG'
        },
        isRefundable: Boolean(raw.refundable),
        availableSeats: raw.seatsRemaining || 9,
        // Expose public customer price and platform breakdown; supplier cost stays in backend
        pricing: {
          customerPrice: pricing.customerPrice,
          tixxgoFees: pricing.tixxgoFees
        },
        _internalSupplierCost: pricing.supplierCost // Protected internal field for backend use
      };
    });
  }

  async revalidate(params) {
    const reval = await tboMock.revalidateFare(params.supplierResultId);
    return {
      supplierCode: this.supplierCode,
      supplierResultId: reval.supplierResultId,
      isValid: reval.isValid,
      priceChanged: reval.priceChanged,
      freshBaseFare: reval.freshBaseFare,
      freshTaxes: reval.freshTaxes,
      baggage: reval.baggage,
      isRefundable: reval.refundable,
      quoteValiditySeconds: reval.quoteValiditySeconds
    };
  }

  async createBooking(bookingPayload) {
    return await tboMock.bookTicket({
      supplierResultId: bookingPayload.supplierResultId,
      travellers: bookingPayload.travellers,
      trackingId: bookingPayload.trackingId,
      forceTimeout: bookingPayload.forceTimeout,
      forceFailure: bookingPayload.forceFailure
    });
  }

  async checkBookingStatus(trackingId) {
    return await tboMock.checkOrderStatus(trackingId);
  }

  async cancelBooking(cancelParams) {
    return await tboMock.cancelTicket({
      supplierBookingId: cancelParams.supplierBookingId,
      pnr: cancelParams.pnr
    });
  }
}

module.exports = TboSupplierAdapter;
