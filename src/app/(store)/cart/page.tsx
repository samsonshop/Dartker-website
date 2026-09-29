import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CartPageContent } from '@/components/store/CartPageContent';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review the items in your Dartler cart before checking out.',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} />
      <h1 className="mt-4 font-serif text-3xl text-charcoal-700">Your Cart</h1>
      <CartPageContent />
    </div>
  );
}
