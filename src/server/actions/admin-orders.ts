'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAdminApi } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { ORDER_STATUS_TRANSITIONS, restoreStockForOrder } from '@/server/orders';
import type { ActionState } from './admin-products';

export type { ActionState };

const statusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURNED',
    'FAILED',
  ]),
  note: z.string().trim().max(400).optional(),
});

export async function updateOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.ORDERS_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const parsed = statusSchema.safeParse({
    orderId: formData.get('orderId'),
    status: formData.get('status'),
    note: formData.get('note') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: 'Choose a valid status.' };

  const { orderId, status, note } = parsed.data;
  const order = await db.query.orders.findFirst({ where: eq(t.orders.id, orderId) });
  if (!order) return { ok: false, error: 'Order not found.' };

  // The allowed transitions are enforced here, not just hidden in the dropdown.
  if (!ORDER_STATUS_TRANSITIONS[order.status].includes(status)) {
    return {
      ok: false,
      error: `An order that is ${order.status.toLowerCase()} cannot move to ${status.toLowerCase()}.`,
    };
  }

  const now = new Date();
  const patch: Partial<typeof t.orders.$inferInsert> = { status, updatedAt: now };
  if (status === 'CONFIRMED' && !order.confirmedAt) patch.confirmedAt = now;
  if (status === 'DELIVERED') {
    patch.deliveredAt = now;
    // Cash on delivery is collected at the door — that is when it is paid.
    if (order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING') {
      patch.paymentStatus = 'PAID';
    }
  }
  if (status === 'CANCELLED') patch.cancelledAt = now;

  await db.update(t.orders).set(patch).where(eq(t.orders.id, orderId));

  if (status === 'DELIVERED' && order.paymentMethod === 'COD') {
    await db
      .update(t.payments)
      .set({ status: 'PAID', updatedAt: now })
      .where(eq(t.payments.orderId, orderId));
  }

  // Cancelling or returning puts the units back into stock.
  if (status === 'CANCELLED' || status === 'RETURNED') {
    await restoreStockForOrder(
      orderId,
      status === 'CANCELLED' ? 'SALE_REVERSAL' : 'RETURN',
      `Order ${order.orderNumber} ${status.toLowerCase()}`,
    );
  }

  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: 'order.status',
    entity: 'order',
    entityId: orderId,
    summary: `${order.status} → ${status}`,
    metadata: { note, orderNumber: order.orderNumber },
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${order.orderNumber}`);
  return { ok: true, message: `Order marked ${status.toLowerCase().replaceAll('_', ' ')}.` };
}

export async function addOrderNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.ORDERS_MANAGE);
    const orderId = z.string().uuid().parse(formData.get('orderId'));
    const note = z.string().trim().max(1000).parse(formData.get('internalNote') ?? '');

    const order = await db.query.orders.findFirst({ where: eq(t.orders.id, orderId) });
    if (!order) return { ok: false, error: 'Order not found.' };

    await db
      .update(t.orders)
      .set({ internalNote: note || null, updatedAt: new Date() })
      .where(eq(t.orders.id, orderId));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'order.note',
      entity: 'order',
      entityId: orderId,
      summary: 'Updated the internal note',
    });

    revalidatePath(`/admin/orders/${order.orderNumber}`);
    return { ok: true, message: 'Note saved.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not save the note.',
    };
  }
}

export async function setCustomerStatusAction(
  profileId: string,
  status: t.AccountStatusValue,
): Promise<ActionState> {
  try {
    const session = await requireAdminApi(PERMISSIONS.CUSTOMERS_MANAGE);
    const profile = await db.query.profiles.findFirst({
      where: eq(t.profiles.id, profileId),
      columns: { id: true, fullName: true },
    });
    if (!profile) return { ok: false, error: 'Customer not found.' };

    await db
      .update(t.profiles)
      .set({ status, updatedAt: new Date() })
      .where(eq(t.profiles.id, profileId));

    // Blocking an account also ends its sessions immediately.
    if (status === 'BLOCKED') {
      await db
        .update(t.sessions)
        .set({ revokedAt: new Date() })
        .where(eq(t.sessions.profileId, profileId));
    }

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'customer.status',
      entity: 'profile',
      entityId: profileId,
      summary: `Set ${profile.fullName} to ${status}`,
    });

    revalidatePath('/admin/customers');
    revalidatePath(`/admin/customers/${profileId}`);
    return { ok: true, message: `Customer marked ${status.toLowerCase()}.` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.message : 'Could not update the customer.',
    };
  }
}

const requestDecisionSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED', 'COMPLETED']),
  adminNote: z.string().trim().max(500).optional(),
});

export async function decideServiceRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.REQUESTS_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const parsed = requestDecisionSchema.safeParse({
    requestId: formData.get('requestId'),
    decision: formData.get('decision'),
    adminNote: formData.get('adminNote') ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: 'Choose approve or reject.' };

  const { requestId, decision, adminNote } = parsed.data;
  const request = await db.query.serviceRequests.findFirst({
    where: eq(t.serviceRequests.id, requestId),
    with: { order: true },
  });
  if (!request) return { ok: false, error: 'Request not found.' };
  if (request.status !== 'PENDING' && decision !== 'COMPLETED') {
    return { ok: false, error: 'This request has already been decided.' };
  }

  const now = new Date();
  await db
    .update(t.serviceRequests)
    .set({
      status: decision,
      adminNote: adminNote || request.adminNote,
      resolvedAt: now,
      refundStatus:
        decision === 'APPROVED'
          ? request.order.paymentMethod === 'COD'
            ? 'NOT_APPLICABLE'
            : 'PENDING'
          : decision === 'COMPLETED'
            ? 'COMPLETED'
            : 'NOT_APPLICABLE',
      refundPaise: decision === 'REJECTED' ? 0 : request.order.totalPaise,
      updatedAt: now,
    })
    .where(eq(t.serviceRequests.id, requestId));

  if (decision === 'APPROVED') {
    const nextOrderStatus: t.OrderStatus =
      request.type === 'CANCELLATION' ? 'CANCELLED' : 'RETURNED';
    if (ORDER_STATUS_TRANSITIONS[request.order.status].includes(nextOrderStatus)) {
      await db
        .update(t.orders)
        .set({
          status: nextOrderStatus,
          cancelledAt: nextOrderStatus === 'CANCELLED' ? now : request.order.cancelledAt,
          updatedAt: now,
        })
        .where(eq(t.orders.id, request.orderId));

      await restoreStockForOrder(
        request.orderId,
        request.type === 'CANCELLATION' ? 'SALE_REVERSAL' : 'RETURN',
        `${request.requestNumber} approved`,
      );
    }
  }

  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: `request.${decision.toLowerCase()}`,
    entity: 'service_request',
    entityId: requestId,
    summary: `${request.requestNumber} ${decision.toLowerCase()}`,
    metadata: { orderNumber: request.order.orderNumber, adminNote },
  });

  revalidatePath('/admin/requests');
  revalidatePath(`/admin/orders/${request.order.orderNumber}`);
  return { ok: true, message: `Request ${decision.toLowerCase()}.` };
}
