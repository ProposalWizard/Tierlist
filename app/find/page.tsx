/**
 * app/find/page.tsx — Find a Ranking page
 * Shows all rankings (regular, vote, blind) with search & category filter.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Ranking",
  description:
    "Browse and search all football rankings, community vote rankings, and blind rankings. Filter by category.",
  openGraph: {
    title: "Find a Ranking",
    description:
      "Browse and search all football rankings and community vote rankings.",
  },
  twitter: {
    card: "summary",
    title: "Find a Ranking",
    description:
      "Browse and search all football rankings and community vote rankings.",
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

  const [tierlistsRes, votelistsRes, blindsRes, likesCountRes, profilesRes] = await Promise.all([
    service
      .from("tierlists")
      .select("id, title, category, additional_categories, cover_image_url, view_count, created_at, created_by, linked_vote_tierlist_id, linked_blind_ranking_id")
      .order("created_at", { ascending: false })
      .limit(10000),
    service
      .from("vote_tierlists")
      .select("id, title, category, cover_image_url, created_at, created_by")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10000),
    service
      .from("blind_rankings")
      .select("id, title, category, cover_image_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10000),
    service.from("tierlist_likes").select("tierlist_id").limit(100000),
    service.from("user_profiles").select("user_id, username").limit(100000),
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

  // Sets of vote/blind IDs linked to a regular ranking (to avoid duplicate cards)
  type TierlistRow = {
    id: string;
    title: string;
    category: string | null;
    additional_categories?: string[] | null;
    cover_image_url: string | null;
    view_count: number | null;
    created_at: string;
    created_by: string | null;
    linked_vote_tierlist_id: string | null;
    linked_blind_ranking_id: string | null;
  };
  const tierlists = (tierlistsRes.data ?? []) as TierlistRow[];

  // IDs that actually exist in their respective tables (used to validate foreign keys)
  const existingVoteIds = new Set<string>((votelistsRes.data ?? []).map(vl => vl.id));
  const existingBlindIds = new Set<string>((blindsRes.data ?? []).map(br => br.id));

  // IDs referenced by a regular tierlist (used to suppress standalone cards for linked items)
  const linkedVoteIds = new Set<string>(
    tierlists.map(t => t.linked_vote_tierlist_id).filter((x): x is string => !!x && existingVoteIds.has(x))
  );
  const linkedBlindIds = new Set<string>(
    tierlists.map(t => t.linked_blind_ranking_id).filter((x): x is string => !!x && existingBlindIds.has(x))
  );

  const regularItems: FindItem[] = tierlists.map((tl) => {
    const hasLinkedVote = !!(tl.linked_vote_tierlist_id && existingVoteIds.has(tl.linked_vote_tierlist_id));
    const hasLinkedBlind = !!(tl.linked_blind_ranking_id && existingBlindIds.has(tl.linked_blind_ranking_id));
    return {
      id: tl.id,
      title: tl.title,
      category: tl.category,
      additional_categories: tl.additional_categories ?? [],
      cover_image_url: tl.cover_image_url,
      view_count: tl.view_count ?? 0,
      like_count: likeCountMap.get(tl.id) ?? 0,
      created_at: tl.created_at,
      creator: tl.created_by ? (creatorMap.get(tl.created_by) ?? null) : null,
      is_live: false as const,
      is_blind: false as const,
      linked_vote_id: hasLinkedVote ? tl.linked_vote_tierlist_id : null,
      linked_blind_id: hasLinkedBlind ? tl.linked_blind_ranking_id : null,
    };
  });

  const voteItems: FindItem[] = (votelistsRes.data ?? [])
    .filter(vl => !linkedVoteIds.has(vl.id))
    .map((vl) => ({
      id: vl.id,
      title: vl.title,
      category: vl.category,
      cover_image_url: vl.cover_image_url,
      view_count: 0,
      like_count: 0,
      created_at: vl.created_at,
      creator: vl.created_by ? (creatorMap.get(vl.created_by) ?? null) : null,
      is_live: true as const,
      is_blind: false as const,
      linked_vote_id: null,
      linked_blind_id: null,
    }));

  const blindItems: FindItem[] = (blindsRes.data ?? [])
    .filter(br => !linkedBlindIds.has(br.id))
    .map((br) => ({
      id: br.id,
      title: br.title,
      category: br.category,
      cover_image_url: br.cover_image_url,
      view_count: 0,
      like_count: 0,
      created_at: br.created_at,
      creator: null,
      is_live: false as const,
      is_blind: true as const,
      linked_vote_id: null,
      linked_blind_id: null,
    }));

  const allItems: FindItem[] = [...voteItems, ...blindItems, ...regularItems];

  // Unique categories
  const categorySet = new Set<string>();
  for (const item of allItems) {
    if (item.category) categorySet.add(item.category);
    if (!item.is_live && !item.is_blind) {
      for (const extra of (item as Extract<FindItem, { is_live: false; is_blind: false }>).additional_categories ?? []) {
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
          <h1 className="text-3xl font-black tracking-tight text-white">Find a Ranking</h1>
          <p className="mt-1 text-sm text-gray-400">
            {allItems.length} {allItems.length === 1 ? "ranking" : "rankings"} available
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <FindSearch
          items={allItems}
          categories={categories}
          initialCategory={initialCategory}
          likedIds={new Set()}
        />
      </main>
    </div>
  );
}
