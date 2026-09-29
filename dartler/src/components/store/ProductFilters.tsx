'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { formatPaiseShort, paiseToRupees } from '@/lib/money';
import { cn } from '@/lib/utils';
import { SORT_OPTIONS, type ProductSort } from '@/lib/catalog-sort';

export interface FilterFacets {
  price: { min: number; max: number };
  colors: { name: string; hex: string; count: number }[];
  categories?: { name: string; slug: string; productCount: number }[];
}

export interface ActiveFilters {
  categories: string[];
  colors: string[];
  minPaise?: number;
  maxPaise?: number;
  inStockOnly: boolean;
  sort: ProductSort;
}

/** Buckets mirror the reference design: ₹0–300, ₹301–1,000, ₹1,001–2,000, ₹2,000+ */
const PRICE_BANDS = [
  { label: '₹0 – ₹300', min: 0, max: 30000 },
  { label: '₹301 – ₹1,000', min: 30100, max: 100000 },
  { label: '₹1,001 – ₹2,000', min: 100100, max: 200000 },
  { label: '₹2,000 and above', min: 200000, max: undefined },
];

function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page');
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) params.delete('page');
      else params.set('page', String(page));
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: true });
      });
    },
    [router, pathname, searchParams],
  );

  return { apply, goToPage, pending, searchParams };
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-taupe-100 py-4 last:border-0">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-charcoal-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FilterPanel({
  facets,
  active,
  showCategories,
}: {
  facets: FilterFacets;
  active: ActiveFilters;
  showCategories: boolean;
}) {
  const { apply } = useFilterNavigation();

  function toggleList(paramName: string, value: string, current: string[]) {
    apply((params) => {
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (next.length === 0) params.delete(paramName);
      else params.set(paramName, next.join(','));
    });
  }

  const activeBand = PRICE_BANDS.findIndex(
    (band) => band.min === (active.minPaise ?? -1) && band.max === active.maxPaise,
  );

  return (
    <div className="text-sm">
      {showCategories && facets.categories?.length ? (
        <FilterGroup title="Category">
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {facets.categories.map((category) => (
              <li key={category.slug}>
                <Checkbox
                  checked={active.categories.includes(category.slug)}
                  onChange={() => toggleList('category', category.slug, active.categories)}
                  label={
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{category.name}</span>
                      <span className="text-xs text-charcoal-300">({category.productCount})</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      ) : null}

      <FilterGroup title="Price range">
        <ul className="space-y-2">
          {PRICE_BANDS.map((band, index) => (
            <li key={band.label}>
              <Checkbox
                checked={activeBand === index}
                onChange={() =>
                  apply((params) => {
                    if (activeBand === index) {
                      params.delete('min');
                      params.delete('max');
                    } else {
                      params.set('min', String(paiseToRupees(band.min)));
                      if (band.max) params.set('max', String(paiseToRupees(band.max)));
                      else params.delete('max');
                    }
                  })
                }
                label={band.label}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-charcoal-300">
          In stock from {formatPaiseShort(facets.price.min)} to {formatPaiseShort(facets.price.max)}
        </p>
      </FilterGroup>

      {facets.colors.length > 0 ? (
        <FilterGroup title="Colour">
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((color) => {
              const selected = active.colors.includes(color.hex);
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => toggleList('color', color.hex, active.colors)}
                  aria-pressed={selected}
                  title={`${color.name} (${color.count})`}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    selected
                      ? 'border-wine-600 ring-2 ring-wine-200'
                      : 'border-taupe-200 hover:border-taupe-400',
                  )}
                  style={{ backgroundColor: color.hex }}
                >
                  <span className="sr-only">{color.name}</span>
                </button>
              );
            })}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="Availability">
        <Checkbox
          checked={active.inStockOnly}
          onChange={() =>
            apply((params) => {
              if (active.inStockOnly) params.delete('stock');
              else params.set('stock', 'in');
            })
          }
          label="In stock only"
        />
      </FilterGroup>
    </div>
  );
}

export function FilterSidebar({
  facets,
  active,
  showCategories = true,
}: {
  facets: FilterFacets;
  active: ActiveFilters;
  showCategories?: boolean;
}) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Product filters">
      <div className="sticky top-32 rounded-2xl border border-taupe-100 bg-white px-4 pb-4">
        <h2 className="border-b border-taupe-100 py-3.5 font-serif text-lg text-charcoal-700">
          Filters
        </h2>
        <FilterPanel facets={facets} active={active} showCategories={showCategories} />
        <SidebarSort active={active} />
      </div>
    </aside>
  );
}

/** The blueprint keeps "Sort By" at the foot of the filter rail. */
function SidebarSort({ active }: { active: ActiveFilters }) {
  const { apply } = useFilterNavigation();

  return (
    <section className="border-t border-taupe-100 pt-4">
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-500">
        Sort by
      </h3>
      <label htmlFor="sidebar-sort" className="sr-only">
        Sort products
      </label>
      <select
        id="sidebar-sort"
        value={active.sort}
        onChange={(event) =>
          apply((params) => {
            if (event.target.value === 'popular') params.delete('sort');
            else params.set('sort', event.target.value);
          })
        }
        className="h-10 w-full rounded-xl border border-taupe-200 bg-white px-3 text-[13px] text-charcoal-700"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </section>
  );
}

export function FilterToolbar({
  facets,
  active,
  total,
  showCategories = true,
}: {
  facets: FilterFacets;
  active: ActiveFilters;
  total: number;
  showCategories?: boolean;
}) {
  const { apply, pending } = useFilterNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeCount =
    active.categories.length +
    active.colors.length +
    (active.minPaise !== undefined || active.maxPaise !== undefined ? 1 : 0) +
    (active.inStockOnly ? 1 : 0);

  const chips = useMemo(() => {
    const items: { label: string; clear: () => void }[] = [];
    for (const slug of active.categories) {
      const name = facets.categories?.find((category) => category.slug === slug)?.name ?? slug;
      items.push({
        label: name,
        clear: () =>
          apply((params) => {
            const next = active.categories.filter((item) => item !== slug);
            if (next.length) params.set('category', next.join(','));
            else params.delete('category');
          }),
      });
    }
    for (const hex of active.colors) {
      const name = facets.colors.find((color) => color.hex === hex)?.name ?? hex;
      items.push({
        label: name,
        clear: () =>
          apply((params) => {
            const next = active.colors.filter((item) => item !== hex);
            if (next.length) params.set('color', next.join(','));
            else params.delete('color');
          }),
      });
    }
    if (active.minPaise !== undefined || active.maxPaise !== undefined) {
      items.push({
        label: `${formatPaiseShort(active.minPaise ?? 0)} – ${
          active.maxPaise ? formatPaiseShort(active.maxPaise) : 'above'
        }`,
        clear: () =>
          apply((params) => {
            params.delete('min');
            params.delete('max');
          }),
      });
    }
    if (active.inStockOnly) {
      items.push({ label: 'In stock', clear: () => apply((params) => params.delete('stock')) });
    }
    return items;
  }, [active, facets, apply]);

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-charcoal-400">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {total} {total === 1 ? 'product' : 'products'}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-taupe-200 bg-white px-3.5 text-[13px] font-medium text-charcoal-600 lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 ? (
              <span className="rounded-full bg-wine-600 px-1.5 text-[10px] text-white">
                {activeCount}
              </span>
            ) : null}
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <label htmlFor="sort" className="hidden text-[13px] text-charcoal-400 sm:block">
              Sort by
            </label>
            <select
              id="sort"
              value={active.sort}
              onChange={(event) =>
                apply((params) => {
                  if (event.target.value === 'popular') params.delete('sort');
                  else params.set('sort', event.target.value);
                })
              }
              className="h-10 rounded-xl border border-taupe-200 bg-white px-3 pr-8 text-[13px] text-charcoal-700"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-full bg-blush-100 px-3 py-1 text-xs text-wine-700 transition-colors hover:bg-blush-200"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              apply((params) => {
                ['category', 'color', 'min', 'max', 'stock'].forEach((name) => params.delete(name));
              })
            }
            className="text-xs text-charcoal-400 underline hover:text-wine-700"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side="bottom"
        title="Filters"
        footer={
          <Button fullWidth onClick={() => setDrawerOpen(false)}>
            Show {total} products
          </Button>
        }
      >
        <div className="px-5">
          <FilterPanel facets={facets} active={active} showCategories={showCategories} />
        </div>
      </Drawer>
    </div>
  );
}

export function ListingPagination({
  page,
  totalPages,
  summary,
}: {
  page: number;
  totalPages: number;
  summary: string;
}) {
  const { goToPage } = useFilterNavigation();
  if (totalPages <= 1) {
    return <p className="mt-8 text-center text-xs text-charcoal-300">{summary}</p>;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (value) =>
      value === 1 ||
      value === totalPages ||
      (value >= page - 1 && value <= page + 1),
  );

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="h-9 rounded-lg px-3 text-[13px] text-charcoal-500 transition-colors hover:bg-white disabled:opacity-40"
        >
          Previous
        </button>
        {pages.map((value, index) => (
          <span key={value} className="flex items-center">
            {index > 0 && value - pages[index - 1] > 1 ? (
              <span className="px-1 text-charcoal-300">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => goToPage(value)}
              aria-current={value === page ? 'page' : undefined}
              className={cn(
                'h-9 min-w-9 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
                value === page
                  ? 'bg-wine-600 text-white'
                  : 'text-charcoal-500 hover:bg-white',
              )}
            >
              {value}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          className="h-9 rounded-lg px-3 text-[13px] text-charcoal-500 transition-colors hover:bg-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <p className="text-xs text-charcoal-300">{summary}</p>
    </nav>
  );
}
