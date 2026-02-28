"use client";

/**
 * app/tierlist/[topic]/error.tsx
 * Error boundary for the tierlist route. Next.js renders this when
 * an unhandled error is thrown in the Server or Client Component tree.
 */

import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TierlistError({ error, reset }: ErrorProps) {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-2xl font-bold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-400 mb-6 text-sm">
          {error.message || "An unexpected error occurred."}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-700 px-5 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
