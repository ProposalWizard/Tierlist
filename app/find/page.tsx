/**
 * app/find/page.tsx — Find a Tierlist page
 * Shows all tierlists + vote tierlists with search & category filter.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Tierlist",
  description:
    "Browse and search all football tierlists and community vote rankings. Filter by category to find the tierlist you want to play.",
  openGraph: {
    title: "Find a Tierlist",
    description:
      "Browse and search all football tierlists and community vote rankings.",
  },
  twitter: {
    card: "summary",
    title: "Find a Tierlist",
    description:
      "Browse and search all football tierlists and community vote rankings.",
  },
  alternates: { canonical: "/find" },
};
import { createServiceClient } from "@/lib/supabase/service";
import FindSearch, { type FindItem } from "@/components/FindSearch";

export const revalidate = 30;

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: initialCategory } = await searchParams;
  const service = createServiceClient();

  const [tierlistsRes, votelistsRes, likesCountRes, profilesRes] = await Promise.all([
    service
      .from("tierlists")
      .select("id, title, category, additional_categories, cover_image_url, view_count, created_at, created_by")
      .order("created_at", { ascending: false }),
    service
      .from("vote_tierlists")
      .select("id, title, category, cover_image_url, created_at, created_by")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    service.from("tierlist_likes").select("tierlist_id"),
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

  const likedIds = new Set<string>();

  // Build unified list
  const tierlists: FindItem[] = (tierlistsRes.data ?? []).map((tl) => ({
    id: tl.id,
    title: tl.title,
    category: tl.category,
    additional_categories: (tl as typeof tl & { additional_categories?: string[] }).additional_categories ?? [],
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
    if (!item.is_live) {
      for (const extra of (item as typeof item & { additional_categories?: string[] }).additional_categories ?? []) {
        if (extra) categorySet.add(extra);
      }
    }
  }
  const categories = Array.from(categorySet).sort();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
