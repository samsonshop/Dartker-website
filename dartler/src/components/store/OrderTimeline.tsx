import { Check, Circle, MapPin, PackageCheck, Truck } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { ShipmentStatusValue } from '@/db/schema';

export interface TimelineEntry {
  status: ShipmentStatusValue | 'PLACED';
  label: string;
  description?: string | null;
  location?: string | null;
  occurredAt: Date | null;
  done: boolean;
}

/**
 * Builds the customer-facing timeline from real tracking events, filling in the
 * stages that have not happened yet so the path ahead is still visible.
 */
export function buildTimeline(input: {
  placedAt: Date;
  events: { status: ShipmentStatusValue; label: string; location: string | null; occurredAt: Date }[];
}): TimelineEntry[] {
  const stages: { status: ShipmentStatusValue | 'PLACED'; label: string }[] = [
    { status: 'PLACED', label: 'Order placed' },
    { status: 'MANIFESTED', label: 'Dispatched' },
    { status: 'IN_TRANSIT', label: 'In transit' },
    { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
    { status: 'DELIVERED', label: 'Delivered' },
  ];

  const byStatus = new Map(input.events.map((event) => [event.status, event]));
  // Pickup and manifest both mean "it has left us".
  const dispatched = byStatus.get('MANIFESTED') ?? byStatus.get('PICKED_UP');

  const reachedIndex = stages.reduce((furthest, stage, index) => {
    if (stage.status === 'PLACED') return index;
    const match = stage.status === 'MANIFESTED' ? dispatched : byStatus.get(stage.status);
    return match ? index : furthest;
  }, 0);

  return stages.map((stage, index) => {
    const match =
      stage.status === 'PLACED'
        ? { occurredAt: input.placedAt, location: null, label: stage.label }
        : stage.status === 'MANIFESTED'
          ? dispatched
          : byStatus.get(stage.status);

    return {
      status: stage.status,
      label: stage.label,
      location: match?.location ?? null,
      occurredAt: match?.occurredAt ?? null,
      done: index <= reachedIndex,
    };
  });
}

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-5 pl-7">
      <span className="absolute left-[9px] top-2 h-[calc(100%-1rem)] w-px bg-taupe-200" aria-hidden="true" />
      {entries.map((entry) => (
        <li key={entry.status} className="relative">
          <span
            className={cn(
              'absolute -left-7 top-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2',
              entry.done
                ? 'border-success-500 bg-success-500 text-white'
                : 'border-taupe-200 bg-white text-taupe-300',
            )}
            aria-hidden="true"
          >
            {entry.done ? <Check className="h-3 w-3" /> : <Circle className="h-1.5 w-1.5 fill-current" />}
          </span>
          <p
            className={cn(
              'text-sm font-medium',
              entry.done ? 'text-charcoal-700' : 'text-charcoal-300',
            )}
          >
            {entry.label}
          </p>
          <p className="mt-0.5 text-xs text-charcoal-400">
            {entry.occurredAt ? formatDateTime(entry.occurredAt) : 'Pending'}
            {entry.location ? ` · ${entry.location}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ShipmentCard({
  shipment,
  destination,
}: {
  shipment: {
    awb: string | null;
    courier: string | null;
    status: string;
    estimatedDelivery: Date | null;
  };
  destination: string;
}) {
  return (
    <div className="rounded-2xl border border-taupe-100 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-charcoal-700">
            <Truck className="h-4 w-4 text-wine-600" />
            {shipment.courier ?? 'Delhivery'}
          </p>
          <p className="mt-1 text-xs text-charcoal-400">
            AWB / Waybill: <span className="font-medium text-charcoal-600">{shipment.awb ?? '—'}</span>
          </p>
        </div>
        <span className="rounded-full bg-blush-100 px-2.5 py-1 text-[11px] font-medium text-wine-700">
          {shipment.status.replaceAll('_', ' ')}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <PackageCheck className="mt-0.5 h-4 w-4 text-taupe-400" />
          <div>
            <dt className="text-charcoal-400">Estimated delivery</dt>
            <dd className="font-medium text-charcoal-700">
              {shipment.estimatedDelivery
                ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
                    shipment.estimatedDelivery,
                  )
                : 'Being scheduled'}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 text-taupe-400" />
          <div>
            <dt className="text-charcoal-400">Delivering to</dt>
            <dd className="font-medium text-charcoal-700">{destination}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
