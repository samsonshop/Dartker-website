'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { CalendarRange, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
] as const;

export function RangePicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {pending ? <Loader2 className="h-4 w-4 animate-spin text-charcoal-300" /> : null}
      <div className="relative">
        <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
        <label htmlFor="range" className="sr-only">
          Date range
        </label>
        <select
          id="range"
          value={value}
          onChange={(event) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('range', event.target.value);
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
          }}
          className={cn(
            'h-10 appearance-none rounded-xl border border-taupe-200 bg-white pl-9 pr-8 text-[13px] text-charcoal-700',
          )}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
