import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatTile({
  label,
  value,
  changePercent,
  Icon,
  hint,
  invertChange,
}: {
  label: string;
  value: string;
  changePercent?: number | null;
  Icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  /** For metrics where a fall is good (returns, refunds). */
  invertChange?: boolean;
}) {
  const positive = changePercent !== null && changePercent !== undefined && changePercent > 0;
  const negative = changePercent !== null && changePercent !== undefined && changePercent < 0;
  const good = invertChange ? negative : positive;
  const bad = invertChange ? positive : negative;

  return (
    <div className="rounded-2xl border border-taupe-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-charcoal-400">{label}</p>
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blush-50 text-wine-600">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <p className="mt-2 font-serif text-2xl text-charcoal-700">{value}</p>

      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {changePercent === null || changePercent === undefined ? (
          <span className="text-charcoal-300">{hint ?? 'No comparison available'}</span>
        ) : (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                good ? 'text-success-600' : bad ? 'text-danger-600' : 'text-charcoal-400',
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : negative ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {Math.abs(changePercent).toFixed(1)}%
            </span>
            <span className="text-charcoal-300">{hint ?? 'vs previous period'}</span>
          </>
        )}
      </div>
    </div>
  );
}
