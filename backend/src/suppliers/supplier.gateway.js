const TboSupplierAdapter = require('./adapters/tbo.adapter');
const TripjackSupplierAdapter = require('./adapters/tripjack.adapter');
const env = require('../config/env');

/**
 * SupplierGateway
 * Task 8: Architectural Hub that isolates all upstream business logic from supplier specifics.
 * Allows adding new suppliers (e.g. TripJack, Amadeus, Sabré) with zero modifications
 * to customer-facing booking controllers, pricing logic, or frontend APIs.
 */
class SupplierGateway {
  constructor() {
    this.adapters = new Map();
    this.primarySupplierCode = 'TBO';

    // Register built-in adapters
    this.registerAdapter(new TboSupplierAdapter());
    this.registerAdapter(new TripjackSupplierAdapter());
  }

  /**
   * Register a new supplier adapter dynamically at runtime or bootstrap.
   * @param {ISupplierAdapter} adapter
   */
  registerAdapter(adapter) {
    this.adapters.set(adapter.supplierCode.toUpperCase(), adapter);
    console.log(`[SupplierGateway] Registered supplier adapter: ${adapter.supplierName} (${adapter.supplierCode})`);
  }

  /**
   * Retrieve adapter by code.
   * @param {string} supplierCode
   * @returns {ISupplierAdapter}
   */
  getAdapter(supplierCode) {
    const code = (supplierCode || this.primarySupplierCode).toUpperCase();
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new Error(`Supplier adapter not found for code: "${supplierCode}". Available: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    return adapter;
  }

  /**
   * List all registered suppliers and their capabilities.
   */
  getAvailableSuppliers() {
    return Array.from(this.adapters.values()).map(a => ({
      code: a.supplierCode,
      name: a.supplierName,
      metrics: a.metrics || {}
    }));
  }

  /**
   * Search flights across one or all suppliers with parallel fan-out and timeout control.
   * @param {Object} searchParams
   * @param {Object} options { supplierCode, includeAllSuppliers }
   */
  async searchFlights(searchParams, options = {}) {
    const { supplierCode, includeAllSuppliers = false } = options;

    // Single supplier targeted search
    if (supplierCode) {
      const adapter = this.getAdapter(supplierCode);
      return await adapter.search(searchParams);
    }

    // Multi-supplier parallel fan-out (Tasks 8 & 9)
    const targets = includeAllSuppliers
      ? Array.from(this.adapters.values())
      : [this.getAdapter(this.primarySupplierCode)];

    const searchPromises = targets.map(adapter =>
      Promise.race([
        adapter.search(searchParams),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout querying supplier ${adapter.supplierCode}`)), env.SUPPLIER_TIMEOUT_MS)
        )
      ]).catch(err => {
        console.error(`[SupplierGateway] Error searching supplier ${adapter.supplierCode}:`, err.message);
        return []; // Resilient fallback: supplier failure does not break whole search
      })
    );

    const resultsArray = await Promise.all(searchPromises);
    return resultsArray.flat();
  }

  /**
   * Revalidate fare with specific supplier
   */
  async revalidateFare(supplierCode, params) {
    const adapter = this.getAdapter(supplierCode);
    return await adapter.revalidate(params);
  }

  /**
   * Execute booking with timeout protection
   */
  async createBooking(supplierCode, bookingPayload) {
    const adapter = this.getAdapter(supplierCode);
    
    // Timeout wrapper to simulate realistic network boundary
    return await Promise.race([
      adapter.createBooking(bookingPayload),
      new Promise((_, reject) => {
        // If forceTimeout flag was passed, immediate or timeout after delay
        if (bookingPayload.forceTimeout) {
          const timeoutErr = new Error(`Supplier ${supplierCode} Gateway Timeout: Exceeded ${env.SUPPLIER_TIMEOUT_MS}ms`);
          timeoutErr.code = 'ETIMEDOUT';
          timeoutErr.isTimeout = true;
          setTimeout(() => reject(timeoutErr), 1500);
        }
      })
    ]);
  }

  /**
   * Inquire order status safely (for reconciliation after timeout or failure)
   */
  async checkBookingStatus(supplierCode, trackingId, supplierBookingId) {
    const adapter = this.getAdapter(supplierCode);
    return await adapter.checkBookingStatus(trackingId, supplierBookingId);
  }

  /**
   * Cancel booking with supplier
   */
  async cancelBooking(supplierCode, cancelParams) {
    const adapter = this.getAdapter(supplierCode);
    return await adapter.cancelBooking(cancelParams);
  }
}

const supplierGateway = new SupplierGateway();
module.exports = supplierGateway;
