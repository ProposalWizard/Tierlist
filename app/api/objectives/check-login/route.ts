import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { ObjectiveCondition, ObjectiveProgress } from "@/lib/objectiveTypes";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Get user's current and longest streak
  const { data: profile } = await service
    .from("user_profiles")
    .select("current_streak, longest_streak")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ completed: [] });

  const { current_streak, longest_streak } = profile;

  // Fetch published, active, non-expired objectives with login_streak conditions
  let objQuery = service
    .from("objectives")
    .select("id, xp_reward, conditions")
    .eq("is_active", true)
    .or("expires_at.is.null,expires_at.gt.now()");
  try { objQuery = objQuery.eq("is_published", true); } catch { /* column may not exist yet */ }

  const { data: objectives, error: objErr } = await objQuery;
  if (objErr) return NextResponse.json({ error: objErr.message }, { status: 500 });

  const eligible = (objectives ?? []).filter(o => {
    const conds = o.conditions as ObjectiveCondition[] | null;
    return conds && conds.some(c => c.type === "login_streak");
  });
  if (eligible.length === 0) return NextResponse.json({ completed: [] });

  const objIds = eligible.map(o => o.id);

  const { data: existingRecords } = await service
    .from("user_objectives")
    .select("objective_id, completed_at, progress")
    .eq("user_id", user.id)
    .in("objective_id", objIds);

  const recordMap = new Map<string, { completed_at: string | null; progress: ObjectiveProgress }>(
    (existingRecords ?? []).map(r => [
      r.objective_id,
      { completed_at: r.completed_at ?? null, progress: (r.progress as ObjectiveProgress) ?? {} },
    ])
  );

  const newlyCompleted: { id: string; xp_reward: number }[] = [];

  for (const obj of eligible) {
    const existing = recordMap.get(obj.id);
    if (existing?.completed_at) continue;

    const conditions = obj.conditions as ObjectiveCondition[];
    const currentProgress: ObjectiveProgress = existing?.progress ?? {};
    const newProgress: ObjectiveProgress = { ...currentProgress };

    // Update progress for login_streak conditions
    for (const cond of conditions) {
      if (cond.type !== "login_streak") continue;
      const tf = cond.timeframe ?? "season";
      const streak = tf === "career" ? longest_streak : current_streak;
      newProgress[cond.id] = Math.max(newProgress[cond.id] ?? 0, streak);
    }

    // Check if all conditions are now met
    const complete = conditions.every(cond => {
      if (cond.type === "login_streak") {
        return (newProgress[cond.id] ?? 0) >= cond.count;
      }
      // Non-login conditions use stored progress
      return (newProgress[cond.id] ?? 0) >= cond.count;
    });

    if (complete) {
      await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        completed_at: new Date().toISOString(),
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });
      newlyCompleted.push({ id: obj.id, xp_reward: obj.xp_reward });
    } else {
      await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });
    }
  }

  return NextResponse.json({ completed: newlyCompleted });
}
