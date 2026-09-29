import type { Metadata } from 'next';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { ProductCard } from '@/components/store/ProductCard';
import {
  FilterSidebar,
  FilterToolbar,
  ListingPagination,
} from '@/components/store/ProductFilters';
import { getCatalogFacets, getCategories, listProducts } from '@/server/catalog';
import { parseListingParams, type SearchParamsInput } from '@/lib/listing';

interface PageProps {
  searchParams: Promise<SearchParamsInput>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const parsed = parseListingParams(await searchParams);
  return {
    title: parsed.q ? `Search: ${parsed.q}` : 'Shop all products',
    description: parsed.q
      ? `Products matching “${parsed.q}” at Dartler.`
      : 'Browse every Dartler product with filters for category, price, colour and availability.',
    robots: parsed.q ? { index: false, follow: true } : undefined,
    alternates: { canonical: '/search' },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const parsed = parseListingParams(await searchParams);

  const [page, facets, categories] = await Promise.all([
    listProducts({
      search: parsed.q,
      categorySlugs: parsed.categories,
      colors: parsed.colors,
      minPaise: parsed.minPaise,
      maxPaise: parsed.maxPaise,
      inStockOnly: parsed.inStockOnly,
      sort: parsed.sort,
      page: parsed.page,
      perPage: 12,
    }),
    getCatalogFacets(parsed.categories.length ? parsed.categories : undefined),
    getCategories(false),
  ]);

  const from = (page.page - 1) * page.perPage + 1;
  const to = Math.min(page.page * page.perPage, page.total);

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs
        items={[{ label: 'Home', href: '/' }, { label: parsed.q ? 'Search results' : 'Shop' }]}
      />

      <header className="mt-4">
        <h1 className="font-serif text-3xl text-charcoal-700">
          {parsed.q ? (
            <>
              Results for <span className="text-wine-700">“{parsed.q}”</span>
            </>
          ) : (
            'Shop all products'
          )}
        </h1>
      </header>

      <div className="mt-6 flex gap-8">
        <FilterSidebar
          facets={{ ...facets, categories }}
          active={parsed}
        />

        <div className="min-w-0 flex-1">
          <FilterToolbar facets={{ ...facets, categories }} active={parsed} total={page.total} />

          {page.items.length === 0 ? (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title={parsed.q ? `Nothing matched “${parsed.q}”` : 'No products match these filters'}
              description="Check the spelling, try a broader term, or browse the collections instead."
              action={
                <ButtonLink href="/category" variant="outline">
                  Browse categories
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
