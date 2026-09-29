/**
 * Dartler — PostgreSQL schema (Drizzle ORM).
 *
 * Conventions:
 *   * every table has a UUID primary key and created_at / updated_at
 *   * all money is an INTEGER number of paise — never a float, never rupees
 *   * tax rates are basis points (1800 = 18%)
 *   * indexes exist on every slug, SKU, order number, email and common filter
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------- enums

export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'INACTIVE', 'BLOCKED']);
export const addressTypeEnum = pgEnum('address_type', ['HOME', 'WORK', 'OTHER']);
export const productStatusEnum = pgEnum('product_status', ['DRAFT', 'ACTIVE', 'ARCHIVED']);
export const orderStatusEnum = pgEnum('order_status', [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'FAILED',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'COD',
  'UPI',
  'CARD',
  'NETBANKING',
  'WALLET',
]);
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'PENDING',
  'MANIFESTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'EXCEPTION',
  'RTO',
  'CANCELLED',
]);
export const requestTypeEnum = pgEnum('request_type', ['RETURN', 'CANCELLATION']);
export const requestStatusEnum = pgEnum('request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
]);
export const refundStatusEnum = pgEnum('refund_status', [
  'NOT_APPLICABLE',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export const couponTypeEnum = pgEnum('coupon_type', ['PERCENT', 'FIXED']);
export const stockReasonEnum = pgEnum('stock_reason', [
  'INITIAL',
  'PURCHASE',
  'SALE',
  'SALE_REVERSAL',
  'RETURN',
  'DAMAGE',
  'CORRECTION',
]);
export const actorTypeEnum = pgEnum('actor_type', ['CUSTOMER', 'ADMIN', 'SYSTEM']);
export const salesChannelEnum = pgEnum('sales_channel', ['WEBSITE', 'AMAZON', 'MEESHO', 'OFFLINE']);

const now = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const touched = () =>
  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

// ---------------------------------------------------------------- customers

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    status: accountStatusEnum('status').default('ACTIVE').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    marketingOptIn: boolean('marketing_opt_in').default(false).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    emailIdx: uniqueIndex('profiles_email_key').on(t.email),
    phoneIdx: index('profiles_phone_idx').on(t.phone),
    createdIdx: index('profiles_created_idx').on(t.createdAt),
  }),
);

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    label: addressTypeEnum('label').default('HOME').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),
    country: text('country').default('India').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    profileIdx: index('addresses_profile_idx').on(t.profileId),
    pincodeIdx: index('addresses_pincode_idx').on(t.pincode),
  }),
);

// ---------------------------------------------------------------- catalogue

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    accent: text('accent'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    slugIdx: uniqueIndex('categories_slug_key').on(t.slug),
    activeIdx: index('categories_active_sort_idx').on(t.isActive, t.sortOrder),
  }),
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sku: text('sku').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    shortDescription: text('short_description'),
    description: text('description').default('').notNull(),
    specifications: jsonb('specifications')
      .$type<{ label: string; value: string }[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    pricePaise: integer('price_paise').notNull(),
    compareAtPaise: integer('compare_at_paise'),
    costPaise: integer('cost_paise'),
    taxBps: integer('tax_bps').default(1800).notNull(),
    status: productStatusEnum('status').default('ACTIVE').notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    ratingAvg: doublePrecision('rating_avg').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),
    soldCount: integer('sold_count').default(0).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    weightGrams: integer('weight_grams').default(200).notNull(),
    lengthCm: integer('length_cm'),
    breadthCm: integer('breadth_cm'),
    heightCm: integer('height_cm'),
    hsnCode: text('hsn_code'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    slugIdx: uniqueIndex('products_slug_key').on(t.slug),
    skuIdx: uniqueIndex('products_sku_key').on(t.sku),
    categoryIdx: index('products_category_status_idx').on(t.categoryId, t.status),
    featuredIdx: index('products_status_featured_idx').on(t.status, t.isFeatured),
    createdIdx: index('products_status_created_idx').on(t.status, t.createdAt),
    priceIdx: index('products_price_idx').on(t.pricePaise),
    nameIdx: index('products_name_idx').on(t.name),
  }),
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    alt: text('alt').default('').notNull(),
    position: integer('position').default(0).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    productIdx: index('product_images_product_position_idx').on(t.productId, t.position),
  }),
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    color: text('color'),
    colorHex: text('color_hex'),
    size: text('size'),
    pricePaise: integer('price_paise'),
    position: integer('position').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    skuIdx: uniqueIndex('product_variants_sku_key').on(t.sku),
    productIdx: index('product_variants_product_position_idx').on(t.productId, t.position),
  }),
);

export const inventory = pgTable(
  'inventory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').default(0).notNull(),
    reserved: integer('reserved').default(0).notNull(),
    lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
    channel: salesChannelEnum('channel').default('WEBSITE').notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    variantIdx: uniqueIndex('inventory_variant_key').on(t.variantId),
    productIdx: index('inventory_product_idx').on(t.productId),
    quantityIdx: index('inventory_quantity_idx').on(t.quantity),
  }),
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    balance: integer('balance').notNull(),
    reason: stockReasonEnum('reason').notNull(),
    note: text('note'),
    orderId: uuid('order_id'),
    actorType: actorTypeEnum('actor_type').default('ADMIN').notNull(),
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    createdAt: now(),
  },
  (t) => ({
    productIdx: index('stock_movements_product_created_idx').on(t.productId, t.createdAt),
  }),
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    isApproved: boolean('is_approved').default(true).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    productIdx: index('reviews_product_idx').on(t.productId, t.isApproved, t.createdAt),
  }),
);

export const wishlists = pgTable(
  'wishlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    profileIdx: uniqueIndex('wishlists_profile_key').on(t.profileId),
  }),
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wishlistId: uuid('wishlist_id')
      .notNull()
      .references(() => wishlists.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: now(),
  },
  (t) => ({
    uniqueItem: uniqueIndex('wishlist_items_unique').on(t.wishlistId, t.productId),
  }),
);

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    description: text('description'),
    type: couponTypeEnum('type').default('PERCENT').notNull(),
    value: integer('value').notNull(),
    minOrderPaise: integer('min_order_paise').default(0).notNull(),
    maxDiscountPaise: integer('max_discount_paise'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    codeIdx: uniqueIndex('coupons_code_key').on(t.code),
    activeIdx: index('coupons_active_idx').on(t.isActive),
  }),
);

// ---------------------------------------------------------------- orders

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    customerName: text('customer_name').notNull(),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    channel: salesChannelEnum('channel').default('WEBSITE').notNull(),
    couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
    couponCode: text('coupon_code'),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').default(0).notNull(),
    shippingPaise: integer('shipping_paise').default(0).notNull(),
    taxPaise: integer('tax_paise').default(0).notNull(),
    totalPaise: integer('total_paise').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').default('PENDING').notNull(),
    shippingAddress: jsonb('shipping_address').$type<OrderAddress>().notNull(),
    billingAddress: jsonb('billing_address').$type<OrderAddress>().notNull(),
    customerNote: text('customer_note'),
    internalNote: text('internal_note'),
    idempotencyKey: text('idempotency_key'),
    placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    numberIdx: uniqueIndex('orders_number_key').on(t.orderNumber),
    idempotencyIdx: uniqueIndex('orders_idempotency_key').on(t.idempotencyKey),
    profileIdx: index('orders_profile_placed_idx').on(t.profileId, t.placedAt),
    statusIdx: index('orders_status_placed_idx').on(t.status, t.placedAt),
    emailIdx: index('orders_email_idx').on(t.email),
    placedIdx: index('orders_placed_idx').on(t.placedAt),
  }),
);

export interface OrderAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    sku: text('sku').notNull(),
    slug: text('slug'),
    variantLabel: text('variant_label'),
    imageUrl: text('image_url'),
    unitPricePaise: integer('unit_price_paise').notNull(),
    quantity: integer('quantity').notNull(),
    taxBps: integer('tax_bps').default(1800).notNull(),
    taxPaise: integer('tax_paise').default(0).notNull(),
    totalPaise: integer('total_paise').notNull(),
    createdAt: now(),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
    productIdx: index('order_items_product_idx').on(t.productId),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').default('razorpay').notNull(),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').default('PENDING').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    refundedPaise: integer('refunded_paise').default(0).notNull(),
    providerOrderId: text('provider_order_id'),
    providerPaymentId: text('provider_payment_id'),
    providerRefundId: text('provider_refund_id'),
    failureReason: text('failure_reason'),
    rawPayload: jsonb('raw_payload'),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    orderIdx: index('payments_order_idx').on(t.orderId),
    providerOrderIdx: index('payments_provider_order_idx').on(t.providerOrderId),
    providerPaymentIdx: uniqueIndex('payments_provider_payment_key').on(t.providerPaymentId),
  }),
);

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').default('delhivery').notNull(),
    awb: text('awb'),
    courier: text('courier'),
    status: shipmentStatusEnum('status').default('PENDING').notNull(),
    pickupLocation: text('pickup_location'),
    estimatedDelivery: timestamp('estimated_delivery', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    labelUrl: text('label_url'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    rawPayload: jsonb('raw_payload'),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    awbIdx: uniqueIndex('shipments_awb_key').on(t.awb),
    orderIdx: index('shipments_order_idx').on(t.orderId),
    statusIdx: index('shipments_status_idx').on(t.status),
  }),
);

export const trackingEvents = pgTable(
  'tracking_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: shipmentStatusEnum('status').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    location: text('location'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: now(),
  },
  (t) => ({
    uniqueEvent: uniqueIndex('tracking_events_unique').on(t.shipmentId, t.status, t.occurredAt),
    shipmentIdx: index('tracking_events_shipment_idx').on(t.shipmentId, t.occurredAt),
  }),
);

/**
 * Returns and cancellations share one table with a discriminating `type`,
 * which keeps the customer "My Requests" view and the admin queue simple.
 */
export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestNumber: text('request_number').notNull(),
    type: requestTypeEnum('type').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    details: text('details'),
    images: text('images')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    status: requestStatusEnum('status').default('PENDING').notNull(),
    refundStatus: refundStatusEnum('refund_status').default('NOT_APPLICABLE').notNull(),
    refundPaise: integer('refund_paise').default(0).notNull(),
    adminNote: text('admin_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    numberIdx: uniqueIndex('service_requests_number_key').on(t.requestNumber),
    orderIdx: index('service_requests_order_idx').on(t.orderId),
    statusIdx: index('service_requests_status_idx').on(t.status, t.createdAt),
  }),
);

// ---------------------------------------------------------------- admin

export const adminRoles = pgTable(
  'admin_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    nameIdx: uniqueIndex('admin_roles_name_key').on(t.name),
  }),
);

export const adminPermissions = pgTable(
  'admin_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    createdAt: now(),
  },
  (t) => ({
    uniqueKey: uniqueIndex('admin_permissions_unique').on(t.roleId, t.key),
    roleIdx: index('admin_permissions_role_idx').on(t.roleId),
  }),
);

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => adminRoles.id, { onDelete: 'restrict' }),
    status: accountStatusEnum('status').default('ACTIVE').notNull(),
    twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
    twoFactorSecret: text('two_factor_secret'),
    backupCodes: text('backup_codes')
      .array()
      .default(sql`ARRAY[]::text[]`)
      .notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: now(),
    updatedAt: touched(),
  },
  (t) => ({
    emailIdx: uniqueIndex('admin_users_email_key').on(t.email),
    roleIdx: index('admin_users_role_idx').on(t.roleId),
  }),
);

/**
 * One table for both customer and admin sessions so "log out all devices",
 * login history and session revocation work identically for each.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectType: actorTypeEnum('subject_type').notNull(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: now(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    profileIdx: index('sessions_profile_idx').on(t.profileId),
    adminIdx: index('sessions_admin_idx').on(t.adminUserId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorType: actorTypeEnum('actor_type').default('ADMIN').notNull(),
    actorId: uuid('actor_id'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    summary: text('summary'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: now(),
  },
  (t) => ({
    entityIdx: index('audit_logs_entity_idx').on(t.entity, t.entityId),
    createdIdx: index('audit_logs_created_idx').on(t.createdAt),
    actorIdx: index('audit_logs_actor_idx').on(t.actorId),
  }),
);

export const loginEvents = pgTable(
  'login_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectType: actorTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id'),
    email: text('email').notNull(),
    success: boolean('success').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: now(),
  },
  (t) => ({
    emailIdx: index('login_events_email_idx').on(t.email, t.createdAt),
  }),
);

/** Single-row store configuration (id is always "default"). */
export const storeSettings = pgTable('store_settings', {
  id: text('id').primaryKey().default('default'),
  storeName: text('store_name').default('Dartler').notNull(),
  supportEmail: text('support_email').default('care@dartler.com').notNull(),
  supportPhone: text('support_phone').default('+91 90000 00000').notNull(),
  freeShippingAbovePaise: integer('free_shipping_above_paise').default(99900).notNull(),
  flatShippingPaise: integer('flat_shipping_paise').default(4900).notNull(),
  defaultTaxBps: integer('default_tax_bps').default(1800).notNull(),
  returnWindowDays: integer('return_window_days').default(7).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(10).notNull(),
  codEnabled: boolean('cod_enabled').default(true).notNull(),
  onlinePaymentEnabled: boolean('online_payment_enabled').default(true).notNull(),
  pickupPincode: text('pickup_pincode').default('641004').notNull(),
  pickupName: text('pickup_name').default('Dartler Coimbatore').notNull(),
  notifyOnOrder: boolean('notify_on_order').default(true).notNull(),
  notifyOnShipment: boolean('notify_on_shipment').default(true).notNull(),
  createdAt: now(),
  updatedAt: touched(),
});

// ---------------------------------------------------------------- relations

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews),
  sessions: many(sessions),
  serviceRequests: many(serviceRequests),
  wishlist: one(wishlists, { fields: [profiles.id], references: [wishlists.profileId] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  profile: one(profiles, { fields: [addresses.profileId], references: [profiles.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
  inventory: many(inventory),
  reviews: many(reviews),
  stockMovements: many(stockMovements),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  inventory: one(inventory, {
    fields: [productVariants.id],
    references: [inventory.variantId],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  product: one(products, { fields: [inventory.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [inventory.variantId], references: [productVariants.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  profile: one(profiles, { fields: [reviews.profileId], references: [profiles.id] }),
}));

export const wishlistsRelations = relations(wishlists, ({ one, many }) => ({
  profile: one(profiles, { fields: [wishlists.profileId], references: [profiles.id] }),
  items: many(wishlistItems),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  wishlist: one(wishlists, { fields: [wishlistItems.wishlistId], references: [wishlists.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  profile: one(profiles, { fields: [orders.profileId], references: [profiles.id] }),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
  items: many(orderItems),
  payments: many(payments),
  shipments: many(shipments),
  requests: many(serviceRequests),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  events: many(trackingEvents),
}));

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
  shipment: one(shipments, { fields: [trackingEvents.shipmentId], references: [shipments.id] }),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  order: one(orders, { fields: [serviceRequests.orderId], references: [orders.id] }),
  profile: one(profiles, { fields: [serviceRequests.profileId], references: [profiles.id] }),
}));

export const adminRolesRelations = relations(adminRoles, ({ many }) => ({
  users: many(adminUsers),
  permissions: many(adminPermissions),
}));

export const adminPermissionsRelations = relations(adminPermissions, ({ one }) => ({
  role: one(adminRoles, { fields: [adminPermissions.roleId], references: [adminRoles.id] }),
}));

export const adminUsersRelations = relations(adminUsers, ({ one, many }) => ({
  role: one(adminRoles, { fields: [adminUsers.roleId], references: [adminRoles.id] }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  profile: one(profiles, { fields: [sessions.profileId], references: [profiles.id] }),
  adminUser: one(adminUsers, { fields: [sessions.adminUserId], references: [adminUsers.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  variant: one(productVariants, {
    fields: [stockMovements.variantId],
    references: [productVariants.id],
  }),
}));

// ---------------------------------------------------------------- inferred types

export type Profile = typeof profiles.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InventoryRow = typeof inventory.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type AdminRole = typeof adminRoles.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type PaymentStatusValue = (typeof paymentStatusEnum.enumValues)[number];
export type PaymentMethodValue = (typeof paymentMethodEnum.enumValues)[number];
export type ShipmentStatusValue = (typeof shipmentStatusEnum.enumValues)[number];
export type ProductStatusValue = (typeof productStatusEnum.enumValues)[number];
export type RequestStatusValue = (typeof requestStatusEnum.enumValues)[number];
export type RequestTypeValue = (typeof requestTypeEnum.enumValues)[number];
export type StockReasonValue = (typeof stockReasonEnum.enumValues)[number];
export type AccountStatusValue = (typeof accountStatusEnum.enumValues)[number];
export type RefundStatusValue = (typeof refundStatusEnum.enumValues)[number];

/**
 * Anonymous page-view log. This is what makes the dashboard's conversion rate
 * a real measurement (orders ÷ visitors) rather than a decorative number.
 * No personal data is stored — only an opaque visitor id from a cookie.
 */
export const pageViews = pgTable(
  'page_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    visitorId: text('visitor_id').notNull(),
    path: text('path').notNull(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    createdAt: now(),
  },
  (t) => ({
    createdIdx: index('page_views_created_idx').on(t.createdAt),
    visitorIdx: index('page_views_visitor_idx').on(t.visitorId, t.createdAt),
    productIdx: index('page_views_product_idx').on(t.productId),
  }),
);

export type PageView = typeof pageViews.$inferSelect;
