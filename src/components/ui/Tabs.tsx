'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content?: React.ReactNode;
}

export function Tabs({
  items,
  defaultTab,
  value,
  onChange,
  className,
  variant = 'underline',
}: {
  items: TabItem[];
  defaultTab?: string;
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  variant?: 'underline' | 'pill';
}) {
  const groupId = useId();
  const [internal, setInternal] = useState(defaultTab ?? items[0]?.id ?? '');
  const active = value ?? internal;

  function select(id: string) {
    if (value === undefined) setInternal(id);
    onChange?.(id);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const index = items.findIndex((item) => item.id === active);
    if (index < 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = items[(index + delta + items.length) % items.length];
      select(next.id);
      document.getElementById(`${groupId}-tab-${next.id}`)?.focus();
    }
  }

  const activeItem = items.find((item) => item.id === active);

  return (
    <div className={className}>
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className={cn(
          'flex gap-1 overflow-x-auto scrollbar-none',
          variant === 'underline' ? 'border-b border-taupe-100' : 'rounded-xl bg-taupe-50 p-1',
        )}
      >
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              id={`${groupId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${groupId}-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(item.id)}
              className={cn(
                'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                variant === 'underline'
                  ? isActive
                    ? 'text-wine-700 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-wine-600'
                    : 'text-charcoal-400 hover:text-charcoal-700'
                  : isActive
                    ? 'rounded-lg bg-white text-charcoal-700 shadow-sm'
                    : 'rounded-lg text-charcoal-400 hover:text-charcoal-700',
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-1.5 text-xs text-charcoal-300">({item.count})</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeItem?.content !== undefined ? (
        <div
          id={`${groupId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${activeItem.id}`}
          className="pt-5"
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}
