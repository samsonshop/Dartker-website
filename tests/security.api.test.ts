/**
 * Authorization and input-handling tests against a running server.
 *
 * The unit tests prove the pricing maths; these prove the parts an attacker
 * actually reaches: that protected endpoints refuse an anonymous caller, that a
 * payment can only be confirmed by a valid signature, and that hostile input is
 * rejected at the boundary instead of reaching the database.
 *
 *   npm start              # or npm run dev, in one terminal
 *   npm run test:security  # in another
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import 'dotenv/config';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

before(async () => {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/search/suggestions?q=cl`);
  } catch (error) {
    assert.fail(`no server on ${BASE} — start it with \`npm start\` (${(error as Error).message})`);
  }
  assert.ok(response.ok, `server on ${BASE} answered ${response.status}`);
});

after(async () => {
  // The signup tests write real audit rows; don't leave them behind.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `delete from audit_logs
      where action = 'newsletter.subscribe'
        and (entity_id like 'burst.%@example.com' or entity_id like '%@example.com')`,
  );
  await pool.end();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const ADDRESS = {
  fullName: 'Security Test',
  phone: '9876543210',
  line1: '1 Test Street',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '641004',
  country: 'India',
};

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('admin endpoints reject anonymous callers', () => {
  for (const kind of ['sales', 'orders', 'products', 'inventory', 'customers', 'categories']) {
    it(`refuses the ${kind} report export`, async () => {
      const response = await fetch(`${BASE}/api/admin/reports?type=${kind}`);
      assert.ok(
        response.status === 401 || response.status === 403,
        `an anonymous caller got ${response.status} for the ${kind} export`,
      );
      const text = await response.text();
      assert.ok(!text.includes('@'), 'the refusal body leaked what looks like customer data');
    });
  }

  it('does not leak customer records through the report endpoint', async () => {
    const response = await fetch(`${BASE}/api/admin/reports?type=customers`);
    const text = await response.text();
    assert.ok(!/Name,Email,Phone/i.test(text), 'the customer CSV was served without authentication');
  });
});

describe('customer endpoints reject anonymous callers', () => {
  it('refuses to read a wishlist', async () => {
    const response = await fetch(`${BASE}/api/wishlist`);
    assert.equal(response.status, 401);
    const body = (await response.json()) as { productIds?: string[] };
    assert.deepEqual(body.productIds ?? [], [], 'an anonymous read returned wishlist contents');
  });

  it('refuses to add to a wishlist', async () => {
    const response = await fetch(`${BASE}/api/wishlist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: NIL_UUID }),
    });
    assert.equal(response.status, 401);
  });

  it('refuses to delete from a wishlist', async () => {
    const response = await fetch(`${BASE}/api/wishlist`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: NIL_UUID }),
    });
    assert.equal(response.status, 401);
  });
});

describe('payment confirmation is server-side only', () => {
  it('rejects a webhook with no signature', async () => {
    const response = await post('/api/webhooks/razorpay', {
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_forged', id: 'pay_forged' } } },
    });
    assert.equal(response.status, 400, 'an unsigned webhook was accepted');
  });

  it('rejects a webhook with a forged signature', async () => {
    const response = await post(
      '/api/webhooks/razorpay',
      { event: 'order.paid', payload: { payment: { entity: { order_id: 'order_forged', id: 'pay_forged' } } } },
      { 'x-razorpay-signature': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    );
    assert.equal(response.status, 400, 'a forged webhook signature was accepted');
  });

  it('refuses to mark an order paid on the browser\'s word alone', async () => {
    const response = await post('/api/checkout/verify', {
      razorpayOrderId: 'order_forged',
      razorpayPaymentId: 'pay_forged',
      signature: 'forged',
      orderNumber: 'ORD-DOES-NOT-EXIST',
    });
    assert.ok(response.status >= 400, `a forged payment confirmation returned ${response.status}`);
  });
});

describe('checkout input validation', () => {
  function body(overrides: Record<string, unknown> = {}) {
    return {
      lines: [{ productId: NIL_UUID, variantId: NIL_UUID, quantity: 1 }],
      paymentMethod: 'COD',
      email: 'security.test@example.com',
      shippingAddress: ADDRESS,
      billingSameAsShipping: true,
      saveAddress: false,
      idempotencyKey: `sec-${Date.now()}-${Math.random()}`,
      ...overrides,
    };
  }

  it('rejects a negative quantity', async () => {
    const response = await post('/api/checkout', body({ lines: [{ productId: NIL_UUID, variantId: NIL_UUID, quantity: -5 }] }));
    assert.equal(response.status, 400);
  });

  it('rejects a zero quantity', async () => {
    const response = await post('/api/checkout', body({ lines: [{ productId: NIL_UUID, variantId: NIL_UUID, quantity: 0 }] }));
    assert.equal(response.status, 400);
  });

  it('rejects an absurd quantity', async () => {
    const response = await post('/api/checkout', body({ lines: [{ productId: NIL_UUID, variantId: NIL_UUID, quantity: 1_000_000_000 }] }));
    assert.equal(response.status, 400);
  });

  it('rejects a fractional quantity', async () => {
    const response = await post('/api/checkout', body({ lines: [{ productId: NIL_UUID, variantId: NIL_UUID, quantity: 1.5 }] }));
    assert.equal(response.status, 400);
  });

  it('rejects an unknown payment method', async () => {
    const response = await post('/api/checkout', body({ paymentMethod: 'FREE_MONEY' }));
    assert.equal(response.status, 400);
  });

  it('rejects a malformed email', async () => {
    const response = await post('/api/checkout', body({ email: 'not-an-email' }));
    assert.equal(response.status, 400);
  });

  it('rejects a malformed pincode', async () => {
    const response = await post('/api/checkout', body({ shippingAddress: { ...ADDRESS, pincode: 'abc' } }));
    assert.equal(response.status, 400);
  });

  it('rejects an empty cart', async () => {
    const response = await post('/api/checkout', body({ lines: [] }));
    assert.equal(response.status, 400);
  });

  it('rejects a non-UUID product id instead of querying with it', async () => {
    const response = await post('/api/checkout', body({ lines: [{ productId: "' OR 1=1--", variantId: NIL_UUID, quantity: 1 }] }));
    assert.equal(response.status, 400);
  });
});

describe('hostile input reaches no query', () => {
  const payloads = [
    "' OR 1=1--",
    "'; drop table products;--",
    "%' UNION SELECT NULL,NULL--",
    '\\x00',
    '${jndi:ldap://x}',
  ];

  for (const payload of payloads) {
    it(`handles ${JSON.stringify(payload.slice(0, 24))} in search suggestions`, async () => {
      const response = await fetch(`${BASE}/api/search/suggestions?q=${encodeURIComponent(payload)}`);
      assert.equal(response.status, 200, 'injection-shaped input caused an error response');
      const data = (await response.json()) as { results: unknown[] };
      assert.ok(Array.isArray(data.results), 'results is not an array');
    });
  }

  it('renders a search term as text, never as markup', async () => {
    const xss = '<img src=x onerror=alert(1)>';
    const response = await fetch(`${BASE}/search?q=${encodeURIComponent(xss)}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(
      !html.includes('<img src=x onerror='),
      'the search term was reflected into the page as live markup',
    );
  });

  it('rejects a non-email newsletter signup', async () => {
    for (const value of ['drop table users', '<script>alert(1)</script>@x.com', 'a'.repeat(300)]) {
      const response = await post('/api/newsletter', { email: value });
      // 429 is also a refusal: the rate-limit test below may have spent this
      // IP's budget already. What matters is that it was not accepted.
      assert.ok(
        response.status === 400 || response.status === 429,
        `newsletter answered ${response.status} for ${JSON.stringify(value.slice(0, 30))}`,
      );
    }
  });

  it('rejects a malformed analytics beacon', async () => {
    const tooLong = await post('/api/track', { path: 'x'.repeat(5000) });
    assert.equal(tooLong.status, 400);

    const wrongType = await post('/api/track', { path: '/', productId: 123 });
    assert.equal(wrongType.status, 400);
  });

  it('rejects a body that is not JSON at all', async () => {
    const response = await fetch(`${BASE}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json',
    });
    assert.ok(
      response.status === 400 || response.status === 429,
      `answered ${response.status} for a non-JSON body`,
    );
  });
});

describe('write endpoints are rate limited', () => {
  // Both endpoints insert a database row per request with no authentication, so
  // an unthrottled endpoint is a free way to grow the table without bound.
  it('throttles a burst of newsletter signups', async () => {
    const statuses = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        post('/api/newsletter', { email: `burst.${Date.now()}.${index}@example.com` }).then((r) => r.status),
      ),
    );
    const throttled = statuses.filter((status) => status === 429).length;
    assert.ok(
      throttled > 0,
      `30 rapid signups all succeeded (${statuses.filter((s) => s === 200).length} x 200) — the endpoint writes an audit_logs row per call with no rate limit`,
    );
  });

  it('caps how many page views a burst of beacons can record', async () => {
    // The beacon deliberately answers 200 even when throttled — a 429 in the
    // browser console would be noise for a fire-and-forget call. So the limit has
    // to be verified by what reached the table, not by the status code.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const path = `/burst-${Date.now()}`;
    try {
      // A visitor cookie is required before the beacon records anything.
      const root = await fetch(`${BASE}/`);
      const cookie = (root.headers.getSetCookie?.() ?? [])
        .find((entry) => entry.startsWith('dartler_vid='))
        ?.split(';')[0];
      assert.ok(cookie, 'no visitor cookie was issued');

      const attempts = 120;
      await Promise.all(
        Array.from({ length: attempts }, () =>
          fetch(`${BASE}/api/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ path }),
          }),
        ),
      );

      const { rows } = await pool.query<{ count: number }>(
        'select count(*)::int as count from page_views where path = $1',
        [path],
      );
      assert.ok(
        rows[0].count < attempts,
        `all ${attempts} beacons were recorded — the endpoint writes a page_views row per call with no rate limit`,
      );
    } finally {
      await pool.query('delete from page_views where path = $1', [path]);
      await pool.end();
    }
  });
});

describe('cookies are hardened', () => {
  it('sets the visitor cookie httpOnly and sameSite', async () => {
    const response = await fetch(`${BASE}/`);
    const cookies = response.headers.getSetCookie?.() ?? [];
    const visitor = cookies.find((cookie) => cookie.startsWith('dartler_vid='));
    assert.ok(visitor, 'no visitor cookie was set');
    assert.match(visitor, /HttpOnly/i, 'visitor cookie is readable from JavaScript');
    assert.match(visitor, /SameSite=lax/i, 'visitor cookie has no SameSite protection');
  });
});
