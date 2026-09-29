import type { Metadata } from 'next';
import { ServiceRequestForm } from '@/components/store/AccountForms';
import { requireCustomer } from '@/lib/auth/guards';
import { canCancel, canReturn, listOrdersForProfile } from '@/server/orders';
import { getStoreSettings } from '@/server/settings';
import { formatPaiseShort } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'New return or cancellation',
  robots: { index: false, follow: false },
};

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; type?: string }>;
}) {
  const session = await requireCustomer('/account/requests/new');
  const [orders, settings, params] = await Promise.all([
    listOrdersForProfile(session.profile.id),
    getStoreSettings(),
    searchParams,
  ]);

  const eligible = orders
    .map((order) => ({
      orderNumber: order.orderNumber,
      label: `${order.orderNumber} — ${formatPaiseShort(order.totalPaise)} · ${formatDate(order.placedAt)}`,
      canCancel: canCancel(order.status),
      canReturn: canReturn(order.status, order.deliveredAt, settings.returnWindowDays),
      hasOpenRequest: false,
    }))
    .filter((order) => order.canCancel || order.canReturn);

  const requestedType = params.type === 'CANCELLATION' ? 'CANCELLATION' : 'RETURN';

  return (
    <section className="rounded-2xl border border-taupe-100 bg-white p-5">
      <h1 className="font-serif text-xl text-charcoal-700">Raise a request</h1>
      <p className="mt-1 text-sm text-charcoal-400">
        Cancellations are possible until an order is dispatched. Returns stay open for{' '}
        {settings.returnWindowDays} days after delivery.
      </p>

      <div className="mt-5 max-w-lg">
        <ServiceRequestForm
          orders={eligible}
          defaultOrderNumber={params.order}
          defaultType={requestedType}
        />
      </div>
    </section>
  );
}
