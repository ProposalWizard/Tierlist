import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { levelFromXp, checkRewardUnlock, XP_AWARDS, DAILY_XP_CAP, type Reward, type UserStats } from "@/lib/xp";
import { planXpEvent, slotRef, runQualifies, isCappedXp, utcDay } from "@/lib/xpEventKeys";

/**
 * POST { event_type, event_ref } — award XP for something the player did.
 *
 * The amount comes from the server's table (lib/xp.ts), never the client.
 * The dedup key (event_ref) is built by the server too (lib/xpEventKeys.ts):
 * the phone's own ref is ignored except as a pointer to a saved draft season
 * (which must exist and earn the award) or a Ballon d'Or season (capped per
 * day). Adding to total_xp is one atomic step when add_user_xp exists
 * (supabase/migrations/xp_atomic_award.sql); until then, read-then-write.
 */
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
    event_ref?: unknown;
  };

  if (!event_type || typeof event_type !== "string" || event_type.length > 80) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const MAX_SINGLE_AWARD = 1000;
  const svc = createServiceClient();
  const now = new Date();

  let awardXp: number;
  let insertEventType = event_type;
  let insertEventRef: string;
  /** Count today's awards of this type after inserting (race-safe cap). */
  let recheckCap = false;

  const knownAward = (XP_AWARDS as Record<string, number>)[event_type];
  if (knownAward == null && event_type.startsWith("objective_")) {
    // Objective awards: the objective must really be completed. One canonical
    // key shared with /api/objectives/check and the claim route.
    const objectiveId = event_type.slice("objective_".length);
    const [{ data: obj }, { data: userObj }] = await Promise.all([
      svc.from("objectives").select("xp_reward").eq("id", objectiveId).maybeSingle(),
      svc.from("user_objectives").select("completed_at").eq("user_id", user.id).eq("objective_id", objectiveId).maybeSingle(),
    ]);
    if (!obj || !userObj?.completed_at) {
      return NextResponse.json({ error: "Objective not completed" }, { status: 400 });
    }
    awardXp = Number(obj.xp_reward) || 0;
    insertEventType = "objective_complete";
    insertEventRef = event_type;
  } else {
    const plan = planXpEvent(event_type, event_ref, now, knownAward != null);
    if (plan.kind === "reject") {
      return NextResponse.json({ error: plan.reason }, { status: 400 });
    }
    awardXp = knownAward ?? 0;

    if (plan.kind === "fixed") {
      if (plan.needStreak) {
        const { data: prof } = await svc.from("user_profiles").select("current_streak").eq("user_id", user.id).maybeSingle();
        const streak = prof?.current_streak ?? 0;
        if (streak < plan.needStreak) {
          return NextResponse.json({ error: `Needs a ${plan.needStreak}-day streak` }, { status: 400 });
        }
      }
      insertEventRef = plan.ref;
    } else if (plan.kind === "day") {
      insertEventRef = plan.ref;
    } else if (plan.kind === "slot") {
      const todayCount = await countToday(svc, user.id, event_type, now);
      const ref = slotRef(plan.base, todayCount);
      if (!ref) return cappedResponse();
      insertEventRef = ref;
    } else if (plan.kind === "run") {
      const { data: run, error: runErr } = await svc
        .from("draft_runs")
        .select("season_number, finish, losses")
        .eq("user_id", user.id)
        .eq("event_key", plan.runKey)
        .limit(1)
        .maybeSingle();
      if (runErr) {
        console.error("[xp] could not read draft_runs:", runErr.message);
        return NextResponse.json({ error: "Could not check that season" }, { status: 500 });
      }
      if (!run) {
        console.warn(`[xp] ${event_type} refused for ${user.id}: no saved season ${plan.runKey}`);
        return NextResponse.json({ error: "No saved season matches" }, { status: 400 });
      }
      if (!runQualifies(plan.need, run as { season_number: number | null; finish: number | null; losses: number | null })) {
        console.warn(`[xp] ${event_type} refused for ${user.id}: season ${plan.runKey} does not earn it`);
        return NextResponse.json({ error: "That season does not earn this" }, { status: 400 });
      }
      insertEventRef = plan.ref;
      recheckCap = isCappedXp(event_type);
    } else {
      insertEventRef = plan.ref;
      recheckCap = true;
    }

    // Quick refusal before writing anything (the recheck below closes races).
    if (recheckCap && (await countToday(svc, user.id, event_type, now)) >= DAILY_XP_CAP) {
      return cappedResponse();
    }
  }

  if (!Number.isFinite(awardXp) || awardXp <= 0) {
    return NextResponse.json({ error: "Invalid award" }, { status: 400 });
  }
  awardXp = Math.min(Math.floor(awardXp), MAX_SINGLE_AWARD);

  const { data: inserted, error: eventError } = await svc.from("xp_events").insert({
    user_id: user.id,
    event_type: insertEventType,
    event_ref: insertEventRef,
    xp_awarded: awardXp,
  }).select("id").maybeSingle();

  if (eventError) {
    if (eventError.code === "23505") {
      return NextResponse.json({ duplicate: true, message: "Already awarded" });
    }
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  // Two requests at once could both pass the count above: count again after
  // writing, and take this one back if it went over the cap.
  if (recheckCap && (await countToday(svc, user.id, event_type, now)) > DAILY_XP_CAP) {
    if (inserted?.id) await svc.from("xp_events").delete().eq("id", inserted.id);
    return cappedResponse();
  }

  const { oldXp, newXp } = await addXp(svc, user.id, awardXp);
  const { level: newLevel } = levelFromXp(newXp);
  const { level: oldLevel } = levelFromXp(oldXp);
  if (newLevel !== oldLevel) {
    await svc.from("user_xp").update({ current_level: newLevel }).eq("user_id", user.id);
  }

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

function cappedResponse() {
  return NextResponse.json({
    capped: true,
    message: `Daily limit reached (${DAILY_XP_CAP}/day) for this action`,
  });
}

/** Awards of this type today (UTC). */
async function countToday(svc: ReturnType<typeof createServiceClient>, userId: string, eventType: string, now: Date): Promise<number> {
  const { count } = await svc
    .from("xp_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", `${utcDay(now)}T00:00:00.000Z`);
  return count ?? 0;
}

/**
 * Add to total_xp. One atomic UPDATE through add_user_xp when that function
 * exists (xp_atomic_award.sql, pending); otherwise the old read-then-write.
 */
async function addXp(svc: ReturnType<typeof createServiceClient>, userId: string, amount: number): Promise<{ oldXp: number; newXp: number }> {
  const { data, error } = await svc.rpc("add_user_xp", { p_user_id: userId, p_amount: amount });
  if (!error && data != null) {
    const newXp = Number(Array.isArray(data) ? data[0] : data);
    if (Number.isFinite(newXp)) return { oldXp: newXp - amount, newXp };
  }
  const missing = error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));
  if (error && !missing) console.error("[xp] add_user_xp failed, falling back:", error.message);

  const { data: xpRow } = await svc.from("user_xp").select("total_xp").eq("user_id", userId).maybeSingle();
  const oldXp = xpRow?.total_xp ?? 0;
  const newXp = oldXp + amount;
  await svc.from("user_xp").upsert({
    user_id: userId,
    total_xp: newXp,
    current_level: levelFromXp(newXp).level,
    updated_at: new Date().toISOString(),
  });
  return { oldXp, newXp };
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
