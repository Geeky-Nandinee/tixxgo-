import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BookingRecord, CancellationQuote } from '../models/booking.model';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private http = inject(HttpClient);
  private apiUrl = '/api/bookings';

  createBooking(payload: any, idempotencyKey?: string): Observable<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }
    return this.http.post<any>(this.apiUrl, payload, { headers });
  }

  getBooking(bookingReference: string): Observable<BookingRecord> {
    return this.http.get<{ success: boolean; data: BookingRecord }>(`${this.apiUrl}/${bookingReference}`)
      .pipe(map(res => res.data));
  }

  listBookings(): Observable<BookingRecord[]> {
    return this.http.get<{ success: boolean; data: BookingRecord[] }>(this.apiUrl)
      .pipe(map(res => res.data));
  }

  reconcileBooking(bookingReference: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${bookingReference}/reconcile`, {});
  }

  getCancellationQuote(bookingReference: string): Observable<CancellationQuote> {
    return this.http.get<{ success: boolean; data: CancellationQuote }>(`${this.apiUrl}/${bookingReference}/cancel-quote`)
      .pipe(map(res => res.data));
  }

  cancelBooking(bookingReference: string, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${bookingReference}/cancel`, { reason });
  }
}
