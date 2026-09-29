'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAdminApi } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { getShippingProvider } from '@/server/shipping/delhivery';
import { ShippingError } from '@/server/shipping/types';
import { getStoreSettings } from '@/server/settings';
import {
  appendRecentOrderNumber,
  readRecentOrderNumbers,
  RECENT_ORDERS_COOKIE,
  recentOrdersCookieOptions,
} from '@/lib/auth/order-access';
import type { ActionState } from './admin-products';

export type { ActionState };

/** Maps a courier shipment state onto the customer-facing order status. */
function orderStatusFor(status: t.ShipmentStatusValue): t.OrderStatus | null {
  switch (status) {
    case 'MANIFESTED':
    case 'PICKED_UP':
    case 'IN_TRANSIT':
      return 'SHIPPED';
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'RTO':
      return 'RETURNED';
    default:
      return null;
  }
}

export async function createShipmentAction(orderId: string): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.SHIPPING_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const order = await db.query.orders.findFirst({
    where: eq(t.orders.id, orderId),
    with: { items: true, shipments: true },
  });
  if (!order) return { ok: false, error: 'Order not found.' };
  if (order.shipments.length > 0) {
    return { ok: false, error: 'This order already has a shipment.' };
  }
  if (!['CONFIRMED', 'PROCESSING'].includes(order.status)) {
    return {
      ok: false,
      error: 'Only confirmed or processing orders can be shipped.',
    };
  }

  const settings = await getStoreSettings();
  const provider = getShippingProvider();

  try {
    const result = await provider.createShipment({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      email: order.email,
      address: {
        line1: order.shippingAddress.line1,
        line2: order.shippingAddress.line2,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
        country: order.shippingAddress.country,
      },
      paymentMode: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      codAmountPaise: order.paymentMethod === 'COD' ? order.totalPaise : 0,
      declaredValuePaise: order.totalPaise,
      weightGrams: Math.max(
        100,
        order.items.reduce((total, item) => total + item.quantity * 200, 0),
      ),
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
      })),
      pickupName: settings.pickupName,
    });

    const [shipment] = await db
      .insert(t.shipments)
      .values({
        orderId: order.id,
        provider: provider.isMock ? 'delhivery-mock' : 'delhivery',
        awb: result.awb,
        courier: result.courier,
        status: result.status,
        pickupLocation: settings.pickupName,
        estimatedDelivery: result.estimatedDelivery,
        shippedAt: new Date(),
        labelUrl: result.labelUrl,
        lastSyncedAt: new Date(),
        rawPayload: result.raw as Record<string, unknown>,
      })
      .returning({ id: t.shipments.id });

    await db.insert(t.trackingEvents).values({
      shipmentId: shipment.id,
      status: result.status,
      label: 'Shipment created',
      location: settings.pickupName,
      occurredAt: new Date(),
    });

    await db
      .update(t.orders)
      .set({ status: 'SHIPPED', updatedAt: new Date() })
      .where(eq(t.orders.id, order.id));

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'shipment.create',
      entity: 'order',
      entityId: order.id,
      summary: `Shipment ${result.awb} created for ${order.orderNumber}`,
      metadata: { awb: result.awb, provider: provider.name },
    });

    revalidatePath('/admin/shipping');
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    return { ok: true, message: `Shipment created. AWB ${result.awb}.` };
  } catch (error) {
    const message =
      error instanceof ShippingError
        ? error.message
        : 'The courier could not be reached. Please retry.';
    console.error('[createShipment]', error instanceof Error ? error.message : error);

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'shipment.create_failed',
      entity: 'order',
      entityId: order.id,
      summary: message,
    });

    return { ok: false, error: message };
  }
}

export async function syncShipmentAction(shipmentId: string): Promise<ActionState> {
  let session;
  try {
    session = await requireAdminApi(PERMISSIONS.SHIPPING_MANAGE);
  } catch (error) {
    return { ok: false, error: error instanceof ApiError ? error.message : 'Not authorised.' };
  }

  const shipment = await db.query.shipments.findFirst({
    where: eq(t.shipments.id, shipmentId),
    with: { order: true },
  });
  if (!shipment?.awb) return { ok: false, error: 'This shipment has no AWB yet.' };

  const provider = getShippingProvider();

  try {
    const tracking = await provider.track(shipment.awb);

    for (const event of tracking.events) {
      await db
        .insert(t.trackingEvents)
        .values({
          shipmentId: shipment.id,
          status: event.status,
          label: event.label,
          location: event.location,
          occurredAt: event.occurredAt,
        })
        .onConflictDoNothing();
    }

    await db
      .update(t.shipments)
      .set({
        status: tracking.status,
        deliveredAt: tracking.deliveredAt,
        estimatedDelivery: tracking.estimatedDelivery ?? shipment.estimatedDelivery,
        lastSyncedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(t.shipments.id, shipment.id));

    const nextOrderStatus = orderStatusFor(tracking.status);
    if (nextOrderStatus && nextOrderStatus !== shipment.order.status) {
      await db
        .update(t.orders)
        .set({
          status: nextOrderStatus,
          deliveredAt: nextOrderStatus === 'DELIVERED' ? (tracking.deliveredAt ?? new Date()) : null,
          paymentStatus:
            nextOrderStatus === 'DELIVERED' && shipment.order.paymentMethod === 'COD'
              ? 'PAID'
              : shipment.order.paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(t.orders.id, shipment.orderId));
    }

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'shipment.sync',
      entity: 'order',
      entityId: shipment.orderId,
      summary: `Tracking synced — ${tracking.status}`,
    });

    revalidatePath('/admin/shipping');
    revalidatePath(`/admin/orders/${shipment.order.orderNumber}`);
    return { ok: true, message: `Tracking updated: ${tracking.status.replaceAll('_', ' ')}.` };
  } catch (error) {
    const message =
      error instanceof ShippingError ? error.message : 'Could not reach the courier for tracking.';
    await db
      .update(t.shipments)
      .set({ lastError: message, lastSyncedAt: new Date() })
      .where(eq(t.shipments.id, shipment.id));
    return { ok: false, error: message };
  }
}

export async function checkPincodeAction(
  _prev: { ok: boolean; message?: string; serviceable?: boolean },
  formData: FormData,
): Promise<{ ok: boolean; message?: string; serviceable?: boolean }> {
  const parsed = z
    .string()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode')
    .safeParse(String(formData.get('pincode') ?? '').trim());

  if (!parsed.success) return { ok: false, message: 'Enter a valid 6-digit pincode.' };

  try {
    const result = await getShippingProvider().checkServiceability(parsed.data);
    return {
      ok: true,
      serviceable: result.serviceable,
      message: result.serviceable
        ? `Serviceable${result.city ? ` — ${result.city}` : ''}. ${
            result.cashOnDelivery ? 'COD available.' : 'Prepaid only.'
          }${result.estimatedDays ? ` Estimated delivery in ${result.estimatedDays} days.` : ''}`
        : (result.message ?? 'We do not deliver to this pincode yet.'),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ShippingError ? error.message : 'Could not check this pincode.',
    };
  }
}

/** Public tracking lookup used by the storefront Track Order page. */
export async function trackPublicOrderAction(
  _prev: { ok: boolean; error?: string; redirectTo?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; redirectTo?: string }> {
  const orderNumber = String(formData.get('orderNumber') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (!orderNumber || !email) {
    return { ok: false, error: 'Enter both the order number and the email used to order.' };
  }

  const order = await db.query.orders.findFirst({
    where: eq(t.orders.orderNumber, orderNumber.toUpperCase()),
    columns: { id: true, email: true, orderNumber: true },
  });

  // One generic message either way, so this cannot be used to test order numbers.
  if (!order || order.email.toLowerCase() !== email) {
    return { ok: false, error: 'We could not find an order with those details.' };
  }

  // Verifying the email is what grants access — the tracking page reads this
  // cookie rather than trusting the order number in the URL.
  const jar = await cookies();
  jar.set(
    RECENT_ORDERS_COOKIE,
    appendRecentOrderNumber(await readRecentOrderNumbers(), order.orderNumber),
    recentOrdersCookieOptions,
  );

  return { ok: true, redirectTo: `/track-order/${order.orderNumber}` };
}

export async function getLatestShipmentForOrder(orderId: string) {
  return db.query.shipments.findFirst({
    where: eq(t.shipments.orderId, orderId),
    orderBy: [desc(t.shipments.createdAt)],
    with: { events: { orderBy: [desc(t.trackingEvents.occurredAt)] } },
  });
}
