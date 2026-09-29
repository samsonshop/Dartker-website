import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SectionHeading({
  title,
  description,
  actionHref,
  actionLabel = 'View All',
  className,
  children,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {/* Wine serif with a tapering gold rule running off to the right. */}
        <h2 className="flex items-center gap-4 font-serif text-2xl text-wine-700 sm:text-[28px]">
          {title}
          <span
            aria-hidden="true"
            className="hidden h-px w-14 flex-none bg-gradient-to-r from-gold-300 to-gold-300/0 sm:block"
          />
        </h2>
        {description ? <p className="mt-1.5 text-sm text-charcoal-400">{description}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-wine-700 transition-colors hover:text-wine-800"
          >
            {actionLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
