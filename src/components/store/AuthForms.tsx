'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Field';
import { loginAction, registerAction, type FormState } from '@/server/actions/auth';

const initial: FormState = { ok: false };

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
        placeholder="••••••••"
      />
      <div className="-mt-2 flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-wine-700 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Sign in
      </Button>

      <p className="text-center text-sm text-charcoal-400">
        New to Dartler?{' '}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="font-medium text-wine-700 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.error} />

      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        error={state.fieldErrors?.fullName}
        placeholder="Priya Sharma"
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
        placeholder="you@example.com"
      />
      <Input
        label="Mobile number"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        error={state.fieldErrors?.phone}
        placeholder="98765 43210"
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.password}
        hint="At least 8 characters, with a letter and a number."
        placeholder="••••••••"
      />

      <Checkbox
        name="marketingOptIn"
        label="Email me new arrivals and private sales"
        description="No spam. Unsubscribe any time."
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Create account
      </Button>

      <p className="text-center text-sm text-charcoal-400">
        Already have an account?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-medium text-wine-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
