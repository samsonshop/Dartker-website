'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Builds a compact page list: 1 … 4 5 6 … 20 */
export function paginationRange(current: number, total: number, siblings = 1): (number | '…')[] {
  const totalNumbers = siblings * 2 + 5;
  if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblings, 1);
  const right = Math.min(current + siblings, total);
  const showLeftDots = left > 2;
  const showRightDots = right < total - 1;

  const pages: (number | '…')[] = [1];
  if (showLeftDots) pages.push('…');
  for (let page = Math.max(2, left); page <= Math.min(total - 1, right); page += 1) {
    pages.push(page);
  }
  if (showRightDots) pages.push('…');
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
  summary,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  summary?: string;
}) {
  if (totalPages <= 1) {
    return summary ? (
      <div className={cn('px-4 py-3 text-xs text-charcoal-400', className)}>{summary}</div>
    ) : null;
  }

  const pages = paginationRange(page, totalPages);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none';

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-taupe-100 px-4 py-3',
        className,
      )}
    >
      {summary ? <p className="text-xs text-charcoal-400">{summary}</p> : <span />}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(btn, 'text-charcoal-400 hover:bg-taupe-50 hover:text-charcoal-700')}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((entry, index) =>
          entry === '…' ? (
            <span key={`gap-${index}`} className="px-1 text-charcoal-300">
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                btn,
                entry === page
                  ? 'bg-wine-600 text-white'
                  : 'text-charcoal-500 hover:bg-taupe-50 hover:text-charcoal-700',
              )}
            >
              {entry}
            </button>
          ),
        )}
        <button
          type="button"
          className={cn(btn, 'text-charcoal-400 hover:bg-taupe-50 hover:text-charcoal-700')}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
