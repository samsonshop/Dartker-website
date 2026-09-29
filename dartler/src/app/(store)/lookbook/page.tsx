import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ProductCard } from '@/components/store/ProductCard';
import { SectionHeading } from '@/components/store/SectionHeading';
import { listProducts } from '@/server/catalog';

export const metadata: Metadata = {
  title: 'Lookbook',
  description: 'Shoppable Dartler looks — pieces styled together for work, weekends and evenings.',
  alternates: { canonical: '/lookbook' },
};

const LOOKS = [
  {
    title: 'The workday edit',
    copy: 'A clip that survives a video call, a bag that stands up on its own, and a wallet that fits a back pocket.',
    categories: ['hair-clutches', 'handbags', 'wallets'],
  },
  {
    title: 'Weekend, unhurried',
    copy: 'Soft scrunchies, a canvas tote and eyewear that earns its place in a beach bag.',
    categories: ['scrunchies', 'sunglasses', 'travel-pouches'],
  },
  {
    title: 'Occasion dressing',
    copy: 'Pearl detail, velvet, and a blazer with a shawl collar for the one party a year that deserves it.',
    categories: ['hair-bands', 'mens-blazers', 'jewelry-organizers'],
  },
];

export default async function LookbookPage() {
  const looks = await Promise.all(
    LOOKS.map(async (look) => ({
      ...look,
      products: (await listProducts({ categorySlugs: look.categories, perPage: 4, sort: 'popular' }))
        .items,
    })),
  );

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Lookbook' }]} />

      <header className="relative mt-4 overflow-hidden rounded-3xl border border-taupe-100">
        <div className="relative aspect-[16/9] w-full sm:aspect-[21/8]">
          <Image src="/images/promo/lookbook.svg" alt="" fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ivory-100/95 via-ivory-100/60 to-transparent" />
          <div className="absolute inset-0 flex items-center px-6 sm:px-12">
            <div className="max-w-lg">
              <p className="text-[11px] uppercase tracking-[0.25em] text-wine-600">Lookbook</p>
              <h1 className="mt-3 font-serif text-3xl text-charcoal-700 sm:text-4xl">
                Style. Express. Repeat.
              </h1>
              <p className="mt-2 text-sm text-charcoal-500">
                Three edits, styled together and shoppable in a tap.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-12 space-y-14">
        {looks.map((look) => (
          <section key={look.title}>
            <SectionHeading
              title={look.title}
              description={look.copy}
              actionHref={`/search?category=${look.categories.join(',')}`}
              actionLabel="Shop the edit"
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {look.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-14 text-center text-sm text-charcoal-400">
        Looking for something specific?{' '}
        <Link href="/category" className="text-wine-700 underline">
          Browse all fifteen collections
        </Link>
        .
      </p>
    </div>
  );
}
