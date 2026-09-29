import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AdminPagination,
  AdminSearchInput,
  AdminSelect,
} from '@/components/admin/AdminFilters';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { listAdminCustomers } from '@/server/admin/orders';
import { formatPaiseShort } from '@/lib/money';
import { firstParam, formatDate, initials } from '@/lib/utils';
import type { AccountStatusValue } from '@/db/schema';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  BLOCKED: 'danger',
} as const;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin(PERMISSIONS.CUSTOMERS_VIEW);
  const params = await searchParams;

  const page = await listAdminCustomers({
    search: firstParam(params.q),
    status: (firstParam(params.status) as AccountStatusValue | undefined) ?? 'ALL',
    page: Number(firstParam(params.page)) || 1,
    perPage: 12,
  });

  return (
    <>
      <PageHeader title="Customers" description={`${page.total} registered customers`} />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px]">
        <AdminSearchInput placeholder="Search name, email or phone…" />
        <AdminSelect
          paramName="status"
          label="Account status"
          allLabel="All statuses"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
            { value: 'BLOCKED', label: 'Blocked' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        {page.items.length === 0 ? (
          <div className="p-6">
            <EmptyState compact title="No customers match this search" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">City</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Total spent</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Last order</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((customer) => (
                  <tr key={customer.id} className="border-b border-taupe-50 last:border-0 hover:bg-ivory-50/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="flex items-center gap-2.5 font-medium text-charcoal-700 hover:text-wine-700"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-100 text-[11px] font-semibold text-wine-700">
                          {initials(customer.fullName)}
                        </span>
                        {customer.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-charcoal-600">{customer.email}</p>
                      <p className="text-xs text-charcoal-300">{customer.phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-charcoal-500">{customer.city ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal-700">
                      {customer.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal-700">
                      {formatPaiseShort(customer.totalSpentPaise)}
                    </td>
                    <td className="px-4 py-3 text-xs text-charcoal-400">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[customer.status]}>{customer.status}</Badge>
                    </td>
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
