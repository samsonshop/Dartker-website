import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { requireCustomer } from '@/lib/auth/guards';
import { db } from '@/db';
import * as t from '@/db/schema';
import { formatPaiseShort } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Returns & cancellations',
  robots: { index: false, follow: false },
};

const STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'info',
} as const;

export default async function AccountRequestsPage() {
  const session = await requireCustomer('/account/requests');

  const requests = await db.query.serviceRequests.findMany({
    where: eq(t.serviceRequests.profileId, session.profile.id),
    orderBy: [desc(t.serviceRequests.createdAt)],
    with: { order: { columns: { orderNumber: true, totalPaise: true } } },
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-xl text-charcoal-700">Returns & cancellations</h1>
        <ButtonLink href="/account/requests/new" size="sm">
          New request
        </ButtonLink>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<RotateCcw className="h-6 w-6" />}
          title="No requests yet"
          description="If something is not right with an order, raise a return or cancellation and we will look at it the same day."
          action={<ButtonLink href="/account/requests/new">Raise a request</ButtonLink>}
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-taupe-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-charcoal-700">
                    {request.requestNumber}
                    <Badge tone={request.type === 'RETURN' ? 'blush' : 'neutral'}>
                      {request.type}
                    </Badge>
                    <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-charcoal-400">
                    <Link
                      href={`/order/${request.order.orderNumber}`}
                      className="font-medium text-wine-700 hover:underline"
                    >
                      {request.order.orderNumber}
                    </Link>
                    {' · '}
                    {formatPaiseShort(request.order.totalPaise)} · raised{' '}
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
                {request.refundStatus !== 'NOT_APPLICABLE' ? (
                  <Badge tone="info">Refund {request.refundStatus.toLowerCase()}</Badge>
                ) : null}
              </div>

              <p className="mt-2.5 text-[13px] text-charcoal-600">{request.reason}</p>
              {request.details ? (
                <p className="mt-1 text-xs text-charcoal-400">{request.details}</p>
              ) : null}
              {request.adminNote ? (
                <p className="mt-2 rounded-lg bg-ivory-50 px-3 py-2 text-xs text-charcoal-600">
                  Dartler: {request.adminNote}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
