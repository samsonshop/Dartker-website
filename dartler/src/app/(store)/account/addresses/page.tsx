import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { AddressBook } from '@/components/store/AccountForms';
import { requireCustomer } from '@/lib/auth/guards';
import { db } from '@/db';
import * as t from '@/db/schema';
import { eq } from 'drizzle-orm';

export const metadata: Metadata = { title: 'My addresses', robots: { index: false, follow: false } };

export default async function AccountAddressesPage() {
  const session = await requireCustomer('/account/addresses');

  const addresses = await db.query.addresses.findMany({
    where: eq(t.addresses.profileId, session.profile.id),
    orderBy: [desc(t.addresses.isDefault), desc(t.addresses.updatedAt)],
  });

  return (
    <section className="rounded-2xl border border-taupe-100 bg-white p-5">
      <AddressBook
        addresses={addresses.map((address) => ({
          id: address.id,
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          isDefault: address.isDefault,
        }))}
      />
    </section>
  );
}
