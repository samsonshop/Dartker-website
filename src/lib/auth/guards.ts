import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminSession, getCustomerSession } from './session';
import type { AdminSession, CustomerSession } from './session';
import { hasPermission, type PermissionKey } from '@/lib/permissions';
import { PATHNAME_HEADER } from '@/middleware';

/**
 * The path the visitor actually requested, as forwarded by the middleware.
 *
 * Only same-site absolute paths are returned. A `next=` taken from a header
 * without that check would be an open-redirect: `//evil.example` and
 * `https://evil.example` both parse as "not this site".
 */
async function requestedPath(): Promise<string | undefined> {
  const value = (await headers()).get(PATHNAME_HEADER);
  if (!value) return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}

/**
 * Server component / server action guard for customer-only pages.
 *
 * With no `returnTo`, the visitor is sent back to the page they asked for — so a
 * bounce from `/account/orders` returns to `/account/orders`, not to `/account`.
 */
export async function requireCustomer(returnTo?: string): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    const target = returnTo ?? (await requestedPath());
    const next = target ? `?next=${encodeURIComponent(target)}` : '';
    redirect(`/login${next}`);
  }
  return session;
}

/** Server component / server action guard for the admin console. */
export async function requireAdmin(permission?: PermissionKey): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (permission && !hasPermission(session.permissions, permission)) redirect('/admin/forbidden');
  return session;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Route-handler guard: throws ApiError instead of redirecting. */
export async function requireAdminApi(permission?: PermissionKey): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new ApiError(401, 'Admin authentication required.');
  if (permission && !hasPermission(session.permissions, permission)) {
    throw new ApiError(403, 'You do not have permission to perform this action.');
  }
  return session;
}

export async function requireCustomerApi(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) throw new ApiError(401, 'Please sign in to continue.');
  return session;
}
