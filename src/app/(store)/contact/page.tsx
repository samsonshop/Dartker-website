import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { getStoreSettings } from '@/server/settings';
import { STUDIO_ADDRESS, SUPPORT_HOURS } from '@/content/store-info';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Reach the Dartler team in Coimbatore by email or phone — we reply the same day.',
  alternates: { canonical: '/contact' },
};

export default async function ContactPage() {
  const settings = await getStoreSettings();

  return (
    <div className="container-dartler py-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />

      <div className="mx-auto mt-6 max-w-3xl">
        <h1 className="font-serif text-3xl text-charcoal-700">Contact us</h1>
        <p className="mt-2 text-sm text-charcoal-500">
          Questions about an order, a return or a product — we answer all of them ourselves.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            {
              Icon: Mail,
              title: 'Email',
              value: settings.supportEmail,
              // The subject pre-fills the visitor's mail app so the reply lands
              // in the right queue.
              href: `mailto:${settings.supportEmail}?subject=${encodeURIComponent(
                'Enquiry for Dartler',
              )}`,
              note: 'Best for order questions — include your order number.',
            },
            {
              Icon: Phone,
              title: 'Phone',
              value: settings.supportPhone,
              href: `tel:${settings.supportPhone.replace(/\s/g, '')}`,
              note: `Monday to Saturday, ${SUPPORT_HOURS} IST.`,
            },
            {
              Icon: MapPin,
              title: 'Studio',
              value: `${STUDIO_ADDRESS.line1}, ${STUDIO_ADDRESS.line2}`,
              note: 'Packed and shipped from here.',
            },
            {
              Icon: Clock,
              title: 'Response time',
              value: SUPPORT_HOURS,
              note: 'Our working hours — most messages are answered the same day.',
            },
          ].map((item) => (
            <li key={item.title} className="card-surface p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush-100 text-wine-600">
                <item.Icon className="h-[18px] w-[18px]" />
              </span>
              <h2 className="mt-3 font-serif text-lg text-charcoal-700">{item.title}</h2>
              {item.href ? (
                <a href={item.href} className="mt-1 block text-sm text-wine-700 hover:underline">
                  {item.value}
                </a>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-charcoal-600">{item.value}</p>
              )}
              <p className="mt-1 text-xs text-charcoal-400">{item.note}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-2xl border border-taupe-100 bg-blush-50 p-6">
          <h2 className="flex items-center gap-2 font-serif text-lg text-charcoal-700">
            <MessageCircle className="h-5 w-5 text-wine-600" />
            Before you write
          </h2>
          <p className="mt-2 text-sm text-charcoal-500">
            Most questions are answered in the{' '}
            <Link href="/faq" className="text-wine-700 underline">
              FAQ
            </Link>
            , and you can see exactly where a parcel is on the{' '}
            <Link href="/track-order" className="text-wine-700 underline">
              Track Order
            </Link>{' '}
            page without emailing at all.
          </p>
        </div>
      </div>
    </div>
  );
}
