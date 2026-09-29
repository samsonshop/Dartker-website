/**
 * Brings the live catalogue in line with `SEED_CATEGORIES` without wiping the
 * database the way `db:seed` does.
 *
 *   npm run categories:sync
 *
 * Categories listed in the seed data are upserted by slug. Categories that are
 * no longer listed are retired: the category is deactivated and its products
 * are archived, so they disappear from the storefront, search, best sellers and
 * the sitemap while existing orders keep referring to them.
 *
 * The script is idempotent — running it twice changes nothing the second time.
 */
import { eq, inArray, notInArray, and, ne } from 'drizzle-orm';
import { db } from '../src/db';
import * as t from '../src/db/schema';
import { SEED_CATEGORIES } from '../src/db/seed-data';

const SUPPORT_EMAIL = 'info@dartler.com';
const SUPPORT_PHONE = '+91 70920 18000 / +91 86674 40418';

async function main() {
  const slugs = SEED_CATEGORIES.map((category) => category.slug);

  console.log('› Upserting categories…');
  for (const category of SEED_CATEGORIES) {
    const values = {
      name: category.name,
      slug: category.slug,
      description: category.description,
      accent: category.accent,
      sortOrder: category.sortOrder,
      isActive: true,
      imageUrl: category.image ?? `/images/categories/${category.slug}.svg`,
      metaTitle: `${category.name} | Dartler`,
      metaDescription: category.description,
    };

    const [row] = await db
      .insert(t.categories)
      .values(values)
      .onConflictDoUpdate({
        target: t.categories.slug,
        set: { ...values, updatedAt: new Date() },
      })
      .returning({ id: t.categories.id, name: t.categories.name });

    console.log(`  · ${category.slug} → ${row.name}`);
  }

  console.log('› Retiring categories no longer in the catalogue…');
  const retired = await db
    .update(t.categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(notInArray(t.categories.slug, slugs))
    .returning({ id: t.categories.id, slug: t.categories.slug });

  if (retired.length === 0) {
    console.log('  · none');
  } else {
    const archived = await db
      .update(t.products)
      .set({ status: 'ARCHIVED', isFeatured: false, updatedAt: new Date() })
      .where(
        and(
          inArray(
            t.products.categoryId,
            retired.map((category) => category.id),
          ),
          ne(t.products.status, 'ARCHIVED'),
        ),
      )
      .returning({ id: t.products.id });

    for (const category of retired) console.log(`  · ${category.slug} deactivated`);
    console.log(`  · ${archived.length} product(s) archived`);
  }

  console.log('› Updating store contact details…');
  await db
    .insert(t.storeSettings)
    .values({ id: 'default', supportEmail: SUPPORT_EMAIL, supportPhone: SUPPORT_PHONE })
    .onConflictDoUpdate({
      target: t.storeSettings.id,
      set: { supportEmail: SUPPORT_EMAIL, supportPhone: SUPPORT_PHONE, updatedAt: new Date() },
    });
  console.log(`  · ${SUPPORT_EMAIL} · ${SUPPORT_PHONE}`);

  const active = await db
    .select({ slug: t.categories.slug, name: t.categories.name })
    .from(t.categories)
    .where(eq(t.categories.isActive, true))
    .orderBy(t.categories.sortOrder);

  console.log(`\n✓ ${active.length} active categories: ${active.map((c) => c.slug).join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
