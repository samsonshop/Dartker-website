'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { trackPublicOrderAction } from '@/server/actions/admin-shipping';

export function TrackOrderForm({ defaultOrderNumber }: { defaultOrderNumber?: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(trackPublicOrderAction, { ok: false });

  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <Input
        label="Order number"
        name="orderNumber"
        required
        defaultValue={defaultOrderNumber}
        placeholder="ORD-26090412-4F7K"
        hint="Printed on your confirmation email."
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        hint="The email you used when ordering."
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        <Search className="h-4 w-4" />
        Track order
      </Button>
    </form>
  );
}
