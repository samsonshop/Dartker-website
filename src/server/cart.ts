import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { calculatePricing, validateCoupon, type CouponRule } from '@/lib/pricing';
import { getStoreSettings } from './settings';

export interface CartLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ResolvedLine {
  key: string;
  productId: string;
  variantId: string;
  quantity: number;
  name: string;
  slug: string;
  sku: string;
  variantLabel: string | null;
  colorHex: string | null;
  imageUrl: string | null;
  unitPricePaise: number;
  compareAtPaise: number | null;
  lineTotalPaise: number;
  availableStock: number;
  taxBps: number;
  adjusted: boolean;
  unavailable: boolean;
}

const MAX_PER_LINE = 20;

/**
 * Turns client-supplied cart lines into authoritative lines. Prices, names and
 * stock always come from the database — the client only ever chooses *what*
 * and *how many*, never *for how much*.
 */
export async function resolveCartLines(inputs: CartLineInput[]): Promise<ResolvedLine[]> {
  const unique = new Map<string, CartLineInput>();
  for (const input of inputs) {
    if (!input?.productId || !input?.variantId) continue;
    const id = `${input.productId}:${input.variantId}`;
    const quantity = Math.min(MAX_PER_LINE, Math.max(1, Math.floor(Number(input.quantity) || 1)));
    const existing = unique.get(id);
    unique.set(id, {
      productId: input.productId,
      variantId: input.variantId,
      quantity: Math.min(MAX_PER_LINE, (existing?.quantity ?? 0) + quantity),
    });
  }
  if (unique.size === 0) return [];

  const variantIds = [...unique.values()].map((line) => line.variantId);
  const variants = await db.query.productVariants.findMany({
    where: inArray(t.productVariants.id, variantIds),
    with: {
      inventory: true,
      product: {
        with: {
          images: { limit: 1, orderBy: (image, { desc, asc }) => [desc(image.isPrimary), asc(image.position)] },
        },
      },
    },
  });

  const byId = new Map(variants.map((variant) => [variant.id, variant]));

  return [...unique.values()].map((line) => {
    const variant = byId.get(line.variantId);
    const product = variant?.product;
    const base = {
      key: `${line.productId}:${line.variantId}`,
      productId: line.productId,
      variantId: line.variantId,
    };

    if (!variant || !product || product.status !== 'ACTIVE' || !variant.isActive) {
      return {
        ...base,
        quantity: line.quantity,
        name: product?.name ?? 'Unavailable item',
        slug: product?.slug ?? '',
        sku: variant?.sku ?? '',
        variantLabel: null,
        colorHex: null,
        imageUrl: product?.images?.[0]?.url ?? null,
        unitPricePaise: 0,
        compareAtPaise: null,
        lineTotalPaise: 0,
        availableStock: 0,
        taxBps: 1800,
        adjusted: false,
        unavailable: true,
      } satisfies ResolvedLine;
    }

    const availableStock = Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0));
    const quantity = Math.min(line.quantity, Math.max(0, availableStock));
    const unitPricePaise = variant.pricePaise ?? product.pricePaise;
    const label = [variant.color, variant.size].filter(Boolean).join(' | ') || null;

    return {
      ...base,
      quantity: Math.max(quantity, 0),
      name: product.name,
      slug: product.slug,
      sku: variant.sku,
      variantLabel: label,
      colorHex: variant.colorHex,
      imageUrl: product.images?.[0]?.url ?? null,
      unitPricePaise,
      compareAtPaise: product.compareAtPaise,
      lineTotalPaise: unitPricePaise * Math.max(quantity, 0),
      availableStock,
      taxBps: product.taxBps,
      adjusted: quantity !== line.quantity,
      unavailable: availableStock <= 0,
    } satisfies ResolvedLine;
  });
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  saved: ResolvedLine[];
  totals: {
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    freeShippingAbovePaise: number;
    amountToFreeShipping: number;
  };
  coupon: { id: string; code: string } | null;
  couponError: string | null;
}

export async function resolveCart(input: {
  lines: CartLineInput[];
  saved?: CartLineInput[];
  couponCode?: string | null;
}): Promise<ResolvedCart> {
  const settings = await getStoreSettings();
  const [lines, saved] = await Promise.all([
    resolveCartLines(input.lines ?? []),
    resolveCartLines(input.saved ?? []),
  ]);

  const payable = lines.filter((line) => !line.unavailable && line.quantity > 0);

  let coupon: { id: string; code: string } | null = null;
  let couponRule: CouponRule | null = null;
  let couponError: string | null = null;

  if (input.couponCode) {
    const subtotal = payable.reduce((total, line) => total + line.lineTotalPaise, 0);
    const row = await db.query.coupons.findFirst({
      where: and(eq(t.coupons.code, input.couponCode.toUpperCase())),
    });
    if (!row) {
      couponError = 'That coupon code is not valid.';
    } else {
      const check = validateCoupon(row, subtotal);
      if (!check.ok) {
        couponError = check.reason;
      } else {
        coupon = { id: row.id, code: row.code };
        couponRule = {
          type: row.type,
          value: row.value,
          minOrderPaise: row.minOrderPaise,
          maxDiscountPaise: row.maxDiscountPaise,
        };
      }
    }
  }

  const pricing = calculatePricing(
    payable.map((line) => ({
      unitPricePaise: line.unitPricePaise,
      quantity: line.quantity,
      taxBps: line.taxBps,
    })),
    {
      freeShippingAbovePaise: settings.freeShippingAbovePaise,
      flatShippingPaise: settings.flatShippingPaise,
    },
    couponRule,
  );

  return {
    lines,
    saved,
    totals: {
      subtotalPaise: pricing.subtotalPaise,
      discountPaise: pricing.discountPaise,
      shippingPaise: pricing.shippingPaise,
      taxPaise: pricing.taxPaise,
      totalPaise: pricing.totalPaise,
      freeShippingAbovePaise: settings.freeShippingAbovePaise,
      amountToFreeShipping: Math.max(
        0,
        settings.freeShippingAbovePaise - (pricing.subtotalPaise - pricing.discountPaise),
      ),
    },
    coupon,
    couponError,
  };
}
