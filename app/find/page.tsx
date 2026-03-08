/**
 * app/find/page.tsx — Find a Tierlist page
 * Shows all tierlists + vote tierlists with search & category filter.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import FindSearch, { type FindItem } from "@/components/FindSearch";

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: initialCategory } = await searchParams;
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id) : false;

  // Fetch everything in parallel
  const [tierlistsRes, votelistsRes, likesCountRes, myLikesRes, profilesRes] = await Promise.all([
    service
      .from("tierlists")
      .select("id, title, category, cover_image_url, view_count, created_at, created_by")
      .order("created_at", { ascending: false }),
    service
      .from("vote_tierlists")
      .select("id, title, category, cover_image_url, created_at, created_by")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Count likes per tierlist
    service.from("tierlist_likes").select("tierlist_id"),
    // Current user's liked IDs
    user
      ? service.from("tierlist_likes").select("tierlist_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    // Creator usernames
    service.from("user_profiles").select("user_id, username"),
  ]);

  // Build like counts map
  const likeCountMap = new Map<string, number>();
  for (const like of likesCountRes.data ?? []) {
    likeCountMap.set(like.tierlist_id, (likeCountMap.get(like.tierlist_id) ?? 0) + 1);
  }

  // Build creator map
  const creatorMap = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    if (p.username) creatorMap.set(p.user_id, p.username);
  }

  // Current user's liked IDs
  const likedIds = new Set(
    ((myLikesRes as { data: { tierlist_id: string }[] | null }).data ?? []).map((l) => l.tierlist_id)
  );

  // Build unified list
  const tierlists: FindItem[] = (tierlistsRes.data ?? []).map((tl) => ({
    id: tl.id,
    title: tl.title,
    category: tl.category,
    cover_image_url: tl.cover_image_url,
    view_count: tl.view_count ?? 0,
    like_count: likeCountMap.get(tl.id) ?? 0,
    created_at: tl.created_at,
    creator: tl.created_by ? (creatorMap.get(tl.created_by) ?? null) : null,
    is_live: false,
  }));

  const votelists: FindItem[] = (votelistsRes.data ?? []).map((vl) => ({
    id: vl.id,
    title: vl.title,
    category: vl.category,
    cover_image_url: vl.cover_image_url,
    view_count: 0,
    like_count: 0,
    created_at: vl.created_at,
    creator: vl.created_by ? (creatorMap.get(vl.created_by) ?? null) : null,
    is_live: true,
  }));

  // All items: vote tierlists first (they're special), then regular
  const allItems: FindItem[] = [...votelists, ...tierlists];

  // Unique categories
  const categorySet = new Set<string>();
  for (const item of allItems) {
    if (item.category) categorySet.add(item.category);
  }
  const categories = Array.from(categorySet).sort();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            Tierlist Maker
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/find" className="text-sm font-semibold text-indigo-400">
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

      {/* ── Header ── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-black tracking-tight text-white">Find a Tierlist</h1>
          <p className="mt-1 text-sm text-gray-400">
            {allItems.length} tierlists available
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <FindSearch
          items={allItems}
          categories={categories}
          initialCategory={initialCategory}
          likedIds={likedIds}
        />
      </main>
    </div>
  );
}
