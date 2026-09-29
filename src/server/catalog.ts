import 'server-only';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import type { ProductSort } from '@/lib/catalog-sort';
import * as t from '@/db/schema';

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  isFeatured: boolean;
  status: t.ProductStatusValue;
  createdAt: Date;
  categoryName: string;
  categorySlug: string;
  imageUrl: string | null;
  hoverImageUrl: string | null;
  totalStock: number;
  colors: string[];
}

export interface ProductFilters {
  categorySlugs?: string[];
  search?: string;
  minPaise?: number;
  maxPaise?: number;
  colors?: string[];
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  status?: t.ProductStatusValue | 'ALL';
  sort?: ProductSort;
  page?: number;
  perPage?: number;
  excludeId?: string;
}

export { SORT_OPTIONS } from '@/lib/catalog-sort';
export type { ProductSort } from '@/lib/catalog-sort';

/**
 * Correlated subqueries are written with fully qualified plain identifiers on
 * purpose. Drizzle renders `${table.column}` inside a raw `sql` fragment as a
 * bare, *unqualified* column name, which silently resolves against the inner
 * table and matches nothing — so the outer reference is spelled out instead.
 */
const totalStockSql = sql<number>`coalesce((
  select sum(inv.quantity) from inventory inv where inv.product_id = products.id
), 0)::int`;

const primaryImageSql = sql<string | null>`(
  select img.url from product_images img
  where img.product_id = products.id
  order by img.is_primary desc, img.position asc
  limit 1
)`;

const hoverImageSql = sql<string | null>`(
  select img.url from product_images img
  where img.product_id = products.id
  order by img.is_primary desc, img.position asc
  offset 1 limit 1
)`;

const colorsSql = sql<string[]>`coalesce((
  select array_agg(distinct v.color_hex) from product_variants v
  where v.product_id = products.id and v.color_hex is not null
), '{}')`;

function buildWhere(filters: ProductFilters): SQL | undefined {
  const clauses: (SQL | undefined)[] = [];

  const status = filters.status ?? 'ACTIVE';
  if (status !== 'ALL') clauses.push(eq(t.products.status, status));

  if (filters.categorySlugs?.length) {
    clauses.push(inArray(t.categories.slug, filters.categorySlugs));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    clauses.push(
      or(
        ilike(t.products.name, term),
        ilike(t.products.sku, term),
        ilike(t.products.shortDescription, term),
        ilike(t.categories.name, term),
      ),
    );
  }
  if (typeof filters.minPaise === 'number') clauses.push(gte(t.products.pricePaise, filters.minPaise));
  if (typeof filters.maxPaise === 'number') clauses.push(lte(t.products.pricePaise, filters.maxPaise));
  if (filters.colors?.length) {
    clauses.push(
      sql`exists (
        select 1 from product_variants v
        where v.product_id = products.id and v.color_hex in (${sql.join(
          filters.colors.map((hex) => sql`${hex}`),
          sql`, `,
        )})
      )`,
    );
  }
  if (filters.inStockOnly) clauses.push(sql`${totalStockSql} > 0`);
  if (filters.featuredOnly) clauses.push(eq(t.products.isFeatured, true));
  if (filters.excludeId) clauses.push(ne(t.products.id, filters.excludeId));

  const defined = clauses.filter(Boolean) as SQL[];
  return defined.length > 0 ? and(...defined) : undefined;
}

function orderBy(sort: ProductSort = 'popular') {
  switch (sort) {
    case 'newest':
      return [desc(t.products.createdAt)];
    case 'price-asc':
      return [asc(t.products.pricePaise)];
    case 'price-desc':
      return [desc(t.products.pricePaise)];
    case 'rating':
      return [desc(t.products.ratingAvg), desc(t.products.ratingCount)];
    case 'name-asc':
      return [asc(t.products.name)];
    case 'stock-asc':
      return [asc(totalStockSql)];
    case 'popular':
    default:
      return [desc(t.products.soldCount), desc(t.products.ratingAvg)];
  }
}

export interface ProductPage {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function listProducts(filters: ProductFilters = {}): Promise<ProductPage> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(60, Math.max(1, filters.perPage ?? 12));
  const where = buildWhere(filters);

  const rows = await db
    .select({
      id: t.products.id,
      name: t.products.name,
      slug: t.products.slug,
      sku: t.products.sku,
      shortDescription: t.products.shortDescription,
      pricePaise: t.products.pricePaise,
      compareAtPaise: t.products.compareAtPaise,
      ratingAvg: t.products.ratingAvg,
      ratingCount: t.products.ratingCount,
      soldCount: t.products.soldCount,
      isFeatured: t.products.isFeatured,
      status: t.products.status,
      createdAt: t.products.createdAt,
      categoryName: t.categories.name,
      categorySlug: t.categories.slug,
      imageUrl: primaryImageSql,
      hoverImageUrl: hoverImageSql,
      totalStock: totalStockSql,
      colors: colorsSql,
    })
    .from(t.products)
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where)
    .orderBy(...orderBy(filters.sort))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(t.products)
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where);

  return {
    items: rows as ProductListItem[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getCategories(includeEmpty = true) {
  const rows = await db
    .select({
      id: t.categories.id,
      name: t.categories.name,
      slug: t.categories.slug,
      description: t.categories.description,
      imageUrl: t.categories.imageUrl,
      accent: t.categories.accent,
      sortOrder: t.categories.sortOrder,
      metaTitle: t.categories.metaTitle,
      metaDescription: t.categories.metaDescription,
      productCount: sql<number>`(
        select count(*) from products p
        where p.category_id = categories.id and p.status = 'ACTIVE'
      )::int`,
    })
    .from(t.categories)
    .where(eq(t.categories.isActive, true))
    .orderBy(asc(t.categories.sortOrder), asc(t.categories.name));

  return includeEmpty ? rows : rows.filter((row) => row.productCount > 0);
}

export type CategorySummary = Awaited<ReturnType<typeof getCategories>>[number];

export async function getCategoryBySlug(slug: string) {
  const rows = await getCategories();
  return rows.find((row) => row.slug === slug) ?? null;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string | null;
  specifications: { label: string; value: string }[];
  pricePaise: number;
  compareAtPaise: number | null;
  taxBps: number;
  status: t.ProductStatusValue;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  weightGrams: number;
  hsnCode: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  category: { id: string; name: string; slug: string };
  images: { id: string; url: string; alt: string }[];
  variants: {
    id: string;
    sku: string;
    color: string | null;
    colorHex: string | null;
    size: string | null;
    pricePaise: number;
    stock: number;
  }[];
  totalStock: number;
  reviews: {
    id: string;
    authorName: string;
    rating: number;
    title: string | null;
    body: string;
    createdAt: Date;
  }[];
  ratingBreakdown: { stars: number; count: number }[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await db.query.products.findFirst({
    where: eq(t.products.slug, slug),
    with: {
      category: true,
      images: { orderBy: [desc(t.productImages.isPrimary), asc(t.productImages.position)] },
      variants: {
        where: eq(t.productVariants.isActive, true),
        orderBy: [asc(t.productVariants.position)],
        with: { inventory: true },
      },
      reviews: {
        where: eq(t.reviews.isApproved, true),
        orderBy: [desc(t.reviews.createdAt)],
        limit: 20,
      },
    },
  });

  if (!product || product.status === 'ARCHIVED') return null;

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    color: variant.color,
    colorHex: variant.colorHex,
    size: variant.size,
    pricePaise: variant.pricePaise ?? product.pricePaise,
    stock: variant.inventory?.quantity ?? 0,
  }));

  const breakdownMap = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ]);
  for (const review of product.reviews) {
    breakdownMap.set(review.rating, (breakdownMap.get(review.rating) ?? 0) + 1);
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    shortDescription: product.shortDescription,
    specifications: product.specifications ?? [],
    pricePaise: product.pricePaise,
    compareAtPaise: product.compareAtPaise,
    taxBps: product.taxBps,
    status: product.status,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    soldCount: product.soldCount,
    weightGrams: product.weightGrams,
    hsnCode: product.hsnCode,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    images: product.images.map((image) => ({ id: image.id, url: image.url, alt: image.alt })),
    variants,
    totalStock: variants.reduce((total, variant) => total + variant.stock, 0),
    reviews: product.reviews.map((review) => ({
      id: review.id,
      authorName: review.authorName,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt,
    })),
    ratingBreakdown: [...breakdownMap.entries()]
      .map(([stars, value]) => ({ stars, count: value }))
      .sort((a, b) => b.stars - a.stars),
  };
}

export async function getProductSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return db
    .select({ slug: t.products.slug, updatedAt: t.products.updatedAt })
    .from(t.products)
    .where(eq(t.products.status, 'ACTIVE'));
}

/** Facet metadata used to build the category filter sidebar. */
export async function getCatalogFacets(categorySlugs?: string[]) {
  const where = buildWhere({ categorySlugs });

  const [priceRow] = await db
    .select({
      min: sql<number>`coalesce(min(${t.products.pricePaise}), 0)::int`,
      max: sql<number>`coalesce(max(${t.products.pricePaise}), 0)::int`,
    })
    .from(t.products)
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where);

  const colorRows = await db
    .select({
      color: t.productVariants.color,
      colorHex: t.productVariants.colorHex,
      total: count(),
    })
    .from(t.productVariants)
    .innerJoin(t.products, eq(t.productVariants.productId, t.products.id))
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(and(where, eq(t.products.status, 'ACTIVE')))
    .groupBy(t.productVariants.color, t.productVariants.colorHex)
    .orderBy(desc(count()));

  return {
    price: { min: priceRow?.min ?? 0, max: priceRow?.max ?? 0 },
    colors: colorRows
      .filter((row) => row.color && row.colorHex)
      .map((row) => ({ name: row.color as string, hex: row.colorHex as string, count: row.total })),
  };
}

export async function getFeaturedProducts(limit = 8): Promise<ProductListItem[]> {
  const { items } = await listProducts({ featuredOnly: true, sort: 'popular', perPage: limit });
  if (items.length >= limit) return items;
  const { items: fill } = await listProducts({ sort: 'popular', perPage: limit });
  const seen = new Set(items.map((item) => item.id));
  return [...items, ...fill.filter((item) => !seen.has(item.id))].slice(0, limit);
}

export async function getNewArrivals(limit = 8): Promise<ProductListItem[]> {
  const { items } = await listProducts({ sort: 'newest', perPage: limit });
  return items;
}

export async function getRelatedProducts(
  productId: string,
  categorySlug: string,
  limit = 4,
): Promise<ProductListItem[]> {
  const { items } = await listProducts({
    categorySlugs: [categorySlug],
    excludeId: productId,
    sort: 'popular',
    perPage: limit,
  });
  if (items.length >= limit) return items;
  const { items: fill } = await listProducts({ excludeId: productId, sort: 'popular', perPage: limit });
  const seen = new Set(items.map((item) => item.id));
  return [...items, ...fill.filter((item) => !seen.has(item.id))].slice(0, limit);
}

/** Lightweight suggestions for the header search dropdown. */
export async function searchSuggestions(term: string, limit = 6) {
  if (!term.trim()) return [];
  const { items } = await listProducts({ search: term, perPage: limit, sort: 'popular' });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    imageUrl: item.imageUrl,
    pricePaise: item.pricePaise,
    categoryName: item.categoryName,
  }));
}
