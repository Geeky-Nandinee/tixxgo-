import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightService } from './services/flight.service';
import { BookingService } from './services/booking.service';
import { FlightOffer, SearchCriteria, RevalidationResponse } from './models/flight.model';
import { BookingRecord, Traveller } from './models/booking.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private flightService = inject(FlightService);
  private bookingService = inject(BookingService);

  // Angular Signals for Reactive State Management
  currentStep = signal<number>(1);
  isLoading = signal<boolean>(false);
  searchResults = signal<FlightOffer[]>([]);
  selectedFlight = signal<FlightOffer | null>(null);
  revalidationInfo = signal<RevalidationResponse | null>(null);
  currentBooking = signal<BookingRecord | null>(null);

  searchCriteria: SearchCriteria = {
    origin: 'AMD',
    destination: 'DEL',
    departureDate: '2026-10-15',
    adults: 1,
    cabinClass: 'ECONOMY',
    enableMultiSupplier: true
  };

  traveller: Traveller = {
    title: 'MR',
    firstName: 'Test',
    lastName: 'Passenger',
    email: 'test.passenger@example.com',
    phone: '+919876543210'
  };

  ngOnInit() {
    this.searchFlights();
  }

  searchFlights() {
    this.isLoading.set(true);
    this.flightService.searchFlights(this.searchCriteria).subscribe({
      next: (flights) => {
        this.searchResults.set(flights);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Search failed', err);
        this.isLoading.set(false);
      }
    });
  }

  onSelectFlight(flight: FlightOffer) {
    this.selectedFlight.set(flight);
    // Task 3: Fare Revalidation
    this.flightService.revalidateFare(
      flight.supplierCode,
      flight.supplierResultId,
      flight.pricing.customerPrice.totalAmount
    ).subscribe({
      next: (res) => {
        this.revalidationInfo.set(res);
        if (res.status === 'PRICE_CHANGED') {
          // Open Modal for acceptance
        } else {
          this.currentStep.set(3); // Traveller Details
        }
      }
    });
  }

  acceptPriceChange() {
    const info = this.revalidationInfo();
    const flight = this.selectedFlight();
    if (info && flight) {
      flight.pricing.customerPrice = info.breakdown;
      this.selectedFlight.set(flight);
    }
    this.currentStep.set(3);
  }

  proceedToPayment() {
    this.currentStep.set(4);
  }

  submitBooking(simulationOptions: any = {}) {
    this.isLoading.set(true);
    const flight = this.selectedFlight();
    if (!flight) return;

    const payload = {
      flightDetails: flight,
      supplierResultId: flight.supplierResultId,
      supplierCode: flight.supplierCode,
      travellers: [this.traveller],
      customerPrice: flight.pricing.customerPrice,
      simulationOptions
    };

    const idempotencyKey = `TXG_${Date.now()}`;

    this.bookingService.createBooking(payload, idempotencyKey).subscribe({
      next: (res) => {
        this.currentBooking.set(res.booking || res);
        this.currentStep.set(5);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Booking failed', err);
      }
    });
  }
}
