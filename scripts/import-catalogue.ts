/**
 * Imports the real Dartler catalogue from catalogue.csv into the database.
 *
 *   npm run catalogue:import
 *   npm run catalogue:import -- --default-price=299   (see below)
 *
 * The CSV holds one row per Amazon listing (66 of them). Listings that differ
 * only by letter or colour are folded into ONE product with many variants, per
 * the `product_name` / `variant_label` columns — so 66 rows become 26 products.
 *
 * Idempotent. Products, variants and inventory are matched on their natural
 * keys and updated in place; only the image rows are replaced, which mirrors
 * what scripts/import-product-images.ts already does. Re-running after editing
 * the CSV is safe and is the intended way to correct data.
 *
 * PRICES. `products.price_paise` is NOT NULL, so a row with no price has to be
 * given something. Rather than invent one, a priceless product is imported as
 * DRAFT — present in the database and in the admin, invisible on the
 * storefront. Fill the price_inr column and re-run and it flips to ACTIVE.
 * Pass --default-price=299 to give every priceless row that placeholder and
 * publish it anyway, which is useful for reviewing the design but is not a
 * thing to leave on a live shop.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db, pool } from '@/db';
import * as t from '@/db/schema';
import { slugify } from '@/lib/utils';

/* ------------------------------------------------------------------ input */

const CSV_PATH = path.join(process.cwd(), 'catalogue.csv');

const defaultPriceArg = process.argv.find((a) => a.startsWith('--default-price='));
const DEFAULT_PRICE_INR = defaultPriceArg ? Number(defaultPriceArg.split('=')[1]) : null;

/** Minimal quote-aware CSV reader — no dependency needed for a file this shape. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (c === '\r') continue;
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/* ------------------------------------------------------- catalogue shaping */

/** The two storefront categories, both of which already have artwork on disk. */
const CATEGORIES = [
  {
    slug: 'keychains',
    name: 'Keychains',
    description:
      'Initial letters, doll charms, braided rope and retractable badge reels — ' +
      'small metal things you actually carry every day.',
    sortOrder: 1,
  },
  {
    slug: 'hair-clips',
    name: 'Hair Clips',
    description:
      'Claw clips, barrettes and rhinestone sets, from everyday matte black to ' +
      'the ones you save for an occasion.',
    sortOrder: 2,
  },
];

/** Group → category, SKU prefix, and the physical defaults for that group. */
const GROUPS: Record<string, { category: string; prefix: string; hsn: string; weight: number }> = {
  'ALPHABET KEYCHAIN': { category: 'keychains', prefix: 'ALP', hsn: '73269099', weight: 30 },
  'DOLL KEYCHAINS':    { category: 'keychains', prefix: 'DOL', hsn: '39269099', weight: 40 },
  'ROPE KEYCHAIN':     { category: 'keychains', prefix: 'ROP', hsn: '73269099', weight: 35 },
  'BATCH KEYCHAIN':    { category: 'keychains', prefix: 'BDG', hsn: '73269099', weight: 45 },
  'HAIR CLIPS':        { category: 'hair-clips', prefix: 'HRC', hsn: '96151900', weight: 25 },
};

const FALLBACK = { category: 'keychains', prefix: 'DRT', hsn: '73269099', weight: 30 };

interface Variant {
  label: string;
  listingName: string;
  asin: string;
  sku: string;
  pricePaise: number | null;
  stock: number;
  images: string[];
}

interface Product {
  name: string;
  group: string;
  slug: string;
  sku: string;
  category: string;
  hsn: string;
  weight: number;
  pricePaise: number;
  hasPrice: boolean;
  shortDescription: string;
  description: string;
  variants: Variant[];
}

const rupeesToPaise = (v: string): number | null => {
  const n = Number(String(v).replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

/** Copy that reads like a person wrote it, built from what the group actually is. */
function describe(group: string, name: string, variantCount: number): { short: string; long: string } {
  const plural = variantCount > 1;
  switch (group) {
    case 'ALPHABET KEYCHAIN':
      return {
        short: 'Your initial in polished alloy, with a butterfly charm on its own ring.',
        long:
          'A letter you can pick out of a bag by touch. Cut from zinc alloy and hand-polished, ' +
          'each initial hangs from a split ring heavy enough for a house key and a car fob together, ' +
          'with a small butterfly set on its own jump ring so it moves when you do. ' +
          `Available in ${variantCount} letters.`,
      };
    case 'DOLL KEYCHAINS':
      return {
        short: 'A soft-moulded charm that survives the bottom of a bag.',
        long:
          'Moulded in soft PVC with the colour running right through, so a scuff does not show ' +
          'as a white mark. The ring and clasp are alloy rather than plated steel, which is the ' +
          'part that usually fails first. ' + (plural ? `Six colours.` : ''),
      };
    case 'ROPE KEYCHAIN':
      return {
        short: 'Braided cord between two alloy ferrules — light, and quiet in a pocket.',
        long:
          'Two cords plaited by hand and finished with pressed alloy ferrules at both ends. ' +
          'Lighter than a solid fob and it does not rattle, which is the point if you carry keys ' +
          'in the same pocket as a phone.',
      };
    case 'BATCH KEYCHAIN':
      return {
        short: 'Retractable badge reel with a 70 cm cord and a steel belt clip.',
        long:
          'For anyone who taps a card at a door twenty times a day. The cord retracts smoothly ' +
          'to 70 cm and returns without snagging, and the belt clip is sprung steel rather than ' +
          'moulded plastic, so it survives being pulled off a waistband.',
      };
    case 'HAIR CLIPS':
      return {
        short: `${name} — holds thick hair without the drag of a metal spring.`,
        long:
          'Moulded acetate with a sprung hinge tensioned for thick hair, so it holds through a ' +
          'day without the pulling you get from a cheap metal spring. The teeth are rounded at ' +
          'the tips, which is what stops a claw clip snagging on the way out.',
      };
    default:
      return { short: name, long: name };
  }
}

/* ------------------------------------------------------------------ import */

async function main() {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
  if (!rows.length) throw new Error(`No rows found in ${CSV_PATH}`);
  console.log(`› Read ${rows.length} listings from catalogue.csv`);

  // --- fold listings into products ---------------------------------------
  const byProduct = new Map<string, Product>();
  const skuCounter = new Map<string, number>();

  for (const r of rows) {
    const group = r.group || '';
    const cfg = GROUPS[group] ?? FALLBACK;
    const name = r.product_name || r.listing_name;
    if (!name) continue;

    let product = byProduct.get(name);
    if (!product) {
      const n = (skuCounter.get(cfg.prefix) ?? 0) + 1;
      skuCounter.set(cfg.prefix, n);
      product = {
        name,
        group,
        slug: slugify(name),
        sku: `${cfg.prefix}-${String(n).padStart(3, '0')}`,
        category: cfg.category,
        hsn: r.hsn_code || cfg.hsn,
        weight: Number(r.weight_grams) || cfg.weight,
        pricePaise: 0,
        hasPrice: false,
        shortDescription: '',
        description: '',
        variants: [],
      };
      byProduct.set(name, product);
    }

    const label = r.variant_label || 'Default';
    const price = rupeesToPaise(r.price_inr);
    if (price && !product.hasPrice) { product.pricePaise = price; product.hasPrice = true; }

    product.variants.push({
      label,
      listingName: r.listing_name,
      asin: r.asin,
      sku: `${product.sku}-${slugify(label).toUpperCase().slice(0, 10)}`,
      pricePaise: price,
      stock: Number(r.stock) || 0,
      images: (r.image_files || '').split(';').map((s) => s.trim()).filter(Boolean),
    });
  }

  const products = [...byProduct.values()];
  for (const p of products) {
    const copy = describe(p.group, p.name, p.variants.length);
    p.shortDescription = r0(rows, p.name, 'short_description') || copy.short;
    p.description = copy.long;
    if (!p.hasPrice && DEFAULT_PRICE_INR) {
      p.pricePaise = Math.round(DEFAULT_PRICE_INR * 100);
      p.hasPrice = true;
    }
  }
  console.log(`› Folded into ${products.length} products across ${new Set(products.map((p) => p.category)).size} categories`);

  // --- categories ---------------------------------------------------------
  const categoryId = new Map<string, string>();
  for (const c of CATEGORIES) {
    const [row] = await db
      .insert(t.categories)
      .values({
        slug: c.slug,
        name: c.name,
        description: c.description,
        imageUrl: `/images/categories/${c.slug}.svg`,
        sortOrder: c.sortOrder,
        isActive: true,
        metaTitle: `${c.name} | Dartler`,
        metaDescription: c.description,
      })
      .onConflictDoUpdate({
        target: t.categories.slug,
        set: { name: c.name, description: c.description, sortOrder: c.sortOrder, isActive: true },
      })
      .returning({ id: t.categories.id });
    categoryId.set(c.slug, row.id);
  }
  console.log(`› Categories ready: ${CATEGORIES.map((c) => c.slug).join(', ')}`);

  // --- products -----------------------------------------------------------
  let created = 0;
  let drafted = 0;

  for (const p of products) {
    const status = p.hasPrice ? 'ACTIVE' : 'DRAFT';
    if (status === 'DRAFT') drafted += 1;

    const specs = [
      { label: 'Material', value: p.category === 'hair-clips' ? 'Moulded acetate' : 'Zinc alloy, polished' },
      { label: 'Weight', value: `${p.weight} g` },
      ...(p.category === 'keychains' ? [{ label: 'Split ring', value: '25 mm diameter' }] : []),
      { label: p.variants.length > 1 ? 'Options' : 'Finish', value: p.variants.map((v) => v.label).join(', ') },
      { label: 'HSN', value: p.hsn },
    ];

    const [row] = await db
      .insert(t.products)
      .values({
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        categoryId: categoryId.get(p.category)!,
        shortDescription: p.shortDescription,
        description: p.description,
        specifications: specs,
        pricePaise: p.pricePaise,
        taxBps: 1800,
        status,
        weightGrams: p.weight,
        hsnCode: p.hsn,
        metaTitle: `${p.name} | Dartler`,
        metaDescription: p.shortDescription,
        publishedAt: status === 'ACTIVE' ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: t.products.slug,
        set: {
          name: p.name,
          categoryId: categoryId.get(p.category)!,
          shortDescription: p.shortDescription,
          description: p.description,
          specifications: specs,
          pricePaise: p.pricePaise,
          status,
          weightGrams: p.weight,
          hsnCode: p.hsn,
          updatedAt: new Date(),
        },
      })
      .returning({ id: t.products.id });

    const productId = row.id;
    created += 1;

    // Variants: upserted on their SKU so re-running never orphans stock.
    const variantIds: string[] = [];
    for (const [i, v] of p.variants.entries()) {
      const [variant] = await db
        .insert(t.productVariants)
        .values({
          productId,
          sku: v.sku,
          color: v.label === 'Default' ? null : v.label,
          size: null,
          pricePaise: v.pricePaise && v.pricePaise !== p.pricePaise ? v.pricePaise : null,
          position: i + 1,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: t.productVariants.sku,
          set: { productId, color: v.label === 'Default' ? null : v.label, position: i + 1, updatedAt: new Date() },
        })
        .returning({ id: t.productVariants.id });

      variantIds.push(variant.id);

      await db
        .insert(t.inventory)
        .values({ productId, variantId: variant.id, quantity: v.stock, lowStockThreshold: 10, channel: 'WEBSITE' })
        .onConflictDoUpdate({
          target: t.inventory.variantId,
          set: { productId, quantity: v.stock, updatedAt: new Date() },
        });
    }

    // Images. product_images has no variant column in this schema, so the
    // gallery samples across the variants rather than showing just one.
    const candidates = p.variants.flatMap((v) => v.images.filter((f) => f.endsWith('-1.svg')));
    const picked = samples(candidates, 6);
    const gallery = picked.length ? picked : p.variants[0]?.images.slice(0, 2) ?? [];

    if (gallery.length) {
      await db.transaction(async (tx) => {
        await tx.delete(t.productImages).where(eq(t.productImages.productId, productId));
        await tx.insert(t.productImages).values(
          gallery.map((file, i) => ({
            productId,
            url: `/images/products/${file}`,
            alt: `${p.name}${p.variants.length > 1 ? ` — ${p.variants[Math.min(i, p.variants.length - 1)].label}` : ''}`,
            position: i,
            isPrimary: i === 0,
          })),
        );
      });
    }
  }

  // --- report -------------------------------------------------------------
  const live = created - drafted;
  console.log('');
  console.log(`  ${created} products imported — ${live} live, ${drafted} draft`);
  console.log(`  ${products.reduce((n, p) => n + p.variants.length, 0)} variants with inventory rows`);
  if (drafted) {
    console.log('');
    console.log(`  ${drafted} products have no price yet, so they are DRAFT and will not appear`);
    console.log('  on the storefront. Fill price_inr in catalogue.csv and run this again,');
    console.log('  or pass --default-price=299 to publish them with a placeholder.');
  }
  console.log('');
  console.log('  Photographs: drop files into product-photos/ named after the product slug');
  console.log('  (e.g. initial-alphabet-keychain-1.jpg) and run `npm run images:import`.');
  console.log('  That replaces the generated artwork without touching anything else.');
}

/** First non-empty value of `field` across the rows belonging to a product. */
function r0(rows: Record<string, string>[], productName: string, field: string): string {
  const hit = rows.find((r) => (r.product_name || r.listing_name) === productName && r[field]);
  return hit ? hit[field] : '';
}

/** Evenly spaced sample, so an alphabet gallery spans A to Z rather than A to F. */
function samples<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const step = (list.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => list[Math.round(i * step)]);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('\nImport failed:', err instanceof Error ? err.message : err);
    await pool.end();
    process.exit(1);
  });
