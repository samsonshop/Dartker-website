'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Wire this to your error monitor (Sentry, Highlight, …) in production.
    console.error('[app error]', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-serif text-2xl text-charcoal-700">Something went wrong</h1>
        <p className="mt-2 text-sm text-charcoal-400">
          We hit an unexpected error. Trying again usually works — if it does not, write to
          care@dartler.com and mention the code below.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-charcoal-300">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-xl bg-wine-600 px-5 text-sm font-medium text-white hover:bg-wine-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl border border-taupe-200 bg-white px-5 text-sm font-medium text-charcoal-600 hover:border-wine-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
