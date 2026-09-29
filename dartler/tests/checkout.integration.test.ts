/**
 * End-to-end checks against a running server and a seeded database.
 * These exercise the parts that are easy to get wrong and impossible to verify
 * from unit tests alone: server-side pricing, atomic stock, and idempotency.
 *
 *   npm run dev          # in one terminal
 *   npm run test:e2e     # in another
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import 'dotenv/config';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Target {
  productId: string;
  variantId: string;
  quantity: number;
  pricePaise: number;
}

async function pickVariantWithStock(minimum = 3, maximum = 1_000_000): Promise<Target> {
  const { rows } = await pool.query<{
    product_id: string;
    variant_id: string;
    quantity: number;
    price_paise: number;
  }>(
    `select i.product_id, i.variant_id, i.quantity, p.price_paise
       from inventory i
       join products p on p.id = i.product_id
      where i.quantity between $1 and $2 and p.status = 'ACTIVE' and i.variant_id is not null
      order by i.quantity desc
      limit 1`,
    [minimum, maximum],
  );
  assert.ok(rows[0], 'the database needs seeded stock — run `npm run db:seed`');
  return {
    productId: rows[0].product_id,
    variantId: rows[0].variant_id,
    quantity: rows[0].quantity,
    pricePaise: rows[0].price_paise,
  };
}

async function stockFor(variantId: string): Promise<number> {
  const { rows } = await pool.query<{ quantity: number }>(
    'select quantity from inventory where variant_id = $1',
    [variantId],
  );
  return rows[0]?.quantity ?? 0;
}

const address = {
  fullName: 'Automated Test',
  phone: '9876543210',
  line1: '1 Test Street',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '641004',
  country: 'India',
};

function checkoutBody(target: Target, idempotencyKey: string, quantity = 1) {
  return {
    lines: [{ productId: target.productId, variantId: target.variantId, quantity }],
    paymentMethod: 'COD',
    email: 'automated.test@example.com',
    shippingAddress: address,
    billingSameAsShipping: true,
    saveAddress: false,
    idempotencyKey,
  };
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()) as Record<string, unknown> };
}

let serverUp = false;

before(async () => {
  try {
    const response = await fetch(`${BASE}/api/search/suggestions?q=cl`);
    serverUp = response.ok;
  } catch {
    serverUp = false;
  }
});

after(async () => {
  await pool.query(`delete from orders where email = 'automated.test@example.com'`);
  await pool.end();
});

describe('checkout API', () => {
  it('recomputes totals server-side and decrements stock exactly once', async (context) => {
    if (!serverUp) return context.skip('dev server is not running on ' + BASE);

    const target = await pickVariantWithStock();
    const before = await stockFor(target.variantId);

    const key = `test-${Date.now()}-a`;
    const first = await post('/api/checkout', checkoutBody(target, key));

    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.status, 'confirmed');
    assert.ok(typeof first.data.orderNumber === 'string');

    const afterFirst = await stockFor(target.variantId);
    assert.equal(afterFirst, before - 1, 'exactly one unit should leave stock');

    const { rows } = await pool.query<{
      subtotal_paise: number;
      tax_paise: number;
      total_paise: number;
      shipping_paise: number;
    }>('select subtotal_paise, tax_paise, shipping_paise, total_paise from orders where order_number = $1', [
      first.data.orderNumber,
    ]);
    const order = rows[0];
    assert.equal(order.subtotal_paise, target.pricePaise, 'price comes from the database, not the client');
    assert.equal(
      order.total_paise,
      order.subtotal_paise + order.tax_paise + order.shipping_paise,
      'the total is the sum of its parts',
    );
  });

  it('reuses the same order when the key is replayed (double submit)', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    const target = await pickVariantWithStock();
    const before = await stockFor(target.variantId);
    const key = `test-${Date.now()}-b`;

    const first = await post('/api/checkout', checkoutBody(target, key));
    const replay = await post('/api/checkout', checkoutBody(target, key));

    assert.equal(replay.status, 200);
    assert.equal(replay.data.orderNumber, first.data.orderNumber, 'the same order comes back');
    assert.equal(await stockFor(target.variantId), before - 1, 'stock moved only once');
  });

  it('refuses an order for more units than exist', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    // Deliberately a low-stock variant, so "stock + 1" stays inside the
    // per-line maximum of 20 and the request is genuinely over-ordering.
    const target = await pickVariantWithStock(1, 15);
    const before = await stockFor(target.variantId);

    const result = await post(
      '/api/checkout',
      checkoutBody(target, `test-${Date.now()}-c`, before + 1),
    );

    assert.ok(result.status >= 400, `over-ordering must fail (asked ${before + 1} of ${before})`);
    assert.equal(await stockFor(target.variantId), before, 'stock is untouched on failure');
  });

  it('rejects a malformed cart', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    const result = await post('/api/checkout', { lines: [], paymentMethod: 'COD' });
    assert.equal(result.status, 400);
  });

  it('never trusts a client-supplied price', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    const target = await pickVariantWithStock();
    const key = `test-${Date.now()}-d`;
    const body = {
      ...checkoutBody(target, key),
      // A tampered payload: extra fields are ignored, the server prices it itself.
      totalPaise: 1,
      unitPricePaise: 1,
    };

    const result = await post('/api/checkout', body);
    assert.equal(result.status, 200);

    const { rows } = await pool.query<{ total_paise: number }>(
      'select total_paise from orders where order_number = $1',
      [result.data.orderNumber],
    );
    assert.ok(rows[0].total_paise > 1, 'the injected total was ignored');
  });
});

describe('cart resolve API', () => {
  it('prices a cart from the database', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    const target = await pickVariantWithStock();
    const result = await post('/api/cart/resolve', {
      lines: [{ productId: target.productId, variantId: target.variantId, quantity: 2 }],
    });

    assert.equal(result.status, 200);
    const totals = result.data.totals as { subtotalPaise: number; taxPaise: number };
    assert.equal(totals.subtotalPaise, target.pricePaise * 2);
    assert.ok(totals.taxPaise > 0);
  });

  it('caps a quantity above available stock instead of failing', async (context) => {
    if (!serverUp) return context.skip('dev server is not running');

    const target = await pickVariantWithStock();
    const result = await post('/api/cart/resolve', {
      lines: [{ productId: target.productId, variantId: target.variantId, quantity: 20 }],
    });

    const lines = result.data.lines as { quantity: number; availableStock: number }[];
    assert.ok(lines[0].quantity <= lines[0].availableStock);
  });
});
