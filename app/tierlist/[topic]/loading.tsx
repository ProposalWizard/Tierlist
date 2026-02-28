/**
 * app/tierlist/[topic]/loading.tsx
 * Skeleton shown by Next.js while the Server Component fetches data.
 */

export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8 animate-pulse">
      {/* Header skeleton */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 rounded bg-gray-800" />
          <div className="h-7 w-20 rounded-md bg-gray-800" />
        </div>
        <div className="h-8 w-72 rounded-lg bg-gray-800" />
        <div className="mt-2 h-4 w-52 rounded-lg bg-gray-800" />
      </header>

      {/* Tier row skeletons */}
      <div className="space-y-3">
        {["S", "A", "B", "C", "D"].map((tier) => (
          <div
            key={tier}
            className="flex gap-3 rounded-xl border border-gray-700 bg-gray-900 p-3"
          >
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-lg font-bold text-gray-600">
              {tier}
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-20 rounded-lg bg-gray-800" />
              ))}
            </div>
          </div>
        ))}

        {/* Unranked pool skeleton */}
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-3">
          <div className="mb-2 h-4 w-44 rounded bg-gray-800" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-16 w-20 rounded-lg bg-gray-800" />
            ))}
          </div>
        </div>

        {/* Save bar skeleton */}
        <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-900 p-4">
          <div className="h-4 w-32 rounded bg-gray-800" />
          <div className="h-9 w-32 rounded-lg bg-gray-800" />
        </div>
      </div>
    </main>
  );
}
