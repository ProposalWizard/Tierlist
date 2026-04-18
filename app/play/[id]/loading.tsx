export default function PlayLoading() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 h-8 w-72 animate-pulse rounded-lg bg-gray-800" />
        <div className="mb-6 flex gap-3">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-800" />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-800" />
        </div>
        {["bg-green-900/30", "bg-lime-900/30", "bg-yellow-900/30", "bg-orange-900/30", "bg-red-900/30"].map(
          (color, i) => (
            <div key={i} className={`mb-2 flex h-20 animate-pulse rounded-lg ${color}`} />
          )
        )}
      </div>
    </main>
  );
}
