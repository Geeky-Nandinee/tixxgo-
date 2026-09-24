/**
 * Mock TripJack Supplier Service (Supplier B)
 * Dynamically generates flight inventory for any searched route.
 * Matches AI101 to demonstrate Task 9 multi-supplier deduplication & scoring on any route.
 */

class TripjackMockService {
  constructor() {
    this.supplierOrders = new Map();
  }

  async searchFlights({ origin = 'AMD', destination = 'DEL', departureDate = '2026-10-15', cabinClass = 'ECONOMY' }) {
    const orig = origin.toUpperCase();
    const dest = destination.toUpperCase();
    const isBusiness = cabinClass.toUpperCase() === 'BUSINESS';
    const multiplier = isBusiness ? 2.5 : 1.0;

    // Check if benchmark AMD -> DEL
    if (orig === 'AMD' && dest === 'DEL' && !isBusiness) {
      return [
        {
          provider: 'TRIPJACK',
          tj_result_id: 'TJ_AI101_DEL',
          carrierCode: 'AI',
          carrierName: 'Air India',
          flightNo: 'AI101',
          src: orig,
          dst: dest,
          depTime: `${departureDate}T14:00:00`,
          arrTime: `${departureDate}T15:45:00`,
          travelTimeMinutes: 105,
          fare: {
            base: 7200,
            tax: 950,
            currency: 'INR'
          },
          baggageAllowance: {
            checkIn: '20 KG',
            cabin: '7 KG'
          },
          farePolicy: {
            refundable: true,
            fareFamily: 'FLEXI_SAVER'
          },
          seatInventory: 9
        },
        {
          provider: 'TRIPJACK',
          tj_result_id: 'TJ_6E502_DEL',
          carrierCode: '6E',
          carrierName: 'IndiGo',
          flightNo: '6E502',
          src: orig,
          dst: dest,
          depTime: `${departureDate}T18:30:00`,
          arrTime: `${departureDate}T20:10:00`,
          travelTimeMinutes: 100,
          fare: {
            base: 5100,
            tax: 900,
            currency: 'INR'
          },
          baggageAllowance: {
            checkIn: '15 KG',
            cabin: '7 KG'
          },
          farePolicy: {
            refundable: false,
            fareFamily: 'SAVER'
          },
          seatInventory: 5
        }
      ];
    }

    // Dynamic flight generation for any route
    const routeHash = (orig.charCodeAt(0) + dest.charCodeAt(0)) % 7;
    const baseFare = Math.round((4100 + routeHash * 380) * multiplier);
    const tax = Math.round(780 + routeHash * 30);

    return [
      // Shared flight offer for Multi-Supplier deduplication (AI101)
      {
        provider: 'TRIPJACK',
        tj_result_id: `TJ_${orig}_${dest}_AI101`,
        carrierCode: 'AI',
        carrierName: 'Air India',
        flightNo: 'AI101',
        src: orig,
        dst: dest,
        depTime: `${departureDate}T14:00:00`,
        arrTime: `${departureDate}T16:30:00`,
        travelTimeMinutes: 150,
        fare: {
          base: Math.round(7200 * multiplier), // Cheaper than TBO's 7500
          tax: 950,
          currency: 'INR'
        },
        baggageAllowance: {
          checkIn: isBusiness ? '35 KG' : '20 KG', // Higher allowance than TBO's 15 KG
          cabin: '7 KG'
        },
        farePolicy: {
          refundable: true,
          fareFamily: 'FLEXI_SAVER'
        },
        seatInventory: 8
      },
      // Unique TripJack flight
      {
        provider: 'TRIPJACK',
        tj_result_id: `TJ_${orig}_${dest}_QP`,
        carrierCode: 'QP',
        carrierName: 'Akasa Air',
        flightNo: `QP${Math.floor(1100 + routeHash * 40)}`,
        src: orig,
        dst: dest,
        depTime: `${departureDate}T17:15:00`,
        arrTime: `${departureDate}T19:40:00`,
        travelTimeMinutes: 145,
        fare: {
          base: baseFare - 200,
          tax: tax,
          currency: 'INR'
        },
        baggageAllowance: {
          checkIn: isBusiness ? '25 KG' : '15 KG',
          cabin: '7 KG'
        },
        farePolicy: {
          refundable: false,
          fareFamily: 'SAVER'
        },
        seatInventory: 6
      }
    ];
  }

  async revalidateFare(resultId) {
    return {
      provider: 'TRIPJACK',
      tj_result_id: resultId,
      status: 'CONFIRMED',
      fare: {
        base: 7200,
        tax: 950
      },
      available: true
    };
  }

  async createBooking({ resultId, travellers, clientToken }) {
    const pnr = `TJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const tjBookingId = `TJ-BKG-${Math.floor(100000 + Math.random() * 900000)}`;

    this.supplierOrders.set(clientToken, {
      tjBookingId,
      pnr,
      resultId,
      status: 'CONFIRMED',
      createdAt: new Date()
    });

    return {
      provider: 'TRIPJACK',
      success: true,
      bookingRef: tjBookingId,
      pnr,
      ticketStatus: 'ISSUED'
    };
  }

  async checkStatus(clientToken) {
    const existing = this.supplierOrders.get(clientToken);
    if (existing) {
      return {
        provider: 'TRIPJACK',
        found: true,
        bookingRef: existing.tjBookingId,
        pnr: existing.pnr,
        status: existing.status
      };
    }
    return { provider: 'TRIPJACK', found: false };
  }

  async cancelBooking({ bookingRef }) {
    return {
      provider: 'TRIPJACK',
      bookingRef,
      status: 'CANCELLED',
      cancellationCharge: 3000,
      refundEligible: 5150
    };
  }
}

const tripjackMock = new TripjackMockService();
module.exports = tripjackMock;
