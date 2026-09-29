import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/store/OrderSummaryCard';
import { requireCustomer } from '@/lib/auth/guards';
import { listOrdersForProfile } from '@/server/orders';
import { formatPaiseShort } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'My orders', robots: { index: false, follow: false } };

export default async function AccountOrdersPage() {
  const session = await requireCustomer('/account/orders');
  const orders = await listOrdersForProfile(session.profile.id);

  return (
    <section>
      <h1 className="mb-4 font-serif text-xl text-charcoal-700">My orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No orders yet"
          description="Once you place an order it will appear here, with live tracking."
          action={<ButtonLink href="/category">Start shopping</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-taupe-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-taupe-50 pb-3">
                <div>
                  <Link
                    href={`/order/${order.orderNumber}`}
                    className="text-sm font-medium text-charcoal-700 hover:text-wine-700"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-charcoal-400">
                    Placed {formatDate(order.placedAt)} · {formatPaiseShort(order.totalPaise)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <Link
                    href={`/order/${order.orderNumber}`}
                    className="text-[13px] font-medium text-wine-700 hover:underline"
                  >
                    View details
                  </Link>
                </div>
              </div>

              <ul className="mt-3 flex flex-wrap gap-3">
                {order.items.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-ivory-200">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                      ) : null}
                    </div>
                    <span className="text-xs text-charcoal-500">
                      {item.name}
                      <span className="block text-charcoal-300">× {item.quantity}</span>
                    </span>
                  </li>
                ))}
                {order.items.length > 5 ? (
                  <li className="self-center text-xs text-charcoal-300">
                    +{order.items.length - 5} more
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
