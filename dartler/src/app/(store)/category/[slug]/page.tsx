import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { ProductCard } from '@/components/store/ProductCard';
import {
  FilterSidebar,
  FilterToolbar,
  ListingPagination,
} from '@/components/store/ProductFilters';
import { getCatalogFacets, getCategoryBySlug, listProducts } from '@/server/catalog';
import { parseListingParams, type SearchParamsInput } from '@/lib/listing';
import { publicEnv } from '@/lib/env';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Category not found' };

  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} | Dartler`,
      description: category.description ?? undefined,
      url: `${publicEnv.siteUrl}/category/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const parsed = parseListingParams(await searchParams);

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [page, facets] = await Promise.all([
    listProducts({
      categorySlugs: [slug],
      colors: parsed.colors,
      minPaise: parsed.minPaise,
      maxPaise: parsed.maxPaise,
      inStockOnly: parsed.inStockOnly,
      sort: parsed.sort,
      page: parsed.page,
      perPage: 12,
    }),
    getCatalogFacets([slug]),
  ]);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: publicEnv.siteUrl },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: `${publicEnv.siteUrl}/category/${category.slug}`,
      },
    ],
  };

  const from = (page.page - 1) * page.perPage + 1;
  const to = Math.min(page.page * page.perPage, page.total);

  return (
    <div className="container-dartler py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/category' },
          { label: category.name },
        ]}
      />

      <header className="relative mt-4 overflow-hidden rounded-2xl border border-taupe-100 bg-blush-50">
        <div className="flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="max-w-xl">
            <h1 className="font-serif text-3xl text-charcoal-700">{category.name}</h1>
            {category.description ? (
              <p className="mt-2 text-sm text-charcoal-500">{category.description}</p>
            ) : null}
          </div>
          {category.imageUrl ? (
            <div className="relative hidden h-24 w-40 shrink-0 overflow-hidden rounded-xl sm:block">
              <Image src={category.imageUrl} alt="" fill sizes="160px" className="object-cover" />
            </div>
          ) : null}
        </div>
      </header>

      <div className="mt-6 flex gap-8">
        <FilterSidebar facets={facets} active={parsed} showCategories={false} />

        <div className="min-w-0 flex-1">
          <FilterToolbar facets={facets} active={parsed} total={page.total} showCategories={false} />

          {page.items.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="No products match these filters"
              description="Try widening the price range or clearing a colour to see more from this collection."
              action={
                <ButtonLink href={`/category/${category.slug}`} variant="outline">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                {page.items.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 4} />
                ))}
              </div>
              <ListingPagination
                page={page.page}
                totalPages={page.totalPages}
                summary={`Showing ${from}–${to} of ${page.total} products`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
