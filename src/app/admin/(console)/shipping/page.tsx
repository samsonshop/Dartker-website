import Link from 'next/link';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { AdminPagination, AdminSearchInput, AdminSelect } from '@/components/admin/AdminFilters';
import {
  AwaitingShipmentList,
  PincodeChecker,
  SyncShipmentButton,
  TrackOrderLookupPanel,
} from '@/components/admin/ShippingPanels';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { listOrdersAwaitingShipment, listShipments } from '@/server/admin/orders';
import { getShippingProvider } from '@/server/shipping/delhivery';
import { firstParam, formatDate, formatDateTime } from '@/lib/utils';
import type { ShipmentStatusValue } from '@/db/schema';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<ShipmentStatusValue, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  MANIFESTED: 'info',
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'info',
  DELIVERED: 'success',
  EXCEPTION: 'danger',
  RTO: 'danger',
  CANCELLED: 'neutral',
};

export default async function AdminShippingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin(PERMISSIONS.SHIPPING_VIEW);
  const params = await searchParams;
  const provider = getShippingProvider();
  const canManage = hasPermission(session.permissions, PERMISSIONS.SHIPPING_MANAGE);

  const [awaiting, page] = await Promise.all([
    listOrdersAwaitingShipment(10),
    listShipments({
      status: (firstParam(params.status) as ShipmentStatusValue | undefined) ?? 'ALL',
      search: firstParam(params.q),
      page: Number(firstParam(params.page)) || 1,
      perPage: 12,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Shipping & Delivery"
        description={`Courier: ${provider.name}${provider.isMock ? ' — add DELHIVERY_API_TOKEN and set DELHIVERY_USE_MOCK=false to go live' : ''}`}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {canManage ? (
            <Panel
              title="Awaiting shipment"
              description="Confirmed and processing orders that have no shipment yet"
            >
              <AwaitingShipmentList
                orders={awaiting.map((order) => ({
                  id: order.id,
                  orderNumber: order.orderNumber,
                  customerName: order.customerName,
                  totalPaise: order.totalPaise,
                  placedAt: order.placedAt,
                  city: order.city,
                  pincode: order.pincode,
                }))}
              />
            </Panel>
          ) : null}

          <Panel title="Shipments" bodyClassName="p-0">
            <div className="grid gap-2 border-b border-taupe-100 p-4 sm:grid-cols-[1fr_200px]">
              <AdminSearchInput placeholder="Search AWB or order number…" />
              <AdminSelect
                paramName="status"
                label="Shipment status"
                allLabel="All statuses"
                options={Object.keys(STATUS_TONE).map((value) => ({
                  value,
                  label: value.replaceAll('_', ' ').toLowerCase(),
                }))}
              />
            </div>

            {page.items.length === 0 ? (
              <p className="p-5 text-sm text-charcoal-400">No shipments match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">AWB</th>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">Order</th>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">Destination</th>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">ETA</th>
                      <th scope="col" className="px-4 py-2.5 text-left font-semibold">Last sync</th>
                      {canManage ? (
                        <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((shipment) => (
                      <tr key={shipment.id} className="border-b border-taupe-50 last:border-0">
                        <td className="px-4 py-2.5 font-mono text-xs text-charcoal-600">
                          {shipment.awb ?? '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/orders/${shipment.orderNumber}`}
                            className="font-medium text-wine-700 hover:underline"
                          >
                            {shipment.orderNumber}
                          </Link>
                          <p className="text-xs text-charcoal-300">{shipment.customerName}</p>
                        </td>
                        <td className="px-4 py-2.5 text-charcoal-600">
                          {shipment.city} {shipment.pincode}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={STATUS_TONE[shipment.status]}>
                            {shipment.status.replaceAll('_', ' ').toLowerCase()}
                          </Badge>
                          {shipment.lastError ? (
                            <p className="mt-1 text-xs text-danger-600">{shipment.lastError}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-charcoal-400">
                          {shipment.estimatedDelivery ? formatDate(shipment.estimatedDelivery) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-charcoal-400">
                          {shipment.lastSyncedAt ? formatDateTime(shipment.lastSyncedAt) : 'Never'}
                        </td>
                        {canManage ? (
                          <td className="px-4 py-2.5 text-right">
                            <SyncShipmentButton shipmentId={shipment.id} />
                          </td>
                        ) : null}
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
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Pincode serviceability">
            <PincodeChecker />
          </Panel>
          <Panel title="Customer tracking">
            <TrackOrderLookupPanel />
          </Panel>
        </div>
      </div>
    </>
  );
}
