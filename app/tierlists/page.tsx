/**
 * app/tierlists/page.tsx — Rankings Hub
 *
 * Shows all rankings (regular, vote, blind) grouped by category.
 * Regular rankings that have linked vote/blind formats show stacked
 * format badges (Regular / Vote / Blind) and link to a selection page.
 * Standalone vote or blind rankings (not linked to a regular) appear
 * as their own cards with a single badge.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/fetchAllRows";
import ImageWithFallback from "@/components/ImageWithFallback";

export const metadata: Metadata = {
  title: "Knowitball Rankings — Football Rankings & Votes",
  description:
    "Play football rankings. Drag players into tiers, vote on community rankings, blind rank players, and download your results.",
  openGraph: {
    title: "Knowitball Rankings — Football Rankings & Votes",
    description:
      "Play football rankings. Drag players into tiers, vote on community rankings, and blind rank players.",
  },
  twitter: {
    card: "summary",
    title: "Knowitball Rankings — Football Rankings & Votes",
    description:
      "Play football rankings. Drag players into tiers, vote on community rankings, and blind rank players.",
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
  is_blind: boolean;
  linked_vote_id: string | null;
  linked_blind_id: string | null;
  href: string;
};

type CategorySetting = { category: string; sort_method: string; pinned_ids: string[] };

export default async function RankingsPage() {
  const service = createServiceClient();

  // These must page: PostgREST caps a single select at 1000 rows, and a
  // truncated tierlist list also breaks the linked-id sets below, which would
  // start rendering linked vote/blind rankings as duplicate standalone cards.
  const [tierlistsAll, votelistsAll, blindsAll, likesAll, categorySettingsResult, categoriesResult] = await Promise.all([
    fetchAllRows<TierlistRow>((from, to) =>
      service
        .from("tierlists")
        .select("id, title, category, additional_categories, cover_image_url, view_count, created_at, linked_vote_tierlist_id, linked_blind_ranking_id")
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<VoteRow>((from, to) =>
      service
        .from("vote_tierlists")
        .select("id, title, category, cover_image_url, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<BlindRow>((from, to) =>
      service
        .from("blind_rankings")
        .select("id, title, category, cover_image_url, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .range(from, to)
    ),
    fetchAllRows<{ tierlist_id: string }>((from, to) =>
      service.from("tierlist_likes").select("tierlist_id").order("tierlist_id").range(from, to)
    ),
    service.from("category_homepage_settings").select("category, sort_method, pinned_ids"),
    service.from("categories").select("name, sort_order").order("sort_order", { ascending: true }),
  ]);

  type TierlistRow = {
    id: string;
    title: string;
    category: string | null;
    additional_categories?: string[] | null;
    cover_image_url: string | null;
    view_count: number | null;
    created_at: string;
    linked_vote_tierlist_id: string | null;
    linked_blind_ranking_id: string | null;
  };
  type VoteRow = {
    id: string;
    title: string;
    category: string | null;
    cover_image_url: string | null;
    created_at: string;
  };
  type BlindRow = VoteRow;

  const tierlists = tierlistsAll;
  const votelists = votelistsAll;
  const blinds = blindsAll;

  // Build sets of vote/blind IDs that are already linked to a regular ranking
  const linkedVoteIds = new Set<string>(
    tierlists
      .map(t => t.linked_vote_tierlist_id)
      .filter((id): id is string => !!id)
  );
  const linkedBlindIds = new Set<string>(
    tierlists
      .map(t => t.linked_blind_ranking_id)
      .filter((id): id is string => !!id)
  );

  const likeCountMap = new Map<string, number>();
  for (const like of likesAll) {
    likeCountMap.set(like.tierlist_id, (likeCountMap.get(like.tierlist_id) ?? 0) + 1);
  }

  const settingsMap = new Map<string, CategorySetting>();
  for (const s of (categorySettingsResult.data ?? []) as CategorySetting[]) {
    settingsMap.set(s.category, s);
  }

  const categoryMap = new Map<string, CategoryCard[]>();

  function addToCategory(cat: string, card: CategoryCard) {
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(card);
  }

  // Regular tierlists — always shown; carry linked format info
  for (const tl of tierlists) {
    const cat = tl.category ?? "Other";
    const hasLinkedVote = !!(tl.linked_vote_tierlist_id && linkedVoteIds.has(tl.linked_vote_tierlist_id));
    const hasLinkedBlind = !!(tl.linked_blind_ranking_id && linkedBlindIds.has(tl.linked_blind_ranking_id));
    const hasMultiple = hasLinkedVote || hasLinkedBlind;
    const card: CategoryCard = {
      id: tl.id,
      title: tl.title,
      category: cat,
      cover_image_url: tl.cover_image_url,
      view_count: tl.view_count ?? 0,
      created_at: tl.created_at,
      like_count: likeCountMap.get(tl.id) ?? 0,
      is_vote: false,
      is_blind: false,
      linked_vote_id: hasLinkedVote ? tl.linked_vote_tierlist_id : null,
      linked_blind_id: hasLinkedBlind ? tl.linked_blind_ranking_id : null,
      href: hasMultiple ? `/rankings/${tl.id}` : `/play/${tl.id}`,
    };
    addToCategory(cat, card);
    for (const extraCat of tl.additional_categories ?? []) {
      if (extraCat && extraCat !== cat) {
        addToCategory(extraCat, { ...card, category: extraCat });
      }
    }
  }

  // Vote tierlists — only show if NOT already linked to a regular ranking
  for (const vl of votelists) {
    if (linkedVoteIds.has(vl.id)) continue;
    const cat = vl.category ?? "Other";
    addToCategory(cat, {
      id: vl.id,
      title: vl.title,
      category: cat,
      cover_image_url: vl.cover_image_url,
      view_count: 0,
      created_at: vl.created_at,
      like_count: 0,
      is_vote: true,
      is_blind: false,
      linked_vote_id: null,
      linked_blind_id: null,
      href: `/vote/${vl.id}`,
    });
  }

  // Blind rankings — only show if NOT already linked to a regular ranking
  for (const br of blinds) {
    if (linkedBlindIds.has(br.id)) continue;
    const cat = br.category ?? "Other";
    addToCategory(cat, {
      id: br.id,
      title: br.title,
      category: cat,
      cover_image_url: br.cover_image_url,
      view_count: 0,
      created_at: br.created_at,
      like_count: 0,
      is_vote: false,
      is_blind: true,
      linked_vote_id: null,
      linked_blind_id: null,
      href: `/blind-rankings/${br.id}`,
    });
  }

  const dbCategories = (categoriesResult.data ?? []) as { name: string; sort_order: number }[];
  const catSortOrder = new Map(dbCategories.map((c, i) => [c.name, c.sort_order ?? i]));

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
      } else {
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      return { cat, items: sorted, total: sorted.length, displayed: sorted.slice(0, MAX_PER_CATEGORY) };
    });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Hero ── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Knowitball Rankings</h1>
        <p className="mx-auto mt-3 max-w-md text-white">
          Pick a ranking and drag players into tiers, vote on community picks, or blind rank without seeing names.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/find"
            className="rounded-xl border border-gray-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-indigo-500 hover:bg-gray-900">
            Find a Ranking
          </Link>
          <Link href="/create"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
            + Create a Ranking
          </Link>
          <Link href="/blind-rankings"
            className="rounded-xl border border-amber-700 bg-amber-900/20 px-6 py-3 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-900/40">
            Blind Rankings
          </Link>
        </div>
      </div>

      {/* ── Category rows ── */}
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8">
        {categories.length > 0 ? (
          categories.map(({ cat, displayed, total }) => (
            <section key={cat}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {cat}
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    {total} {total === 1 ? "ranking" : "rankings"}
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
                {displayed.map((item) => {
                  const isMultiFormat = !item.is_vote && !item.is_blind && (item.linked_vote_id || item.linked_blind_id);
                  const showRegularBadge = !item.is_vote && !item.is_blind;
                  const borderClass = item.is_vote
                    ? "border-purple-800/50 hover:border-purple-500"
                    : item.is_blind
                    ? "border-amber-800/50 hover:border-amber-500"
                    : isMultiFormat
                    ? "border-indigo-700/60 hover:border-indigo-500"
                    : "border-gray-700 hover:border-indigo-500";

                  return (
                    <Link
                      key={`${item.id}-${item.category}`}
                      href={item.href}
                      className={`group relative w-[calc(33.333%-8px)] sm:w-[calc(25%-9px)] md:w-[calc(16.666%-10px)] lg:w-[calc(14.285%-10.3px)] overflow-hidden rounded-xl border bg-gray-900 transition-colors ${borderClass}`}
                    >
                      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gray-800">
                        {item.cover_image_url ? (
                          <ImageWithFallback
                            src={item.cover_image_url}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-4xl">
                            {item.is_vote ? "🗳️" : item.is_blind ? "🔲" : "🏆"}
                          </span>
                        )}

                        {/* Format badges — stacked vertically at top-left */}
                        <div className="absolute left-0 top-2 flex flex-col gap-0.5">
                          {showRegularBadge && (
                            <span className="rounded-r-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                              Regular
                            </span>
                          )}
                          {(item.is_vote || item.linked_vote_id) && (
                            <span className="rounded-r-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                              Vote
                            </span>
                          )}
                          {(item.is_blind || item.linked_blind_id) && (
                            <span className="rounded-r-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                              Blind
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold text-white">{item.title}</p>
                        <div className="mt-0.5 flex items-center justify-between text-[10px] text-gray-400">
                          {item.view_count > 0 ? <span title="Views">👁 {item.view_count}</span> : <span />}
                          {item.like_count > 0 && <span className="text-red-400">❤ {item.like_count}</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* View More card */}
                {total > MAX_PER_CATEGORY && (
                  <Link
                    href={`/find?category=${encodeURIComponent(cat)}`}
                    className="flex w-[calc(33.333%-8px)] sm:w-[calc(25%-9px)] md:w-[calc(16.666%-10px)] lg:w-[calc(14.285%-10.3px)] flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-4 text-center transition-colors hover:border-indigo-500 hover:bg-gray-900"
                  >
                    <span className="text-2xl">→</span>
                    <p className="mt-2 text-xs font-semibold text-white">View More</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">{total - MAX_PER_CATEGORY} more</p>
                  </Link>
                )}
              </div>
            </section>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="mb-4 text-gray-400">No rankings yet. Be the first to create one!</p>
            <Link href="/create"
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500">
              Create your first ranking
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
