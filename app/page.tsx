/**
 * app/page.tsx — Homepage
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { Tierlist } from "@/lib/types";

type TierlistCard = Pick<Tierlist, "id" | "title" | "category" | "cover_image_url" | "view_count" | "created_at">;

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id) : false;

  const [tierlistsResult, likesResult] = await Promise.all([
    supabase
      .from("tierlists")
      .select("id, title, category, cover_image_url, view_count, created_at")
      .order("created_at", { ascending: false })
      .returns<TierlistCard[]>(),
    user
      ? supabase.from("tierlist_likes").select("tierlist_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const tierlists = tierlistsResult.data ?? [];
  const likedIds = new Set(
    ((likesResult as { data: { tierlist_id: string }[] | null }).data ?? []).map((l) => l.tierlist_id)
  );

  const categoryMap = new Map<string, TierlistCard[]>();
  for (const tl of tierlists) {
    const cat = tl.category ?? "Other";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(tl);
  }
  const categories = Array.from(categoryMap.entries());

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-tight text-white">Tierlist Maker</span>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {userIsAdmin && (
                  <Link href="/admin"
                    className="rounded-lg border border-indigo-700 px-3 py-2 text-xs font-semibold text-indigo-300 transition-colors hover:border-indigo-500 hover:text-white">
                    Admin
                  </Link>
                )}
                <Link href="/profile"
                  className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white">
                  Profile
                </Link>
                <Link href="/create"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
                  + Create Tierlist
                </Link>
                <form action="/api/auth/signout" method="POST">
                  <button type="submit"
                    className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/auth"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Tierlist Maker</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-400">
          Pick a tierlist and drag the images into tiers.
          {!user && " Sign in to create your own."}
        </p>
        <Link href={user ? "/create" : "/auth"}
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
          {user ? "+ Create a Tierlist" : "Sign in to create"}
        </Link>
      </div>

      {/* ── Category rows ────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {categories.length > 0 ? (
          categories.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="mb-4 text-xl font-bold text-white">
                {cat}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {items.length} {items.length === 1 ? "tierlist" : "tierlists"}
                </span>
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {items.map((tl) => (
                  <Link key={tl.id} href={`/play/${tl.id}`}
                    className="group flex-shrink-0 w-48 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 transition-colors hover:border-indigo-500">
                    <div className="flex h-32 items-center justify-center overflow-hidden bg-gray-800">
                      {tl.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tl.cover_image_url} alt={tl.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <span className="text-4xl">🏆</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold text-white">{tl.title}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-gray-500">{new Date(tl.created_at).toLocaleDateString()}</p>
                        <div className="flex items-center gap-2">
                          {likedIds.has(tl.id) && <span className="text-xs text-red-400">♥</span>}
                          {userIsAdmin && (
                            <span className="text-xs text-gray-500" title="Views">
                              👁 {tl.view_count ?? 0}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="mb-4 text-gray-500">No tierlists yet. Be the first to create one!</p>
            <Link href={user ? "/create" : "/auth"}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
              {user ? "Create your first tierlist" : "Sign in to create"}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
