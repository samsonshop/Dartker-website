'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const STORAGE_KEY = 'dartler.cart.v1';

export interface CartLineInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface ResolvedCartLine extends CartLineInput {
  key: string;
  name: string;
  slug: string;
  sku: string;
  variantLabel: string | null;
  colorHex: string | null;
  imageUrl: string | null;
  unitPricePaise: number;
  compareAtPaise: number | null;
  lineTotalPaise: number;
  availableStock: number;
  /** Set when the requested quantity had to be reduced to match live stock. */
  adjusted: boolean;
  unavailable: boolean;
}

export interface CartTotals {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  freeShippingAbovePaise: number;
  amountToFreeShipping: number;
}

interface CartState {
  lines: CartLineInput[];
  saved: CartLineInput[];
}

interface CartContextValue {
  lines: ResolvedCartLine[];
  savedLines: ResolvedCartLine[];
  totals: CartTotals | null;
  itemCount: number;
  loading: boolean;
  hydrated: boolean;
  couponCode: string | null;
  couponError: string | null;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (input: CartLineInput) => void;
  updateQuantity: (input: { productId: string; variantId: string; quantity: number }) => void;
  removeItem: (input: { productId: string; variantId: string }) => void;
  saveForLater: (input: { productId: string; variantId: string }) => void;
  moveToCart: (input: { productId: string; variantId: string }) => void;
  removeSaved: (input: { productId: string; variantId: string }) => void;
  applyCoupon: (code: string) => void;
  clearCoupon: () => void;
  clearCart: () => void;
  refresh: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}

const emptyState: CartState = { lines: [], saved: [] };

function readStorage(): CartState {
  if (typeof window === 'undefined') return emptyState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const sanitise = (items: unknown): CartLineInput[] =>
      Array.isArray(items)
        ? items
            .filter(
              (item): item is CartLineInput =>
                typeof item === 'object' &&
                item !== null &&
                typeof (item as CartLineInput).productId === 'string' &&
                typeof (item as CartLineInput).variantId === 'string',
            )
            .map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1))),
            }))
        : [];
    return { lines: sanitise(parsed.lines), saved: sanitise(parsed.saved) };
  } catch {
    return emptyState;
  }
}

function writeStorage(state: CartState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage can be unavailable in private mode — the cart still works in memory */
  }
}

const key = (line: { productId: string; variantId: string }) => `${line.productId}:${line.variantId}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const [lines, setLines] = useState<ResolvedCartLine[]>([]);
  const [savedLines, setSavedLines] = useState<ResolvedCartLine[]>([]);
  const [totals, setTotals] = useState<CartTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Hydrate once on mount so server and client markup match.
  useEffect(() => {
    setState(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(state);
  }, [state, hydrated]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setState(readStorage());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const resolve = useCallback(async () => {
    if (!hydrated) return;
    if (state.lines.length === 0 && state.saved.length === 0) {
      setLines([]);
      setSavedLines([]);
      setTotals(null);
      setCouponError(null);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch('/api/cart/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: state.lines, saved: state.saved, couponCode }),
      });
      if (!response.ok) throw new Error('Unable to load your cart right now.');
      const data = (await response.json()) as {
        lines: ResolvedCartLine[];
        saved: ResolvedCartLine[];
        totals: CartTotals;
        couponError: string | null;
      };
      if (id !== requestId.current) return;

      setLines(data.lines);
      setSavedLines(data.saved);
      setTotals(data.totals);
      setCouponError(data.couponError);

      // Reconcile the stored cart with what the server says is actually available.
      const corrected = data.lines
        .filter((line) => !line.unavailable)
        .map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        }));
      const changed =
        corrected.length !== state.lines.length ||
        corrected.some((line, index) => {
          const previous = state.lines[index];
          return (
            !previous ||
            previous.productId !== line.productId ||
            previous.variantId !== line.variantId ||
            previous.quantity !== line.quantity
          );
        });
      if (changed) setState((current) => ({ ...current, lines: corrected }));
    } catch {
      if (id === requestId.current) setCouponError(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [hydrated, state.lines, state.saved, couponCode]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const addItem = useCallback((input: CartLineInput) => {
    const quantity = Math.max(1, Math.floor(input.quantity));
    setState((current) => {
      const existing = current.lines.find((line) => key(line) === key(input));
      const lines = existing
        ? current.lines.map((line) =>
            key(line) === key(input)
              ? { ...line, quantity: Math.min(20, line.quantity + quantity) }
              : line,
          )
        : [...current.lines, { ...input, quantity: Math.min(20, quantity) }];
      return { ...current, lines };
    });
    setIsOpen(true);
  }, []);

  const updateQuantity = useCallback<CartContextValue['updateQuantity']>((input) => {
    setState((current) => ({
      ...current,
      lines:
        input.quantity <= 0
          ? current.lines.filter((line) => key(line) !== key(input))
          : current.lines.map((line) =>
              key(line) === key(input)
                ? { ...line, quantity: Math.min(20, Math.floor(input.quantity)) }
                : line,
            ),
    }));
  }, []);

  const removeItem = useCallback<CartContextValue['removeItem']>((input) => {
    setState((current) => ({
      ...current,
      lines: current.lines.filter((line) => key(line) !== key(input)),
    }));
  }, []);

  const saveForLater = useCallback<CartContextValue['saveForLater']>((input) => {
    setState((current) => {
      const line = current.lines.find((item) => key(item) === key(input));
      if (!line) return current;
      const alreadySaved = current.saved.some((item) => key(item) === key(input));
      return {
        lines: current.lines.filter((item) => key(item) !== key(input)),
        saved: alreadySaved ? current.saved : [...current.saved, line],
      };
    });
  }, []);

  const moveToCart = useCallback<CartContextValue['moveToCart']>((input) => {
    setState((current) => {
      const line = current.saved.find((item) => key(item) === key(input));
      if (!line) return current;
      const existing = current.lines.find((item) => key(item) === key(input));
      return {
        saved: current.saved.filter((item) => key(item) !== key(input)),
        lines: existing
          ? current.lines.map((item) =>
              key(item) === key(input)
                ? { ...item, quantity: Math.min(20, item.quantity + line.quantity) }
                : item,
            )
          : [...current.lines, line],
      };
    });
  }, []);

  const removeSaved = useCallback<CartContextValue['removeSaved']>((input) => {
    setState((current) => ({
      ...current,
      saved: current.saved.filter((item) => key(item) !== key(input)),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState({ lines: [], saved: [] });
    setCouponCode(null);
    setCouponError(null);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      savedLines,
      totals,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      loading,
      hydrated,
      couponCode,
      couponError,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem,
      updateQuantity,
      removeItem,
      saveForLater,
      moveToCart,
      removeSaved,
      applyCoupon: (code: string) => setCouponCode(code.trim().toUpperCase() || null),
      clearCoupon: () => {
        setCouponCode(null);
        setCouponError(null);
      },
      clearCart,
      refresh: () => void resolve(),
    }),
    [
      lines,
      savedLines,
      totals,
      loading,
      hydrated,
      couponCode,
      couponError,
      isOpen,
      addItem,
      updateQuantity,
      removeItem,
      saveForLater,
      moveToCart,
      removeSaved,
      clearCart,
      resolve,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Exposed so the checkout page can send the exact same line inputs to the server. */
export function readCartStorage(): CartState {
  return readStorage();
}

export function clearCartStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
