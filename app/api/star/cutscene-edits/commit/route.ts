import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { commitDataFile, resolveCommitConfig } from "@/lib/star/commitScenarios";
import { mergeSceneEditsFile, SCENE_EDITS_PATH, type SavedSceneEdit } from "@/lib/star/sceneEdits/approval";

/**
 * COMMIT TO GAME (Harry, 20 Oct 2026, answer 3D-3: "I would love it to commit
 * straight into the game, but if it goes into the database now, can we then
 * just push it into the repo?"). Writes approved 3D Scene Editor edits into
 * lib/star/data/sceneEdits.json on main through the GitHub Contents API (the
 * gallery's commit machinery, lib/star/commitScenarios.ts). An edit sent
 * un-approved is taken OUT of the file, so the game stops using it.
 * Admin-only; needs GITHUB_TOKEN (a plain 503 sentence when it is missing).
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ ok: false, error: "Committing scene edits into the game needs an admin sign-in. Nothing was committed." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { rows?: unknown } | null;
  const rows = (Array.isArray(body?.rows) ? body!.rows : [])
    .filter((r): r is { scriptId: string; edits: SavedSceneEdit } => !!r && typeof (r as { scriptId?: unknown }).scriptId === "string"
      && !!(r as { edits?: unknown }).edits && typeof (r as { edits?: unknown }).edits === "object")
    .filter((r) => JSON.stringify(r.edits).length < 50_000);
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Send rows: [{ scriptId, edits }]. Nothing was committed." }, { status: 400 });
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json({ ok: false, error: env.message?.replace("the scenario is unchanged", "the game's copy is unchanged"), missingEnv: env.missing }, { status: 503 });
  }

  const names = rows.map((r) => r.scriptId);
  const result = await commitDataFile({
    config: env.config,
    path: SCENE_EDITS_PATH,
    what: "scene edit",
    message: rows.length === 1
      ? `Scene editor: commit the approved edit for "${names[0]}" into the game`
      : `Scene editor: commit ${rows.length} approved scene edits into the game\n\n${names.map((n) => `- ${n}`).join("\n")}`,
    merge: (text) => mergeSceneEditsFile(text, rows),
  });
  return NextResponse.json(
    result.ok ? { ok: true, message: result.message, commitSha: result.commitSha, committed: result.committed } : { ok: false, error: result.message },
    { status: result.ok ? 200 : result.status },
  );
}
