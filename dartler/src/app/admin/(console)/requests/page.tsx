import Link from 'next/link';
import { PageHeader } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPagination, AdminTabs } from '@/components/admin/AdminFilters';
import { RequestDecision } from '@/components/admin/RequestDecision';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { listServiceRequests } from '@/server/admin/orders';
import { formatPaiseShort } from '@/lib/money';
import { firstParam, formatDateTime } from '@/lib/utils';
import type { RequestStatusValue, RequestTypeValue } from '@/db/schema';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'info',
} as const;

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin(PERMISSIONS.REQUESTS_VIEW);
  const params = await searchParams;
  const canManage = hasPermission(session.permissions, PERMISSIONS.REQUESTS_MANAGE);

  const page = await listServiceRequests({
    status: (firstParam(params.status) as RequestStatusValue | undefined) ?? 'ALL',
    type: (firstParam(params.type) as RequestTypeValue | undefined) ?? 'ALL',
    page: Number(firstParam(params.page)) || 1,
    perPage: 15,
  });

  return (
    <>
      <PageHeader
        title="Returns & Cancellations"
        description="Approving a request restores stock and starts the refund where money was taken."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <AdminTabs
          paramName="status"
          options={[
            { value: 'ALL', label: 'All' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'COMPLETED', label: 'Completed' },
          ]}
        />
        <AdminTabs
          paramName="type"
          options={[
            { value: 'ALL', label: 'Both types' },
            { value: 'RETURN', label: 'Returns' },
            { value: 'CANCELLATION', label: 'Cancellations' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        {page.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              compact
              title="Nothing in this queue"
              description="Requests raised by customers from their order page appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-taupe-50">
            {page.items.map((request) => (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-charcoal-700">{request.requestNumber}</p>
                    <Badge tone={request.type === 'RETURN' ? 'blush' : 'neutral'}>
                      {request.type}
                    </Badge>
                    <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
                    {request.refundStatus !== 'NOT_APPLICABLE' ? (
                      <Badge tone="info">Refund {request.refundStatus.toLowerCase()}</Badge>
                    ) : null}
                  </div>

                  <p className="mt-1.5 text-[13px] text-charcoal-600">{request.reason}</p>
                  {request.details ? (
                    <p className="mt-1 text-xs text-charcoal-400">{request.details}</p>
                  ) : null}
                  {request.adminNote ? (
                    <p className="mt-1.5 rounded-lg bg-ivory-50 px-3 py-2 text-xs text-charcoal-500">
                      Staff note: {request.adminNote}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-charcoal-300">
                    <Link
                      href={`/admin/orders/${request.order.orderNumber}`}
                      className="font-medium text-wine-700 hover:underline"
                    >
                      {request.order.orderNumber}
                    </Link>
                    {' · '}
                    {request.order.customerName} · {formatPaiseShort(request.order.totalPaise)} ·{' '}
                    {request.order.paymentMethod} · raised {formatDateTime(request.createdAt)}
                  </p>
                </div>

                {canManage && request.status === 'PENDING' ? (
                  <RequestDecision requestId={request.id} requestNumber={request.requestNumber} />
                ) : null}
              </li>
            ))}
          </ul>
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
