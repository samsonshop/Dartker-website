'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { adminLoginAction, type AdminFormState } from '@/server/actions/admin-auth';

const initial: AdminFormState = { ok: false };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, initial);

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
        label="Email address"
        name="email"
        type="email"
        autoComplete="username"
        required
        placeholder="admin@dartler.com"
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="••••••••"
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
