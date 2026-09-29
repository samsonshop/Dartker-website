import 'server-only';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

export interface AdminProductFilters {
  search?: string;
  categoryId?: string;
  status?: t.ProductStatusValue | 'ALL';
  stockFilter?: 'all' | 'in' | 'low' | 'out';
  sort?: 'newest' | 'name-asc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'sold-desc';
  page?: number;
  perPage?: number;
}

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: t.ProductStatusValue;
  pricePaise: number;
  compareAtPaise: number | null;
  categoryName: string;
  categoryId: string;
  imageUrl: string | null;
  stock: number;
  lowStockThreshold: number;
  soldCount: number;
  variantCount: number;
  updatedAt: Date;
}

const stockSql = sql<number>`coalesce((
  select sum(inv.quantity) from inventory inv where inv.product_id = products.id
), 0)::int`;

const thresholdSql = sql<number>`coalesce((
  select max(inv.low_stock_threshold) from inventory inv where inv.product_id = products.id
), 10)::int`;

const imageSql = sql<string | null>`(
  select img.url from product_images img
  where img.product_id = products.id
  order by img.is_primary desc, img.position asc
  limit 1
)`;

const variantCountSql = sql<number>`(
  select count(*) from product_variants v where v.product_id = products.id
)::int`;

function buildWhere(filters: AdminProductFilters): SQL | undefined {
  const clauses: SQL[] = [];

  if (filters.status && filters.status !== 'ALL') {
    clauses.push(eq(t.products.status, filters.status));
  }
  if (filters.categoryId) clauses.push(eq(t.products.categoryId, filters.categoryId));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const match = or(
      ilike(t.products.name, term),
      ilike(t.products.sku, term),
      ilike(t.products.slug, term),
    );
    if (match) clauses.push(match);
  }
  if (filters.stockFilter === 'out') clauses.push(sql`${stockSql} <= 0`);
  if (filters.stockFilter === 'low') clauses.push(sql`${stockSql} > 0 and ${stockSql} <= ${thresholdSql}`);
  if (filters.stockFilter === 'in') clauses.push(sql`${stockSql} > ${thresholdSql}`);

  return clauses.length ? and(...clauses) : undefined;
}

export async function listAdminProducts(filters: AdminProductFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 10));
  const where = buildWhere(filters);

  const order = (() => {
    switch (filters.sort) {
      case 'name-asc':
        return [asc(t.products.name)];
      case 'price-asc':
        return [asc(t.products.pricePaise)];
      case 'price-desc':
        return [desc(t.products.pricePaise)];
      case 'stock-asc':
        return [asc(stockSql)];
      case 'sold-desc':
        return [desc(t.products.soldCount)];
      case 'newest':
      default:
        return [desc(t.products.createdAt)];
    }
  })();

  const rows = await db
    .select({
      id: t.products.id,
      name: t.products.name,
      slug: t.products.slug,
      sku: t.products.sku,
      status: t.products.status,
      pricePaise: t.products.pricePaise,
      compareAtPaise: t.products.compareAtPaise,
      categoryName: t.categories.name,
      categoryId: t.categories.id,
      imageUrl: imageSql,
      stock: stockSql,
      lowStockThreshold: thresholdSql,
      soldCount: t.products.soldCount,
      variantCount: variantCountSql,
      updatedAt: t.products.updatedAt,
    })
    .from(t.products)
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where)
    .orderBy(...order)
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(t.products)
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where);

  return {
    items: rows as AdminProductRow[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getAdminProduct(id: string) {
  return db.query.products.findFirst({
    where: eq(t.products.id, id),
    with: {
      category: true,
      images: { orderBy: [desc(t.productImages.isPrimary), asc(t.productImages.position)] },
      variants: {
        orderBy: [asc(t.productVariants.position)],
        with: { inventory: true },
      },
    },
  });
}

export type AdminProductDetail = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

export async function isSkuTaken(sku: string, exceptProductId?: string): Promise<boolean> {
  const product = await db.query.products.findFirst({
    where: eq(t.products.sku, sku),
    columns: { id: true },
  });
  if (product && product.id !== exceptProductId) return true;

  const variant = await db.query.productVariants.findFirst({
    where: eq(t.productVariants.sku, sku),
    columns: { id: true, productId: true },
  });
  return Boolean(variant && variant.productId !== exceptProductId);
}

export async function isSlugTaken(slug: string, exceptProductId?: string): Promise<boolean> {
  const row = await db.query.products.findFirst({
    where: eq(t.products.slug, slug),
    columns: { id: true },
  });
  return Boolean(row && row.id !== exceptProductId);
}

export async function getAdminCategories() {
  return db
    .select({ id: t.categories.id, name: t.categories.name, slug: t.categories.slug })
    .from(t.categories)
    .orderBy(asc(t.categories.sortOrder), asc(t.categories.name));
}

export async function getProductStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${t.products.status} = 'ACTIVE')::int`,
      draft: sql<number>`count(*) filter (where ${t.products.status} = 'DRAFT')::int`,
      archived: sql<number>`count(*) filter (where ${t.products.status} = 'ARCHIVED')::int`,
    })
    .from(t.products);

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    draft: Number(row?.draft ?? 0),
    archived: Number(row?.archived ?? 0),
  };
}

export interface InventoryRowView {
  productId: string;
  variantId: string;
  productName: string;
  slug: string;
  sku: string;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  reserved: number;
  lowStockThreshold: number;
  pricePaise: number;
  categoryName: string;
  status: t.ProductStatusValue;
}

export async function listInventory(filters: {
  search?: string;
  categoryId?: string;
  stockFilter?: 'all' | 'in' | 'low' | 'out';
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 12));

  const clauses: SQL[] = [sql`${t.products.status} <> 'ARCHIVED'`];
  if (filters.categoryId) clauses.push(eq(t.products.categoryId, filters.categoryId));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const match = or(
      ilike(t.products.name, term),
      ilike(t.productVariants.sku, term),
      ilike(t.products.sku, term),
    );
    if (match) clauses.push(match);
  }
  if (filters.stockFilter === 'out') clauses.push(sql`${t.inventory.quantity} <= 0`);
  if (filters.stockFilter === 'low') {
    clauses.push(sql`${t.inventory.quantity} > 0 and ${t.inventory.quantity} <= ${t.inventory.lowStockThreshold}`);
  }
  if (filters.stockFilter === 'in') {
    clauses.push(sql`${t.inventory.quantity} > ${t.inventory.lowStockThreshold}`);
  }

  const where = and(...clauses);

  const rows = await db
    .select({
      productId: t.products.id,
      variantId: t.productVariants.id,
      productName: t.products.name,
      slug: t.products.slug,
      sku: t.productVariants.sku,
      color: t.productVariants.color,
      size: t.productVariants.size,
      imageUrl: imageSql,
      quantity: t.inventory.quantity,
      reserved: t.inventory.reserved,
      lowStockThreshold: t.inventory.lowStockThreshold,
      pricePaise: t.products.pricePaise,
      categoryName: t.categories.name,
      status: t.products.status,
    })
    .from(t.inventory)
    .innerJoin(t.productVariants, eq(t.inventory.variantId, t.productVariants.id))
    .innerJoin(t.products, eq(t.inventory.productId, t.products.id))
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where)
    .orderBy(asc(t.inventory.quantity), asc(t.products.name))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(t.inventory)
    .innerJoin(t.productVariants, eq(t.inventory.variantId, t.productVariants.id))
    .innerJoin(t.products, eq(t.inventory.productId, t.products.id))
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(where);

  return {
    items: rows.map((row) => ({
      ...row,
      variantLabel: [row.color, row.size].filter(Boolean).join(' / ') || null,
    })) as InventoryRowView[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getStockHistory(productId: string, limit = 20) {
  return db.query.stockMovements.findMany({
    where: eq(t.stockMovements.productId, productId),
    orderBy: [desc(t.stockMovements.createdAt)],
    limit,
    with: { variant: { columns: { sku: true, color: true, size: true } } },
  });
}

export async function getVariantsForProducts(productIds: string[]) {
  if (productIds.length === 0) return [];
  return db.query.productVariants.findMany({
    where: inArray(t.productVariants.productId, productIds),
    with: { inventory: true },
  });
}
