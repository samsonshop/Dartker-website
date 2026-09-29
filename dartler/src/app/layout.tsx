import type { Metadata, Viewport } from 'next';
// Brand faces are self-hosted from npm rather than fetched from Google Fonts,
// so the app builds and runs with no outbound font requests at all.
import '@fontsource-variable/inter';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import { ToastProvider } from '@/components/ui/Toast';
import { publicEnv } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: 'Dartler — More than accessories, it’s a lifestyle',
    template: '%s | Dartler',
  },
  description:
    'Dartler is a lifestyle, beauty and fashion-accessories house. Hair clips, makeup brushes, handbags, sunglasses and more — timeless style, everyday elegance.',
  keywords: [
    'hair accessories',
    'makeup brushes',
    'handbags',
    'sunglasses',
    'fashion accessories India',
    'Dartler',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Dartler',
    title: 'Dartler — More than accessories, it’s a lifestyle',
    description: 'Timeless style. Everyday elegance.',
    url: publicEnv.siteUrl,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#FDF9F5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-wine-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
