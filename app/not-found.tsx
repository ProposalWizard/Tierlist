/**
 * app/not-found.tsx
 * Custom 404 page shown whenever notFound() is called or a route doesn't exist.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold text-white mb-2">404</h1>
        <p className="text-lg text-gray-200 mb-1">Page Not Found</p>
        <p className="text-sm text-gray-200 mb-8">
          This page doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Go back to Knowitball
        </Link>
      </div>
    </main>
  );
}
