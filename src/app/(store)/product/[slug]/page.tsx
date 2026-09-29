import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Rating } from '@/components/ui/Rating';
import { Tabs } from '@/components/ui/Tabs';
import { ProductGallery } from '@/components/store/ProductGallery';
import { AnalyticsBeacon } from '@/components/store/AnalyticsBeacon';
import { ProductPurchasePanel } from '@/components/store/ProductPurchasePanel';
import { ProductCard } from '@/components/store/ProductCard';
import { SectionHeading } from '@/components/store/SectionHeading';
import { getProductBySlug, getRelatedProducts } from '@/server/catalog';
import { paiseToRupees } from '@/lib/money';
import { formatDate, jsonLdScript, stripBrandSuffix } from '@/lib/utils';
import { publicEnv } from '@/lib/env';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Product not found' };

  const description =
    product.metaDescription ?? product.shortDescription ?? product.description.slice(0, 155);

  return {
    // The layout template appends " | Dartler"; strip it from a stored
    // meta_title so the brand is never doubled.
    title: stripBrandSuffix(product.metaTitle ?? product.name),
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: 'website',
      title: `${product.name} | Dartler`,
      description,
      url: `${publicEnv.siteUrl}/product/${product.slug}`,
      images: product.images[0]
        ? [{ url: product.images[0].url, alt: product.images[0].alt || product.name }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.id, product.category.slug, 4);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription ?? product.description.slice(0, 300),
    sku: product.sku,
    image: product.images.map((image) => `${publicEnv.siteUrl}${image.url}`),
    brand: { '@type': 'Brand', name: 'Dartler' },
    category: product.category.name,
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      url: `${publicEnv.siteUrl}/product/${product.slug}`,
      priceCurrency: 'INR',
      price: paiseToRupees(product.pricePaise).toFixed(2),
      availability:
        product.totalStock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: publicEnv.siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category.name,
        item: `${publicEnv.siteUrl}/category/${product.category.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: `${publicEnv.siteUrl}/product/${product.slug}`,
      },
    ],
  };

  return (
    <div className="container-dartler py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />

      <AnalyticsBeacon productId={product.id} />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: product.category.name, href: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
      />

      {/* items-start keeps the square gallery from stretching to the height of the
          (taller) buy column, which left dead space under the image. */}
      <div className="mt-5 grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div>
          <h1 className="font-serif text-2xl leading-tight text-charcoal-700 sm:text-3xl">
            {product.name}
          </h1>

          {product.ratingCount > 0 ? (
            <div className="mt-2.5 flex items-center gap-3">
              <Rating value={product.ratingAvg} count={product.ratingCount} size="md" />
              <a href="#reviews" className="text-[13px] text-wine-700 hover:underline">
                Read reviews
              </a>
            </div>
          ) : null}

          {product.shortDescription ? (
            <p className="mt-3 text-sm leading-relaxed text-charcoal-500">
              {product.shortDescription}
            </p>
          ) : null}

          <div className="mt-6">
            <ProductPurchasePanel product={product} />
          </div>

          <ul className="mt-6 grid grid-cols-3 gap-2 border-t border-taupe-100 pt-5 text-center">
            {[
              { Icon: Truck, label: 'Free Shipping', copy: 'Above ₹999' },
              { Icon: RotateCcw, label: 'Easy Returns', copy: 'Within 7 days' },
              { Icon: ShieldCheck, label: 'Secure Payments', copy: 'UPI · Cards · COD' },
            ].map(({ Icon, label, copy }) => (
              <li key={label} className="flex flex-col items-center gap-1.5">
                <Icon className="h-[18px] w-[18px] text-wine-600" />
                <span className="text-xs font-medium text-charcoal-600">{label}</span>
                <span className="text-[11px] text-charcoal-300">{copy}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section id="reviews" className="mt-12 scroll-mt-32">
        <Tabs
          items={[
            {
              id: 'description',
              label: 'Description',
              content: (
                <div className="max-w-3xl text-sm leading-relaxed text-charcoal-500">
                  {product.description.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-3 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ),
            },
            {
              id: 'specifications',
              label: 'Specifications',
              content: (
                <dl className="max-w-2xl divide-y divide-taupe-50 rounded-2xl border border-taupe-100 bg-white">
                  {[
                    ...product.specifications,
                    { label: 'SKU', value: product.sku },
                    ...(product.hsnCode ? [{ label: 'HSN code', value: product.hsnCode }] : []),
                    { label: 'Shipping weight', value: `${product.weightGrams} g` },
                  ].map((spec) => (
                    <div key={spec.label} className="flex gap-4 px-4 py-3 text-sm">
                      <dt className="w-40 shrink-0 text-charcoal-400">{spec.label}</dt>
                      <dd className="text-charcoal-700">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ),
            },
            {
              id: 'reviews',
              label: 'Reviews',
              count: product.ratingCount,
              content:
                product.reviews.length === 0 ? (
                  <p className="text-sm text-charcoal-400">
                    No reviews yet — be the first to share how this piece works for you.
                  </p>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    <div className="rounded-2xl border border-taupe-100 bg-white p-5">
                      <p className="font-serif text-4xl text-charcoal-700">
                        {product.ratingAvg.toFixed(1)}
                      </p>
                      <Rating value={product.ratingAvg} showValue={false} className="mt-1.5" />
                      <p className="mt-1 text-xs text-charcoal-400">
                        Based on {product.ratingCount} reviews
                      </p>
                      <ul className="mt-4 space-y-1.5">
                        {product.ratingBreakdown.map((row) => {
                          const total = product.reviews.length || 1;
                          const percent = Math.round((row.count / total) * 100);
                          return (
                            <li key={row.stars} className="flex items-center gap-2 text-xs">
                              <span className="w-6 text-charcoal-400">{row.stars}★</span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-taupe-100">
                                <span
                                  className="block h-full rounded-full bg-gold-400"
                                  style={{ width: `${percent}%` }}
                                />
                              </span>
                              <span className="w-8 text-right text-charcoal-300">{row.count}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <ul className="space-y-4">
                      {product.reviews.map((review) => (
                        <li key={review.id} className="rounded-2xl border border-taupe-100 bg-white p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-charcoal-700">
                                {review.authorName}
                              </p>
                              <Rating value={review.rating} showValue={false} size="xs" className="mt-1" />
                            </div>
                            <p className="text-xs text-charcoal-300">{formatDate(review.createdAt)}</p>
                          </div>
                          {review.title ? (
                            <p className="mt-3 text-sm font-medium text-charcoal-700">{review.title}</p>
                          ) : null}
                          <p className="mt-1.5 text-sm leading-relaxed text-charcoal-500">{review.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            },
          ]}
        />
      </section>

      {related.length > 0 ? (
        <section className="mt-14">
          <SectionHeading
            title="You may also like"
            actionHref={`/category/${product.category.slug}`}
            actionLabel={`More ${product.category.name}`}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
