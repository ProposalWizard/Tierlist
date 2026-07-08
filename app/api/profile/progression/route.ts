import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { levelFromXp, type Reward, type UserStats, type UserProgression } from "@/lib/xp";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const svc = createServiceClient();

  const [
    { data: xpRow },
    { data: statsRow },
    { data: allRewards },
    { data: userRewards },
    { data: profile },
    { data: recentEvents },
    { data: claimedObjRows },
  ] = await Promise.all([
    svc.from("user_xp").select("*").eq("user_id", user.id).maybeSingle(),
    svc.from("user_stats").select("*").eq("user_id", user.id).maybeSingle(),
    svc.from("rewards").select("*").order("sort_order"),
    svc.from("user_rewards").select("*").eq("user_id", user.id),
    svc.from("user_profiles").select("equipped_frame, equipped_title, longest_streak").eq("user_id", user.id).maybeSingle(),
    svc.from("xp_events").select("event_type, xp_awarded, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    svc.from("user_objectives").select("objective_id").eq("user_id", user.id).not("claimed_at", "is", null),
  ]);

  // Fetch objective card art for claimed objectives + counts for all active objectives
  let objectiveCards: { id: string; name: string; card_image_url: string }[] = [];
  const objectiveCardCounts: Record<string, number> = {};
  const claimedObjIds = (claimedObjRows ?? []).map((r: { objective_id: string }) => r.objective_id);

  const [claimedObjCardData, allObjCardData] = await Promise.all([
    claimedObjIds.length > 0
      ? svc.from("objectives").select("id, card_name, card_image_url").in("id", claimedObjIds).not("card_image_url", "is", null)
      : Promise.resolve({ data: [] }),
    svc.from("objectives").select("card_image_url").eq("is_active", true).not("card_image_url", "is", null),
  ]);

  objectiveCards = ((claimedObjCardData.data ?? []) as { id: string; card_name: string | null; card_image_url: string }[])
    .filter(o => o.card_image_url)
    .map(o => ({
      id: `obj_card_${o.id}`,
      name: o.card_name ?? "Card",
      card_image_url: o.card_image_url,
    }));

  for (const o of (allObjCardData.data ?? []) as { card_image_url: string | null }[]) {
    if (o.card_image_url) {
      objectiveCardCounts[o.card_image_url] = (objectiveCardCounts[o.card_image_url] ?? 0) + 1;
    }
  }

  const totalXp = xpRow?.total_xp ?? 0;
  const { level, currentLevelXp, xpToNext, progress } = levelFromXp(totalXp);

  const unlockedSet = new Map<string, string>(
    (userRewards || []).map((ur: { reward_id: string; unlocked_at: string }) => [ur.reward_id, ur.unlocked_at] as [string, string]),
  );

  const stats: UserStats = {
    drafts_played: statsRow?.drafts_played ?? 0,
    draft_wins: statsRow?.draft_wins ?? 0,
    draft_invincibles: statsRow?.draft_invincibles ?? 0,
    total_goals_scored: statsRow?.total_goals_scored ?? 0,
    tierlists_created: statsRow?.tierlists_created ?? 0,
    tierlists_likes_received: statsRow?.tierlists_likes_received ?? 0,
    votes_cast: statsRow?.votes_cast ?? 0,
    seasons_played: statsRow?.seasons_played ?? 0,
    longest_streak: profile?.longest_streak ?? 0,
  };

  const rewards = ((allRewards || []) as Reward[]).map((r) => ({
    ...r,
    unlocked: unlockedSet.has(r.id),
    unlocked_at: unlockedSet.get(r.id) ?? null,
  }));

  const result: UserProgression = {
    xp: totalXp,
    level,
    currentLevelXp,
    xpToNext,
    progress,
    stats,
    rewards,
    equippedFrame: profile?.equipped_frame ?? "frame_default",
    equippedTitle: profile?.equipped_title ?? "title_rookie",
    recentXpEvents: recentEvents || [],
    objectiveCards,
    objectiveCardCounts,
  };

  return NextResponse.json(result);
}
