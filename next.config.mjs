/**
 * Fails a production build when the public site URL is missing or still points at
 * localhost.
 *
 * `NEXT_PUBLIC_SITE_URL` is inlined into the bundle at build time and feeds
 * robots.txt, every sitemap URL, canonical tags and the Open Graph URLs — so a
 * localhost value silently ships a site that tells crawlers it lives on the
 * developer's machine. There is no safe default to fall back to, so the build
 * stops instead.
 */
function assertPublicSiteUrl() {
  // Only a real production build or server should be held to this. `next lint`
  // also runs with NODE_ENV=production (and NEXT_PHASE is unset for all of them),
  // so key off the Next CLI subcommand instead — otherwise linting and
  // typechecking would fail on a developer's machine.
  const command = process.argv[2];
  if (command !== 'build' && command !== 'start') return;
  if (process.env.SKIP_SITE_URL_CHECK === 'true') return;

  const value = process.env.NEXT_PUBLIC_SITE_URL;
  const fail = (reason) => {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL ${reason}.\n` +
        '  It is baked into the bundle at build time and drives robots.txt, sitemap.xml,\n' +
        '  canonical tags and Open Graph URLs. Set it to the public origin, for example\n' +
        '  NEXT_PUBLIC_SITE_URL=https://www.your-domain.com\n' +
        '  (Set SKIP_SITE_URL_CHECK=true only for a deliberate non-public build.)',
    );
  };

  if (!value) fail('is not set');

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return fail(`is not a valid absolute URL ("${value}")`);
  }

  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(parsed.hostname)) {
    fail(`still points at localhost ("${value}")`);
  }
  if (parsed.protocol !== 'https:') {
    fail(`must use https in production ("${value}")`);
  }
}

assertPublicSiteUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hides the floating Next.js "N" dev-tools badge in the bottom-left corner.
  devIndicators: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // The seeded placeholder artwork is SVG we generate ourselves. Uploads are
    // MIME-checked and SVG is rejected there, so nothing user-supplied lands here.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    // Whether the site is actually served over TLS — not merely "a production
    // build". `upgrade-insecure-requests` and HSTS only make sense on https, and
    // upgrade-insecure-requests actively breaks an http origin: the browser
    // rewrites every same-origin asset URL to https and the requests then fail.
    const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

    /**
     * Content-Security-Policy.
     *
     * `script-src` keeps 'unsafe-inline' because the app inlines JSON-LD via
     * `dangerouslySetInnerHTML` and Next.js injects its own bootstrap and flight
     * data inline. A nonce would be stronger, but issuing one requires
     * middleware and forces every route to render dynamically — which would
     * un-static the SSG policy pages. So treat this policy as defence in depth
     * (it pins script *origins*, kills plugins, base-tag and form hijacking, and
     * blocks framing) rather than as XSS protection on its own. The escaping at
     * each output site is what stops XSS.
     *
     * 'unsafe-eval' is development-only: React Refresh needs it.
     */
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://checkout.razorpay.com https://www.googletagmanager.com`,
      // Tailwind and Next both emit inline style attributes.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.amazonaws.com https://www.google-analytics.com",
      "font-src 'self' data:",
      // Razorpay posts payment telemetry to lumberjack; GA to its collect endpoint.
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://www.google-analytics.com",
      // Razorpay Checkout opens in an iframe.
      "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      ...(isHttps ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy', value: csp },
          // Pinning a host to HTTPS is irreversible for the max-age, so only send
          // it once the site really is served over TLS.
          ...(isHttps
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
