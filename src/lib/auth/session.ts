import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { env } from '@/lib/env';

export const CUSTOMER_COOKIE = 'dartler_customer';
export const ADMIN_COOKIE = 'dartler_admin';

const CUSTOMER_TTL_DAYS = 30;
const ADMIN_TTL_DAYS = 7;

function secret(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

interface TokenPayload {
  sid: string;
  sub: string;
  typ: 'CUSTOMER' | 'ADMIN';
}

async function signToken(payload: TokenPayload, expiresAt: Date): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('dartler')
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'dartler' });
    if (
      typeof payload.sid === 'string' &&
      typeof payload.sub === 'string' &&
      (payload.typ === 'CUSTOMER' || payload.typ === 'ADMIN')
    ) {
      return { sid: payload.sid, sub: payload.sub, typ: payload.typ };
    }
    return null;
  } catch {
    return null;
  }
}

async function requestContext() {
  const headerList = await headers();
  return {
    userAgent: headerList.get('user-agent')?.slice(0, 400) ?? null,
    ip:
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      null,
  };
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

/** Creates a database-backed session and sets the signed cookie. */
export async function createSession(
  subjectType: 'CUSTOMER' | 'ADMIN',
  subjectId: string,
): Promise<void> {
  const ttlDays = subjectType === 'CUSTOMER' ? CUSTOMER_TTL_DAYS : ADMIN_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  const context = await requestContext();

  const [session] = await db
    .insert(t.sessions)
    .values({
      subjectType,
      profileId: subjectType === 'CUSTOMER' ? subjectId : null,
      adminUserId: subjectType === 'ADMIN' ? subjectId : null,
      userAgent: context.userAgent,
      ip: context.ip,
      expiresAt,
    })
    .returning({ id: t.sessions.id });

  const token = await signToken({ sid: session.id, sub: subjectId, typ: subjectType }, expiresAt);
  const jar = await cookies();
  jar.set(
    subjectType === 'CUSTOMER' ? CUSTOMER_COOKIE : ADMIN_COOKIE,
    token,
    cookieOptions(expiresAt),
  );
}

export async function destroySession(subjectType: 'CUSTOMER' | 'ADMIN'): Promise<void> {
  const cookieName = subjectType === 'CUSTOMER' ? CUSTOMER_COOKIE : ADMIN_COOKIE;
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      await db
        .update(t.sessions)
        .set({ revokedAt: new Date() })
        .where(eq(t.sessions.id, payload.sid));
    }
  }
  jar.delete(cookieName);
}

/**
 * Revokes every session for a subject — powers "log out all devices".
 *
 * `exceptSessionId` must be excluded in the `WHERE` clause, not merely filtered
 * out of the returned count: a password change spares the caller's own session,
 * and revoking it here would sign the user out of the device they are using.
 */
export async function revokeAllSessions(
  subjectType: 'CUSTOMER' | 'ADMIN',
  subjectId: string,
  exceptSessionId?: string,
): Promise<number> {
  const column = subjectType === 'CUSTOMER' ? t.sessions.profileId : t.sessions.adminUserId;
  const rows = await db
    .update(t.sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(column, subjectId),
        isNull(t.sessions.revokedAt),
        ...(exceptSessionId ? [ne(t.sessions.id, exceptSessionId)] : []),
      ),
    )
    .returning({ id: t.sessions.id });
  return rows.length;
}

export interface CustomerSession {
  sessionId: string;
  profile: t.Profile;
}

export interface AdminSession {
  sessionId: string;
  user: t.AdminUser;
  role: t.AdminRole;
  permissions: string[];
}

async function readToken(cookieName: string): Promise<TokenPayload | null> {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Resolves the signed-in customer. Cached per request so a page that reads it
 * in several components still makes one query.
 */
export const getCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  const payload = await readToken(CUSTOMER_COOKIE);
  if (!payload || payload.typ !== 'CUSTOMER') return null;

  const row = await db.query.sessions.findFirst({
    where: and(
      eq(t.sessions.id, payload.sid),
      isNull(t.sessions.revokedAt),
      gt(t.sessions.expiresAt, new Date()),
    ),
    with: { profile: true },
  });

  if (!row?.profile || row.profile.status !== 'ACTIVE') return null;
  return { sessionId: row.id, profile: row.profile };
});

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const payload = await readToken(ADMIN_COOKIE);
  if (!payload || payload.typ !== 'ADMIN') return null;

  const row = await db.query.sessions.findFirst({
    where: and(
      eq(t.sessions.id, payload.sid),
      isNull(t.sessions.revokedAt),
      gt(t.sessions.expiresAt, new Date()),
    ),
    with: { adminUser: { with: { role: { with: { permissions: true } } } } },
  });

  const user = row?.adminUser;
  if (!row || !user || user.status !== 'ACTIVE') return null;

  return {
    sessionId: row.id,
    user,
    role: user.role,
    permissions: user.role.permissions.map((permission) => permission.key),
  };
});

export async function touchSession(sessionId: string): Promise<void> {
  await db.update(t.sessions).set({ lastSeenAt: new Date() }).where(eq(t.sessions.id, sessionId));
}
