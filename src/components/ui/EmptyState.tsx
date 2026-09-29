import { cn } from '@/lib/utils';

/**
 * `headingLevel` defaults to 2 so that an empty state placed directly under a
 * page's `<h1>` does not skip a level — a screen reader navigating by heading
 * reads a jump from h1 to h3 as a missing section. Pass 3 where the empty state
 * genuinely sits inside an `<h2>` section.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
  headingLevel = 2,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-taupe-200 bg-ivory-50 text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blush-100 text-wine-600">
          {icon}
        </div>
      ) : null}
      <Heading className="font-serif text-lg text-charcoal-700">{title}</Heading>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-charcoal-400 text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
