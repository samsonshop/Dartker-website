import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, RotateCcw, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import {
  OrderItemsList,
  OrderStatusBadge,
  OrderTotals,
  PAYMENT_STATUS_TONE,
} from '@/components/store/OrderSummaryCard';
import {
  buildTimeline,
  OrderTimeline,
  ShipmentCard,
} from '@/components/store/OrderTimeline';
import { getOrderByNumber, canCancel, canReturn } from '@/server/orders';
import { getCustomerSession } from '@/lib/auth/session';
import { readRecentOrderNumbers } from '@/lib/auth/order-access';
import { getStoreSettings } from '@/server/settings';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, session, recent, settings] = await Promise.all([
    getOrderByNumber(decodeURIComponent(orderNumber)),
    getCustomerSession(),
    readRecentOrderNumbers(),
    getStoreSettings(),
  ]);

  if (!order) notFound();

  // Access rule: the signed-in owner, or this browser's own recent order cookie.
  const isOwner = Boolean(session && order.profileId === session.profile.id);
  const isRecentGuest = recent.includes(order.orderNumber);
  if (!isOwner && !isRecentGuest) notFound();

  const shipment = order.shipments[0];
  const timeline = buildTimeline({
    placedAt: order.placedAt,
    events: shipment?.events ?? [],
  });

  const justPlaced = Date.now() - order.placedAt.getTime() < 10 * 60_000;
  const openRequest = order.requests.find((request) => request.status === 'PENDING');
  const cancellable = canCancel(order.status) && !openRequest;
  const returnable = canReturn(order.status, order.deliveredAt, settings.returnWindowDays) && !openRequest;

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          ...(isOwner ? [{ label: 'My orders', href: '/account/orders' }] : []),
          { label: order.orderNumber },
        ]}
      />

      {justPlaced ? (
        <section className="mt-5 rounded-2xl border border-taupe-100 bg-white p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-500">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-serif text-3xl text-charcoal-700">Thank you!</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            Your order has been placed successfully. Order{' '}
            <span className="font-medium text-charcoal-700">{order.orderNumber}</span>
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <ButtonLink href={`/track-order?order=${order.orderNumber}`} variant="outline">
              <Truck className="h-4 w-4" />
              Track your order
            </ButtonLink>
            <ButtonLink href="/category">Continue shopping</ButtonLink>
          </div>
        </section>
      ) : (
        <header className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-charcoal-700">Order {order.orderNumber}</h1>
            <p className="mt-1 text-sm text-charcoal-400">Placed on {formatDateTime(order.placedAt)}</p>
          </div>
          <div className="flex gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>
              Payment {order.paymentStatus.toLowerCase().replaceAll('_', ' ')}
            </Badge>
          </div>
        </header>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-1 font-serif text-lg text-charcoal-700">Items</h2>
            <OrderItemsList
              items={order.items.map((item) => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
                variantLabel: item.variantLabel,
                imageUrl: item.imageUrl,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                totalPaise: item.totalPaise,
              }))}
            />
          </section>

          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-4 font-serif text-lg text-charcoal-700">Delivery status</h2>
            <OrderTimeline entries={timeline} />
          </section>

          {shipment ? (
            <ShipmentCard
              shipment={shipment}
              destination={`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`}
            />
          ) : null}

          {order.requests.length > 0 ? (
            <section className="rounded-2xl border border-taupe-100 bg-white p-5">
              <h2 className="mb-3 font-serif text-lg text-charcoal-700">Requests</h2>
              <ul className="space-y-3">
                {order.requests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-taupe-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-charcoal-700">
                        {request.type === 'RETURN' ? 'Return' : 'Cancellation'} ·{' '}
                        {request.requestNumber}
                      </p>
                      <p className="text-xs text-charcoal-400">{request.reason}</p>
                    </div>
                    <Badge
                      tone={
                        request.status === 'APPROVED'
                          ? 'success'
                          : request.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {request.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-3 font-serif text-lg text-charcoal-700">Order summary</h2>
            <OrderTotals order={order} />
            <p className="mt-3 border-t border-taupe-100 pt-3 text-xs text-charcoal-400">
              Paid by {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
            </p>
          </section>

          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-2 font-serif text-lg text-charcoal-700">Shipping address</h2>
            <address className="text-sm not-italic leading-relaxed text-charcoal-500">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              ) : null}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.pincode}
              <br />
              {order.shippingAddress.phone}
            </address>
          </section>

          {cancellable || returnable ? (
            <section className="rounded-2xl border border-taupe-100 bg-white p-5">
              <h2 className="mb-2 font-serif text-lg text-charcoal-700">Need a change?</h2>
              <p className="text-xs text-charcoal-400">
                {returnable
                  ? `Returns are open for ${settings.returnWindowDays} days after delivery.`
                  : 'You can cancel while the order is still being prepared.'}
              </p>
              <ButtonLink
                href={`/account/requests/new?order=${order.orderNumber}&type=${returnable ? 'RETURN' : 'CANCELLATION'}`}
                variant="outline"
                fullWidth
                className="mt-3"
              >
                <RotateCcw className="h-4 w-4" />
                Request {returnable ? 'a return' : 'cancellation'}
              </ButtonLink>
            </section>
          ) : null}

          <p className="text-center text-xs text-charcoal-300">
            Questions about this order?{' '}
            <Link href="/contact" className="underline">
              Contact support
            </Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
