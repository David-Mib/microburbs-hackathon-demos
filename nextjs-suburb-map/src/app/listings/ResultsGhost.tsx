/** Ghost cards while a feed loads. */
export function ResultsGhost() {
  return (
    <div aria-label="Loading listings">
      <div className="ghost h-12 rounded-xl" />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="ghost aspect-[3/2]" />
            <div className="space-y-2.5 p-4">
              <div className="ghost h-5 w-1/2 rounded" />
              <div className="ghost h-4 w-3/4 rounded" />
              <div className="ghost h-4 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
