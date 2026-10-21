import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { commitDataFile, resolveCommitConfig } from "@/lib/star/commitScenarios";
import {
  levelId, mergeTrainingFile, sanitizeLevel, TRAINING_SKILLS,
  type LevelEdit, type TrainingSkill,
} from "@/lib/star/trainingLevelData";
import { TRAINING_LEVELS } from "@/lib/star/trainingLevels";

/**
 * COMMIT TRAINING LEVELS INTO THE CODE: writes the edited rows into
 * lib/star/data/trainingLevels.json on main through the GitHub Contents API
 * (the gallery's commit machinery, lib/star/commitScenarios.ts), then saves
 * the same rows into star_training_levels so the two never disagree.
 * Admin-only; needs GITHUB_TOKEN (a plain 503 sentence when it is missing).
 */

export const dynamic = "force-dynamic";

const PATH = "lib/star/data/trainingLevels.json";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ ok: false, error: "Committing a level into the code needs an admin sign-in." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { levels?: unknown } | null;
  const raw = Array.isArray(body?.levels) ? body!.levels as Record<string, unknown>[] : [];
  const edits: LevelEdit[] = [];
  for (const r of raw) {
    const skill = r?.skill as TrainingSkill;
    const level = Number(r?.level);
    if (TRAINING_SKILLS.includes(skill) && Number.isInteger(level) && level >= 1 && level <= TRAINING_LEVELS && r.config && typeof r.config === "object") {
      edits.push({ skill, level, config: sanitizeLevel(skill, level, r.config) });
    }
  }
  if (!edits.length) {
    return NextResponse.json({ ok: false, error: "Send levels: [{ skill, level, config }]. Nothing was committed." }, { status: 400 });
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json({ ok: false, error: env.message?.replace("the scenario is unchanged", "the level is unchanged"), missingEnv: env.missing }, { status: 503 });
  }

  const names = edits.map(e => levelId(e.skill, e.level));
  const result = await commitDataFile({
    config: env.config,
    path: PATH,
    what: "training level",
    message: edits.length === 1
      ? `Training: commit ${names[0]} into the code`
      : `Training: commit ${edits.length} levels into the code\n\n${names.map(n => `- ${n}`).join("\n")}`,
    merge: (text) => mergeTrainingFile(text, edits),
  });

  let dbSynced = true;
  if (result.ok) {
    try {
      const service = createServiceClient();
      const { error } = await service.from("star_training_levels").upsert(edits.map(e => ({
        id: levelId(e.skill, e.level), skill: e.skill, level: e.level, config: e.config, updated_at: new Date().toISOString(),
      })));
      if (error) dbSynced = false;
    } catch { dbSynced = false; }
  }

  return NextResponse.json(
    result.ok
      ? { ok: true, message: dbSynced ? result.message : `${result.message} (The saved copy could not be updated to match: press Save too.)`, commitSha: result.commitSha, committed: result.committed }
      : { ok: false, error: result.message },
    { status: result.ok ? 200 : result.status },
  );
}
