/**
 * scripts/lag-runs.mts — every in-game Lag test run, in the terminal
 * (B18 step 0, 20 Oct 2026).
 *
 *   npx tsx scripts/lag-runs.mts             # newest 30 runs from the lag-runs branch
 *   npx tsx scripts/lag-runs.mts 100         # newest 100
 *   npx tsx scripts/lag-runs.mts pasted.txt  # "Copy results" text pasted from the Team chat
 *
 * Runs live in git, not a database (Harry, 20 Oct 2026: "why are we using
 * sql's ... just use pushes"): one JSON file per run,
 * lag/runs/<YYYY-MM-DD-HHMM>-<person>-<tier>.json, on the `lag-runs` branch.
 * This runs `git fetch origin lag-runs`, then reads the files from
 * origin/lag-runs. It never writes anything.
 *
 * Per run: person, device tier, screen rate, date, then each step's p95 (1 frame
 * in 20 is slower than this), worst frame and ✓/✗ against the bar
 * (lib/star/lagTest.ts — the same maths the phone used).
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  LAG_BRANCH, LAG_DIR, LAG_STEPS, barFor, fmt, isLagRun, parseStepLine, passCount, runDate, stepVerdict, tierLabel,
  type LagRun,
} from "../lib/star/lagTest";

const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

interface Row { path: string; run: unknown; build: string | null }

function fromBranch(limit: number): Row[] {
  const ref = `origin/${LAG_BRANCH}`;
  try {
    run("git", ["fetch", "--quiet", "origin", `+refs/heads/${LAG_BRANCH}:refs/remotes/${ref}`]);
  } catch (e) {
    const msg = String((e as { stderr?: string }).stderr || (e as Error).message);
    if (/couldn't find remote ref|not our ref|no such ref/i.test(msg)) {
      throw new Error(`there is no ${LAG_BRANCH} branch yet — the first run saved from a phone makes it. Until then, paste "Copy results" text into a file and run: npx tsx scripts/lag-runs.mts pasted.txt`);
    }
    throw new Error(`fetching ${LAG_BRANCH} failed: ${msg.trim().split("\n")[0]}`);
  }
  // File names start with the date and time, so newest first is a reverse sort.
  const paths = run("git", ["ls-tree", "-r", "--name-only", ref, `${LAG_DIR}/`])
    .split("\n").filter((p) => p.endsWith(".json")).sort().reverse().slice(0, limit);
  return paths.map((path) => {
    let data: unknown = null;
    try { data = JSON.parse(run("git", ["show", `${ref}:${path}`])); } catch { data = null; }
    const saved = (data as { saved?: { build?: string | null } } | null)?.saved;
    return { path, run: data, build: saved?.build ?? null };
  });
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const lpad = (s: string, n: number) => (s.length >= n ? s : " ".repeat(n - s.length) + s);

function printRun(r: LagRun, build: string | null) {
  const f = r.facts;
  const { passed, judged } = passCount(r);
  console.log(`\n${r.person} · ${tierLabel(r)} · ${r.refresh.hz} Hz (median gap ${r.refresh.medianMs} ms) · ${runDate(r.startedAt, f.tzOffset)} · passed ${passed} of ${judged}${r.complete ? "" : " (stopped early)"}${r.reloads ? ` · reloaded ${r.reloads}×` : ""}`);
  console.log(`  ${f.gpu ?? "GPU unknown"} · ${f.cores ?? "?"} cores${f.memGB ? ` · ${f.memGB} GB` : ""} · DPR ${f.dpr} · screen ${f.screen} · window ${f.viewport}${f.standalone ? " · Home Screen app" : ""} · 3D quality ${f.quality3d ?? "?"}${build || f.build ? ` · build ${(build || f.build)!.slice(0, 7)}` : ""}`);
  console.log(`  ${f.ua}`);
  console.log(`  ${pad("step", 22)} ${pad("", 2)} ${lpad("p50", 6)} ${lpad("p95", 6)} ${lpad("bar", 6)} ${lpad("p99", 6)} ${lpad("max", 6)} ${lpad(">50", 4)} ${lpad(">100", 5)} ${lpad("frames", 6)}  other`);
  for (const s of r.steps) {
    const { bar, v } = stepVerdict(r, s);
    if (s.status === "skipped" || !s.frames) { console.log(`  ${pad(s.title, 22)} –  skipped`); continue; }
    const mark = v.pass === null ? "–" : v.pass ? "✓" : "✗";
    const fr = s.frames;
    const extra: string[] = [];
    if (s.heartbeat) extra.push(`late timer p95 ${fmt(s.heartbeat.p95)} max ${fmt(s.heartbeat.max)}`);
    if (s.longTasks) extra.push(`long tasks ${s.longTasks.count} (max ${s.longTasks.maxMs} ms)`);
    if (s.frame3d.length) {
      const last = s.frame3d[s.frame3d.length - 1];
      const draws = s.frame3d.map((x) => x.draws).sort((a, b) => a - b);
      extra.push(`3D ${draws[Math.floor(draws.length / 2)]} draws, ${Math.round(last.tris / 1000)}k tris, px ${last.pr}${last.rung !== null ? `, rung ${last.rung}` : ""}`);
    }
    if (s.heapMB) extra.push(`heap ${s.heapMB[0]}→${s.heapMB[1]} MB`);
    if (s.status === "stopped") extra.push("stopped early");
    console.log(`  ${pad(s.title, 22)} ${mark}  ${lpad(fmt(fr.p50), 6)} ${lpad(fmt(fr.p95), 6)} ${lpad(fmt(bar.p95), 6)} ${lpad(fmt(fr.p99), 6)} ${lpad(fmt(fr.max), 6)} ${lpad(String(fr.over50), 4)} ${lpad(String(fr.over100), 5)} ${lpad(String(fr.n), 6)}  ${extra.join(" · ")}`);
    if (v.pass === false) console.log(`  ${pad("", 22)}    ${v.fails.join("; ")}`);
  }
  const missing = LAG_STEPS.filter((d) => !r.steps.some((s) => s.id === d.id));
  if (missing.length) console.log(`  not reached: ${missing.map((d) => d.title).join(", ")}`);
}

/** "Copy results" text pasted from the Team chat: a header line, then the step lines. */
function printPasted(path: string) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let runs = 0;
  for (const line of lines) {
    if (/^Lag test · /.test(line)) { runs++; console.log(`\n${line.replace(/^Lag test · /, "")}`); continue; }
    if (/^Device: /.test(line)) { console.log(`  ${line}`); continue; }
    const p = parseStepLine(line);
    if (p) {
      console.log(p.mark === "skipped"
        ? `  ${pad(p.title, 22)} –  skipped`
        : `  ${pad(p.title, 22)} ${p.mark}  p95 ${lpad(fmt(p.p95!), 6)}  p99 ${lpad(fmt(p.p99!), 6)}  max ${lpad(fmt(p.max!), 6)}  >50 ${p.over50}  >100 ${p.over100}  ${p.frames} frames`);
      continue;
    }
    if (/^Passed /.test(line)) console.log(`  ${line}`);
  }
  if (!runs) console.log(`No "Lag test · …" lines in ${path}.`);
}

function main() {
  const arg = process.argv[2];
  if (arg && !/^\d+$/.test(arg)) { printPasted(arg); return; }
  let rows: Row[];
  try {
    rows = fromBranch(arg ? Number(arg) : 30);
  } catch (e) {
    console.log(`Lag runs: could not read — ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Lag test runs on the ${LAG_BRANCH} branch: ${rows.length}, newest first.`);
  console.log(`Bar (research §5.4): 1 frame in 20 (p95) ≤ 1.25 refreshes, 1 in 100 (p99) ≤ 2 refreshes, none over 100 ms. Low tier in 3D: steady 30 fps (p95 ≤ ${fmt(barFor("phone-low", true, 60).p95)} ms).`);
  for (const r of rows) {
    if (!isLagRun(r.run)) { console.log(`\n${r.path}: (a run this script can't read)`); continue; }
    printRun(r.run, r.build);
  }
}

main();
