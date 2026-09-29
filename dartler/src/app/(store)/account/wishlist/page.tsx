import type { Metadata } from 'next';
import { Heart } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { ProductCard } from '@/components/store/ProductCard';
import { requireCustomer } from '@/lib/auth/guards';
import { db } from '@/db';
import * as t from '@/db/schema';
import { listProducts } from '@/server/catalog';

export const metadata: Metadata = { title: 'My wishlist', robots: { index: false, follow: false } };

export default async function AccountWishlistPage() {
  const session = await requireCustomer('/account/wishlist');

  const wishlist = await db.query.wishlists.findFirst({
    where: eq(t.wishlists.profileId, session.profile.id),
    with: { items: true },
  });

  const savedIds = new Set((wishlist?.items ?? []).map((item) => item.productId));

  // Reuse the catalogue query so wishlist cards carry live price and stock.
  const { items } = await listProducts({ perPage: 60, status: 'ALL' });
  const products = items.filter((product) => savedIds.has(product.id));

  return (
    <section>
      <h1 className="mb-4 font-serif text-xl text-charcoal-700">
        Wishlist {products.length > 0 ? `(${products.length})` : ''}
      </h1>

      {products.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-6 w-6" />}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here across devices."
          action={<ButtonLink href="/category">Browse products</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
