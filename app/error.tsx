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
        <p className="text-white text-sm mb-6">
          An unexpected error occurred. You can try again, or head back to the
          homepage.
        </p>
        {/* What broke, small, so a screenshot tells us (Mikey, 19 Oct 2026:
            a crash we could not reproduce on a fresh career). */}
        <details className="mb-5 text-left">
          <summary className="cursor-pointer text-xs font-bold text-white/70">What went wrong (for the developers)</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/50 p-3 text-[11px] text-amber-200">
            {error.message}
            {error.digest ? `\n(digest ${error.digest})` : ""}
            {error.stack ? `\n\n${error.stack.split("\n").slice(0, 8).join("\n")}` : ""}
          </pre>
        </details>
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
