import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Headphones, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Hero, type HeroSlide } from '@/components/store/Hero';
import { SectionHeading } from '@/components/store/SectionHeading';
import { ProductTabs } from '@/components/store/ProductTabs';
import { ProductCard } from '@/components/store/ProductCard';
import { Rating } from '@/components/ui/Rating';
import { ButtonLink } from '@/components/ui/Button';
import { getCategories, getFeaturedProducts, getNewArrivals, listProducts } from '@/server/catalog';
import { SEED_TESTIMONIALS } from '@/db/seed-data';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Dartler — More than accessories, it’s a lifestyle',
  description:
    'Shop hair clips, clutches, scrunchies, makeup brushes, handbags, sunglasses and more. Free shipping above ₹999, easy 7-day returns, secure payments.',
  alternates: { canonical: '/' },
};


const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: 'Beauty · Style · Confidence',
    title: 'Elevate Your Everyday',
    subtitle:
      'Considered accessories for the hours that matter — from the morning rush to the evening out.',
    ctaLabel: 'Shop Now',
    ctaHref: '/category',
    image: '/images/hero/hero-1.svg',
  },
  {
    eyebrow: 'New season',
    title: 'Style. Express. Repeat.',
    subtitle: 'Fresh silhouettes in hair, bags and eyewear — designed to be worn, not saved.',
    ctaLabel: 'Explore new arrivals',
    ctaHref: '/search?sort=newest',
    image: '/images/promo/lookbook.svg',
  },
];

const TRUST = [
  { Icon: Truck, title: 'Free Shipping', copy: 'On orders above ₹999' },
  { Icon: RotateCcw, title: 'Easy Returns', copy: 'Within 7 days' },
  { Icon: ShieldCheck, title: 'Secure Payments', copy: '100% secure checkout' },
  { Icon: Headphones, title: '24/7 Support', copy: 'We’re here for you' },
];

export default async function HomePage() {
  const [categories, bestSellers, newArrivals, featured] = await Promise.all([
    getCategories(false),
    listProducts({ sort: 'popular', perPage: 8 }),
    getNewArrivals(8),
    getFeaturedProducts(8),
  ]);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationJsonLd) }}
      />

      <div className="container-dartler pt-6">
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
          description="Fifteen collections, one point of view."
          actionHref="/category"
        />
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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

      <section className="container-dartler mt-14">
        <ProductTabs
          description="What our customers keep coming back for."
          actionHref="/search?sort=popular"
          groups={[
            { id: 'best', label: 'Best Sellers', products: bestSellers.items },
            { id: 'new', label: 'New Arrivals', products: newArrivals },
            { id: 'featured', label: 'Featured', products: featured },
          ]}
        />
      </section>

      <section className="container-dartler mt-16">
        <div className="relative overflow-hidden rounded-3xl border border-taupe-100">
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/7]">
            <Image
              src="/images/promo/lookbook.svg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ivory-100/95 via-ivory-100/60 to-transparent" />
            <div className="absolute inset-0 flex items-center px-6 sm:px-12">
              <div className="max-w-md">
                <h2 className="font-serif text-2xl text-charcoal-700 sm:text-3xl">
                  Style. Express. Repeat.
                </h2>
                <p className="mt-2 text-sm text-charcoal-500">
                  Explore the latest lookbook — pieces styled together, shoppable in one tap.
                </p>
                <ButtonLink href="/lookbook" variant="dark" className="mt-5">
                  Shop Our Look
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
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
          {newArrivals.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
