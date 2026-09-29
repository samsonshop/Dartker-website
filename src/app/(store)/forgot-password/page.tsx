import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ForgotPasswordForm } from '@/components/store/PasswordResetForms';
import { getCustomerSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset the password for your Dartler account.',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const session = await getCustomerSession();
  if (session) redirect('/account');

  return (
    <div className="container-dartler flex justify-center py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-charcoal-700">Forgot your password?</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            Enter the email you signed up with and we&apos;ll send you a 6-digit code.
          </p>
        </header>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
