# Dartler

> More than accessories, it's a lifestyle.

A production-ready e-commerce platform for Dartler — a customer storefront and a
separate authenticated admin console, sharing one PostgreSQL database.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env         # then fill in DATABASE_URL and AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # AUTH_SECRET

# 3. Create the schema and fill it with a realistic store
npm run db:push
npm run db:seed

# 4. Run
npm run dev                  # http://localhost:3000
```

**Seeded sign-ins** (change these before going live):

| Area      | URL             | Email                | Password        |
| --------- | --------------- | -------------------- | --------------- |
| Storefront| `/login`        | `priya@example.com`  | `Customer@2026` |
| Admin     | `/admin/login`  | `admin@dartler.com`  | `Dartler@2026`  |

The seed also creates `manager@dartler.com` and `support@dartler.com` (same
password) so you can see how role-based permissions behave.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (Next core-web-vitals) |
| `npm test` | Unit tests — pricing, money, coupons, utils |
| `npm run test:e2e` | API tests — needs `npm run dev` running |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:generate` / `db:migrate` | Generate and run SQL migrations (for production) |
| `npm run db:seed` | Reset and seed the catalogue, customers and 90 days of orders |
| `npm run db:studio` | Drizzle Studio, a database browser |
| `npm run images:import` | Bulk-import real product photos from `product-photos/` |

---

## Architecture

```
src/
  app/
    (store)/          storefront routes — home, category, product, cart, checkout,
                      order, track-order, account, policies
    admin/
      login/          admin sign-in (outside the console guard)
      (console)/      guarded console — dashboard, products, orders, customers,
                      inventory, marketing, analytics, reports, shipping,
                      returns, roles, settings
    api/              route handlers — cart, checkout, wishlist, search, reports,
                      webhooks, tracking beacon
  components/
    ui/               design-system primitives (Button, Field, Modal, Drawer,
                      Tabs, DataTable, Toast, …)
    store/            storefront components
    admin/            console components, including the SVG chart set
  db/                 Drizzle schema, seed data and seed script
  server/             server-only data access: catalog, cart, orders, analytics,
                      admin queries, shipping and payment providers
  server/actions/     server actions (auth, products, orders, settings, account)
  lib/                money, pricing, permissions, auth, validation, utils
```

### The rules the code follows

- **Money is always an integer number of paise.** Rupees exist only at the
  presentation edge (`formatPaise*`) and at the admin input edge
  (`rupeesToPaise`). No float arithmetic touches an amount.
- **Prices come from the database, never the browser.** The cart sends only
  *what* and *how many*; `resolveCartLines` re-reads price, name and stock, and
  `calculatePricing` is the single function that computes a total for the cart
  API, the checkout API and the seed alike.
- **Stock cannot go negative.** Checkout decrements with a conditional
  `UPDATE … WHERE quantity >= n`. If a racing order took the last unit, zero rows
  come back and the whole transaction rolls back. Verified by test: five
  simultaneous checkouts for one remaining unit produce exactly one order.
- **Order creation is idempotent.** Every checkout attempt carries a key; a
  refresh or double-click returns the order that already exists rather than
  creating a second one. The key has a unique index, so even a true race resolves
  to one order.
- **Payment is only ever confirmed server-side.** An order becomes `PAID` after
  the Razorpay signature verifies on the server (or the webhook arrives) — never
  because the browser said the payment succeeded.
- **Authorization is server-side on every mutation.** Admin permissions are
  checked with `requireAdmin` / `requireAdminApi` in the action itself; hiding a
  sidebar link is never the control. Customer and admin sessions are separate
  cookies backed by separate tables.
- **A customer can only ever see their own data.** Order, address and request
  queries always include the profile id in the `WHERE` clause. Guest orders are
  opened through an httpOnly cookie set at checkout or after verifying the order
  number against the email.

---

## Data model

21 tables, all with UUID primary keys and `created_at` / `updated_at`:

`profiles · addresses · categories · products · product_images ·
product_variants · inventory · stock_movements · reviews · wishlists ·
wishlist_items · coupons · orders · order_items · payments · shipments ·
tracking_events · service_requests · admin_roles · admin_permissions ·
admin_users · sessions · audit_logs · login_events · store_settings · page_views`

Notable choices:

- **Stock lives on the variant**, not the product, and every change writes a
  `stock_movements` row — so inventory is auditable rather than just current.
- **Returns and cancellations share `service_requests`** with a discriminating
  `type`, which keeps both the customer's "My requests" view and the admin queue
  to one query.
- **`page_views`** stores an anonymous visitor id so the dashboard's conversion
  rate is a real measurement (orders ÷ unique visitors) rather than a decorative
  number. It holds no personal data.
- **Order items snapshot** the name, SKU, variant label, image and unit price at
  the time of purchase, so editing a product never rewrites history.

---

## Payments (Razorpay)

Cash on Delivery works out of the box. Online payment activates as soon as keys
are present:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx    # the only value the browser sees
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
```

Flow: `/api/checkout` creates the order and a Razorpay order server-side →
the browser opens Razorpay Checkout → `/api/checkout/verify` recomputes the
HMAC signature and compares it in constant time → only then is the order
`CONFIRMED` and `PAID`. `/api/webhooks/razorpay` settles the same order if the
customer closes the tab mid-payment.

Without keys, choosing an online method returns a clear "not configured yet"
message. Nothing is ever faked as paid.

---

## Shipping (Delhivery)

`src/server/shipping/` defines a courier-agnostic `ShippingProvider` interface
with two implementations: the real Delhivery adapter and a deterministic mock.

```env
DELHIVERY_API_TOKEN=xxx
DELHIVERY_BASE_URL=https://staging-express.delhivery.com   # or the production host
DELHIVERY_USE_MOCK=false                                   # true → built-in mock
```

Supported: pincode serviceability, shipment creation (AWB/waybill), tracking
sync with courier-status mapping, and cancellation. Tracking events are written
to `tracking_events` and drive both the admin timeline and the customer's
Track Order page from the same data. Failures are surfaced with a retry rather
than being swallowed, and the API token is never logged or sent to the browser.

Adding a second courier means writing one more adapter — no changes to the order
system.

---

## Images

Product artwork is generated as brand-toned SVG at seed time
(`scripts/generate-images.mjs`) and written to `public/images`. Replace those
files, or point `product_images.url` at your own photography — nothing in the
code assumes SVG.

### Bulk import of real photographs

To replace the placeholders with your own shoot in one pass, create a
`product-photos/` folder in the project root, name each file after the product
and run:

```bash
npm run images:import
```

| File name                     | Goes to                                     |
| ----------------------------- | ------------------------------------------- |
| `crystal-hair-clip-1.jpg`     | Crystal Hair Clip, first (primary) image    |
| `crystal-hair-clip-2.jpg`     | Crystal Hair Clip, second image             |
| `HAI-001-1.jpg`               | matched by SKU instead of slug              |
| `crystal-hair-clip.jpg`       | single image, treated as position 1         |

The name before the trailing `-<number>` is matched against the product slug
first, then against a variant SKU; matching is case-insensitive and
`.jpg/.jpeg/.png/.webp/.avif` are accepted. Files are copied into
`public/images/products/` and the product's image rows are **replaced**, so
re-running is safe and never duplicates. Products with no matching file are
left untouched, which means you can import one category at a time — the script
prints what matched, what did not, and which products are still on placeholder
artwork.

### Uploading one at a time

Uploads through the admin (`/admin/products/new` → Images) are validated by
magic number, capped at 5 MB, and limited to JPG/PNG/WebP/AVIF. **SVG uploads
are rejected** because they can carry script. Files land in `public/uploads`
under a generated name, so path traversal is not possible. Swap
`STORAGE_DRIVER` and implement the driver in `src/server/storage.ts` to move to
S3 or Supabase Storage.

---

## Security checklist

- [x] Customer and admin authentication are fully separate (different cookies,
      tables and guards)
- [x] Sessions are database-backed, so "log out all devices" and per-session
      revocation work; a blocked customer's sessions end immediately
- [x] Passwords are bcrypt-hashed; sign-in does comparable work whether or not
      the account exists, to blunt user enumeration
- [x] Admin sign-in is rate limited (5 failures per email per 15 minutes)
- [x] Every protected mutation checks a permission key server-side
- [x] All input is validated with Zod at the boundary
- [x] Queries are parameterised through the ORM — no string-built SQL
- [x] Payment signatures are verified with a constant-time comparison
- [x] Uploads are MIME-sniffed, size-capped, and SVG is rejected
- [x] Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production
- [x] Security headers set in `next.config.mjs` (nosniff, frame options,
      referrer policy, permissions policy)
- [x] Audit logs redact anything matching password/secret/token/signature
- [x] Admin, account, checkout and API routes are excluded from robots.txt
- [ ] Put the app behind HTTPS and set `NEXT_PUBLIC_SITE_URL` to the real domain
- [ ] Rotate `AUTH_SECRET` and every seeded password before launch

---

## Testing

```bash
npm test          # 25 unit tests — money, pricing, coupons, slugs, CSV, pagination
npm run test:e2e  # 7 API tests — needs the dev server running
```

The unit tests cover the money and pricing rules that everything else depends
on: rupee↔paise conversion, GST from basis points, percentage and flat coupons,
the discount cap, proportional discount spreading (the parts always sum to the
whole), and the free-shipping threshold.

The API tests cover what unit tests cannot: that totals are recomputed
server-side, that a replayed idempotency key returns the same order, that
over-ordering is refused and leaves stock untouched, and that a client-supplied
price is ignored.

---

## Deploying

1. Provision PostgreSQL (Supabase, Neon, RDS — any Postgres 14+).
2. Set every variable from `.env.example` in the host's environment.
3. `npm run db:generate && npm run db:migrate` to apply the schema as versioned
   migrations (`db:push` is for development).
4. Optionally `npm run db:seed` for a demo store — **never** on a live database,
   it truncates every table.
5. `npm run build && npm start`.

### Before launch

- [ ] Real Razorpay keys, and the webhook pointed at `/api/webhooks/razorpay`
- [ ] Real Delhivery token, `DELHIVERY_USE_MOCK=false`, pickup location
      registered with Delhivery under the same name as `pickupName` in settings
- [ ] Store settings reviewed at `/admin/settings` — shipping thresholds, GST
      rate, return window, low-stock threshold
- [ ] Seeded admin and customer passwords changed; unused admin accounts removed
- [ ] Real product photography uploaded in place of the generated artwork
- [ ] Policy pages reviewed — `src/content/policies.ts` has `[merchant]`
      placeholders to fill in
- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` and the social URLs set
- [ ] Error monitoring wired into `src/app/error.tsx`
- [ ] Database backups scheduled

---

## Not built yet

Honest list of what a launch still needs:

- **Transactional email/SMS.** Notification preferences exist in settings and
  order events are recorded, but no provider is wired up — add one in
  `src/server/` and call it from the order lifecycle.
- **Two-factor authentication** stores its flag and backup codes, but the
  second-factor challenge is not enforced at sign-in yet.
- **Refund execution.** `refundPayment()` is implemented against Razorpay and
  refund state is tracked on requests; the admin approve flow marks a refund
  pending rather than calling the API automatically.
- **Multi-channel inventory** (Amazon, Meesho). The schema carries a
  `SalesChannel` on inventory and orders, but no marketplace sync runs yet.
- **Customer-written reviews.** Reviews are read from the database and shown on
  the PDP; there is no submission form.
```
