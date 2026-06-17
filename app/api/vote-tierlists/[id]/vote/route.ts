/**
 * POST /api/vote-tierlists/[id]/vote
 *
 * Cast or change a vote for one image in a vote tierlist.
 * Uses an upsert so the voter can change their mind at any time.
 *
 * Body: { image_id: string; tier_label: string; voter_id?: string }
 *  - voter_id is required only for anonymous users (a UUID from localStorage).
 *  - For logged-in users the voter_id is taken from the auth session instead.
 *
 * Response: { vote_counts: Record<tierLabel, number>; total_votes: number }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { XP_AWARDS, levelFromXp } from "@/lib/xp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { image_id, tier_label, voter_id: anonVoterId } = body as {
    image_id: string;
    tier_label: string;
    voter_id?: string;
  };

  if (!image_id || !tier_label) {
    return NextResponse.json({ error: "image_id and tier_label are required" }, { status: 400 });
  }

  // Determine voter identity
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const voterId = user ? user.id : anonVoterId;
  const isAnonymous = !user;

  if (!voterId) {
    return NextResponse.json({ error: "voter_id required for anonymous votes" }, { status: 400 });
  }

  // Use service client to bypass RLS for the upsert
  const service = createServiceClient();

  const { error: upsertError } = await service
    .from("vote_tierlist_votes")
    .upsert(
      {
        vote_tierlist_id: id,
        image_id,
        tier_label,
        voter_id: voterId,
        is_anonymous: isAnonymous,
      },
      { onConflict: "image_id,voter_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Return updated counts for just this image
  const { data: votes, error: countError } = await service
    .from("vote_tierlist_votes")
    .select("tier_label")
    .eq("image_id", image_id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const vote_counts: Record<string, number> = {};
  for (const v of votes ?? []) {
    vote_counts[v.tier_label] = (vote_counts[v.tier_label] ?? 0) + 1;
  }
  const total_votes = Object.values(vote_counts).reduce((a, b) => a + b, 0);

  // Award XP for first vote on this tierlist (logged-in users only, fire-and-forget)
  if (user) {
    service.from("xp_events").insert({
      user_id: user.id,
      event_type: "vote_cast",
      event_ref: `${id}_${image_id}`,
      xp_awarded: XP_AWARDS.vote_cast,
    }).then(async ({ error: xpErr }) => {
      if (xpErr) return;
      const { data: xpRow } = await service.from("user_xp").select("total_xp").eq("user_id", user.id).maybeSingle();
      const newXp = (xpRow?.total_xp ?? 0) + XP_AWARDS.vote_cast;
      await service.from("user_xp").upsert({
        user_id: user.id,
        total_xp: newXp,
        current_level: levelFromXp(newXp).level,
        updated_at: new Date().toISOString(),
      });
      const { data: stats } = await service.from("user_stats").select("votes_cast").eq("user_id", user.id).maybeSingle();
      await service.from("user_stats").upsert({
        user_id: user.id,
        votes_cast: (stats?.votes_cast ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
    });
  }

  return NextResponse.json({ vote_counts, total_votes });
}
