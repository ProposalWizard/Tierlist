export default function FindLoading() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-gray-800" />
        <div className="mb-6 flex gap-3">
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-800" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-800" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-800" />
          ))}
        </div>
      </div>
    </main>
  );
}
