export default function VoteLoading() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 h-8 w-72 animate-pulse rounded-lg bg-gray-800" />
        <div className="mb-6 h-5 w-48 animate-pulse rounded bg-gray-800" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-800" />
          ))}
        </div>
      </div>
    </main>
  );
}
