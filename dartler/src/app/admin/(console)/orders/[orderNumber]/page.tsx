import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Badge } from '@/components/ui/Badge';
import {
  OrderItemsList,
  OrderTotals,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
} from '@/components/store/OrderSummaryCard';
import { buildTimeline, OrderTimeline } from '@/components/store/OrderTimeline';
import {
  OrderNoteForm,
  OrderStatusForm,
  ShipmentActions,
} from '@/components/admin/OrderDetailPanels';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getAdminOrder, getOrderAuditTrail } from '@/server/admin/orders';
import { ORDER_STATUS_TRANSITIONS } from '@/server/orders';
import { getShippingProvider } from '@/server/shipping/delhivery';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const session = await requireAdmin(PERMISSIONS.ORDERS_VIEW);
  const { orderNumber } = await params;

  const order = await getAdminOrder(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const audit = await getOrderAuditTrail(order.id);
  const canManage = hasPermission(session.permissions, PERMISSIONS.ORDERS_MANAGE);
  const canShip = hasPermission(session.permissions, PERMISSIONS.SHIPPING_MANAGE);
  const provider = getShippingProvider();

  const shipment = order.shipments[0];
  const payment = order.payments[0];
  const timeline = buildTimeline({ placedAt: order.placedAt, events: shipment?.events ?? [] });

  return (
    <>
      <Breadcrumbs
        className="mb-3"
        items={[{ label: 'Orders', href: '/admin/orders' }, { label: order.orderNumber }]}
      />

      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.placedAt)} · ${order.items.length} line item${
          order.items.length === 1 ? '' : 's'
        }`}
        actions={
          <>
            <Badge tone={ORDER_STATUS_TONE[order.status]} dot>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
            <Badge tone={PAYMENT_STATUS_TONE[order.paymentStatus]}>
              {order.paymentMethod} · {order.paymentStatus.toLowerCase().replaceAll('_', ' ')}
            </Badge>
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Panel title="Items">
            <OrderItemsList
              items={order.items.map((item) => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
                variantLabel: item.variantLabel,
                imageUrl: item.imageUrl,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                totalPaise: item.totalPaise,
              }))}
            />
            <div className="mt-4 border-t border-taupe-100 pt-4">
              <OrderTotals order={order} />
            </div>
          </Panel>

          <Panel title="Delivery timeline">
            <OrderTimeline entries={timeline} />
          </Panel>

          {order.requests.length > 0 ? (
            <Panel title="Return & cancellation requests">
              <ul className="space-y-2.5">
                {order.requests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-taupe-100 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-charcoal-700">
                        {request.requestNumber} · {request.type}
                      </p>
                      <p className="text-xs text-charcoal-400">{request.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          request.status === 'APPROVED'
                            ? 'success'
                            : request.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {request.status}
                      </Badge>
                      <Link
                        href="/admin/requests"
                        className="text-xs font-medium text-wine-700 hover:underline"
                      >
                        Review
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Activity log" description="Every status change, note and shipment action">
            {audit.length === 0 ? (
              <p className="text-sm text-charcoal-400">No recorded activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-taupe-300" />
                    <div>
                      <p className="text-charcoal-700">{entry.summary ?? entry.action}</p>
                      <p className="text-xs text-charcoal-300">
                        {formatDateTime(entry.createdAt)} · {entry.actorName ?? 'System'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Customer">
            <p className="text-sm font-medium text-charcoal-700">{order.customerName}</p>
            <p className="text-[13px] text-charcoal-400">{order.email}</p>
            <p className="text-[13px] text-charcoal-400">{order.phone}</p>
            {order.profile ? (
              <Link
                href={`/admin/customers/${order.profile.id}`}
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-wine-700 hover:underline"
              >
                View customer
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <p className="mt-2 text-xs text-charcoal-300">Guest checkout</p>
            )}

            <h3 className="mt-4 text-[13px] font-medium text-charcoal-600">Shipping address</h3>
            <address className="mt-1 text-[13px] not-italic leading-relaxed text-charcoal-500">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? (
                <>
                  <br />
                  {order.shippingAddress.line2}
                </>
              ) : null}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.pincode}
            </address>

            {order.customerNote ? (
              <>
                <h3 className="mt-4 text-[13px] font-medium text-charcoal-600">Customer note</h3>
                <p className="mt-1 text-[13px] text-charcoal-500">{order.customerNote}</p>
              </>
            ) : null}
          </Panel>

          {canManage ? (
            <Panel title="Update status">
              <OrderStatusForm
                orderId={order.id}
                currentStatus={order.status}
                allowedStatuses={ORDER_STATUS_TRANSITIONS[order.status]}
                labels={ORDER_STATUS_LABEL}
              />
            </Panel>
          ) : null}

          <Panel title="Shipment">
            {shipment ? (
              <dl className="mb-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">Courier</dt>
                  <dd className="text-charcoal-700">{shipment.courier}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">AWB</dt>
                  <dd className="font-mono text-xs text-charcoal-700">{shipment.awb}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">Status</dt>
                  <dd className="text-charcoal-700">{shipment.status.replaceAll('_', ' ')}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">Last synced</dt>
                  <dd className="text-charcoal-700">
                    {shipment.lastSyncedAt ? formatDateTime(shipment.lastSyncedAt) : 'Never'}
                  </dd>
                </div>
                {shipment.lastError ? (
                  <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">
                    {shipment.lastError}
                  </p>
                ) : null}
              </dl>
            ) : null}

            {canShip ? (
              <ShipmentActions
                orderId={order.id}
                shipmentId={shipment?.id ?? null}
                canCreate={['CONFIRMED', 'PROCESSING'].includes(order.status)}
                providerIsMock={provider.isMock}
              />
            ) : (
              <p className="text-[13px] text-charcoal-400">
                You do not have permission to manage shipments.
              </p>
            )}
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-charcoal-400">Method</dt>
                <dd className="text-charcoal-700">{order.paymentMethod}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-charcoal-400">Status</dt>
                <dd className="text-charcoal-700">
                  {order.paymentStatus.toLowerCase().replaceAll('_', ' ')}
                </dd>
              </div>
              {payment?.providerPaymentId ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">Payment id</dt>
                  <dd className="font-mono text-xs text-charcoal-700">{payment.providerPaymentId}</dd>
                </div>
              ) : null}
              {payment?.failureReason ? (
                <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">
                  {payment.failureReason}
                </p>
              ) : null}
            </dl>
          </Panel>

          {canManage ? (
            <Panel title="Internal note">
              <OrderNoteForm orderId={order.id} initialNote={order.internalNote} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
