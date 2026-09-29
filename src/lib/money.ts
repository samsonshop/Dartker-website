/**
 * Money in Dartler is *always* stored and transported as an integer number of
 * paise. Rupee values only ever exist at the presentation edge (formatting) or
 * at the admin input edge (parsing). This removes float drift entirely.
 */

export type Paise = number;

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_COMPACT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₹1,299.00 */
export function formatPaise(paise: Paise): string {
  return INR.format(paise / 100);
}

/** ₹1,299 — drops the decimals when they are zero, keeps them otherwise. */
export function formatPaiseShort(paise: Paise): string {
  return paise % 100 === 0 ? INR_COMPACT.format(paise / 100) : INR.format(paise / 100);
}

/** ₹1.48L / ₹64.8K — for dashboard tiles only. */
export function formatPaiseCompact(paise: Paise): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  if (abs >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}K`;
  return INR_COMPACT.format(rupees);
}

/** Parse a rupee string/number from an admin form into integer paise. */
export function rupeesToPaise(value: string | number): Paise {
  const raw = typeof value === 'number' ? String(value) : value;
  const cleaned = raw.replace(/[^0-9.-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return Number.NaN;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
}

export function paiseToRupees(paise: Paise): number {
  return Math.round(paise) / 100;
}

/** Discount percentage, rounded down, or null when there is nothing to show. */
export function discountPercent(price: Paise, compareAt: Paise | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/**
 * GST is calculated on the taxable value (item subtotal after discount).
 * Rate is expressed in basis points, e.g. 1800 = 18%.
 */
export function taxFromBasisPoints(taxableValue: Paise, basisPoints: number): Paise {
  return Math.round((taxableValue * basisPoints) / 10_000);
}

export function sumPaise(values: Paise[]): Paise {
  return values.reduce((total, value) => total + value, 0);
}
