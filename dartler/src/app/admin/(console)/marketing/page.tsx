import { desc } from 'drizzle-orm';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { db } from '@/db';
import * as t from '@/db/schema';
import { formatPaiseShort } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminMarketingPage() {
  await requireAdmin(PERMISSIONS.MARKETING_VIEW);

  const [coupons, subscribers] = await Promise.all([
    db.query.coupons.findMany({ orderBy: [desc(t.coupons.createdAt)] }),
    db.query.auditLogs.findMany({
      where: (log, { eq }) => eq(log.action, 'newsletter.subscribe'),
      orderBy: [desc(t.auditLogs.createdAt)],
      limit: 20,
    }),
  ]);

  return (
    <>
      <PageHeader title="Marketing" description="Coupons and newsletter signups." />

      <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Coupons" bodyClassName="p-0">
          {coupons.length === 0 ? (
            <p className="p-5 text-sm text-charcoal-400">No coupons yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Code</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Discount</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Min order</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-semibold">Used</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Valid until</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-taupe-50 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-mono text-[13px] font-medium text-charcoal-700">
                          {coupon.code}
                        </p>
                        {coupon.description ? (
                          <p className="text-xs text-charcoal-400">{coupon.description}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-charcoal-600">
                        {coupon.type === 'PERCENT'
                          ? `${coupon.value}%${coupon.maxDiscountPaise ? ` (max ${formatPaiseShort(coupon.maxDiscountPaise)})` : ''}`
                          : formatPaiseShort(coupon.value)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-charcoal-600">
                        {formatPaiseShort(coupon.minOrderPaise)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-charcoal-600">
                        {coupon.usedCount}
                        {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}
                      </td>
                      <td className="px-5 py-3 text-xs text-charcoal-400">
                        {coupon.endsAt ? formatDate(coupon.endsAt) : 'No expiry'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={coupon.isActive ? 'success' : 'neutral'}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Recent newsletter signups">
          {subscribers.length === 0 ? (
            <p className="text-sm text-charcoal-400">No signups yet.</p>
          ) : (
            <ul className="space-y-2 text-[13px]">
              {subscribers.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-charcoal-600">{entry.entityId}</span>
                  <span className="shrink-0 text-xs text-charcoal-300">
                    {formatDate(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
