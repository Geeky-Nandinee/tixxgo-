/**
 * Mock Payment Gateway Service
 * Simulates real payment processors (e.g. Stripe, Razorpay, Adyen)
 * Handles:
 *  - Payment initiation
 *  - Idempotent charge capture
 *  - Immediate or async refunds
 */
class PaymentGatewayService {
  constructor() {
    this.transactions = new Map();
    this.refunds = new Map();
  }

  /**
   * Process customer payment charge
   * @param {Object} params { amount, currency, customerEmail, idempotencyKey, simulatePaymentFailure }
   */
  async processPayment({
    amount,
    currency = 'INR',
    customerEmail,
    idempotencyKey,
    simulatePaymentFailure = false
  }) {
    // 1. Check idempotency: If payment already captured for this idempotency key, return existing transaction
    if (idempotencyKey && this.transactions.has(idempotencyKey)) {
      console.log(`[PaymentGateway] Idempotency match for key ${idempotencyKey}. Returning existing transaction.`);
      return this.transactions.get(idempotencyKey);
    }

    if (simulatePaymentFailure) {
      const failedTxn = {
        paymentId: `PAY-FAIL-${Date.now()}`,
        status: 'PAYMENT_FAILED',
        amount,
        currency,
        errorCode: 'CARD_DECLINED',
        errorMessage: 'Insufficient funds or card declined by issuing bank.',
        timestamp: new Date()
      };
      if (idempotencyKey) this.transactions.set(idempotencyKey, failedTxn);
      return failedTxn;
    }

    // Happy path: payment success
    const paymentId = `PAY-TXG-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const successfulTxn = {
      paymentId,
      status: 'PAYMENT_SUCCESS',
      amount,
      currency,
      customerEmail,
      paymentMethod: 'CREDIT_CARD_VISA',
      gatewayReference: `gw_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date()
    };

    if (idempotencyKey) {
      this.transactions.set(idempotencyKey, successfulTxn);
    }

    return successfulTxn;
  }

  /**
   * Initiate refund (used when supplier booking fails post-payment, or upon customer cancellation)
   * @param {Object} params { paymentId, amount, reason, idempotencyKey }
   */
  async initiateRefund({ paymentId, amount, reason, idempotencyKey }) {
    const refundId = `RFD-TXG-${Math.floor(100000 + Math.random() * 900000)}`;
    const refundRecord = {
      refundId,
      originalPaymentId: paymentId,
      amount,
      status: 'REFUND_SUCCESS',
      reason,
      refundReference: `acq_rfd_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date()
    };

    this.refunds.set(refundId, refundRecord);
    console.log(`[PaymentGateway] Refund initiated: ${refundId} for amount INR ${amount}. Reason: "${reason}"`);
    return refundRecord;
  }
}

const paymentGateway = new PaymentGatewayService();
module.exports = paymentGateway;
