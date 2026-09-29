import 'server-only';
import { cookies } from 'next/headers';

export const RECENT_ORDERS_COOKIE = 'dartler_orders';
const MAX_TRACKED = 10;

/**
 * Guests have no account, so a freshly placed order is remembered in an
 * httpOnly cookie. That cookie — not the order number alone — is what lets the
 * confirmation page be opened, so guessing an order number reveals nothing.
 */
export async function readRecentOrderNumbers(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(RECENT_ORDERS_COOKIE)?.value;
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_TRACKED);
}

export function appendRecentOrderNumber(existing: string[], orderNumber: string): string {
  const next = [orderNumber, ...existing.filter((value) => value !== orderNumber)].slice(
    0,
    MAX_TRACKED,
  );
  return next.join(',');
}

export const recentOrdersCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 60,
};
