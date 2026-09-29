'use client';

import { useTransition } from 'react';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { setCustomerStatusAction } from '@/server/actions/admin-orders';
import type { AccountStatusValue } from '@/db/schema';

export function CustomerStatusControl({
  profileId,
  status,
}: {
  profileId: string;
  status: AccountStatusValue;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function change(next: AccountStatusValue) {
    startTransition(async () => {
      const result = await setCustomerStatusAction(profileId, next);
      toast({
        title: result.ok ? 'Customer updated' : 'Could not update',
        description: result.message ?? result.error,
        tone: result.ok ? 'success' : 'error',
      });
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'ACTIVE' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => change('ACTIVE')}>
          Reactivate
        </Button>
      ) : null}
      {status !== 'BLOCKED' ? (
        <Button size="sm" variant="danger" loading={pending} onClick={() => change('BLOCKED')}>
          Block account
        </Button>
      ) : null}
    </div>
  );
}
