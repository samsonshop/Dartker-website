import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * A single pooled connection reused across hot reloads in development.
 * Next.js re-evaluates modules on every edit; without this the process would
 * leak a new pool per reload and exhaust Postgres connections.
 */
declare global {
  // eslint-disable-next-line no-var
  var __dartlerPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and point it at your PostgreSQL database.',
    );
  }

  const needsSsl =
    /sslmode=require/.test(connectionString) ||
    (process.env.NODE_ENV === 'production' && !/localhost|127\.0\.0\.1/.test(connectionString));

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = global.__dartlerPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global.__dartlerPool = pool;

export const db = drizzle(pool, { schema, logger: process.env.DRIZZLE_LOG === 'true' });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export { schema };
export * from './schema';
