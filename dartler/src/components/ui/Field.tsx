'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-xl border bg-white text-sm text-charcoal-700 placeholder:text-charcoal-300 transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-taupe-50 disabled:text-charcoal-300';

const controlIdle = 'border-taupe-200 hover:border-taupe-300';
const controlError = 'border-danger-500 hover:border-danger-500';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function FieldWrapper({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-charcoal-600"
        >
          {label}
          {required ? <span className="ml-0.5 text-wine-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-charcoal-300">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, wrapperClassName, leading, trailing, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-300">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlBase,
            error ? controlError : controlIdle,
            'h-11 px-3.5',
            leading && 'pl-10',
            trailing && 'pr-10',
            className,
          )}
          {...props}
        />
        {trailing ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-300">
            {trailing}
          </span>
        ) : null}
      </div>
    </FieldWrapper>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, wrapperClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(
          controlBase,
          error ? controlError : controlIdle,
          'min-h-[110px] resize-y px-3.5 py-3 leading-relaxed',
          className,
        )}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, wrapperClassName, children, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <FieldWrapper
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlBase,
            error ? controlError : controlIdle,
            'h-11 appearance-none px-3.5 pr-9',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </FieldWrapper>
  );
});

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-taupe-300 text-wine-600 accent-wine-600"
        {...props}
      />
      <label htmlFor={inputId} className="cursor-pointer text-sm leading-snug text-charcoal-600">
        {label}
        {description ? <span className="block text-xs text-charcoal-300">{description}</span> : null}
      </label>
    </div>
  );
});

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, description, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-taupe-200 bg-white p-3.5 transition-colors hover:border-wine-300 has-[:checked]:border-wine-500 has-[:checked]:bg-wine-50/60',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="radio"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-wine-600"
        {...props}
      />
      <span className="text-sm leading-snug text-charcoal-600">
        {label}
        {description ? (
          <span className="block text-xs text-charcoal-300">{description}</span>
        ) : null}
      </span>
    </label>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, description, disabled, id }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  return (
    <div className="flex items-start justify-between gap-4">
      {label ? (
        <label htmlFor={switchId} className="cursor-pointer">
          <span className="block text-sm font-medium text-charcoal-600">{label}</span>
          {description ? (
            <span className="block text-xs text-charcoal-300">{description}</span>
          ) : null}
        </label>
      ) : null}
      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-wine-600' : 'bg-taupe-200',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
