import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 44"
      className={cn('h-7 w-auto', className)}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20 2c7.5 6.2 12 12.4 12 19.2C32 30.6 26.6 37 20 42c-6.6-5-12-11.4-12-20.8C8 14.4 12.5 8.2 20 2Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M20 4.5c6.4 5.6 10 11 10 16.7 0 7.8-4.3 13.3-10 17.6V4.5Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path d="M20 6v33" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
      <path
        d="M20 16c-2.6-1.6-4.6-2.4-7.2-2.6M20 24c-2.9-1.7-5.2-2.6-8-2.8M20 16c2.6-1.6 4.6-2.4 7.2-2.6M20 24c2.9-1.7 5.2-2.6 8-2.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function Logo({
  className,
  tone = 'dark',
  showTagline = false,
  href = '/',
}: {
  className?: string;
  tone?: 'dark' | 'light';
  showTagline?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('group inline-flex items-center gap-2.5', className)}
      aria-label="Dartler — home"
    >
      <LeafMark
        className={cn(
          'h-8 transition-transform duration-300 group-hover:-rotate-6',
          tone === 'dark' ? 'text-blush-400' : 'text-blush-200',
        )}
      />
      <span className="leading-none">
        <span
          className={cn(
            // The blueprint sets the wordmark in the wine accent, not charcoal.
            'block font-serif text-[26px] font-semibold leading-none tracking-[-0.01em]',
            tone === 'dark' ? 'text-wine-700' : 'text-ivory-100',
          )}
        >
          Dartler
        </span>
        {showTagline ? (
          <span
            className={cn(
              'mt-0.5 block text-[10px] uppercase tracking-[0.18em]',
              tone === 'dark' ? 'text-charcoal-300' : 'text-taupe-200',
            )}
          >
            Timeless style
          </span>
        ) : null}
      </span>
    </Link>
  );
}
