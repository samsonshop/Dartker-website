'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { cn } from '@/lib/utils';
import type { ProductListItem } from '@/server/catalog';

export interface ProductTabGroup {
  id: string;
  label: string;
  products: ProductListItem[];
}

/**
 * The blueprint runs the collection tabs inline with the section heading —
 * "Best Sellers  New Arrivals  Featured" — with "View All" pushed to the right,
 * rather than as a separate row of pills below.
 */
export function ProductTabs({
  groups,
  description,
  actionHref,
}: {
  groups: ProductTabGroup[];
  description?: string;
  actionHref?: string;
}) {
  const [active, setActive] = useState(groups[0]?.id ?? '');
  const current = groups.find((group) => group.id === active) ?? groups[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h2 className="font-serif text-2xl text-charcoal-700 sm:text-[28px]">
            {groups[0]?.label}
          </h2>
          <div role="tablist" aria-label="Product collections" className="flex flex-wrap gap-5">
            {groups.slice(1).map((group) => (
              <button
                key={group.id}
                role="tab"
                type="button"
                aria-selected={group.id === active}
                onClick={() => setActive(group.id)}
                className={cn(
                  'relative pb-0.5 text-[13px] transition-colors',
                  group.id === active
                    ? 'font-medium text-wine-700 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-wine-600'
                    : 'text-charcoal-400 hover:text-charcoal-700',
                )}
              >
                {group.label}
              </button>
            ))}
            {/* The first group doubles as the heading, so give it a way back. */}
            {active !== groups[0]?.id ? (
              <button
                type="button"
                role="tab"
                aria-selected={false}
                onClick={() => setActive(groups[0].id)}
                className="text-[13px] text-charcoal-400 transition-colors hover:text-charcoal-700"
              >
                Back to {groups[0].label}
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {description ? (
            <p className="hidden text-sm text-charcoal-400 lg:block">{description}</p>
          ) : null}
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-wine-700 transition-colors hover:text-wine-800"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {current?.products.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 4} />
        ))}
      </div>
    </div>
  );
}
