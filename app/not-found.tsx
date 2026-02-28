/**
 * app/not-found.tsx
 * Custom 404 page shown whenever notFound() is called or a route doesn't exist.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl mb-4">⚽</p>
        <h1 className="text-3xl font-bold text-white mb-2">
          404 – Page not found
        </h1>
        <p className="text-gray-400 mb-6">That page went off-side.</p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
