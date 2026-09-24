/**
 * Mock TripJack Supplier Service (Supplier B)
 * Used to demonstrate:
 * - Task 8: Adding a 2nd supplier without rewriting the customer platform
 * - Task 9: Multi-supplier deduplication and intelligent offer scoring
 */

class TripjackMockService {
  constructor() {
    this.supplierOrders = new Map();
  }

  async searchFlights({ origin = 'AMD', destination = 'DEL', departureDate = '2026-10-15' }) {
    // Note: TripJack API format is deliberately different from TBO to prove normalization!
    // Example: TripJack uses `flightNo` instead of `flightNumber`, `depTime` instead of `departure`, etc.
    return [
      {
        provider: 'TRIPJACK',
        tj_result_id: 'TJ_AI101_DEL',
        carrierCode: 'AI',
        carrierName: 'Air India',
        flightNo: 'AI101',
        src: origin.toUpperCase(),
        dst: destination.toUpperCase(),
        depTime: `${departureDate}T14:00:00`,
        arrTime: `${departureDate}T15:45:00`,
        travelTimeMinutes: 105,
        fare: {
          base: 7200, // 7200 base + 950 taxes = 8150 supplier cost (cheaper than TBO's 8450!)
          tax: 950,
          currency: 'INR'
        },
        baggageAllowance: {
          checkIn: '20 KG', // Higher allowance than TBO's 15 KG!
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
        src: origin.toUpperCase(),
        dst: destination.toUpperCase(),
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
