'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Locks body scroll while an overlay is open. Reference counted so nested
 * overlays (drawer -> modal) do not unlock the page too early.
 */
let scrollLocks = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function lockScroll() {
  if (typeof document === 'undefined') return;
  if (scrollLocks === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
  scrollLocks += 1;
}

function unlockScroll() {
  if (typeof document === 'undefined') return;
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

export function useOverlayBehaviour(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement | null>,
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    lockScroll();

    const panel = panelRef.current;
    const focusFirst = window.setTimeout(() => {
      const target = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target?.focus?.();
    }, 30);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKeyDown);
      unlockScroll();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: 'right' | 'left' | 'bottom';
  widthClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  describedById?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  widthClassName = 'w-full max-w-md',
  children,
  footer,
  describedById,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panelRef);

  if (!open || typeof document === 'undefined') return null;

  const sideClasses =
    side === 'right'
      ? cn('right-0 top-0 h-full animate-slide-in-right', widthClassName)
      : side === 'left'
        ? cn('left-0 top-0 h-full animate-slide-in-left', widthClassName)
        : 'inset-x-0 bottom-0 max-h-[88vh] w-full animate-slide-up rounded-t-3xl';

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-charcoal-900/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={describedById}
        tabIndex={-1}
        className={cn(
          'absolute flex flex-col bg-ivory-100 shadow-drawer outline-none',
          sideClasses,
        )}
      >
        {title ? (
          <header className="flex shrink-0 items-center justify-between border-b border-taupe-100 bg-white px-5 py-4">
            <h2 className="font-serif text-lg text-charcoal-700">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-charcoal-400 transition-colors hover:bg-taupe-50 hover:text-charcoal-700"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-taupe-100 bg-white px-5 py-4">{footer}</footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
