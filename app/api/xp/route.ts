import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { levelFromXp, checkRewardUnlock, XP_AWARDS, type Reward, type UserStats } from "@/lib/xp";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { event_type, event_ref } = (body ?? {}) as {
    event_type?: string;
    event_ref?: string;
  };

  if (!event_type || typeof event_type !== "string") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  // XP amounts are resolved SERVER-SIDE only — the client value is never trusted.
  // Known event types use the award table; objective_<id> events look up the
  // objective's real reward and require the user to have actually completed it.
  // Any other event type is rejected, so a caller can't mint arbitrary XP.
  const MAX_SINGLE_AWARD = 1000;
  const svc = createServiceClient();

  let awardXp: number;
  const knownAward = (XP_AWARDS as Record<string, number>)[event_type];
  if (knownAward != null) {
    awardXp = knownAward;
  } else if (event_type.startsWith("objective_")) {
    const objectiveId = event_type.slice("objective_".length);
    const [{ data: obj }, { data: userObj }] = await Promise.all([
      svc.from("objectives").select("xp_reward").eq("id", objectiveId).maybeSingle(),
      svc.from("user_objectives").select("completed_at").eq("user_id", user.id).eq("objective_id", objectiveId).maybeSingle(),
    ]);
    if (!obj || !userObj?.completed_at) {
      return NextResponse.json({ error: "Objective not completed" }, { status: 400 });
    }
    awardXp = Number(obj.xp_reward) || 0;
  } else {
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  }

  if (!Number.isFinite(awardXp) || awardXp <= 0) {
    return NextResponse.json({ error: "Invalid award" }, { status: 400 });
  }
  awardXp = Math.min(Math.floor(awardXp), MAX_SINGLE_AWARD);

  const { error: eventError } = await svc.from("xp_events").insert({
    user_id: user.id,
    event_type,
    event_ref: event_ref || event_type,
    xp_awarded: awardXp,
  });

  if (eventError) {
    if (eventError.code === "23505") {
      return NextResponse.json({ duplicate: true, message: "Already awarded" });
    }
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  const { data: xpRow } = await svc
    .from("user_xp")
    .select("total_xp")
    .eq("user_id", user.id)
    .maybeSingle();

  const oldXp = xpRow?.total_xp ?? 0;
  const newXp = oldXp + awardXp;
  const { level: newLevel } = levelFromXp(newXp);
  const { level: oldLevel } = levelFromXp(oldXp);

  await svc.from("user_xp").upsert({
    user_id: user.id,
    total_xp: newXp,
    current_level: newLevel,
    updated_at: new Date().toISOString(),
  });

  let newRewards: string[] = [];
  if (newLevel > oldLevel) {
    newRewards = await checkAndUnlockRewards(svc, user.id);
  }

  return NextResponse.json({
    new_xp: newXp,
    new_level: newLevel,
    leveled_up: newLevel > oldLevel,
    old_level: oldLevel,
    xp_awarded: awardXp,
    new_rewards: newRewards,
  });
}

async function checkAndUnlockRewards(
  svc: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<string[]> {
  const [{ data: allRewards }, { data: userRewards }, { data: statsRow }, { data: xpRow }, { data: profile }] =
    await Promise.all([
      svc.from("rewards").select("*"),
      svc.from("user_rewards").select("reward_id").eq("user_id", userId),
      svc.from("user_stats").select("*").eq("user_id", userId).maybeSingle(),
      svc.from("user_xp").select("*").eq("user_id", userId).maybeSingle(),
      svc.from("user_profiles").select("longest_streak").eq("user_id", userId).maybeSingle(),
    ]);

  if (!allRewards) return [];

  const existingIds = new Set((userRewards || []).map((r: { reward_id: string }) => r.reward_id));
  const level = xpRow?.current_level ?? 1;

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

  const newlyUnlocked: string[] = [];

  for (const reward of allRewards as Reward[]) {
    if (existingIds.has(reward.id)) continue;
    if (checkRewardUnlock(reward, stats, level)) {
      const { error } = await svc.from("user_rewards").insert({
        user_id: userId,
        reward_id: reward.id,
      });
      if (!error) {
        newlyUnlocked.push(reward.id);
      }
    }
  }

  return newlyUnlocked;
}
