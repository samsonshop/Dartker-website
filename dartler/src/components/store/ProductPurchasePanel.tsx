'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCart } from './CartProvider';
import { useWishlist } from './WishlistProvider';
import { discountPercent, formatPaiseShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ProductDetail } from '@/server/catalog';

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const router = useRouter();

  const colors = useMemo(() => {
    const seen = new Map<string, { color: string; hex: string }>();
    for (const variant of product.variants) {
      if (variant.color && variant.colorHex && !seen.has(variant.color)) {
        seen.set(variant.color, { color: variant.color, hex: variant.colorHex });
      }
    }
    return [...seen.values()];
  }, [product.variants]);

  const sizes = useMemo(() => {
    const seen = new Set<string>();
    for (const variant of product.variants) if (variant.size) seen.add(variant.size);
    return [...seen];
  }, [product.variants]);

  const firstAvailable = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [color, setColor] = useState<string | null>(firstAvailable?.color ?? null);
  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  const selected =
    product.variants.find(
      (variant) =>
        (color === null || variant.color === color) && (size === null || variant.size === size),
    ) ?? firstAvailable;

  const maxQuantity = Math.min(20, Math.max(1, selected?.stock ?? 0));
  const effectiveQuantity = Math.min(quantity, maxQuantity);
  const price = selected?.pricePaise ?? product.pricePaise;
  const discount = discountPercent(price, product.compareAtPaise);
  const outOfStock = !selected || selected.stock <= 0;
  const saved = wishlist.hydrated && wishlist.has(product.id);

  /** True when a colour has no variant in the currently selected size. */
  function colourUnavailable(candidate: string) {
    return !product.variants.some(
      (variant) =>
        variant.color === candidate && (size === null || variant.size === size) && variant.stock > 0,
    );
  }

  function sizeUnavailable(candidate: string) {
    return !product.variants.some(
      (variant) =>
        variant.size === candidate && (color === null || variant.color === color) && variant.stock > 0,
    );
  }

  function addToCart() {
    if (!selected || outOfStock) return;
    cart.addItem({ productId: product.id, variantId: selected.id, quantity: effectiveQuantity });
  }

  function buyNow() {
    if (!selected || outOfStock) return;
    setBuying(true);
    cart.addItem({ productId: product.id, variantId: selected.id, quantity: effectiveQuantity });
    cart.closeCart();
    router.push('/checkout');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-serif text-3xl text-wine-700">{formatPaiseShort(price)}</span>
        {product.compareAtPaise ? (
          <span className="text-base text-charcoal-300 line-through">
            {formatPaiseShort(product.compareAtPaise)}
          </span>
        ) : null}
        {discount ? <Badge tone="wine">{discount}% OFF</Badge> : null}
      </div>

      <p className="text-xs text-charcoal-300">Inclusive of all taxes · SKU {selected?.sku ?? product.sku}</p>

      <div>
        {outOfStock ? (
          <Badge tone="danger" dot>
            Out of stock
          </Badge>
        ) : selected.stock <= 5 ? (
          <Badge tone="warning" dot>
            Only {selected.stock} left
          </Badge>
        ) : (
          <Badge tone="success" dot>
            In stock
          </Badge>
        )}
      </div>

      {colors.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-charcoal-600">
            Colour: <span className="text-charcoal-400">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((option) => {
              const unavailable = colourUnavailable(option.color);
              return (
                <button
                  key={option.color}
                  type="button"
                  onClick={() => {
                    setColor(option.color);
                    setQuantity(1);
                  }}
                  aria-pressed={color === option.color}
                  title={`${option.color}${unavailable ? ' — unavailable' : ''}`}
                  className={cn(
                    'relative h-9 w-9 rounded-full border-2 transition-all',
                    color === option.color
                      ? 'border-wine-600 ring-2 ring-wine-200'
                      : 'border-taupe-200 hover:border-taupe-400',
                    unavailable && 'opacity-40',
                  )}
                  style={{ backgroundColor: option.hex }}
                >
                  <span className="sr-only">{option.color}</span>
                  {unavailable ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="h-px w-7 rotate-45 bg-charcoal-500" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-charcoal-600">
            Size: <span className="text-charcoal-400">{size}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((option) => {
              const unavailable = sizeUnavailable(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSize(option);
                    setQuantity(1);
                  }}
                  aria-pressed={size === option}
                  className={cn(
                    'h-10 min-w-[3rem] rounded-xl border px-3 text-[13px] font-medium transition-colors',
                    size === option
                      ? 'border-wine-600 bg-wine-50 text-wine-700'
                      : 'border-taupe-200 text-charcoal-600 hover:border-taupe-400',
                    unavailable && 'opacity-40',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div>
        <p className="mb-2 text-[13px] font-medium text-charcoal-600">Quantity</p>
        <div className="inline-flex items-center rounded-xl border border-taupe-200 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            disabled={effectiveQuantity <= 1 || outOfStock}
            aria-label="Decrease quantity"
            className="inline-flex h-11 w-11 items-center justify-center rounded-l-xl text-charcoal-500 transition-colors hover:bg-taupe-50 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">
            {outOfStock ? 0 : effectiveQuantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            disabled={effectiveQuantity >= maxQuantity || outOfStock}
            aria-label="Increase quantity"
            className="inline-flex h-11 w-11 items-center justify-center rounded-r-xl text-charcoal-500 transition-colors hover:bg-taupe-50 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {!outOfStock && effectiveQuantity >= maxQuantity ? (
          <p className="mt-1.5 text-xs text-charcoal-300">
            Maximum available for this variant: {maxQuantity}
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <Button fullWidth size="lg" onClick={addToCart} disabled={outOfStock}>
          <ShoppingBag className="h-4 w-4" />
          {outOfStock ? 'Out of stock' : 'Add to Cart'}
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="dark"
          onClick={buyNow}
          disabled={outOfStock}
          loading={buying}
        >
          Buy Now
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => wishlist.toggle(product.id)}
          aria-pressed={saved}
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-wine-600 text-wine-600')} />
          {saved ? 'Saved to Wishlist' : 'Add to Wishlist'}
        </Button>
      </div>
    </div>
  );
}
