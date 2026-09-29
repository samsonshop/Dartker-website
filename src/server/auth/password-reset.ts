import 'server-only';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { env, publicEnv } from '@/lib/env';
import { hashPassword } from '@/lib/auth/passwords';
import { revokeAllSessions } from '@/lib/auth/session';
import { recordAudit } from '@/lib/audit';
import { clearRateLimit, rateLimit } from '@/lib/rate-limit';
import { sendMail } from '@/server/email/mailer';

/**
 * Customer "forgot password" flow, kept apart from sign-in / sign-up:
 *
 *   1. requestPasswordResetOtp — email a 6-digit code (valid 10 minutes)
 *   2. verifyPasswordResetOtp  — trade a correct code for a short-lived reset token
 *   3. resetPasswordWithToken  — set the new password, burn the code
 *
 * Every outcome a caller can observe is identical whether or not the email
 * belongs to an account, so the flow cannot be used to discover customers.
 */

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const RESET_TOKEN_TTL_MS = 15 * 60_000;
export const RESET_COOKIE = 'dartler_pwreset';

/** Mirrors the sign-up password rule in `server/actions/auth.ts`. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(72, 'Password is too long')
      .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
        message: 'Include at least one letter and one number',
      }),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  });

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);
export const otpSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

function digest(value: string): string {
  return createHmac('sha256', env().AUTH_SECRET).update(value).digest('hex');
}

function otpDigest(profileId: string, otp: string): string {
  return digest(`pw-otp:${profileId}:${otp}`);
}

function tokenDigest(token: string): string {
  return digest(`pw-token:${token}`);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// ---------------------------------------------------------------- step 1

/**
 * Issues a code if the email belongs to an active account. Returns a delivery
 * callback (or null) so the route can send the email *after* responding —
 * SMTP latency would otherwise reveal which emails are real.
 */
export async function requestPasswordResetOtp(
  email: string,
): Promise<(() => Promise<void>) | null> {
  // One code per email per cooldown, tracked for every address alike.
  const cooldown = rateLimit('pw-reset-cooldown', email, 1, RESEND_COOLDOWN_SECONDS * 1000);
  if (!cooldown.allowed) return null;

  // A fresh request restarts the attempt budget — for unknown emails too.
  clearRateLimit('pw-reset-unknown', email);

  const profile = await db.query.profiles.findFirst({ where: eq(t.profiles.email, email) });
  if (!profile || profile.status === 'BLOCKED') return null;

  const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');

  await db.transaction(async (tx) => {
    // Only the newest code is ever valid.
    await tx
      .update(t.passwordResetOtps)
      .set({ used: true, usedAt: new Date() })
      .where(and(eq(t.passwordResetOtps.profileId, profile.id), eq(t.passwordResetOtps.used, false)));
    await tx.insert(t.passwordResetOtps).values({
      profileId: profile.id,
      email,
      otpHash: otpDigest(profile.id, otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
  });

  await recordAudit({
    actorType: 'CUSTOMER',
    actorId: profile.id,
    actorName: profile.fullName,
    action: 'customer.password_reset_requested',
    entity: 'profile',
    entityId: profile.id,
  });

  const firstName = profile.fullName.split(' ')[0] || 'there';
  return async () => {
    try {
      await sendMail({ to: email, ...otpEmail(firstName, otp) });
    } catch (error) {
      // Message only — never the payload, which contains the code.
      console.error('[password-reset] email delivery failed:', (error as Error).message);
    }
  };
}

function otpEmail(firstName: string, otp: string) {
  const minutes = OTP_TTL_MS / 60_000;
  const subject = `${otp} is your Dartler password reset code`;
  const text = [
    `Hi ${firstName},`,
    '',
    `Use this code to reset your Dartler password: ${otp}`,
    '',
    `It expires in ${minutes} minutes and can be used once.`,
    "If you didn't ask to reset your password, you can ignore this email — your password will not change.",
    '',
    `— Dartler (${publicEnv.siteUrl})`,
  ].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;background:#FDF9F5;font-family:Arial,Helvetica,sans-serif;color:#211E1C">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
        <tr><td style="font-family:Georgia,serif;font-size:24px;color:#752739;padding-bottom:16px">Dartler</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:16px">Hi ${escapeHtml(firstName)},<br>Use this code to reset your password:</td></tr>
        <tr><td align="center" style="padding:8px 0 20px">
          <div style="display:inline-block;font-size:32px;letter-spacing:10px;font-weight:bold;color:#8E2F45;background:#FBF2F4;border-radius:12px;padding:14px 24px">${otp}</div>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#66625D">It expires in ${minutes} minutes and can be used once. If you didn't ask to reset your password, you can safely ignore this email — your password will not change.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

// ---------------------------------------------------------------- step 2

export type VerifyResult =
  | { ok: true; resetToken: string }
  | { ok: false; locked: boolean; attemptsLeft: number };

export async function verifyPasswordResetOtp(email: string, otp: string): Promise<VerifyResult> {
  const now = new Date();
  const row = await db.query.passwordResetOtps.findFirst({
    where: and(
      eq(t.passwordResetOtps.email, email),
      eq(t.passwordResetOtps.used, false),
      gt(t.passwordResetOtps.expiresAt, now),
    ),
    orderBy: desc(t.passwordResetOtps.createdAt),
  });

  if (!row) {
    // No live code: count the failure in memory so the attempt countdown and
    // lock-out look exactly like they do for a real account.
    const strike = rateLimit('pw-reset-unknown', email, OTP_MAX_ATTEMPTS, OTP_TTL_MS);
    return { ok: false, locked: strike.remaining === 0, attemptsLeft: strike.remaining };
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await burn(row.id);
    return { ok: false, locked: true, attemptsLeft: 0 };
  }

  if (!safeEqual(otpDigest(row.profileId, otp), row.otpHash)) {
    // Atomic increment, so parallel guesses cannot exceed the budget.
    const [updated] = await db
      .update(t.passwordResetOtps)
      .set({ attempts: row.attempts + 1 })
      .where(
        and(
          eq(t.passwordResetOtps.id, row.id),
          eq(t.passwordResetOtps.attempts, row.attempts),
          lt(t.passwordResetOtps.attempts, OTP_MAX_ATTEMPTS),
        ),
      )
      .returning({ attempts: t.passwordResetOtps.attempts });
    const attempts = updated?.attempts ?? OTP_MAX_ATTEMPTS;
    const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
    if (attemptsLeft === 0) await burn(row.id);
    return { ok: false, locked: attemptsLeft === 0, attemptsLeft };
  }

  const resetToken = randomBytes(32).toString('base64url');
  await db
    .update(t.passwordResetOtps)
    .set({
      verifiedAt: now,
      resetTokenHash: tokenDigest(resetToken),
      resetTokenExpiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    })
    .where(eq(t.passwordResetOtps.id, row.id));

  return { ok: true, resetToken };
}

async function burn(id: string): Promise<void> {
  await db
    .update(t.passwordResetOtps)
    .set({ used: true, usedAt: new Date() })
    .where(eq(t.passwordResetOtps.id, id));
}

// ---------------------------------------------------------------- step 3

export async function resetPasswordWithToken(token: string, password: string): Promise<boolean> {
  const now = new Date();
  const row = await db.query.passwordResetOtps.findFirst({
    where: and(
      eq(t.passwordResetOtps.resetTokenHash, tokenDigest(token)),
      eq(t.passwordResetOtps.used, false),
      isNotNull(t.passwordResetOtps.verifiedAt),
      gt(t.passwordResetOtps.resetTokenExpiresAt, now),
    ),
  });
  if (!row) return false;

  const profile = await db.query.profiles.findFirst({ where: eq(t.profiles.id, row.profileId) });
  if (!profile || profile.status === 'BLOCKED') return false;

  const passwordHash = await hashPassword(password);

  const applied = await db.transaction(async (tx) => {
    // Claiming the row first makes the token single-use even under a race.
    const claimed = await tx
      .update(t.passwordResetOtps)
      .set({ used: true, usedAt: now })
      .where(and(eq(t.passwordResetOtps.id, row.id), eq(t.passwordResetOtps.used, false)))
      .returning({ id: t.passwordResetOtps.id });
    if (claimed.length === 0) return false;

    await tx
      .update(t.profiles)
      .set({ passwordHash, updatedAt: now })
      .where(eq(t.profiles.id, profile.id));
    await tx
      .update(t.passwordResetOtps)
      .set({ used: true, usedAt: now })
      .where(and(eq(t.passwordResetOtps.profileId, profile.id), eq(t.passwordResetOtps.used, false)));
    return true;
  });
  if (!applied) return false;

  // Whoever knew the old password is signed out everywhere.
  await revokeAllSessions('CUSTOMER', profile.id);
  await recordAudit({
    actorType: 'CUSTOMER',
    actorId: profile.id,
    actorName: profile.fullName,
    action: 'customer.password_reset',
    entity: 'profile',
    entityId: profile.id,
    summary: `${profile.fullName} reset their password with an emailed code`,
  });
  return true;
}
