import { NextResponse } from 'next/server';
import { getProductBySlug } from '@/server/catalog';

export const dynamic = 'force-dynamic';

/**
 * Used by the quick "Add to Cart" button on product cards: picks the first
 * in-stock variant server-side so the browser never guesses at availability.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return NextResponse.json({ variantId: null }, { status: 404 });

  const variant = product.variants.find((option) => option.stock > 0) ?? null;
  return NextResponse.json(
    { productId: product.id, variantId: variant?.id ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
