const ISupplierAdapter = require('../supplier.interface');
const tripjackMock = require('../mocks/tripjack.mock');
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

class TripjackSupplierAdapter extends ISupplierAdapter {
  constructor() {
    super('TRIPJACK', 'TripJack Wholesaler Network');
    // Supplier performance SLA metrics for Task 9 scoring
    this.metrics = {
      historicalSuccessRate: 0.962, // 96.2% reliability
      averageLatencyMs: 310,
      commissionRate: 0.045 // 4.5% negotiated supplier commission
    };
  }

  async search(searchParams) {
    const rawFlights = await tripjackMock.searchFlights(searchParams);

    return rawFlights.map(raw => {
      // Pass raw TripJack fare to Pricing Engine
      const pricing = PricingEngine.calculateFare({
        baseFare: raw.fare.base,
        taxes: raw.fare.tax,
        adults: searchParams.adults || 1
      });

      return {
        id: `TXG-FL-TJ-${raw.tj_result_id}`,
        supplierCode: this.supplierCode,
        supplierResultId: raw.tj_result_id,
        airline: {
          code: raw.carrierCode,
          name: raw.carrierName
        },
        flightNumber: raw.flightNo,
        origin: {
          code: raw.src,
          city: resolveCityName(raw.src)
        },
        destination: {
          code: raw.dst,
          city: resolveCityName(raw.dst)
        },
        departureTime: raw.depTime,
        arrivalTime: raw.arrTime,
        duration: `${Math.floor(raw.travelTimeMinutes / 60)}h ${raw.travelTimeMinutes % 60}m`,
        cabinClass: searchParams.cabinClass || 'ECONOMY',
        baggage: {
          checkIn: raw.baggageAllowance.checkIn || '15 KG',
          cabin: raw.baggageAllowance.cabin || '7 KG'
        },
        isRefundable: Boolean(raw.farePolicy.refundable),
        availableSeats: raw.seatInventory || 9,
        fareFamily: raw.farePolicy.fareFamily,
        pricing: {
          customerPrice: pricing.customerPrice,
          tixxgoFees: pricing.tixxgoFees
        },
        _internalSupplierCost: pricing.supplierCost
      };
    });
  }

  async revalidate(params) {
    const res = await tripjackMock.revalidateFare(params.supplierResultId);
    return {
      supplierCode: this.supplierCode,
      supplierResultId: res.tj_result_id,
      isValid: res.available,
      priceChanged: false,
      freshBaseFare: res.fare.base,
      freshTaxes: res.fare.tax,
      quoteValiditySeconds: 900
    };
  }

  async createBooking(bookingPayload) {
    const res = await tripjackMock.createBooking({
      resultId: bookingPayload.supplierResultId,
      travellers: bookingPayload.travellers,
      clientToken: bookingPayload.trackingId
    });
    return {
      supplier: 'TRIPJACK',
      success: res.success,
      supplierBookingId: res.bookingRef,
      pnr: res.pnr,
      ticketingStatus: res.ticketStatus
    };
  }

  async checkBookingStatus(trackingId) {
    return await tripjackMock.checkStatus(trackingId);
  }

  async cancelBooking(cancelParams) {
    return await tripjackMock.cancelBooking({
      bookingRef: cancelParams.supplierBookingId
    });
  }
}

module.exports = TripjackSupplierAdapter;
