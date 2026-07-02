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
  const { event_type, event_ref, xp_amount } = (body ?? {}) as {
    event_type?: string;
    event_ref?: string;
    xp_amount?: number;
  };

  if (!event_type || typeof event_type !== "string") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  // Trust the server-side award table over the client where the event_type is
  // known. Fall back to the client value only for unknown types, and always
  // clamp to a sane ceiling — this endpoint is otherwise fully client-trusted,
  // so an unclamped xp_amount lets a caller mint unlimited XP/levels/rewards.
  const MAX_SINGLE_AWARD = 1000;
  const knownAward = (XP_AWARDS as Record<string, number>)[event_type];
  const requested = Number(xp_amount);
  const resolved = knownAward ?? requested;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const awardXp = Math.min(Math.floor(resolved), MAX_SINGLE_AWARD);

  const svc = createServiceClient();

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
