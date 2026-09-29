import type { ShipmentStatusValue } from '@/db/schema';

/**
 * Courier-agnostic contract. Everything above this file talks in these terms,
 * so adding a second courier later means writing one more adapter, not
 * rewriting the order system.
 */
export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  city?: string | null;
  state?: string | null;
  cashOnDelivery: boolean;
  prepaid: boolean;
  estimatedDays?: number | null;
  message?: string;
}

export interface CreateShipmentInput {
  orderNumber: string;
  customerName: string;
  phone: string;
  email: string;
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  paymentMode: 'COD' | 'Prepaid';
  codAmountPaise: number;
  declaredValuePaise: number;
  weightGrams: number;
  items: { name: string; sku: string; quantity: number }[];
  pickupName: string;
}

export interface CreateShipmentResult {
  awb: string;
  courier: string;
  status: ShipmentStatusValue;
  estimatedDelivery: Date | null;
  labelUrl: string | null;
  raw: unknown;
}

export interface TrackingResult {
  awb: string;
  status: ShipmentStatusValue;
  deliveredAt: Date | null;
  estimatedDelivery: Date | null;
  events: {
    status: ShipmentStatusValue;
    label: string;
    location: string | null;
    occurredAt: Date;
  }[];
  raw: unknown;
}

export interface ShippingProvider {
  readonly name: string;
  readonly isMock: boolean;
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
  track(awb: string): Promise<TrackingResult>;
  cancel(awb: string): Promise<{ ok: boolean; message: string }>;
}

export class ShippingError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'ShippingError';
  }
}
