import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { calculatePricing, validateCoupon, type CouponRule } from '@/lib/pricing';
import { generateOrderNumber } from '@/lib/ids';
import { getStoreSettings } from './settings';
import { resolveCartLines, type CartLineInput } from './cart';

export class OrderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'EMPTY_CART'
      | 'OUT_OF_STOCK'
      | 'COUPON_INVALID'
      | 'PAYMENT_DISABLED'
      | 'CONFLICT',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

export interface CreateOrderInput {
  lines: CartLineInput[];
  couponCode?: string | null;
  paymentMethod: t.PaymentMethodValue;
  email: string;
  phone: string;
  customerName: string;
  shippingAddress: t.OrderAddress;
  billingAddress: t.OrderAddress;
  customerNote?: string | null;
  profileId?: string | null;
  /** Client-generated key that makes a double submit return the first order. */
  idempotencyKey: string;
  saveAddress?: boolean;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  paymentMethod: t.PaymentMethodValue;
  paymentStatus: t.PaymentStatusValue;
  reused: boolean;
}

/**
 * Creates an order inside one transaction:
 *   1. prices are re-read from the database (never taken from the browser)
 *   2. stock is decremented with a conditional UPDATE, so two racing checkouts
 *      cannot take the same last unit — the second one fails and rolls back
 *   3. the idempotency key is unique, so a refresh or double-click reuses the
 *      order that was already created instead of making a second one
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const settings = await getStoreSettings();

  if (input.paymentMethod === 'COD' && !settings.codEnabled) {
    throw new OrderError('Cash on delivery is currently unavailable.', 'PAYMENT_DISABLED');
  }
  if (input.paymentMethod !== 'COD' && !settings.onlinePaymentEnabled) {
    throw new OrderError('Online payment is currently unavailable.', 'PAYMENT_DISABLED');
  }

  const existing = await db.query.orders.findFirst({
    where: eq(t.orders.idempotencyKey, input.idempotencyKey),
  });
  if (existing) {
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      totalPaise: existing.totalPaise,
      paymentMethod: existing.paymentMethod,
      paymentStatus: existing.paymentStatus,
      reused: true,
    };
  }

  const resolved = (await resolveCartLines(input.lines)).filter(
    (line) => !line.unavailable && line.quantity > 0,
  );
  if (resolved.length === 0) {
    throw new OrderError('Your cart is empty or the items are no longer available.', 'EMPTY_CART');
  }

  const requested = new Map(
    input.lines.map((line) => [`${line.productId}:${line.variantId}`, line.quantity]),
  );
  const shortfalls = resolved.filter((line) => line.quantity < (requested.get(line.key) ?? 0));
  if (shortfalls.length > 0) {
    throw new OrderError(
      'Some items no longer have enough stock. Please review your cart.',
      'OUT_OF_STOCK',
      shortfalls.map((line) => ({ name: line.name, available: line.availableStock })),
    );
  }

  let couponRow: t.Coupon | undefined;
  let couponRule: CouponRule | null = null;
  if (input.couponCode) {
    const subtotal = resolved.reduce((total, line) => total + line.lineTotalPaise, 0);
    couponRow = await db.query.coupons.findFirst({
      where: eq(t.coupons.code, input.couponCode.toUpperCase()),
    });
    if (!couponRow) throw new OrderError('That coupon code is not valid.', 'COUPON_INVALID');
    const check = validateCoupon(couponRow, subtotal);
    if (!check.ok) throw new OrderError(check.reason, 'COUPON_INVALID');
    couponRule = {
      type: couponRow.type,
      value: couponRow.value,
      minOrderPaise: couponRow.minOrderPaise,
      maxDiscountPaise: couponRow.maxDiscountPaise,
    };
  }

  const pricing = calculatePricing(
    resolved.map((line) => ({
      unitPricePaise: line.unitPricePaise,
      quantity: line.quantity,
      taxBps: line.taxBps,
    })),
    {
      freeShippingAbovePaise: settings.freeShippingAbovePaise,
      flatShippingPaise: settings.flatShippingPaise,
    },
    couponRule,
  );

  const orderNumber = generateOrderNumber();
  const paymentStatus: t.PaymentStatusValue = 'PENDING';
  const status: t.OrderStatus = 'PENDING';

  try {
    return await db.transaction(async (tx) => {
      // Conditional decrement: the WHERE clause is the lock. If another order
      // took the stock first, zero rows come back and we abort the whole thing.
      for (const line of resolved) {
        const updated = await tx
          .update(t.inventory)
          .set({ quantity: sql`${t.inventory.quantity} - ${line.quantity}`, updatedAt: new Date() })
          .where(
            and(
              eq(t.inventory.variantId, line.variantId),
              sql`${t.inventory.quantity} >= ${line.quantity}`,
            ),
          )
          .returning({ quantity: t.inventory.quantity });

        if (updated.length === 0) {
          throw new OrderError(
            `“${line.name}” just went out of stock. Please update your cart.`,
            'OUT_OF_STOCK',
          );
        }

        await tx.insert(t.stockMovements).values({
          productId: line.productId,
          variantId: line.variantId,
          delta: -line.quantity,
          balance: updated[0].quantity,
          reason: 'SALE',
          note: `Order ${orderNumber}`,
          actorType: 'SYSTEM',
          actorName: 'Checkout',
        });

        await tx
          .update(t.products)
          .set({ soldCount: sql`${t.products.soldCount} + ${line.quantity}` })
          .where(eq(t.products.id, line.productId));
      }

      const [order] = await tx
        .insert(t.orders)
        .values({
          orderNumber,
          profileId: input.profileId ?? null,
          email: input.email.toLowerCase(),
          phone: input.phone,
          customerName: input.customerName,
          status,
          couponId: couponRow?.id ?? null,
          couponCode: couponRow?.code ?? null,
          subtotalPaise: pricing.subtotalPaise,
          discountPaise: pricing.discountPaise,
          shippingPaise: pricing.shippingPaise,
          taxPaise: pricing.taxPaise,
          totalPaise: pricing.totalPaise,
          paymentMethod: input.paymentMethod,
          paymentStatus,
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress,
          customerNote: input.customerNote ?? null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning({ id: t.orders.id, orderNumber: t.orders.orderNumber });

      await tx.insert(t.orderItems).values(
        resolved.map((line, index) => ({
          orderId: order.id,
          productId: line.productId,
          variantId: line.variantId,
          name: line.name,
          sku: line.sku,
          slug: line.slug,
          variantLabel: line.variantLabel,
          imageUrl: line.imageUrl,
          unitPricePaise: line.unitPricePaise,
          quantity: line.quantity,
          taxBps: line.taxBps,
          taxPaise: pricing.lines[index].taxPaise,
          totalPaise: pricing.lines[index].totalPaise,
        })),
      );

      await tx.insert(t.payments).values({
        orderId: order.id,
        provider: input.paymentMethod === 'COD' ? 'cod' : 'razorpay',
        method: input.paymentMethod,
        status: 'PENDING',
        amountPaise: pricing.totalPaise,
      });

      if (couponRow) {
        await tx
          .update(t.coupons)
          .set({ usedCount: sql`${t.coupons.usedCount} + 1` })
          .where(eq(t.coupons.id, couponRow.id));
      }

      if (input.saveAddress && input.profileId) {
        await tx.insert(t.addresses).values({
          profileId: input.profileId,
          fullName: input.shippingAddress.fullName,
          phone: input.shippingAddress.phone,
          line1: input.shippingAddress.line1,
          line2: input.shippingAddress.line2 ?? null,
          city: input.shippingAddress.city,
          state: input.shippingAddress.state,
          pincode: input.shippingAddress.pincode,
        });
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalPaise: pricing.totalPaise,
        paymentMethod: input.paymentMethod,
        paymentStatus,
        reused: false,
      };
    });
  } catch (error) {
    // A racing duplicate submit hits the unique idempotency index; return the winner.
    if (
      error instanceof Error &&
      /orders_idempotency_key|duplicate key/.test(error.message)
    ) {
      const winner = await db.query.orders.findFirst({
        where: eq(t.orders.idempotencyKey, input.idempotencyKey),
      });
      if (winner) {
        return {
          orderId: winner.id,
          orderNumber: winner.orderNumber,
          totalPaise: winner.totalPaise,
          paymentMethod: winner.paymentMethod,
          paymentStatus: winner.paymentStatus,
          reused: true,
        };
      }
    }
    throw error;
  }
}

/** Puts stock back when an order is cancelled or a return is approved. */
export async function restoreStockForOrder(
  orderId: string,
  reason: t.StockReasonValue,
  note: string,
): Promise<void> {
  const items = await db.query.orderItems.findMany({ where: eq(t.orderItems.orderId, orderId) });

  await db.transaction(async (tx) => {
    for (const item of items) {
      if (!item.variantId || !item.productId) continue;
      const updated = await tx
        .update(t.inventory)
        .set({ quantity: sql`${t.inventory.quantity} + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(t.inventory.variantId, item.variantId))
        .returning({ quantity: t.inventory.quantity });
      if (updated.length === 0) continue;

      await tx.insert(t.stockMovements).values({
        productId: item.productId,
        variantId: item.variantId,
        delta: item.quantity,
        balance: updated[0].quantity,
        reason,
        note,
        orderId,
        actorType: 'SYSTEM',
        actorName: 'Order lifecycle',
      });

      await tx
        .update(t.products)
        .set({ soldCount: sql`greatest(0, ${t.products.soldCount} - ${item.quantity})` })
        .where(eq(t.products.id, item.productId));
    }
  });
}

export const ORDER_STATUS_LABELS: Record<t.OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  FAILED: 'Failed',
};

/** Which status an order can move to next, enforced server-side. */
export const ORDER_STATUS_TRANSITIONS: Record<t.OrderStatus, t.OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
  FAILED: ['PENDING', 'CANCELLED'],
};

export function canCancel(status: t.OrderStatus): boolean {
  return ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(status);
}

export function canReturn(status: t.OrderStatus, deliveredAt: Date | null, windowDays: number): boolean {
  if (status !== 'DELIVERED' || !deliveredAt) return false;
  return Date.now() - deliveredAt.getTime() <= windowDays * 86_400_000;
}

export async function getOrderByNumber(orderNumber: string) {
  return db.query.orders.findFirst({
    where: eq(t.orders.orderNumber, orderNumber),
    with: {
      items: true,
      payments: { orderBy: [desc(t.payments.createdAt)] },
      shipments: {
        orderBy: [desc(t.shipments.createdAt)],
        with: { events: { orderBy: [desc(t.trackingEvents.occurredAt)] } },
      },
      requests: { orderBy: [desc(t.serviceRequests.createdAt)] },
    },
  });
}

export async function getOrderById(orderId: string) {
  return db.query.orders.findFirst({
    where: eq(t.orders.id, orderId),
    with: {
      items: true,
      payments: { orderBy: [desc(t.payments.createdAt)] },
      shipments: {
        orderBy: [desc(t.shipments.createdAt)],
        with: { events: { orderBy: [desc(t.trackingEvents.occurredAt)] } },
      },
      requests: { orderBy: [desc(t.serviceRequests.createdAt)] },
      profile: true,
    },
  });
}

export type OrderWithDetail = NonNullable<Awaited<ReturnType<typeof getOrderById>>>;

export async function listOrdersForProfile(profileId: string) {
  return db.query.orders.findMany({
    where: eq(t.orders.profileId, profileId),
    orderBy: [desc(t.orders.placedAt)],
    with: { items: true, shipments: true },
    limit: 50,
  });
}
