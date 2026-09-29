import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/admin/StatTile';
import { CustomerStatusControl } from '@/components/admin/CustomerStatusControl';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/components/store/OrderSummaryCard';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getAdminCustomer } from '@/server/admin/orders';
import { formatPaiseShort } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdmin(PERMISSIONS.CUSTOMERS_VIEW);
  const { id } = await params;

  const customer = await getAdminCustomer(id);
  if (!customer) notFound();

  const validOrders = customer.orders.filter(
    (order) => !['CANCELLED', 'FAILED'].includes(order.status),
  );
  const totalSpent = validOrders.reduce((sum, order) => sum + order.totalPaise, 0);
  const averageOrder = validOrders.length ? Math.round(totalSpent / validOrders.length) : 0;
  const canManage = hasPermission(session.permissions, PERMISSIONS.CUSTOMERS_MANAGE);

  return (
    <>
      <Breadcrumbs
        className="mb-3"
        items={[{ label: 'Customers', href: '/admin/customers' }, { label: customer.fullName }]}
      />

      <PageHeader
        title={customer.fullName}
        description={`${customer.email} · joined ${formatDate(customer.createdAt)}`}
        actions={
          canManage ? (
            <CustomerStatusControl profileId={customer.id} status={customer.status} />
          ) : (
            <Badge tone={customer.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {customer.status}
            </Badge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders" value={String(validOrders.length)} />
        <StatTile label="Total spent" value={formatPaiseShort(totalSpent)} />
        <StatTile label="Average order" value={formatPaiseShort(averageOrder)} />
        <StatTile
          label="Last seen"
          value={customer.lastLoginAt ? formatDate(customer.lastLoginAt) : 'Never'}
        />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Order history" bodyClassName="p-0">
          {customer.orders.length === 0 ? (
            <p className="p-5 text-sm text-charcoal-400">This customer has not ordered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Order</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Items</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Amount</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id} className="border-b border-taupe-50 last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="font-medium text-wine-700 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-charcoal-600">
                        {order.items.reduce((total, item) => total + item.quantity, 0)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-charcoal-700">
                        {formatPaiseShort(order.totalPaise)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={ORDER_STATUS_TONE[order.status]}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-charcoal-400">
                        {formatDateTime(order.placedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Contact">
            <dl className="space-y-2 text-[13px]">
              <div>
                <dt className="text-charcoal-400">Email</dt>
                <dd className="text-charcoal-700">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-charcoal-400">Phone</dt>
                <dd className="text-charcoal-700">{customer.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-charcoal-400">Marketing</dt>
                <dd className="text-charcoal-700">
                  {customer.marketingOptIn ? 'Subscribed' : 'Not subscribed'}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title={`Addresses (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-charcoal-400">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-xl border border-taupe-100 p-3.5">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-charcoal-700">
                      {address.fullName}
                      {address.isDefault ? <Badge tone="blush">Default</Badge> : null}
                    </p>
                    <address className="mt-1 text-[13px] not-italic leading-relaxed text-charcoal-500">
                      {address.line1}
                      {address.line2 ? (
                        <>
                          <br />
                          {address.line2}
                        </>
                      ) : null}
                      <br />
                      {address.city}, {address.state} {address.pincode}
                      <br />
                      {address.phone}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
