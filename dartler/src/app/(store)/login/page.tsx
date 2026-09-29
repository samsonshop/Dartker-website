import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/store/AuthForms';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCustomerSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Dartler account to track orders and manage your wishlist.',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await getCustomerSession();
  if (session) redirect('/account');

  return (
    <div className="container-dartler flex justify-center py-12">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-charcoal-700">Welcome back</h1>
          <p className="mt-1.5 text-sm text-charcoal-400">
            Sign in to track orders, save favourites and check out faster.
          </p>
        </header>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
