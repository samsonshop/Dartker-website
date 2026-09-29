'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAdminApi } from '@/lib/auth/guards';
import { ALL_PERMISSIONS, PERMISSIONS, type PermissionKey } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import { getAdminSession, revokeAllSessions } from '@/lib/auth/session';
import { updateStoreSettings } from '@/server/settings';
import { generateBackupCode } from '@/lib/ids';
import { rupeesToPaise } from '@/lib/money';
import type { ActionState } from './admin-products';

export type { ActionState };

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  supportEmail: z.string().trim().email().max(160),
  supportPhone: z.string().trim().min(6).max(24),
  freeShippingAbove: z.string(),
  flatShipping: z.string(),
  defaultTaxPercent: z.coerce.number().min(0).max(50),
  returnWindowDays: z.coerce.number().int().min(0).max(90),
  lowStockThreshold: z.coerce.number().int().min(0).max(1000),
  pickupName: z.string().trim().min(2).max(80),
  pickupPincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  codEnabled: z.boolean(),
  onlinePaymentEnabled: z.boolean(),
  notifyOnOrder: z.boolean(),
  notifyOnShipment: z.boolean(),
});

export async function saveStoreSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const parsed = settingsSchema.safeParse({
    storeName: formData.get('storeName'),
    supportEmail: formData.get('supportEmail'),
    supportPhone: formData.get('supportPhone'),
    freeShippingAbove: formData.get('freeShippingAbove'),
    flatShipping: formData.get('flatShipping'),
    defaultTaxPercent: formData.get('defaultTaxPercent'),
    returnWindowDays: formData.get('returnWindowDays'),
    lowStockThreshold: formData.get('lowStockThreshold'),
    pickupName: formData.get('pickupName'),
    pickupPincode: formData.get('pickupPincode'),
    codEnabled: formData.get('codEnabled') === 'on',
    onlinePaymentEnabled: formData.get('onlinePaymentEnabled') === 'on',
    notifyOnOrder: formData.get('notifyOnOrder') === 'on',
    notifyOnShipment: formData.get('notifyOnShipment') === 'on',
  });

  if (!parsed.success) return { ok: false, error: 'Please check the values you entered.' };

  const input = parsed.data;
  const freeShipping = rupeesToPaise(input.freeShippingAbove);
  const flatShipping = rupeesToPaise(input.flatShipping);
  if (Number.isNaN(freeShipping) || Number.isNaN(flatShipping)) {
    return { ok: false, error: 'Shipping amounts must be numbers.' };
  }

  await updateStoreSettings({
    storeName: input.storeName,
    supportEmail: input.supportEmail,
    supportPhone: input.supportPhone,
    freeShippingAbovePaise: freeShipping,
    flatShippingPaise: flatShipping,
    defaultTaxBps: Math.round(input.defaultTaxPercent * 100),
    returnWindowDays: input.returnWindowDays,
    lowStockThreshold: input.lowStockThreshold,
    pickupName: input.pickupName,
    pickupPincode: input.pickupPincode,
    codEnabled: input.codEnabled,
    onlinePaymentEnabled: input.onlinePaymentEnabled,
    notifyOnOrder: input.notifyOnOrder,
    notifyOnShipment: input.notifyOnShipment,
  });

  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: 'settings.update',
    entity: 'store_settings',
    entityId: 'default',
    summary: 'Updated store settings',
  });

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

export async function changeAdminPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi();
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const schema = z
    .object({
      current: z.string().min(1, 'Enter your current password'),
      next: z
        .string()
        .min(10, 'Use at least 10 characters')
        .max(72)
        .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
          message: 'Include letters and numbers',
        }),
      confirm: z.string(),
    })
    .refine((value) => value.next === value.confirm, {
      message: 'The new passwords do not match',
      path: ['confirm'],
    });

  const parsed = schema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  const valid = await verifyPassword(parsed.data.current, session.user.passwordHash);
  if (!valid) return { ok: false, error: 'Your current password is incorrect.' };

  await db
    .update(t.adminUsers)
    .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(t.adminUsers.id, session.user.id));

  // Changing a password ends every other session for this admin.
  await revokeAllSessions('ADMIN', session.user.id, session.sessionId);

  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: 'admin.password_change',
    entity: 'admin_user',
    entityId: session.user.id,
    summary: 'Password changed; other sessions were signed out',
  });

  revalidatePath('/admin/settings');
  return { ok: true, message: 'Password updated. Other devices have been signed out.' };
}

export async function toggleTwoFactorAction(enabled: boolean): Promise<
  ActionState & { backupCodes?: string[] }
> {
  try {
    const session = await requireAdminApi();
    const codes = enabled ? Array.from({ length: 8 }, generateBackupCode) : [];

    await db
      .update(t.adminUsers)
      .set({ twoFactorEnabled: enabled, backupCodes: codes, updatedAt: new Date() })
      .where(eq(t.adminUsers.id, session.user.id));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: enabled ? 'admin.2fa_enabled' : 'admin.2fa_disabled',
      entity: 'admin_user',
      entityId: session.user.id,
    });

    revalidatePath('/admin/settings');
    return {
      ok: true,
      message: enabled
        ? 'Two-factor authentication is on. Save your backup codes now.'
        : 'Two-factor authentication is off.',
      backupCodes: codes,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not update two-factor settings.',
    };
  }
}

export async function revokeSessionAction(sessionId: string): Promise<ActionState> {
  try {
    const session = await requireAdminApi();
    // An admin can only revoke their own sessions here.
    const row = await db.query.sessions.findFirst({
      where: and(eq(t.sessions.id, sessionId), eq(t.sessions.adminUserId, session.user.id)),
    });
    if (!row) return { ok: false, error: 'Session not found.' };

    await db.update(t.sessions).set({ revokedAt: new Date() }).where(eq(t.sessions.id, sessionId));
    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'admin.session_revoked',
      entity: 'session',
      entityId: sessionId,
    });

    revalidatePath('/admin/settings');
    return { ok: true, message: 'Session signed out.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not revoke the session.',
    };
  }
}

export async function getAdminSecurityContext() {
  const session = await getAdminSession();
  if (!session) return null;

  const [sessions, logins, activity] = await Promise.all([
    db.query.sessions.findMany({
      where: and(eq(t.sessions.adminUserId, session.user.id), isNull(t.sessions.revokedAt)),
      orderBy: [desc(t.sessions.lastSeenAt)],
      limit: 10,
    }),
    db.query.loginEvents.findMany({
      where: eq(t.loginEvents.email, session.user.email),
      orderBy: [desc(t.loginEvents.createdAt)],
      limit: 10,
    }),
    db.query.auditLogs.findMany({
      orderBy: [desc(t.auditLogs.createdAt)],
      limit: 25,
    }),
  ]);

  return { session, sessions, logins, activity };
}

/* --------------------------------------------------------------- roles */

const roleSchema = z.object({
  roleId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2, 'Enter a role name').max(50),
  description: z.string().trim().max(160).optional(),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

export async function saveRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.ROLES_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const parsed = roleSchema.safeParse({
    roleId: (formData.get('roleId') as string) || null,
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    permissions: formData.getAll('permissions').map(String),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  const permissions = parsed.data.permissions.filter((key) =>
    ALL_PERMISSIONS.includes(key as PermissionKey),
  ) as PermissionKey[];

  if (permissions.length === 0) return { ok: false, error: 'Select at least one permission.' };

  const existing = parsed.data.roleId
    ? await db.query.adminRoles.findFirst({ where: eq(t.adminRoles.id, parsed.data.roleId) })
    : null;

  // The Super Admin role must keep every permission, or the console can lock itself out.
  if (existing?.name === 'Super Admin' && permissions.length !== ALL_PERMISSIONS.length) {
    return { ok: false, error: 'The Super Admin role must keep every permission.' };
  }

  const roleId = await db.transaction(async (tx) => {
    let id = parsed.data.roleId ?? null;
    if (id) {
      await tx
        .update(t.adminRoles)
        .set({ name: parsed.data.name, description: parsed.data.description ?? null, updatedAt: new Date() })
        .where(eq(t.adminRoles.id, id));
    } else {
      const [row] = await tx
        .insert(t.adminRoles)
        .values({ name: parsed.data.name, description: parsed.data.description ?? null })
        .returning({ id: t.adminRoles.id });
      id = row.id;
    }

    await tx.delete(t.adminPermissions).where(eq(t.adminPermissions.roleId, id));
    await tx
      .insert(t.adminPermissions)
      .values(permissions.map((key) => ({ roleId: id!, key })))
      .onConflictDoNothing();

    return id;
  });

  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: parsed.data.roleId ? 'role.update' : 'role.create',
    entity: 'admin_role',
    entityId: roleId ?? undefined,
    summary: `${parsed.data.roleId ? 'Updated' : 'Created'} role “${parsed.data.name}” with ${permissions.length} permissions`,
  });

  revalidatePath('/admin/roles');
  return { ok: true, message: 'Role saved.' };
}

export async function deleteRoleAction(roleId: string): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.ROLES_MANAGE);
    const role = await db.query.adminRoles.findFirst({
      where: eq(t.adminRoles.id, roleId),
      with: { users: { columns: { id: true } } },
    });
    if (!role) return { ok: false, error: 'Role not found.' };
    if (role.isSystem) return { ok: false, error: 'Built-in roles cannot be deleted.' };
    if (role.users.length > 0) {
      return { ok: false, error: 'Move the users on this role to another role first.' };
    }

    await db.delete(t.adminRoles).where(eq(t.adminRoles.id, roleId));
    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'role.delete',
      entity: 'admin_role',
      entityId: roleId,
      summary: `Deleted role “${role.name}”`,
    });

    revalidatePath('/admin/roles');
    return { ok: true, message: 'Role deleted.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not delete the role.',
    };
  }
}

export async function listRolesWithCounts() {
  const roles = await db.query.adminRoles.findMany({
    orderBy: [desc(t.adminRoles.isSystem), t.adminRoles.name],
    with: { permissions: true, users: { columns: { id: true, fullName: true, email: true } } },
  });
  return roles;
}

export async function listAdminUsers() {
  return db.query.adminUsers.findMany({
    orderBy: [desc(t.adminUsers.createdAt)],
    with: { role: true },
  });
}

export async function assignAdminRoleAction(
  adminUserId: string,
  roleId: string,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.ROLES_MANAGE);

    const superAdminRole = await db.query.adminRoles.findFirst({
      where: eq(t.adminRoles.name, 'Super Admin'),
      with: { users: { columns: { id: true } } },
    });

    // Never allow the last Super Admin to be demoted.
    if (
      superAdminRole &&
      superAdminRole.users.length === 1 &&
      superAdminRole.users[0].id === adminUserId &&
      roleId !== superAdminRole.id
    ) {
      return { ok: false, error: 'At least one Super Admin must remain.' };
    }

    await db
      .update(t.adminUsers)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(t.adminUsers.id, adminUserId));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'admin.role_assigned',
      entity: 'admin_user',
      entityId: adminUserId,
    });

    revalidatePath('/admin/roles');
    return { ok: true, message: 'Role updated.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not change the role.',
    };
  }
}

export async function bulkRevokeCustomerSessionsAction(profileIds: string[]): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.CUSTOMERS_MANAGE);
    if (profileIds.length === 0) return { ok: false, error: 'No customers selected.' };

    await db
      .update(t.sessions)
      .set({ revokedAt: new Date() })
      .where(inArray(t.sessions.profileId, profileIds));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'customer.sessions_revoked',
      entity: 'profile',
      summary: `Signed out ${profileIds.length} customers`,
    });

    return { ok: true, message: 'Customers signed out.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not sign the customers out.',
    };
  }
}
