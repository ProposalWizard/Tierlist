export const runtime = "edge";
/**
 * app/api/tierlist/[topic]/route.ts
 *
 * GET /api/tierlist/:slug
 *
 * Returns the topic, its players, and the authenticated user's
 * existing rankings (if any) in a single response.
 *
 * This route is an alternative to the Server Component data-fetch
 * on the page – useful for client-side refetching or if you later
 * add SWR / React Query.
 *
 * Responses:
 *  200 TopicPageData   – topic + players + existing_rankings
 *  401 { error }       – not authenticated
 *  404 { error }       – topic not found
 *  500 { error }       – DB error
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TierlistPlayer, TierlistTopic, TierlistRanking, TopicPageData } from "@/lib/types";

interface RouteParams {
  params: Promise<{ topic: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { topic: slug } = await params;

  // ── Auth check ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch topic ────────────────────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from("tierlist_topics")
    .select("*")
    .eq("slug", slug)
    .single<TierlistTopic>();

  if (topicError || !topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // ── Fetch players + existing rankings in parallel ──────────────────────
  const [playersResult, rankingsResult] = await Promise.all([
    supabase
      .from("tierlist_players")
      .select("*")
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: true })
      .returns<TierlistPlayer[]>(),

    supabase
      .from("tierlist_rankings")
      .select("player_id, tier")
      .eq("user_id", user.id)
      .eq("topic_id", topic.id)
      .returns<Pick<TierlistRanking, "player_id" | "tier">[]>(),
  ]);

  if (playersResult.error) {
    console.error("[topic GET] players error:", playersResult.error);
    return NextResponse.json({ error: "Failed to load players" }, { status: 500 });
  }

  const response: TopicPageData = {
    topic,
    players: playersResult.data ?? [],
    existing_rankings: rankingsResult.data ?? [],
  };

  return NextResponse.json(response);
}
