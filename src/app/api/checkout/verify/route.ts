import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { verifyPaymentSchema } from '@/lib/validation/checkout';
import { verifyPaymentSignature } from '@/server/payments/razorpay';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * An order is marked paid *only* here, after the gateway signature verifies
 * server-side. A browser "success" callback on its own never changes state.
 */
export async function POST(request: Request) {
  const parsed = verifyPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payment confirmation.' }, { status: 400 });
  }

  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const order = await db.query.orders.findFirst({ where: eq(t.orders.id, orderId) });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  // Already settled (webhook or a repeated callback) — succeed idempotently.
  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({ status: 'paid', orderNumber: order.orderNumber });
  }

  const payment = await db.query.payments.findFirst({
    where: and(eq(t.payments.orderId, orderId), eq(t.payments.providerOrderId, razorpayOrderId)),
  });
  if (!payment) {
    return NextResponse.json({ error: 'Payment record not found for this order.' }, { status: 404 });
  }

  const valid = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature: razorpaySignature });

  if (!valid) {
    await db
      .update(t.payments)
      .set({
        status: 'FAILED',
        failureReason: 'Signature verification failed',
        updatedAt: new Date(),
      })
      .where(eq(t.payments.id, payment.id));
    await db
      .update(t.orders)
      .set({ paymentStatus: 'FAILED', status: 'FAILED', updatedAt: new Date() })
      .where(eq(t.orders.id, orderId));

    await recordAudit({
      actorType: 'SYSTEM',
      action: 'payment.signature_invalid',
      entity: 'order',
      entityId: orderId,
      summary: `Rejected an unverified payment callback for ${order.orderNumber}`,
    });

    return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(t.payments)
      .set({
        status: 'PAID',
        providerPaymentId: razorpayPaymentId,
        updatedAt: new Date(),
      })
      .where(eq(t.payments.id, payment.id));

    await tx
      .update(t.orders)
      .set({
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(t.orders.id, orderId));
  });

  await recordAudit({
    actorType: 'SYSTEM',
    action: 'payment.verified',
    entity: 'order',
    entityId: orderId,
    summary: `Payment verified for ${order.orderNumber}`,
    metadata: { amountPaise: payment.amountPaise },
  });

  return NextResponse.json({
    status: 'paid',
    orderNumber: order.orderNumber,
    redirectTo: `/order/${order.orderNumber}`,
  });
}
