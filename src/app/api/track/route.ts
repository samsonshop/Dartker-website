import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { VISITOR_COOKIE } from '@/middleware';
import { clientKey, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  path: z.string().max(300),
  productId: z.string().uuid().nullish(),
});

/**
 * 60 beacons per IP per minute. Genuine browsing sends one per page view, so
 * this is far above normal use while still capping a flood — each accepted call
 * inserts a `page_views` row and bumps a product's view count.
 */
const LIMIT = 60;
const WINDOW_MS = 60_000;

/** Anonymous page-view beacon. Fire-and-forget; failures never surface. */
export async function POST(request: Request) {
  try {
    // Answer 200 either way: the beacon is fire-and-forget and a 429 in the
    // console would be noise. Over the limit we simply record nothing.
    if (!rateLimit('track', clientKey(request), LIMIT, WINDOW_MS).allowed) {
      return NextResponse.json({ ok: true });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

    const jar = await cookies();
    const visitorId = jar.get(VISITOR_COOKIE)?.value;
    if (!visitorId) return NextResponse.json({ ok: true });

    await db.insert(t.pageViews).values({
      visitorId,
      path: parsed.data.path.slice(0, 300),
      productId: parsed.data.productId ?? null,
    });

    if (parsed.data.productId) {
      await db
        .update(t.products)
        .set({ viewCount: sql`${t.products.viewCount} + 1` })
        .where(eq(t.products.id, parsed.data.productId));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
