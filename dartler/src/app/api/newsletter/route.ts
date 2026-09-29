import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().email().max(160) });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  try {
    const existing = await db.query.profiles.findFirst({ where: eq(t.profiles.email, email) });
    if (existing) {
      await db
        .update(t.profiles)
        .set({ marketingOptIn: true, updatedAt: new Date() })
        .where(eq(t.profiles.id, existing.id));
    }
    // A subscriber without an account is recorded as an audit entry rather than
    // a half-built account row; the marketing module reads both.
    await db.insert(t.auditLogs).values({
      actorType: 'CUSTOMER',
      action: 'newsletter.subscribe',
      entity: 'newsletter',
      entityId: email,
      summary: `${email} subscribed to the newsletter`,
    });

    return NextResponse.json({ message: 'Use code WELCOME10 at checkout for 10% off.' });
  } catch (error) {
    console.error('[newsletter]', error);
    return NextResponse.json({ error: 'Could not subscribe right now.' }, { status: 500 });
  }
}
