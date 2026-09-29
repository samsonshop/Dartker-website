import type { Metadata } from 'next';
import { Package, RotateCcw, Truck } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { TrackOrderForm } from '@/components/store/TrackOrderForm';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Enter your order number and email to see live Delhivery tracking for your Dartler order.',
  alternates: { canonical: '/track-order' },
};

export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Track order' }]} />

      <div className="mx-auto mt-6 grid max-w-4xl gap-8 md:grid-cols-2">
        <div>
          <h1 className="font-serif text-3xl text-charcoal-700">Track your order</h1>
          <p className="mt-2 text-sm text-charcoal-500">
            Every Dartler parcel ships with Delhivery. Enter your order number and the email you
            ordered with to see exactly where it is.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-charcoal-500">
            {[
              { Icon: Package, text: 'Order confirmed and packed at our Coimbatore studio' },
              { Icon: Truck, text: 'Live courier scans as it moves between hubs' },
              { Icon: RotateCcw, text: 'Raise a return within 7 days of delivery' },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wine-600" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-taupe-100 bg-white p-6 shadow-card">
          <TrackOrderForm defaultOrderNumber={params.order} />
        </div>
      </div>
    </div>
  );
}
