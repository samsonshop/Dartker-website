import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientKey, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import {
  RESET_COOKIE,
  newPasswordSchema,
  resetPasswordWithToken,
} from '@/server/auth/password-reset';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const byIp = rateLimit('pw-reset-ip', clientKey(request), 10, 15 * 60_000);
  if (!byIp.allowed) {
    return tooManyRequests(byIp, 'Too many attempts from this network. Please try again later.');
  }

  const token = (await cookies()).get(RESET_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Your reset session has expired. Please request a new code.', expired: true },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = newPasswordSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: 'Please correct the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }

  try {
    const ok = await resetPasswordWithToken(token, parsed.data.password);
    if (!ok) {
      const response = NextResponse.json(
        { error: 'Your reset session has expired. Please request a new code.', expired: true },
        { status: 400 },
      );
      response.cookies.delete(RESET_COOKIE);
      return response;
    }

    const response = NextResponse.json(
      { message: 'Password reset successful. You can now sign in with your new password.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.cookies.delete(RESET_COOKIE);
    return response;
  } catch (error) {
    console.error('[password-reset] reset failed:', (error as Error).message);
    return NextResponse.json({ error: 'Could not reset your password right now.' }, { status: 500 });
  }
}
