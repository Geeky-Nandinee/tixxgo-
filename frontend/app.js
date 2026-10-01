/**
 * TIXXGO Travel Platform Frontend Application
 * Implements Task 10: Complete Customer Journey & Real-time Integration
 */

const POPULAR_AIRPORTS = [
  { code: 'AMD', city: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel Intl', country: 'India' },
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi Intl', country: 'India' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj Intl', country: 'India' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda Intl', country: 'India' },
  { code: 'GOA', city: 'Goa', name: 'Dabolim / Manohar Intl', country: 'India' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi Intl', country: 'India' },
  { code: 'CCU', city: 'Kolkata', name: 'Netaji Subhash Chandra Bose Intl', country: 'India' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai Intl', country: 'India' },
  { code: 'PNQ', city: 'Pune', name: 'Pune Airport', country: 'India' },
  { code: 'JAI', city: 'Jaipur', name: 'Jaipur Intl', country: 'India' },
  { code: 'COK', city: 'Kochi', name: 'Cochin Intl', country: 'India' },
  { code: 'LKO', city: 'Lucknow', name: 'Chaudhary Charan Singh Intl', country: 'India' },
  { code: 'SXR', city: 'Srinagar', name: 'Sheikh ul-Alam Intl', country: 'India' },
  { code: 'IXC', city: 'Chandigarh', name: 'Shaheed Bhagat Singh Intl', country: 'India' },
  { code: 'VNS', city: 'Varanasi', name: 'Lal Bahadur Shastri Intl', country: 'India' },
  { code: 'ATQ', city: 'Amritsar', name: 'Sri Guru Ram Dass Jee Intl', country: 'India' },
  { code: 'GAU', city: 'Guwahati', name: 'Lokpriya Gopinath Bordoloi Intl', country: 'India' },
  { code: 'PAT', city: 'Patna', name: 'Jay Prakash Narayan Airport', country: 'India' },
  { code: 'IDR', city: 'Indore', name: 'Devi Ahilya Bai Holkar Airport', country: 'India' },
  { code: 'STV', city: 'Surat', name: 'Surat Intl Airport', country: 'India' },
  { code: 'BDQ', city: 'Vadodara', name: 'Vadodara Airport', country: 'India' },
  { code: 'UDR', city: 'Udaipur', name: 'Maharana Pratap Airport', country: 'India' },
  { code: 'DED', city: 'Dehradun', name: 'Jolly Grant Airport', country: 'India' },
  { code: 'DXB', city: 'Dubai', name: 'Dubai Intl Airport', country: 'UAE' },
  { code: 'SIN', city: 'Singapore', name: 'Changi Airport', country: 'Singapore' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi Airport', country: 'Thailand' },
  { code: 'LHR', city: 'London', name: 'Heathrow Airport', country: 'United Kingdom' },
  { code: 'DOH', city: 'Doha', name: 'Hamad Intl Airport', country: 'Qatar' }
];

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
    this.activeFlightFilter = 'all';
    this.lastSearchMeta = { suppliersQueried: ['TBO', 'TripJack'] };

    // Simulation states
    this.simulationFlags = {
      priceChangeActive: true,
      simulateTimeoutNext: false,
      simulateFailureNext: false
    };

    // Theme Management (Light / Dark)
    this.theme = localStorage.getItem('tixxgo-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    this.applyTheme(this.theme);

    this.init();
  }

  toggleTheme() {
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('tixxgo-theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
    if (label) label.textContent = theme === 'light' ? 'Light' : 'Dark';
  }

  async init() {
    console.log('[TixxgoApp] Initializing travel platform client...');
    this.applyTheme(this.theme);
    this.bindEvents();
    this.initAirportDropdowns();
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

    if (tabName === 'architecture') {
      this.loadSupplierConsole();
      this.inspectRawNormalization();
      this.recalculateScoring();
    }
  }

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    // Update dynamic progress bar fill
    const progressFill = document.getElementById('stepProgressFill');
    if (progressFill) {
      const stepFractions = { 1: 0, 2: 0.25, 3: 0.50, 4: 0.75, 5: 1 };
      const fraction = stepFractions[stepNumber] !== undefined ? stepFractions[stepNumber] : 0;
      progressFill.style.width = fraction === 0 ? '0px' : `calc((100% - 40px) * ${fraction})`;
    }

    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(`stepIndicator${i}`);
      if (!el) continue;
      const circle = el.querySelector('.step-circle');
      el.classList.remove('active', 'completed');
      if (i === stepNumber) {
        el.classList.add('active');
        if (circle) circle.innerHTML = `${i}`;
      } else if (i < stepNumber) {
        el.classList.add('completed');
        if (circle) circle.innerHTML = `✓`;
      } else {
        if (circle) circle.innerHTML = `${i}`;
      }
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
   * Searchable Airport Dropdowns & Autocomplete
   */
  initAirportDropdowns() {
    this.setupAirportDropdown({
      textInputId: 'inputOriginText',
      hiddenInputId: 'inputOrigin',
      dropdownId: 'dropdownOrigin'
    });

    this.setupAirportDropdown({
      textInputId: 'inputDestText',
      hiddenInputId: 'inputDestination',
      dropdownId: 'dropdownDestination'
    });

    // Close any open dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.airport-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('is-open'));
      }
    });
  }

  setupAirportDropdown({ textInputId, hiddenInputId, dropdownId }) {
    const textInput = document.getElementById(textInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    const dropdown = document.getElementById(dropdownId);
    const wrapper = textInput ? textInput.closest('.custom-select-wrapper') : null;
    if (!textInput || !dropdown) return;

    let activeIndex = -1;

    const openDropdown = () => {
      document.querySelectorAll('.airport-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
      });
      document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w !== wrapper) w.classList.remove('is-open');
      });
      dropdown.classList.add('show');
      if (wrapper) wrapper.classList.add('is-open');
    };

    const closeDropdown = () => {
      dropdown.classList.remove('show');
      if (wrapper) wrapper.classList.remove('is-open');
    };

    const renderList = (filterText = '') => {
      const q = filterText.trim().toLowerCase();
      const filtered = POPULAR_AIRPORTS.filter(a => {
        if (!q) return true;
        return a.code.toLowerCase().includes(q) ||
               a.city.toLowerCase().includes(q) ||
               a.name.toLowerCase().includes(q) ||
               a.country.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="airport-empty-notice">No airports matching "${filterText}"</div>`;
        return;
      }

      dropdown.innerHTML = filtered.map((a, idx) => `
        <div class="airport-item ${idx === activeIndex ? 'active' : ''}" data-code="${a.code}" data-label="${a.city} (${a.code})">
          <div class="airport-info-left">
            <span class="airport-city">${a.city}</span>
            <span class="airport-name">${a.name} · ${a.country}</span>
          </div>
          <span class="airport-code-badge">${a.code}</span>
        </div>
      `).join('');

      dropdown.querySelectorAll('.airport-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const code = item.getAttribute('data-code');
          const label = item.getAttribute('data-label');
          textInput.value = label;
          if (hiddenInput) hiddenInput.value = code;
          closeDropdown();
          this.handleSearch();
        });
      });
    };

    textInput.addEventListener('focus', () => {
      activeIndex = -1;
      renderList('');
      openDropdown();
      textInput.select();
    });

    textInput.addEventListener('click', () => {
      openDropdown();
    });

    textInput.addEventListener('input', () => {
      openDropdown();
      activeIndex = -1;
      renderList(textInput.value);
    });

    textInput.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.airport-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          const code = items[activeIndex].getAttribute('data-code');
          const label = items[activeIndex].getAttribute('data-label');
          textInput.value = label;
          if (hiddenInput) hiddenInput.value = code;
        } else if (items.length > 0) {
          const code = items[0].getAttribute('data-code');
          const label = items[0].getAttribute('data-label');
          textInput.value = label;
          if (hiddenInput) hiddenInput.value = code;
        }
        closeDropdown();
        this.handleSearch();
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    textInput.addEventListener('blur', () => {
      setTimeout(() => {
        closeDropdown();
        const raw = textInput.value.trim();
        if (!raw) return;

        const parenMatch = raw.match(/\(([A-Za-z]{3})\)/);
        if (parenMatch) {
          if (hiddenInput) hiddenInput.value = parenMatch[1].toUpperCase();
          return;
        }

        const directCodeMatch = POPULAR_AIRPORTS.find(a => a.code.toUpperCase() === raw.toUpperCase());
        if (directCodeMatch) {
          if (hiddenInput) hiddenInput.value = directCodeMatch.code;
          textInput.value = `${directCodeMatch.city} (${directCodeMatch.code})`;
          return;
        }

        const cityMatch = POPULAR_AIRPORTS.find(a => a.city.toLowerCase() === raw.toLowerCase());
        if (cityMatch) {
          if (hiddenInput) hiddenInput.value = cityMatch.code;
          textInput.value = `${cityMatch.city} (${cityMatch.code})`;
          return;
        }

        if (raw.length === 3) {
          if (hiddenInput) hiddenInput.value = raw.toUpperCase();
        }
      }, 200);
    });
  }

  swapAirports() {
    const origTextEl = document.getElementById('inputOriginText');
    const origCodeEl = document.getElementById('inputOrigin');
    const destTextEl = document.getElementById('inputDestText');
    const destCodeEl = document.getElementById('inputDestination');

    if (!origTextEl || !destTextEl) return;

    const tempText = origTextEl.value;
    const tempCode = origCodeEl ? origCodeEl.value : 'AMD';

    origTextEl.value = destTextEl.value;
    if (origCodeEl && destCodeEl) origCodeEl.value = destCodeEl.value;

    destTextEl.value = tempText;
    if (destCodeEl) destCodeEl.value = tempCode;

    this.handleSearch();
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

    let origin = (document.getElementById('inputOrigin')?.value || '').trim().toUpperCase();
    let destination = (document.getElementById('inputDestination')?.value || '').trim().toUpperCase();

    // Fallbacks if hidden inputs are missing or not 3 chars
    if (!origin || origin.length !== 3) {
      const origText = (document.getElementById('inputOriginText')?.value || '').trim();
      const m = origText.match(/\(([A-Z]{3})\)/i) || origText.match(/\b([A-Z]{3})\b/i);
      origin = m ? m[1].toUpperCase() : (origText.slice(0, 3).toUpperCase() || 'AMD');
      if (document.getElementById('inputOrigin')) document.getElementById('inputOrigin').value = origin;
    }

    if (!destination || destination.length !== 3) {
      const destText = (document.getElementById('inputDestText')?.value || '').trim();
      const m = destText.match(/\(([A-Z]{3})\)/i) || destText.match(/\b([A-Z]{3})\b/i);
      destination = m ? m[1].toUpperCase() : (destText.slice(0, 3).toUpperCase() || 'DEL');
      if (document.getElementById('inputDestination')) document.getElementById('inputDestination').value = destination;
    }

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
   * Destination Card Click -> Auto fill & Search
   */
  selectDestination(originCode, destCode, destLabel) {
    const originAirport = POPULAR_AIRPORTS.find(a => a.code === originCode) || { city: originCode, code: originCode };
    const destAirport = POPULAR_AIRPORTS.find(a => a.code === destCode) || { city: destLabel || destCode, code: destCode };

    const origInput = document.getElementById('inputOrigin');
    const origText = document.getElementById('inputOriginText');
    const destInput = document.getElementById('inputDestination');
    const destText = document.getElementById('inputDestText');

    if (origInput) origInput.value = originAirport.code;
    if (origText) origText.value = `${originAirport.city} (${originAirport.code})`;
    if (destInput) destInput.value = destAirport.code;
    if (destText) destText.value = `${destAirport.city} (${destAirport.code})`;

    // Reset filter to all
    this.activeFlightFilter = 'all';
    document.querySelectorAll('.filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === 'all');
    });

    // Smooth scroll to search form
    const searchSection = document.getElementById('searchSection');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    this.handleSearch();
  }

  /**
   * Set Active Flight Filter & Sort
   */
  setFlightFilter(filterType) {
    this.activeFlightFilter = filterType;
    document.querySelectorAll('.filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
    });
    this.renderFilteredFlights();
  }

  /**
   * Toggle Flight Details & Amenities Drawer
   */
  toggleFlightAmenities(flightId) {
    const drawer = document.getElementById(`amenities_${flightId}`);
    const toggleBtn = document.getElementById(`toggleBtn_${flightId}`);
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('is-open');
    if (toggleBtn) {
      toggleBtn.innerHTML = isOpen 
        ? `<span>Flight Details & Amenities ▴</span>` 
        : `<span>Flight Details & Amenities ▾</span>`;
    }
  }

  /**
   * Render Normalized Flight Results
   */
  renderFlightResults(flights, meta) {
    this.lastSearchMeta = meta || this.lastSearchMeta || { suppliersQueried: ['TBO', 'TripJack'] };
    this.searchResults = flights || [];
    this.renderFilteredFlights();
  }

  /**
   * Render Filtered and Sorted Flight Results
   */
  renderFilteredFlights() {
    const resultsSec = document.getElementById('resultsSection');
    const countEl = document.getElementById('resultsCount');
    const suppliersText = document.getElementById('suppliersQueriedText');
    const container = document.getElementById('flightListContainer');

    resultsSec.style.display = 'block';
    if (this.lastSearchMeta && this.lastSearchMeta.suppliersQueried) {
      suppliersText.textContent = `Queried Suppliers: ${this.lastSearchMeta.suppliersQueried.join(', ')}`;
    }

    if (!this.searchResults || !this.searchResults.length) {
      countEl.textContent = '0 Available Flights';
      container.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">No flights found for this route and date. Try selecting another destination above.</div>';
      return;
    }

    let list = [...this.searchResults];

    if (this.activeFlightFilter === 'cheapest') {
      list.sort((a, b) => a.pricing.customerPrice.totalAmount - b.pricing.customerPrice.totalAmount);
    } else if (this.activeFlightFilter === 'fastest') {
      const getMinutes = (d) => {
        const m = (d || '').match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
        if (!m) return 999;
        const h = parseInt(m[1] || '0', 10);
        const mins = parseInt(m[2] || '0', 10);
        return h * 60 + mins;
      };
      list.sort((a, b) => getMinutes(a.duration) - getMinutes(b.duration));
    } else if (this.activeFlightFilter === 'nonstop') {
      list = list.filter(f => !f.stops || f.stops === 0 || (f.duration && !f.duration.includes('stop')));
    } else if (this.activeFlightFilter === 'refundable') {
      list = list.filter(f => Boolean(f.isRefundable));
    } else if (this.activeFlightFilter === 'morning') {
      list = list.filter(f => {
        const h = new Date(f.departureTime).getHours();
        return h >= 6 && h < 12;
      });
    } else if (this.activeFlightFilter === 'evening') {
      list = list.filter(f => {
        const h = new Date(f.departureTime).getHours();
        return h >= 18 && h <= 23;
      });
    }

    countEl.textContent = `${list.length} of ${this.searchResults.length} Available Flights`;
    container.innerHTML = '';

    list.forEach(f => {
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

        <!-- Interactive Amenities & Details Footer -->
        <div class="flight-card-footer">
          <button type="button" class="flight-amenities-toggle" id="toggleBtn_${f.id}" onclick="app.toggleFlightAmenities('${f.id}')">
            <span>Flight Details & Amenities ▾</span>
          </button>
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            Supplier: <strong>${f.supplierCode}</strong>
          </span>
        </div>

        <!-- Expandable Amenities Drawer -->
        <div class="flight-amenities-drawer" id="amenities_${f.id}">
          <div class="amenities-grid">
            <div class="amenity-item">
              <span class="amenity-icon">🧳</span>
              <div>
                <div class="amenity-label">Baggage Allowance</div>
                <div class="amenity-value">${f.baggage?.cabin || '7 kg Cabin'} • ${f.baggage?.checkIn || '15 kg Check-in'}</div>
              </div>
            </div>
            <div class="amenity-item">
              <span class="amenity-icon">🍽️</span>
              <div>
                <div class="amenity-label">In-Flight Dining</div>
                <div class="amenity-value">${f.cabinClass === 'BUSINESS' ? 'Complimentary Gourmet Meal' : 'Pre-book Meals & Snacks'}</div>
              </div>
            </div>
            <div class="amenity-item">
              <span class="amenity-icon">⚡</span>
              <div>
                <div class="amenity-label">Connectivity & Power</div>
                <div class="amenity-value">In-Seat USB & Entertainment</div>
              </div>
            </div>
            <div class="amenity-item">
              <span class="amenity-icon">💺</span>
              <div>
                <div class="amenity-label">Aircraft & Pitch</div>
                <div class="amenity-value">Standard 30" Pitch • A320 / B737</div>
              </div>
            </div>
          </div>

          <div class="fare-rules-box">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span class="fare-rule-badge">🛡️ Cancellation: ${f.isRefundable ? 'Standard fee before 24h' : 'Non-refundable fare'}</span>
              <span class="fare-rule-badge">🔄 Reschedule: Fare difference + ₹1,500</span>
              <span class="fare-rule-badge">⚡ Instant Refund Guarantee</span>
            </div>
            <div>
              <span style="color: var(--accent-cyan); font-weight: 700;">24x7 Tixxgo Priority Support Included</span>
            </div>
          </div>
        </div>
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
          <strong style="color: var(--text-primary); font-size: 1.1rem;">${f.airline.name} (${f.flightNumber})</strong>
          <div style="color: var(--text-muted); font-size: 0.85rem;">
            ${f.origin.code} (${f.origin.city}) → ${f.destination.code} (${f.destination.city}) • Departure: ${new Date(f.departureTime).toLocaleDateString()} ${new Date(f.departureTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan);">₹${f.pricing.customerPrice.totalAmount.toLocaleString()}</div>
          <div style="font-size: 0.75rem; color: var(--accent-emerald);">✓ Fare Locked</div>
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
      <div class="payment-row">
        <span>Supplier Base Fare</span>
        <span>₹${cp.baseFare.toLocaleString()}</span>
      </div>
      <div class="payment-row">
        <span>Airline Taxes & Surcharges</span>
        <span>₹${cp.taxes.toLocaleString()}</span>
      </div>
      <div class="payment-row">
        <span>Tixxgo Platform Service Fee</span>
        <span>₹${cp.serviceFee.toLocaleString()}</span>
      </div>
      <div class="payment-row discount">
        <span>Tixxgo Promotional Discount</span>
        <span>- ₹${cp.discount.toLocaleString()}</span>
      </div>
      <div class="payment-row total">
        <span>Total Payable</span>
        <span class="total-amount">₹${cp.totalAmount.toLocaleString()}</span>
      </div>
    `;
  }

  handlePaymentMethodChange(radio) {
    document.querySelectorAll('.payment-option-label').forEach(lbl => {
      lbl.classList.remove('selected');
    });
    if (radio && radio.closest('.payment-option-label')) {
      radio.closest('.payment-option-label').classList.add('selected');
    }
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

      <!-- Booking Identifiers Card -->
      <div class="booking-identifiers-grid">
        <div>
          <div class="identifier-label">Tixxgo Booking Reference</div>
          <div class="identifier-value mono" style="color: var(--accent-cyan);">${ref}</div>
        </div>
        <div>
          <div class="identifier-label">Airline PNR</div>
          <div class="identifier-value mono">${pnr}</div>
        </div>
        <div>
          <div class="identifier-label">Payment Status</div>
          <div class="identifier-value" style="color: ${isFailedRefunded ? 'var(--accent-indigo)' : 'var(--accent-emerald)'};">
            ${result.paymentStatus || (result.booking && result.booking.paymentStatus)}
          </div>
        </div>
        <div>
          <div class="identifier-label">Supplier Assigned</div>
          <div class="identifier-value" style="font-size: 1.05rem;">${flight.supplierCode} (${flight.supplierResultId})</div>
        </div>
      </div>

      <!-- Actions & Diagnostics -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 1.5rem;">
        ${
          isUnknown
            ? `<button class="btn-primary" onclick="app.reconcileUnknownBooking('${ref}')">
                <span>🔄 Safe Reconciliation Check</span>
              </button>`
            : ''
        }
        ${
          isSuccess
            ? `<button class="btn-secondary btn-cancel-booking" onclick="app.requestCancellationQuote('${ref}')">
                <span>Request Booking Cancellation</span>
              </button>`
            : ''
        }
        <button class="btn-secondary" onclick="app.inspectAuditTrail('${ref}')">
          <span>📜 View Event Audit Logs</span>
        </button>
      </div>

      <div id="liveAuditLogBox" class="audit-box" style="display: none;">
        <h4 class="audit-box-title">
          <span>📜</span> State Transition History (Audit Trail)
        </h4>
        <div id="auditLogContent" class="audit-list"></div>
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
        <div class="summary-banner-box" style="margin-bottom: 1rem;">
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
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: var(--text-primary); font-size: 0.9rem;">${l.action}</strong>
                <span class="audit-time">${new Date(l.createdAt).toLocaleTimeString()}</span>
              </div>
              <div style="color: var(--text-secondary); margin-top: 3px; font-size: 0.82rem;">
                State: ${l.previousStatus || 'NONE'} → <strong style="color: var(--accent-cyan);">${l.newStatus}</strong>
              </div>
              ${l.reason ? `<div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">Reason: ${l.reason}</div>` : ''}
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
        <table class="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Flight</th>
              <th>Customer Total</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.allBookings
              .map(
                b => `
              <tr>
                <td style="font-weight:700; font-family:monospace; color:var(--accent-cyan);">${b.bookingReference}</td>
                <td>${b.flightDetails?.flightNumber || 'AI482'} (${b.flightDetails?.origin?.code || 'AMD'} → ${b.flightDetails?.destination?.code || 'DEL'})</td>
                <td style="font-weight:700;">₹${b.customerPrice?.totalAmount?.toLocaleString()}</td>
                <td>${b.supplierCode}</td>
                <td>
                  <span class="status-badge ${b.bookingStatus === 'BOOKING_CONFIRMED' ? 'CONFIRMED' : b.bookingStatus === 'SUPPLIER_UNKNOWN' ? 'UNKNOWN' : b.bookingStatus === 'CANCELLED' ? 'REFUNDED' : 'FAILED'}">
                    ${b.bookingStatus}
                  </span>
                </td>
                <td>
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

  async loadSupplierConsole() {
    const container = document.getElementById('supplierCardsContainer');
    if (!container) return;

    try {
      const res = await fetch(`${this.apiBase}/suppliers`);
      const data = await res.json();
      const list = data.data || [];
      if (!data.success || !list.length) {
        container.innerHTML = '<p style="color: var(--text-muted);">No suppliers registered.</p>';
        return;
      }

      container.innerHTML = list.map(s => {
        const isHealthy = s.health?.status === 'HEALTHY' || s.status === 'ACTIVE';
        const statusColor = isHealthy ? 'var(--accent-emerald)' : 'var(--accent-rose)';
        const slaPercent = s.metrics?.historicalSuccessRate ? (s.metrics.historicalSuccessRate * 100).toFixed(1) : '98.0';
        const commissionPercent = s.metrics?.commissionRate ? (s.metrics.commissionRate * 100).toFixed(1) : '3.0';

        return `
          <div class="supplier-console-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h4 style="font-size: 1.1rem; font-weight: 700; margin: 0;">${s.name}</h4>
                  <span class="status-badge" style="background: rgba(56, 189, 248, 0.15); color: var(--accent-cyan); font-weight: 700; font-size: 0.72rem;">${s.code}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${s.role.replace(/_/g, ' ')}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 700; color: ${statusColor};">
                <span class="pulse-dot"></span>
                <span>${s.health?.status || 'ONLINE'} (${s.health?.latencyMs || 45}ms)</span>
              </div>
            </div>

            <table class="supplier-metrics-table">
              <tbody>
                <tr>
                  <td>Historical SLA</td>
                  <td style="color: var(--accent-emerald); font-weight: 700;">${slaPercent}%</td>
                </tr>
                <tr>
                  <td>Negotiated Commission</td>
                  <td style="color: var(--accent-indigo); font-weight: 700;">${commissionPercent}%</td>
                </tr>
                <tr>
                  <td>Uptime Guarantee</td>
                  <td style="font-weight: 600;">${s.health?.uptime || '99.98%'}</td>
                </tr>
                <tr>
                  <td>Avg Response Latency</td>
                  <td style="color: var(--accent-amber); font-weight: 700;">${s.metrics?.avgResponseTimeMs || 220}ms</td>
                </tr>
                <tr>
                  <td>Interface Implementation</td>
                  <td style="font-family: monospace; font-size: 0.75rem;">${s.code === 'TBO' ? 'TboSupplierAdapter' : 'TripjackSupplierAdapter'}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 0.75rem;">
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">SUPPORTED CAPABILITIES</div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                ${(s.capabilities || []).map(c => `
                  <span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-secondary);">
                    ✓ ${c.replace(/_/g, ' ')}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load supplier console:', err);
      container.innerHTML = `<p style="color: var(--accent-rose);">Failed to load supplier status: ${err.message}</p>`;
    }
  }

  async inspectRawNormalization() {
    const routeSelect = document.getElementById('rawInspectorRoute');
    const val = routeSelect ? routeSelect.value : 'AMD-DEL';
    const [origin, destination] = val.split('-');

    const tboBox = document.getElementById('jsonViewerTbo');
    const tripjackBox = document.getElementById('jsonViewerTripjack');
    const normBox = document.getElementById('jsonViewerNormalized');

    if (tboBox) tboBox.textContent = '// Querying TBO raw payload...';
    if (tripjackBox) tripjackBox.textContent = '// Querying TripJack raw payload...';
    if (normBox) normBox.textContent = '// Running gateway normalization & deduplication...';

    try {
      const res = await fetch(`${this.apiBase}/suppliers/inspect-raw?origin=${origin}&destination=${destination}`);
      const data = await res.json();

      if (tboBox) {
        tboBox.textContent = data.rawVendorPayloads?.tbo ? JSON.stringify(data.rawVendorPayloads.tbo, null, 2) : '// No TBO flights found for this route';
      }
      if (tripjackBox) {
        tripjackBox.textContent = data.rawVendorPayloads?.tripjack ? JSON.stringify(data.rawVendorPayloads.tripjack, null, 2) : '// No TripJack flights found for this route';
      }
      if (normBox) {
        normBox.textContent = data.tixxgoNormalizedModel ? JSON.stringify(data.tixxgoNormalizedModel, null, 2) : '// No normalized flights available';
      }
    } catch (err) {
      console.error('Failed to inspect raw normalization:', err);
      if (tboBox) tboBox.textContent = '// Error fetching TBO payload: ' + err.message;
      if (tripjackBox) tripjackBox.textContent = '// Error fetching TripJack payload: ' + err.message;
      if (normBox) normBox.textContent = '// Error normalizing payload: ' + err.message;
    }
  }

  async recalculateScoring() {
    const sliderPrice = document.getElementById('sliderPrice');
    const sliderMargin = document.getElementById('sliderMargin');
    const sliderSla = document.getElementById('sliderSla');
    const sliderBaggage = document.getElementById('sliderBaggage');
    const sliderQuality = document.getElementById('sliderQuality');

    const priceWeight = sliderPrice ? Number(sliderPrice.value) : 35;
    const marginWeight = sliderMargin ? Number(sliderMargin.value) : 20;
    const slaWeight = sliderSla ? Number(sliderSla.value) : 20;
    const baggageWeight = sliderBaggage ? Number(sliderBaggage.value) : 15;
    const qualityWeight = sliderQuality ? Number(sliderQuality.value) : 10;

    const valPrice = document.getElementById('valPrice');
    const valMargin = document.getElementById('valMargin');
    const valSla = document.getElementById('valSla');
    const valBaggage = document.getElementById('valBaggage');
    const valQuality = document.getElementById('valQuality');

    if (valPrice) valPrice.textContent = `${priceWeight}%`;
    if (valMargin) valMargin.textContent = `${marginWeight}%`;
    if (valSla) valSla.textContent = `${slaWeight}%`;
    if (valBaggage) valBaggage.textContent = `${baggageWeight}%`;
    if (valQuality) valQuality.textContent = `${qualityWeight}%`;

    const container = document.getElementById('scoringResultsContainer');
    if (!container) return;

    try {
      const res = await fetch(`${this.apiBase}/suppliers/test-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceWeight,
          marginWeight,
          slaWeight,
          baggageWeight,
          qualityWeight
        })
      });
      const data = await res.json();
      if (!data.success) return;

      const scores = data.scores;
      const winner = data.winner; // 'TRIPJACK' or 'TBO'

      const offers = [
        {
          code: 'TBO',
          name: 'Travel Boutique Online',
          score: scores.TBO.total,
          fare: 8450,
          breakdown: scores.TBO.breakdown,
          details: '15KG Baggage, Refundable, 98.5% SLA, 3.0% Commission'
        },
        {
          code: 'TRIPJACK',
          name: 'TripJack Wholesaler Network',
          score: scores.TRIPJACK.total,
          fare: 8150,
          breakdown: scores.TRIPJACK.breakdown,
          details: '20KG Baggage, Non-Refundable, 96.2% SLA, 4.5% Commission'
        }
      ];

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
          ${offers.map(o => {
            const isWinner = o.code === winner;
            return `
              <div class="score-card ${isWinner ? 'is-winner' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 1.1rem;">${o.name}</span>
                    <span class="status-badge" style="background: rgba(99, 102, 241, 0.15); color: var(--accent-indigo);">${o.code}</span>
                  </div>
                  ${isWinner ? `<span class="winner-badge">🏆 WINNING OFFER</span>` : `<span style="font-size: 0.78rem; color: var(--text-muted);">Competitor</span>`}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; margin: 0.75rem 0;">
                  <div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Composite Score:</span>
                    <div style="font-size: 1.6rem; font-weight: 900; color: ${isWinner ? 'var(--accent-emerald)' : 'var(--text-primary)'};">${o.score} / 100</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Customer Fare:</span>
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-cyan);">₹${o.fare.toLocaleString()}</div>
                  </div>
                </div>

                <div style="border-top: 1px dashed var(--border-color); padding-top: 0.6rem; margin-top: 0.6rem; font-size: 0.8rem;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: var(--text-muted);">💰 Price Points (${priceWeight}%):</span>
                    <strong>${o.breakdown.priceScore} pts</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: var(--text-muted);">📈 Margin Points (${marginWeight}%):</span>
                    <strong>${o.breakdown.marginScore} pts</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: var(--text-muted);">🛡️ SLA Points (${slaWeight}%):</span>
                    <strong>${o.breakdown.reliabilityScore} pts</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: var(--text-muted);">🧳 Baggage Points (${baggageWeight}%):</span>
                    <strong>${o.breakdown.baggageScore} pts</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-muted);">⚡ Feed Quality Points (${qualityWeight}%):</span>
                    <strong>${o.breakdown.qualityScore} pts</strong>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.5rem;">💡</span>
          <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
            <strong>Engine Decision:</strong> <span style="color: var(--accent-emerald); font-weight: 700;">${winner}</span> selected with a lead of <strong>+${data.pointDifference} points</strong>. 
            <em>${data.selectionReason}</em>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Failed to recalculate scoring:', err);
    }
  }

  resetScoringWeights() {
    const sP = document.getElementById('sliderPrice');
    const sM = document.getElementById('sliderMargin');
    const sS = document.getElementById('sliderSla');
    const sB = document.getElementById('sliderBaggage');
    const sQ = document.getElementById('sliderQuality');

    if (sP) sP.value = 35;
    if (sM) sM.value = 20;
    if (sS) sS.value = 20;
    if (sB) sB.value = 15;
    if (sQ) sQ.value = 10;

    this.recalculateScoring();
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TixxgoApp();
});
