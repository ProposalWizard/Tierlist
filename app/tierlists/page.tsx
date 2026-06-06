/**
 * app/page.tsx — Homepage
 *
 * Categories can contain both regular tierlists and vote tierlists.
 * Vote tierlists show a "Vote" badge to distinguish them.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { Tierlist } from "@/lib/types";

export const metadata: Metadata = {
  title: "Knowitball Tierlists — Football Tier Rankings & Votes",
  description:
    "Create and share football tierlists. Drag players into S, A, B, C, D tiers, vote on community rankings, and download your results.",
  openGraph: {
    title: "Knowitball Tierlists — Football Tier Rankings & Votes",
    description:
      "Create and share football tierlists. Drag players into tiers, vote on community rankings, and download your results.",
  },
  twitter: {
    card: "summary",
    title: "Knowitball Tierlists — Football Tier Rankings & Votes",
    description:
      "Create and share football tierlists. Drag players into tiers, vote on community rankings, and download your results.",
  },
  alternates: { canonical: "/tierlists" },
};

export const revalidate = 30;

const MAX_PER_CATEGORY = 6;

type CategoryCard = {
  id: string;
  title: string;
  category: string;
  cover_image_url: string | null;
  view_count: number;
  created_at: string;
  like_count: number;
  is_vote: boolean;
};
type CategorySetting = { category: string; sort_method: string; pinned_ids: string[] };

export default async function HomePage() {
  const service = createServiceClient();

  const [tierlistsResult, votelistsResult, allLikesResult, categorySettingsResult, categoriesResult] = await Promise.all([
    service
      .from("tierlists")
      .select("id, title, category, additional_categories, cover_image_url, view_count, created_at")
      .order("created_at", { ascending: false }),
    service
      .from("vote_tierlists")
      .select("id, title, category, cover_image_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    service.from("tierlist_likes").select("tierlist_id"),
    service.from("category_homepage_settings").select("category, sort_method, pinned_ids"),
    service.from("categories").select("name, sort_order").order("sort_order", { ascending: true }),
  ]);

  const tierlists = tierlistsResult.data ?? [];
  const votelists = (votelistsResult.data ?? []) as { id: string; title: string; category: string; cover_image_url: string | null; created_at: string }[];

  const likeCountMap = new Map<string, number>();
  for (const like of (allLikesResult.data ?? [])) {
    likeCountMap.set(like.tierlist_id, (likeCountMap.get(like.tierlist_id) ?? 0) + 1);
  }

  // Category settings map
  const settingsMap = new Map<string, CategorySetting>();
  for (const s of (categorySettingsResult.data ?? []) as CategorySetting[]) {
    settingsMap.set(s.category, s);
  }

  // Group ALL items (regular + vote) by category
  const categoryMap = new Map<string, CategoryCard[]>();

  for (const tl of tierlists) {
    const cat = tl.category ?? "Other";
    const card: CategoryCard = {
      id: tl.id,
      title: tl.title,
      category: cat,
      cover_image_url: tl.cover_image_url,
      view_count: tl.view_count ?? 0,
      created_at: tl.created_at,
      like_count: likeCountMap.get(tl.id) ?? 0,
      is_vote: false,
    };
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(card);

    // Also add to additional categories
    const extraCats = (tl as typeof tl & { additional_categories?: string[] }).additional_categories ?? [];
    for (const extraCat of extraCats) {
      if (extraCat && extraCat !== cat) {
        if (!categoryMap.has(extraCat)) categoryMap.set(extraCat, []);
        categoryMap.get(extraCat)!.push({ ...card, category: extraCat });
      }
    }
  }

  for (const vl of votelists) {
    const cat = vl.category ?? "Other";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push({
      id: vl.id,
      title: vl.title,
      category: cat,
      cover_image_url: vl.cover_image_url,
      view_count: 0,
      created_at: vl.created_at,
      like_count: 0,
      is_vote: true,
    });
  }

  // Build category sort order from DB categories
  const dbCategories = (categoriesResult.data ?? []) as { name: string; sort_order: number }[];
  const catSortOrder = new Map(dbCategories.map((c, i) => [c.name, c.sort_order ?? i]));

  // Apply category ordering settings and slice to MAX_PER_CATEGORY
  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => (catSortOrder.get(a[0]) ?? 999) - (catSortOrder.get(b[0]) ?? 999))
    .map(([cat, items]) => {
    const setting = settingsMap.get(cat);
    let sorted = [...items];

    if (setting?.sort_method === "views") {
      sorted.sort((a, b) => b.view_count - a.view_count);
    } else if (setting?.sort_method === "likes") {
      sorted.sort((a, b) => b.like_count - a.like_count);
    } else if (setting?.sort_method === "manual" && setting.pinned_ids?.length) {
      const pinnedSet = new Map(setting.pinned_ids.map((id, i) => [id, i]));
      const pinned = sorted.filter((t) => pinnedSet.has(t.id)).sort((a, b) => pinnedSet.get(a.id)! - pinnedSet.get(b.id)!);
      const rest = sorted.filter((t) => !pinnedSet.has(t.id));
      sorted = [...pinned, ...rest];
    }
    // default: recent — sort by created_at DESC
    else {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return { cat, items: sorted, total: sorted.length, displayed: sorted.slice(0, MAX_PER_CATEGORY) };
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Hero ── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Knowitball Tierlists</h1>
        <p className="mx-auto mt-3 max-w-md text-gray-400">
          Pick a tierlist and drag the images into tiers.
        </p>
        <Link href="/create"
          className="mt-6 inline-block rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
          + Create a Tierlist
        </Link>
      </div>

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

              <div className="flex flex-wrap gap-3">
                {displayed.map((item) => (
                  <Link
                    key={item.id}
                    href={item.is_vote ? `/vote/${item.id}` : `/play/${item.id}`}
                    className={`group relative w-[calc(33.333%-8px)] sm:w-[calc(25%-9px)] md:w-[calc(16.666%-10px)] lg:w-[calc(14.285%-10.3px)] overflow-hidden rounded-xl border bg-gray-900 transition-colors ${
                      item.is_vote
                        ? "border-purple-800/50 hover:border-purple-500"
                        : "border-gray-700 hover:border-indigo-500"
                    }`}
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-800">
                      {item.cover_image_url ? (
                        <ImageWithFallback src={item.cover_image_url} alt={item.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <span className="text-4xl">{item.is_vote ? "🗳️" : "🏆"}</span>
                      )}
                      {item.is_vote && (
                        <span className="absolute left-0 top-2 rounded-r-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                          Vote
                        </span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                      <div className="mt-0.5 flex items-center justify-between text-[10px] text-gray-500">
                        {!item.is_vote ? <span title="Views">👁 {item.view_count}</span> : <span />}
                        {item.like_count > 0 && <span className="text-red-400">❤ {item.like_count}</span>}
                      </div>
                    </div>
                  </Link>
                ))}

                {/* View More card */}
                {total > MAX_PER_CATEGORY && (
                  <Link
                    href={`/find?category=${encodeURIComponent(cat)}`}
                    className="flex w-[calc(33.333%-8px)] sm:w-[calc(25%-9px)] md:w-[calc(16.666%-10px)] lg:w-[calc(14.285%-10.3px)] flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-4 text-center transition-colors hover:border-indigo-500 hover:bg-gray-900"
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
            <Link href="/create"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
              Create your first tierlist
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
