/**
 * TIXXGO Travel Platform Frontend Application
 * Implements Task 10: Complete Customer Journey & Real-time Integration
 */

class TixxgoApp {
  constructor() {
    this.apiBase = '/api';
    this.currentStep = 1;
    this.searchResults = [];
    this.selectedFlight = null;
    this.revalidationData = null;
    this.currentBooking = null;
    this.allBookings = [];
    this.isMultiSupplierEnabled = true;

    // Simulation states
    this.simulationFlags = {
      priceChangeActive: true,
      simulateTimeoutNext: false,
      simulateFailureNext: false
    };

    this.init();
  }

  async init() {
    console.log('[TixxgoApp] Initializing travel platform client...');
    this.bindEvents();
    await this.fetchSimulationFlags();
    await this.loadBookings();

    // Trigger initial search for AMD -> DEL, 2026-10-15 automatically for instant visual experience!
    this.handleSearch();
  }

  bindEvents() {
    // Navigation tabs
    window.addEventListener('popstate', () => {});
  }

  async fetchSimulationFlags() {
    try {
      const res = await fetch(`${this.apiBase}/flights/simulation-flags`);
      const data = await res.json();
      if (data.flags) {
        this.simulationFlags = data.flags;
        const pCheck = document.getElementById('simPriceChange');
        if (pCheck) pCheck.checked = Boolean(this.simulationFlags.priceChangeActive);
        const tCheck = document.getElementById('simTimeout');
        if (tCheck) tCheck.checked = Boolean(this.simulationFlags.simulateTimeoutNext);
        const fCheck = document.getElementById('simFailure');
        if (fCheck) fCheck.checked = Boolean(this.simulationFlags.simulateFailureNext);
      }
    } catch (e) {
      console.warn('Could not fetch simulation flags:', e);
    }
  }

  async updateSimulationFlag(flagName, value) {
    this.simulationFlags[flagName] = value;
    try {
      await fetch(`${this.apiBase}/flights/simulation-flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [flagName]: value })
      });
      console.log(`[Simulation] ${flagName} set to ${value}`);
    } catch (e) {
      console.error('Failed to update simulation flag:', e);
    }
  }

  toggleMultiSupplier(enabled) {
    this.isMultiSupplierEnabled = enabled;
    this.handleSearch();
  }

  showTab(tabName) {
    ['search', 'bookings', 'architecture'].forEach(t => {
      const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const btn = document.getElementById(`btnNav${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (el) el.style.display = t === tabName ? 'block' : 'none';
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    const stepContainer = document.getElementById('stepContainer');
    if (stepContainer) {
      stepContainer.style.display = tabName === 'search' ? 'block' : 'none';
    }

    if (tabName === 'bookings') {
      this.loadBookings();
    }
  }

  goToStep(stepNumber) {
    this.currentStep = stepNumber;
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`stepIndicator${i}`);
      if (!el) continue;
      el.classList.remove('active', 'completed');
      if (i === stepNumber) el.classList.add('active');
      else if (i < stepNumber) el.classList.add('completed');
    }

    // Toggle Section Visibilities
    const searchSec = document.getElementById('searchSection');
    const resultsSec = document.getElementById('resultsSection');
    const travellerSec = document.getElementById('travellerSection');
    const paymentSec = document.getElementById('paymentSection');
    const confirmSec = document.getElementById('confirmationSection');

    if (stepNumber === 1) {
      searchSec.style.display = 'block';
      resultsSec.style.display = this.searchResults.length ? 'block' : 'none';
      travellerSec.style.display = 'none';
      paymentSec.style.display = 'none';
      confirmSec.style.display = 'none';
    } else if (stepNumber === 3) {
      searchSec.style.display = 'none';
      resultsSec.style.display = 'none';
      travellerSec.style.display = 'block';
      paymentSec.style.display = 'none';
      confirmSec.style.display = 'none';
    } else if (stepNumber === 4) {
      searchSec.style.display = 'none';
      resultsSec.style.display = 'none';
      travellerSec.style.display = 'none';
      paymentSec.style.display = 'block';
      confirmSec.style.display = 'none';
    } else if (stepNumber === 5) {
      searchSec.style.display = 'none';
      resultsSec.style.display = 'none';
      travellerSec.style.display = 'none';
      paymentSec.style.display = 'none';
      confirmSec.style.display = 'block';
    }
  }

  resetToSearch() {
    this.showTab('search');
    this.goToStep(1);
  }

  /**
   * Task 1: Search Flights
   */
  async handleSearch() {
    const btn = document.getElementById('btnSearchSubmit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Searching...</span>';
    }

    const origin = document.getElementById('inputOrigin').value.trim().toUpperCase() || 'AMD';
    const destination = document.getElementById('inputDestination').value.trim().toUpperCase() || 'DEL';
    const departureDate = document.getElementById('inputDepartureDate').value || '2026-10-15';
    const adults = parseInt(document.getElementById('inputAdults').value, 10) || 1;
    const cabinClass = document.getElementById('inputCabin').value || 'ECONOMY';

    try {
      const response = await fetch(`${this.apiBase}/flights/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          departureDate,
          adults,
          cabinClass,
          enableMultiSupplier: this.isMultiSupplierEnabled
        })
      });

      const res = await response.json();
      if (res.success) {
        this.searchResults = res.data;
        this.renderFlightResults(res.data, res.meta);
      } else {
        alert('Flight search failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Search error:', err);
      alert('Network error connecting to Tixxgo backend.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Find Flights</span>';
      }
    }
  }

  /**
   * Render Normalized Flight Results
   */
  renderFlightResults(flights, meta) {
    const resultsSec = document.getElementById('resultsSection');
    const countEl = document.getElementById('resultsCount');
    const suppliersText = document.getElementById('suppliersQueriedText');
    const container = document.getElementById('flightListContainer');

    resultsSec.style.display = 'block';
    countEl.textContent = `${flights.length} Available Flights`;
    suppliersText.textContent = `Queried Suppliers: ${meta.suppliersQueried.join(', ')}`;
    container.innerHTML = '';

    flights.forEach(f => {
      const depTime = new Date(f.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const arrTime = new Date(f.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const custPrice = f.pricing.customerPrice;

      const card = document.createElement('div');
      card.className = 'flight-card';

      let multiSupplierHtml = '';
      if (f.isDuplicateResolved) {
        const alt = f.alternateSupplierOffers[0];
        multiSupplierHtml = `
          <div class="multisupplier-banner">
            <div>
              <strong style="color: #38bdf8;">⚡ Multi-Supplier Intelligent Choice:</strong>
              ${f.selectionReason}
            </div>
            <div style="font-size: 0.75rem; color: #a5b4fc;">
              Alternative: ${alt.supplierCode} offer at INR ${alt.customerPrice.totalAmount}
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <!-- Airline Info -->
        <div class="airline-badge">
          <div class="airline-logo-box">${f.airline.code}</div>
          <div class="airline-info">
            <h4>${f.airline.name}</h4>
            <div class="airline-meta">${f.flightNumber} • ${f.cabinClass}</div>
            <div class="features-pills">
              <span class="feature-pill ${f.isRefundable ? 'green' : ''}">
                ${f.isRefundable ? '✓ Refundable' : '✕ Non-refundable'}
              </span>
              <span class="feature-pill">🧳 ${f.baggage.checkIn}</span>
            </div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="route-timeline">
          <div class="time-box">
            <h3>${depTime}</h3>
            <span>${f.origin.code} (${f.origin.city})</span>
          </div>
          <div class="flight-duration">
            <span class="duration-text">${f.duration} (Non-stop)</span>
            <div class="duration-line"></div>
            <span class="duration-text" style="color: #38bdf8; font-size: 0.7rem;">Verified Inventory</span>
          </div>
          <div class="time-box" style="text-align: right;">
            <h3>${arrTime}</h3>
            <span>${f.destination.code} (${f.destination.city})</span>
          </div>
        </div>

        <!-- Price & Action -->
        <div class="price-booking-box">
          <div class="final-price">₹${custPrice.totalAmount.toLocaleString()}</div>
          <div class="price-subtext" onclick="app.showPricePopover('${f.id}')" title="Click to view pricing engine breakdown">
            Includes Taxes & Fees ▼
          </div>
          <button class="btn-select" onclick="app.selectFlightForRevalidation('${f.id}')">
            Select Flight →
          </button>
        </div>

        ${multiSupplierHtml}
      `;

      container.appendChild(card);
    });
  }

  showPricePopover(flightId) {
    const flight = this.searchResults.find(f => f.id === flightId);
    if (!flight) return;
    const cp = flight.pricing.customerPrice;
    const tf = flight.pricing.tixxgoFees;

    alert(
      `--- TIXXGO PRICING ENGINE BREAKDOWN (Task 2) ---\n` +
      `Supplier Base Fare: INR ${cp.baseFare}\n` +
      `Airline Taxes: INR ${cp.taxes}\n` +
      `Tixxgo Platform Service Fee: +INR ${cp.serviceFee}\n` +
      `Promotion Discount Applied: -INR ${cp.discount}\n` +
      `-----------------------------------------\n` +
      `Customer Total Amount: INR ${cp.totalAmount} ${cp.currency}\n\n` +
      `(Supplier Settlement Cost: INR ${cp.baseFare + cp.taxes} | Platform Net Margin: INR ${tf.netRevenue})`
    );
  }

  /**
   * Task 3: Fare Revalidation
   */
  async selectFlightForRevalidation(flightId) {
    const flight = this.searchResults.find(f => f.id === flightId);
    if (!flight) return;
    this.selectedFlight = flight;

    console.log(`[Revalidation] Revalidating flight ${flight.flightNumber} with supplier ${flight.supplierCode}...`);

    try {
      const response = await fetch(`${this.apiBase}/flights/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierCode: flight.supplierCode,
          supplierResultId: flight.supplierResultId,
          originalCustomerTotal: flight.pricing.customerPrice.totalAmount,
          adults: 1
        })
      });

      const revalData = await response.json();
      this.revalidationData = revalData;

      if (revalData.requiresCustomerAcceptance && revalData.status === 'PRICE_CHANGED') {
        // Task 3: Show Fare Revalidation Modal
        this.openRevalidationModal(revalData);
      } else {
        // Price unchanged: Proceed directly to travellers step
        this.proceedToTravellers();
      }
    } catch (err) {
      console.error('Revalidation error:', err);
      alert('Error during fare revalidation.');
    }
  }

  openRevalidationModal(data) {
    document.getElementById('modalOriginalPrice').textContent = `INR ${data.priceComparison.originalTotal.toLocaleString()}`;
    document.getElementById('modalNewPrice').textContent = `INR ${data.priceComparison.revalidatedTotal.toLocaleString()}`;
    document.getElementById('modalDifferenceNote').textContent =
      `Price difference: +INR ${data.priceComparison.priceDifference}. Updated seat bucket verified by ${this.selectedFlight.supplierCode}. This price is held for 15 minutes.`;
    document.getElementById('modalRevalidation').style.display = 'flex';
  }

  closeRevalidationModal(accepted) {
    document.getElementById('modalRevalidation').style.display = 'none';
    if (!accepted) {
      this.goToStep(1);
    }
  }

  acceptRevalidatedFare() {
    this.closeRevalidationModal(true);
    // Update selected flight customer price with revalidated amount!
    if (this.revalidationData && this.revalidationData.breakdown) {
      this.selectedFlight.pricing.customerPrice = this.revalidationData.breakdown;
    }
    this.proceedToTravellers();
  }

  proceedToTravellers() {
    this.goToStep(3);
    const summary = document.getElementById('travellerFlightSummary');
    const f = this.selectedFlight;
    summary.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #fff; font-size: 1.1rem;">${f.airline.name} (${f.flightNumber})</strong>
          <div style="color: var(--text-muted); font-size: 0.85rem;">
            ${f.origin.code} (${f.origin.city}) → ${f.destination.code} (${f.destination.city}) • Departure: ${new Date(f.departureTime).toLocaleDateString()} ${new Date(f.departureTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan);">₹${f.pricing.customerPrice.totalAmount.toLocaleString()}</div>
          <div style="font-size: 0.75rem; color: #10b981;">✓ Fare Locked</div>
        </div>
      </div>
    `;
  }

  handleTravellerSubmit() {
    this.travellers = [
      {
        title: document.getElementById('travellerTitle').value,
        firstName: document.getElementById('travellerFirstName').value.trim(),
        lastName: document.getElementById('travellerLastName').value.trim(),
        email: document.getElementById('travellerEmail').value.trim(),
        phone: document.getElementById('travellerPhone').value.trim()
      }
    ];

    this.renderPaymentBreakdown();
    this.goToStep(4);
  }

  renderPaymentBreakdown() {
    const cp = this.selectedFlight.pricing.customerPrice;
    const container = document.getElementById('paymentPricingBreakdown');
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
        <span style="color: var(--text-secondary);">Supplier Base Fare</span>
        <span>₹${cp.baseFare.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
        <span style="color: var(--text-secondary);">Airline Taxes & Surcharges</span>
        <span>₹${cp.taxes.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
        <span style="color: var(--text-secondary);">Tixxgo Platform Service Fee</span>
        <span>₹${cp.serviceFee.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.85rem; color: #34d399;">
        <span>Tixxgo Promotional Discount</span>
        <span>- ₹${cp.discount.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px dashed var(--border-color); font-weight: 800; font-size: 1.15rem;">
        <span>Total Payable</span>
        <span style="color: var(--accent-cyan);">₹${cp.totalAmount.toLocaleString()}</span>
      </div>
    `;
  }

  /**
   * Task 4, 5, 6: Execute Payment and Supplier Booking
   */
  async executePaymentAndBooking() {
    const btn = document.getElementById('btnExecutePayment');
    btn.disabled = true;
    btn.innerHTML = '<span>Processing Payment & Contacting Supplier...</span>';

    const idempotencyKey = `TXG_IDEM_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const payload = {
        flightDetails: {
          flightNumber: this.selectedFlight.flightNumber,
          airline: this.selectedFlight.airline,
          origin: this.selectedFlight.origin,
          destination: this.selectedFlight.destination,
          departureTime: this.selectedFlight.departureTime,
          arrivalTime: this.selectedFlight.arrivalTime,
          baggage: this.selectedFlight.baggage
        },
        supplierResultId: this.selectedFlight.supplierResultId,
        supplierCode: this.selectedFlight.supplierCode,
        travellers: this.travellers,
        customerPrice: this.selectedFlight.pricing.customerPrice,
        idempotencyKey,
        simulationOptions: {
          forceSupplierTimeout: this.simulationFlags.simulateTimeoutNext,
          forceSupplierFailure: this.simulationFlags.simulateFailureNext
        }
      };

      const response = await fetch(`${this.apiBase}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      this.currentBooking = result.booking || result;
      this.renderBookingOutcome(result, response.status);
      this.goToStep(5);
      await this.loadBookings();
    } catch (err) {
      console.error('Booking execution error:', err);
      alert('Error communicating with booking orchestrator.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Authorize & Book Now</span>';
    }
  }

  /**
   * Render Booking Result (Covers Task 4 Confirmed, Task 5 Failed/Refunded, Task 6 Timeout/Unknown)
   */
  renderBookingOutcome(result, httpStatus) {
    const container = document.getElementById('confirmationSection');
    const isSuccess = result.success && result.status === 'BOOKING_CONFIRMED';
    const isUnknown = result.status === 'SUPPLIER_UNKNOWN';
    const isFailedRefunded = result.status === 'SUPPLIER_BOOKING_FAILED';

    let headerBadge = '';
    let mainIcon = '🎉';
    let title = 'Booking Confirmed!';
    let description = 'Your e-ticket has been successfully issued by the airline.';

    if (isSuccess) {
      headerBadge = '<span class="status-badge CONFIRMED">BOOKING_CONFIRMED</span>';
    } else if (isUnknown) {
      mainIcon = '⏳';
      title = 'Supplier Request In Progress';
      headerBadge = '<span class="status-badge UNKNOWN">SUPPLIER_UNKNOWN (Task 6)</span>';
      description = result.message || 'Payment was captured, but the supplier connection timed out. Placing order in reconciliation queue to prevent duplicate PNR creation.';
    } else if (isFailedRefunded) {
      mainIcon = '⚠️';
      title = 'Inventory Unavailable - Refund Initiated';
      headerBadge = '<span class="status-badge REFUNDED">AUTO_REFUNDED (Task 5)</span>';
      description = result.message || 'The airline was unable to confirm your seat. Your payment has been automatically refunded to your original payment method.';
    }

    const ref = result.bookingReference || (result.booking && result.booking.bookingReference) || 'TXG-PENDING';
    const pnr = result.pnr || (result.booking && result.booking.pnr) || 'PENDING';
    const flight = this.selectedFlight;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="font-size: 2.5rem;">${mainIcon}</div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h2 style="font-size: 1.4rem; font-weight: 800;">${title}</h2>
              ${headerBadge}
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 4px;">${description}</p>
          </div>
        </div>
        <button class="btn-secondary" onclick="app.resetToSearch()">Book Another Flight</button>
      </div>

      <!-- Booking Identifiers Card (Task 4) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; background: rgba(255,255,255,0.02); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Tixxgo Booking Reference</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: var(--accent-cyan); font-family: monospace;">${ref}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Airline PNR</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #fff; font-family: monospace;">${pnr}</div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Payment Status</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: ${isFailedRefunded ? '#818cf8' : '#34d399'};">
            ${result.paymentStatus || (result.booking && result.booking.paymentStatus)}
          </div>
        </div>
        <div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Supplier Assigned</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">${flight.supplierCode} (${flight.supplierResultId})</div>
        </div>
      </div>

      <!-- Actions & Diagnostics -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 1.5rem;">
        ${
          isUnknown
            ? `<button class="btn-primary" onclick="app.reconcileUnknownBooking('${ref}')">
                <span>🔄 Safe Reconciliation Check (Task 6)</span>
              </button>`
            : ''
        }
        ${
          isSuccess
            ? `<button class="btn-secondary" style="border-color: rgba(244,63,94,0.4); color: #fda4af;" onclick="app.requestCancellationQuote('${ref}')">
                <span>Request Booking Cancellation (Task 7)</span>
              </button>`
            : ''
        }
        <button class="btn-secondary" onclick="app.inspectAuditTrail('${ref}')">
          <span>📜 View Event Audit Logs</span>
        </button>
      </div>

      <div id="liveAuditLogBox" style="display: none; background: rgba(0,0,0,0.4); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
        <h4 style="font-size: 0.9rem; color: var(--accent-cyan); margin-bottom: 0.5rem;">State Transition History (Audit Trail):</h4>
        <div id="auditLogContent"></div>
      </div>
    `;
  }

  /**
   * Task 6: Safe Reconciliation Handler
   */
  async reconcileUnknownBooking(reference) {
    try {
      const res = await fetch(`${this.apiBase}/bookings/${reference}/reconcile`, { method: 'POST' });
      const data = await res.json();
      alert(`Reconciliation Result: ${data.result?.status}\n${data.result?.message || 'Supplier confirmed PNR issued without duplicate booking.'}`);
      
      // Refresh current booking view
      const freshBookingRes = await fetch(`${this.apiBase}/bookings/${reference}`);
      const freshData = await freshBookingRes.json();
      this.renderBookingOutcome(freshData.data, 200);
      this.loadBookings();
    } catch (e) {
      console.error(e);
      alert('Error reconciling booking: ' + e.message);
    }
  }

  /**
   * Task 7: Step 1 - Request Cancellation Quote
   */
  async requestCancellationQuote(reference) {
    try {
      const res = await fetch(`${this.apiBase}/bookings/${reference}/cancel-quote`);
      const data = await res.json();

      if (!data.success) {
        alert('Could not get cancellation quote: ' + data.error);
        return;
      }

      const q = data.data;
      const body = document.getElementById('cancellationQuoteBody');
      body.innerHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
            Booking: <strong>${q.bookingReference}</strong> (PNR: ${q.pnr})
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem;">
            <span>Original Customer Price Paid:</span>
            <span>₹${q.totalPaid.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem; font-size: 0.85rem; color: #f43f5e;">
            <span>Airline / Supplier Penalty:</span>
            <span>- ₹${q.breakdown.airlineCancellationPenalty.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem; font-size: 0.85rem; color: #f43f5e;">
            <span>Tixxgo Administrative Processing Fee:</span>
            <span>- ₹${q.breakdown.tixxgoCancellationFee.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 0.6rem; border-top: 1px solid var(--border-color); font-weight: 800; font-size: 1.1rem; color: #34d399;">
            <span>Estimated Refund to Customer:</span>
            <span>₹${q.breakdown.estimatedRefund.toLocaleString()}</span>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          Lifecycle state tracker: <code>CANCELLATION_REQUESTED → CANCELLED → REFUND_PENDING → REFUNDED</code>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick="app.closeCancellationModal()">Keep Booking</button>
          <button class="btn-primary" style="background: #e11d48;" onclick="app.confirmCancellation('${reference}')">
            Confirm & Cancel Ticket
          </button>
        </div>
      `;

      document.getElementById('modalCancellation').style.display = 'flex';
    } catch (e) {
      alert('Error fetching quote: ' + e.message);
    }
  }

  closeCancellationModal() {
    document.getElementById('modalCancellation').style.display = 'none';
  }

  /**
   * Task 7: Step 2 - Execute Cancellation
   */
  async confirmCancellation(reference) {
    try {
      const res = await fetch(`${this.apiBase}/bookings/${reference}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Customer requested cancellation from UI' })
      });
      const data = await res.json();
      this.closeCancellationModal();
      alert(`Booking ${reference} successfully cancelled! Refund of INR ${data.cancellationRecord.refundAmount} initiated.`);
      
      const freshRes = await fetch(`${this.apiBase}/bookings/${reference}`);
      const freshData = await freshRes.json();
      this.renderBookingOutcome(freshData.data, 200);
      this.loadBookings();
    } catch (e) {
      alert('Failed to cancel: ' + e.message);
    }
  }

  async inspectAuditTrail(reference) {
    const box = document.getElementById('liveAuditLogBox');
    const content = document.getElementById('auditLogContent');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';

    if (box.style.display === 'block') {
      try {
        const res = await fetch(`${this.apiBase}/bookings/${reference}`);
        const data = await res.json();
        const logs = data.data.auditLogs || [];

        content.innerHTML = logs
          .map(
            l => `
            <div class="audit-item">
              <div style="display:flex; justify-content:space-between;">
                <strong>${l.action}</strong>
                <span class="audit-time">${new Date(l.createdAt).toLocaleTimeString()}</span>
              </div>
              <div style="color: var(--text-secondary); margin-top:2px;">
                State: ${l.previousStatus || 'NONE'} → <strong>${l.newStatus}</strong>
              </div>
              ${l.reason ? `<div style="color: var(--text-muted); font-size:0.75rem;">Reason: ${l.reason}</div>` : ''}
            </div>
          `
          )
          .join('');
      } catch (e) {
        content.textContent = 'Could not load audit logs.';
      }
    }
  }

  async loadBookings() {
    try {
      const res = await fetch(`${this.apiBase}/bookings`);
      const data = await res.json();
      this.allBookings = data.data || [];
      const badge = document.getElementById('bookingCountBadge');
      if (badge) badge.textContent = this.allBookings.length;

      const container = document.getElementById('bookingHistoryTableContainer');
      if (!container) return;

      if (!this.allBookings.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">No bookings created yet. Perform a search to create your first booking!</p>';
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
              <th style="padding: 10px;">Reference</th>
              <th style="padding: 10px;">Flight</th>
              <th style="padding: 10px;">Customer Total</th>
              <th style="padding: 10px;">Supplier</th>
              <th style="padding: 10px;">Status</th>
              <th style="padding: 10px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.allBookings
              .map(
                b => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px; font-weight:700; font-family:monospace; color:var(--accent-cyan);">${b.bookingReference}</td>
                <td style="padding: 12px;">${b.flightDetails?.flightNumber || 'AI482'} (${b.flightDetails?.origin?.code || 'AMD'} → ${b.flightDetails?.destination?.code || 'DEL'})</td>
                <td style="padding: 12px; font-weight:700;">₹${b.customerPrice?.totalAmount?.toLocaleString()}</td>
                <td style="padding: 12px;">${b.supplierCode}</td>
                <td style="padding: 12px;">
                  <span class="status-badge ${b.bookingStatus === 'BOOKING_CONFIRMED' ? 'CONFIRMED' : b.bookingStatus === 'SUPPLIER_UNKNOWN' ? 'UNKNOWN' : b.bookingStatus === 'CANCELLED' ? 'REFUNDED' : 'FAILED'}">
                    ${b.bookingStatus}
                  </span>
                </td>
                <td style="padding: 12px;">
                  <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="app.viewBookingDetails('${b.bookingReference}')">
                    Inspect Details
                  </button>
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      console.warn('Failed to load bookings list:', e);
    }
  }

  async viewBookingDetails(reference) {
    try {
      const res = await fetch(`${this.apiBase}/bookings/${reference}`);
      const data = await res.json();
      this.selectedFlight = {
        flightNumber: data.data.flightDetails.flightNumber,
        airline: data.data.flightDetails.airline || { name: 'Air India', code: 'AI' },
        origin: data.data.flightDetails.origin || { code: 'AMD', city: 'Ahmedabad' },
        destination: data.data.flightDetails.destination || { code: 'DEL', city: 'Delhi' },
        supplierCode: data.data.supplierCode,
        supplierResultId: data.data.supplierResultId,
        pricing: { customerPrice: data.data.customerPrice }
      };
      this.showTab('search');
      this.goToStep(5);
      this.renderBookingOutcome(data.data, 200);
    } catch (e) {
      alert('Could not view booking: ' + e.message);
    }
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TixxgoApp();
});
