'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag } from 'lucide-react';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Badge';
import { useCart } from './CartProvider';
import { useWishlist } from './WishlistProvider';
import { useToast } from '@/components/ui/Toast';
import { discountPercent, formatPaiseShort } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { ProductListItem } from '@/server/catalog';

export function ProductCard({
  product,
  priority,
  className,
}: {
  product: ProductListItem;
  priority?: boolean;
  className?: string;
}) {
  const cart = useCart();
  const wishlist = useWishlist();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const discount = discountPercent(product.pricePaise, product.compareAtPaise);
  const outOfStock = product.totalStock <= 0;
  const lowStock = !outOfStock && product.totalStock <= 5;
  const saved = wishlist.hydrated && wishlist.has(product.id);

  function toggleWishlist() {
    wishlist.toggle(product.id);
    toast(
      saved
        ? { title: 'Removed from wishlist', description: product.name }
        : { title: 'Saved to wishlist', description: `${product.name} is on your wishlist page.` },
    );
  }

  async function addToCart() {
    if (outOfStock || adding) return;
    setAdding(true);
    try {
      const response = await fetch(`/api/products/${product.slug}/default-variant`);
      if (!response.ok) throw new Error('unavailable');
      const data = (await response.json()) as { variantId: string | null };
      if (!data.variantId) throw new Error('unavailable');
      cart.addItem({ productId: product.id, variantId: data.variantId, quantity: 1 });
    } catch {
      toast({
        title: 'Could not add to bag',
        description: 'This item may have just gone out of stock. Please refresh and try again.',
        tone: 'error',
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-taupe-100 bg-white transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-taupe-200 hover:shadow-card-hover',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-ivory-200">
        <Link href={`/product/${product.slug}`} className="block h-full w-full" tabIndex={-1} aria-hidden="true">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              className={cn(
                'object-cover transition-all duration-500 ease-smooth',
                product.hoverImageUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105',
              )}
            />
          ) : null}
          {product.hoverImageUrl ? (
            <Image
              src={product.hoverImageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover opacity-0 transition-opacity duration-500 ease-smooth group-hover:opacity-100"
            />
          ) : null}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount ? <Badge tone="wine">{discount}% OFF</Badge> : null}
          {outOfStock ? (
            <Badge tone="danger">Out of stock</Badge>
          ) : lowStock ? (
            <Badge tone="warning">Only {product.totalStock} left</Badge>
          ) : null}
        </div>

        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={saved}
          // The product title's ::after overlay spans the whole card and is
          // painted later, so the heart needs to be lifted above it to stay
          // clickable — same reason the Add to Cart button is z-10.
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-charcoal-400 shadow-sm backdrop-blur transition-colors hover:text-wine-600"
        >
          <Heart className={cn('h-4 w-4', saved && 'fill-wine-600 text-wine-600')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-[13px] font-medium leading-snug text-charcoal-700">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-wine-700">
            {formatPaiseShort(product.pricePaise)}
          </span>
          {product.compareAtPaise ? (
            <span className="text-xs text-charcoal-300 line-through">
              {formatPaiseShort(product.compareAtPaise)}
            </span>
          ) : null}
        </div>

        {product.ratingCount > 0 ? (
          <Rating value={product.ratingAvg} count={product.ratingCount} size="xs" />
        ) : (
          <span className="text-xs text-charcoal-300">New arrival</span>
        )}

        <button
          type="button"
          onClick={addToCart}
          disabled={outOfStock || adding}
          className={cn(
            'relative z-10 mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 disabled:cursor-not-allowed',
            outOfStock
              ? 'bg-taupe-100 text-charcoal-300'
              : 'bg-wine-600 text-white hover:bg-wine-700 active:scale-[0.98]',
          )}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {outOfStock ? 'Out of stock' : adding ? 'Adding…' : 'Add to Cart'}
        </button>
      </div>
    </article>
  );
}
