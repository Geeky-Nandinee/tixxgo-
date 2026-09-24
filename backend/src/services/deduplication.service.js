/**
 * Deduplication & Multi-Supplier Offer Selection Service
 * Task 9: Identifies identical itineraries across multiple suppliers and selects the optimal offer
 * based on Price, Baggage, Refundability, Commercial Margin, and Supplier Reliability.
 */
class DeduplicationService {
  /**
   * Generates a deterministic fingerprint for a flight itinerary.
   * Matches same physical flight regardless of supplier terminology.
   */
  static generateFlightSignature(flight) {
    const airline = (flight.airline.code || '').trim().toUpperCase();
    const flightNo = (flight.flightNumber || '').trim().toUpperCase().replace(/\s+/g, '');
    const origin = (flight.origin.code || flight.origin).trim().toUpperCase();
    const dest = (flight.destination.code || flight.destination).trim().toUpperCase();
    // Normalize departure timestamp up to minute resolution
    const depTime = (flight.departureTime || '').substring(0, 16);

    return `${airline}_${flightNo}_${origin}_${dest}_${depTime}`;
  }

  /**
   * Calculates a composite multi-factor score for an offer.
   * Higher score = better overall offer for customer and platform.
   */
  static scoreOffer(flight, supplierMetrics = {}) {
    const customerPrice = flight.pricing?.customerPrice?.totalAmount || 999999;
    const baggageKg = parseInt(flight.baggage?.checkIn || '0', 10);
    const isRefundable = flight.isRefundable ? 1 : 0;
    const reliability = supplierMetrics.historicalSuccessRate || 0.95; // 0.0 - 1.0
    const commissionRate = supplierMetrics.commissionRate || 0.03;

    // 1. Price Score (35 points max - lower price gives higher score)
    // Normalized against reference price of 10,000 INR
    const priceScore = Math.max(0, Math.min(35, 35 * (1 - (customerPrice - 5000) / 10000)));

    // 2. Commercial Margin Score (20 points max - higher commission earned by Tixxgo)
    const marginScore = Math.min(20, (commissionRate / 0.05) * 20);

    // 3. Supplier Reliability Score (20 points max - avoids post-payment booking failures)
    const reliabilityScore = (reliability / 1.0) * 20;

    // 4. Baggage Value Score (15 points max - e.g. 20kg checkin vs 15kg checkin)
    const baggageScore = Math.min(15, (baggageKg / 25) * 15);

    // 5. Refundability / Flexibility (10 points max)
    const refundScore = isRefundable * 10;

    const totalScore = Number((priceScore + marginScore + reliabilityScore + baggageScore + refundScore).toFixed(2));

    return {
      totalScore,
      breakdown: {
        priceScore: Number(priceScore.toFixed(2)),
        marginScore: Number(marginScore.toFixed(2)),
        reliabilityScore: Number(reliabilityScore.toFixed(2)),
        baggageScore: Number(baggageScore.toFixed(2)),
        refundScore: Number(refundScore.toFixed(2))
      },
      evaluationFactors: {
        customerPrice,
        baggage: flight.baggage?.checkIn,
        isRefundable: Boolean(flight.isRefundable),
        supplierReliability: `${(reliability * 100).toFixed(1)}%`,
        commissionRate: `${(commissionRate * 100).toFixed(1)}%`
      }
    };
  }

  /**
   * Process a list of flight offers from multiple suppliers:
   * - Groups matching itineraries.
   * - Computes scoring for each candidate offer.
   * - Selects the top offer to present to customer.
   * - Keeps alternative supplier options attached for fallback routing.
   */
  static deduplicateAndRank(flights, supplierGateway) {
    const flightGroups = new Map();

    for (const flight of flights) {
      const signature = this.generateFlightSignature(flight);
      if (!flightGroups.has(signature)) {
        flightGroups.set(signature, []);
      }
      flightGroups.get(signature).push(flight);
    }

    const optimizedResults = [];

    for (const [signature, candidateOffers] of flightGroups.entries()) {
      if (candidateOffers.length === 1) {
        // No duplicate found across suppliers
        const flight = candidateOffers[0];
        const adapter = supplierGateway.getAdapter(flight.supplierCode);
        const score = this.scoreOffer(flight, adapter.metrics);
        optimizedResults.push({
          ...flight,
          offerScore: score,
          isDuplicateResolved: false,
          alternateSupplierOffers: []
        });
      } else {
        // Multiple suppliers returned this exact flight (e.g. AI101 from TBO and TripJack)
        const scoredOffers = candidateOffers.map(offer => {
          const adapter = supplierGateway.getAdapter(offer.supplierCode);
          const score = this.scoreOffer(offer, adapter.metrics);
          return {
            ...offer,
            offerScore: score
          };
        });

        // Rank by highest composite score (or lowest customer price)
        scoredOffers.sort((a, b) => b.offerScore.totalScore - a.offerScore.totalScore);

        const winningOffer = scoredOffers[0];
        const alternativeOffers = scoredOffers.slice(1);

        optimizedResults.push({
          ...winningOffer,
          isDuplicateResolved: true,
          selectionReason: `Selected ${winningOffer.supplierCode} (Score: ${winningOffer.offerScore.totalScore}) over ${alternativeOffers.map(o => `${o.supplierCode} (Score: ${o.offerScore.totalScore})`).join(', ')} based on optimal price, baggage allowance, and commercial terms.`,
          alternateSupplierOffers: alternativeOffers.map(alt => ({
            supplierCode: alt.supplierCode,
            supplierResultId: alt.supplierResultId,
            customerPrice: alt.pricing.customerPrice,
            baggage: alt.baggage,
            offerScore: alt.offerScore
          }))
        });
      }
    }

    // Sort overall list by departure time then customer price
    return optimizedResults.sort((a, b) => {
      const timeCompare = new Date(a.departureTime) - new Date(b.departureTime);
      if (timeCompare !== 0) return timeCompare;
      return a.pricing.customerPrice.totalAmount - b.pricing.customerPrice.totalAmount;
    });
  }
}

module.exports = DeduplicationService;
