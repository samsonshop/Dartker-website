'use client';

import { CartProvider } from './CartProvider';
import { WishlistProvider } from './WishlistProvider';
import { CartDrawer } from './CartDrawer';

export function StoreProviders({
  children,
  isAuthenticated,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
}) {
  return (
    <CartProvider>
      <WishlistProvider isAuthenticated={isAuthenticated}>
        {children}
        <CartDrawer />
      </WishlistProvider>
    </CartProvider>
  );
}
