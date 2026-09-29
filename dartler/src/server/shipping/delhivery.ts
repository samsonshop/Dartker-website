import 'server-only';
import { env } from '@/lib/env';
import type { ShipmentStatusValue } from '@/db/schema';
import {
  ShippingError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type ServiceabilityResult,
  type ShippingProvider,
  type TrackingResult,
} from './types';

/**
 * Delhivery adapter. The API token is read server-side only and is never
 * logged, echoed in an error message, or sent to the browser.
 */

/** Delhivery status strings mapped onto Dartler's shipment states. */
function mapStatus(status: string, statusType?: string): ShipmentStatusValue {
  const value = `${status} ${statusType ?? ''}`.toLowerCase();
  if (value.includes('delivered')) return 'DELIVERED';
  if (value.includes('rto')) return 'RTO';
  if (value.includes('out for delivery') || value.includes('dispatched')) return 'OUT_FOR_DELIVERY';
  if (value.includes('in transit') || value.includes('transit')) return 'IN_TRANSIT';
  if (value.includes('pickup') || value.includes('picked')) return 'PICKED_UP';
  if (value.includes('manifest')) return 'MANIFESTED';
  if (value.includes('cancel')) return 'CANCELLED';
  if (value.includes('pending') || value.includes('open')) return 'PENDING';
  return 'EXCEPTION';
}

function label(status: ShipmentStatusValue): string {
  switch (status) {
    case 'MANIFESTED':
      return 'Shipment created';
    case 'PICKED_UP':
      return 'Picked up by courier';
    case 'IN_TRANSIT':
      return 'In transit';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'RTO':
      return 'Returning to origin';
    case 'CANCELLED':
      return 'Shipment cancelled';
    case 'EXCEPTION':
      return 'Delivery exception';
    default:
      return 'Pending pickup';
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const config = env();
  const url = `${config.DELHIVERY_BASE_URL.replace(/\/$/, '')}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Token ${config.DELHIVERY_API_TOKEN}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new ShippingError('Delhivery rejected the API token. Check DELHIVERY_API_TOKEN.', false);
  }
  return response;
}

export const delhiveryProvider: ShippingProvider = {
  name: 'Delhivery',
  isMock: false,

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const response = await call(`/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(pincode)}`);
    if (!response.ok) {
      throw new ShippingError(`Serviceability lookup failed (${response.status}).`);
    }

    const data = (await response.json()) as {
      delivery_codes?: {
        postal_code?: {
          pin?: number;
          district?: string;
          state_code?: string;
          cod?: string;
          pre_paid?: string;
        };
      }[];
    };

    const entry = data.delivery_codes?.[0]?.postal_code;
    if (!entry) {
      return {
        pincode,
        serviceable: false,
        cashOnDelivery: false,
        prepaid: false,
        message: 'We do not deliver to this pincode yet.',
      };
    }

    return {
      pincode,
      serviceable: true,
      city: entry.district ?? null,
      state: entry.state_code ?? null,
      cashOnDelivery: (entry.cod ?? 'N').toUpperCase() === 'Y',
      prepaid: (entry.pre_paid ?? 'N').toUpperCase() === 'Y',
      estimatedDays: null,
    };
  },

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const config = env();
    const payload = {
      shipments: [
        {
          name: input.customerName,
          order: input.orderNumber,
          payment_mode: input.paymentMode,
          add: [input.address.line1, input.address.line2].filter(Boolean).join(', '),
          city: input.address.city,
          state: input.address.state,
          country: input.address.country || 'India',
          phone: input.phone,
          pin: input.address.pincode,
          cod_amount: input.paymentMode === 'COD' ? (input.codAmountPaise / 100).toFixed(2) : '0',
          total_amount: (input.declaredValuePaise / 100).toFixed(2),
          weight: String(input.weightGrams),
          quantity: String(input.items.reduce((total, item) => total + item.quantity, 0)),
          products_desc: input.items.map((item) => `${item.name} x${item.quantity}`).join(', ').slice(0, 200),
          seller_name: config.DELHIVERY_CLIENT_NAME || 'Dartler',
        },
      ],
      pickup_location: { name: input.pickupName },
    };

    const body = `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`;
    const response = await call('/api/cmu/create.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await response.json()) as {
      success?: boolean;
      rmk?: string;
      packages?: { waybill?: string; status?: string; remarks?: string[] }[];
    };

    const pack = data.packages?.[0];
    if (!response.ok || !pack?.waybill) {
      const remark = pack?.remarks?.join('; ') || data.rmk || `HTTP ${response.status}`;
      throw new ShippingError(`Delhivery could not create the shipment: ${remark}`);
    }

    return {
      awb: pack.waybill,
      courier: 'Delhivery',
      status: 'MANIFESTED',
      estimatedDelivery: new Date(Date.now() + 4 * 86_400_000),
      labelUrl: null,
      raw: data,
    };
  },

  async track(awb: string): Promise<TrackingResult> {
    const response = await call(`/api/v1/packages/json/?waybill=${encodeURIComponent(awb)}`);
    if (!response.ok) throw new ShippingError(`Tracking lookup failed (${response.status}).`);

    const data = (await response.json()) as {
      ShipmentData?: {
        Shipment?: {
          Status?: { Status?: string; StatusType?: string; StatusDateTime?: string };
          ExpectedDeliveryDate?: string;
          DeliveryDate?: string;
          Scans?: {
            ScanDetail?: {
              Scan?: string;
              ScanType?: string;
              ScanDateTime?: string;
              ScannedLocation?: string;
              Instructions?: string;
            };
          }[];
        };
      }[];
    };

    const shipment = data.ShipmentData?.[0]?.Shipment;
    const current = mapStatus(shipment?.Status?.Status ?? '', shipment?.Status?.StatusType);

    const events = (shipment?.Scans ?? [])
      .map((scan) => scan.ScanDetail)
      .filter(Boolean)
      .map((detail) => {
        const status = mapStatus(detail!.Scan ?? '', detail!.ScanType);
        return {
          status,
          label: detail!.Instructions || label(status),
          location: detail!.ScannedLocation ?? null,
          occurredAt: detail!.ScanDateTime ? new Date(detail!.ScanDateTime) : new Date(),
        };
      })
      .filter((event) => !Number.isNaN(event.occurredAt.getTime()));

    return {
      awb,
      status: current,
      deliveredAt: shipment?.DeliveryDate ? new Date(shipment.DeliveryDate) : null,
      estimatedDelivery: shipment?.ExpectedDeliveryDate
        ? new Date(shipment.ExpectedDeliveryDate)
        : null,
      events,
      raw: data,
    };
  },

  async cancel(awb: string) {
    const response = await call('/api/p/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waybill: awb, cancellation: 'true' }),
    });
    const data = (await response.json().catch(() => ({}))) as { status?: boolean; remark?: string };
    return {
      ok: response.ok && data.status !== false,
      message: data.remark ?? (response.ok ? 'Shipment cancelled.' : 'Cancellation failed.'),
    };
  },
};

/* ---------------------------------------------------------------- mock */

/** Deterministic stand-in used until a real token is configured. */
export const mockProvider: ShippingProvider = {
  name: 'Delhivery (mock)',
  isMock: true,

  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const valid = /^[1-9]\d{5}$/.test(pincode);
    return {
      pincode,
      serviceable: valid,
      city: valid ? 'Serviceable area' : null,
      state: null,
      cashOnDelivery: valid,
      prepaid: valid,
      estimatedDays: valid ? 3 : null,
      message: valid
        ? 'Mock courier: estimated delivery in 2–4 days.'
        : 'Enter a valid 6-digit Indian pincode.',
    };
  },

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const digits = Array.from(input.orderNumber)
      .map((character) => character.charCodeAt(0))
      .reduce((total, code) => (total * 31 + code) % 1_000_000_000, 7);

    return {
      awb: `MOCK${String(digits).padStart(10, '0')}`,
      courier: 'Delhivery (mock)',
      status: 'MANIFESTED',
      estimatedDelivery: new Date(Date.now() + 4 * 86_400_000),
      labelUrl: null,
      raw: { mock: true, orderNumber: input.orderNumber },
    };
  },

  async track(awb: string): Promise<TrackingResult> {
    // Advances one stage per day since creation so the timeline behaves realistically.
    const now = Date.now();
    const stages: ShipmentStatusValue[] = [
      'MANIFESTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ];
    const events = stages.slice(0, 3).map((status, index) => ({
      status,
      label: label(status),
      location: 'Coimbatore Hub',
      occurredAt: new Date(now - (3 - index) * 86_400_000),
    }));

    return {
      awb,
      status: 'IN_TRANSIT',
      deliveredAt: null,
      estimatedDelivery: new Date(now + 2 * 86_400_000),
      events,
      raw: { mock: true },
    };
  },

  async cancel() {
    return { ok: true, message: 'Mock shipment cancelled.' };
  },
};

export function getShippingProvider(): ShippingProvider {
  const config = env();
  const useMock = config.DELHIVERY_USE_MOCK === 'true' || !config.DELHIVERY_API_TOKEN;
  return useMock ? mockProvider : delhiveryProvider;
}
