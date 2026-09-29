import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminForbiddenPage() {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning-500">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-serif text-2xl text-charcoal-700">You don’t have access to this</h1>
        <p className="mt-2 text-sm text-charcoal-400">
          Your role, <span className="font-medium text-charcoal-600">{session.role.name}</span>, does
          not include permission for that section. Ask a Super Admin to adjust your role if you need
          it.
        </p>
        <Link
          href="/admin"
          className="mt-5 inline-flex h-11 items-center rounded-xl bg-wine-600 px-5 text-sm font-medium text-white hover:bg-wine-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
