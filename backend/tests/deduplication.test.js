const test = require('node:test');
const assert = require('node:assert');
const supplierGateway = require('../src/suppliers/supplier.gateway');
const DeduplicationService = require('../src/services/deduplication.service');

test('Task 9: Deduplication engine groups AI101 from Supplier A & B and selects optimal offer', async () => {
  // Query both TBO and TripJack
  const flights = await supplierGateway.searchFlights(
    { origin: 'AMD', destination: 'DEL', departureDate: '2026-10-15', adults: 1 },
    { includeAllSuppliers: true }
  );

  const rankedFlights = DeduplicationService.deduplicateAndRank(flights, supplierGateway);

  // Find the AI101 flight
  const ai101 = rankedFlights.find(f => f.flightNumber === 'AI101');
  assert.ok(ai101, 'AI101 should exist in ranked results');

  // Verify deduplication resolved
  assert.strictEqual(ai101.isDuplicateResolved, true);
  assert.ok(ai101.alternateSupplierOffers.length > 0);

  // Verify winning supplier: TripJack offered lower price (8,150 vs 8,450) and higher baggage (20 KG vs 15 KG)
  assert.strictEqual(ai101.supplierCode, 'TRIPJACK');
  assert.strictEqual(ai101.alternateSupplierOffers[0].supplierCode, 'TBO');
});
