import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IndianRupee, Percent, ShoppingCart, Users } from 'lucide-react';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { CategoryBarChart, RevenueDonut, RevenueTrendChart } from '@/components/admin/Charts';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '@/components/store/OrderSummaryCard';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getDashboardKpis,
  getProductPerformance,
  getRecentOrders,
  getRevenueByCategory,
  getSalesTrend,
  rangeForDays,
  type Granularity,
} from '@/server/analytics';
import { formatPaiseCompact, formatPaiseShort } from '@/lib/money';
import { formatDate, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function parseRange(value: string | undefined): number {
  const days = Number(value);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdmin(PERMISSIONS.DASHBOARD_VIEW);
  const params = await searchParams;
  const days = parseRange(params.range);
  const range = rangeForDays(days);
  const granularity: Granularity = days <= 30 ? 'day' : days <= 90 ? 'week' : 'month';

  const [kpis, trend, byCategory, recentOrders, topProducts] = await Promise.all([
    getDashboardKpis(range),
    getSalesTrend(range, granularity),
    getRevenueByCategory(range),
    getRecentOrders(6),
    getProductPerformance(range, 'top', 5),
  ]);

  const totalCategoryRevenue = byCategory.reduce((sum, row) => sum + row.revenue, 0);
  const firstName = session.user.fullName.split(' ')[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${firstName}. Here’s what’s happening with your store.`}
        actions={<RangePicker value={String(days)} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Sales"
          value={formatPaiseCompact(kpis.totalSales.current)}
          changePercent={kpis.totalSales.changePercent}
          Icon={IndianRupee}
        />
        <StatTile
          label="Total Orders"
          value={formatNumber(kpis.totalOrders.current)}
          changePercent={kpis.totalOrders.changePercent}
          Icon={ShoppingCart}
        />
        <StatTile
          label="Total Customers"
          value={formatNumber(kpis.totalCustomersAllTime)}
          changePercent={kpis.totalCustomers.changePercent}
          Icon={Users}
          hint={`${formatNumber(kpis.totalCustomers.current)} new this period`}
        />
        <StatTile
          label="Conversion Rate"
          value={
            kpis.conversionUnavailable ? '—' : `${kpis.conversionRate.current.toFixed(2)}%`
          }
          changePercent={kpis.conversionUnavailable ? null : kpis.conversionRate.changePercent}
          Icon={Percent}
          hint={
            kpis.conversionUnavailable
              ? 'No visitor data in this period'
              : `${formatNumber(kpis.visitors)} visitors`
          }
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Sales Overview"
          description={`Revenue by ${granularity}, ${formatDate(range.from)} – ${formatDate(range.to)}`}
        >
          <Suspense fallback={<Skeleton className="h-56 w-full" />}>
            <RevenueTrendChart data={trend} />
          </Suspense>
        </Panel>

        <Panel title="Revenue by Category">
          <RevenueDonut
            data={byCategory.map((row) => ({ name: row.name, value: row.revenue, share: row.share }))}
            total={totalCategoryRevenue}
          />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Recent Orders"
          actions={
            <Link href="/admin/orders" className="text-[13px] font-medium text-wine-700 hover:underline">
              View all
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Order ID</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Customer</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Status</th>
                  <th scope="col" className="px-5 py-2.5 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-taupe-50 last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-medium text-wine-700 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-charcoal-600">{order.customerName}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-charcoal-700">
                      {formatPaiseShort(order.totalPaise)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ORDER_STATUS_TONE[order.status]}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-charcoal-400">{formatDate(order.placedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Top Selling Products"
          actions={
            <Link href="/admin/analytics" className="text-[13px] font-medium text-wine-700 hover:underline">
              View all
            </Link>
          }
        >
          {topProducts.length === 0 ? (
            <p className="text-sm text-charcoal-400">No sales in this period.</p>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((product) => (
                <li key={product.productId ?? product.name} className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {product.slug ? (
                      <Link
                        href={`/product/${product.slug}`}
                        className="block truncate text-[13px] text-charcoal-700 hover:text-wine-700"
                      >
                        {product.name}
                      </Link>
                    ) : (
                      <p className="truncate text-[13px] text-charcoal-700">{product.name}</p>
                    )}
                    <p className="text-xs text-charcoal-400">{product.units} sold</p>
                  </div>
                  <p className="text-[13px] font-medium tabular-nums text-charcoal-700">
                    {formatPaiseCompact(product.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Category performance" description="Revenue contribution across collections">
          <CategoryBarChart
            data={byCategory.slice(0, 8).map((row) => ({ name: row.name, value: row.revenue }))}
          />
        </Panel>
      </div>
    </>
  );
}
