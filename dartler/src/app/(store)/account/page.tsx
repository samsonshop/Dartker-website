import type { Metadata } from 'next';
import { ProfileForm, CustomerPasswordForm } from '@/components/store/AccountForms';
import { requireCustomer } from '@/lib/auth/guards';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'My profile', robots: { index: false, follow: false } };

export default async function AccountProfilePage() {
  const session = await requireCustomer('/account');

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-taupe-100 bg-white p-5">
        <h1 className="font-serif text-xl text-charcoal-700">Profile</h1>
        <p className="mt-1 text-sm text-charcoal-400">
          Member since {formatDate(session.profile.createdAt)}
        </p>
        <div className="mt-5 max-w-lg">
          <ProfileForm
            profile={{
              fullName: session.profile.fullName,
              email: session.profile.email,
              phone: session.profile.phone,
              marketingOptIn: session.profile.marketingOptIn,
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-taupe-100 bg-white p-5">
        <h2 className="font-serif text-xl text-charcoal-700">Password</h2>
        <div className="mt-5 max-w-lg">
          <CustomerPasswordForm />
        </div>
      </section>
    </div>
  );
}
