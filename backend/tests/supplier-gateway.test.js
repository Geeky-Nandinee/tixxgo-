const test = require('node:test');
const assert = require('node:assert');
const supplierGateway = require('../src/suppliers/supplier.gateway');

test('Task 1 & 8: SupplierGateway normalizes raw supplier output to internal Tixxgo model', async () => {
  const searchResults = await supplierGateway.searchFlights(
    { origin: 'AMD', destination: 'DEL', departureDate: '2026-10-15', adults: 1, cabinClass: 'ECONOMY' },
    { supplierCode: 'TBO' }
  );

  assert.ok(Array.isArray(searchResults));
  assert.ok(searchResults.length > 0);

  const flight = searchResults[0];
  // Verify supplier raw fields are normalized away
  assert.strictEqual(flight.origin.code, 'AMD');
  assert.strictEqual(flight.destination.code, 'DEL');
  assert.strictEqual(flight.flightNumber, 'AI482');
  assert.strictEqual(flight.airline.code, 'AI');
  assert.strictEqual(flight.pricing.customerPrice.totalAmount, 6249);
  assert.strictEqual(flight.pricing.customerPrice.baseFare, 5200);
  assert.strictEqual(flight.pricing.customerPrice.taxes, 950);
  assert.strictEqual(flight.pricing.customerPrice.serviceFee, 299);
  assert.strictEqual(flight.pricing.customerPrice.discount, 200);
});

test('Task 8: SupplierGateway manages multiple adapters without modifying upstream logic', () => {
  const suppliers = supplierGateway.getAvailableSuppliers();
  const codes = suppliers.map(s => s.code);
  assert.ok(codes.includes('TBO'));
  assert.ok(codes.includes('TRIPJACK'));
});
