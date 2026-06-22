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
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import LikeButton from "@/components/LikeButton";
import VoteBoardLoader from "./VoteBoardLoader";
import type { VoteImageWithCounts, VoteTier } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("vote_tierlists")
    .select("title, cover_image_url, category")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  const title = data?.title ? `Vote: ${data.title}` : "Vote Tierlist";
  const description = data
    ? `Vote on the ${data.title} tierlist. Pick where each player belongs and see how the community ranked them.`
    : "Vote on this community tierlist. Pick where each player belongs and see the results.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(data?.cover_image_url && {
        images: [{ url: data.cover_image_url, width: 1200, height: 630, alt: title }],
      }),
    },
    twitter: {
      card: data?.cover_image_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(data?.cover_image_url && { images: [data.cover_image_url] }),
    },
    alternates: { canonical: `/vote/${id}` },
  };
}

export const revalidate = 60;

export default async function VotePage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: tierlist } = await service
    .from("vote_tierlists")
    .select("id, title, category, cover_image_url, description, tiers, is_active, face_detection_enabled")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!tierlist) notFound();

  // ── Fetch images (service client for consistent results) ─────────────────
  const { data: images } = await service
    .from("vote_tierlist_images")
    .select("id, vote_tierlist_id, name, image_url, sort_order, created_at, face_center")
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

  // ── Fetch linked regular tierlists ──────────────────────────────────────────
  const { data: linkedTierlists } = await service
    .from("tierlists")
    .select("id, title")
    .eq("linked_vote_tierlist_id", id)
    .limit(5);

  // ── Build enriched image array ────────────────────────────────────────────
  const enrichedImages: VoteImageWithCounts[] = (images ?? []).map((img) => {
    const counts = voteCounts[img.id] ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      ...img,
      vote_counts: counts,
      total_votes: total,
      user_vote: null,
    };
  });

  const tiers = tierlist.tiers as VoteTier[];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 px-4 py-8 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-purple-700 bg-purple-900/30 px-3 py-1 text-xs font-semibold text-purple-300 mb-3">
          Vote
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white md:text-3xl">
          {tierlist.title}
        </h1>
        {tierlist.description && (
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-200">{tierlist.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-200">
          Tap an image to cast your vote. You can change it at any time.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <LikeButton
            tierlistId={id}
            endpoint={`/api/vote-tierlists/${id}/like`}
          />
          {/* Link to regular tierlist(s) if linked */}
          {(linkedTierlists ?? []).map((lt) => (
            <Link
              key={lt.id}
              href={`/play/${lt.id}`}
              className="rounded-lg border border-indigo-700 bg-indigo-900/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-800/40 transition-colors"
            >
              See Regular Tierlist
            </Link>
          ))}
        </div>

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
      <main className="mx-auto max-w-6xl px-4 py-6">
        {enrichedImages.length === 0 ? (
          <div className="py-24 text-center text-gray-200">
            No items to vote on yet.
          </div>
        ) : (
          <VoteBoardLoader
            votelistId={id}
            tiers={tiers}
            initialImages={enrichedImages}
            initialUserVotes={{}}
            isLoggedIn={false}
            faceDetectionEnabled={tierlist.face_detection_enabled === true}
          />
        )}
      </main>
    </div>
  );
}
