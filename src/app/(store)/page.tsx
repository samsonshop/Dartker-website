import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Headphones, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Hero, type HeroSlide } from '@/components/store/Hero';
import { SectionHeading } from '@/components/store/SectionHeading';
import { Sparkle } from '@/components/store/PageDecor';
import { ProductCard } from '@/components/store/ProductCard';
import { Rating } from '@/components/ui/Rating';
import { getCategories, getNewArrivals } from '@/server/catalog';
import { SEED_TESTIMONIALS } from '@/db/seed-data';
import { jsonLdScript } from '@/lib/utils';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s | Dartler" template: this title
  // already opens with the brand, and the template would render it twice.
  title: { absolute: 'Dartler — More than accessories, it’s a lifestyle' },
  description:
    'Shop hair clips, clutches, scrunchies, combs, makeup brushes, keychains, mobile holders and more. Free shipping above ₹999, easy 7-day returns, secure payments.',
  alternates: { canonical: '/' },
};


const HERO_SLIDES: HeroSlide[] = [
  {
    alt: 'Clip your style — shop the hair clip collection',
    image: '/images/hero/banner-hair-clips.png',
    ctaHref: '/category/hair-clips',
  },
  {
    alt: 'Keys with personality — find your favourite keychain',
    image: '/images/hero/banner-keychains.png',
    ctaHref: '/category/keychains',
  },
  {
    alt: 'Smarter space, simpler days — shop mobile holders and smart essentials',
    image: '/images/hero/banner-mobile-holders.png',
    ctaHref: '/category/mobile-holders',
  },
];

const TRUST = [
  { Icon: Truck, title: 'Free Shipping', copy: 'On orders above ₹999' },
  { Icon: RotateCcw, title: 'Easy Returns', copy: 'Within 7 days' },
  { Icon: ShieldCheck, title: 'Secure Payments', copy: '100% secure checkout' },
  { Icon: Headphones, title: '24/7 Support', copy: 'We’re here for you' },
];

export default async function HomePage() {
  const [categories, newArrivals] = await Promise.all([getCategories(false), getNewArrivals(4)]);

  const organisationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dartler',
    url: publicEnv.siteUrl,
    slogan: 'More than accessories, it’s a lifestyle',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Coimbatore',
      addressRegion: 'Tamil Nadu',
      addressCountry: 'IN',
    },
    sameAs: [publicEnv.instagramUrl, publicEnv.facebookUrl],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(organisationJsonLd) }}
      />

      {/* The hero banners are artwork-only, so no <h1> comes from the carousel.
          The page still needs exactly one, for search engines and for screen
          readers that navigate by heading — hence a visually hidden heading. */}
      <h1 className="sr-only">Dartler — more than accessories, it’s a lifestyle</h1>

      <div className="container-dartler relative pt-6">
        <Sparkle className="pointer-events-none absolute left-1 top-16 w-5 text-gold-300/80" />
        <Sparkle className="pointer-events-none absolute left-6 top-28 w-3 text-blush-400/70" />
        <Sparkle className="pointer-events-none absolute right-3 top-10 w-4 text-gold-300/70" />
        <Sparkle className="pointer-events-none absolute bottom-2 right-10 w-3 text-blush-400/60" />
        <Hero slides={HERO_SLIDES} />
      </div>

      {/* One continuous strip with hairline dividers, as in the blueprint —
          not four separate floating cards. */}
      <section aria-label="Why shop with Dartler" className="container-dartler mt-6">
        <ul className="grid grid-cols-2 divide-taupe-100 overflow-hidden rounded-2xl border border-taupe-100 bg-white sm:divide-x lg:grid-cols-4">
          {TRUST.map(({ Icon, title, copy }) => (
            <li key={title} className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blush-100 text-wine-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-charcoal-700">{title}</span>
                <span className="block truncate text-xs text-charcoal-400">{copy}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-dartler mt-14">
        <SectionHeading
          title="Shop by Category"
          description="Every collection, one point of view."
          actionHref="/category"
        />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.slice(0, 10).map((category) => (
            <li key={category.slug}>
              <Link
                href={`/category/${category.slug}`}
                className="group block overflow-hidden rounded-2xl border border-taupe-100 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-ivory-200">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 20vw"
                      className="object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-sm font-medium text-charcoal-700">{category.name}</p>
                  <p className="mt-0.5 text-xs text-charcoal-300">{category.productCount} products</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-dartler mt-16">
        <SectionHeading title="What Our Customers Say" description="Verified reviews from real orders." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SEED_TESTIMONIALS.map((testimonial) => (
            <li key={testimonial.name} className="card-surface flex flex-col gap-3 p-5">
              <Rating value={testimonial.rating} size="sm" showValue={false} />
              <p className="flex-1 text-sm leading-relaxed text-charcoal-500">“{testimonial.quote}”</p>
              <div className="flex items-center gap-3 border-t border-taupe-50 pt-3">
                <Image
                  src={testimonial.avatar}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full"
                />
                <span>
                  <span className="block text-sm font-medium text-charcoal-700">{testimonial.name}</span>
                  <span className="block text-xs text-charcoal-300">{testimonial.location}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-dartler mt-16">
        <SectionHeading title="Fresh in this week" actionHref="/search?sort=newest" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
