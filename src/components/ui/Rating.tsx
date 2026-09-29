import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Rating({
  value,
  count,
  size = 'sm',
  className,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showValue?: boolean;
}) {
  const dims = size === 'xs' ? 'h-3 w-3' : size === 'md' ? 'h-[18px] w-[18px]' : 'h-3.5 w-3.5';
  const rounded = Math.round(value * 2) / 2;

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ''}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <span key={i} className="relative inline-flex">
              <Star className={cn(dims, 'text-taupe-200')} fill="currentColor" strokeWidth={0} />
              {filled || half ? (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: filled ? '100%' : '50%' }}
                >
                  <Star className={cn(dims, 'text-gold-400')} fill="currentColor" strokeWidth={0} />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className="text-xs text-charcoal-400">
          {value.toFixed(1)}
          {count !== undefined ? ` (${count})` : ''}
        </span>
      ) : null}
    </div>
  );
}
