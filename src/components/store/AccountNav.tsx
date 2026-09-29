'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, MapPin, Package, RotateCcw, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  user: User,
  package: Package,
  map: MapPin,
  heart: Heart,
  rotate: RotateCcw,
};

export function AccountNav({
  links,
}: {
  links: { href: string; label: string; icon: keyof typeof ICONS }[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections">
      <ul className="space-y-0.5">
        {links.map((link) => {
          const Icon = ICONS[link.icon];
          const active = link.href === '/account' ? pathname === '/account' : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-colors',
                  active
                    ? 'bg-blush-100 font-medium text-wine-700'
                    : 'text-charcoal-500 hover:bg-ivory-50 hover:text-charcoal-700',
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
