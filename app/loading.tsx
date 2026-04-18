export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 h-10 w-64 animate-pulse rounded-lg bg-gray-800" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-10">
            <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-800" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="aspect-square animate-pulse rounded-xl bg-gray-800" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
