export default function BlindRankingLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-6 text-center">
        <div className="mx-auto mb-3 h-6 w-28 animate-pulse rounded-full bg-gray-800" />
        <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-800" />
        <div className="mx-auto mt-3 h-4 w-48 animate-pulse rounded bg-gray-800" />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-48 w-48 animate-pulse rounded-2xl bg-gray-800" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
