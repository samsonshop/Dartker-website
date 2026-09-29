import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { POLICIES } from '@/content/policies';
import { formatDate } from '@/lib/utils';

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES.find((entry) => entry.slug === slug);
  if (!policy) return { title: 'Policy not found' };

  return {
    title: policy.title,
    description: policy.summary,
    alternates: { canonical: `/policies/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = POLICIES.find((entry) => entry.slug === slug);
  if (!policy) notFound();

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: policy.title }]} />

      <article className="mx-auto mt-6 max-w-3xl">
        <header className="border-b border-taupe-100 pb-5">
          <h1 className="font-serif text-3xl text-charcoal-700">{policy.title}</h1>
          <p className="mt-2 text-sm text-charcoal-500">{policy.summary}</p>
          <p className="mt-1 text-xs text-charcoal-300">
            Last updated {formatDate(policy.updated)}
          </p>
        </header>

        <div className="mt-6 space-y-7">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-serif text-xl text-charcoal-700">{section.heading}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index} className="mt-2 text-sm leading-relaxed text-charcoal-500">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
