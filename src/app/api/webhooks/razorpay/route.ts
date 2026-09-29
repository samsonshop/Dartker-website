import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { verifyWebhookSignature } from '@/server/payments/razorpay';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Gateway-to-server confirmation. This is the authority when the customer
 * closes the tab mid-payment: the browser callback may never arrive, but the
 * webhook still settles the order.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const rawBody = await request.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const providerOrderId = typeof entity?.order_id === 'string' ? entity.order_id : null;
  const providerPaymentId = typeof entity?.id === 'string' ? entity.id : null;
  if (!providerOrderId) return NextResponse.json({ received: true });

  const payment = await db.query.payments.findFirst({
    where: eq(t.payments.providerOrderId, providerOrderId),
  });
  if (!payment) return NextResponse.json({ received: true });

  const captured = event.event === 'payment.captured' || event.event === 'order.paid';
  const failed = event.event === 'payment.failed';

  if (captured) {
    await db.transaction(async (tx) => {
      await tx
        .update(t.payments)
        .set({
          status: 'PAID',
          providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
          rawPayload: entity ?? null,
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
        .where(eq(t.orders.id, payment.orderId));
    });
  } else if (failed) {
    await db
      .update(t.payments)
      .set({
        status: 'FAILED',
        failureReason:
          typeof entity?.error_description === 'string' ? entity.error_description : 'Payment failed',
        rawPayload: entity ?? null,
        updatedAt: new Date(),
      })
      .where(eq(t.payments.id, payment.id));
    await db
      .update(t.orders)
      .set({ paymentStatus: 'FAILED', updatedAt: new Date() })
      .where(eq(t.orders.id, payment.orderId));
  }

  await recordAudit({
    actorType: 'SYSTEM',
    action: `webhook.${event.event ?? 'unknown'}`,
    entity: 'order',
    entityId: payment.orderId,
    summary: `Razorpay webhook ${event.event ?? 'unknown'}`,
  });

  return NextResponse.json({ received: true });
}
