/**
 * app/play/[id]/page.tsx
 *
 * Loads a saved tierlist. Increments view count, shows creator name,
 * like/save buttons, and the drag-and-drop board.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import LikeButton from "@/components/LikeButton";
import SaveTierlistButton from "@/components/SaveTierlistButton";
import TierlistBoardLoader from "./TierlistBoardLoader";
import PlayCommunityVoteLoader from "./PlayCommunityVoteLoader";
import type { Tierlist, TierlistImage, VoteTier } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = createServiceClient();
  const { data } = await service
    .from("tierlists")
    .select("title, cover_image_url, category")
    .eq("id", id)
    .single<Pick<Tierlist, "title" | "cover_image_url" | "category">>();

  const title = data?.title ?? "Play Tierlist";
  const description = data
    ? `Play the ${data.title} tierlist. Drag and drop players into S, A, B, C, D tiers and share your ranking.`
    : "Play this football tierlist. Drag and drop players into tiers and share your ranking.";

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
    alternates: { canonical: `/play/${id}` },
  };
}

export const revalidate = 300;

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const service = createServiceClient();

  const [tierlistResult, imagesResult] = await Promise.all([
    service.from("tierlists").select("*").eq("id", id).single<Tierlist>(),
    service.from("tierlist_images").select("*").eq("tierlist_id", id)
      .order("sort_order", { ascending: true }).returns<TierlistImage[]>(),
  ]);

  if (tierlistResult.error || !tierlistResult.data) notFound();

  const tierlist = tierlistResult.data;
  const images   = imagesResult.data ?? [];

  // Fetch creator profile, linked blind ranking, and linked vote tierlist in parallel
  const [creatorProfileResult, linkedBrResult, linkedVtResult] = await Promise.all([
    service.from("user_profiles").select("username, is_anonymous")
      .eq("user_id", tierlist.created_by).maybeSingle(),
    tierlist.linked_blind_ranking_id
      ? service.from("blind_rankings").select("id")
          .eq("id", tierlist.linked_blind_ranking_id).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    tierlist.linked_vote_tierlist_id
      ? service.from("vote_tierlists").select("id, title, tiers")
          .eq("id", tierlist.linked_vote_tierlist_id).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const creatorProfile = creatorProfileResult.data;
  const creatorName =
    creatorProfile?.is_anonymous ? "Anonymous"
    : (creatorProfile?.username ?? "Anonymous");

  const linkedBlindRankingId = linkedBrResult.data?.id ?? null;

  let linkedVoteTierlist: { id: string; title: string; tiers: VoteTier[] } | null = null;
  let linkedVoteImages: { id: string; name: string; image_url: string; vote_counts: Record<string, number>; total_votes: number }[] = [];

  if (linkedVtResult.data) {
    const vt = linkedVtResult.data;
    linkedVoteTierlist = { id: vt.id, title: vt.title, tiers: vt.tiers as VoteTier[] };

    const [{ data: vtImages }, { data: vtVotes }] = await Promise.all([
      service.from("vote_tierlist_images").select("id, name, image_url, sort_order").eq("vote_tierlist_id", vt.id).order("sort_order"),
      service.from("vote_tierlist_votes").select("image_id, tier_label").eq("vote_tierlist_id", vt.id),
    ]);

    const counts: Record<string, Record<string, number>> = {};
    for (const v of vtVotes ?? []) {
      if (!counts[v.image_id]) counts[v.image_id] = {};
      counts[v.image_id][v.tier_label] = (counts[v.image_id][v.tier_label] ?? 0) + 1;
    }

    linkedVoteImages = (vtImages ?? []).map((img) => {
      const vc = counts[img.id] ?? {};
      return {
        id: img.id,
        name: img.name,
        image_url: img.image_url,
        vote_counts: vc,
        total_votes: Object.values(vc).reduce((a, b) => a + b, 0),
      };
    });
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{tierlist.title}</h1>
            <p className="mt-1 text-sm text-white">
              By <span className="font-medium text-white">{creatorName}</span>
              <span className="mx-1.5 text-white">·</span>
              {tierlist.category}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LikeButton tierlistId={id} />
            <SaveTierlistButton tierlistId={id} />
            {linkedVoteTierlist && (
              <Link
                href={`/vote/${linkedVoteTierlist.id}`}
                className="rounded-lg bg-purple-700 hover:bg-purple-600 px-4 py-2 text-sm font-bold text-white transition-colors shadow-md"
              >
                Vote Ranking
              </Link>
            )}
            {linkedBlindRankingId && (
              <Link
                href={`/blind-rankings/${linkedBlindRankingId}`}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors shadow-md"
              >
                Blind Rank This
              </Link>
            )}
          </div>
        </div>
      </header>

      {linkedVoteTierlist && linkedVoteImages.length > 0 && (
        <PlayCommunityVoteLoader
          tiers={linkedVoteTierlist.tiers}
          images={linkedVoteImages}
          votelistTitle={linkedVoteTierlist.title}
          votelistId={linkedVoteTierlist.id}
        />
      )}

      <TierlistBoardLoader
        initialImages={images.map((img) => ({
          id: img.id,
          name: img.name,
          image_url: img.image_url,
          face_center: img.face_center ?? null,
        }))}
        isAdmin={false}
        tierlistId={id}
        tierlistTitle={tierlist.title}
        isLoggedIn={false}
        initialTiers={tierlist.tiers as VoteTier[] | undefined}
        faceDetectionEnabled={tierlist.face_detection_enabled !== false}
      />
    </main>
  );
}
