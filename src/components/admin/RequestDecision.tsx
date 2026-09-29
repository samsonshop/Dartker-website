'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { decideServiceRequestAction } from '@/server/actions/admin-orders';
import type { ActionState } from '@/server/actions/admin-products';

const initial: ActionState = { ok: false };

export function RequestDecision({
  requestId,
  requestNumber,
}: {
  requestId: string;
  requestNumber: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [state, formAction, pending] = useActionState(decideServiceRequestAction, initial);

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Request updated', description: state.message, tone: 'success' });
      setOpen(null);
    } else if (state.error) {
      toast({ title: 'Could not update', description: state.error, tone: 'error' });
    }
  }, [state, toast]);

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setOpen('APPROVED')}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen('REJECTED')}>
          Reject
        </Button>
      </div>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === 'APPROVED' ? 'Approve this request?' : 'Reject this request?'}
        description={requestNumber}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value={open ?? ''} />

          <p className="text-[13px] text-charcoal-500">
            {open === 'APPROVED'
              ? 'Approving marks the order cancelled or returned, puts the stock back, and starts the refund where a payment was taken.'
              : 'Rejecting closes the request and leaves the order as it is. The customer sees the reason you give here.'}
          </p>

          <Textarea
            label="Note to the customer"
            name="adminNote"
            maxLength={500}
            className="min-h-[90px]"
            placeholder={
              open === 'APPROVED'
                ? 'Refund initiated — it should reach your account in 5–7 working days.'
                : 'The return window for this order has closed.'
            }
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={open === 'REJECTED' ? 'danger' : 'primary'} loading={pending}>
              {open === 'APPROVED' ? 'Approve request' : 'Reject request'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
