import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NewsletterForm } from './NewsletterForm';
import { publicEnv } from '@/lib/env';
import { STUDIO_ADDRESS } from '@/content/store-info';
import { Sprig } from './PageDecor';

const SUPPORT_LINKS = [
  { href: '/policies/shipping', label: 'Shipping Policy' },
  { href: '/policies/returns', label: 'Return & Refund Policy' },
  { href: '/track-order', label: 'Track Your Order' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact Us' },
];

const ABOUT_LINKS = [
  { href: '/about', label: 'Our Story' },
  { href: '/policies/terms', label: 'Terms of Service' },
  { href: '/policies/privacy', label: 'Privacy Policy' },
];

/**
 * The store keeps its contact numbers in a single settings field. Splitting on
 * "/" lets us render each one as its own tel: link without a second column.
 */
function splitPhones(value: string): string[] {
  return value
    .split('/')
    .map((phone) => phone.trim())
    .filter(Boolean);
}

const linkClass =
  'link-underline text-taupe-200/80 transition-colors duration-200 hover:text-gold-200';

/** Column heading with the small gold rule that ties the footer together. */
function ColumnHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-serif text-base tracking-wide text-ivory-100">
      {children}
      <span aria-hidden="true" className="mt-2.5 block h-px w-9 bg-gold-400/70" />
    </h2>
  );
}

export function Footer({
  categories,
  supportEmail,
  supportPhone,
}: {
  categories: { name: string; slug: string }[];
  supportEmail: string;
  supportPhone: string;
}) {
  return (
    <footer className="mt-20">
      {/* Newsletter is an inset card rather than a full-bleed band, with a sprig
          tucked into each end. */}
      <div className="container-dartler pb-14">
        <div className="relative overflow-hidden rounded-3xl border border-blush-200/70 bg-gradient-to-br from-blush-100 via-blush-50 to-blush-100 px-6 py-11 sm:px-10">
          <Sprig
            className="pointer-events-none absolute -left-10 -top-8 w-36 rotate-[18deg] text-blush-300/60"
          />
          <Sprig
            className="pointer-events-none absolute -bottom-12 -right-8 w-40 -rotate-[26deg] scale-x-[-1] text-blush-300/60"
          />

          <div className="relative grid gap-7 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12">
            <div>
              <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-wine-600">
                <span aria-hidden="true" className="h-px w-8 bg-gold-400/80" />
                Join the list
              </p>
              <h2 className="mt-3 font-serif text-3xl leading-tight text-charcoal-700 sm:text-[2.1rem]">
                Get 10% Off Your First Order
              </h2>
              <p className="mt-2.5 max-w-md text-sm leading-relaxed text-charcoal-400">
                Early access to new arrivals and private sales. No spam, unsubscribe anytime.
              </p>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden bg-charcoal-700 text-taupe-200">
        {/* A single warm glow keeps the dark panel from looking flat. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-wine-600/20 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 right-0 h-[24rem] w-[24rem] rounded-full bg-gold-500/10 blur-[120px]"
        />
        {/* Gold botanical anchoring the bottom-right corner of the dark panel. */}
        <Sprig className="pointer-events-none absolute -bottom-10 right-2 w-56 -rotate-[14deg] scale-x-[-1] text-gold-400/45 lg:w-80" />
        <Sprig className="pointer-events-none absolute -bottom-20 right-44 hidden w-48 rotate-[8deg] text-gold-400/30 lg:block" />

        <div className="container-dartler relative grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Logo tone="light" showTagline />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-taupe-200/75">
              Dartler is a lifestyle house for beauty and fashion accessories — designed in
              Coimbatore, shipped across India. More than accessories, it’s a lifestyle.
            </p>

            <ul className="mt-7 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gold-300">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <a
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent('Enquiry for Dartler')}`}
                  className={`${linkClass} pt-1.5`}
                >
                  {supportEmail}
                </a>
              </li>

              <li className="flex items-start gap-3">
                <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gold-300">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <span className="flex flex-wrap items-center gap-x-2 pt-1.5">
                  {splitPhones(supportPhone).map((phone, index) => (
                    <span key={phone} className="flex items-center gap-x-2">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-taupe-200/30">
                          ·
                        </span>
                      ) : null}
                      <a href={`tel:${phone.replace(/\s/g, '')}`} className={linkClass}>
                        {phone}
                      </a>
                    </span>
                  ))}
                </span>
              </li>

              <li className="flex items-start gap-3">
                <span className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gold-300">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <address className="pt-1.5 not-italic leading-relaxed text-taupe-200/75">
                  {STUDIO_ADDRESS.line1},
                  <br />
                  {STUDIO_ADDRESS.line2}
                </address>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-shop" className="lg:col-span-3">
            <ColumnHeading id="footer-shop">Shop</ColumnHeading>
            <ul className="mt-5 space-y-3 text-sm">
              {categories.slice(0, 8).map((category) => (
                <li key={category.slug}>
                  <Link href={`/category/${category.slug}`} className={linkClass}>
                    {category.name}
                  </Link>
                </li>
              ))}
              <li className="pt-1">
                <Link
                  href="/category"
                  className="link-underline font-medium text-gold-300 transition-colors duration-200 hover:text-gold-200"
                >
                  All categories
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-support" className="lg:col-span-2">
            <ColumnHeading id="footer-support">Support</ColumnHeading>
            <ul className="mt-5 space-y-3 text-sm">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <nav aria-labelledby="footer-about">
              <ColumnHeading id="footer-about">About</ColumnHeading>
              <ul className="mt-5 space-y-3 text-sm">
                {ABOUT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-9">
              <ColumnHeading>Follow us</ColumnHeading>
              <div className="mt-5 flex gap-3">
                {[
                  { href: publicEnv.instagramUrl, Icon: Instagram, label: 'Instagram' },
                  { href: publicEnv.facebookUrl, Icon: Facebook, label: 'Facebook' },
                ].map(({ href, Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-taupe-200 transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-gold-400/60 hover:bg-gold-400/15 hover:text-gold-200"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          {/* Right side stays clear so the floating WhatsApp button never
              overlaps the copyright. */}
          {/* /55 gave 4.42:1 on the dark panel, just under the 4.5 AA floor. */}
          <div className="container-dartler py-6 pr-20 text-xs text-taupe-200/70">
            <p>© {new Date().getFullYear()} Dartler. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
