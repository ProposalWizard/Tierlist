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

  let body: { image_id?: string; tier_label?: string; voter_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { image_id, tier_label, voter_id: anonVoterId } = body;

  if (!image_id || !tier_label) {
    return NextResponse.json({ error: "image_id and tier_label are required" }, { status: 400 });
  }

  // Determine voter identity
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  const isAnonymous = !user;

  // Anonymous voter ids must be a real UUID and are namespaced with "anon:" so
  // they can never collide with (and thus hijack/pre-claim) a logged-in user's id.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let voterId: string;
  if (user) {
    voterId = user.id;
  } else {
    if (!anonVoterId || !UUID_RE.test(anonVoterId)) {
      return NextResponse.json({ error: "valid voter_id required for anonymous votes" }, { status: 400 });
    }
    voterId = `anon:${anonVoterId}`;
  }

  // Use service client to bypass RLS for the upsert
  const service = createServiceClient();

  // Validate the image belongs to this tierlist, the tierlist is active, and the
  // tier_label is one of its real tiers — otherwise junk pollutes the aggregates.
  const [{ data: image }, { data: tierlist }] = await Promise.all([
    service
      .from("vote_tierlist_images")
      .select("id, vote_tierlist_id")
      .eq("id", image_id)
      .maybeSingle(),
    service
      .from("vote_tierlists")
      .select("tiers, is_active")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!tierlist || tierlist.is_active === false) {
    return NextResponse.json({ error: "This vote tierlist is not active" }, { status: 400 });
  }
  if (!image || image.vote_tierlist_id !== id) {
    return NextResponse.json({ error: "Image does not belong to this tierlist" }, { status: 400 });
  }

  const validLabels = new Set(
    Array.isArray(tierlist.tiers)
      ? (tierlist.tiers as { label?: string }[]).map((t) => t?.label).filter(Boolean)
      : []
  );
  // Always require a known label — if tiers are missing/malformed, refuse rather
  // than accept arbitrary labels that would silently pollute the counts.
  if (validLabels.size === 0 || !validLabels.has(tier_label)) {
    return NextResponse.json({ error: "Invalid tier label" }, { status: 400 });
  }

  // Prevent an anonymous request from overwriting a logged-in user's vote by
  // passing their user_id (which is publicly discoverable) as voter_id.
  if (isAnonymous) {
    const { data: existingVote } = await service
      .from("vote_tierlist_votes")
      .select("is_anonymous")
      .eq("image_id", image_id)
      .eq("voter_id", voterId)
      .maybeSingle();
    if (existingVote && existingVote.is_anonymous === false) {
      return NextResponse.json({ error: "Cannot modify this vote" }, { status: 403 });
    }
  }

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

  // Return updated counts for just this image. Aggregate with per-label exact
  // counts (head:true) instead of fetching raw rows — PostgREST caps a plain
  // select at 1000 rows, which would under-count popular images.
  const labels = Array.from(validLabels) as string[];
  const countResults = await Promise.all(
    labels.map((label) =>
      service
        .from("vote_tierlist_votes")
        .select("*", { count: "exact", head: true })
        .eq("image_id", image_id)
        .eq("tier_label", label)
        .then(({ count }) => ({ label, count: count ?? 0 }))
    )
  );

  const vote_counts: Record<string, number> = {};
  for (const { label, count } of countResults) {
    if (count > 0) vote_counts[label] = count;
  }
  const total_votes = countResults.reduce((sum, r) => sum + r.count, 0);

  // Award XP for first vote on this tierlist (logged-in users only).
  // Awaited so the update isn't frozen when the serverless function returns.
  if (user) {
    const { error: xpErr } = await service.from("xp_events").insert({
      user_id: user.id,
      event_type: "vote_cast",
      event_ref: `${id}_${image_id}`,
      xp_awarded: XP_AWARDS.vote_cast,
    });
    if (!xpErr) {
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
    }
  }

  return NextResponse.json({ vote_counts, total_votes });
}
