/**
 * Loading placeholder for the product listings.
 *
 * Kept out of `src/app/loading.tsx` on purpose: a root loading file wraps every
 * route in a Suspense boundary, so Next.js streams a shell — and commits an HTTP
 * 200 — before the page body runs. Any `notFound()` thrown afterwards renders the
 * 404 view under a 200 status, which is a soft 404 that search engines index.
 * Listing routes have no `notFound()`, so they can stream safely.
 */
export function ProductGridSkeleton({ tiles = 8 }: { tiles?: number }) {
  return (
    <div className="container-dartler py-10">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: tiles }, (_, index) => (
          <div key={index} className="card-surface overflow-hidden p-3">
            <div className="skeleton aspect-square w-full rounded-xl" />
            <div className="space-y-2 pt-3">
              <div className="skeleton h-3.5 w-4/5" />
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-9 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
