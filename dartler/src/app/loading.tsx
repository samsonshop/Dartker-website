export default function Loading() {
  return (
    <div className="container-dartler py-10">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
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
