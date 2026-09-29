import type { Metadata } from 'next';
import { and, desc, eq } from 'drizzle-orm';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { CheckoutFlow } from '@/components/store/CheckoutFlow';
import { db } from '@/db';
import * as t from '@/db/schema';
import { getCustomerSession } from '@/lib/auth/session';
import { getStoreSettings } from '@/server/settings';
import type { AddressInput } from '@/lib/validation/checkout';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your Dartler order.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [session, settings] = await Promise.all([getCustomerSession(), getStoreSettings()]);

  let savedAddress: AddressInput | null = null;
  if (session) {
    const row = await db.query.addresses.findFirst({
      where: and(eq(t.addresses.profileId, session.profile.id)),
      orderBy: [desc(t.addresses.isDefault), desc(t.addresses.updatedAt)],
    });
    if (row) {
      savedAddress = {
        fullName: row.fullName,
        phone: row.phone,
        line1: row.line1,
        line2: row.line2 ?? '',
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        country: row.country,
      };
    }
  }

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="mt-4 font-serif text-3xl text-charcoal-700">Checkout</h1>

      <CheckoutFlow
        customer={
          session
            ? {
                email: session.profile.email,
                fullName: session.profile.fullName,
                phone: session.profile.phone,
              }
            : null
        }
        savedAddress={savedAddress}
        codEnabled={settings.codEnabled}
        onlinePaymentEnabled={settings.onlinePaymentEnabled}
      />
    </div>
  );
}
