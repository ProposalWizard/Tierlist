export const runtime = "edge";
/**
 * app/api/tierlist/save/route.ts
 *
 * POST /api/tierlist/save
 *
 * Saves (or replaces) a user's tier rankings for a given topic.
 *
 * Strategy: delete all existing rankings for (user, topic), then
 * bulk-insert the new set.  This is simpler and safer than per-row
 * upserts when the user may have removed players from tiers.
 *
 * Request body (SaveRankingPayload):
 *  {
 *    topic_id: string,
 *    rankings: { player_id: string; tier: "S"|"A"|"B"|"C"|"D" }[]
 *  }
 *
 * Responses:
 *  200 { saved: number }     – number of rows written
 *  400 { error: string }     – invalid payload
 *  401 { error: string }     – not authenticated
 *  500 { error: string }     – DB error
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TIERS, type SaveRankingPayload, type Tier } from "@/lib/types";

const VALID_TIERS = new Set<string>(TIERS);

export async function POST(request: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse + validate body ───────────────────────────────────────────
  let body: SaveRankingPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { topic_id, rankings } = body;

  if (!topic_id || typeof topic_id !== "string") {
    return NextResponse.json({ error: "topic_id is required" }, { status: 400 });
  }

  if (!Array.isArray(rankings)) {
    return NextResponse.json({ error: "rankings must be an array" }, { status: 400 });
  }

  // Validate each ranking entry
  for (const r of rankings) {
    if (!r.player_id || typeof r.player_id !== "string") {
      return NextResponse.json(
        { error: "Each ranking must have a player_id string" },
        { status: 400 }
      );
    }
    if (!VALID_TIERS.has(r.tier)) {
      return NextResponse.json(
        { error: `Invalid tier "${r.tier}". Must be one of: ${TIERS.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Guard against duplicate player_ids in a single payload (client-side
  // enforcement should prevent this, but we validate server-side too).
  const playerIds = rankings.map((r) => r.player_id);
  const uniquePlayerIds = new Set(playerIds);
  if (uniquePlayerIds.size !== playerIds.length) {
    return NextResponse.json(
      { error: "Duplicate player_id detected – a player can only appear in one tier" },
      { status: 400 }
    );
  }

  // ── 3. Verify the topic exists ─────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from("tierlist_topics")
    .select("id")
    .eq("id", topic_id)
    .single();

  if (topicError || !topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 400 });
  }

  // ── 4. Delete existing rankings for this user+topic ───────────────────
  const { error: deleteError } = await supabase
    .from("tierlist_rankings")
    .delete()
    .eq("user_id", user.id)
    .eq("topic_id", topic_id);

  if (deleteError) {
    console.error("[save] delete error:", deleteError);
    return NextResponse.json({ error: "Failed to clear old rankings" }, { status: 500 });
  }

  // ── 5. Insert new rankings (skip if empty – user cleared everything) ──
  if (rankings.length === 0) {
    return NextResponse.json({ saved: 0 });
  }

  const rows = rankings.map((r) => ({
    user_id: user.id,
    topic_id,
    player_id: r.player_id,
    tier: r.tier as Tier,
  }));

  const { error: insertError } = await supabase
    .from("tierlist_rankings")
    .insert(rows);

  if (insertError) {
    console.error("[save] insert error:", insertError);
    return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length });
}
