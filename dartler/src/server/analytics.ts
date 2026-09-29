import 'server-only';
import { and, desc, eq, gte, lt, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

/** Orders that count as revenue. Cancelled and failed orders never do. */
const REVENUE_STATUSES = sql`${t.orders.status} not in ('CANCELLED', 'FAILED')`;

export interface DateRange {
  from: Date;
  to: Date;
}

export function rangeForDays(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from, to };
}

export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: range.from };
}

export interface KpiValue {
  current: number;
  previous: number;
  changePercent: number | null;
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

async function revenueAndOrders(range: DateRange) {
  const [row] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${t.orders.totalPaise}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    })
    .from(t.orders)
    .where(and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to), REVENUE_STATUSES));

  return { revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) };
}

async function newCustomers(range: DateRange): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(t.profiles)
    .where(and(gte(t.profiles.createdAt, range.from), lt(t.profiles.createdAt, range.to)));
  return Number(row?.value ?? 0);
}

async function uniqueVisitors(range: DateRange): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(distinct ${t.pageViews.visitorId})::int` })
    .from(t.pageViews)
    .where(and(gte(t.pageViews.createdAt, range.from), lt(t.pageViews.createdAt, range.to)));
  return Number(row?.value ?? 0);
}

export interface DashboardKpis {
  totalSales: KpiValue;
  totalOrders: KpiValue;
  totalCustomers: KpiValue;
  conversionRate: KpiValue;
  averageOrderValue: KpiValue;
  visitors: number;
  /** Lifetime customer count — the KPI tile shows this with the period delta. */
  totalCustomersAllTime: number;
  /** True when there is no visitor data yet, so conversion cannot be computed. */
  conversionUnavailable: boolean;
}

export async function getDashboardKpis(range: DateRange): Promise<DashboardKpis> {
  const prev = previousRange(range);

  const [current, previous, customersNow, customersBefore, visitorsNow, visitorsBefore, allTime] =
    await Promise.all([
      revenueAndOrders(range),
      revenueAndOrders(prev),
      newCustomers(range),
      newCustomers(prev),
      uniqueVisitors(range),
      uniqueVisitors(prev),
      db.select({ value: sql<number>`count(*)::int` }).from(t.profiles),
    ]);

  const conversionNow = visitorsNow > 0 ? (current.orders / visitorsNow) * 100 : 0;
  const conversionBefore = visitorsBefore > 0 ? (previous.orders / visitorsBefore) * 100 : 0;
  const aovNow = current.orders > 0 ? current.revenue / current.orders : 0;
  const aovBefore = previous.orders > 0 ? previous.revenue / previous.orders : 0;

  return {
    totalSales: {
      current: current.revenue,
      previous: previous.revenue,
      changePercent: change(current.revenue, previous.revenue),
    },
    totalOrders: {
      current: current.orders,
      previous: previous.orders,
      changePercent: change(current.orders, previous.orders),
    },
    totalCustomers: {
      current: customersNow,
      previous: customersBefore,
      changePercent: change(customersNow, customersBefore),
    },
    conversionRate: {
      current: conversionNow,
      previous: conversionBefore,
      changePercent: change(conversionNow, conversionBefore),
    },
    averageOrderValue: {
      current: Math.round(aovNow),
      previous: Math.round(aovBefore),
      changePercent: change(aovNow, aovBefore),
    },
    visitors: visitorsNow,
    totalCustomersAllTime: Number(allTime[0]?.value ?? 0),
    conversionUnavailable: visitorsNow === 0,
  };
}

export type Granularity = 'day' | 'week' | 'month';

export interface TrendPoint {
  bucket: string;
  label: string;
  revenue: number;
  orders: number;
}

export async function getSalesTrend(
  range: DateRange,
  granularity: Granularity = 'day',
): Promise<TrendPoint[]> {
  // The granularity is inlined rather than bound as a parameter: a bound value
  // would appear as $1 in SELECT and $2 in GROUP BY, and Postgres would then
  // treat the two date_trunc() calls as different expressions.
  const unit = sql.raw(
    granularity === 'month' ? `'month'` : granularity === 'week' ? `'week'` : `'day'`,
  );

  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc(${unit}, ${t.orders.placedAt}), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(${t.orders.totalPaise}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    })
    .from(t.orders)
    .where(and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to), REVENUE_STATUSES))
    .groupBy(sql`date_trunc(${unit}, ${t.orders.placedAt})`)
    .orderBy(sql`date_trunc(${unit}, ${t.orders.placedAt})`);

  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: granularity === 'month' ? undefined : '2-digit',
    month: 'short',
    year: granularity === 'month' ? 'numeric' : undefined,
  });

  return rows.map((row) => ({
    bucket: row.bucket,
    label: formatter.format(new Date(`${row.bucket}T00:00:00`)),
    revenue: Number(row.revenue),
    orders: Number(row.orders),
  }));
}

export interface CategoryRevenue {
  categoryId: string;
  name: string;
  revenue: number;
  units: number;
  share: number;
}

export async function getRevenueByCategory(range: DateRange): Promise<CategoryRevenue[]> {
  const rows = await db
    .select({
      categoryId: t.categories.id,
      name: t.categories.name,
      revenue: sql<number>`coalesce(sum(${t.orderItems.totalPaise}), 0)::bigint`,
      units: sql<number>`coalesce(sum(${t.orderItems.quantity}), 0)::int`,
    })
    .from(t.orderItems)
    .innerJoin(t.orders, eq(t.orderItems.orderId, t.orders.id))
    .innerJoin(t.products, eq(t.orderItems.productId, t.products.id))
    .innerJoin(t.categories, eq(t.products.categoryId, t.categories.id))
    .where(and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to), REVENUE_STATUSES))
    .groupBy(t.categories.id, t.categories.name)
    .orderBy(desc(sql`sum(${t.orderItems.totalPaise})`));

  const total = rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    revenue: Number(row.revenue),
    units: Number(row.units),
    share: total === 0 ? 0 : (Number(row.revenue) / total) * 100,
  }));
}

export interface ProductPerformance {
  productId: string | null;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  units: number;
  revenue: number;
}

export async function getProductPerformance(
  range: DateRange,
  direction: 'top' | 'bottom' = 'top',
  limit = 5,
): Promise<ProductPerformance[]> {
  const rows = await db
    .select({
      productId: t.orderItems.productId,
      name: sql<string>`min(${t.orderItems.name})`,
      slug: sql<string | null>`min(${t.orderItems.slug})`,
      imageUrl: sql<string | null>`min(${t.orderItems.imageUrl})`,
      units: sql<number>`coalesce(sum(${t.orderItems.quantity}), 0)::int`,
      revenue: sql<number>`coalesce(sum(${t.orderItems.totalPaise}), 0)::bigint`,
    })
    .from(t.orderItems)
    .innerJoin(t.orders, eq(t.orderItems.orderId, t.orders.id))
    .where(and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to), REVENUE_STATUSES))
    .groupBy(t.orderItems.productId)
    .orderBy(
      direction === 'top'
        ? desc(sql`sum(${t.orderItems.quantity})`)
        : sql`sum(${t.orderItems.quantity}) asc`,
    )
    .limit(limit);

  return rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    imageUrl: row.imageUrl,
    units: Number(row.units),
    revenue: Number(row.revenue),
  }));
}

export async function getRecentOrders(limit = 6) {
  return db.query.orders.findMany({
    orderBy: [desc(t.orders.placedAt)],
    limit,
    columns: {
      id: true,
      orderNumber: true,
      customerName: true,
      totalPaise: true,
      status: true,
      placedAt: true,
      paymentStatus: true,
    },
  });
}

export interface InventorySummary {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalUnits: number;
  stockValuePaise: number;
}

export async function getInventorySummary(lowStockThreshold: number): Promise<InventorySummary> {
  const [row] = await db
    .select({
      totalProducts: sql<number>`count(distinct ${t.products.id})::int`,
      totalUnits: sql<number>`coalesce(sum(inv.quantity), 0)::int`,
      stockValue: sql<number>`coalesce(sum(inv.quantity * ${t.products.pricePaise}), 0)::bigint`,
    })
    .from(t.products)
    .leftJoin(sql`inventory inv`, sql`inv.product_id = products.id`)
    .where(notInArray(t.products.status, ['ARCHIVED']));

  const perProduct = await db
    .select({
      productId: t.products.id,
      quantity: sql<number>`coalesce((select sum(i.quantity) from inventory i where i.product_id = products.id), 0)::int`,
    })
    .from(t.products)
    .where(notInArray(t.products.status, ['ARCHIVED']));

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  for (const product of perProduct) {
    if (product.quantity <= 0) outOfStock += 1;
    else if (product.quantity <= lowStockThreshold) lowStock += 1;
    else inStock += 1;
  }

  return {
    totalProducts: Number(row?.totalProducts ?? 0),
    inStock,
    lowStock,
    outOfStock,
    totalUnits: Number(row?.totalUnits ?? 0),
    stockValuePaise: Number(row?.stockValue ?? 0),
  };
}

export async function getOrderStatusCounts(range: DateRange) {
  const rows = await db
    .select({
      status: t.orders.status,
      total: sql<number>`count(*)::int`,
    })
    .from(t.orders)
    .where(and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to)))
    .groupBy(t.orders.status);

  return rows.map((row) => ({ status: row.status, total: Number(row.total) }));
}

export async function getPendingCounts() {
  const [requests] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(t.serviceRequests)
    .where(eq(t.serviceRequests.status, 'PENDING'));

  const [awaitingShipment] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(t.orders)
    .where(sql`${t.orders.status} in ('CONFIRMED', 'PROCESSING')`);

  return {
    openRequests: Number(requests?.value ?? 0),
    awaitingShipment: Number(awaitingShipment?.value ?? 0),
  };
}
