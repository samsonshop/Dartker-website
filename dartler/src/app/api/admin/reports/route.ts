import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ApiError, requireAdminApi } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAudit } from '@/lib/audit';
import { rangeForDays, getProductPerformance, getRevenueByCategory } from '@/server/analytics';
import { paiseToRupees } from '@/lib/money';
import { toCsv } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type ReportKind = 'sales' | 'orders' | 'products' | 'inventory' | 'customers' | 'categories';

const KINDS: ReportKind[] = ['sales', 'orders', 'products', 'inventory', 'customers', 'categories'];

/** CSV export. Amounts are exported in rupees with two decimals for accounting. */
export async function GET(request: Request) {
  try {
    const session = await requireAdminApi(PERMISSIONS.REPORTS_EXPORT);
    const { searchParams } = new URL(request.url);

    const kind = (searchParams.get('type') ?? 'sales') as ReportKind;
    if (!KINDS.includes(kind)) {
      return Response.json({ error: 'Unknown report type.' }, { status: 400 });
    }

    const days = Number(searchParams.get('range') ?? 30);
    const range = rangeForDays([7, 30, 90, 365].includes(days) ? days : 30);

    let rows: (string | number | null)[][] = [];
    const inRange = and(gte(t.orders.placedAt, range.from), lt(t.orders.placedAt, range.to));

    if (kind === 'orders' || kind === 'sales') {
      const orders = await db.query.orders.findMany({
        where: inRange,
        orderBy: [desc(t.orders.placedAt)],
        with: { items: true, shipments: true },
        limit: 5000,
      });

      rows = [
        [
          'Order number',
          'Placed at',
          'Customer',
          'Email',
          'Phone',
          'City',
          'State',
          'Pincode',
          'Status',
          'Payment method',
          'Payment status',
          'Items',
          'Subtotal (INR)',
          'Discount (INR)',
          'Shipping (INR)',
          'Tax (INR)',
          'Total (INR)',
          'AWB',
        ],
        ...orders.map((order) => [
          order.orderNumber,
          order.placedAt.toISOString(),
          order.customerName,
          order.email,
          order.phone,
          order.shippingAddress.city,
          order.shippingAddress.state,
          order.shippingAddress.pincode,
          order.status,
          order.paymentMethod,
          order.paymentStatus,
          order.items.reduce((total, item) => total + item.quantity, 0),
          paiseToRupees(order.subtotalPaise).toFixed(2),
          paiseToRupees(order.discountPaise).toFixed(2),
          paiseToRupees(order.shippingPaise).toFixed(2),
          paiseToRupees(order.taxPaise).toFixed(2),
          paiseToRupees(order.totalPaise).toFixed(2),
          order.shipments[0]?.awb ?? '',
        ]),
      ];
    } else if (kind === 'products') {
      const performance = await getProductPerformance(range, 'top', 500);
      rows = [
        ['Product', 'SKU / slug', 'Units sold', 'Revenue (INR)'],
        ...performance.map((row) => [
          row.name,
          row.slug ?? '',
          row.units,
          paiseToRupees(row.revenue).toFixed(2),
        ]),
      ];
    } else if (kind === 'categories') {
      const categories = await getRevenueByCategory(range);
      rows = [
        ['Category', 'Units sold', 'Revenue (INR)', 'Share (%)'],
        ...categories.map((row) => [
          row.name,
          row.units,
          paiseToRupees(row.revenue).toFixed(2),
          row.share.toFixed(2),
        ]),
      ];
    } else if (kind === 'inventory') {
      const inventory = await db
        .select({
          product: t.products.name,
          sku: t.productVariants.sku,
          color: t.productVariants.color,
          size: t.productVariants.size,
          quantity: t.inventory.quantity,
          threshold: t.inventory.lowStockThreshold,
          price: t.products.pricePaise,
          status: t.products.status,
        })
        .from(t.inventory)
        .innerJoin(t.productVariants, eq(t.inventory.variantId, t.productVariants.id))
        .innerJoin(t.products, eq(t.inventory.productId, t.products.id))
        .orderBy(t.products.name);

      rows = [
        ['Product', 'Variant SKU', 'Colour', 'Size', 'Quantity', 'Low-stock threshold', 'Unit price (INR)', 'Stock value (INR)', 'Status'],
        ...inventory.map((row) => [
          row.product,
          row.sku,
          row.color ?? '',
          row.size ?? '',
          row.quantity,
          row.threshold,
          paiseToRupees(row.price).toFixed(2),
          paiseToRupees(row.quantity * row.price).toFixed(2),
          row.status,
        ]),
      ];
    } else {
      const customers = await db
        .select({
          name: t.profiles.fullName,
          email: t.profiles.email,
          phone: t.profiles.phone,
          status: t.profiles.status,
          joined: t.profiles.createdAt,
          orders: sql<number>`(
            select count(*) from orders o
            where o.profile_id = profiles.id and o.status not in ('CANCELLED','FAILED')
          )::int`,
          spent: sql<number>`(
            select coalesce(sum(o.total_paise), 0) from orders o
            where o.profile_id = profiles.id and o.status not in ('CANCELLED','FAILED')
          )::bigint`,
        })
        .from(t.profiles)
        .orderBy(desc(t.profiles.createdAt));

      rows = [
        ['Name', 'Email', 'Phone', 'Status', 'Joined', 'Orders', 'Total spent (INR)'],
        ...customers.map((row) => [
          row.name,
          row.email,
          row.phone ?? '',
          row.status,
          row.joined.toISOString().slice(0, 10),
          Number(row.orders),
          paiseToRupees(Number(row.spent)).toFixed(2),
        ]),
      ];
    }

    await recordAudit({
      actorId: session.user.id,
      actorName: session.user.fullName,
      action: 'report.export',
      entity: 'report',
      entityId: kind,
      summary: `Exported the ${kind} report (${rows.length - 1} rows)`,
    });

    const filename = `dartler-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    // The BOM makes Excel open UTF-8 (and the ₹ sign) correctly.
    return new Response(`﻿${toCsv(rows)}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('[reports]', error);
    return Response.json({ error: 'Could not build the report.' }, { status: 500 });
  }
}
