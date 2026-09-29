import { Download, IndianRupee, Receipt, ShoppingCart } from 'lucide-react';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { StatTile } from '@/components/admin/StatTile';
import { RangePicker } from '@/components/admin/RangePicker';
import { CategoryBarChart } from '@/components/admin/Charts';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getDashboardKpis, getRevenueByCategory, rangeForDays } from '@/server/analytics';
import { formatPaiseCompact, formatPaiseShort } from '@/lib/money';
import { formatDate, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const REPORTS = [
  { type: 'sales', label: 'Sales report', description: 'Every order with totals, tax and shipping.' },
  { type: 'orders', label: 'Order report', description: 'The same rows, filtered by the selected period.' },
  { type: 'products', label: 'Product report', description: 'Units and revenue by product.' },
  { type: 'categories', label: 'Category report', description: 'Revenue split across collections.' },
  { type: 'inventory', label: 'Inventory report', description: 'Stock on hand and value per variant.' },
  { type: 'customers', label: 'Customer report', description: 'Lifetime orders and spend per customer.' },
];

function parseRange(value: string | undefined): number {
  const days = Number(value);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireAdmin(PERMISSIONS.REPORTS_VIEW);
  const params = await searchParams;
  const days = parseRange(params.range);
  const range = rangeForDays(days);

  const [kpis, byCategory] = await Promise.all([
    getDashboardKpis(range),
    getRevenueByCategory(range),
  ]);

  const canExport = hasPermission(session.permissions, PERMISSIONS.REPORTS_EXPORT);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
        actions={<RangePicker value={String(days)} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Total Revenue"
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
          label="Avg. Order Value"
          value={formatPaiseShort(kpis.averageOrderValue.current)}
          changePercent={kpis.averageOrderValue.changePercent}
          Icon={Receipt}
        />
      </div>

      <div className="mt-5">
        <Panel title="Revenue by Category">
          <CategoryBarChart
            data={byCategory.slice(0, 8).map((row) => ({ name: row.name, value: row.revenue }))}
          />
        </Panel>
      </div>

      <div className="mt-5">
        <Panel
          title="Export"
          description={
            canExport
              ? 'CSV opens directly in Excel, Google Sheets or Tally import tools.'
              : 'Your role can view reports but not export them.'
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REPORTS.map((report) => (
              <li key={report.type} className="rounded-xl border border-taupe-100 p-4">
                <p className="text-sm font-medium text-charcoal-700">{report.label}</p>
                <p className="mt-1 text-xs text-charcoal-400">{report.description}</p>
                {canExport ? (
                  <a
                    href={`/api/admin/reports?type=${report.type}&range=${days}`}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-taupe-200 px-3 text-[13px] font-medium text-charcoal-600 transition-colors hover:border-wine-300 hover:text-wine-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download CSV
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
