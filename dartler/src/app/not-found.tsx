import Link from 'next/link';
import { LeafMark } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory-100 px-4">
      <div className="max-w-md text-center">
        <LeafMark className="mx-auto h-10 text-wine-600" />
        <p className="mt-6 font-serif text-6xl text-charcoal-700">404</p>
        <h1 className="mt-2 font-serif text-2xl text-charcoal-700">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-charcoal-400">
          The link may be old, or the product may have been archived. Everything we sell is one tap
          away.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl bg-wine-600 px-5 text-sm font-medium text-white hover:bg-wine-700"
          >
            Back to home
          </Link>
          <Link
            href="/category"
            className="inline-flex h-11 items-center rounded-xl border border-taupe-200 bg-white px-5 text-sm font-medium text-charcoal-600 hover:border-wine-300"
          >
            Browse collections
          </Link>
        </div>
      </div>
    </div>
  );
}
