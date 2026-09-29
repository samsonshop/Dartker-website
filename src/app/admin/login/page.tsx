import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LeafMark } from '@/components/brand/Logo';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { getAdminSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect('/admin');

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-700 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="inline-flex items-center gap-2.5">
            <LeafMark className="h-8 text-blush-200" />
            <span className="font-serif text-2xl font-semibold text-ivory-100">Dartler</span>
          </span>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-taupe-300">
            E-commerce Admin Panel
          </p>
        </div>

        <div className="rounded-2xl bg-ivory-100 p-6 shadow-popover">
          <h1 className="font-serif text-xl text-charcoal-700">Sign in to your console</h1>
          <p className="mt-1 text-[13px] text-charcoal-400">
            Admin access is separate from customer accounts.
          </p>
          <div className="mt-5">
            <AdminLoginForm />
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-taupe-300">
          Protected area. All sign-in attempts are logged.
        </p>
      </div>
    </div>
  );
}
