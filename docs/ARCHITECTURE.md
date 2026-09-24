# TIXXGO Travel Platform Architecture

## 1. System Overview
Tixxgo is an enterprise-grade Online Travel Platform designed to integrate heterogeneous airline and hotel inventory suppliers (e.g., TBO, TripJack, Amadeus) while presenting a unified, supplier-agnostic customer experience.

### High-Level Architectural Diagram
```
                     ┌─────────────────────────────────────────┐
                     │          Customer Clients               │
                     │  (Angular SPA / Mobile Web / Apps)      │
                     └────────────────────┬────────────────────┘
                                          │  REST / JSON
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │         Tixxgo API Gateway              │
                     │    (Express Middleware & Routing)       │
                     └───────┬─────────────────────────┬───────┘
                             │                         │
             ┌───────────────┴───────────────┐         ▼
             ▼                               ▼   ┌────────────────┐
   ┌───────────────────┐           ┌───────────┐ │ Payment Gateway│
   │  Pricing Engine   │           │  Booking  │ │  (Mock / Real) │
   │ (Markup / Promos) │           │  Service  │ └────────────────┘
   └─────────┬─────────┘           └─────┬─────┘
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
             ┌───────────────────────────┐
             │     Supplier Gateway      │
             │   (Orchestration Hub)     │
             └──────┬─────────────┬──────┘
                    │             │
                    ▼             ▼
             ┌─────────────┐ ┌─────────────┐
             │ TBO Adapter │ │TripJack Adpt│
             └──────┬──────┘ └──────┬──────┘
                    │             │
                    ▼             ▼
             ┌─────────────┐ ┌─────────────┐
             │   TBO API   │ │ TripJack API│
             └─────────────┘ └─────────────┘
```

---

## 2. Decoupling & Gateway Pattern (Task 8)
To prevent supplier lock-in and eliminate the risk of rewriting downstream booking workflows when adding new suppliers (e.g. adding TripJack after 12 months), the platform uses the **Adapter Pattern** mediated by a centralized **Supplier Gateway**:

1. **`ISupplierAdapter` Contract**:
   Every supplier integration implements:
   - `search(criteria)`
   - `revalidate(params)`
   - `createBooking(payload)`
   - `checkBookingStatus(trackingId, bookingRef)`
   - `cancelBooking(cancelParams)`

2. **Data Normalization (Task 1)**:
   Supplier-specific response structures are never passed directly to the frontend. The adapter converts raw schemas into the standardized `TixxgoFlightOffer` internal model.

3. **Dynamic Registry**:
   New adapters are registered via `supplierGateway.registerAdapter(adapter)`. The core booking controllers remain 100% agnostic of whether an offer originated from TBO or TripJack.

---

## 3. Booking State Machine (Tasks 4, 5, 6, 7)
The booking lifecycle is governed by an explicit finite state machine with strict transactional boundaries:

```
[INITIATED]
    │
    ▼ Customer authorizes payment
[PAYMENT_PENDING]
    │
    ├─ Payment fails ──> [PAYMENT_FAILED] (Terminal)
    ▼ Payment succeeds
[PAYMENT_SUCCESS]
    │
    ▼ Submit order to Supplier
[SUPPLIER_BOOKING]
    │
    ├─ Supplier confirms PNR ──> [BOOKING_CONFIRMED] ──> [TICKETING: ISSUED]
    │                                  │
    │                                  ▼ Customer requests cancellation
    │                            [CANCELLATION_REQUESTED]
    │                                  │
    │                                  ▼ Airline confirms cancellation
    │                            [CANCELLED]
    │                                  │
    │                                  ▼ Payment gateway refund
    │                            [REFUND_PENDING] ──> [REFUNDED]
    │
    ├─ Supplier rejects (seat unavailable) ──> [SUPPLIER_BOOKING_FAILED]
    │                                                │
    │                                                ▼ Auto-remediation trigger
    │                                          [PAYMENT: REFUNDED]
    │
    └─ Supplier API times out (ETIMEDOUT) ───> [SUPPLIER_UNKNOWN] (Task 6)
                                                     │
                                                     ▼ Safe Background Reconciliation
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                              [BOOKING_CONFIRMED]         [BOOKING_FAILED]
                              (PNR issued found)         (Never created)
                                                                 │
                                                                 ▼
                                                        [PAYMENT: REFUNDED]
```

---

## 4. Database Schema
- **`bookings`**: Stores core booking metadata, customer selling price, supplier settlement cost, payment status, booking status, ticketing status, and idempotency key.
- **`travellers`**: Stores passenger details (name, email, phone, passport).
- **`booking_audit_logs`**: Append-only audit trail logging every status transition, triggering action, and remediation reason.
- **`cancellations`**: Stores cancellation penalty calculations, administrative fee, and refund reference.
