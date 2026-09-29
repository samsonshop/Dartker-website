/**
 * Session revocation, against a real database.
 *
 * `revokeAllSessions` backs both "log out all devices" and the sign-out-everyone-
 * else step of a password change. The two callers need opposite things from it,
 * and the difference is one `WHERE` clause — so it is worth pinning down:
 *
 *   - password change  -> spare the caller's own session
 *   - log out all      -> revoke every session, including the caller's
 *
 * Needs a database (`npm run db:push`); it does not need a running server. It
 * creates and removes its own throwaway profile, so no seeded data is touched.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { and, eq, isNull } from 'drizzle-orm';
import 'dotenv/config';
import { db, pool } from '../src/db';
import * as t from '../src/db/schema';
import { revokeAllSessions } from '../src/lib/auth/session';

const EMAIL = `session.test.${Date.now()}@example.invalid`;
let profileId = '';

before(async () => {
  const [profile] = await db
    .insert(t.profiles)
    .values({
      fullName: 'Session Test',
      email: EMAIL,
      // Not a usable credential: this profile only ever holds session rows.
      passwordHash: 'not-a-real-hash',
    })
    .returning({ id: t.profiles.id });
  profileId = profile.id;
});

after(async () => {
  // Sessions cascade with the profile, but delete explicitly so a failed run
  // still cleans up after itself.
  await db.delete(t.sessions).where(eq(t.sessions.profileId, profileId));
  await db.delete(t.profiles).where(eq(t.profiles.id, profileId));
  await pool.end();
});

/** Three live sessions for the test profile; returns their ids. */
async function seedSessions(count = 3): Promise<string[]> {
  await db.delete(t.sessions).where(eq(t.sessions.profileId, profileId));
  const rows = await db
    .insert(t.sessions)
    .values(
      Array.from({ length: count }, () => ({
        subjectType: 'CUSTOMER' as const,
        profileId,
        expiresAt: new Date(Date.now() + 86_400_000),
      })),
    )
    .returning({ id: t.sessions.id });
  return rows.map((row) => row.id);
}

async function liveSessionIds(): Promise<string[]> {
  const rows = await db
    .select({ id: t.sessions.id })
    .from(t.sessions)
    .where(and(eq(t.sessions.profileId, profileId), isNull(t.sessions.revokedAt)));
  return rows.map((row) => row.id);
}

describe('revokeAllSessions', () => {
  it('spares the excepted session and revokes the rest', async () => {
    const ids = await seedSessions(3);
    const keep = ids[0];

    const revoked = await revokeAllSessions('CUSTOMER', profileId, keep);

    assert.equal(revoked, 2, 'should report the two sessions it actually revoked');
    assert.deepEqual(
      await liveSessionIds(),
      [keep],
      'the excepted session must survive — revoking it signs the user out of the device they are using',
    );
  });

  it('revokes every session when nothing is excepted', async () => {
    await seedSessions(3);

    const revoked = await revokeAllSessions('CUSTOMER', profileId);

    assert.equal(revoked, 3);
    assert.deepEqual(await liveSessionIds(), [], '"log out all devices" must leave nothing live');
  });

  it('reports zero and changes nothing when there is nothing left to revoke', async () => {
    const ids = await seedSessions(1);
    await revokeAllSessions('CUSTOMER', profileId);

    const again = await revokeAllSessions('CUSTOMER', profileId);
    assert.equal(again, 0, 'a second call must not re-revoke already-revoked rows');
    assert.deepEqual(await liveSessionIds(), []);
    assert.ok(ids.length === 1);
  });

  it('touches only the subject it was given', async () => {
    const [other] = await db
      .insert(t.profiles)
      .values({
        fullName: 'Other Subject',
        email: `session.other.${Date.now()}@example.invalid`,
        passwordHash: 'not-a-real-hash',
      })
      .returning({ id: t.profiles.id });

    try {
      await seedSessions(2);
      const [otherSession] = await db
        .insert(t.sessions)
        .values({
          subjectType: 'CUSTOMER',
          profileId: other.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning({ id: t.sessions.id });

      await revokeAllSessions('CUSTOMER', profileId);

      const stillLive = await db
        .select({ id: t.sessions.id })
        .from(t.sessions)
        .where(and(eq(t.sessions.id, otherSession.id), isNull(t.sessions.revokedAt)));
      assert.equal(stillLive.length, 1, 'another customer’s session was revoked');
    } finally {
      await db.delete(t.sessions).where(eq(t.sessions.profileId, other.id));
      await db.delete(t.profiles).where(eq(t.profiles.id, other.id));
    }
  });

  it('does not revoke an admin session when clearing a customer’s', async () => {
    // Customer and admin sessions share one table, distinguished by subjectType
    // and two nullable foreign keys — so a mistake here would cross the boundary.
    await seedSessions(2);
    const role = await db.query.adminRoles.findFirst();
    const adminUser = role
      ? await db.query.adminUsers.findFirst({ where: eq(t.adminUsers.roleId, role.id) })
      : undefined;
    if (!adminUser) return; // no seeded admin; nothing to prove

    const [adminSession] = await db
      .insert(t.sessions)
      .values({
        subjectType: 'ADMIN',
        adminUserId: adminUser.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: t.sessions.id });

    try {
      await revokeAllSessions('CUSTOMER', profileId);
      const stillLive = await db
        .select({ id: t.sessions.id })
        .from(t.sessions)
        .where(and(eq(t.sessions.id, adminSession.id), isNull(t.sessions.revokedAt)));
      assert.equal(stillLive.length, 1, 'an admin session was revoked by a customer revocation');
    } finally {
      await db.delete(t.sessions).where(eq(t.sessions.id, adminSession.id));
    }
  });
});
