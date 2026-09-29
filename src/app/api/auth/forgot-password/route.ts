import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { isEmailConfigured } from '@/lib/env';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import {
  RESEND_COOLDOWN_SECONDS,
  emailSchema,
  requestPasswordResetOtp,
} from '@/server/auth/password-reset';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: emailSchema });

/** Every response takes at least this long, so a real account is not measurably slower. */
const MIN_RESPONSE_MS = 700;

const GENERIC_MESSAGE = 'If this email is registered, an OTP has been sent.';

export async function POST(request: Request) {
  const startedAt = Date.now();

  const byIp = rateLimit('pw-forgot-ip', clientKey(request), 10, 15 * 60_000);
  if (!byIp.allowed) {
    return tooManyRequests(byIp, 'Too many reset requests from this network. Please try again later.');
  }

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
  const { email } = parsed.data;

  // Applied to every address alike, so a 429 says nothing about whether it exists.
  const byEmail = rateLimit('pw-forgot-email', email, 5, 60 * 60_000);
  if (!byEmail.allowed) {
    return tooManyRequests(byEmail, 'Too many codes requested for this email. Please try again later.');
  }

  if (!isEmailConfigured()) {
    const missing = ['SMTP_HOST', 'EMAIL_FROM'].filter((key) => !process.env[key]?.trim());
    console.error(
      `[password-reset] email is not configured — missing env: ${missing.join(', ')}. ` +
        'Add them to .env (see .env.example) and restart the server.',
    );
    return NextResponse.json(
      { error: 'Password reset is temporarily unavailable. Please contact support.' },
      { status: 503 },
    );
  }

  // All account-dependent work — lookup, insert, SMTP — runs after the response
  // is sent, so response time is the same for registered and unknown emails.
  after(async () => {
    try {
      const deliver = await requestPasswordResetOtp(email);
      if (deliver) await deliver();
    } catch (error) {
      console.error('[password-reset] could not issue code:', (error as Error).message);
    }
  });

  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }

  return NextResponse.json(
    { message: GENERIC_MESSAGE, resendAfterSeconds: RESEND_COOLDOWN_SECONDS },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
