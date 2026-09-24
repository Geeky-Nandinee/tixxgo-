/**
 * ISupplierAdapter Interface
 * Defines the contract that every travel inventory supplier (TBO, TripJack, Amadeus, etc.) must implement.
 * This guarantees the core Tixxgo platform is completely decoupled from supplier-specific schemas.
 */
class ISupplierAdapter {
  constructor(supplierCode, supplierName) {
    if (this.constructor === ISupplierAdapter) {
      throw new Error("Cannot instantiate abstract class ISupplierAdapter");
    }
    this.supplierCode = supplierCode;
    this.supplierName = supplierName;
  }

  /**
   * Search for flights and return standardized Tixxgo Flight Offer format.
   * @param {Object} searchParams { origin, destination, departureDate, adults, cabinClass }
   * @returns {Promise<Array<Object>>}
   */
  async search(searchParams) {
    throw new Error("Method 'search' must be implemented.");
  }

  /**
   * Revalidate inventory and fare before booking.
   * @param {Object} params { supplierResultId, flightNumber, clientPrice }
   * @returns {Promise<Object>}
   */
  async revalidate(params) {
    throw new Error("Method 'revalidate' must be implemented.");
  }

  /**
   * Submit booking to supplier PNR creation service.
   * @param {Object} bookingPayload { supplierResultId, travellers, idempotencyKey, trackingId }
   * @returns {Promise<Object>}
   */
  async createBooking(bookingPayload) {
    throw new Error("Method 'createBooking' must be implemented.");
  }

  /**
   * Inquire order status from supplier without re-initiating booking.
   * Essential for resolving timeouts / unknown states safely.
   * @param {string} trackingId
   * @param {string} [supplierBookingRef]
   * @returns {Promise<Object>}
   */
  async checkBookingStatus(trackingId, supplierBookingRef) {
    throw new Error("Method 'checkBookingStatus' must be implemented.");
  }

  /**
   * Request ticket cancellation with supplier.
   * @param {Object} cancelParams { supplierBookingRef, pnr, reason }
   * @returns {Promise<Object>}
   */
  async cancelBooking(cancelParams) {
    throw new Error("Method 'cancelBooking' must be implemented.");
  }
}

module.exports = ISupplierAdapter;
