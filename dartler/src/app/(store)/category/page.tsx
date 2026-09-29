import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getCategories } from '@/server/catalog';

export const metadata: Metadata = {
  title: 'All Categories',
  description:
    'Browse every Dartler collection — hair accessories, makeup tools, bags, eyewear, wallets, belts and more.',
  alternates: { canonical: '/category' },
};

export default async function CategoryIndexPage() {
  const categories = await getCategories();

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Categories' }]} />

      <header className="mt-4 max-w-2xl">
        <h1 className="font-serif text-3xl text-charcoal-700">All Categories</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          Fifteen collections built around the same idea — accessories worth reaching for every day.
        </p>
      </header>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              className="group flex h-full gap-4 overflow-hidden rounded-2xl border border-taupe-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ivory-200">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-lg text-charcoal-700">{category.name}</h2>
                <p className="mt-1 line-clamp-2 text-[13px] text-charcoal-400">
                  {category.description}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-wine-700">
                  {category.productCount} products
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
