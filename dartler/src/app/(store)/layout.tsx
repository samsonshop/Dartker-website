import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { StoreProviders } from '@/components/store/StoreProviders';
import { AnalyticsBeacon } from '@/components/store/AnalyticsBeacon';
import { getCategories } from '@/server/catalog';
import { getStoreSettings } from '@/server/settings';
import { getCustomerSession } from '@/lib/auth/session';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings, session] = await Promise.all([
    getCategories(),
    getStoreSettings(),
    getCustomerSession(),
  ]);

  const navCategories = categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    productCount: category.productCount,
  }));

  return (
    <StoreProviders isAuthenticated={Boolean(session)}>
      <div className="flex min-h-screen flex-col">
        <Header categories={navCategories} customerName={session?.profile.fullName ?? null} />
        <AnalyticsBeacon skipProductPages />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer
          categories={navCategories}
          supportEmail={settings.supportEmail}
          supportPhone={settings.supportPhone}
        />
      </div>
    </StoreProviders>
  );
}
