export const runtime = "edge";
/**
 * app/play/[id]/page.tsx
 *
 * Loads a saved tierlist. Increments view count, shows creator name,
 * like/save buttons, and the drag-and-drop board.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import TierlistBoard from "@/components/TierlistBoard";
import LikeButton from "@/components/LikeButton";
import SaveTierlistButton from "@/components/SaveTierlistButton";
import PlayCommunityVote from "@/components/PlayCommunityVote";
import type { Tierlist, TierlistImage, VoteTier } from "@/lib/types";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tierlists").select("title").eq("id", id)
    .single<Pick<Tierlist, "title">>();
  return { title: data?.title ?? "Play Tierlist" };
}

export default async function PlayPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [tierlistResult, imagesResult, { data: { user } }] = await Promise.all([
    supabase.from("tierlists").select("*").eq("id", id).single<Tierlist>(),
    supabase.from("tierlist_images").select("*").eq("tierlist_id", id)
      .order("sort_order", { ascending: true }).returns<TierlistImage[]>(),
    supabase.auth.getUser(),
  ]);

  if (tierlistResult.error || !tierlistResult.data) notFound();

  const tierlist     = tierlistResult.data;
  const images       = imagesResult.data ?? [];
  const userIsAdmin  = user ? await isAdmin(user.id) : false;

  // Increment view count
  await supabase.rpc("increment_view_count", { p_id: id });

  // Creator display name (from user_profiles via service role)
  const service = createServiceClient();
  const { data: creatorProfile } = await service
    .from("user_profiles")
    .select("username, is_anonymous")
    .eq("user_id", tierlist.created_by)
    .maybeSingle();

  const creatorName =
    creatorProfile?.is_anonymous ? "Anonymous"
    : (creatorProfile?.username ?? "Anonymous");

  // Like count + user's like/save status
  const [likesRes, likedRes, savedRes] = await Promise.all([
    supabase.from("tierlist_likes").select("*", { count: "exact", head: true }).eq("tierlist_id", id),
    user
      ? supabase.from("tierlist_likes").select("user_id").eq("user_id", user.id).eq("tierlist_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("saved_tierlists").select("user_id").eq("user_id", user.id).eq("tierlist_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const likeCount = likesRes.count ?? 0;
  const userLiked = !!(likedRes as { data: unknown }).data;
  const userSaved = !!(savedRes as { data: unknown }).data;

  // ── Fetch linked vote tierlist data (if any) ──────────────────────────────
  let linkedVoteTierlist: { id: string; title: string; tiers: VoteTier[] } | null = null;
  let linkedVoteImages: { id: string; name: string; image_url: string; vote_counts: Record<string, number>; total_votes: number }[] = [];

  if (tierlist.linked_vote_tierlist_id) {
    const { data: vt } = await service
      .from("vote_tierlists")
      .select("id, title, tiers")
      .eq("id", tierlist.linked_vote_tierlist_id)
      .eq("is_active", true)
      .maybeSingle();

    if (vt) {
      linkedVoteTierlist = { id: vt.id, title: vt.title, tiers: vt.tiers as VoteTier[] };

      // Fetch vote tierlist images and their vote counts
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
  }

  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">{tierlist.title}</h1>
            <p className="mt-1 text-sm text-gray-400">
              By <span className="font-medium text-gray-300">{creatorName}</span>
              <span className="mx-1.5 text-gray-600">·</span>
              {tierlist.category}
              {userIsAdmin && (
                <span className="ml-2 text-gray-500" title="Total views">
                  · 👁 {(tierlist.view_count ?? 0).toLocaleString()} views
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LikeButton
              tierlistId={id}
              initialCount={likeCount}
              initialLiked={userLiked}
              isLoggedIn={!!user}
            />
            {user && (
              <SaveTierlistButton
                tierlistId={id}
                initialSaved={userSaved}
                isLoggedIn={!!user}
              />
            )}
            {/* Link to vote tierlist if linked */}
            {linkedVoteTierlist && (
              <Link
                href={`/vote/${linkedVoteTierlist.id}`}
                className="rounded-lg border border-purple-700 bg-purple-900/30 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-800/40 transition-colors"
              >
                See Vote Tierlist
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Community's Vote section for linked vote tierlist */}
      {linkedVoteTierlist && linkedVoteImages.length > 0 && (
        <PlayCommunityVote
          tiers={linkedVoteTierlist.tiers}
          images={linkedVoteImages}
          votelistTitle={linkedVoteTierlist.title}
        />
      )}

      <TierlistBoard
        initialImages={images.map((img) => ({
          id: img.id,
          name: img.name,
          image_url: img.image_url,
        }))}
        isAdmin={userIsAdmin}
        tierlistId={id}
        tierlistTitle={tierlist.title}
        isLoggedIn={!!user}
        initialTiers={tierlist.tiers as VoteTier[] | undefined}
      />
    </main>
  );
}
