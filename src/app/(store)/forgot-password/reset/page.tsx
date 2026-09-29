import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ResetPasswordForm } from '@/components/store/PasswordResetForms';
import { RESET_COOKIE } from '@/server/auth/password-reset';

export const metadata: Metadata = {
  title: 'Set a new password',
  description: 'Choose a new password for your Dartler account.',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  // Presence only; the token itself is validated when the form is submitted.
  const hasSession = Boolean((await cookies()).get(RESET_COOKIE)?.value);

  return (
    <div className="container-dartler flex justify-center py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-charcoal-700">Set a new password</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            Choose a strong password. You&apos;ll be signed out of other devices.
          </p>
        </header>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <ResetPasswordForm hasSession={hasSession} />
        </div>
      </div>
    </div>
  );
}
