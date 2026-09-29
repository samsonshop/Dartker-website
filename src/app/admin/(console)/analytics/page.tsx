import Image from 'next/image';
import { IndianRupee, Percent, Receipt, ShoppingCart } from 'lucide-react';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { CategoryBarChart, RevenueDonut, RevenueTrendChart } from '@/components/admin/Charts';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getDashboardKpis,
  getOrderStatusCounts,
  getProductPerformance,
  getRevenueByCategory,
  getSalesTrend,
  rangeForDays,
  type Granularity,
} from '@/server/analytics';
import { formatPaiseCompact, formatPaiseShort } from '@/lib/money';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function parseRange(value: string | undefined): number {
  const days = Number(value);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin(PERMISSIONS.ANALYTICS_VIEW);
  const params = await searchParams;
  const days = parseRange(params.range);
  const range = rangeForDays(days);
  const granularity: Granularity = days <= 30 ? 'day' : days <= 90 ? 'week' : 'month';

  const [kpis, trend, byCategory, best, worst, statuses] = await Promise.all([
    getDashboardKpis(range),
    getSalesTrend(range, granularity),
    getRevenueByCategory(range),
    getProductPerformance(range, 'top', 6),
    getProductPerformance(range, 'bottom', 6),
    getOrderStatusCounts(range),
  ]);

  const totalCategoryRevenue = byCategory.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <>
      <PageHeader
        title="Sales & Analytics"
        description="Every figure is computed server-side from order data."
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
          label="Average Order Value"
          value={formatPaiseShort(kpis.averageOrderValue.current)}
          changePercent={kpis.averageOrderValue.changePercent}
          Icon={Receipt}
        />
        <StatTile
          label="Conversion Rate"
          value={kpis.conversionUnavailable ? '—' : `${kpis.conversionRate.current.toFixed(2)}%`}
          changePercent={kpis.conversionUnavailable ? null : kpis.conversionRate.changePercent}
          Icon={Percent}
          hint={
            kpis.conversionUnavailable
              ? 'No visitor data in this period'
              : `${formatNumber(kpis.visitors)} unique visitors`
          }
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Sales Trend">
          <RevenueTrendChart data={trend} height={260} />
        </Panel>
        <Panel title="Revenue by Category">
          <RevenueDonut
            data={byCategory.map((row) => ({ name: row.name, value: row.revenue, share: row.share }))}
            total={totalCategoryRevenue}
          />
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Revenue by category" description="Top collections in this period">
          <CategoryBarChart
            data={byCategory.slice(0, 8).map((row) => ({ name: row.name, value: row.revenue }))}
          />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Best Selling Products" bodyClassName="p-0">
          <PerformanceTable rows={best} emptyMessage="No sales in this period." />
        </Panel>
        <Panel title="Worst Performing Products" bodyClassName="p-0">
          <PerformanceTable rows={worst} emptyMessage="No sales in this period." />
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="Orders by status">
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {statuses.map((row) => (
              <li key={row.status} className="rounded-xl border border-taupe-100 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-charcoal-400">
                  {row.status.replaceAll('_', ' ').toLowerCase()}
                </p>
                <p className="mt-1 font-serif text-xl text-charcoal-700">{formatNumber(row.total)}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function PerformanceTable({
  rows,
  emptyMessage,
}: {
  rows: { productId: string | null; name: string; imageUrl: string | null; units: number; revenue: number }[];
  emptyMessage: string;
}) {
  if (rows.length === 0) return <p className="p-5 text-sm text-charcoal-400">{emptyMessage}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
            <th scope="col" className="px-5 py-2.5 text-left font-semibold">Product</th>
            <th scope="col" className="px-5 py-2.5 text-right font-semibold">Units</th>
            <th scope="col" className="px-5 py-2.5 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.productId ?? row.name} className="border-b border-taupe-50 last:border-0">
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                    {row.imageUrl ? (
                      <Image src={row.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                    ) : null}
                  </div>
                  <span className="truncate text-charcoal-700">{row.name}</span>
                </div>
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-charcoal-600">{row.units}</td>
              <td className="px-5 py-2.5 text-right tabular-nums text-charcoal-700">
                {formatPaiseShort(row.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
