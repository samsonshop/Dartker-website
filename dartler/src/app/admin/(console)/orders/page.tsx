import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AdminPagination,
  AdminSearchInput,
  AdminSelect,
  AdminTabs,
} from '@/components/admin/AdminFilters';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
} from '@/components/store/OrderSummaryCard';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { getOrderStatusTabCounts, listAdminOrders } from '@/server/admin/orders';
import { formatPaiseShort } from '@/lib/money';
import { firstParam, formatDate } from '@/lib/utils';
import type { OrderStatus, PaymentStatusValue } from '@/db/schema';

export const dynamic = 'force-dynamic';

const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin(PERMISSIONS.ORDERS_VIEW);
  const params = await searchParams;

  const statusParam = firstParam(params.status) as OrderStatus | undefined;
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : 'ALL';
  const paymentParam = firstParam(params.payment) as PaymentStatusValue | undefined;

  const days = Number(firstParam(params.days));
  const from = [7, 30, 90].includes(days) ? new Date(Date.now() - days * 86_400_000) : undefined;

  const [counts, page] = await Promise.all([
    getOrderStatusTabCounts(),
    listAdminOrders({
      search: firstParam(params.q),
      status,
      paymentStatus: paymentParam ?? 'ALL',
      from,
      page: Number(firstParam(params.page)) || 1,
      perPage: 12,
    }),
  ]);

  return (
    <>
      <PageHeader title="Orders" description={`${counts.all} orders all time`} />

      <div className="mb-4 flex flex-col gap-3">
        <AdminTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All', count: counts.all },
            ...STATUSES.map((value) => ({
              value,
              label: ORDER_STATUS_LABEL[value],
              count: counts.byStatus.get(value) ?? 0,
            })),
          ]}
        />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <AdminSearchInput
            placeholder="Search order ID, customer, email or phone…"
            className="lg:col-span-2"
          />
          <AdminSelect
            paramName="payment"
            label="Payment status"
            allLabel="Any payment status"
            options={[
              { value: 'PENDING', label: 'Payment pending' },
              { value: 'PAID', label: 'Paid' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REFUNDED', label: 'Refunded' },
            ]}
          />
          <AdminSelect
            paramName="days"
            label="Date range"
            allLabel="All time"
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        {page.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              compact
              title="No orders match these filters"
              description="Try a different status tab or clear the search."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Order ID</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Items</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Payment</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">AWB</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((order) => (
                  <tr key={order.id} className="border-b border-taupe-50 last:border-0 hover:bg-ivory-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-medium text-wine-700 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-charcoal-700">{order.customerName}</p>
                      <p className="text-xs text-charcoal-300">{order.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal-600">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal-700">
                      {formatPaiseShort(order.totalPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>
                        {order.paymentMethod === 'COD' ? 'COD' : order.paymentMethod} ·{' '}
                        {order.paymentStatus.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={ORDER_STATUS_TONE[order.status]}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-charcoal-400">
                      {order.awb ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-charcoal-400">{formatDate(order.placedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination
          page={page.page}
          totalPages={page.totalPages}
          total={page.total}
          perPage={page.perPage}
        />
      </div>
    </>
  );
}
