/**
 * Bulk import of real product photographs.
 *
 * Drop your photos into `product-photos/` in the project root, named after the
 * product they belong to, then run:
 *
 *     npm run images:import
 *
 * Naming
 * ------
 *   crystal-hair-clip-1.jpg      → Crystal Hair Clip, first (primary) image
 *   crystal-hair-clip-2.jpg      → Crystal Hair Clip, second image
 *   HAI-001-1.jpg                → matched by SKU instead of slug
 *   crystal-hair-clip.jpg        → single image, treated as position 1
 *
 * The part before the trailing `-<number>` is matched against the product slug
 * first, then against the base SKU of any of its variants. Matching is
 * case-insensitive. `.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` are accepted.
 *
 * What it does
 * ------------
 *   1. Copies each photo into `public/images/products/` under its original name.
 *   2. Replaces that product's image rows with the imported set (position order
 *      follows the trailing number; the lowest becomes the primary image).
 *
 * Products with no matching photo are left exactly as they are, so you can
 * import one category at a time. Run it as often as you like — re-importing a
 * product simply replaces its images, it never duplicates them.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '@/db';
import { productImages, products, productVariants } from '@/db/schema';

const SOURCE_DIR = path.join(process.cwd(), 'product-photos');
const TARGET_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

interface Photo {
  file: string;
  key: string;
  position: number;
}

/** "crystal-hair-clip-2.jpg" → { key: "crystal-hair-clip", position: 2 } */
function parseName(file: string): Photo | null {
  const ext = path.extname(file).toLowerCase();
  if (!ALLOWED.has(ext)) return null;

  const base = path.basename(file, path.extname(file));
  const match = /^(.*?)-(\d+)$/.exec(base);
  return match
    ? { file, key: match[1].toLowerCase(), position: Number(match[2]) }
    : { file, key: base.toLowerCase(), position: 1 };
}

async function main() {
  let files: string[];
  try {
    files = await readdir(SOURCE_DIR);
  } catch {
    console.error(
      `No "product-photos" folder found.\n` +
        `Create one in the project root, put your photos in it, then run this again.`,
    );
    process.exitCode = 1;
    return;
  }

  const photos = files.map(parseName).filter((photo): photo is Photo => photo !== null);
  if (photos.length === 0) {
    console.error('product-photos/ has no .jpg, .jpeg, .png, .webp or .avif files in it.');
    process.exitCode = 1;
    return;
  }

  // Build the lookup: slug → product id, and base SKU → product id.
  const allProducts = await db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products);
  const variants = await db
    .select({ productId: productVariants.productId, sku: productVariants.sku })
    .from(productVariants);

  const byKey = new Map<string, { id: string; name: string }>();
  for (const product of allProducts) {
    byKey.set(product.slug.toLowerCase(), { id: product.id, name: product.name });
  }
  for (const variant of variants) {
    // Variant SKUs look like HAI-001-BEIGE; index the product prefix too.
    const parts = variant.sku.toLowerCase().split('-');
    const base = parts.slice(0, 2).join('-');
    const product = allProducts.find((p) => p.id === variant.productId);
    if (!product) continue;
    if (!byKey.has(base)) byKey.set(base, { id: product.id, name: product.name });
    if (!byKey.has(variant.sku.toLowerCase())) {
      byKey.set(variant.sku.toLowerCase(), { id: product.id, name: product.name });
    }
  }

  // Group the photos by the product they resolve to.
  const grouped = new Map<string, { name: string; photos: Photo[] }>();
  const unmatched: string[] = [];

  for (const photo of photos) {
    const product = byKey.get(photo.key);
    if (!product) {
      unmatched.push(photo.file);
      continue;
    }
    const entry = grouped.get(product.id) ?? { name: product.name, photos: [] };
    entry.photos.push(photo);
    grouped.set(product.id, entry);
  }

  if (grouped.size === 0) {
    console.error(
      'None of the file names matched a product slug or SKU. ' +
        'Check the naming rules at the top of this script.',
    );
    process.exitCode = 1;
    return;
  }

  await mkdir(TARGET_DIR, { recursive: true });

  let copied = 0;
  for (const [productId, entry] of grouped) {
    entry.photos.sort((a, b) => a.position - b.position);

    const rows: (typeof productImages.$inferInsert)[] = [];
    for (const [index, photo] of entry.photos.entries()) {
      await copyFile(path.join(SOURCE_DIR, photo.file), path.join(TARGET_DIR, photo.file));
      copied += 1;
      rows.push({
        productId,
        url: `/images/products/${photo.file}`,
        alt: entry.name,
        position: index,
        isPrimary: index === 0,
      });
    }

    // Replace rather than append, so re-running is safe.
    await db.transaction(async (tx) => {
      await tx.delete(productImages).where(eq(productImages.productId, productId));
      await tx.insert(productImages).values(rows);
    });

    console.log(`✓ ${entry.name} — ${rows.length} image${rows.length === 1 ? '' : 's'}`);
  }

  // Anything still on a placeholder is worth flagging, so nothing is missed.
  const untouched = allProducts.filter((product) => !grouped.has(product.id));
  const stillPlaceholder = untouched.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(
          inArray(
            productImages.productId,
            untouched.map((product) => product.id),
          ),
        )
    : [];
  const placeholderIds = new Set(
    stillPlaceholder.filter((row) => row.url.endsWith('.svg')).map((row) => row.productId),
  );

  console.log(
    `\n${copied} file${copied === 1 ? '' : 's'} imported across ${grouped.size} product${
      grouped.size === 1 ? '' : 's'
    }.`,
  );
  if (unmatched.length) {
    console.log(`\nNo product matched these files:\n  ${unmatched.join('\n  ')}`);
  }
  if (placeholderIds.size) {
    const names = untouched
      .filter((product) => placeholderIds.has(product.id))
      .map((product) => `${product.slug}`);
    console.log(`\nStill on placeholder artwork (${names.length}):\n  ${names.join('\n  ')}`);
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
