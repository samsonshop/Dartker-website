import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getCustomerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Every handler resolves the caller's own wishlist — ids are never trusted from the client. */
async function ownWishlistId(): Promise<string | null> {
  const session = await getCustomerSession();
  if (!session) return null;

  const existing = await db.query.wishlists.findFirst({
    where: eq(t.wishlists.profileId, session.profile.id),
  });
  if (existing) return existing.id;

  const [created] = await db
    .insert(t.wishlists)
    .values({ profileId: session.profile.id })
    .onConflictDoNothing()
    .returning({ id: t.wishlists.id });
  if (created) return created.id;

  const retry = await db.query.wishlists.findFirst({
    where: eq(t.wishlists.profileId, session.profile.id),
  });
  return retry?.id ?? null;
}

async function listIds(wishlistId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: t.wishlistItems.productId })
    .from(t.wishlistItems)
    .where(eq(t.wishlistItems.wishlistId, wishlistId));
  return rows.map((row) => row.productId);
}

export async function GET() {
  const wishlistId = await ownWishlistId();
  if (!wishlistId) return NextResponse.json({ productIds: [] }, { status: 401 });
  return NextResponse.json({ productIds: await listIds(wishlistId) });
}

const mergeSchema = z.object({ merge: z.array(z.string().uuid()).max(200) });

export async function POST(request: Request) {
  const wishlistId = await ownWishlistId();
  if (!wishlistId) return NextResponse.json({ productIds: [] }, { status: 401 });

  const parsed = mergeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  if (parsed.data.merge.length > 0) {
    // Only merge ids that are real, active products.
    const valid = await db
      .select({ id: t.products.id })
      .from(t.products)
      .where(and(inArray(t.products.id, parsed.data.merge), eq(t.products.status, 'ACTIVE')));

    if (valid.length > 0) {
      await db
        .insert(t.wishlistItems)
        .values(valid.map((product) => ({ wishlistId, productId: product.id })))
        .onConflictDoNothing();
    }
  }

  return NextResponse.json({ productIds: await listIds(wishlistId) });
}

const itemSchema = z.object({ productId: z.string().uuid() });

export async function PUT(request: Request) {
  const wishlistId = await ownWishlistId();
  if (!wishlistId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const product = await db.query.products.findFirst({
    where: and(eq(t.products.id, parsed.data.productId), eq(t.products.status, 'ACTIVE')),
    columns: { id: true },
  });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  await db
    .insert(t.wishlistItems)
    .values({ wishlistId, productId: product.id })
    .onConflictDoNothing();

  return NextResponse.json({ productIds: await listIds(wishlistId) });
}

export async function DELETE(request: Request) {
  const wishlistId = await ownWishlistId();
  if (!wishlistId) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  await db
    .delete(t.wishlistItems)
    .where(
      and(
        eq(t.wishlistItems.wishlistId, wishlistId),
        eq(t.wishlistItems.productId, parsed.data.productId),
      ),
    );

  return NextResponse.json({ productIds: await listIds(wishlistId) });
}
