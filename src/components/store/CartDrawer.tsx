'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, Bookmark, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPaiseShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useCart, type ResolvedCartLine } from './CartProvider';

export function CartLineRow({
  line,
  onQuantity,
  onRemove,
  onSave,
  compact,
}: {
  line: ResolvedCartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onSave?: () => void;
  compact?: boolean;
}) {
  const maxQuantity = Math.min(20, Math.max(1, line.availableStock));

  return (
    <li className={cn('flex gap-3 py-4', compact ? 'px-0' : 'px-5')}>
      <Link
        href={`/product/${line.slug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ivory-200"
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.name} fill sizes="80px" className="object-cover" />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/product/${line.slug}`}
              className="block truncate text-sm font-medium text-charcoal-700 hover:text-wine-700"
            >
              {line.name}
            </Link>
            {line.variantLabel ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-charcoal-400">
                {line.colorHex ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-taupe-200"
                    style={{ backgroundColor: line.colorHex }}
                  />
                ) : null}
                {line.variantLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.name}`}
            className="rounded-lg p-1.5 text-charcoal-300 transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {line.unavailable ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Out of stock — remove to continue
          </p>
        ) : line.adjusted ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Quantity reduced to the {line.availableStock} still in stock
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-lg border border-taupe-200">
            <button
              type="button"
              onClick={() => onQuantity(line.quantity - 1)}
              disabled={line.quantity <= 1 || line.unavailable}
              aria-label="Decrease quantity"
              className="inline-flex h-8 w-8 items-center justify-center rounded-l-lg text-charcoal-500 transition-colors hover:bg-taupe-50 disabled:opacity-40"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-9 text-center text-sm tabular-nums" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantity(line.quantity + 1)}
              disabled={line.quantity >= maxQuantity || line.unavailable}
              aria-label="Increase quantity"
              className="inline-flex h-8 w-8 items-center justify-center rounded-r-lg text-charcoal-500 transition-colors hover:bg-taupe-50 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="text-sm font-semibold text-charcoal-700">
            {formatPaiseShort(line.lineTotalPaise)}
          </span>
        </div>

        {onSave ? (
          <button
            type="button"
            onClick={onSave}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-charcoal-400 transition-colors hover:text-wine-700"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Save for later
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function CartTotalsPanel({
  totals,
  className,
}: {
  totals: NonNullable<ReturnType<typeof useCart>['totals']>;
  className?: string;
}) {
  return (
    <dl className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Subtotal</dt>
        <dd className="font-medium text-charcoal-700">{formatPaiseShort(totals.subtotalPaise)}</dd>
      </div>
      {totals.discountPaise > 0 ? (
        <div className="flex justify-between">
          <dt className="text-charcoal-400">Discount</dt>
          <dd className="font-medium text-success-600">−{formatPaiseShort(totals.discountPaise)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Shipping</dt>
        <dd className="font-medium text-charcoal-700">
          {totals.shippingPaise === 0 ? (
            <span className="text-success-600">Free</span>
          ) : (
            formatPaiseShort(totals.shippingPaise)
          )}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-charcoal-400">Tax (18% GST)</dt>
        <dd className="font-medium text-charcoal-700">{formatPaiseShort(totals.taxPaise)}</dd>
      </div>
      <div className="flex justify-between border-t border-taupe-100 pt-2.5 text-base">
        <dt className="font-medium text-charcoal-700">Total</dt>
        <dd className="font-semibold text-wine-700">{formatPaiseShort(totals.totalPaise)}</dd>
      </div>
    </dl>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const blocked = cart.lines.some((line) => line.unavailable);

  return (
    <Drawer
      open={cart.isOpen}
      onClose={cart.closeCart}
      title={`Your Cart (${cart.itemCount})`}
      footer={
        cart.lines.length > 0 && cart.totals ? (
          <div className="space-y-3">
            <CartTotalsPanel totals={cart.totals} />
            <ButtonLink
              href="/checkout"
              fullWidth
              size="lg"
              onClick={cart.closeCart}
              className={blocked ? 'pointer-events-none opacity-50' : undefined}
              aria-disabled={blocked}
            >
              Proceed to Checkout
            </ButtonLink>
            <button
              type="button"
              onClick={cart.closeCart}
              className="w-full text-center text-xs text-charcoal-400 hover:text-wine-700"
            >
              Continue shopping
            </button>
          </div>
        ) : null
      }
    >
      {cart.lines.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your cart is empty"
            description="Add a few pieces you love and they will appear here."
            action={
              <Button onClick={cart.closeCart} variant="primary">
                Start shopping
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {cart.totals && cart.totals.amountToFreeShipping > 0 ? (
            <p className="border-b border-taupe-100 bg-blush-50 px-5 py-2.5 text-xs text-wine-700">
              Add {formatPaiseShort(cart.totals.amountToFreeShipping)} more for free shipping.
            </p>
          ) : cart.totals ? (
            <p className="border-b border-taupe-100 bg-success-50 px-5 py-2.5 text-xs text-success-600">
              You have unlocked free shipping.
            </p>
          ) : null}

          <ul className="divide-y divide-taupe-50">
            {cart.lines.map((line) => (
              <CartLineRow
                key={line.key}
                line={line}
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

          {cart.savedLines.length > 0 ? (
            <section className="border-t border-taupe-100 px-5 py-4">
              <h3 className="mb-1 text-sm font-medium text-charcoal-600">
                Saved for later ({cart.savedLines.length})
              </h3>
              <ul className="divide-y divide-taupe-50">
                {cart.savedLines.map((line) => (
                  <li key={line.key} className="flex items-center gap-3 py-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                      {line.imageUrl ? (
                        <Image src={line.imageUrl} alt={line.name} fill sizes="56px" className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-charcoal-700">{line.name}</p>
                      <p className="text-xs text-charcoal-400">
                        {formatPaiseShort(line.unitPricePaise)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          cart.moveToCart({ productId: line.productId, variantId: line.variantId })
                        }
                        disabled={line.unavailable}
                        className="text-xs font-medium text-wine-700 hover:underline disabled:text-charcoal-300 disabled:no-underline"
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
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
