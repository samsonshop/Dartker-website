'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Heart, Menu, ShoppingBag, User, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { SearchBar } from './SearchBar';
import { useCart } from './CartProvider';
import { useWishlist } from './WishlistProvider';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/lib/utils';

export interface HeaderCategory {
  name: string;
  slug: string;
  productCount: number;
}

/** Pinned beside "All Categories"; everything else falls through to "More". */
const PRIMARY_SLUGS = ['combs', 'hair-clips', 'mobile-holders', 'keychains'];

const MORE_MENU_ID = 'header-more-categories';

export function Header({
  categories,
  customerName,
}: {
  categories: HeaderCategory[];
  customerName: string | null;
}) {
  const pathname = usePathname();
  const cart = useCart();
  const wishlist = useWishlist();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const primary = PRIMARY_SLUGS.map((slug) => categories.find((category) => category.slug === slug)).filter(
    (category): category is HeaderCategory => Boolean(category),
  );
  const rest = categories.filter((category) => !PRIMARY_SLUGS.includes(category.slug));

  const iconButton =
    'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal-500 transition-colors hover:bg-blush-50 hover:text-wine-700';

  return (
    <>
      <div className="bg-charcoal-700 text-ivory-100">
        <div className="container-dartler flex h-9 items-center justify-center gap-6 text-[11px] tracking-wide sm:justify-between">
          <p className="truncate">Free shipping on orders above ₹999 · Easy 7-day returns</p>
          <p className="hidden sm:block">Ships across India · info@dartler.com</p>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-50 border-b border-taupe-100 bg-ivory-100/95 backdrop-blur transition-shadow duration-300',
          compact && 'shadow-card',
        )}
      >
        <div className="container-dartler">
          <div className="flex h-[68px] items-center gap-3 lg:gap-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className={cn(iconButton, 'lg:hidden')}
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

            {/* The blueprint keeps the search a contained pill in the middle of
                the bar rather than letting it stretch the full width. */}
            <SearchBar className="mx-auto hidden w-full max-w-xl lg:block" />

            <div className="ml-auto flex items-center gap-0.5">
              <Link href="/account/wishlist" className={iconButton} aria-label="Wishlist">
                <Heart className="h-5 w-5" />
                {wishlist.hydrated && wishlist.count > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine-600 px-1 text-[10px] font-medium text-white">
                    {wishlist.count}
                  </span>
                ) : null}
              </Link>

              <Link
                href={customerName ? '/account' : '/login'}
                className={cn(iconButton, 'hidden sm:inline-flex')}
                aria-label={customerName ? 'Your account' : 'Sign in'}
              >
                <User className="h-5 w-5" />
              </Link>

              <button
                type="button"
                onClick={cart.openCart}
                className={iconButton}
                aria-label={`Cart, ${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}`}
              >
                <ShoppingBag className="h-5 w-5" />
                {cart.hydrated && cart.itemCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine-600 px-1 text-[10px] font-medium text-white">
                    {cart.itemCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <SearchBar className="pb-3 lg:hidden" />
        </div>

        <nav
          aria-label="Product categories"
          className="hidden border-t border-taupe-100 bg-white/70 lg:block"
        >
          <div className="container-dartler flex h-11 items-center gap-1 text-[13px]">
            <Link
              href="/"
              className={cn(
                'rounded-lg px-3 py-1.5 transition-colors hover:bg-blush-50 hover:text-wine-700',
                pathname === '/' ? 'font-medium text-wine-700' : 'font-medium text-charcoal-600',
              )}
            >
              Home
            </Link>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-taupe-100" />
            <Link
              href="/category"
              className={cn(
                'rounded-lg px-3 py-1.5 font-medium transition-colors hover:bg-blush-50 hover:text-wine-700',
                pathname === '/category' ? 'text-wine-700' : 'text-charcoal-600',
              )}
            >
              All Categories
            </Link>
            {primary.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className={cn(
                  'rounded-lg px-3 py-1.5 transition-colors hover:bg-blush-50 hover:text-wine-700',
                  pathname === `/category/${category.slug}`
                    ? 'font-medium text-wine-700'
                    : 'text-charcoal-500',
                )}
              >
                {category.name}
              </Link>
            ))}

            {rest.length > 0 ? (
              <div
                className="relative"
                onMouseEnter={() => setMoreOpen(true)}
                onMouseLeave={() => setMoreOpen(false)}
                // Escape closes the panel for keyboard users, whose focus is
                // inside this group when it is open.
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setMoreOpen(false);
                }}
              >
                <button
                  type="button"
                  // A hover menu: the pointer opens it, so this click is really
                  // only for keyboard/assistive activation, where toggling is
                  // the expected behaviour. (With a mouse it dismisses a panel
                  // hover has already opened, which is the usual convention.)
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreOpen}
                  aria-haspopup="true"
                  aria-controls={MORE_MENU_ID}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-charcoal-500 transition-colors hover:bg-blush-50 hover:text-wine-700"
                >
                  More
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} />
                </button>
                {moreOpen ? (
                  <div
                    id={MORE_MENU_ID}
                    className="absolute left-0 top-full z-40 w-64 animate-fade-in rounded-2xl border border-taupe-100 bg-white p-2 shadow-popover"
                  >
                    <ul className="grid gap-0.5">
                      {rest.map((category) => (
                        <li key={category.slug}>
                          <Link
                            href={`/category/${category.slug}`}
                            className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px] text-charcoal-600 transition-colors hover:bg-ivory-50 hover:text-wine-700"
                          >
                            {category.name}
                            <span className="text-xs text-charcoal-300">{category.productCount}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </nav>
      </header>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} side="left" widthClassName="w-[86vw] max-w-sm">
        <div className="flex items-center justify-between border-b border-taupe-100 bg-white px-5 py-4">
          <Logo />
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-charcoal-400 hover:bg-taupe-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-5 py-4" aria-label="Mobile menu">
          <Link
            href="/"
            className="mb-4 flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-charcoal-700 transition-colors hover:bg-white"
          >
            Home
          </Link>

          <p className="mb-2 text-[11px] uppercase tracking-wider text-charcoal-300">Shop</p>
          <ul className="grid gap-0.5">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-charcoal-600 transition-colors hover:bg-white"
                >
                  {category.name}
                  <span className="text-xs text-charcoal-300">{category.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-6 text-[11px] uppercase tracking-wider text-charcoal-300">Account</p>
          <ul className="grid gap-0.5">
            {(customerName
              ? [
                  { href: '/account', label: `Hello, ${customerName.split(' ')[0]}` },
                  { href: '/account/orders', label: 'My orders' },
                  { href: '/account/wishlist', label: 'Wishlist' },
                  { href: '/account/requests', label: 'Returns & cancellations' },
                ]
              : [
                  { href: '/login', label: 'Sign in' },
                  { href: '/register', label: 'Create an account' },
                  { href: '/account/wishlist', label: 'Wishlist' },
                ]
            ).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-xl px-3 py-2.5 text-sm text-charcoal-600 transition-colors hover:bg-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/track-order"
                className="block rounded-xl px-3 py-2.5 text-sm text-charcoal-600 transition-colors hover:bg-white"
              >
                Track your order
              </Link>
            </li>
          </ul>
        </nav>
      </Drawer>
    </>
  );
}
