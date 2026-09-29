'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, MapPin, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import {
  checkPincodeAction,
  createShipmentAction,
  syncShipmentAction,
} from '@/server/actions/admin-shipping';
import { formatPaiseShort } from '@/lib/money';
import { formatDate } from '@/lib/utils';

export function PincodeChecker() {
  const [state, formAction, pending] = useActionState(checkPincodeAction, { ok: false });

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-2">
        <Input
          label="Pincode"
          name="pincode"
          inputMode="numeric"
          maxLength={6}
          required
          placeholder="641004"
          wrapperClassName="flex-1"
        />
        <div className="flex items-end">
          <Button type="submit" loading={pending}>
            Check
          </Button>
        </div>
      </div>

      {state.message ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] ${
            state.serviceable ? 'bg-success-50 text-success-600' : 'bg-warning-50 text-warning-600'
          }`}
        >
          {state.serviceable ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AwaitingShipmentList({
  orders,
}: {
  orders: {
    id: string;
    orderNumber: string;
    customerName: string;
    totalPaise: number;
    placedAt: Date;
    city: string;
    pincode: string;
  }[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function create(orderId: string) {
    setBusyId(orderId);
    startTransition(async () => {
      const result = await createShipmentAction(orderId);
      toast({
        title: result.ok ? 'Shipment created' : 'Could not create shipment',
        description: result.message ?? result.error,
        tone: result.ok ? 'success' : 'error',
      });
      setBusyId(null);
    });
  }

  if (orders.length === 0) {
    return <p className="text-sm text-charcoal-400">Every confirmed order already has a shipment.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-taupe-100 px-4 py-3"
        >
          <div className="min-w-0">
            <Link
              href={`/admin/orders/${order.orderNumber}`}
              className="text-sm font-medium text-wine-700 hover:underline"
            >
              {order.orderNumber}
            </Link>
            <p className="text-xs text-charcoal-400">
              {order.customerName} · {order.city} {order.pincode} · {formatPaiseShort(order.totalPaise)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-charcoal-300">{formatDate(order.placedAt)}</span>
            <Button
              size="sm"
              loading={pending && busyId === order.id}
              onClick={() => create(order.id)}
            >
              <Truck className="h-3.5 w-3.5" />
              Create shipment
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SyncShipmentButton({ shipmentId }: { shipmentId: string }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const result = await syncShipmentAction(shipmentId);
          toast({
            title: result.ok ? 'Tracking synced' : 'Sync failed',
            description: result.message ?? result.error,
            tone: result.ok ? 'success' : 'error',
          });
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-taupe-200 px-2.5 py-1.5 text-xs font-medium text-charcoal-600 hover:border-wine-300 hover:text-wine-700 disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      Sync
    </button>
  );
}

export function TrackOrderLookupPanel() {
  return (
    <p className="flex items-start gap-2 text-[13px] text-charcoal-400">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-taupe-400" />
      Customers track the same shipment data at <span className="font-medium">/track-order</span>,
      using their order number and email.
    </p>
  );
}
