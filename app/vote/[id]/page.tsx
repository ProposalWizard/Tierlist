/**
 * app/vote/[id]/page.tsx
 *
 * Vote tierlist page.
 * Fetches the tierlist template + images + aggregate vote counts server-side.
 * Logged-in users also get their existing votes pre-filled.
 * Anonymous vote identity is handled client-side via localStorage.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import VoteBoard from "@/components/VoteBoard";
import type { VoteImageWithCounts, VoteTier } from "@/lib/types";

export default async function VotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();

  // ── Fetch tierlist ────────────────────────────────────────────────────────
  const { data: tierlist } = await supabase
    .from("vote_tierlists")
    .select("id, title, category, cover_image_url, description, tiers, is_active")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!tierlist) notFound();

  // ── Fetch images ──────────────────────────────────────────────────────────
  const { data: images } = await supabase
    .from("vote_tierlist_images")
    .select("id, vote_tierlist_id, name, image_url, sort_order, created_at")
    .eq("vote_tierlist_id", id)
    .order("sort_order");

  // ── Fetch aggregate vote counts ───────────────────────────────────────────
  const { data: allVotes } = await service
    .from("vote_tierlist_votes")
    .select("image_id, tier_label")
    .eq("vote_tierlist_id", id);

  // Group counts by image_id → tier_label
  const voteCounts: Record<string, Record<string, number>> = {};
  for (const v of allVotes ?? []) {
    if (!voteCounts[v.image_id]) voteCounts[v.image_id] = {};
    voteCounts[v.image_id][v.tier_label] = (voteCounts[v.image_id][v.tier_label] ?? 0) + 1;
  }

  // ── Fetch logged-in user's existing votes (server-side) ───────────────────
  let initialUserVotes: Record<string, string> = {};
  if (user) {
    const { data: myVotes } = await service
      .from("vote_tierlist_votes")
      .select("image_id, tier_label")
      .eq("vote_tierlist_id", id)
      .eq("voter_id", user.id);

    for (const v of myVotes ?? []) {
      initialUserVotes[v.image_id] = v.tier_label;
    }
  }

  // ── Build enriched image array ────────────────────────────────────────────
  const enrichedImages: VoteImageWithCounts[] = (images ?? []).map((img) => {
    const counts = voteCounts[img.id] ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      ...img,
      vote_counts: counts,
      total_votes: total,
      user_vote: initialUserVotes[img.id] ?? null,
    };
  });

  const tiers = tierlist.tiers as VoteTier[];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-medium text-gray-400 transition-colors hover:text-white">
            ← Back
          </Link>
          <span className="text-sm font-bold text-white">{tierlist.title}</span>
          <div className="w-16" /> {/* spacer */}
        </div>
      </nav>

      {/* ── Header ── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-purple-700 bg-purple-900/30 px-3 py-1 text-xs font-semibold text-purple-300 mb-3">
          Vote
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          {tierlist.title}
        </h1>
        {tierlist.description && (
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">{tierlist.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-600">
          Click a tier to cast your vote. You can change it at any time.
        </p>

        {/* Tier legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tiers.map((t) => (
            <span
              key={t.label}
              className="rounded px-2 py-0.5 text-xs font-bold text-gray-900"
              style={{ backgroundColor: t.color }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Vote board ── */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {enrichedImages.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            No items to vote on yet.
          </div>
        ) : (
          <VoteBoard
            votelistId={id}
            tiers={tiers}
            initialImages={enrichedImages}
            initialUserVotes={initialUserVotes}
            isLoggedIn={!!user}
          />
        )}
      </main>
    </div>
  );
}
