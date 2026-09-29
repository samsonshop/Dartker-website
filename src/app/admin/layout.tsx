import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Dartler Admin', template: '%s | Dartler Admin' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
