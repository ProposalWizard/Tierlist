import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { levelFromXp, checkRewardUnlock, type Reward, type UserStats } from "@/lib/xp";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const increments = body as Partial<Record<keyof UserStats, number>>;

  const allowedKeys: (keyof UserStats)[] = [
    "drafts_played", "draft_wins", "draft_invincibles",
    "total_goals_scored", "tierlists_created", "tierlists_likes_received",
    "votes_cast", "seasons_played",
  ];

  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const current: Record<string, number> = {};
  for (const key of allowedKeys) {
    current[key] = (existing?.[key] ?? 0) + (increments[key] ?? 0);
  }

  await svc.from("user_stats").upsert({
    user_id: user.id,
    ...current,
    updated_at: new Date().toISOString(),
  });

  const { data: xpRow } = await svc
    .from("user_xp")
    .select("current_level, total_xp")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await svc
    .from("user_profiles")
    .select("longest_streak")
    .eq("user_id", user.id)
    .maybeSingle();

  const level = xpRow?.current_level ?? 1;
  const stats: UserStats = {
    ...current as unknown as UserStats,
    longest_streak: profile?.longest_streak ?? 0,
  };

  const { data: allRewards } = await svc.from("rewards").select("*");
  const { data: userRewards } = await svc.from("user_rewards").select("reward_id").eq("user_id", user.id);
  const existingIds = new Set((userRewards || []).map((r: { reward_id: string }) => r.reward_id));

  const newlyUnlocked: string[] = [];
  for (const reward of (allRewards || []) as Reward[]) {
    if (existingIds.has(reward.id)) continue;
    if (checkRewardUnlock(reward, stats, level)) {
      const { error } = await svc.from("user_rewards").insert({
        user_id: user.id,
        reward_id: reward.id,
      });
      if (!error) newlyUnlocked.push(reward.id);
    }
  }

  return NextResponse.json({ stats: current, new_rewards: newlyUnlocked });
}
