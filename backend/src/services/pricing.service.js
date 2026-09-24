const env = require('../config/env');

/**
 * Tixxgo Pricing Engine
 * Task 2: Logical separation of supplier cost, platform fees/promotions, and customer selling price.
 * 
 * Spec:
 *  - Supplier Base Fare: INR 5,200
 *  - Taxes: INR 950
 *  - Tixxgo Service Fee: INR 299
 *  - Tixxgo Promotion: INR 200 discount
 *  - Expected Customer Total: INR 6,249
 */
class PricingEngine {
  /**
   * Calculate customer price and maintain strict separation between cost & revenue.
   * @param {Object} params
   * @param {number} params.baseFare - Supplier raw base fare
   * @param {number} params.taxes - Supplier raw taxes & fees
   * @param {number} [params.customServiceFee] - Optional override for service fee
   * @param {number} [params.customDiscount] - Optional override for promotion discount
   * @param {string} [params.promoCode] - Promotion code applied
   * @param {number} [params.adults] - Number of passengers
   * @param {string} [params.currency] - Currency code (default INR)
   */
  static calculateFare({
    baseFare,
    taxes,
    customServiceFee = null,
    customDiscount = null,
    promoCode = 'TIXXPROMO200',
    adults = 1,
    currency = 'INR'
  }) {
    const rawBaseFare = Number(baseFare) * adults;
    const rawTaxes = Number(taxes) * adults;

    // Supplier Cost Layer (Settlement obligation with travel inventory supplier)
    const supplierCost = {
      baseFare: rawBaseFare,
      taxes: rawTaxes,
      totalSupplierCost: rawBaseFare + rawTaxes,
      currency
    };

    // Tixxgo Platform Layer (Markup, fees, promotions)
    const serviceFee = customServiceFee !== null ? Number(customServiceFee) : env.TIXXGO_SERVICE_FEE;
    const promoDiscount = customDiscount !== null ? Number(customDiscount) : env.TIXXGO_DEFAULT_PROMO_DISCOUNT;
    const netRevenue = serviceFee - promoDiscount;

    const tixxgoFees = {
      serviceFee,
      promoDiscount,
      promoCode: promoDiscount > 0 ? promoCode : null,
      netRevenue, // Tixxgo net margin earned on this transaction
      currency
    };

    // Customer Selling Price Layer (Exposed to frontend / checkout)
    // Formula: (SupplierBase + Taxes + ServiceFee) - PromoDiscount
    const totalAmount = (rawBaseFare + rawTaxes + serviceFee) - promoDiscount;

    const customerPrice = {
      baseFare: rawBaseFare,
      taxes: rawTaxes,
      serviceFee,
      discount: promoDiscount,
      totalAmount,
      currency
    };

    return {
      supplierCost,
      tixxgoFees,
      customerPrice
    };
  }

  /**
   * Revalidate fare against an existing quotation.
   * Compares original customer price with fresh supplier quote.
   */
  static revalidateFare(originalCustomerTotal, freshSupplierBase, freshSupplierTaxes, options = {}) {
    const newPricing = this.calculateFare({
      baseFare: freshSupplierBase,
      taxes: freshSupplierTaxes,
      ...options
    });

    const newCustomerTotal = newPricing.customerPrice.totalAmount;
    const priceDifference = newCustomerTotal - originalCustomerTotal;

    const isPriceChanged = priceDifference !== 0;

    return {
      status: isPriceChanged ? 'PRICE_CHANGED' : 'PRICE_CONFIRMED',
      originalTotal: originalCustomerTotal,
      revalidatedTotal: newCustomerTotal,
      priceDifference,
      requiresCustomerAcceptance: isPriceChanged,
      newPricing
    };
  }
}

module.exports = PricingEngine;
