"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">&#9888;&#65039;</div>
        <h1 className="text-2xl font-extrabold mb-2">Something went wrong</h1>
        <p className="text-gray-400 text-sm mb-6">
          An unexpected error occurred. You can try again, or head back to the
          homepage.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-sm transition"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold text-sm transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
