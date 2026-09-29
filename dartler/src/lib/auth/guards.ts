import 'server-only';
import { redirect } from 'next/navigation';
import { getAdminSession, getCustomerSession } from './session';
import type { AdminSession, CustomerSession } from './session';
import { hasPermission, type PermissionKey } from '@/lib/permissions';

/** Server component / server action guard for customer-only pages. */
export async function requireCustomer(returnTo?: string): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
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
