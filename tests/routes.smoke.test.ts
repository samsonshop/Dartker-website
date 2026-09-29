/**
 * Route smoke tests: every page a customer can reach must return the status code
 * it claims to. Cheap to run, and it catches the two regressions that are easy
 * to ship unnoticed — a page that 500s, and a "not found" page that answers 200
 * (a soft 404, which search engines will happily index).
 *
 *   npm start            # or npm run dev, in one terminal
 *   npm run test:routes  # in another
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { Pool } from 'pg';
import 'dotenv/config';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let productSlug = '';
let categorySlug = '';

before(async () => {
  // Fail loudly rather than skipping: a silent skip reads like a pass.
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/search/suggestions?q=cl`);
  } catch (error) {
    assert.fail(`no server on ${BASE} — start it with \`npm start\` (${(error as Error).message})`);
  }
  assert.ok(response.ok, `server on ${BASE} answered ${response.status}`);

  const product = await pool.query<{ slug: string }>(
    `select slug from products where status = 'ACTIVE' order by slug limit 1`,
  );
  const category = await pool.query<{ slug: string }>(
    `select c.slug from categories c
       join products p on p.category_id = c.id and p.status = 'ACTIVE'
      where c.is_active = true
      group by c.slug
      limit 1`,
  );
  assert.ok(product.rows[0], 'the database needs seeded products — run `npm run db:seed`');
  assert.ok(category.rows[0], 'the database needs a seeded, non-empty category');
  productSlug = product.rows[0].slug;
  categorySlug = category.rows[0].slug;
  await pool.end();
});

/** Follows no redirects, so we can assert on the redirect itself. */
async function head(path: string) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return { status: response.status, location: response.headers.get('location'), body: await response.text() };
}

/**
 * The rendered <h1>, or null. Note that page *text* is a poor signal in the App
 * Router: the not-found boundary is serialised into the RSC payload of every
 * response, so searching the body for "couldn't find that page" matches
 * everywhere. The rendered h1 is the reliable indicator of what actually built.
 */
function renderedH1(body: string): string | null {
  const match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

describe('public pages', () => {
  const staticPaths = [
    '/',
    '/category',
    '/search',
    '/search?q=clip',
    '/cart',
    '/checkout',
    '/login',
    '/register',
    '/about',
    '/contact',
    '/faq',
    '/track-order',
    '/policies/shipping',
    '/policies/returns',
    '/policies/terms',
    '/policies/privacy',
    '/admin/login',
  ];

  for (const path of staticPaths) {
    it(`serves ${path}`, async () => {
      const { status } = await head(path);
      assert.equal(status, 200, `${path} answered ${status}`);
    });
  }

  it('serves a real product page', async () => {
    const { status, body } = await head(`/product/${productSlug}`);
    assert.equal(status, 200);
    assert.notEqual(
      renderedH1(body),
      'We couldn’t find that page',
      `a seeded product (${productSlug}) rendered the not-found view`,
    );
  });

  it('serves a real category page', async () => {
    const { status, body } = await head(`/category/${categorySlug}`);
    assert.equal(status, 200);
    assert.notEqual(
      renderedH1(body),
      'We couldn’t find that page',
      `a seeded category (${categorySlug}) rendered the not-found view`,
    );
  });

  it('serves robots.txt and sitemap.xml', async () => {
    const robots = await head('/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.body, /Disallow: \/admin/, 'admin must be excluded from crawling');

    const sitemap = await head('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.body, /<urlset/, 'sitemap is not a urlset');
  });

  it('keeps private areas out of the sitemap', async () => {
    const { body } = await head('/sitemap.xml');
    for (const fragment of ['/admin', '/account', '/checkout', '/cart']) {
      assert.ok(!body.includes(`${fragment}<`), `sitemap lists ${fragment}`);
    }
  });

  it('omits inactive categories from the sitemap', async () => {
    // An inactive category renders "not found", so advertising it in the sitemap
    // would send crawlers straight at a dead end.
    const inactivePool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await inactivePool.query<{ slug: string }>(
      'select slug from categories where is_active = false limit 5',
    );
    await inactivePool.end();
    if (rows.length === 0) return; // nothing inactive seeded; nothing to prove

    const { body } = await head('/sitemap.xml');
    for (const row of rows) {
      assert.ok(!body.includes(`/category/${row.slug}<`), `sitemap lists inactive category ${row.slug}`);
    }
  });
});

describe('not-found handling', () => {
  it('returns 404 for an unknown path', async () => {
    const { status } = await head('/definitely-not-a-real-page');
    assert.equal(status, 404);
  });

  it('returns 404 for an unknown product', async () => {
    const { status } = await head('/product/no-such-product-abc123');
    assert.equal(
      status,
      404,
      'an unknown product answers 200 with not-found content (a soft 404) — call notFound() so crawlers see a real 404',
    );
  });

  it('returns 404 for an unknown category', async () => {
    const { status } = await head('/category/no-such-category-abc123');
    assert.equal(
      status,
      404,
      'an unknown category answers 200 with not-found content (a soft 404) — call notFound() instead',
    );
  });

  it('returns 404 for an inactive category rather than 200', async () => {
    const inactivePool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await inactivePool.query<{ slug: string }>(
      'select slug from categories where is_active = false limit 1',
    );
    await inactivePool.end();
    if (!rows[0]) return;

    const { status } = await head(`/category/${rows[0].slug}`);
    assert.equal(status, 404, `inactive category /category/${rows[0].slug} answered ${status}`);
  });
});

/**
 * `requireCustomer` / `requireAdmin` call `redirect()` from inside a layout, which
 * resolves after the response has begun streaming. The guard therefore arrives as
 * a redirect instruction inside the RSC payload with an HTTP 200 envelope, not as
 * a 307 — so these tests assert the invariant that actually matters: an anonymous
 * request must be told to go to the login page and must not render any
 * authenticated content.
 */
describe('guarded areas', () => {
  const customerPaths = ['/account', '/account/orders', '/account/addresses', '/account/wishlist', '/account/requests'];
  const adminPaths = ['/admin', '/admin/orders', '/admin/products', '/admin/settings', '/admin/roles'];

  for (const path of customerPaths) {
    it(`turns a signed-out visitor away from ${path}`, async () => {
      const { body } = await head(path);
      assert.match(body, /\/login/, `${path} carries no redirect to the login page`);
      // No authenticated shell: the account navigation must not have rendered.
      assert.ok(!/Sign out|Log out/i.test(body), `${path} rendered a signed-in navigation`);
    });
  }

  for (const path of adminPaths) {
    it(`turns a signed-out visitor away from ${path}`, async () => {
      const { body } = await head(path);
      assert.match(body, /\/admin\/login/, `${path} carries no redirect to the admin login`);
      // The console shell renders the role name and sidebar; neither may appear.
      assert.ok(!/Super Admin|Catalogue Manager/.test(body), `${path} rendered the admin console shell`);
    });
  }

  it('leaks no customer or order data to an anonymous request', async () => {
    // Canaries straight from the database — none of these may cross the guard.
    const canaryPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const [orders, profiles] = await Promise.all([
      canaryPool.query<{ customer_name: string; email: string; phone: string }>(
        `select customer_name, email, phone from orders order by placed_at desc limit 1`,
      ),
      canaryPool.query<{ full_name: string; email: string }>(
        `select full_name, email from profiles where email not like '%automated%' limit 1`,
      ),
    ]);
    await canaryPool.end();

    const canaries = [
      orders.rows[0]?.customer_name,
      orders.rows[0]?.email,
      orders.rows[0]?.phone,
      profiles.rows[0]?.full_name,
      profiles.rows[0]?.email,
    ].filter((value): value is string => Boolean(value));

    for (const path of [...adminPaths, ...customerPaths, '/admin/customers', '/admin/analytics']) {
      const { body } = await head(path);
      for (const canary of canaries) {
        assert.ok(!body.includes(canary), `${path} leaked "${canary}" to an anonymous caller`);
      }
    }
  });

  it('returns the visitor to the page they asked for after signing in', async () => {
    // A visitor bounced from /account/orders should come back to /account/orders,
    // not to /account.
    const { body } = await head('/account/orders');
    // The redirect target appears in the RSC payload as a route segment — with no
    // leading slash, and followed by the status code (";307;"), so stop at those.
    const next = body.match(/login\?next=([^"\\&;]+)/)?.[1];
    assert.ok(next, 'no next= parameter was issued with the login redirect');
    assert.equal(
      decodeURIComponent(next),
      '/account/orders',
      'the next= parameter points at /account rather than the page that was requested',
    );
  });
});

describe('SEO basics', () => {
  it('gives every indexable page a unique, single-suffixed title', async () => {
    const paths = ['/', '/category', `/category/${categorySlug}`, `/product/${productSlug}`, '/about', '/faq'];
    const titles = new Map<string, string>();

    for (const path of paths) {
      const { body } = await head(path);
      const title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      assert.ok(title.length > 0, `${path} has no <title>`);
      assert.ok(title.length <= 65, `${path} title is ${title.length} chars: "${title}"`);

      const suffixes = title.match(/\| Dartler/g)?.length ?? 0;
      assert.ok(
        suffixes <= 1,
        `${path} title repeats the brand suffix — metadata sets "| Dartler" and the layout template adds it again: "${title}"`,
      );
      titles.set(path, title);
    }

    const unique = new Set(titles.values());
    assert.equal(unique.size, titles.size, `duplicate titles: ${[...titles.entries()].map(([p, t]) => `${p}="${t}"`).join(', ')}`);
  });

  it('gives the home page exactly one h1', async () => {
    const { body } = await head('/');
    const h1s = body.match(/<h1[\s>]/g)?.length ?? 0;
    assert.equal(h1s, 1, `the home page has ${h1s} <h1> elements — it needs exactly one for SEO and screen readers`);
  });

  it('gives every indexable page a meta description', async () => {
    for (const path of ['/', '/category', `/product/${productSlug}`, '/about', '/faq']) {
      const { body } = await head(path);
      assert.match(body, /<meta name="description"/, `${path} has no meta description`);
    }
  });

  it('escapes JSON-LD so a product name cannot break out of the script tag', async () => {
    const { body } = await head(`/product/${productSlug}`);
    const blocks = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    assert.ok(blocks.length > 0, 'the product page emits no JSON-LD');
    for (const block of blocks) {
      const inner = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      assert.ok(
        !inner.includes('</script'),
        'JSON-LD contains a raw closing script tag — escape "<" as \\u003c before injecting',
      );
      assert.doesNotThrow(() => JSON.parse(inner), 'JSON-LD is not valid JSON');
    }
  });
});

describe('security headers', () => {
  it('sets the hardening headers on a page response', async () => {
    const response = await fetch(`${BASE}/`);
    const expected: [string, RegExp][] = [
      ['x-content-type-options', /nosniff/],
      ['x-frame-options', /SAMEORIGIN|DENY/],
      ['referrer-policy', /strict-origin/],
      ['permissions-policy', /camera=\(\)/],
    ];
    for (const [header, pattern] of expected) {
      const value = response.headers.get(header);
      assert.ok(value, `${header} is not set`);
      assert.match(value, pattern, `${header} is "${value}"`);
    }
  });

  it('does not advertise the framework', async () => {
    const response = await fetch(`${BASE}/`);
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  it('sets a Content-Security-Policy', async () => {
    const response = await fetch(`${BASE}/`);
    assert.ok(
      response.headers.get('content-security-policy'),
      'no CSP header — the last line of defence against injected script is missing',
    );
  });
});
