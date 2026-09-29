import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, isRazorpayConfigured } from '@/lib/env';

/**
 * Thin, dependency-free Razorpay client. Keys are read from the environment on
 * the server only; the browser never sees anything but the public key id.
 *
 * When keys are absent the store still works end-to-end on Cash on Delivery —
 * online payment is refused with a clear message rather than being faked.
 */

const API_BASE = 'https://api.razorpay.com/v1';

export class PaymentConfigError extends Error {
  constructor(message = 'Online payment is not configured yet. Please choose Cash on Delivery.') {
    super(message);
    this.name = 'PaymentConfigError';
  }
}

function authHeader(): string {
  const config = env();
  return `Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) throw new PaymentConfigError();

  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    // Never log the payload — it can echo credentials back.
    console.error('[razorpay] order creation failed', response.status);
    throw new Error(
      `Could not start the payment (${response.status}). ${detail.slice(0, 120)}`,
    );
  }

  return (await response.json()) as RazorpayOrder;
}

/** HMAC-SHA256 of `order_id|payment_id`, compared in constant time. */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = env().RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = createHmac('sha256', secret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex');

  const provided = input.signature ?? '';
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
}

/** Webhook bodies are signed with a separate secret over the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = env().RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export async function fetchPayment(paymentId: string): Promise<Record<string, unknown>> {
  if (!isRazorpayConfigured()) throw new PaymentConfigError();
  const response = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not fetch payment ${paymentId}`);
  return (await response.json()) as Record<string, unknown>;
}

export async function refundPayment(input: {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string }> {
  if (!isRazorpayConfigured()) throw new PaymentConfigError();
  const response = await fetch(`${API_BASE}/payments/${input.paymentId}/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ amount: input.amountPaise, notes: input.notes }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Refund failed (${response.status})`);
  return (await response.json()) as { id: string; status: string };
}
