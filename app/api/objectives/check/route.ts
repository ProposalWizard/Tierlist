import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateObjective } from "@/lib/objectiveEvaluator";
import { levelFromXp } from "@/lib/xp";
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
  // Objective IDs (+ amounts) whose XP was already granted server-side below, so the
  // client popup knows not to award it a second time.
  const serverAwardedXp: { id: string; xp: number }[] = [];

  for (const obj of eligible) {
    const existing = recordMap.get(obj.id);
    if (existing?.completed_at) continue;

    const conditions = obj.conditions as ObjectiveCondition[];
    const currentProgress = existing?.progress ?? {};
    const sameSeason = (obj as Record<string, unknown>).same_season === true;
    const samePlayer = (obj as Record<string, unknown>).same_player === true;
    const orGroups = ((obj as Record<string, unknown>).or_groups ?? null) as ObjectiveCondition[][] | null;

    // Derive isNewRun: only reset career progress when this is genuinely a new run.
    // Season 1 alone isn't enough — a season-1 check from another flow (e.g. a
    // multiplayer game) would otherwise wipe solo career counters. Gate the reset
    // on the run key actually changing since the last reset.
    const lastRunKey = (currentProgress as Record<string, unknown>)._lastRunKey as string | undefined;
    const isNewRun = body.seasonNumber === 1 && lastRunKey !== body.runKey;

    const { newProgress, complete } = evaluateObjective(conditions, currentProgress, body, sameSeason, samePlayer, orGroups ?? undefined, isNewRun);

    // When resetting, record the run key so subsequent season-1 checks for the
    // same run don't reset again.
    if (isNewRun && body.runKey) {
      (newProgress as Record<string, unknown>)._lastRunKey = body.runKey;
    }

    if (complete) {
      const { error: upsertErr } = await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        completed_at: new Date().toISOString(),
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });

      if (!upsertErr) {
        newlyCompleted.push({ id: obj.id, xp_reward: obj.xp_reward, title: obj.title ?? "", card_image_url: obj.card_image_url ?? null, card_name: obj.card_name ?? null });

        // Award XP server-side immediately when the objective completes, so a client
        // that dies (tab close, refresh, network drop) between this check and its
        // follow-up /api/xp call doesn't forfeit the XP. The objective is already
        // marked complete above and never re-fires, so without this the XP is lost.
        if (obj.xp_reward > 0) {
          const awardAmount = Math.min(obj.xp_reward, 1000);
          const { data: inserted, error: eventErr } = await service
            .from("xp_events")
            .upsert(
              {
                user_id: user.id,
                event_type: "objective_complete",
                event_ref: `objective_${obj.id}`,
                xp_awarded: awardAmount,
              },
              { onConflict: "user_id,event_type,event_ref", ignoreDuplicates: true }
            )
            .select("id");
          if (!eventErr) {
            // Only bump the running total when a NEW event row was actually inserted
            // (empty on conflict) — this keeps concurrent checks from double-counting.
            if (inserted && inserted.length > 0) {
              const { data: xpRow } = await service.from("user_xp").select("total_xp").eq("user_id", user.id).maybeSingle();
              const newTotal = (xpRow?.total_xp ?? 0) + awardAmount;
              // current_level must be recomputed here too. Leaving it stale keeps
              // level-gated rewards locked until some unrelated XP event happens
              // to fire, because /api/stats and /api/xp both read this column.
              await service.from("user_xp").upsert({
                user_id: user.id,
                total_xp: newTotal,
                current_level: levelFromXp(newTotal).level,
                updated_at: new Date().toISOString(),
              });
            }
            // Either way the XP is now handled server-side — tell the client to skip it.
            serverAwardedXp.push({ id: obj.id, xp: awardAmount });
          }
        }
      }
    } else {
      await service.from("user_objectives").upsert({
        user_id: user.id,
        objective_id: obj.id,
        progress: newProgress,
      }, { onConflict: "user_id,objective_id" });
    }
  }

  // Return completed objectives. XP for entries in serverAwardedXp was already
  // granted here, so the client must NOT re-award those (only unhandled ones).
  return NextResponse.json({ completed: newlyCompleted, serverAwardedXp });
}
