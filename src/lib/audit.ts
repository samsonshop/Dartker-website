import 'server-only';
import { headers } from 'next/headers';
import { db } from '@/db';
import * as t from '@/db/schema';

export interface AuditInput {
  actorType?: 'CUSTOMER' | 'ADMIN' | 'SYSTEM';
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

const REDACTED_KEYS = /password|secret|token|signature|otp|cvv|card/i;

/** Strips anything that looks like a credential before it reaches the log table. */
function redact(input: Record<string, unknown> | null | undefined) {
  if (!input) return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = REDACTED_KEYS.test(key) ? '[redacted]' : value;
  }
  return output;
}

/** Audit writes must never break the action they are recording. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const headerList = await headers();
    await db.insert(t.auditLogs).values({
      actorType: input.actorType ?? 'ADMIN',
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: redact(input.metadata),
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent')?.slice(0, 400) ?? null,
    });
  } catch (error) {
    console.error('[audit] failed to record entry', error);
  }
}

export async function recordLoginEvent(input: {
  subjectType: 'CUSTOMER' | 'ADMIN';
  subjectId?: string | null;
  email: string;
  success: boolean;
}): Promise<void> {
  try {
    const headerList = await headers();
    await db.insert(t.loginEvents).values({
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      email: input.email,
      success: input.success,
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent')?.slice(0, 400) ?? null,
    });
  } catch (error) {
    console.error('[audit] failed to record login event', error);
  }
}
