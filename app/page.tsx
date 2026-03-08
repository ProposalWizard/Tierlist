/**
 * app/page.tsx — Homepage
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import type { Tierlist } from "@/lib/types";

const MAX_PER_CATEGORY = 6;

type TierlistCard = Pick<Tierlist, "id" | "title" | "category" | "cover_image_url" | "view_count" | "created_at"> & {
  like_count?: number;
};
type VotelistCard = { id: string; title: string; cover_image_url: string | null; created_at: string };
type CategorySetting = { category: string; sort_method: string; pinned_ids: string[] };

export default async function HomePage() {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id) : false;

  const [tierlistsResult, likesResult, votelistsResult, allLikesResult, categorySettingsResult] = await Promise.all([
    service
      .from("tierlists")
      .select("id, title, category, cover_image_url, view_count, created_at")
      .order("created_at", { ascending: false })
      .returns<TierlistCard[]>(),
    user
      ? supabase.from("tierlist_likes").select("tierlist_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("vote_tierlists")
      .select("id, title, cover_image_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .returns<VotelistCard[]>(),
    // Count likes per tierlist
    service.from("tierlist_likes").select("tierlist_id"),
    // Category display settings (graceful fail if table not created yet)
    service.from("category_homepage_settings").select("category, sort_method, pinned_ids"),
  ]);

  const tierlists = tierlistsResult.data ?? [];
  const votelists = votelistsResult.data ?? [];
  const likedIds = new Set(
    ((likesResult as { data: { tierlist_id: string }[] | null }).data ?? []).map((l) => l.tierlist_id)
  );

  // Build like counts
  const likeCountMap = new Map<string, number>();
  for (const like of (allLikesResult.data ?? [])) {
    likeCountMap.set(like.tierlist_id, (likeCountMap.get(like.tierlist_id) ?? 0) + 1);
  }

  // Category settings map
  const settingsMap = new Map<string, CategorySetting>();
  for (const s of (categorySettingsResult.data ?? []) as CategorySetting[]) {
    settingsMap.set(s.category, s);
  }

  // Group all tierlists by category
  const categoryMap = new Map<string, TierlistCard[]>();
  for (const tl of tierlists) {
    const cat = tl.category ?? "Other";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push({ ...tl, like_count: likeCountMap.get(tl.id) ?? 0 });
  }

  // Apply category ordering settings and slice to MAX_PER_CATEGORY
  const categories = Array.from(categoryMap.entries()).map(([cat, items]) => {
    const setting = settingsMap.get(cat);
    let sorted = [...items];

    if (setting?.sort_method === "views") {
      sorted.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    } else if (setting?.sort_method === "likes") {
      sorted.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0));
    } else if (setting?.sort_method === "manual" && setting.pinned_ids?.length) {
      const pinnedSet = new Map(setting.pinned_ids.map((id, i) => [id, i]));
      const pinned = sorted.filter((t) => pinnedSet.has(t.id)).sort((a, b) => pinnedSet.get(a.id)! - pinnedSet.get(b.id)!);
      const rest = sorted.filter((t) => !pinnedSet.has(t.id));
      sorted = [...pinned, ...rest];
    }
    // default: recent (already ordered by created_at DESC from DB)

    return { cat, items: sorted, total: sorted.length, displayed: sorted.slice(0, MAX_PER_CATEGORY) };
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">Tierlist Maker</Link>
          <div className="flex items-center gap-3">
            <Link href="/find"
              className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:text-white">
              Find a Tierlist
            </Link>
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

      {/* ── Hero ── */}
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

      {/* ── Vote tierlists ── */}
      {votelists.length > 0 && (
        <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Vote</h2>
              <span className="rounded-full border border-purple-700 bg-purple-900/40 px-2 py-0.5 text-xs font-semibold text-purple-300">
                Community Polls
              </span>
            </div>
            <p className="mb-5 text-sm text-gray-500">
              Vote on where each player belongs — see how your picks compare to everyone else.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {votelists.map((vl) => (
                <Link
                  key={vl.id}
                  href={`/vote/${vl.id}`}
                  className="group flex-shrink-0 w-48 overflow-hidden rounded-xl border border-purple-800/50 bg-gray-900 transition-colors hover:border-purple-500"
                >
                  <div className="flex h-32 items-center justify-center overflow-hidden bg-gray-800">
                    {vl.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vl.cover_image_url} alt={vl.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="text-4xl">🗳️</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="mb-1 inline-flex items-center rounded bg-purple-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300">
                      Live
                    </div>
                    <p className="truncate text-sm font-semibold text-white">{vl.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Category rows ── */}
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {categories.length > 0 ? (
          categories.map(({ cat, displayed, total }) => (
            <section key={cat}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {cat}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {total} {total === 1 ? "tierlist" : "tierlists"}
                  </span>
                </h2>
                {total > MAX_PER_CATEGORY && (
                  <Link
                    href={`/find?category=${encodeURIComponent(cat)}`}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    View all {total} →
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
                {displayed.map((tl) => (
                  <Link key={tl.id} href={`/play/${tl.id}`}
                    className="group overflow-hidden rounded-xl border border-gray-700 bg-gray-900 transition-colors hover:border-indigo-500">
                    <div className="flex h-32 items-center justify-center overflow-hidden bg-gray-800">
                      {tl.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tl.cover_image_url} alt={tl.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <span className="text-4xl">🏆</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-xs font-semibold text-white">{tl.title}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                        <span title="Views">👁 {tl.view_count ?? 0}</span>
                        <div className="flex items-center gap-1.5">
                          {likedIds.has(tl.id) && <span className="text-red-400">♥</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {/* View More card */}
                {total > MAX_PER_CATEGORY && (
                  <Link
                    href={`/find?category=${encodeURIComponent(cat)}`}
                    className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-4 text-center transition-colors hover:border-indigo-500 hover:bg-gray-900"
                  >
                    <span className="text-2xl">→</span>
                    <p className="mt-2 text-xs font-semibold text-gray-400">View More</p>
                    <p className="mt-0.5 text-[10px] text-gray-600">{total - MAX_PER_CATEGORY} more</p>
                  </Link>
                )}
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
