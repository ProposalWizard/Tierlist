import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isMatchScenario } from "@/lib/star/authoredScenarios";
import { commitScenarios, removeScenariosFromRepo, resolveCommitConfig } from "@/lib/star/commitScenarios";
import type { MatchScenario } from "@/lib/star/scenarios";

/**
 * COMMIT A SCENARIO INTO THE REPOSITORY.
 *
 * The second, stronger save path, next to /api/star/scenarios (which writes
 * Supabase and is live on every device instantly). This one edits
 * lib/star/authoredScenarios.json through the GitHub Contents API and
 * commits it, so the scenario is part of the code — in git, reviewable,
 * revertible, and unaffected by anything that happens to the database.
 *
 * Admin-only, via the same `isAdmin()` gate as the Supabase route and the
 * Lineups page. Writing to the repository is a bigger action than writing a
 * row, not a smaller one.
 *
 * ── Degrading honestly ──
 *
 * With no GITHUB_TOKEN set, this is a known, named state, not a crash: it
 * returns 503 with a sentence naming the env var and saying plainly that
 * nothing was committed. The gallery shows that sentence and leaves the card
 * exactly as it was — it never claims a commit the server did not confirm.
 * Same principle the scenarios route already applies to a missing migration.
 *
 * The token itself is read from the environment, used for the Authorization
 * header, and never returned or logged.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — committing a scenario into the code needs an admin sign-in." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null) as
    { scenario?: unknown; scenarios?: unknown } | null;
  const raw: unknown[] = Array.isArray(body?.scenarios)
    ? body!.scenarios as unknown[]
    : body?.scenario !== undefined ? [body.scenario] : [];

  if (!raw.length) {
    return NextResponse.json(
      { ok: false, error: "Send a `scenario` (a MatchScenario) or a `scenarios` array. Nothing was committed." },
      { status: 400 },
    );
  }
  if (!raw.every(isMatchScenario)) {
    return NextResponse.json(
      { ok: false, error: "Every scenario must be a MatchScenario (id, name, kind, camera, ball, players[]). Nothing was committed." },
      { status: 400 },
    );
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json(
      { ok: false, error: env.message, missingEnv: env.missing, committed: [] },
      { status: 503 },
    );
  }

  const result = await commitScenarios({
    config: env.config,
    scenarios: raw as MatchScenario[],
  });

  // ── The database gets the SAME copy ──
  // A commit used to write only the code. Measured on 23 Sep: five tight
  // angles were newer in the code than in the database, because they were
  // committed without being saved first — so every browser went on showing
  // the older database copy as "the game still has the older copy", and the
  // next Commit all from any of them would have written that older copy back
  // over the newer one. Whatever is committed is now also saved, so the two
  // can never disagree. Best effort: a database failure never undoes a
  // commit that has already happened, it is reported instead.
  let dbSynced = true;
  if (result.ok) {
    try {
      const service = createServiceClient();
      const rows = (raw as MatchScenario[]).map((sc) => ({
        id: sc.id, name: sc.name, kind: sc.kind, scenario: sc, updated_at: new Date().toISOString(),
      }));
      const { error } = await service.from("star_scenarios").upsert(rows);
      if (error) dbSynced = false;
    } catch {
      dbSynced = false;
    }
  }

  return NextResponse.json(
    result.ok
      ? {
        ok: true,
        message: dbSynced ? result.message : `${result.message} (The shared list could not be updated to match — save it again.)`,
        committed: result.committed, commitSha: result.commitSha, dbSynced,
      }
      : { ok: false, error: result.message, raced: result.raced ?? false, committed: [] },
    { status: result.ok ? 200 : result.status },
  );
}

/**
 * DELETE a scenario from the committed file.
 *
 * The gallery display reads the committed file, so a Delete that only cleared
 * Supabase would let the scenario reappear on the next load. This removes it
 * from the code as well. Admin-only, same gate as POST.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — deleting a scenario from the code needs an admin sign-in." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null) as { id?: unknown; ids?: unknown } | null;
  const ids: string[] = Array.isArray(body?.ids)
    ? (body!.ids as unknown[]).filter((x): x is string => typeof x === "string")
    : typeof body?.id === "string" ? [body.id] : [];
  if (!ids.length) {
    return NextResponse.json(
      { ok: false, error: "Send an `id` or an `ids` array. Nothing was deleted." },
      { status: 400 },
    );
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json(
      { ok: false, error: env.message, missingEnv: env.missing, deleted: [] },
      { status: 503 },
    );
  }

  const result = await removeScenariosFromRepo({ config: env.config, ids });
  return NextResponse.json(
    result.ok
      ? { ok: true, message: result.message, deleted: result.committed }
      : { ok: false, error: result.message, raced: result.raced ?? false, deleted: [] },
    { status: result.ok ? 200 : result.status },
  );
}
