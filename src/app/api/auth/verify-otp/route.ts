import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import {
  RESET_COOKIE,
  RESET_TOKEN_TTL_MS,
  emailSchema,
  otpSchema,
  verifyPasswordResetOtp,
} from '@/server/auth/password-reset';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: emailSchema, otp: otpSchema });

export async function POST(request: Request) {
  const byIp = rateLimit('pw-verify-ip', clientKey(request), 30, 15 * 60_000);
  if (!byIp.allowed) {
    return tooManyRequests(byIp, 'Too many attempts from this network. Please try again later.');
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Enter the 6-digit code.' },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPasswordResetOtp(parsed.data.email, parsed.data.otp);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.locked
            ? 'Too many incorrect attempts. Please request a new code.'
            : `That code is incorrect or has expired. ${result.attemptsLeft} ${
                result.attemptsLeft === 1 ? 'attempt' : 'attempts'
              } left.`,
          locked: result.locked,
          attemptsLeft: result.attemptsLeft,
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const response = NextResponse.json(
      { message: 'Code verified.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    // The reset token never touches JavaScript — it rides in an httpOnly cookie.
    response.cookies.set(RESET_COOKIE, result.resetToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor(RESET_TOKEN_TTL_MS / 1000),
    });
    return response;
  } catch (error) {
    console.error('[password-reset] verification failed:', (error as Error).message);
    return NextResponse.json({ error: 'Could not verify the code right now.' }, { status: 500 });
  }
}
