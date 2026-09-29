'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { AlertCircle, RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { addOrderNoteAction, updateOrderStatusAction } from '@/server/actions/admin-orders';
import { createShipmentAction, syncShipmentAction } from '@/server/actions/admin-shipping';
import type { ActionState } from '@/server/actions/admin-products';
import type { OrderStatus } from '@/db/schema';

const initial: ActionState = { ok: false };

export function OrderStatusForm({
  orderId,
  currentStatus,
  allowedStatuses,
  labels,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  allowedStatuses: OrderStatus[];
  labels: Record<OrderStatus, string>;
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(updateOrderStatusAction, initial);
  const [next, setNext] = useState<OrderStatus | ''>('');

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Order updated', description: state.message, tone: 'success' });
      setNext('');
    } else if (state.error) {
      toast({ title: 'Could not update', description: state.error, tone: 'error' });
    }
  }, [state, toast]);

  if (allowedStatuses.length === 0) {
    return (
      <p className="text-[13px] text-charcoal-400">
        This order is {labels[currentStatus].toLowerCase()} — no further status changes are possible.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Select
        label="Move to"
        name="status"
        value={next}
        onChange={(event) => setNext(event.target.value as OrderStatus)}
        required
      >
        <option value="">Choose a status…</option>
        {allowedStatuses.map((status) => (
          <option key={status} value={status}>
            {labels[status]}
          </option>
        ))}
      </Select>
      <Textarea
        label="Reason / note (optional)"
        name="note"
        maxLength={400}
        className="min-h-[70px]"
        placeholder="Recorded in the audit log"
      />
      <Button type="submit" fullWidth loading={pending} disabled={!next}>
        Update status
      </Button>
    </form>
  );
}

export function OrderNoteForm({
  orderId,
  initialNote,
}: {
  orderId: string;
  initialNote: string | null;
}) {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(addOrderNoteAction, initial);

  useEffect(() => {
    if (state.ok) toast({ title: 'Note saved', tone: 'success' });
    else if (state.error) toast({ title: 'Could not save note', description: state.error, tone: 'error' });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Textarea
        name="internalNote"
        defaultValue={initialNote ?? ''}
        maxLength={1000}
        className="min-h-[90px]"
        placeholder="Internal notes are visible to staff only."
      />
      <Button type="submit" variant="outline" fullWidth loading={pending}>
        Save note
      </Button>
    </form>
  );
}

export function ShipmentActions({
  orderId,
  shipmentId,
  canCreate,
  providerIsMock,
}: {
  orderId: string;
  shipmentId: string | null;
  canCreate: boolean;
  providerIsMock: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionState>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast({ title: 'Done', description: result.message, tone: 'success' });
      else setError(result.error ?? 'Something went wrong.');
    });
  }

  return (
    <div className="space-y-3">
      {providerIsMock ? (
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-600">
          Running on the mock courier. Add DELHIVERY_API_TOKEN and set DELHIVERY_USE_MOCK=false to
          go live.
        </p>
      ) : null}

      {shipmentId ? (
        <Button
          variant="outline"
          fullWidth
          loading={pending}
          onClick={() => run(() => syncShipmentAction(shipmentId))}
        >
          <RefreshCw className="h-4 w-4" />
          Sync tracking
        </Button>
      ) : canCreate ? (
        <Button fullWidth loading={pending} onClick={() => run(() => createShipmentAction(orderId))}>
          <Truck className="h-4 w-4" />
          Create shipment
        </Button>
      ) : (
        <p className="text-[13px] text-charcoal-400">
          Confirm the order before creating a shipment.
        </p>
      )}

      {error ? (
        <p className="flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
