import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/store/AuthForms';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCustomerSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a Dartler account for faster checkout, order tracking and a saved wishlist.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const session = await getCustomerSession();
  if (session) redirect('/account');

  return (
    <div className="container-dartler flex justify-center py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-charcoal-700">Create your account</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            It takes a minute, and checkout is one tap from then on.
          </p>
        </header>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
