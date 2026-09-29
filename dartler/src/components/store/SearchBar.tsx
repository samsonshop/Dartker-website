'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { formatPaiseShort } from '@/lib/money';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  pricePaise: number;
  categoryName: string;
}

export function SearchBar({
  className,
  placeholder = 'Search for products, categories…',
  autoFocus,
  onNavigate,
}: {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch — one request per pause in typing, not per keystroke.
  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('search failed');
        const data = (await response.json()) as { results: Suggestion[] };
        setSuggestions(data.results);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function go(path: string) {
    setOpen(false);
    onNavigate?.();
    router.push(path);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      go(`/product/${suggestions[activeIndex].slug}`);
      return;
    }
    go(`/search?q=${encodeURIComponent(query)}`);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form onSubmit={onSubmit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300"
            aria-hidden="true"
          />
          <input
            id="site-search"
            type="search"
            value={term}
            autoFocus={autoFocus}
            onChange={(event) => {
              setTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            aria-controls="search-suggestions"
            className="h-10 w-full rounded-full border border-taupe-200 bg-white pl-10 pr-9 text-sm text-charcoal-700 placeholder:text-charcoal-300 transition-colors hover:border-taupe-300 focus:border-wine-400"
          />
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                setSuggestions([]);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-300 transition-colors hover:text-charcoal-600"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </form>

      {open && term.trim().length >= 2 ? (
        <div
          id="search-suggestions"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-taupe-100 bg-white shadow-popover"
        >
          {suggestions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-charcoal-400">
              {loading ? 'Searching…' : `No matches for “${term.trim()}”`}
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto py-1.5">
              {suggestions.map((item, index) => (
                <li key={item.id}>
                  <Link
                    href={`/product/${item.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-2.5 transition-colors',
                      index === activeIndex ? 'bg-blush-50' : 'hover:bg-ivory-50',
                    )}
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ivory-200">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-charcoal-700">{item.name}</span>
                      <span className="block text-xs text-charcoal-300">{item.categoryName}</span>
                    </span>
                    <span className="text-sm font-medium text-wine-700">
                      {formatPaiseShort(item.pricePaise)}
                    </span>
                  </Link>
                </li>
              ))}
              <li className="border-t border-taupe-50 pt-1">
                <button
                  type="button"
                  onClick={() => go(`/search?q=${encodeURIComponent(term.trim())}`)}
                  className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-wine-700 transition-colors hover:bg-ivory-50"
                >
                  See all results for “{term.trim()}”
                </button>
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
