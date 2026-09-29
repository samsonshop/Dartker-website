import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { StoreProviders } from '@/components/store/StoreProviders';
import { AnalyticsBeacon } from '@/components/store/AnalyticsBeacon';
import { CursorGlitter } from '@/components/store/CursorGlitter';
import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { PageDecor } from '@/components/store/PageDecor';
import { getCategories } from '@/server/catalog';
import { getStoreSettings } from '@/server/settings';
import { getCustomerSession } from '@/lib/auth/session';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings, session] = await Promise.all([
    // Every active category is listed, empty ones included: the header nav, the
    // "More" dropdown, the mobile drawer and the footer all render from this
    // list, and collections that are still being stocked (mobile holders,
    // earrings, other) have to stay reachable from the nav. Their listing pages
    // handle the empty case with a proper "no products" state. The home page,
    // search and the sitemap keep filtering to what actually has stock.
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
      {/* Soft blush ground for the whole storefront; the decorative sprigs sit
          behind the content and scroll with it. */}
      <div className="flex min-h-screen flex-col bg-[#FCEDEF]">
        <Header categories={navCategories} customerName={session?.profile.fullName ?? null} />
        <AnalyticsBeacon skipProductPages />
        {/* overflow-x-clip (not overflow-hidden) so the sprigs can bleed off the
            edges without turning this into a scroll container, which would
            break the sticky filter sidebar and cart summary. */}
        <div className="relative flex-1 overflow-x-clip">
          <PageDecor />
          <main id="main" className="relative">
            {children}
          </main>
        </div>
        <Footer
          categories={navCategories}
          supportEmail={settings.supportEmail}
          supportPhone={settings.supportPhone}
        />
      </div>
      <WhatsAppButton />
      <CursorGlitter />
    </StoreProviders>
  );
}
