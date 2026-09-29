import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { FaqAccordion } from '@/components/store/FaqAccordion';
import { FAQS } from '@/content/policies';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Delivery times, Cash on Delivery, returns, refunds and restocks — the answers to what customers ask us most.',
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };

  return (
    <div className="container-dartler py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]} />

      <div className="mx-auto mt-6 max-w-3xl">
        <h1 className="font-serif text-3xl text-charcoal-700">Frequently asked questions</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          Still stuck? Write to{' '}
          <a href="mailto:care@dartler.com" className="text-wine-700 underline">
            care@dartler.com
          </a>{' '}
          and a person will answer, usually the same day.
        </p>

        <div className="mt-6">
          <FaqAccordion items={FAQS} />
        </div>

        <p className="mt-8 text-sm text-charcoal-400">
          Looking for the full terms? Read the{' '}
          <Link href="/policies/shipping" className="text-wine-700 underline">
            shipping
          </Link>
          ,{' '}
          <Link href="/policies/returns" className="text-wine-700 underline">
            returns
          </Link>{' '}
          and{' '}
          <Link href="/policies/privacy" className="text-wine-700 underline">
            privacy
          </Link>{' '}
          policies.
        </p>
      </div>
    </div>
  );
}
