import { cn } from '@/lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'wine'
  | 'gold'
  | 'blush';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-taupe-100 text-charcoal-500',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  info: 'bg-info-50 text-info-600',
  wine: 'bg-wine-50 text-wine-700',
  gold: 'bg-gold-50 text-gold-600',
  blush: 'bg-blush-100 text-wine-700',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  dot,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}
