'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { fakeVerify, verifyPassword } from '@/lib/auth/passwords';
import {
  createSession,
  destroySession,
  getAdminSession,
  revokeAllSessions,
} from '@/lib/auth/session';
import { recordAudit, recordLoginEvent } from '@/lib/audit';

export interface AdminFormState {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/** Simple in-process throttle: five failures per email per 15 minutes. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

function tooManyAttempts(email: string): boolean {
  const record = attempts.get(email);
  if (!record) return false;
  if (Date.now() > record.resetAt) {
    attempts.delete(email);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(email: string) {
  const record = attempts.get(email);
  if (!record || Date.now() > record.resetAt) {
    attempts.set(email, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  record.count += 1;
}

export async function adminLoginAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { ok: false, error: 'Enter your email address and password.' };

  const { email, password } = parsed.data;

  if (tooManyAttempts(email)) {
    return { ok: false, error: 'Too many failed attempts. Try again in 15 minutes.' };
  }

  const user = await db.query.adminUsers.findFirst({ where: eq(t.adminUsers.email, email) });
  if (!user) {
    await fakeVerify();
    recordFailure(email);
    await recordLoginEvent({ subjectType: 'ADMIN', email, success: false });
    return { ok: false, error: 'Email or password is incorrect.' };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || user.status !== 'ACTIVE') {
    recordFailure(email);
    await recordLoginEvent({ subjectType: 'ADMIN', subjectId: user.id, email, success: false });
    return {
      ok: false,
      error:
        user.status !== 'ACTIVE'
          ? 'This admin account is disabled.'
          : 'Email or password is incorrect.',
    };
  }

  attempts.delete(email);
  await db.update(t.adminUsers).set({ lastLoginAt: new Date() }).where(eq(t.adminUsers.id, user.id));
  await createSession('ADMIN', user.id);
  await recordLoginEvent({ subjectType: 'ADMIN', subjectId: user.id, email, success: true });
  await recordAudit({
    actorId: user.id,
    actorName: user.fullName,
    action: 'admin.login',
    entity: 'admin_user',
    entityId: user.id,
  });

  redirect('/admin');
}

export async function adminLogoutAction(): Promise<void> {
  const session = await getAdminSession();
  await destroySession('ADMIN');
  if (session) {
    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'admin.logout',
      entity: 'admin_user',
      entityId: session.user.id,
    });
  }
  redirect('/admin/login');
}

export async function adminLogoutEverywhereAction(): Promise<void> {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');

  await revokeAllSessions('ADMIN', session.user.id);
  await recordAudit({
    actorId: session.user.id,
    actorName: session.user.fullName,
    action: 'admin.logout_all',
    entity: 'admin_user',
    entityId: session.user.id,
    summary: 'Signed out of all devices',
  });
  redirect('/admin/login');
}
