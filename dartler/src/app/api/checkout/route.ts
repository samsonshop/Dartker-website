import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { checkoutSchema } from '@/lib/validation/checkout';
import { createOrder, OrderError } from '@/server/orders';
import { getCustomerSession } from '@/lib/auth/session';
import { createRazorpayOrder, PaymentConfigError } from '@/server/payments/razorpay';
import { recordAudit } from '@/lib/audit';
import { publicEnv } from '@/lib/env';
import {
  appendRecentOrderNumber,
  readRecentOrderNumbers,
  RECENT_ORDERS_COOKIE,
  recentOrdersCookieOptions,
} from '@/lib/auth/order-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the details you entered.',
        fieldErrors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const session = await getCustomerSession();

  try {
    const result = await createOrder({
      lines: input.lines,
      couponCode: input.couponCode ?? null,
      paymentMethod: input.paymentMethod,
      email: session?.profile.email ?? input.email,
      phone: input.shippingAddress.phone,
      customerName: input.shippingAddress.fullName,
      shippingAddress: { ...input.shippingAddress, line2: input.shippingAddress.line2 ?? null },
      billingAddress: {
        ...(input.billingSameAsShipping ? input.shippingAddress : (input.billingAddress ?? input.shippingAddress)),
        line2:
          (input.billingSameAsShipping
            ? input.shippingAddress.line2
            : (input.billingAddress?.line2 ?? input.shippingAddress.line2)) ?? null,
      },
      customerNote: input.customerNote ?? null,
      profileId: session?.profile.id ?? null,
      idempotencyKey: input.idempotencyKey,
      saveAddress: input.saveAddress,
    });

    // Cash on delivery needs no gateway round-trip: confirm it straight away.
    if (input.paymentMethod === 'COD') {
      if (!result.reused) {
        await db
          .update(t.orders)
          .set({ status: 'CONFIRMED', confirmedAt: new Date() })
          .where(eq(t.orders.id, result.orderId));
        await recordAudit({
          actorType: session ? 'CUSTOMER' : 'SYSTEM',
          actorId: session?.profile.id ?? null,
          actorName: input.shippingAddress.fullName,
          action: 'order.create',
          entity: 'order',
          entityId: result.orderId,
          summary: `Order ${result.orderNumber} placed (COD)`,
          metadata: { totalPaise: result.totalPaise },
        });
      }
      const response = NextResponse.json({
        status: 'confirmed',
        orderNumber: result.orderNumber,
        redirectTo: `/order/${result.orderNumber}`,
      });
      response.cookies.set(
        RECENT_ORDERS_COOKIE,
        appendRecentOrderNumber(await readRecentOrderNumbers(), result.orderNumber),
        recentOrdersCookieOptions,
      );
      return response;
    }

    // Online payment: create the gateway order server-side and hand the client
    // only the public key and the gateway order id.
    const razorpayOrder = await createRazorpayOrder({
      amountPaise: result.totalPaise,
      receipt: result.orderNumber,
      notes: { orderId: result.orderId, orderNumber: result.orderNumber },
    });

    await db
      .update(t.payments)
      .set({ providerOrderId: razorpayOrder.id, updatedAt: new Date() })
      .where(eq(t.payments.orderId, result.orderId));

    const response = NextResponse.json({
      status: 'payment_required',
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      amountPaise: result.totalPaise,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: publicEnv.razorpayKeyId,
    });
    response.cookies.set(
      RECENT_ORDERS_COOKIE,
      appendRecentOrderNumber(await readRecentOrderNumbers(), result.orderNumber),
      recentOrdersCookieOptions,
    );
    return response;
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      return NextResponse.json({ error: error.message, code: 'PAYMENT_DISABLED' }, { status: 503 });
    }
    if (error instanceof OrderError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.code === 'OUT_OF_STOCK' ? 409 : 400 },
      );
    }
    console.error('[checkout]', error);
    return NextResponse.json(
      { error: 'We could not place your order. Please try again.' },
      { status: 500 },
    );
  }
}
