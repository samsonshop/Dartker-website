import type { Metadata } from 'next';
import { VerifyOtpForm } from '@/components/store/PasswordResetForms';

export const metadata: Metadata = {
  title: 'Enter your code',
  description: 'Enter the code we emailed you to reset your Dartler password.',
  robots: { index: false, follow: false },
};

export default function VerifyOtpPage() {
  return (
    <div className="container-dartler flex justify-center py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-charcoal-700">Check your email</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            Enter the 6-digit code we sent you to continue.
          </p>
        </header>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <VerifyOtpForm />
        </div>
      </div>
    </div>
  );
}
