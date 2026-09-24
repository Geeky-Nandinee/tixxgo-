/**
 * Tixxgo Internal Flight Model
 * Task 1: Supplier-independent internal model
 */

export interface Airline {
  code: string;
  name: string;
}

export interface AirportLocation {
  code: string;
  city: string;
}

export interface BaggageAllowance {
  checkIn: string;
  cabin: string;
}

export interface CustomerPriceBreakdown {
  baseFare: number;
  taxes: number;
  serviceFee: number;
  discount: number;
  totalAmount: number;
  currency: string;
}

export interface TixxgoFeeBreakdown {
  serviceFee: number;
  promoDiscount: number;
  promoCode: string | null;
  netRevenue: number;
  currency: string;
}

export interface FlightOffer {
  id: string;
  supplierCode: string;
  supplierResultId: string;
  airline: Airline;
  flightNumber: string;
  origin: AirportLocation;
  destination: AirportLocation;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  cabinClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  baggage: BaggageAllowance;
  isRefundable: boolean;
  availableSeats: number;
  pricing: {
    customerPrice: CustomerPriceBreakdown;
    tixxgoFees?: TixxgoFeeBreakdown;
  };
  isDuplicateResolved?: boolean;
  selectionReason?: string;
  alternateSupplierOffers?: Array<{
    supplierCode: string;
    supplierResultId: string;
    customerPrice: CustomerPriceBreakdown;
    baggage: BaggageAllowance;
  }>;
}

export interface SearchCriteria {
  origin: string;
  destination: string;
  departureDate: string;
  adults: number;
  cabinClass: string;
  enableMultiSupplier?: boolean;
}

export interface RevalidationResponse {
  success: boolean;
  status: 'PRICE_CONFIRMED' | 'PRICE_CHANGED' | 'SOLD_OUT';
  requiresCustomerAcceptance: boolean;
  priceComparison: {
    originalTotal: number;
    revalidatedTotal: number;
    priceDifference: number;
    currency: string;
  };
  breakdown: CustomerPriceBreakdown;
  revalidationToken: string;
  quoteExpiresInSeconds: number;
  message: string;
}
