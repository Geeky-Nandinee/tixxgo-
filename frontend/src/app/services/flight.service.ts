import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FlightOffer, SearchCriteria, RevalidationResponse } from '../models/flight.model';

@Injectable({
  providedIn: 'root'
})
export class FlightService {
  private http = inject(HttpClient);
  private apiUrl = '/api/flights';

  searchFlights(criteria: SearchCriteria): Observable<FlightOffer[]> {
    return this.http.post<{ success: boolean; data: FlightOffer[] }>(`${this.apiUrl}/search`, criteria)
      .pipe(map(response => response.data));
  }

  revalidateFare(supplierCode: string, supplierResultId: string, originalCustomerTotal: number): Observable<RevalidationResponse> {
    return this.http.post<RevalidationResponse>(`${this.apiUrl}/revalidate`, {
      supplierCode,
      supplierResultId,
      originalCustomerTotal,
      adults: 1
    });
  }

  getSuppliers(): Observable<any[]> {
    return this.http.get<{ success: boolean; suppliers: any[] }>(`${this.apiUrl}/suppliers`)
      .pipe(map(res => res.suppliers));
  }

  setSimulationFlag(flagName: string, value: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulation-flags`, { [flagName]: value });
  }
}
