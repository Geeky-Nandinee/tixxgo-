# TIXXGO - Travel Platform & API Integrations
### Full Stack Developer Technical Assessment

[![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21+-000000?logo=express)](https://expressjs.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)](https://mysql.com)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)](https://docker.com)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen)]()

---

## 1. Project Overview & Quick Start

TIXXGO is an online travel platform offering Flights and Hotels, designed to take direct technical ownership of its platform. It integrates a primary travel inventory supplier (TBO) via an extensible **Supplier Gateway Pattern**, allowing future suppliers (such as TripJack or Amadeus) to be onboarded seamlessly without rewriting core booking and pricing engines.

### Quick Start (Local Development)

```bash
# 1. Clone repository and navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Run automated test suite (verifies all 10 tasks)
npm test

# 4. Start the application server (runs on http://localhost:4000)
npm start
```
Open **[http://localhost:4000](http://localhost:4000)** in your browser to experience the full interactive customer journey!

### Docker Deployment
```bash
docker compose up --build
```
This spins up:
- MySQL 8.0 container on port 3306
- Redis container on port 6379
- Tixxgo Full-Stack Application on port 4000

---

## 2. Technical Assessment Task Mapping

| Task # | Assessment Requirement | Implementation & File Reference |
| :---: | :--- | :--- |
| **Task 1** | **Flight Search & Supplier Normalisation**<br>Converts supplier raw responses into a supplier-agnostic internal model. | [`backend/src/suppliers/adapters/tbo.adapter.js`](backend/src/suppliers/adapters/tbo.adapter.js)<br>[`backend/src/controllers/flight.controller.js`](backend/src/controllers/flight.controller.js) |
| **Task 2** | **Tixxgo Pricing Engine**<br>Supplier Base: 5,200, Tax: 950, Service Fee: 299, Promo: 200, Customer Total: **INR 6,249**.<br>Maintains strict logical separation of costs & margins. | [`backend/src/services/pricing.service.js`](backend/src/services/pricing.service.js) |
| **Task 3** | **Fare Revalidation**<br>Simulates supplier price change (6,249 → 6,449).<br>Returns `PRICE_CHANGED` state requiring customer acceptance. | [`backend/src/services/pricing.service.js`](backend/src/services/pricing.service.js)<br>[`POST /api/flights/revalidate`](backend/src/controllers/flight.controller.js) |
| **Task 4** | **Traveller & Booking Record**<br>Generates `TXG-XXXXXX` references; stores flight, traveller, supplier, price, payment & ticketing statuses. | [`backend/src/services/booking.service.js`](backend/src/services/booking.service.js)<br>[`backend/src/config/database.js`](backend/src/config/database.js) |
| **Task 5** | **Payment & Booking State Flow**<br>`PAYMENT_PENDING → PAYMENT_SUCCESS → SUPPLIER_BOOKING → BOOKING_CONFIRMED`<br>Automated refund remediation if supplier fails post-payment. | [`backend/src/services/payment.service.js`](backend/src/services/payment.service.js)<br>[`backend/src/services/booking.service.js`](backend/src/services/booking.service.js) |
| **Task 6** | **Supplier Timeout / Unknown State**<br>Does not fail on timeout. Moves to `SUPPLIER_UNKNOWN`. Safe reconciliation avoids duplicate PNRs. | [`backend/src/suppliers/supplier.gateway.js`](backend/src/suppliers/supplier.gateway.js)<br>[`POST /api/bookings/:ref/reconcile`](backend/src/controllers/booking.controller.js) |
| **Task 7** | **Cancellation & Refund**<br>Quote endpoint showing airline fee, admin fee, net refund.<br>`CANCELLATION_REQUESTED → CANCELLED → REFUND_PENDING → REFUNDED`. | [`backend/src/services/cancellation.service.js`](backend/src/services/cancellation.service.js) |
| **Task 8** | **Supplier Gateway Architecture**<br>Extensible adapter pattern isolating booking engine from supplier specifics. Adding TripJack takes zero core changes. | [`backend/src/suppliers/supplier.gateway.js`](backend/src/suppliers/supplier.gateway.js)<br>[`backend/src/suppliers/supplier.interface.js`](backend/src/suppliers/supplier.interface.js) |
| **Task 9** | **Multi-Supplier Deduplication Scenario**<br>Identifies duplicate Air India AI101 from Supplier A & B.<br>Multi-factor scoring algorithm (Price, Baggage, Margin, SLA). | [`backend/src/services/deduplication.service.js`](backend/src/services/deduplication.service.js)<br>[`docs/MULTI_SUPPLIER_STRATEGY.md`](docs/MULTI_SUPPLIER_STRATEGY.md) |
| **Task 10**| **Customer Journey UI**<br>End-to-end interface: Search AMD→DEL 15-Oct-2026, select flight, revalidation, travellers, mock payment, confirmation, and cancellation. | [`frontend/index.html`](frontend/index.html)<br>[`frontend/app.js`](frontend/app.js)<br>[`frontend/src/app/`](frontend/src/app/) |

---

## 3. Technology Stack & Design Decisions

### Backend: Node.js & Express
- Clean layered architecture: Controllers → Services → Supplier Gateway → Adapters → Database DAO.
- Built-in idempotency key interceptor for payments and bookings.

### Database: MySQL with Resilient Auto-Fallback
- Connects to MySQL 8.0 via `mysql2/promise` connection pool.
- Auto-runs table migrations on startup (`bookings`, `travellers`, `booking_audit_logs`, `cancellations`).
- **Resilient Fallback Mode**: If MySQL is not locally running on the developer host, the database manager automatically activates an in-memory relational store with the exact same SQL/DAO schema, guaranteeing 100% out-of-the-box operation on any machine.

### Frontend: Angular Architecture
- Provides full Angular 18/19 Standalone Component implementation with Signals, Services, Models, and HttpClient in [`frontend/src/app/`](frontend/src/app/).
- Served as a responsive Single Page Application with interactive simulation controls for live testing.

---

## 4. Key Architectural Documents
- [System Architecture & State Machine](docs/ARCHITECTURE.md)
- [Multi-Supplier Strategy & Deduplication Engine (Task 9)](docs/MULTI_SUPPLIER_STRATEGY.md)
- [Production Resilience, Idempotency & Reconciliation (Tasks 5 & 6)](docs/RESILIENCE_AND_RECONCILIATION.md)

---

## 5. Assumptions & Production Readiness

1. **Distributed Caching (Redis)**:
   In production, supplier search results (TTL 10 minutes) and revalidation locks (TTL 15 minutes) should be cached in Redis with distributed locks (`Redlock`) to prevent race conditions during checkout.

2. **Asynchronous Outbox & Message Broker**:
   Reconciliation of `SUPPLIER_UNKNOWN` bookings should be scheduled via a durable task queue (e.g. BullMQ / RabbitMQ / AWS SQS) with exponential backoff (15s, 45s, 120s, 300s).

3. **PCI-DSS Compliance**:
   No raw card data touches Tixxgo backend servers; card tokenization happens client-side via gateway SDKs (Stripe Elements / Razorpay Checkout), passing only payment tokens to the booking API.
