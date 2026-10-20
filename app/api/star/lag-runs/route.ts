import { NextRequest, NextResponse } from "next/server";
import { isTester } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { commitDataFile, ensureBranch, resolveCommitConfig } from "@/lib/star/commitScenarios";
import { LAG_BRANCH, MAX_RUN_BYTES, isLagRun, lagRunFile, lagRunPath, type LagRun } from "@/lib/star/lagTest";

/**
 * LAG TEST RUNS — the in-game Lag test's results (B18 step 0, 20 Oct 2026).
 *
 * No database (Harry, 20 Oct 2026: "why are we using sql's ... just use
 * pushes"). Each run is committed as one JSON file,
 * lag/runs/<YYYY-MM-DD-HHMM>-<person>-<tier>.json, to the `lag-runs` branch
 * (made from main the first time), with the GITHUB_TOKEN the Commit buttons
 * already use (lib/star/commitScenarios.ts). vercel.json switches deploys off
 * for that branch, so a saved run never starts a build.
 *
 * POST, signed-in testers and admins only: { runs: LagRun[] } (1–10: the new
 * run plus any the phone kept from before). A run already on the branch (same
 * id) counts as saved. Any failure is a plain sentence; the phone then keeps
 * the run and says "Saved on this device only".
 * Reading: npx tsx scripts/lag-runs.mts (git fetch origin lag-runs).
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, signIn: true, error: "Sign in to send lag runs." }, { status: 401 });
  if (!(await isTester(user.id))) { // testers and admins
    return NextResponse.json({ ok: false, error: "only testers and admins can send lag runs" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { runs?: unknown } | null;
  const runs = Array.isArray(body?.runs) ? body!.runs : [];
  if (!runs.length || runs.length > 10 || !runs.every(isLagRun)) {
    return NextResponse.json({ ok: false, error: "runs must be 1–10 lag test runs" }, { status: 400 });
  }
  if ((runs as LagRun[]).some((r) => JSON.stringify(r).length > MAX_RUN_BYTES)) {
    return NextResponse.json({ ok: false, error: "a run is too big to keep" }, { status: 413 });
  }

  const env = resolveCommitConfig(process.env as Record<string, string | undefined>);
  if (!env.config) {
    return NextResponse.json({ ok: false, missingEnv: env.missing, error: "saving to the repo is switched off (GITHUB_TOKEN isn't set)" }, { status: 503 });
  }
  const config = { ...env.config, branch: LAG_BRANCH };
  const branch = await ensureBranch({ config, branch: LAG_BRANCH });
  if (!branch.ok) return NextResponse.json({ ok: false, error: (branch as { message: string }).message }, { status: 502 });

  const saved = { at: new Date().toISOString(), build: process.env.VERCEL_GIT_COMMIT_SHA ?? null };
  const files: string[] = [];
  for (const run of runs as LagRun[]) {
    let done = false;
    for (let n = 1; n <= 4 && !done; n++) {
      const path = lagRunPath(run, n);
      let state: { already?: boolean; taken?: boolean } = {};
      const result = await commitDataFile({
        config, path, what: "lag test run",
        message: `Lag test: ${run.person} · ${run.tier} · ${run.steps.length} steps`,
        merge: (text) => { const m = lagRunFile(text, run, saved); state = m; return m; },
      });
      if (result.ok || state.already) { files.push(path); done = true; }
      else if (!state.taken) {
        return NextResponse.json({ ok: false, saved: files.length, files, error: result.message }, { status: result.status >= 400 ? result.status : 502 });
      }
    }
    if (!done) return NextResponse.json({ ok: false, saved: files.length, files, error: "four runs already started in that minute" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, saved: files.length, files, branch: LAG_BRANCH });
}
