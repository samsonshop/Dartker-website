'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'dartler.wishlist.v1';

interface WishlistContextValue {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  count: number;
  hydrated: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return context;
}

function readStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const local = readStorage();
    if (!isAuthenticated) {
      setIds(local);
      setHydrated(true);
      return;
    }

    let cancelled = false;
    // Signed in: the server list wins, but anything saved while signed out is merged in.
    (async () => {
      try {
        const response = await fetch('/api/wishlist', {
          method: local.length ? 'POST' : 'GET',
          headers: local.length ? { 'Content-Type': 'application/json' } : undefined,
          body: local.length ? JSON.stringify({ merge: local }) : undefined,
        });
        if (!response.ok) throw new Error('wishlist unavailable');
        const data = (await response.json()) as { productIds: string[] };
        if (cancelled) return;
        setIds(data.productIds);
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        if (!cancelled) setIds(local);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const persist = useCallback(
    (next: string[], changed: string, added: boolean) => {
      setIds(next);
      if (isAuthenticated) {
        void fetch('/api/wishlist', {
          method: added ? 'PUT' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: changed }),
        }).catch(() => undefined);
      } else {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    },
    [isAuthenticated],
  );

  const toggle = useCallback(
    (productId: string) => {
      const exists = ids.includes(productId);
      const next = exists ? ids.filter((id) => id !== productId) : [...ids, productId];
      persist(next, productId, !exists);
    },
    [ids, persist],
  );

  const remove = useCallback(
    (productId: string) => {
      if (!ids.includes(productId)) return;
      persist(
        ids.filter((id) => id !== productId),
        productId,
        false,
      );
    },
    [ids, persist],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      has: (productId: string) => ids.includes(productId),
      toggle,
      remove,
      count: ids.length,
      hydrated,
    }),
    [ids, toggle, remove, hydrated],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
