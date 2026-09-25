# TIXXGO - Travel Platform & API Integrations

Enterprise travel booking platform featuring a decoupled **Multi-Supplier Gateway**, **Dynamic Pricing Engine**, **Resilient Booking State Machine**, and an **Interactive Web UI**.

---

## 🚀 Quick Start Guide

Follow these simple steps to run the application locally:

### Step 1: Navigate to Backend
```bash
cd backend
```

### Step 2: Set Up Environment Variables
Create your `.env` file from the provided template:
```bash
# Windows PowerShell
copy .env.example .env

# Mac / Linux
cp .env.example .env
```
*(The default configuration works out of the box without requiring manual changes.)*

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Run Automated Tests (Verifies All Tasks)
```bash
npm test
```
All 9 test suites verify search normalization, pricing math, fare revalidation, booking lifecycle, timeout reconciliation, cancellation refunds, and multi-supplier deduplication.

### Step 5: Start the Server
```bash
npm run dev
# or: npm start
```

### Step 6: Open the Application
Open **[http://localhost:4000](http://localhost:4000)** in your browser.

---

## 🚀 Deployment Guide

TIXXGO is packaged as a unified full-stack application that serves both the normalized REST APIs and the interactive frontend on a single port. Choose any of the deployment options below:

### Option 1: Free Cloud Hosting on Render (Recommended)
1. Push this project to your **GitHub** repository.
2. Sign in to **[Render.com](https://render.com)** and click **New +** → **Web Service**.
3. Connect your repository. Render will automatically detect [`render.yaml`](render.yaml):
   * **Runtime**: Node
   * **Build Command**: `cd backend && npm install`
   * **Start Command**: `cd backend && npm start`
4. Click **Create Web Service**. Your live app will be accessible via free public HTTPS (e.g., `https://tixxgo.onrender.com`).

### Option 2: 1-Click Deployment on Railway
1. Sign in to **[Railway.app](https://railway.app)**.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Railway automatically detects the root [`Dockerfile`](Dockerfile) and deploys both backend and frontend.
4. Go to **Settings** → **Generate Domain** to get your public live URL.

### Option 3: Docker & Docker Compose
To run everything (Node.js app, MySQL 8.0, and Redis) locally or on a server with Docker:
1. Ensure **Docker Desktop** is open and running.
2. Run from the project root:
   ```bash
   docker compose up --build
   ```
3. Open **[http://localhost:4000](http://localhost:4000)** in your browser.

### Option 4: Linux VPS (Ubuntu / AWS EC2 / DigitalOcean)
```bash
# 1. Clone repository
git clone <your-repo-url> && cd TIXXGO

# 2. Install dependencies
cd backend && npm install

# 3. Start with PM2 process manager
npm install -g pm2
pm2 start src/server.js --name "tixxgo"
pm2 save && pm2 startup
```

---

## 📋 Assessment Task Overview

| Task | Feature | Implementation Summary |
| :--- | :--- | :--- |
| **Task 1** | **Flight Search & Normalization** | Translates heterogeneous supplier payloads (TBO, TripJack) into a canonical domain model (`FlightOffer`). |
| **Task 2** | **Tixxgo Pricing Engine** | Strict logical separation: Base (₹5,200) + Tax (₹950) + Fee (+₹299) - Promo (-₹200) = **₹6,249**. |
| **Task 3** | **Fare Revalidation** | Detects supplier price adjustments (₹6,249 → ₹6,449) and prompts customer acceptance before booking. |
| **Task 4** | **Booking Record (`TXG-XXXXXX`)** | Generates unique booking references, storing flight, traveller, and financial records in database. |
| **Task 5** | **Booking State Flow & Auto-Refund** | `PAYMENT_PENDING` → `PAYMENT_SUCCESS` → `BOOKING_CONFIRMED` (`ISSUED`). Auto-refunds if supplier inventory closes post-payment. |
| **Task 6** | **Supplier Timeout & Reconciliation** | Moves to `SUPPLIER_UNKNOWN` on timeout instead of failing. Resolves safely without duplicate PNRs. |
| **Task 7** | **Cancellation & Refund Quote** | Itemized quote (airline fee + admin fee → net refund) and state flow: `CANCELLED` → `REFUNDED`. |
| **Task 8** | **Supplier Gateway Architecture** | Decoupled adapter interface (`ISupplierAdapter`). New suppliers onboard with zero core changes. |
| **Task 9** | **Multi-Supplier Deduplication** | Identifies duplicate flights and scores offers using adjustable weights (Price, Margin, SLA, Baggage). |
| **Task 10**| **Interactive Web Application** | Complete customer journey UI, Light/Dark theme toggle, and live Supplier Gateway Console. |

---

## 🌐 Key API Endpoints

### Flight Inventory & Pricing
* `POST /api/flights/search` — Search flights across suppliers with canonical normalization.
* `POST /api/flights/revalidate` — Revalidate real-time supplier fare and lock price.

### Booking Lifecycle
* `POST /api/bookings` — Create booking with passenger details and payment authorization.
* `GET /api/bookings/:reference` — Fetch booking state, e-ticket, and audit logs.
* `GET /api/bookings` — List all customer bookings.
* `POST /api/bookings/:reference/reconcile` — Safely resolve `SUPPLIER_UNKNOWN` bookings.

### Cancellation & Refunds
* `GET /api/bookings/:reference/cancel-quote` — Get itemized cancellation fee and net refund amount.
* `POST /api/bookings/:reference/cancel` — Execute cancellation and trigger automated refund.

### Supplier Gateway & Deduplication Console
* `GET /api/suppliers` — List active registered suppliers, health status, and live latencies.
* `GET /api/suppliers/inspect-raw` — Side-by-side inspection: Raw TBO vs Raw TripJack vs Canonical Model.
* `POST /api/suppliers/test-scoring` — Interactive Task 9 deduplication scoring playground.

---

## 💻 Tech Stack

* **Backend**: Node.js, Express.js
* **Database**: MySQL 8.0 (with automatic embedded memory fallback if local MySQL is offline)
* **Frontend**: Vanilla HTML5, CSS3 (Light/Dark themes), JavaScript (ES2024)
* **Testing**: Node.js Native Test Runner (`node --test`)
