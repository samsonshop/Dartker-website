'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ShoppingBag, Tag } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPaiseShort } from '@/lib/money';
import { useCart } from './CartProvider';
import { CartLineRow, CartTotalsPanel } from './CartDrawer';

export function CartPageContent() {
  const cart = useCart();
  const [code, setCode] = useState('');

  if (!cart.hydrated) {
    return (
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (cart.lines.length === 0 && cart.savedLines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your cart is empty"
          description="Once you add something you love, it will show up here — and stay here, even if you close the tab."
          action={<ButtonLink href="/category">Start shopping</ButtonLink>}
        />
      </div>
    );
  }

  const blocked = cart.lines.some((line) => line.unavailable);

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {cart.lines.length > 0 ? (
          <div className="rounded-2xl border border-taupe-100 bg-white px-5">
            <ul className="divide-y divide-taupe-50">
              {cart.lines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  compact
                  onQuantity={(quantity) =>
                    cart.updateQuantity({
                      productId: line.productId,
                      variantId: line.variantId,
                      quantity,
                    })
                  }
                  onRemove={() =>
                    cart.removeItem({ productId: line.productId, variantId: line.variantId })
                  }
                  onSave={() =>
                    cart.saveForLater({ productId: line.productId, variantId: line.variantId })
                  }
                />
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            compact
            title="Nothing in the cart"
            description="Move something back from Saved for later, or keep browsing."
            action={<ButtonLink href="/category" variant="outline">Continue shopping</ButtonLink>}
          />
        )}

        {cart.savedLines.length > 0 ? (
          <section>
            <h2 className="mb-3 font-serif text-xl text-charcoal-700">
              Saved for later ({cart.savedLines.length})
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {cart.savedLines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center gap-3 rounded-2xl border border-taupe-100 bg-white p-3"
                >
                  <Link
                    href={`/product/${line.slug}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ivory-200"
                  >
                    {line.imageUrl ? (
                      <Image src={line.imageUrl} alt={line.name} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${line.slug}`}
                      className="block truncate text-sm text-charcoal-700 hover:text-wine-700"
                    >
                      {line.name}
                    </Link>
                    <p className="text-xs text-charcoal-400">{formatPaiseShort(line.unitPricePaise)}</p>
                    <div className="mt-1.5 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          cart.moveToCart({ productId: line.productId, variantId: line.variantId })
                        }
                        disabled={line.unavailable}
                        className="text-xs font-medium text-wine-700 hover:underline disabled:text-charcoal-300"
                      >
                        Move to cart
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          cart.removeSaved({ productId: line.productId, variantId: line.variantId })
                        }
                        className="text-xs text-charcoal-300 hover:text-danger-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="sticky top-32 space-y-4 rounded-2xl border border-taupe-100 bg-white p-5">
        <h2 className="font-serif text-lg text-charcoal-700">Order summary</h2>

        {cart.totals ? <CartTotalsPanel totals={cart.totals} /> : null}

        <div>
          <label htmlFor="coupon" className="mb-1.5 block text-[13px] font-medium text-charcoal-600">
            Coupon code
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
              <input
                id="coupon"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="WELCOME10"
                className="h-11 w-full rounded-xl border border-taupe-200 pl-9 pr-3 text-sm uppercase text-charcoal-700 placeholder:normal-case placeholder:text-charcoal-300"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => (cart.couponCode ? cart.clearCoupon() : cart.applyCoupon(code))}
            >
              {cart.couponCode ? 'Remove' : 'Apply'}
            </Button>
          </div>
          {cart.couponError ? (
            <p className="mt-1.5 text-xs text-danger-600">{cart.couponError}</p>
          ) : cart.couponCode ? (
            <p className="mt-1.5 text-xs text-success-600">Coupon {cart.couponCode} applied.</p>
          ) : null}
        </div>

        {blocked ? (
          <p className="flex items-start gap-2 rounded-xl bg-danger-50 px-3 py-2.5 text-xs text-danger-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Remove the out-of-stock items to continue to checkout.
          </p>
        ) : null}

        <ButtonLink
          href="/checkout"
          fullWidth
          size="lg"
          className={blocked || cart.lines.length === 0 ? 'pointer-events-none opacity-50' : undefined}
          aria-disabled={blocked || cart.lines.length === 0}
        >
          Proceed to Checkout
        </ButtonLink>

        <p className="text-center text-xs text-charcoal-300">
          Taxes calculated at checkout. Free shipping above{' '}
          {cart.totals ? formatPaiseShort(cart.totals.freeShippingAbovePaise) : '₹999'}.
        </p>
      </aside>
    </div>
  );
}
