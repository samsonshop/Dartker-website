import type { Metadata } from 'next';
import Image from 'next/image';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Our story',
  description:
    'Dartler is a lifestyle accessories house designed in Coimbatore — considered pieces for hair, beauty and everyday carry.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Our story' }]} />

      <div className="mt-6 grid items-center gap-8 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.25em] text-wine-600">Since 2015</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-charcoal-700">
            More than accessories, it’s a lifestyle
          </h1>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-charcoal-500">
            <p>
              Dartler started with a simple frustration: the hair clip that snapped in a week, the
              brush that shed on the second wash, the bag whose strap gave way at the join. Small
              things, bought often, made badly.
            </p>
            <p>
              So we started making the versions we wanted. Metal hinges instead of moulded plastic.
              Sanded wooden teeth instead of seams that snag. Doubled stitching where a strap meets a
              bag. None of it is visible in a photograph, and all of it is why our customers come
              back.
            </p>
            <p>
              Everything is designed and packed in Coimbatore, and shipped across India. Fifteen
              collections, one point of view: buy less, buy properly, wear it every day.
            </p>
          </div>
          <ButtonLink href="/category" size="lg" className="mt-6">
            Explore the collections
          </ButtonLink>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-taupe-100">
          <Image src="/images/promo/lookbook.svg" alt="" fill sizes="50vw" className="object-cover" />
        </div>
      </div>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Made to last',
            copy: 'Materials chosen for how they age, not how they photograph. Metal hinges, real leather, sanded wood.',
          },
          {
            title: 'Honest pricing',
            copy: 'We sell direct, so you pay for the product rather than three layers of distribution.',
          },
          {
            title: 'Answered by people',
            copy: 'Write to us and a person replies — usually the same day, always from Coimbatore.',
          },
        ].map((item) => (
          <article key={item.title} className="card-surface p-6">
            <h2 className="font-serif text-lg text-charcoal-700">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{item.copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
