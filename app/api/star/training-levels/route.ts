import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createPublicReadClient } from "@/lib/supabase/publicRead";
import { levelId, parseLevelId, sanitizeLevel, TRAINING_SKILLS, type TrainingSkill } from "@/lib/star/trainingLevelData";
import { TRAINING_LEVELS } from "@/lib/star/trainingLevels";

/**
 * SAVED TRAINING LEVELS — one row per edited level (skill + level number),
 * sitting on top of the committed lib/star/data/trainingLevels.json.
 *
 * GET is public (every career reads the same levels). POST and DELETE are
 * admin-only, written with the service key. Same shape as
 * /api/star/scenarios, including the honest "table not made yet" answer:
 * GET returns an empty list with `migrationMissing: true`, POST/DELETE a
 * sentence naming supabase/migrations/star_training_levels.sql.
 */

export const dynamic = "force-dynamic";

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

const MIGRATION_HINT =
  "The star_training_levels table doesn't exist yet — run " +
  "supabase/migrations/star_training_levels.sql in the Supabase SQL Editor. Until then, " +
  "edited levels stay on this device only.";

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Saving a level for everyone needs an admin sign-in." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase.from("star_training_levels").select("id, config");
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ levels: {}, migrationMissing: true, message: MIGRATION_HINT });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const levels: Record<string, unknown> = {};
  for (const row of (data ?? []) as { id: string; config: unknown }[]) {
    const p = parseLevelId(row.id);
    if (p) levels[row.id] = sanitizeLevel(p.skill, p.level, row.config);
  }
  return NextResponse.json({ levels, migrationMissing: false });
}

export async function POST(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => null) as { skill?: unknown; level?: unknown; config?: unknown } | null;
  const skill = body?.skill as TrainingSkill;
  const level = Number(body?.level);
  if (!TRAINING_SKILLS.includes(skill) || !Number.isInteger(level) || level < 1 || level > TRAINING_LEVELS || !body?.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "Send skill (power, technique, freeKick, pace or vision), level (1-30) and config." }, { status: 400 });
  }
  const config = sanitizeLevel(skill, level, body.config);
  const service = createServiceClient();
  const { error } = await service.from("star_training_levels").upsert({
    id: levelId(skill, level), skill, level, config, updated_at: new Date().toISOString(),
  });
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config });
}

export async function DELETE(req: NextRequest) {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!parseLevelId(id)) return NextResponse.json({ error: "id must look like vision:30" }, { status: 400 });
  const service = createServiceClient();
  const { error } = await service.from("star_training_levels").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: MIGRATION_HINT, migrationMissing: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
