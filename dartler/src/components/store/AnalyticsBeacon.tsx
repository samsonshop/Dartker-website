'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Records one anonymous page view per navigation. Runs on the client so that
 * link prefetches and crawlers do not inflate the numbers.
 */
export function AnalyticsBeacon({
  productId,
  skipProductPages,
}: {
  productId?: string | null;
  /** The layout-level beacon defers product pages to the PDP's own beacon,
   *  which knows the product id — so a PDP view is counted exactly once. */
  skipProductPages?: boolean;
}) {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (skipProductPages && pathname.startsWith('/product/')) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({ path: pathname, productId: productId ?? null });
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, productId, skipProductPages]);

  return null;
}
