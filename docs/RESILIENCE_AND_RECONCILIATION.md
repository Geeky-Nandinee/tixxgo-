# Tasks 5 & 6: Production Resilience, Idempotency & Reconciliation

## Executive Summary
In travel e-commerce, the most dangerous edge case is **distributed transaction divergence**:
1. **Scenario A**: The customer's payment succeeds on the payment gateway, but the airline supplier rejects the booking (inventory exhausted).
2. **Scenario B**: The customer's payment succeeds, but the supplier API times out before returning a response. The platform does not know if the airline created a PNR or dropped the packet.

A naive retry would create a duplicate PNR and double-bill the customer. Marking it as failed when the airline actually issued the ticket leads to an unmonitored ticket issuance.

Tixxgo solves both scenarios through **Idempotency Keys**, a **Three-Phase State Machine**, and **Asynchronous Status Reconciliation**.

---

## 1. Idempotency Pattern (Duplicate Prevention)
- Every checkout request generates a cryptographically unique `Idempotency-Key` (e.g., `TXG_IDEM_<timestamp>_<uuid>`).
- If a customer double-clicks "Pay" or a mobile client retries an interrupted network request:
  1. The database checks `SELECT * FROM bookings WHERE idempotency_key = ?`.
  2. If found, the existing transaction record is returned immediately without charging the payment gateway again or calling the supplier API a second time.

---

## 2. Handling Scenario A: Payment Succeeded, Supplier Failed (Task 5)
```
[Customer Payment: SUCCESS] 
          │
          ▼
[Supplier Booking: REJECTED] (e.g. Airline Class Sold Out)
          │
          ├── 1. Transition Booking Status to: SUPPLIER_BOOKING_FAILED
          │
          ├── 2. Auto-Trigger Payment Gateway: initiateRefund()
          │      └─ Refund ID generated & stored in cancellations/bookings table
          │
          ├── 3. Transition Payment Status to: REFUNDED
          │
          ├── 4. Write immutable Audit Trail Entry with error diagnostics
          │
          └── 5. Send automated customer email/SMS notification with apology
```
**Key Advantage**: Zero financial loss for the customer, automated remediation without manual agent intervention.

---

## 3. Handling Scenario B: Supplier Timeout / Unknown State (Task 6)

### Golden Rule:
> **A network timeout is NOT a confirmed failure.** The airline's GDS may have received the order, created the PNR, and deducted credit before the response dropped.

### The 4-Step Timeout Lifecycle:
1. **Graceful Timeout Interception**:
   - When the supplier call exceeds the SLA threshold (`SUPPLIER_TIMEOUT_MS = 4000ms`), the request is caught.
   - The booking transitions to `SUPPLIER_UNKNOWN` / `BOOKING_IN_PROGRESS`.
   - Ticketing status remains `PENDING`.
   - The client receives an immediate `202 Accepted` response with a message: *"Payment received. Your airline confirmation is being finalized. We are verifying status with the carrier."*

2. **Idempotency Tracking ID**:
   - Every supplier booking call carries an internal tracking reference `TRK-<bookingRef>-<timestamp>`.
   - The supplier must store this tracking ID against the order.

3. **Safe Status Inquiry (Reconciliation)**:
   - The background worker or manual sync triggers `checkBookingStatus(trackingId)`:
   - **Case 1: Supplier Confirms Order Exists**:
     - Supplier returns issued PNR.
     - Booking transitions to `BOOKING_CONFIRMED` and `TICKETING: ISSUED`.
     - Confirmation email dispatched to customer.
   - **Case 2: Supplier Confirms Order Never Reached Them**:
     - Booking transitions to `BOOKING_FAILED`.
     - Automatic refund initiated to customer's card.
     - Payment status transitions to `REFUNDED`.

4. **Zero Duplicate PNR Guarantee**:
   - The reconciliation process **NEVER calls `createBooking` again**. It ONLY executes read-only inquiry endpoints (`GET /order-status?trackingId=...`).
