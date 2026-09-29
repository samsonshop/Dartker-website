'use client';

import Link from 'next/link';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'gold'
  | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-200 ease-smooth disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-wine-600 text-white shadow-sm hover:bg-wine-700 hover:shadow-card',
  secondary: 'bg-blush-100 text-wine-700 hover:bg-blush-200',
  outline: 'border border-taupe-200 bg-white text-charcoal-600 hover:border-wine-300 hover:text-wine-700',
  ghost: 'text-charcoal-500 hover:bg-taupe-50 hover:text-charcoal-700',
  danger: 'bg-danger-500 text-white hover:bg-danger-600',
  gold: 'bg-gold-400 text-charcoal-700 hover:bg-gold-500 hover:text-white',
  dark: 'bg-charcoal-700 text-ivory-100 hover:bg-charcoal-600',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
  icon: 'h-10 w-10 p-0',
};

export interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export interface ButtonProps
  extends ButtonBaseProps,
    React.ButtonHTMLAttributes<HTMLButtonElement> {}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export interface ButtonLinkProps
  extends ButtonBaseProps,
    Omit<React.ComponentProps<typeof Link>, 'className'> {
  className?: string;
}

export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  );
}
