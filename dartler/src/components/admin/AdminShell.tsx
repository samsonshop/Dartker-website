'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Menu,
  X,
} from 'lucide-react';
import { LeafMark } from '@/components/brand/Logo';
import { Drawer } from '@/components/ui/Drawer';
import { adminLogoutAction } from '@/server/actions/admin-auth';
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';
import { cn, initials } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  permission: PermissionKey;
  badge?: number;
}

export function AdminShell({
  children,
  user,
  permissions,
  pendingRequests,
  awaitingShipment,
}: {
  children: React.ReactNode;
  user: { fullName: string; email: string; roleName: string };
  permissions: string[];
  pendingRequests: number;
  awaitingShipment: number;
}) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMobileNav(false);
    setMenuOpen(false);
  }, [pathname]);

  const items: NavItem[] = [
    { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW },
    { href: '/admin/products', label: 'Products', Icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
    { href: '/admin/orders', label: 'Orders', Icon: ShoppingCart, permission: PERMISSIONS.ORDERS_VIEW },
    { href: '/admin/customers', label: 'Customers', Icon: Users, permission: PERMISSIONS.CUSTOMERS_VIEW },
    { href: '/admin/inventory', label: 'Inventory', Icon: Boxes, permission: PERMISSIONS.INVENTORY_VIEW },
    { href: '/admin/marketing', label: 'Marketing', Icon: Megaphone, permission: PERMISSIONS.MARKETING_VIEW },
    { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW },
    { href: '/admin/reports', label: 'Reports', Icon: FileText, permission: PERMISSIONS.REPORTS_VIEW },
    {
      href: '/admin/shipping',
      label: 'Shipping',
      Icon: Truck,
      permission: PERMISSIONS.SHIPPING_VIEW,
      badge: awaitingShipment,
    },
    {
      href: '/admin/requests',
      label: 'Returns',
      Icon: RotateCcw,
      permission: PERMISSIONS.REQUESTS_VIEW,
      badge: pendingRequests,
    },
    { href: '/admin/roles', label: 'Roles', Icon: ShieldCheck, permission: PERMISSIONS.ROLES_VIEW },
    { href: '/admin/settings', label: 'Settings', Icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
  ];

  const visible = items.filter((item) => permissions.includes(item.permission));

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Admin sections">
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors',
            isActive(item.href)
              ? 'bg-wine-600 font-medium text-white'
              : 'text-taupe-200 hover:bg-charcoal-600 hover:text-ivory-100',
          )}
        >
          <item.Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                isActive(item.href) ? 'bg-white/20 text-white' : 'bg-wine-600 text-white',
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-ivory-100">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-charcoal-700 lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <LeafMark className="h-7 text-blush-200" />
          <span className="font-serif text-xl font-semibold text-ivory-100">Dartler</span>
        </div>

        <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-charcoal-600/70 px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-200 text-xs font-semibold text-wine-700">
            {initials(user.fullName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ivory-100">
              {user.fullName}
            </span>
            <span className="block truncate text-[11px] text-taupe-300">{user.roleName}</span>
          </span>
        </div>

        {nav}

        <form action={adminLogoutAction} className="px-3 pb-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-taupe-300 transition-colors hover:bg-charcoal-600 hover:text-ivory-100"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-taupe-100 bg-ivory-100/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-charcoal-500 hover:bg-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form action="/admin/search" className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
            <label htmlFor="admin-search" className="sr-only">
              Search orders, products and customers
            </label>
            <input
              id="admin-search"
              name="q"
              type="search"
              placeholder="Search anything…"
              className="h-10 w-full rounded-full border border-taupe-200 bg-white pl-10 pr-3.5 text-sm text-charcoal-700 placeholder:text-charcoal-300 focus:border-wine-400"
            />
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/admin/requests"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-500 transition-colors hover:bg-white"
              aria-label={`Notifications, ${pendingRequests} open requests`}
            >
              <Bell className="h-5 w-5" />
              {pendingRequests > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-wine-600" />
              ) : null}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2.5 text-sm transition-colors hover:bg-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush-200 text-[11px] font-semibold text-wine-700">
                  {initials(user.fullName)}
                </span>
                <span className="hidden text-[13px] text-charcoal-600 sm:block">
                  {user.fullName.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-charcoal-400" />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-taupe-100 bg-white p-1.5 shadow-popover">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-charcoal-700">{user.fullName}</p>
                    <p className="truncate text-xs text-charcoal-400">{user.email}</p>
                    <p className="mt-1 inline-block rounded-full bg-blush-100 px-2 py-0.5 text-[10px] font-medium text-wine-700">
                      {user.roleName}
                    </p>
                  </div>
                  <hr className="my-1 border-taupe-50" />
                  <Link
                    href="/admin/settings"
                    className="block rounded-lg px-3 py-2 text-[13px] text-charcoal-600 hover:bg-ivory-50"
                  >
                    Settings & security
                  </Link>
                  <Link
                    href="/"
                    className="block rounded-lg px-3 py-2 text-[13px] text-charcoal-600 hover:bg-ivory-50"
                  >
                    View storefront
                  </Link>
                  <form action={adminLogoutAction}>
                    <button
                      type="submit"
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-danger-600 hover:bg-danger-50"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>

      <Drawer
        open={mobileNav}
        onClose={() => setMobileNav(false)}
        side="left"
        widthClassName="w-[80vw] max-w-xs"
      >
        <div className="flex h-full flex-col bg-charcoal-700">
          <div className="flex items-center justify-between px-5 py-5">
            <span className="flex items-center gap-2.5">
              <LeafMark className="h-7 text-blush-200" />
              <span className="font-serif text-xl font-semibold text-ivory-100">Dartler</span>
            </span>
            <button
              type="button"
              onClick={() => setMobileNav(false)}
              aria-label="Close navigation"
              className="rounded-lg p-1.5 text-taupe-300 hover:bg-charcoal-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {nav}
        </div>
      </Drawer>
    </div>
  );
}
