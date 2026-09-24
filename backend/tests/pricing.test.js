const test = require('node:test');
const assert = require('node:assert');
const PricingEngine = require('../src/services/pricing.service');

test('Task 2: Tixxgo Pricing Engine separates supplier cost, fees, and customer price', () => {
  const result = PricingEngine.calculateFare({
    baseFare: 5200,
    taxes: 950,
    customServiceFee: 299,
    customDiscount: 200,
    promoCode: 'TIXX200'
  });

  // Verify Supplier Cost Layer
  assert.strictEqual(result.supplierCost.baseFare, 5200);
  assert.strictEqual(result.supplierCost.taxes, 950);
  assert.strictEqual(result.supplierCost.totalSupplierCost, 6150);

  // Verify Tixxgo Fee Layer
  assert.strictEqual(result.tixxgoFees.serviceFee, 299);
  assert.strictEqual(result.tixxgoFees.promoDiscount, 200);
  assert.strictEqual(result.tixxgoFees.netRevenue, 99);

  // Verify Customer Selling Price Layer
  assert.strictEqual(result.customerPrice.baseFare, 5200);
  assert.strictEqual(result.customerPrice.taxes, 950);
  assert.strictEqual(result.customerPrice.serviceFee, 299);
  assert.strictEqual(result.customerPrice.discount, 200);
  assert.strictEqual(result.customerPrice.totalAmount, 6249);
});

test('Task 3: Fare Revalidation detects price change (6249 -> 6449)', () => {
  const originalCustomerTotal = 6249;
  const freshSupplierBase = 5400; // Increased by 200
  const freshSupplierTaxes = 950;

  const revalidation = PricingEngine.revalidateFare(
    originalCustomerTotal,
    freshSupplierBase,
    freshSupplierTaxes,
    { customServiceFee: 299, customDiscount: 200 }
  );

  assert.strictEqual(revalidation.status, 'PRICE_CHANGED');
  assert.strictEqual(revalidation.originalTotal, 6249);
  assert.strictEqual(revalidation.revalidatedTotal, 6449);
  assert.strictEqual(revalidation.priceDifference, 200);
  assert.strictEqual(revalidation.requiresCustomerAcceptance, true);
});
