import 'server-only';

/**
 * Fixed-window, in-process rate limiting.
 *
 * Deliberately dependency-free: it protects a single server instance and needs
 * no Redis. That is the right trade for the endpoints it guards here — an
 * unauthenticated write that inserts one row per call. Behind more than one
 * instance each process keeps its own counter, so the effective limit is
 * `limit x instances`; move the store to Redis if that matters.
 *
 * Entries are swept lazily on write, so the map cannot grow without bound.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Map<string, Window>>();

function bucket(name: string): Map<string, Window> {
  let existing = buckets.get(name);
  if (!existing) {
    existing = new Map();
    buckets.set(name, existing);
  }
  return existing;
}

/** Drops expired windows so an endpoint hit with many distinct keys stays bounded. */
function sweep(store: Map<string, Window>, now: number): void {
  if (store.size < 1000) return;
  for (const [key, window] of store) {
    if (now > window.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  /** False when the caller has exhausted the window. */
  allowed: boolean;
  /** Calls left in the current window, after this one. */
  remaining: number;
  /** Seconds until the window resets — suitable for a `Retry-After` header. */
  retryAfterSeconds: number;
}

/**
 * Counts this call against `key` and reports whether it may proceed.
 * Use for plain request throttling, where every call counts.
 */
export function rateLimit(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const store = bucket(name);
  const now = Date.now();
  sweep(store, now);

  const window = store.get(key);
  if (!window || now > window.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (window.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  window.count += 1;
  return {
    allowed: true,
    remaining: limit - window.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Read-only check, for flows that only count *failures* (sign-in, say) and so
 * need to test the limit before knowing whether to record against it.
 */
export function isRateLimited(name: string, key: string, limit: number): boolean {
  const window = bucket(name).get(key);
  if (!window) return false;
  if (Date.now() > window.resetAt) {
    bucket(name).delete(key);
    return false;
  }
  return window.count >= limit;
}

/** Records one strike against `key`. Pairs with `isRateLimited`. */
export function recordFailure(name: string, key: string, windowMs: number): void {
  const store = bucket(name);
  const now = Date.now();
  sweep(store, now);

  const window = store.get(key);
  if (!window || now > window.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  window.count += 1;
}

/** Clears the counter for `key` — call on a successful sign-in. */
export function clearRateLimit(name: string, key: string): void {
  bucket(name).delete(key);
}

/**
 * Best-effort client identity for anonymous endpoints. Behind a proxy the
 * left-most `x-forwarded-for` entry is the client; it is spoofable, so this is a
 * throttle on casual abuse, not an access control.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Standard 429 body and headers. */
export function tooManyRequests(result: RateLimitResult, message: string): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'Cache-Control': 'no-store',
      },
    },
  );
}
