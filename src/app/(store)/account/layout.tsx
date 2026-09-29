import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { AccountNav } from '@/components/store/AccountNav';
import { requireCustomer } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/store/LogoutButton';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // No argument: the guard reads the requested path, so a signed-out visitor
  // returns to the exact page they asked for after signing in.
  const session = await requireCustomer();

  const links = [
    { href: '/account', label: 'Profile', icon: 'user' as const },
    { href: '/account/orders', label: 'My orders', icon: 'package' as const },
    { href: '/account/addresses', label: 'Addresses', icon: 'map' as const },
    { href: '/account/wishlist', label: 'Wishlist', icon: 'heart' as const },
    { href: '/account/requests', label: 'Returns & cancellations', icon: 'rotate' as const },
  ];

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'My account' }]} />

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-taupe-100 bg-white p-4">
          <div className="mb-4 border-b border-taupe-100 pb-4">
            <p className="font-serif text-lg text-charcoal-700">{session.profile.fullName}</p>
            <p className="truncate text-xs text-charcoal-400">{session.profile.email}</p>
          </div>
          <AccountNav links={links} />
          <div className="mt-4 border-t border-taupe-100 pt-4">
            <LogoutButton />
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
