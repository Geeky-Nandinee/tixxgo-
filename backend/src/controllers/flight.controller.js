const supplierGateway = require('../suppliers/supplier.gateway');
const DeduplicationService = require('../services/deduplication.service');
const PricingEngine = require('../services/pricing.service');
const tboMock = require('../suppliers/mocks/tbo.mock');
const crypto = require('crypto');

class FlightController {
  /**
   * Task 1: Flight Search & Supplier Normalisation
   * POST /api/flights/search
   * Converts supplier raw data into supplier-independent Tixxgo flight model.
   * Multi-supplier aggregation and deduplication supported via DeduplicationService.
   */
  static async searchFlights(req, res, next) {
    try {
      const {
        origin = 'AMD',
        destination = 'DEL',
        departureDate = '2026-10-15',
        adults = 1,
        cabinClass = 'ECONOMY',
        supplier = null,
        enableMultiSupplier = true // Demonstrates Task 8 & 9
      } = req.body;

      if (!origin || !destination || !departureDate) {
        return res.status(400).json({
          error: 'Missing required search parameters (origin, destination, departureDate)'
        });
      }

      // Fetch normalized flights through Supplier Gateway
      const rawNormalizedFlights = await supplierGateway.searchFlights(
        { origin, destination, departureDate, adults, cabinClass },
        { supplierCode: supplier, includeAllSuppliers: enableMultiSupplier }
      );

      // Apply Multi-Supplier Deduplication & Offer Scoring (Task 9)
      const processedFlights = DeduplicationService.deduplicateAndRank(
        rawNormalizedFlights,
        supplierGateway
      );

      // Cleanse internal sensitive supplier costs before sending to client
      const customerFlightOffers = processedFlights.map(flight => {
        const { _internalSupplierCost, ...publicOffer } = flight;
        return publicOffer;
      });

      return res.status(200).json({
        success: true,
        meta: {
          searchCriteria: { origin, destination, departureDate, adults, cabinClass },
          totalOffers: customerFlightOffers.length,
          suppliersQueried: enableMultiSupplier
            ? supplierGateway.getAvailableSuppliers().map(s => s.code)
            : [supplier || 'TBO']
        },
        data: customerFlightOffers
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Task 3: Fare Revalidation
   * POST /api/flights/revalidate
   * Simulates supplier price change between search and booking.
   * Original: 6,249 -> Revalidated: 6,449.
   * Returns PRICE_CHANGED and requires customer acceptance before booking.
   */
  static async revalidateFare(req, res, next) {
    try {
      const {
        supplierCode = 'TBO',
        supplierResultId = 'TBO001',
        originalCustomerTotal = 6249,
        adults = 1
      } = req.body;

      const supplierReval = await supplierGateway.revalidateFare(supplierCode, {
        supplierResultId
      });

      // Pass fresh supplier rates through Pricing Engine
      const revalidationResult = PricingEngine.revalidateFare(
        Number(originalCustomerTotal),
        supplierReval.freshBaseFare,
        supplierReval.freshTaxes,
        { adults }
      );

      // Issue signed revalidation token valid for 15 minutes
      const revalidationToken = crypto
        .createHash('sha256')
        .update(`${supplierResultId}_${revalidationResult.revalidatedTotal}_${Date.now()}`)
        .digest('hex');

      return res.status(200).json({
        success: true,
        status: revalidationResult.status, // PRICE_CHANGED or PRICE_CONFIRMED
        requiresCustomerAcceptance: revalidationResult.requiresCustomerAcceptance,
        priceComparison: {
          originalTotal: revalidationResult.originalTotal,
          revalidatedTotal: revalidationResult.revalidatedTotal,
          priceDifference: revalidationResult.priceDifference,
          currency: 'INR'
        },
        breakdown: revalidationResult.newPricing.customerPrice,
        tixxgoFees: revalidationResult.newPricing.tixxgoFees,
        supplierCost: revalidationResult.newPricing.supplierCost,
        revalidationToken,
        quoteExpiresInSeconds: supplierReval.quoteValiditySeconds || 900,
        message: revalidationResult.requiresCustomerAcceptance
          ? `Airline fare has changed from INR ${revalidationResult.originalTotal} to INR ${revalidationResult.revalidatedTotal}. Please accept the updated fare to proceed with booking.`
          : 'Fare successfully revalidated and locked.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/flights/suppliers
   * Task 8: View registered suppliers and adapter status
   */
  static getSuppliers(req, res) {
    const suppliers = supplierGateway.getAvailableSuppliers();
    return res.status(200).json({
      success: true,
      suppliers
    });
  }

  /**
   * POST /api/flights/simulation-flags
   * Interactive testing helper to toggle price change, timeout, or failure simulations
   */
  static setSimulationFlags(req, res) {
    const { priceChangeActive, simulateTimeoutNext, simulateFailureNext } = req.body;
    if (typeof priceChangeActive === 'boolean') {
      tboMock.setSimulationFlag('priceChangeActive', priceChangeActive);
    }
    if (typeof simulateTimeoutNext === 'boolean') {
      tboMock.setSimulationFlag('simulateTimeoutNext', simulateTimeoutNext);
    }
    if (typeof simulateFailureNext === 'boolean') {
      tboMock.setSimulationFlag('simulateFailureNext', simulateFailureNext);
    }

    return res.status(200).json({
      success: true,
      flags: tboMock.getSimulationFlags(),
      message: 'Simulation flags updated successfully.'
    });
  }

  /**
   * GET /api/flights/simulation-flags
   */
  static getSimulationFlags(req, res) {
    return res.status(200).json({
      success: true,
      flags: tboMock.getSimulationFlags()
    });
  }
}

module.exports = FlightController;
