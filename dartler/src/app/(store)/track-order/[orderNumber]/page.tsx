import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { buildTimeline, OrderTimeline, ShipmentCard } from '@/components/store/OrderTimeline';
import { OrderItemsList, OrderStatusBadge } from '@/components/store/OrderSummaryCard';
import { getOrderByNumber } from '@/server/orders';
import { getCustomerSession } from '@/lib/auth/session';
import { readRecentOrderNumbers } from '@/lib/auth/order-access';
import { formatPaiseShort } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Order tracking',
  robots: { index: false, follow: false },
};

export default async function TrackOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, session, recent] = await Promise.all([
    getOrderByNumber(decodeURIComponent(orderNumber)),
    getCustomerSession(),
    readRecentOrderNumbers(),
  ]);

  if (!order) notFound();

  // Reached either by verifying order number + email on the lookup form (which
  // sets nothing but redirects here), by owning the order, or by the recent
  // order cookie. Guests who guess a number see nothing without the lookup.
  const isOwner = Boolean(session && order.profileId === session.profile.id);
  const isRecent = recent.includes(order.orderNumber);
  if (!isOwner && !isRecent) {
    return (
      <div className="container-dartler py-16 text-center">
        <h1 className="font-serif text-2xl text-charcoal-700">Verify this order first</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-charcoal-400">
          For privacy, tracking opens only after we match your order number with the email you
          ordered with.
        </p>
        <Link
          href={`/track-order?order=${order.orderNumber}`}
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-wine-600 px-5 text-sm font-medium text-white hover:bg-wine-700"
        >
          Verify and track
        </Link>
      </div>
    );
  }

  const shipment = order.shipments[0];
  const timeline = buildTimeline({ placedAt: order.placedAt, events: shipment?.events ?? [] });

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Track order', href: '/track-order' },
          { label: order.orderNumber },
        ]}
      />

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-charcoal-700">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-charcoal-400">
            Placed {formatDateTime(order.placedAt)} · {formatPaiseShort(order.totalPaise)}
          </p>
        </div>
        <div className="flex gap-2">
          <OrderStatusBadge status={order.status} />
          {shipment?.awb ? <Badge tone="info">AWB {shipment.awb}</Badge> : null}
        </div>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-4 font-serif text-lg text-charcoal-700">Live tracking</h2>
            <OrderTimeline entries={timeline} />
          </section>

          {shipment ? (
            <ShipmentCard
              shipment={shipment}
              destination={`${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}`}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-taupe-200 bg-ivory-50 p-5 text-sm text-charcoal-400">
              Your order is being packed. Tracking details appear here as soon as the courier picks
              it up.
            </p>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-taupe-100 bg-white p-5">
            <h2 className="mb-2 font-serif text-lg text-charcoal-700">Items</h2>
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
            <h2 className="mb-2 font-serif text-lg text-charcoal-700">Delivering to</h2>
            <address className="text-sm not-italic leading-relaxed text-charcoal-500">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.pincode}
            </address>
            <Link
              href={`/order/${order.orderNumber}`}
              className="mt-3 inline-block text-[13px] font-medium text-wine-700 hover:underline"
            >
              View full order details
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
