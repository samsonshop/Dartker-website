/**
 * Seeds a realistic Dartler store: catalogue, customers, admin roles, 90 days
 * of orders with payments, shipments and tracking, plus a handful of return
 * requests — enough for every dashboard, report and chart to show real data.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db, pool } from './index';
import * as t from './schema';
import { SEED_CATEGORIES, SEED_CUSTOMERS, SEED_PRODUCTS, SEED_REVIEW_SNIPPETS } from './seed-data';
import { SYSTEM_ROLES } from '../lib/permissions';
import { calculatePricing } from '../lib/pricing';
import { generateOrderNumber, generateRequestNumber, generateSku, randomToken } from '../lib/ids';
import { slugify } from '../lib/utils';
import { generateAll } from '../../scripts/generate-images.mjs';

/** Deterministic PRNG so re-seeding produces a comparable store. */
let seedState = 20260904;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(rnd() * items.length)];
}
function pickInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function daysAgo(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, pickInt(0, 59), pickInt(0, 59), 0);
  return date;
}

const SHIPPING_SETTINGS = { freeShippingAbovePaise: 99900, flatShippingPaise: 4900 };

/**
 * Refuses to run anywhere that looks like production.
 *
 * `main()` starts by truncating all 26 tables, and it creates admin and customer
 * accounts whose passwords are published in the README — so running it against a
 * live database would both destroy the store and leave known-credential accounts
 * behind. Local databases are allowed freely; anything else needs an explicit
 * opt-in.
 */
function assertSafeToSeed(): void {
  const override = process.env.ALLOW_DESTRUCTIVE_SEED === 'true';
  const url = process.env.DATABASE_URL ?? '';

  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // An unparseable URL is handled downstream by the pool; treat it as remote.
    host = 'unknown';
  }
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)$/i.test(host);

  const refuse = (reason: string) => {
    console.error(
      `\n✖ Refusing to seed: ${reason}.\n` +
        '  `npm run db:seed` TRUNCATEs every table and creates accounts whose passwords\n' +
        '  are documented in the README. It is for development databases only.\n' +
        '  To override deliberately: ALLOW_DESTRUCTIVE_SEED=true npm run db:seed\n',
    );
    process.exit(1);
  };

  if (override) {
    console.warn('⚠ ALLOW_DESTRUCTIVE_SEED=true — seeding a non-local database on purpose.');
    return;
  }
  if (process.env.NODE_ENV === 'production') refuse('NODE_ENV is "production"');
  if (!isLocal) refuse(`DATABASE_URL points at a non-local host ("${host}")`);
}

async function main() {
  assertSafeToSeed();

  console.log('› Clearing existing data…');
  await db.execute(sql`
    TRUNCATE TABLE
      tracking_events, shipments, payments, order_items, service_requests, orders,
      stock_movements, inventory, product_variants, product_images, reviews,
      wishlist_items, wishlists, products, categories, coupons,
      addresses, sessions, login_events, audit_logs, profiles,
      admin_permissions, admin_users, admin_roles, store_settings, page_views
    RESTART IDENTITY CASCADE
  `);

  // ------------------------------------------------------------- settings
  await db.insert(t.storeSettings).values({ id: 'default' });

  // ---------------------------------------------------------- admin roles
  console.log('› Creating admin roles and permissions…');
  const roleIdByName = new Map<string, string>();
  for (const role of SYSTEM_ROLES) {
    const [row] = await db
      .insert(t.adminRoles)
      .values({ name: role.name, description: role.description, isSystem: true })
      .returning({ id: t.adminRoles.id });
    roleIdByName.set(role.name, row.id);
    await db
      .insert(t.adminPermissions)
      .values(role.permissions.map((key) => ({ roleId: row.id, key })));
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@dartler.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Dartler@2026';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const [superAdmin] = await db
    .insert(t.adminUsers)
    .values({
      email: adminEmail.toLowerCase(),
      passwordHash: adminHash,
      fullName: 'Dartler Admin',
      roleId: roleIdByName.get('Super Admin')!,
    })
    .returning({ id: t.adminUsers.id });

  await db.insert(t.adminUsers).values([
    {
      email: 'manager@dartler.com',
      passwordHash: adminHash,
      fullName: 'Catalogue Manager',
      roleId: roleIdByName.get('Manager')!,
    },
    {
      email: 'support@dartler.com',
      passwordHash: adminHash,
      fullName: 'Support Desk',
      roleId: roleIdByName.get('Customer Support')!,
    },
  ]);

  // ------------------------------------------------------------ categories
  console.log('› Creating categories…');
  const categoryIdBySlug = new Map<string, string>();
  for (const category of SEED_CATEGORIES) {
    const [row] = await db
      .insert(t.categories)
      .values({
        name: category.name,
        slug: category.slug,
        description: category.description,
        accent: category.accent,
        sortOrder: category.sortOrder,
        imageUrl: category.image ?? `/images/categories/${category.slug}.svg`,
        metaTitle: `${category.name} | Dartler`,
        metaDescription: category.description,
      })
      .returning({ id: t.categories.id });
    categoryIdBySlug.set(category.slug, row.id);
  }

  // -------------------------------------------------------------- artwork
  console.log('› Generating product artwork…');
  generateAll(
    SEED_PRODUCTS.map((product, index) => ({
      slug: slugify(product.name),
      category: product.category,
      seed: index,
    })),
  );

  // ------------------------------------------------------------- products
  console.log('› Creating products, variants and inventory…');
  interface SeededProduct {
    id: string;
    slug: string;
    name: string;
    sku: string;
    price: number;
    taxBps: number;
    imageUrl: string;
    variants: { id: string; label: string; sku: string; price: number }[];
    categorySlug: string;
  }
  const seededProducts: SeededProduct[] = [];

  for (const [index, product] of SEED_PRODUCTS.entries()) {
    const slug = slugify(product.name);
    const sku = generateSku(product.category.slice(0, 3), index + 1);
    const [row] = await db
      .insert(t.products)
      .values({
        name: product.name,
        slug,
        sku,
        categoryId: categoryIdBySlug.get(product.category)!,
        shortDescription: product.short,
        description: product.description,
        specifications: product.specs,
        pricePaise: product.price,
        compareAtPaise: product.compareAt ?? null,
        costPaise: Math.round(product.price * 0.55),
        taxBps: 1800,
        status: 'ACTIVE',
        isFeatured: product.featured ?? false,
        ratingAvg: product.rating,
        ratingCount: product.ratingCount,
        soldCount: product.sold,
        viewCount: product.sold * pickInt(6, 14),
        weightGrams: product.weight,
        lengthCm: pickInt(8, 30),
        breadthCm: pickInt(6, 20),
        heightCm: pickInt(3, 16),
        hsnCode: product.hsn,
        metaTitle: `${product.name} | Dartler`,
        metaDescription: product.short,
        publishedAt: daysAgo(pickInt(30, 200)),
      })
      .returning({ id: t.products.id });

    await db.insert(t.productImages).values(
      [1, 2, 3].map((n) => ({
        productId: row.id,
        url: `/images/products/${slug}-${n}.svg`,
        alt: `${product.name} — view ${n}`,
        position: n - 1,
        isPrimary: n === 1,
      })),
    );

    const variantRows: SeededProduct['variants'] = [];
    const sizes = product.sizes ?? [null];
    let variantIndex = 0;
    for (const [color, hex] of product.colors) {
      for (const size of sizes) {
        variantIndex += 1;
        const label = size ? `${color} / ${size}` : color;
        const [variant] = await db
          .insert(t.productVariants)
          .values({
            productId: row.id,
            sku: `${sku}-${slugify(label).toUpperCase().slice(0, 10)}`,
            color,
            colorHex: hex,
            size: size ?? null,
            position: variantIndex,
          })
          .returning({ id: t.productVariants.id, sku: t.productVariants.sku });

        const variantStock =
          product.stock === 0 ? 0 : Math.max(0, Math.round(product.stock / (product.colors.length * sizes.length)) + pickInt(-2, 4));
        await db.insert(t.inventory).values({
          productId: row.id,
          variantId: variant.id,
          quantity: variantStock,
          lowStockThreshold: 10,
        });
        await db.insert(t.stockMovements).values({
          productId: row.id,
          variantId: variant.id,
          delta: variantStock,
          balance: variantStock,
          reason: 'INITIAL',
          note: 'Opening stock',
          actorType: 'SYSTEM',
          actorName: 'Seed',
        });

        variantRows.push({
          id: variant.id,
          label,
          sku: variant.sku,
          price: product.price,
        });
      }
    }

    // Reviews
    const reviewCount = Math.min(4, Math.max(1, Math.round(product.rating)));
    for (let i = 0; i < reviewCount; i += 1) {
      const snippet = SEED_REVIEW_SNIPPETS[(index + i) % SEED_REVIEW_SNIPPETS.length];
      await db.insert(t.reviews).values({
        productId: row.id,
        authorName: pick(SEED_CUSTOMERS).fullName,
        rating: snippet.rating,
        title: snippet.title,
        body: snippet.body,
        createdAt: daysAgo(pickInt(2, 120)),
      });
    }

    seededProducts.push({
      id: row.id,
      slug,
      name: product.name,
      sku,
      price: product.price,
      taxBps: 1800,
      imageUrl: `/images/products/${slug}-1.svg`,
      variants: variantRows,
      categorySlug: product.category,
    });
  }

  // -------------------------------------------------------------- coupons
  console.log('› Creating coupons…');
  await db.insert(t.coupons).values([
    {
      code: 'WELCOME10',
      description: '10% off your first order',
      type: 'PERCENT',
      value: 10,
      minOrderPaise: 99900,
      maxDiscountPaise: 50000,
      isActive: true,
    },
    {
      code: 'DARTLER200',
      description: '₹200 off orders above ₹1,499',
      type: 'FIXED',
      value: 20000,
      minOrderPaise: 149900,
      isActive: true,
    },
    {
      code: 'FESTIVE15',
      description: '15% festive discount',
      type: 'PERCENT',
      value: 15,
      minOrderPaise: 199900,
      maxDiscountPaise: 100000,
      isActive: true,
      endsAt: new Date(Date.now() + 45 * 86_400_000),
    },
  ]);

  // ------------------------------------------------------------ customers
  console.log('› Creating customers…');
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer@2026';
  const customerHash = await bcrypt.hash(customerPassword, 10);
  const customers: { id: string; fullName: string; email: string; phone: string; address: t.OrderAddress }[] = [];

  for (const [index, customer] of SEED_CUSTOMERS.entries()) {
    const [row] = await db
      .insert(t.profiles)
      .values({
        email: customer.email,
        passwordHash: customerHash,
        fullName: customer.fullName,
        phone: customer.phone,
        emailVerified: true,
        marketingOptIn: index % 3 !== 0,
        status: index === 8 ? 'INACTIVE' : 'ACTIVE',
        lastLoginAt: daysAgo(pickInt(1, 20)),
        createdAt: daysAgo(pickInt(60, 300)),
      })
      .returning({ id: t.profiles.id });

    const address: t.OrderAddress = {
      fullName: customer.fullName,
      phone: customer.phone,
      line1: `${pickInt(1, 90)}, ${pick(['Lake View Road', 'Gandhi Street', 'Race Course Road', 'MG Road', 'Anna Nagar 4th Cross'])}`,
      line2: pick(['Near Central Park', 'Opposite City Mall', null]),
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      country: 'India',
    };

    await db.insert(t.addresses).values({
      profileId: row.id,
      label: 'HOME',
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: true,
    });

    const [wishlist] = await db
      .insert(t.wishlists)
      .values({ profileId: row.id })
      .returning({ id: t.wishlists.id });
    const wishProducts = [...seededProducts].sort(() => rnd() - 0.5).slice(0, pickInt(1, 4));
    for (const product of wishProducts) {
      await db
        .insert(t.wishlistItems)
        .values({ wishlistId: wishlist.id, productId: product.id })
        .onConflictDoNothing();
    }

    customers.push({ id: row.id, fullName: customer.fullName, email: customer.email, phone: customer.phone, address });
  }

  // --------------------------------------------------------------- orders
  console.log('› Creating 90 days of orders…');
  const statusPlan: { status: t.OrderStatus; weight: number }[] = [
    { status: 'DELIVERED', weight: 52 },
    { status: 'SHIPPED', weight: 14 },
    { status: 'PROCESSING', weight: 12 },
    { status: 'CONFIRMED', weight: 8 },
    { status: 'OUT_FOR_DELIVERY', weight: 6 },
    { status: 'CANCELLED', weight: 5 },
    { status: 'PENDING', weight: 3 },
  ];
  const weighted: t.OrderStatus[] = statusPlan.flatMap(({ status, weight }) =>
    Array.from({ length: weight }, () => status),
  );

  const createdOrders: { id: string; number: string; status: t.OrderStatus; placedAt: Date; total: number }[] = [];

  for (let day = 89; day >= 0; day -= 1) {
    // Gentle upward trend with a weekend bump so the charts look like a real store.
    const weekday = new Date(Date.now() - day * 86_400_000).getDay();
    const base = 1 + Math.round((89 - day) / 30);
    const orderCount = Math.max(0, base + (weekday === 0 || weekday === 6 ? 2 : 0) + pickInt(-1, 2));

    for (let n = 0; n < orderCount; n += 1) {
      const customer = pick(customers);
      const placedAt = daysAgo(day, pickInt(9, 21));
      const status = day < 3 ? pick(['PENDING', 'CONFIRMED', 'PROCESSING'] as t.OrderStatus[]) : pick(weighted);

      const itemCount = pickInt(1, 3);
      const chosen = [...seededProducts].sort(() => rnd() - 0.5).slice(0, itemCount);
      const lines = chosen.map((product) => {
        const variant = pick(product.variants);
        return {
          product,
          variant,
          quantity: pickInt(1, 2),
          unitPricePaise: variant.price,
          taxBps: product.taxBps,
        };
      });

      const pricing = calculatePricing(
        lines.map((line) => ({
          unitPricePaise: line.unitPricePaise,
          quantity: line.quantity,
          taxBps: line.taxBps,
        })),
        SHIPPING_SETTINGS,
      );

      const paymentMethod = pick(['COD', 'UPI', 'CARD', 'NETBANKING'] as t.PaymentMethodValue[]);
      const paymentStatus: t.PaymentStatusValue =
        status === 'CANCELLED'
          ? paymentMethod === 'COD'
            ? 'PENDING'
            : 'REFUNDED'
          : paymentMethod === 'COD'
            ? status === 'DELIVERED'
              ? 'PAID'
              : 'PENDING'
            : 'PAID';

      const [order] = await db
        .insert(t.orders)
        .values({
          orderNumber: generateOrderNumber(placedAt),
          profileId: customer.id,
          email: customer.email,
          phone: customer.phone,
          customerName: customer.fullName,
          status,
          subtotalPaise: pricing.subtotalPaise,
          discountPaise: pricing.discountPaise,
          shippingPaise: pricing.shippingPaise,
          taxPaise: pricing.taxPaise,
          totalPaise: pricing.totalPaise,
          paymentMethod,
          paymentStatus,
          shippingAddress: customer.address,
          billingAddress: customer.address,
          placedAt,
          createdAt: placedAt,
          confirmedAt: status === 'PENDING' ? null : placedAt,
          deliveredAt: status === 'DELIVERED' ? new Date(placedAt.getTime() + 3 * 86_400_000) : null,
          cancelledAt: status === 'CANCELLED' ? new Date(placedAt.getTime() + 86_400_000) : null,
        })
        .returning({ id: t.orders.id, orderNumber: t.orders.orderNumber });

      await db.insert(t.orderItems).values(
        lines.map((line, index) => ({
          orderId: order.id,
          productId: line.product.id,
          variantId: line.variant.id,
          name: line.product.name,
          sku: line.variant.sku,
          slug: line.product.slug,
          variantLabel: line.variant.label,
          imageUrl: line.product.imageUrl,
          unitPricePaise: line.unitPricePaise,
          quantity: line.quantity,
          taxBps: line.taxBps,
          taxPaise: pricing.lines[index].taxPaise,
          totalPaise: pricing.lines[index].totalPaise,
          createdAt: placedAt,
        })),
      );

      await db.insert(t.payments).values({
        orderId: order.id,
        provider: paymentMethod === 'COD' ? 'cod' : 'razorpay',
        method: paymentMethod,
        status: paymentStatus,
        amountPaise: pricing.totalPaise,
        refundedPaise: paymentStatus === 'REFUNDED' ? pricing.totalPaise : 0,
        providerOrderId: paymentMethod === 'COD' ? null : `order_${randomToken(14)}`,
        providerPaymentId: paymentMethod === 'COD' || paymentStatus !== 'PAID' ? null : `pay_${randomToken(14)}`,
        createdAt: placedAt,
      });

      // Shipment + tracking timeline for anything that has left the building.
      const shippedStatuses: t.OrderStatus[] = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      if (shippedStatuses.includes(status)) {
        const shipmentStatus: t.ShipmentStatusValue =
          status === 'DELIVERED' ? 'DELIVERED' : status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'IN_TRANSIT';
        const shippedAt = new Date(placedAt.getTime() + 86_400_000);
        const [shipment] = await db
          .insert(t.shipments)
          .values({
            orderId: order.id,
            provider: 'delhivery',
            awb: `DLV${randomToken(10)}`,
            courier: 'Delhivery',
            status: shipmentStatus,
            pickupLocation: 'Dartler Coimbatore',
            estimatedDelivery: new Date(placedAt.getTime() + 4 * 86_400_000),
            shippedAt,
            deliveredAt: status === 'DELIVERED' ? new Date(placedAt.getTime() + 3 * 86_400_000) : null,
            lastSyncedAt: new Date(),
            createdAt: shippedAt,
          })
          .returning({ id: t.shipments.id });

        const timeline: { status: t.ShipmentStatusValue; label: string; offsetHours: number; location: string }[] = [
          { status: 'MANIFESTED', label: 'Shipment created', offsetHours: 20, location: 'Coimbatore' },
          { status: 'PICKED_UP', label: 'Picked up by courier', offsetHours: 26, location: 'Coimbatore' },
          { status: 'IN_TRANSIT', label: 'In transit', offsetHours: 40, location: 'Salem Hub' },
          { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', offsetHours: 68, location: customer.address.city },
          { status: 'DELIVERED', label: 'Delivered', offsetHours: 74, location: customer.address.city },
        ];
        const cutoff = timeline.findIndex((event) => event.status === shipmentStatus);
        for (const event of timeline.slice(0, cutoff + 1)) {
          await db
            .insert(t.trackingEvents)
            .values({
              shipmentId: shipment.id,
              status: event.status,
              label: event.label,
              location: event.location,
              occurredAt: new Date(placedAt.getTime() + event.offsetHours * 3_600_000),
            })
            .onConflictDoNothing();
        }
      }

      createdOrders.push({
        id: order.id,
        number: order.orderNumber,
        status,
        placedAt,
        total: pricing.totalPaise,
      });
    }
  }

  // ---------------------------------------------------------- page views
  // Roughly 30-60 unique visitors per order so the conversion-rate KPI has a
  // believable denominator to divide by.
  console.log('› Creating anonymous page views…');
  const viewRows: { visitorId: string; path: string; productId: string | null; createdAt: Date }[] = [];
  for (let day = 89; day >= 0; day -= 1) {
    const ordersThatDay = createdOrders.filter(
      (order) => Math.floor((Date.now() - order.placedAt.getTime()) / 86_400_000) === day,
    ).length;
    const visitors = Math.max(6, ordersThatDay * pickInt(28, 55));
    for (let v = 0; v < visitors; v += 1) {
      const visitorId = `seed-${day}-${v}`;
      const pages = pickInt(1, 4);
      for (let n = 0; n < pages; n += 1) {
        const product = pick(seededProducts);
        const isProductPage = rnd() > 0.35;
        viewRows.push({
          visitorId,
          path: isProductPage ? `/product/${product.slug}` : pick(['/', '/category', `/category/${product.categorySlug}`]),
          productId: isProductPage ? product.id : null,
          createdAt: daysAgo(day, pickInt(8, 22)),
        });
      }
    }
  }
  for (let i = 0; i < viewRows.length; i += 1000) {
    await db.insert(t.pageViews).values(viewRows.slice(i, i + 1000));
  }
  console.log(`  ${viewRows.length} page views`);

  // ----------------------------------------------------- service requests
  console.log('› Creating return and cancellation requests…');
  const delivered = createdOrders.filter((order) => order.status === 'DELIVERED').slice(0, 6);
  for (const [index, order] of delivered.entries()) {
    const type: t.RequestTypeValue = index % 3 === 0 ? 'CANCELLATION' : 'RETURN';
    const status: t.RequestStatusValue = index === 0 ? 'APPROVED' : index === 1 ? 'PENDING' : index === 2 ? 'REJECTED' : 'PENDING';
    await db.insert(t.serviceRequests).values({
      requestNumber: generateRequestNumber(type, order.placedAt),
      type,
      orderId: order.id,
      reason: pick([
        'Received a damaged item',
        'Wrong item delivered',
        'Size or fit issue',
        'Changed my mind',
        'Better price elsewhere',
      ]),
      details: 'Raised from the customer account. Photos attached where available.',
      status,
      refundStatus: status === 'APPROVED' ? 'PROCESSING' : 'NOT_APPLICABLE',
      refundPaise: status === 'APPROVED' ? order.total : 0,
      createdAt: new Date(order.placedAt.getTime() + 5 * 86_400_000),
    });
  }

  // ------------------------------------------------------------ audit log
  await db.insert(t.auditLogs).values({
    actorType: 'SYSTEM',
    actorId: superAdmin.id,
    actorName: 'Seed',
    action: 'seed.run',
    entity: 'store',
    summary: `Seeded ${seededProducts.length} products and ${createdOrders.length} orders`,
  });

  console.log('');
  console.log('✓ Seed complete');
  console.log(`  categories : ${SEED_CATEGORIES.length}`);
  console.log(`  products   : ${seededProducts.length}`);
  console.log(`  customers  : ${customers.length}`);
  console.log(`  orders     : ${createdOrders.length}`);
  console.log('');
  console.log(`  Admin    → ${adminEmail} / ${adminPassword}`);
  console.log(`  Customer → ${SEED_CUSTOMERS[0].email} / ${customerPassword}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
