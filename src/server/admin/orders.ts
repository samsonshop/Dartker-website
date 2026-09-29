import 'server-only';
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';

export interface AdminOrderFilters {
  search?: string;
  status?: t.OrderStatus | 'ALL';
  paymentStatus?: t.PaymentStatusValue | 'ALL';
  from?: Date;
  to?: Date;
  page?: number;
  perPage?: number;
}

export async function listAdminOrders(filters: AdminOrderFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 12));

  const clauses: SQL[] = [];
  if (filters.status && filters.status !== 'ALL') clauses.push(eq(t.orders.status, filters.status));
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    clauses.push(eq(t.orders.paymentStatus, filters.paymentStatus));
  }
  if (filters.from) clauses.push(gte(t.orders.placedAt, filters.from));
  if (filters.to) clauses.push(lte(t.orders.placedAt, filters.to));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const match = or(
      ilike(t.orders.orderNumber, term),
      ilike(t.orders.customerName, term),
      ilike(t.orders.email, term),
      ilike(t.orders.phone, term),
    );
    if (match) clauses.push(match);
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const rows = await db
    .select({
      id: t.orders.id,
      orderNumber: t.orders.orderNumber,
      customerName: t.orders.customerName,
      email: t.orders.email,
      phone: t.orders.phone,
      status: t.orders.status,
      paymentStatus: t.orders.paymentStatus,
      paymentMethod: t.orders.paymentMethod,
      totalPaise: t.orders.totalPaise,
      placedAt: t.orders.placedAt,
      itemCount: sql<number>`(
        select coalesce(sum(oi.quantity), 0) from order_items oi where oi.order_id = orders.id
      )::int`,
      awb: sql<string | null>`(
        select s.awb from shipments s where s.order_id = orders.id order by s.created_at desc limit 1
      )`,
    })
    .from(t.orders)
    .where(where)
    .orderBy(desc(t.orders.placedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db.select({ value: count() }).from(t.orders).where(where);

  return {
    items: rows,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export type AdminOrderRow = Awaited<ReturnType<typeof listAdminOrders>>['items'][number];

export async function getOrderStatusTabCounts() {
  const rows = await db
    .select({ status: t.orders.status, total: sql<number>`count(*)::int` })
    .from(t.orders)
    .groupBy(t.orders.status);

  const map = new Map(rows.map((row) => [row.status, Number(row.total)]));
  const all = rows.reduce((sum, row) => sum + Number(row.total), 0);
  return { all, byStatus: map };
}

export async function getAdminOrder(orderNumber: string) {
  return db.query.orders.findFirst({
    where: eq(t.orders.orderNumber, orderNumber),
    with: {
      items: true,
      payments: { orderBy: [desc(t.payments.createdAt)] },
      shipments: {
        orderBy: [desc(t.shipments.createdAt)],
        with: { events: { orderBy: [desc(t.trackingEvents.occurredAt)] } },
      },
      requests: { orderBy: [desc(t.serviceRequests.createdAt)] },
      profile: { columns: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
    },
  });
}

export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

export async function getOrderAuditTrail(orderId: string) {
  return db.query.auditLogs.findMany({
    where: and(eq(t.auditLogs.entity, 'order'), eq(t.auditLogs.entityId, orderId)),
    orderBy: [desc(t.auditLogs.createdAt)],
    limit: 30,
  });
}

export interface AdminCustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: t.AccountStatusValue;
  orderCount: number;
  totalSpentPaise: number;
  lastOrderAt: Date | null;
  createdAt: Date;
  city: string | null;
}

export async function listAdminCustomers(filters: {
  search?: string;
  status?: t.AccountStatusValue | 'ALL';
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 12));

  const clauses: SQL[] = [];
  if (filters.status && filters.status !== 'ALL') clauses.push(eq(t.profiles.status, filters.status));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const match = or(
      ilike(t.profiles.fullName, term),
      ilike(t.profiles.email, term),
      ilike(t.profiles.phone, term),
    );
    if (match) clauses.push(match);
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const rows = await db
    .select({
      id: t.profiles.id,
      fullName: t.profiles.fullName,
      email: t.profiles.email,
      phone: t.profiles.phone,
      status: t.profiles.status,
      createdAt: t.profiles.createdAt,
      orderCount: sql<number>`(
        select count(*) from orders o
        where o.profile_id = profiles.id and o.status not in ('CANCELLED', 'FAILED')
      )::int`,
      totalSpentPaise: sql<number>`(
        select coalesce(sum(o.total_paise), 0) from orders o
        where o.profile_id = profiles.id and o.status not in ('CANCELLED', 'FAILED')
      )::bigint`,
      lastOrderAt: sql<Date | null>`(
        select max(o.placed_at) from orders o where o.profile_id = profiles.id
      )`,
      city: sql<string | null>`(
        select a.city from addresses a where a.profile_id = profiles.id
        order by a.is_default desc, a.updated_at desc limit 1
      )`,
    })
    .from(t.profiles)
    .where(where)
    .orderBy(desc(t.profiles.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db.select({ value: count() }).from(t.profiles).where(where);

  return {
    items: rows.map((row) => ({
      ...row,
      totalSpentPaise: Number(row.totalSpentPaise),
      lastOrderAt: row.lastOrderAt ? new Date(row.lastOrderAt) : null,
    })) as AdminCustomerRow[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getAdminCustomer(id: string) {
  return db.query.profiles.findFirst({
    where: eq(t.profiles.id, id),
    with: {
      addresses: true,
      orders: { orderBy: [desc(t.orders.placedAt)], with: { items: true }, limit: 30 },
    },
  });
}

export async function listServiceRequests(filters: {
  status?: t.RequestStatusValue | 'ALL';
  type?: t.RequestTypeValue | 'ALL';
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 15));

  const clauses: SQL[] = [];
  if (filters.status && filters.status !== 'ALL') {
    clauses.push(eq(t.serviceRequests.status, filters.status));
  }
  if (filters.type && filters.type !== 'ALL') clauses.push(eq(t.serviceRequests.type, filters.type));
  const where = clauses.length ? and(...clauses) : undefined;

  const items = await db.query.serviceRequests.findMany({
    where,
    orderBy: [desc(t.serviceRequests.createdAt)],
    limit: perPage,
    offset: (page - 1) * perPage,
    with: {
      order: {
        columns: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalPaise: true,
          status: true,
          paymentMethod: true,
        },
      },
    },
  });

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(t.serviceRequests)
    .where(where);

  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function listShipments(filters: {
  status?: t.ShipmentStatusValue | 'ALL';
  search?: string;
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(5, filters.perPage ?? 15));

  const clauses: SQL[] = [];
  if (filters.status && filters.status !== 'ALL') clauses.push(eq(t.shipments.status, filters.status));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const match = or(ilike(t.shipments.awb, term), ilike(t.orders.orderNumber, term));
    if (match) clauses.push(match);
  }
  const where = clauses.length ? and(...clauses) : undefined;

  const rows = await db
    .select({
      id: t.shipments.id,
      awb: t.shipments.awb,
      courier: t.shipments.courier,
      status: t.shipments.status,
      estimatedDelivery: t.shipments.estimatedDelivery,
      createdAt: t.shipments.createdAt,
      lastSyncedAt: t.shipments.lastSyncedAt,
      lastError: t.shipments.lastError,
      orderNumber: t.orders.orderNumber,
      customerName: t.orders.customerName,
      city: sql<string>`orders.shipping_address ->> 'city'`,
      pincode: sql<string>`orders.shipping_address ->> 'pincode'`,
    })
    .from(t.shipments)
    .innerJoin(t.orders, eq(t.shipments.orderId, t.orders.id))
    .where(where)
    .orderBy(desc(t.shipments.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(t.shipments)
    .innerJoin(t.orders, eq(t.shipments.orderId, t.orders.id))
    .where(where);

  return { items: rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function listOrdersAwaitingShipment(limit = 20) {
  return db
    .select({
      id: t.orders.id,
      orderNumber: t.orders.orderNumber,
      customerName: t.orders.customerName,
      totalPaise: t.orders.totalPaise,
      placedAt: t.orders.placedAt,
      status: t.orders.status,
      city: sql<string>`orders.shipping_address ->> 'city'`,
      pincode: sql<string>`orders.shipping_address ->> 'pincode'`,
    })
    .from(t.orders)
    .where(
      sql`${t.orders.status} in ('CONFIRMED', 'PROCESSING')
          and not exists (select 1 from shipments s where s.order_id = orders.id)`,
    )
    .orderBy(desc(t.orders.placedAt))
    .limit(limit);
}
