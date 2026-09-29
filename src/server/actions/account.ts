'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireCustomerApi } from '@/lib/auth/guards';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import { revokeAllSessions } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';
import { addressSchema } from '@/lib/validation/checkout';
import { generateRequestNumber } from '@/lib/ids';
import { canCancel, canReturn } from '@/server/orders';
import { getStoreSettings } from '@/server/settings';

export interface AccountState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  marketingOptIn: z.boolean(),
});

export async function updateProfileAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  let session;
  try {
    session = await requireCustomerApi();
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Please sign in.' };
  }

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    marketingOptIn: formData.get('marketingOptIn') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  await db
    .update(t.profiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(t.profiles.id, session.profile.id));

  revalidatePath('/account');
  return { ok: true, message: 'Profile updated.' };
}

export async function changeCustomerPasswordAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  let session;
  try {
    session = await requireCustomerApi();
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Please sign in.' };
  }

  const schema = z
    .object({
      current: z.string().min(1, 'Enter your current password'),
      next: z
        .string()
        .min(8, 'Use at least 8 characters')
        .max(72)
        .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
          message: 'Include a letter and a number',
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

  const valid = await verifyPassword(parsed.data.current, session.profile.passwordHash);
  if (!valid) return { ok: false, error: 'Your current password is incorrect.' };

  await db
    .update(t.profiles)
    .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(t.profiles.id, session.profile.id));

  await revokeAllSessions('CUSTOMER', session.profile.id, session.sessionId);

  revalidatePath('/account');
  return { ok: true, message: 'Password changed. Other devices have been signed out.' };
}

export async function saveAddressAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  let session;
  try {
    session = await requireCustomerApi();
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Please sign in.' };
  }

  const addressId = String(formData.get('addressId') ?? '') || null;
  const parsed = addressSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    line1: formData.get('line1'),
    line2: formData.get('line2') || null,
    city: formData.get('city'),
    state: formData.get('state'),
    pincode: formData.get('pincode'),
    country: 'India',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: 'Please correct the highlighted fields.', fieldErrors };
  }

  const makeDefault = formData.get('isDefault') === 'on';
  const values = {
    profileId: session.profile.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    line1: parsed.data.line1,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city,
    state: parsed.data.state,
    pincode: parsed.data.pincode,
    isDefault: makeDefault,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    if (makeDefault) {
      await tx
        .update(t.addresses)
        .set({ isDefault: false })
        .where(eq(t.addresses.profileId, session.profile.id));
    }

    if (addressId) {
      // The profile id in the WHERE clause is what stops one customer editing another's address.
      await tx
        .update(t.addresses)
        .set(values)
        .where(and(eq(t.addresses.id, addressId), eq(t.addresses.profileId, session.profile.id)));
    } else {
      await tx.insert(t.addresses).values(values);
    }
  });

  revalidatePath('/account/addresses');
  return { ok: true, message: addressId ? 'Address updated.' : 'Address saved.' };
}

export async function deleteAddressAction(addressId: string): Promise<AccountState> {
  try {
    const session = await requireCustomerApi();
    await db
      .delete(t.addresses)
      .where(and(eq(t.addresses.id, addressId), eq(t.addresses.profileId, session.profile.id)));
    revalidatePath('/account/addresses');
    return { ok: true, message: 'Address removed.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not remove the address.',
    };
  }
}

const requestSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  type: z.enum(['RETURN', 'CANCELLATION']),
  reason: z.string().trim().min(3, 'Choose a reason').max(120),
  details: z.string().trim().max(600).optional(),
});

export async function createServiceRequestAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  let session;
  try {
    session = await requireCustomerApi();
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Please sign in.' };
  }

  const parsed = requestSchema.safeParse({
    orderNumber: formData.get('orderNumber'),
    type: formData.get('type'),
    reason: formData.get('reason'),
    details: formData.get('details') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  }

  const order = await db.query.orders.findFirst({
    where: eq(t.orders.orderNumber, parsed.data.orderNumber),
    with: { requests: true },
  });

  // The order must belong to the signed-in customer — never trust the number alone.
  if (!order || order.profileId !== session.profile.id) {
    return { ok: false, error: 'We could not find that order on your account.' };
  }

  if (order.requests.some((request) => request.status === 'PENDING')) {
    return { ok: false, error: 'There is already an open request for this order.' };
  }

  const settings = await getStoreSettings();
  const eligible =
    parsed.data.type === 'CANCELLATION'
      ? canCancel(order.status)
      : canReturn(order.status, order.deliveredAt, settings.returnWindowDays);

  if (!eligible) {
    return {
      ok: false,
      error:
        parsed.data.type === 'CANCELLATION'
          ? 'This order has already been dispatched and can no longer be cancelled.'
          : `Returns are open for ${settings.returnWindowDays} days after delivery, and this order is outside that window.`,
    };
  }

  await db.insert(t.serviceRequests).values({
    requestNumber: generateRequestNumber(parsed.data.type),
    type: parsed.data.type,
    orderId: order.id,
    profileId: session.profile.id,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });

  await recordAudit({
    actorType: 'CUSTOMER',
    actorId: session.profile.id,
    actorName: session.profile.fullName,
    action: `request.${parsed.data.type.toLowerCase()}`,
    entity: 'order',
    entityId: order.id,
    summary: `Customer requested a ${parsed.data.type.toLowerCase()} for ${order.orderNumber}`,
  });

  revalidatePath('/account/requests');
  revalidatePath(`/order/${order.orderNumber}`);
  return {
    ok: true,
    message: 'Request submitted. We will email you as soon as it is reviewed.',
  };
}
