'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

/**
 * The three steps of the "forgot password" flow. The email typed in step 1 is
 * carried to step 2 in sessionStorage rather than the URL, so it never lands in
 * browser history or server access logs. Step 3 is authorised by an httpOnly
 * cookie set by the server, not by anything held here.
 */

const STORAGE_KEY = 'dartler.password-reset';
const DEFAULT_COOLDOWN = 60;

interface ResetContext {
  email: string;
  message: string;
  /** Epoch ms after which "Resend" unlocks. */
  resendAt: number;
}

function readContext(): ResetContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResetContext) : null;
  } catch {
    return null;
  }
}

function writeContext(context: ResetContext): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Private mode: the flow still works within this page, just not across a reload.
  }
}

function clearContext(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, data };
}

async function requestCode(email: string): Promise<{ context?: ResetContext; error?: string }> {
  try {
    const { ok, data } = await postJson('/api/auth/forgot-password', { email });
    if (!ok) return { error: String(data.error ?? 'Could not send a code right now.') };
    const cooldown = Number(data.resendAfterSeconds) || DEFAULT_COOLDOWN;
    return {
      context: {
        email,
        message: String(data.message ?? 'If this email is registered, an OTP has been sent.'),
        resendAt: Date.now() + cooldown * 1000,
      },
    };
  } catch {
    return { error: 'Network error. Check your connection and try again.' };
  }
}

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

function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl bg-success-50 px-3.5 py-2.5 text-[13px] text-success-600"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

function BackToSignIn() {
  return (
    <p className="text-center text-sm text-charcoal-400">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 font-medium text-wine-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </p>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------- step 1

export function ForgotPasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
      .trim()
      .toLowerCase();

    setError(undefined);
    if (!EMAIL_PATTERN.test(email)) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError(undefined);

    setPending(true);
    const result = await requestCode(email);
    if (result.context) {
      writeContext(result.context);
      router.push('/forgot-password/verify');
      return;
    }
    setError(result.error);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        error={fieldError}
        placeholder="you@example.com"
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Send code
      </Button>

      <BackToSignIn />
    </form>
  );
}

// ---------------------------------------------------------------- step 2

export function VerifyOtpForm() {
  const router = useRouter();
  const [context, setContext] = useState<ResetContext | null | undefined>(undefined);
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [locked, setLocked] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setContext(readContext());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (context === undefined) {
    return <div className="h-72" aria-busy="true" />;
  }

  if (context === null) {
    return (
      <div className="space-y-4">
        <FormError message="Your reset session was not found. Please enter your email to get a new code." />
        <ButtonLink href="/forgot-password" fullWidth size="lg">
          Start again
        </ButtonLink>
        <BackToSignIn />
      </div>
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((context.resendAt - now) / 1000));
  const email = context.email;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setPending(true);
    try {
      const { ok, data } = await postJson('/api/auth/verify-otp', { email, otp });
      if (ok) {
        router.push('/forgot-password/reset');
        return;
      }
      setError(String(data.error ?? 'That code is incorrect or has expired.'));
      if (data.locked) setLocked(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    }
    setPending(false);
  }

  async function onResend() {
    setError(undefined);
    setResending(true);
    const result = await requestCode(email);
    if (result.context) {
      writeContext(result.context);
      setContext(result.context);
      setOtp('');
      setLocked(false);
    } else {
      setError(result.error);
    }
    setResending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormNotice message={context.message} />
      <FormError message={error} />

      <Input
        label="6-digit code"
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        value={otp}
        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="text-center text-lg tracking-[0.5em]"
        hint={`Sent to ${email}. The code expires in 10 minutes.`}
      />

      <Button type="submit" fullWidth size="lg" loading={pending} disabled={locked}>
        Verify code
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-charcoal-400 hover:text-wine-700 hover:underline">
          Use a different email
        </Link>
        {secondsLeft > 0 ? (
          <span className="text-charcoal-300" aria-live="polite">
            Resend code in {secondsLeft}s
          </span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="font-medium text-wine-700 hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <BackToSignIn />
    </form>
  );
}

// ---------------------------------------------------------------- step 3

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [expired, setExpired] = useState(!hasSession);
  const [done, setDone] = useState<string>();

  if (done) {
    return (
      <div className="space-y-4">
        <FormNotice message={done} />
        <ButtonLink href="/login" fullWidth size="lg">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-4">
        <FormError message={error ?? 'Your reset session has expired. Please request a new code.'} />
        <ButtonLink href="/forgot-password" fullWidth size="lg">
          Request a new code
        </ButtonLink>
        <BackToSignIn />
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    setError(undefined);
    setFieldErrors({});
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'The passwords do not match' });
      return;
    }

    setPending(true);
    try {
      const { ok, data } = await postJson('/api/auth/reset-password', { password, confirmPassword });
      if (ok) {
        clearContext();
        setDone(String(data.message ?? 'Password reset successful.'));
        return;
      }
      setError(String(data.error ?? 'Could not reset your password.'));
      if (data.fieldErrors) setFieldErrors(data.fieldErrors as Record<string, string>);
      if (data.expired) setExpired(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={error} />

      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        autoFocus
        error={fieldErrors.password}
        hint="At least 8 characters, with a letter and a number."
        placeholder="••••••••"
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.confirmPassword}
        placeholder="••••••••"
      />

      <Button type="submit" fullWidth size="lg" loading={pending}>
        Reset password
      </Button>

      <BackToSignIn />
    </form>
  );
}
