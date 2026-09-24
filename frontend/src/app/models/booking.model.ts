import { CustomerPriceBreakdown, FlightOffer } from './flight.model';

export interface Traveller {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passportNumber?: string;
}

export type PaymentStatus = 'PAYMENT_PENDING' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'REFUND_PENDING' | 'REFUNDED';

export type BookingStatus = 
  | 'INITIATED' 
  | 'SUPPLIER_BOOKING' 
  | 'BOOKING_CONFIRMED' 
  | 'SUPPLIER_UNKNOWN' 
  | 'SUPPLIER_BOOKING_FAILED' 
  | 'CANCELLATION_REQUESTED' 
  | 'CANCELLED';

export type TicketingStatus = 'PENDING' | 'ISSUED' | 'FAILED' | 'CANCELLED';

export interface BookingAuditLog {
  id: string;
  bookingReference: string;
  action: string;
  previousStatus: string | null;
  newStatus: string;
  reason?: string;
  createdAt: string;
}

export interface BookingRecord {
  id: string;
  bookingReference: string; // e.g. TXG-123456
  pnr?: string;
  supplierCode: string;
  supplierResultId: string;
  flightDetails: Partial<FlightOffer>;
  customerPrice: CustomerPriceBreakdown;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  ticketingStatus: TicketingStatus;
  travellers?: Traveller[];
  auditLogs?: BookingAuditLog[];
  createdAt: string;
  updatedAt: string;
}

export interface CancellationQuote {
  bookingReference: string;
  flightNumber: string;
  pnr?: string;
  totalPaid: number;
  breakdown: {
    airlineCancellationPenalty: number;
    tixxgoCancellationFee: number;
    estimatedRefund: number;
  };
  currency: string;
  terms: string;
}
