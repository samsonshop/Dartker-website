'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared URL-state helpers for every admin list screen. */
export function useAdminQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (updates: Record<string, string | null>, options?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      if (!options?.keepPage) params.delete('page');
      const query = params.toString();
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [router, pathname, searchParams],
  );

  return { set, pending, searchParams };
}

export function AdminSearchInput({
  placeholder = 'Search…',
  paramName = 'q',
  className,
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const { set, searchParams, pending } = useAdminQuery();
  const [value, setValue] = useState(searchParams.get(paramName) ?? '');

  useEffect(() => {
    setValue(searchParams.get(paramName) ?? '');
  }, [searchParams, paramName]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const current = searchParams.get(paramName) ?? '';
    if (value === current) return;
    const timer = window.setTimeout(() => set({ [paramName]: value || null }), 320);
    return () => window.clearTimeout(timer);
  }, [value, paramName, searchParams, set]);

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
      <label htmlFor={`search-${paramName}`} className="sr-only">
        {placeholder}
      </label>
      <input
        id={`search-${paramName}`}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-taupe-200 bg-white pl-10 pr-9 text-sm text-charcoal-700 placeholder:text-charcoal-300 focus:border-wine-400"
      />
      {pending ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-charcoal-300" />
      ) : null}
    </div>
  );
}

export function AdminSelect({
  paramName,
  options,
  label,
  allLabel = 'All',
  className,
}: {
  paramName: string;
  options: { value: string; label: string }[];
  label: string;
  allLabel?: string;
  className?: string;
}) {
  const { set, searchParams } = useAdminQuery();
  const value = searchParams.get(paramName) ?? '';

  return (
    <div className={className}>
      <label htmlFor={`filter-${paramName}`} className="sr-only">
        {label}
      </label>
      <select
        id={`filter-${paramName}`}
        value={value}
        onChange={(event) => set({ [paramName]: event.target.value || null })}
        className="h-10 w-full appearance-none rounded-xl border border-taupe-200 bg-white px-3.5 pr-8 text-[13px] text-charcoal-700"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminTabs({
  paramName,
  options,
}: {
  paramName: string;
  options: { value: string; label: string; count?: number }[];
}) {
  const { set, searchParams } = useAdminQuery();
  const value = searchParams.get(paramName) ?? options[0]?.value ?? '';

  return (
    <div role="tablist" className="flex flex-wrap gap-1 overflow-x-auto scrollbar-none">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={value === option.value}
          onClick={() => set({ [paramName]: option.value === options[0]?.value ? null : option.value })}
          className={cn(
            'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
            value === option.value
              ? 'bg-wine-600 text-white'
              : 'bg-white text-charcoal-500 ring-1 ring-taupe-200 hover:text-wine-700',
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className={cn('ml-1.5 text-[11px]', value === option.value ? 'text-white/70' : 'text-charcoal-300')}>
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function AdminPagination({
  page,
  totalPages,
  total,
  perPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
}) {
  const { set } = useAdminQuery();
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-taupe-100 px-5 py-3"
    >
      <p className="text-xs text-charcoal-400">
        Showing {from}–{to} of {total}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => set({ page: String(page - 1) }, { keepPage: true })}
            disabled={page <= 1}
            className="h-8 rounded-lg px-3 text-[13px] text-charcoal-500 hover:bg-ivory-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 text-[13px] text-charcoal-500">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => set({ page: String(page + 1) }, { keepPage: true })}
            disabled={page >= totalPages}
            className="h-8 rounded-lg px-3 text-[13px] text-charcoal-500 hover:bg-ivory-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </nav>
  );
}
