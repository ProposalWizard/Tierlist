import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateObjective } from "@/lib/objectiveEvaluator";
import type { ObjectiveCondition, ObjectiveProgress, SeasonCheckData } from "@/lib/objectiveTypes";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: SeasonCheckData = await req.json();
  if (!body.competition || !body.squad || !body.playerStats || !body.events) {
    return NextResponse.json({ error: "Missing season data" }, { status: 400 });
  }

  const service = createServiceClient();

  let { data: objectives, error: objErr } = await service
    .from("objectives")
    .select("id, title, xp_reward, card_image_url, card_name, conditions, same_season, same_player, or_groups")
    .eq("is_active", true)
    .eq("is_published", true)
    .or("expires_at.is.null,expires_at.gt.now()");

  if (objErr) {
    // is_published or same_player column may not exist yet — fall back without the filter
    const fallback = await service
      .from("objectives")
      .select("id, title, xp_reward, card_image_url, card_name, conditions, same_season")
      .eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt.now()");
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    objectives = (fallback.data ?? []).map(o => ({ ...o, same_player: false, or_groups: null }));
  }

  const eligible = (objectives ?? []).filter(o => {
    const conds = o.conditions as ObjectiveCondition[] | null;
    return conds && conds.length > 0;
  });
  if (eligible.length === 0) return NextResponse.json({ completed: [] });

  const objIds = eligible.map(o => o.id);

  const { data: existingRecords } = await service
    .from("user_objectives")
    .select("objective_id, completed_at, progress")
    .eq("user_id", user.id)
    .in("objective_id", objIds);

  const recordMap = new Map<string, { completed_at: string | null; progress: ObjectiveProgress }>(
    (existingRecords ?? []).map(c => [
      c.objective_id,
      { completed_at: c.completed_at ?? null, progress: (c.progress as ObjectiveProgress) ?? {} },
    ])
  );

  const newlyCompleted: { id: string; xp_reward: number; title: string; card_image_url: string | null; card_name: string | null }[] = [];

  for (const obj of eligible) {
    const existing = recordMap.get(obj.id);
    if (existing?.completed_at) continue;

    const conditions = obj.conditions as ObjectiveCondition[];
    const currentProgress = existing?.progress ?? {};
    const sameSeason = (obj as Record<string, unknown>).same_season === true;
    const samePlayer = (obj as Record<string, unknown>).same_player === true;
    const orGroups = ((obj as Record<string, unknown>).or_groups ?? null) as ObjectiveCondition[][] | null;
    const { newProgress, complete } = evaluateObjective(conditions, currentProgress, body, sameSeason, samePlayer, orGroups ?? undefined);

    if (complete) {
      const { error: upsertErr } = await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        completed_at: new Date().toISOString(),
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });

      if (!upsertErr) {
        newlyCompleted.push({ id: obj.id, xp_reward: obj.xp_reward, title: obj.title ?? "", card_image_url: obj.card_image_url ?? null, card_name: obj.card_name ?? null });
      }
    } else {
      await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });
    }
  }

  // Return completed objectives — client calls /api/xp for each xp_reward > 0
  return NextResponse.json({ completed: newlyCompleted });
}
