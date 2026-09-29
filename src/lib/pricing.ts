import { taxFromBasisPoints } from './money';

export interface PricingLine {
  /** Unit price in paise, taken from the database — never from the client. */
  unitPricePaise: number;
  quantity: number;
  taxBps: number;
}

export interface PricingSettings {
  freeShippingAbovePaise: number;
  flatShippingPaise: number;
}

export interface CouponRule {
  type: 'PERCENT' | 'FIXED';
  /** Percent (0-100) or a flat amount in paise, matching `type`. */
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
}

export interface PricingResult {
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
  lines: { taxPaise: number; totalPaise: number; discountPaise: number }[];
}

/**
 * The single place order money is computed. The checkout API, the admin order
 * view and the seed all call this, so a change to shipping or tax rules can
 * never leave two parts of the app disagreeing about a total.
 */
export function calculatePricing(
  lines: PricingLine[],
  settings: PricingSettings,
  coupon?: CouponRule | null,
): PricingResult {
  const subtotalPaise = lines.reduce(
    (total, line) => total + line.unitPricePaise * line.quantity,
    0,
  );

  let discountPaise = 0;
  if (coupon && subtotalPaise >= coupon.minOrderPaise) {
    const raw =
      coupon.type === 'PERCENT'
        ? Math.round((subtotalPaise * coupon.value) / 100)
        : coupon.value;
    discountPaise = Math.min(
      raw,
      coupon.maxDiscountPaise ?? Number.MAX_SAFE_INTEGER,
      subtotalPaise,
    );
  }

  // Spread the discount proportionally so per-line tax stays honest, and give
  // any rounding remainder to the last line so the parts always sum to the whole.
  const lineResults = lines.map((line) => {
    const lineTotal = line.unitPricePaise * line.quantity;
    const share = subtotalPaise === 0 ? 0 : Math.round((discountPaise * lineTotal) / subtotalPaise);
    return { lineTotal, discountPaise: share, taxPaise: 0, totalPaise: 0 };
  });

  const spread = lineResults.reduce((total, line) => total + line.discountPaise, 0);
  if (lineResults.length > 0 && spread !== discountPaise) {
    const last = lineResults[lineResults.length - 1];
    last.discountPaise = Math.max(0, last.discountPaise + (discountPaise - spread));
  }

  let taxPaise = 0;
  lineResults.forEach((result, index) => {
    const taxable = Math.max(0, result.lineTotal - result.discountPaise);
    result.taxPaise = taxFromBasisPoints(taxable, lines[index].taxBps);
    result.totalPaise = taxable + result.taxPaise;
    taxPaise += result.taxPaise;
  });

  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);
  const shippingPaise =
    taxablePaise === 0 || taxablePaise >= settings.freeShippingAbovePaise
      ? 0
      : settings.flatShippingPaise;

  return {
    subtotalPaise,
    discountPaise,
    taxablePaise,
    taxPaise,
    shippingPaise,
    totalPaise: taxablePaise + taxPaise + shippingPaise,
    lines: lineResults.map(({ taxPaise: t, totalPaise, discountPaise: d }) => ({
      taxPaise: t,
      totalPaise,
      discountPaise: d,
    })),
  };
}

export interface CouponValidationInput {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  minOrderPaise: number;
}

export function validateCoupon(
  coupon: CouponValidationInput,
  subtotalPaise: number,
  at = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!coupon.isActive) return { ok: false, reason: 'This coupon is no longer active.' };
  if (coupon.startsAt && at < coupon.startsAt)
    return { ok: false, reason: 'This coupon is not active yet.' };
  if (coupon.endsAt && at > coupon.endsAt) return { ok: false, reason: 'This coupon has expired.' };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: 'This coupon has reached its usage limit.' };
  if (subtotalPaise < coupon.minOrderPaise)
    return { ok: false, reason: 'Your cart does not meet this coupon’s minimum order value.' };
  return { ok: true };
}
