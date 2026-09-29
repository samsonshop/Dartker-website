import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCart } from '@/server/cart';

export const dynamic = 'force-dynamic';

const lineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});

const bodySchema = z.object({
  lines: z.array(lineSchema).max(50).default([]),
  saved: z.array(lineSchema).max(50).default([]),
  couponCode: z.string().trim().max(32).nullish(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart contents.' }, { status: 400 });
  }

  try {
    const cart = await resolveCart(parsed.data);
    return NextResponse.json(cart, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[cart/resolve]', error);
    return NextResponse.json({ error: 'Unable to load your cart right now.' }, { status: 500 });
  }
}
