import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculatePricing, validateCoupon } from '../src/lib/pricing';
import {
  discountPercent,
  formatPaiseShort,
  paiseToRupees,
  rupeesToPaise,
  taxFromBasisPoints,
} from '../src/lib/money';
import { jsonLdScript, slugify, stripBrandSuffix, toCsv } from '../src/lib/utils';
import { paginationRange } from '../src/components/ui/Pagination';

const SETTINGS = { freeShippingAbovePaise: 99900, flatShippingPaise: 4900 };

describe('money', () => {
  it('parses rupee input into integer paise without float drift', () => {
    assert.equal(rupeesToPaise('299'), 29900);
    assert.equal(rupeesToPaise('299.99'), 29999);
    assert.equal(rupeesToPaise('₹1,299.50'), 129950);
    assert.equal(rupeesToPaise('0.1'), 10);
    assert.ok(Number.isNaN(rupeesToPaise('')));
    assert.ok(Number.isNaN(rupeesToPaise('abc')));
  });

  it('round-trips paise and rupees', () => {
    assert.equal(paiseToRupees(129950), 1299.5);
    assert.equal(rupeesToPaise(String(paiseToRupees(129950))), 129950);
  });

  it('formats Indian currency', () => {
    assert.match(formatPaiseShort(29900), /299/);
    assert.match(formatPaiseShort(129950), /1,299\.50/);
  });

  it('computes a discount percentage only when there is one', () => {
    assert.equal(discountPercent(29900, 49900), 40);
    assert.equal(discountPercent(29900, null), null);
    assert.equal(discountPercent(29900, 20000), null, 'compare-at below price is not a discount');
  });

  it('computes GST from basis points', () => {
    assert.equal(taxFromBasisPoints(10000, 1800), 1800);
    assert.equal(taxFromBasisPoints(29900, 1800), 5382);
    assert.equal(taxFromBasisPoints(0, 1800), 0);
  });
});

describe('calculatePricing', () => {
  const lines = [
    { unitPricePaise: 29900, quantity: 2, taxBps: 1800 },
    { unitPricePaise: 44900, quantity: 1, taxBps: 1800 },
  ];

  it('adds up the subtotal from unit price and quantity', () => {
    const result = calculatePricing(lines, SETTINGS);
    assert.equal(result.subtotalPaise, 29900 * 2 + 44900);
  });

  it('charges flat shipping below the free-shipping threshold', () => {
    const result = calculatePricing([{ unitPricePaise: 29900, quantity: 1, taxBps: 1800 }], SETTINGS);
    assert.equal(result.shippingPaise, 4900);
  });

  it('gives free shipping at and above the threshold', () => {
    const exactly = calculatePricing(
      [{ unitPricePaise: 99900, quantity: 1, taxBps: 1800 }],
      SETTINGS,
    );
    assert.equal(exactly.shippingPaise, 0);
  });

  it('totals subtotal + tax + shipping', () => {
    const result = calculatePricing([{ unitPricePaise: 50000, quantity: 1, taxBps: 1800 }], SETTINGS);
    assert.equal(result.taxPaise, 9000);
    assert.equal(result.shippingPaise, 4900);
    assert.equal(result.totalPaise, 50000 + 9000 + 4900);
  });

  it('applies a percentage coupon and caps it', () => {
    const result = calculatePricing(lines, SETTINGS, {
      type: 'PERCENT',
      value: 10,
      minOrderPaise: 0,
      maxDiscountPaise: 5000,
    });
    assert.equal(result.discountPaise, 5000, 'the cap wins over the raw 10%');
  });

  it('applies a flat coupon', () => {
    const result = calculatePricing(lines, SETTINGS, {
      type: 'FIXED',
      value: 20000,
      minOrderPaise: 0,
      maxDiscountPaise: null,
    });
    assert.equal(result.discountPaise, 20000);
  });

  it('never discounts more than the cart is worth', () => {
    const result = calculatePricing([{ unitPricePaise: 10000, quantity: 1, taxBps: 1800 }], SETTINGS, {
      type: 'FIXED',
      value: 50000,
      minOrderPaise: 0,
      maxDiscountPaise: null,
    });
    assert.equal(result.discountPaise, 10000);
    assert.equal(result.totalPaise, 0, 'a fully discounted cart is free and ships free');
  });

  it('ignores a coupon below its minimum order value', () => {
    const result = calculatePricing([{ unitPricePaise: 10000, quantity: 1, taxBps: 1800 }], SETTINGS, {
      type: 'PERCENT',
      value: 10,
      minOrderPaise: 99900,
      maxDiscountPaise: null,
    });
    assert.equal(result.discountPaise, 0);
  });

  it('spreads the discount across lines so the parts sum to the whole', () => {
    const result = calculatePricing(
      [
        { unitPricePaise: 33333, quantity: 1, taxBps: 1800 },
        { unitPricePaise: 33333, quantity: 1, taxBps: 1800 },
        { unitPricePaise: 33333, quantity: 1, taxBps: 1800 },
      ],
      SETTINGS,
      { type: 'FIXED', value: 10000, minOrderPaise: 0, maxDiscountPaise: null },
    );
    const spread = result.lines.reduce((total, line) => total + line.discountPaise, 0);
    assert.equal(spread, result.discountPaise, 'no rounding paise are lost or invented');
  });

  it('per-line taxes sum to the order tax', () => {
    const result = calculatePricing(lines, SETTINGS, {
      type: 'PERCENT',
      value: 15,
      minOrderPaise: 0,
      maxDiscountPaise: null,
    });
    const lineTax = result.lines.reduce((total, line) => total + line.taxPaise, 0);
    assert.equal(lineTax, result.taxPaise);
  });

  it('handles an empty cart without dividing by zero', () => {
    const result = calculatePricing([], SETTINGS);
    assert.equal(result.subtotalPaise, 0);
    assert.equal(result.shippingPaise, 0);
    assert.equal(result.totalPaise, 0);
  });
});

describe('validateCoupon', () => {
  const base = {
    isActive: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usedCount: 0,
    minOrderPaise: 0,
  };

  it('accepts a live coupon', () => {
    assert.deepEqual(validateCoupon(base, 50000), { ok: true });
  });

  it('rejects an inactive coupon', () => {
    assert.equal(validateCoupon({ ...base, isActive: false }, 50000).ok, false);
  });

  it('rejects an expired coupon', () => {
    const result = validateCoupon({ ...base, endsAt: new Date('2020-01-01') }, 50000);
    assert.equal(result.ok, false);
  });

  it('rejects a coupon that has not started', () => {
    const result = validateCoupon({ ...base, startsAt: new Date('2999-01-01') }, 50000);
    assert.equal(result.ok, false);
  });

  it('rejects a coupon at its usage limit', () => {
    const result = validateCoupon({ ...base, usageLimit: 5, usedCount: 5 }, 50000);
    assert.equal(result.ok, false);
  });

  it('rejects a cart below the minimum order value', () => {
    const result = validateCoupon({ ...base, minOrderPaise: 99900 }, 50000);
    assert.equal(result.ok, false);
  });
});

describe('jsonLdScript', () => {
  it('makes a script-tag breakout impossible', () => {
    // The attack: an admin-entered product name that closes the tag early, so
    // everything after it is parsed as HTML rather than as JSON-LD data.
    const hostile = { name: '</script><script>alert(1)</script>' };
    const output = jsonLdScript(hostile);

    assert.ok(!output.includes('</script'), 'a raw closing script tag survived');
    assert.ok(!output.includes('<'), 'a raw "<" survived');
    assert.ok(output.includes('\\u003c'), '"<" was not escaped');
  });

  it('escapes <, > and & wherever they appear', () => {
    const output = jsonLdScript({ a: '<', b: '>', c: '&' });
    assert.ok(!/[<>&]/.test(output), `unescaped character left in ${output}`);
  });

  it('leaves the parsed value identical — escaping must not change the data', () => {
    // \uXXXX escapes are ordinary JSON string escapes, so a consumer parsing the
    // block gets exactly the original strings back.
    const value = {
      name: 'Clip <b>&</b> Comb',
      description: 'Price > ₹99 & under ₹999',
      nested: { list: ['<a>', '&amp;', '>'] },
    };
    assert.deepEqual(JSON.parse(jsonLdScript(value)), value);
  });

  it('handles values with nothing to escape', () => {
    const value = { '@type': 'Product', name: 'Alphabet A', price: '289.00' };
    assert.deepEqual(JSON.parse(jsonLdScript(value)), value);
  });
});

describe('stripBrandSuffix', () => {
  it('removes a trailing brand suffix so the title template cannot double it', () => {
    assert.equal(stripBrandSuffix('Combs | Dartler'), 'Combs');
    assert.equal(stripBrandSuffix('Combs  |  Dartler'), 'Combs');
    assert.equal(stripBrandSuffix('Combs - Dartler'), 'Combs');
    assert.equal(stripBrandSuffix('Combs — Dartler'), 'Combs');
    assert.equal(stripBrandSuffix('combs | dartler'), 'combs', 'match is case-insensitive');
  });

  it('leaves a title that does not carry the suffix alone', () => {
    assert.equal(stripBrandSuffix('Combs'), 'Combs');
    assert.equal(stripBrandSuffix('Dartler Combs'), 'Dartler Combs', 'only a trailing suffix counts');
    assert.equal(stripBrandSuffix('Hair Clips | Everyday'), 'Hair Clips | Everyday');
  });

  it('never returns an empty title', () => {
    // A meta_title of just the brand would otherwise strip down to nothing.
    assert.equal(stripBrandSuffix('Dartler'), 'Dartler');
    assert.equal(stripBrandSuffix('| Dartler'), '| Dartler');
  });
});

describe('utils', () => {
  it('slugifies product names', () => {
    assert.equal(slugify("Men's Slim Fit Blazer"), 'mens-slim-fit-blazer');
    assert.equal(slugify('Hair Clip — Set of 6'), 'hair-clip-set-of-6');
    assert.equal(slugify('  Trailing  spaces  '), 'trailing-spaces');
  });

  it('escapes CSV cells that contain separators', () => {
    assert.equal(toCsv([['a', 'b,c']]), 'a,"b,c"');
    assert.equal(toCsv([['say "hi"']]), '"say ""hi"""');
  });

  it('builds a compact pagination range', () => {
    assert.deepEqual(paginationRange(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(paginationRange(10, 20), [1, '…', 9, 10, 11, '…', 20]);
    assert.deepEqual(paginationRange(1, 20)[0], 1);
  });
});
