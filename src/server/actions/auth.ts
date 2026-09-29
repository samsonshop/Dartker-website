'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import * as t from '@/db/schema';
import { hashPassword, fakeVerify, verifyPassword } from '@/lib/auth/passwords';
import { createSession, destroySession, getCustomerSession } from '@/lib/auth/session';
import { recordAudit, recordLoginEvent } from '@/lib/audit';

export interface FormState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Password is too long')
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: 'Include at least one letter and one number',
  });

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(160),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[- ]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: passwordRule,
  marketingOptIn: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !output[key]) output[key] = issue.message;
  }
  return output;
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  // Only same-origin, absolute paths — never an attacker-supplied external URL.
  return /^\/(?!\/)/.test(value) ? value : '/account';
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    marketingOptIn: formData.get('marketingOptIn') === 'on',
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { fullName, email, phone, password, marketingOptIn } = parsed.data;

  const existing = await db.query.profiles.findFirst({ where: eq(t.profiles.email, email) });
  if (existing) {
    return {
      ok: false,
      error: 'An account with this email already exists. Try signing in instead.',
      fieldErrors: { email: 'Already registered' },
    };
  }

  const [profile] = await db
    .insert(t.profiles)
    .values({
      email,
      fullName,
      phone,
      passwordHash: await hashPassword(password),
      marketingOptIn,
      lastLoginAt: new Date(),
    })
    .returning({ id: t.profiles.id });

  await db.insert(t.wishlists).values({ profileId: profile.id }).onConflictDoNothing();
  await createSession('CUSTOMER', profile.id);
  await recordLoginEvent({ subjectType: 'CUSTOMER', subjectId: profile.id, email, success: true });
  await recordAudit({
    actorType: 'CUSTOMER',
    actorId: profile.id,
    actorName: fullName,
    action: 'customer.register',
    entity: 'profile',
    entityId: profile.id,
    summary: `${fullName} created an account`,
  });

  redirect(safeNext(formData.get('next')));
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { email, password } = parsed.data;
  const profile = await db.query.profiles.findFirst({ where: eq(t.profiles.email, email) });

  // Same generic message and comparable work whether or not the account exists.
  if (!profile) {
    await fakeVerify();
    await recordLoginEvent({ subjectType: 'CUSTOMER', email, success: false });
    return { ok: false, error: 'Email or password is incorrect.' };
  }

  const valid = await verifyPassword(password, profile.passwordHash);
  if (!valid || profile.status === 'BLOCKED') {
    await recordLoginEvent({ subjectType: 'CUSTOMER', subjectId: profile.id, email, success: false });
    return {
      ok: false,
      error:
        profile.status === 'BLOCKED'
          ? 'This account has been disabled. Please contact support.'
          : 'Email or password is incorrect.',
    };
  }

  await db
    .update(t.profiles)
    .set({
      lastLoginAt: new Date(),
      status: profile.status === 'INACTIVE' ? 'ACTIVE' : profile.status,
    })
    .where(eq(t.profiles.id, profile.id));

  await createSession('CUSTOMER', profile.id);
  await recordLoginEvent({ subjectType: 'CUSTOMER', subjectId: profile.id, email, success: true });

  redirect(safeNext(formData.get('next')));
}

export async function logoutAction(): Promise<void> {
  const session = await getCustomerSession();
  await destroySession('CUSTOMER');
  if (session) {
    await recordAudit({
      actorType: 'CUSTOMER',
      actorId: session.profile.id,
      actorName: session.profile.fullName,
      action: 'customer.logout',
      entity: 'profile',
      entityId: session.profile.id,
    });
  }
  redirect('/');
}
