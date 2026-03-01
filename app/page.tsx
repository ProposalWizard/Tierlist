/**
 * app/page.tsx — Homepage
 *
 * Shows a public gallery of all saved tierlists.
 * Logged-in users see a "Create New" button.
 * Anyone can click a tierlist to play it at /play/[id].
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Tierlist } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tierlists } = await supabase
    .from("tierlists")
    .select("id, title, cover_image_url, created_at")
    .order("created_at", { ascending: false })
    .returns<Pick<Tierlist, "id" | "title" | "cover_image_url" | "created_at">[]>();

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Tierlist Maker</h1>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/create"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                + Create New
              </Link>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Tierlists grid */}
      {tierlists && tierlists.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {tierlists.map((tl) => (
            <Link
              key={tl.id}
              href={`/play/${tl.id}`}
              className="group overflow-hidden rounded-xl border border-gray-700 bg-gray-900 transition-colors hover:border-indigo-500"
            >
              {/* Cover image */}
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-gray-800">
                {tl.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tl.cover_image_url}
                    alt={tl.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <span className="text-5xl">🏆</span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h2 className="truncate font-semibold text-white">{tl.title}</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {new Date(tl.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="mb-4 text-gray-500">No tierlists yet. Be the first to create one!</p>
          {user ? (
            <Link
              href="/create"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Create your first tierlist
            </Link>
          ) : (
            <Link
              href="/auth"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              Sign in to create
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
