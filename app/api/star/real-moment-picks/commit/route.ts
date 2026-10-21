import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { commitDataFile, resolveCommitConfig } from "@/lib/star/commitScenarios";
import { isMomentId, mergePicksFile, type PickEdit } from "@/lib/star/realMoments/picks";

/**
 * COMMIT REAL-MOMENT PICKS INTO THE CODE: writes the marks into
 * data/realmoments/picks.json on main through the GitHub Contents API (the
 * gallery's commit machinery, lib/star/commitScenarios.ts), then saves the same
 * marks into star_real_moments_picks so the two never disagree. Admin-only;
 * needs GITHUB_TOKEN (a plain 503 sentence when it is missing).
 */

export const dynamic = "force-dynamic";

const PATH = "data/realmoments/picks.json";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ ok: false, error: "Committing marks into the code needs an admin sign-in." }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { picks?: unknown } | null;
  const raw = Array.isArray(body?.picks) ? body!.picks as Record<string, unknown>[] : [];
  const edits: PickEdit[] = raw
    .filter((r) => isMomentId(r?.id) && (r.value === "use" || r.value === "dont" || r.value === "auto"))
    .map((r) => ({ id: r.id as string, value: r.value as PickEdit["value"] }));
  if (!edits.length) {
    return NextResponse.json({ ok: false, error: "Send picks: [{ id, value: use | dont | auto }]. Nothing was committed." }, { status: 400 });
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json({ ok: false, error: env.message?.replace("the scenario is unchanged", "the marks are unchanged"), missingEnv: env.missing }, { status: 503 });
  }

  const result = await commitDataFile({
    config: env.config,
    path: PATH,
    what: "real-moment mark",
    message: edits.length === 1
      ? `Real moments: mark ${edits[0].id} "${edits[0].value}" in the game`
      : `Real moments: commit ${edits.length} marks into the game\n\n${edits.map((e) => `- ${e.id}: ${e.value}`).join("\n")}`,
    merge: (text) => mergePicksFile(text, edits),
  });

  let dbSynced = true;
  if (result.ok) {
    try {
      const service = createServiceClient();
      const keep = edits.filter((e) => e.value !== "auto");
      const clear = edits.filter((e) => e.value === "auto").map((e) => e.id);
      if (keep.length) {
        const { error } = await service.from("star_real_moments_picks").upsert(keep.map((e) => ({ id: e.id, in_game: e.value === "use", updated_at: new Date().toISOString() })));
        if (error) dbSynced = false;
      }
      if (clear.length) {
        const { error } = await service.from("star_real_moments_picks").delete().in("id", clear);
        if (error) dbSynced = false;
      }
    } catch { dbSynced = false; }
  }

  return NextResponse.json(
    result.ok
      ? { ok: true, message: dbSynced ? result.message : `${result.message} (The saved copy could not be updated to match: press Save too.)`, commitSha: result.commitSha, committed: result.committed }
      : { ok: false, error: result.message },
    { status: result.ok ? 200 : result.status },
  );
}
