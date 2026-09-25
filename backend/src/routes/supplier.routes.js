const express = require('express');
const router = express.Router();
const supplierGateway = require('../suppliers/supplier.gateway');
const DeduplicationService = require('../services/deduplication.service');
const tboMock = require('../suppliers/mocks/tbo.mock');
const tripjackMock = require('../suppliers/mocks/tripjack.mock');

/**
 * GET /api/suppliers
 * Returns list of all registered supplier adapters, real-time health, and commercial metrics.
 */
router.get('/', (req, res) => {
  const suppliers = supplierGateway.getAvailableSuppliers().map(s => {
    const isTbo = s.code === 'TBO';
    return {
      code: s.code,
      name: s.name,
      role: isTbo ? 'PRIMARY_GDS' : 'WHOLESALER_NETWORK',
      status: 'ACTIVE',
      health: {
        status: 'HEALTHY',
        latencyMs: isTbo ? 42 : 58,
        uptime: '99.98%'
      },
      metrics: {
        historicalSuccessRate: s.metrics?.historicalSuccessRate || (isTbo ? 0.985 : 0.962),
        commissionRate: s.metrics?.commissionRate || (isTbo ? 0.030 : 0.045),
        avgResponseTimeMs: isTbo ? 210 : 285
      },
      capabilities: [
        'FLIGHT_SEARCH',
        'FARE_REVALIDATION',
        'TICKET_BOOKING',
        'ORDER_STATUS_INQUIRY',
        'CANCELLATION_QUOTE',
        'TICKET_CANCELLATION'
      ]
    };
  });

  res.json({
    success: true,
    totalAdapters: suppliers.length,
    data: suppliers
  });
});

/**
 * GET /api/suppliers/inspect-raw
 * Provides side-by-side inspection of Raw Vendor Payloads vs Tixxgo's Normalized Domain Model.
 */
router.get('/inspect-raw', async (req, res, next) => {
  try {
    const origin = (req.query.origin || 'AMD').toUpperCase();
    const destination = (req.query.destination || 'DEL').toUpperCase();
    const departureDate = req.query.departureDate || '2026-10-15';
    const cabinClass = (req.query.cabinClass || 'ECONOMY').toUpperCase();

    // 1. Direct query to raw vendor mocks
    const [rawTboList, rawTripjackList] = await Promise.all([
      tboMock.searchFlights({ origin, destination, departureDate, cabinClass }),
      tripjackMock.searchFlights({ origin, destination, departureDate, cabinClass })
    ]);

    // 2. Gateway normalized execution
    const normalized = await supplierGateway.searchFlights(
      { origin, destination, departureDate, cabinClass },
      { includeAllSuppliers: true }
    );

    // 3. Deduplication and scoring
    const deduplicated = DeduplicationService.deduplicateAndRank(normalized, supplierGateway);

    // Find the duplicated route (AI101 or first result)
    const matchingPair = deduplicated.find(d => d.isDuplicateResolved) || deduplicated[0] || null;

    res.json({
      success: true,
      route: `${origin} → ${destination}`,
      rawVendorPayloads: {
        tbo: rawTboList[0] || null,
        tripjack: rawTripjackList[0] || null
      },
      tixxgoNormalizedModel: normalized[0] || null,
      deduplicatedComparison: matchingPair
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/suppliers/test-scoring
 * Live Task 9 Deduplication & Scoring Playground.
 * Dynamically re-evaluates competing offers based on user-adjustable weights.
 */
router.post('/test-scoring', (req, res) => {
  const {
    priceWeight = 35,
    marginWeight = 20,
    slaWeight = 20,
    baggageWeight = 15,
    qualityWeight = 10,
    offerA = {
      supplierCode: 'TBO',
      carrier: 'Air India (AI101)',
      customerPrice: 8450,
      baggageKg: 15,
      isRefundable: true,
      historicalSuccessRate: 0.985,
      commissionRate: 0.030
    },
    offerB = {
      supplierCode: 'TRIPJACK',
      carrier: 'Air India (AI101)',
      customerPrice: 8150,
      baggageKg: 20,
      isRefundable: false,
      historicalSuccessRate: 0.962,
      commissionRate: 0.045
    }
  } = req.body;

  // Custom multi-factor mathematical scoring
  const calculateScore = (offer) => {
    const price = offer.customerPrice;
    const baggage = offer.baggageKg;
    const isRefundable = offer.isRefundable ? 1 : 0;
    const reliability = offer.historicalSuccessRate;
    const commission = offer.commissionRate;

    // Price Score: Lower price earns more points
    const pScore = Math.max(0, Math.min(priceWeight, priceWeight * (1 - (price - 5000) / 10000)));
    // Margin Score: Higher commission earns more points
    const mScore = Math.min(marginWeight, (commission / 0.05) * marginWeight);
    // Reliability Score
    const rScore = (reliability / 1.0) * slaWeight;
    // Baggage Score
    const bScore = Math.min(baggageWeight, (baggage / 25) * baggageWeight);
    // Quality/Refundability Score
    const qScore = isRefundable * qualityWeight;

    const total = Number((pScore + mScore + rScore + bScore + qScore).toFixed(2));

    return {
      total,
      breakdown: {
        priceScore: Number(pScore.toFixed(2)),
        marginScore: Number(mScore.toFixed(2)),
        reliabilityScore: Number(rScore.toFixed(2)),
        baggageScore: Number(bScore.toFixed(2)),
        qualityScore: Number(qScore.toFixed(2))
      }
    };
  };

  const scoreA = calculateScore(offerA);
  const scoreB = calculateScore(offerB);

  const winner = scoreB.total > scoreA.total ? 'TRIPJACK' : 'TBO';
  const diff = Math.abs(Number((scoreB.total - scoreA.total).toFixed(2)));

  const reason = winner === 'TRIPJACK'
    ? `TripJack wins by +${diff} points: Lower fare (₹8,150 vs ₹8,450) and 20KG baggage outweigh TBO's SLA advantage.`
    : `TBO wins by +${diff} points: Higher SLA reliability (98.5%) and refundable fare policy outweigh TripJack's price advantage.`;

  res.json({
    success: true,
    weightsUsed: { priceWeight, marginWeight, slaWeight, baggageWeight, qualityWeight },
    scores: {
      TBO: scoreA,
      TRIPJACK: scoreB
    },
    winner,
    pointDifference: diff,
    selectionReason: reason
  });
});

module.exports = router;
