import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NewsletterForm } from './NewsletterForm';
import { publicEnv } from '@/lib/env';

const SUPPORT_LINKS = [
  { href: '/policies/shipping', label: 'Shipping Policy' },
  { href: '/policies/returns', label: 'Return & Refund Policy' },
  { href: '/track-order', label: 'Track Your Order' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact Us' },
];

const ABOUT_LINKS = [
  { href: '/about', label: 'Our Story' },
  { href: '/lookbook', label: 'Lookbook' },
  { href: '/policies/terms', label: 'Terms of Service' },
  { href: '/policies/privacy', label: 'Privacy Policy' },
];

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
      {/* The blueprint places the newsletter as a blush band directly above the
          footer columns, not inside them. */}
      <div className="border-y border-taupe-100 bg-blush-50">
        <div className="container-dartler grid gap-6 py-9 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="font-serif text-2xl text-charcoal-700">Get 10% Off Your First Order</h2>
            <p className="mt-1 text-sm text-charcoal-400">
              Early access to new arrivals and private sales. No spam, unsubscribe anytime.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-taupe-100 bg-white">
      <div className="container-dartler grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5 lg:gap-8">
        <div className="lg:col-span-2">
          <Logo showTagline />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-charcoal-400">
            Dartler is a lifestyle house for beauty and fashion accessories — designed in Coimbatore,
            shipped across India. More than accessories, it’s a lifestyle.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-charcoal-400">
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-taupe-400" />
              <a href={`mailto:${supportEmail}`} className="link-underline">
                {supportEmail}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-taupe-400" />
              <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="link-underline">
                {supportPhone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-taupe-400" />
              Coimbatore, Tamil Nadu
            </li>
          </ul>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="font-serif text-base text-charcoal-700">
            Shop
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-charcoal-400">
            {categories.slice(0, 8).map((category) => (
              <li key={category.slug}>
                <Link href={`/category/${category.slug}`} className="link-underline">
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/category" className="link-underline font-medium text-wine-700">
                All categories
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-support">
          <h2 id="footer-support" className="font-serif text-base text-charcoal-700">
            Support
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-charcoal-400">
            {SUPPORT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <nav aria-labelledby="footer-about">
            <h2 id="footer-about" className="font-serif text-base text-charcoal-700">
              About
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm text-charcoal-400">
              {ABOUT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link-underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <h2 className="mt-8 font-serif text-base text-charcoal-700">Follow us</h2>
          <div className="mt-3 flex gap-2">
            {[
              { href: publicEnv.instagramUrl, Icon: Instagram, label: 'Instagram' },
              { href: publicEnv.facebookUrl, Icon: Facebook, label: 'Facebook' },
              { href: 'https://youtube.com', Icon: Youtube, label: 'YouTube' },
            ].map(({ href, Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-taupe-200 text-charcoal-400 transition-colors hover:border-wine-300 hover:text-wine-700"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-taupe-100">
        <div className="container-dartler flex flex-col gap-4 py-5 text-xs text-charcoal-300 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Dartler. All rights reserved.</p>
          <PaymentMarks />
        </div>
      </div>
      </div>
    </footer>
  );
}

/** Accepted payment methods, drawn as simple marks rather than brand logos. */
function PaymentMarks() {
  const marks = ['UPI', 'VISA', 'Mastercard', 'RuPay', 'Net Banking', 'COD'];
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
      {marks.map((mark) => (
        <li
          key={mark}
          className="rounded-md border border-taupe-100 bg-white px-2.5 py-1 text-[10px] font-medium tracking-wide text-charcoal-400"
        >
          {mark}
        </li>
      ))}
    </ul>
  );
}
