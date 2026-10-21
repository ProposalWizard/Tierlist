/**
 * THE LAG TEST — the maths, the route and the bars (B18 step 0, 20 Oct 2026).
 *
 * Harry, 20 Oct 2026: "me mikey and Leo have 3 different levels of phones".
 * Each of them runs the in-game Lag test (Settings → 🛠 Dev → Lag test, or
 * /star-dev?lagtest=1) on their own phone or computer. A small pill at the
 * top walks them through about 10 screens; each one records for 20–40 s.
 * This machine has no graphics chip, so the 3D numbers only come from there.
 * The spec: docs/research/lag/2026-10-20-research.md (§5.0 tiers, §5.2 what
 * to record, §5.4 bars).
 *
 * This file is pure: no React, no browser, no "@/" imports, so the route,
 * the terminal script (scripts/lag-runs.mts) and the tests
 * (tests/star/lagTest.mts) all read the same numbers. The browser half that
 * collects them is lib/star/lagRecorder.ts; the pill is
 * components/star/LagTest.tsx. A finished run is committed as one JSON file
 * to the `lag-runs` branch (/api/star/lag-runs; no database).
 *
 * THE BAR (research §5.4, at the screen's own refresh rate):
 *   - 19 frames in 20 (p95) no slower than 1.25 × one refresh (20.8 ms at 60 Hz)
 *   - 99 in 100 (p99) no slower than 2 refreshes (33.4 ms at 60 Hz, as in the research)
 *   - no frame over 100 ms
 * Low tier, 3D steps (Harry, 20 Oct: "less frames is okay"): a steady 30 fps
 * passes — p95 ≤ 1.25 × 33.3 = 41.7 ms and no frame over 100 ms (no p99 rule).
 * Every line allows 0.5 ms of clock jitter (JITTER_MS).
 */

// ── Who and what ─────────────────────────────────────────────────────────

export type LagTier = "phone-high" | "phone-mid" | "phone-low" | "pc-high" | "pc-mid" | "pc-low" | "other";

export interface LagTierDef { id: LagTier; label: string; hint?: string; kind: "phone" | "pc" | "other"; low: boolean }

/** Research §5.0 (Harry, 20 Oct 2026). Labels are the words on the start screen. */
export const LAG_TIERS: readonly LagTierDef[] = [
  { id: "phone-high", label: "iPhone 16 or newer", kind: "phone", low: false },
  { id: "phone-mid", label: "iPhone 13 or 14", kind: "phone", low: false },
  { id: "phone-low", label: "Older Android", kind: "phone", low: true },
  { id: "pc-high", label: "High PC", hint: "gaming PC, or a new laptop with its own graphics card", kind: "pc", low: false },
  { id: "pc-mid", label: "Mid PC", hint: "3–5 year old laptop", kind: "pc", low: false },
  { id: "pc-low", label: "Low PC", hint: "old office laptop", kind: "pc", low: true },
  { id: "other", label: "Other", kind: "other", low: false },
];

export const tierDef = (t: string): LagTierDef | undefined => LAG_TIERS.find((d) => d.id === t);
export const isLagTier = (t: unknown): t is LagTier => typeof t === "string" && LAG_TIERS.some((d) => d.id === t);

export const LAG_PEOPLE = ["Harry", "Mikey", "Leo"] as const;

// ── The route ────────────────────────────────────────────────────────────

export interface LagStepDef {
  id: string;
  /** Short name: the pill while recording, and the results table. */
  title: string;
  /** What to do, in on-screen words. */
  how: string;
  /** How long it records once the person taps "I'm there". */
  seconds: number;
  /** A 3D place: the low tier passes at a steady 30 fps here. */
  three: boolean;
  /** A link the pill offers for this step (a test page). */
  link?: { href: string; label: string };
}

/**
 * About 10 steps, about 10 minutes with the walking between them. Nothing here
 * changes the career to make a step reachable: a step that can't be reached is
 * skipped ("Can't get there → Skip"). The cut scene is last because it opens a
 * test page outside the game (the 3D bench's scene shot), so nobody has to come back.
 */
export const LAG_STEPS: readonly LagStepDef[] = [
  { id: "home", title: "Home, hands off", how: "Go to Home. Don't touch the screen.", seconds: 20, three: true },
  { id: "stats", title: "Stats and Relations", how: "Swipe to Stats and scroll. Then open Relations and scroll.", seconds: 30, three: false },
  { id: "shop", title: "Shop", how: "Open the Shop and scroll through it.", seconds: 30, three: false },
  { id: "shop3d", title: "3D shop", how: "In the Shop, tap Walk the 3D shop. Walk around.", seconds: 30, three: true },
  { id: "garden", title: "Garden", how: "Open the Garden (Phone → Garden). Walk around.", seconds: 30, three: true },
  { id: "phone", title: "Phone feed", how: "Open Phone → Social. Scroll the feed. Play a goal video if there is one.", seconds: 30, three: false },
  { id: "match2d", title: "2D match", how: "Play a match. Tap I'm there when a chance is on screen, then aim, kick and watch it fly.", seconds: 40, three: false },
  { id: "play3d", title: "3D game", how: "Garden → training pitch: Free Roam or Headers & Volleys. Or a match in 3D view.", seconds: 40, three: true },
  { id: "settings", title: "Settings, in and out", how: "Open Settings, then go back to Home. Do it 4 or 5 times.", seconds: 20, three: false },
  {
    id: "cutscene", title: "Cut scene", how: "Open the cut-scene test shot (a test page) and play a scene.", seconds: 30, three: true,
    link: { href: "/star-3d-bench-dev/scene?scene=director", label: "Open the cut-scene test shot →" },
  },
];

// ── Frame maths ──────────────────────────────────────────────────────────

/** Nearest-rank percentile of an ascending list (p in 0–100). 0 for an empty list. */
export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  const rank = Math.ceil((Math.min(100, Math.max(0, p)) / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** Gap buckets (ms, upper edges) for the small histogram kept with each step. */
export const HIST_EDGES = [8.5, 12, 17.5, 25, 34, 50, 100] as const;

export interface FrameStats {
  /** Frames measured (gaps between two animation frames). */
  n: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames slower than 33 / 50 / 100 ms. */
  over33: number;
  over50: number;
  over100: number;
  /** Counts per HIST_EDGES bucket, plus one for "over 100". */
  hist: number[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Summarise every frame gap of a step (ms). */
export function frameStats(gaps: readonly number[]): FrameStats {
  const s = gaps.filter((g) => Number.isFinite(g) && g > 0).sort((a, b) => a - b);
  const hist = new Array(HIST_EDGES.length + 1).fill(0);
  let over33 = 0, over50 = 0, over100 = 0;
  for (const g of s) {
    if (g > 33.4) over33++;
    if (g > 50) over50++;
    if (g > 100) over100++;
    let i = HIST_EDGES.findIndex((e) => g <= e);
    if (i < 0) i = HIST_EDGES.length;
    hist[i]++;
  }
  return {
    n: s.length,
    p50: r1(percentile(s, 50)), p95: r1(percentile(s, 95)), p99: r1(percentile(s, 99)), max: r1(s.length ? s[s.length - 1] : 0),
    over33, over50, over100, hist,
  };
}

/** Screen refresh rates seen in the wild (Hz). 30 is an iPhone in Low Power Mode. */
export const COMMON_HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240] as const;

export interface Refresh { hz: number; intervalMs: number; medianMs: number }

/**
 * The screen's refresh rate from the median frame gap while nothing moves.
 * Snaps to a common rate when within 8% of its interval (60 Hz for 16.4–17.9
 * ms); otherwise the raw rate, rounded. Falls back to 60 Hz with no frames.
 */
export function snapRefresh(medianMs: number): Refresh {
  if (!(medianMs > 0) || !Number.isFinite(medianMs)) return { hz: 60, intervalMs: 1000 / 60, medianMs: 0 };
  let best: number | null = null, bestErr = Infinity;
  for (const hz of COMMON_HZ) {
    const err = Math.abs(medianMs - 1000 / hz) / (1000 / hz);
    if (err < bestErr) { bestErr = err; best = hz; }
  }
  const hz = best !== null && bestErr <= 0.08 ? best : Math.max(1, Math.round(1000 / medianMs));
  return { hz, intervalMs: 1000 / hz, medianMs: r1(medianMs) };
}

/** The refresh rate from a list of idle gaps (their median). */
export function estimateRefresh(idleGaps: readonly number[]): Refresh {
  const s = idleGaps.filter((g) => Number.isFinite(g) && g > 0).sort((a, b) => a - b);
  return snapRefresh(s.length ? percentile(s, 50) : 0);
}

/**
 * The screen's rate once the route is done: the fastest typical frame seen
 * anywhere (the idle start, or any step's median). A page busy while the start
 * screen measured (a slow phone drawing 3D at 30 fps) would otherwise read as
 * a 30 Hz screen and get a bar twice as lenient.
 */
export function refineRefresh(start: Refresh, steps: readonly { frames: FrameStats | null }[]): Refresh {
  const meds = [start.medianMs, ...steps.map((s) => (s.frames && s.frames.n >= MIN_FRAMES ? s.frames.p50 : 0))].filter((m) => m > 0);
  return meds.length ? snapRefresh(Math.min(...meds)) : start;
}

// ── The bar and the verdict ──────────────────────────────────────────────

export interface Bar {
  /** The frame interval the bar is built on (ms). */
  intervalMs: number;
  p95: number;
  /** null: not checked (the low tier's steady-30 rule has no p99 line). */
  p99: number | null;
  max: number;
  /** "60 Hz" or "steady 30 fps (low tier, 3D)". */
  rule: string;
}

export const MAX_FRAME_MS = 100;
/**
 * Clock jitter allowed on every line of the bar (ms). One dropped frame at
 * 60 Hz measures 33.3–33.5 ms depending on the browser's clock, so without it
 * a single dropped frame in 100 could fail the "2 refreshes" line by 0.1 ms.
 * Measured on this machine's 2D match (20 Oct 2026): p99 33.4 ms.
 */
export const JITTER_MS = 0.5;
const ceil1 = (x: number) => Math.ceil(x * 10 - 1e-9) / 10;
/** Fewer frames than this and a step has no verdict (it was too short to judge). */
export const MIN_FRAMES = 30;

const LOW_3D_INTERVAL = 1000 / 30;

/** The bar for one step on one device tier, at the screen's measured refresh. */
export function barFor(tier: LagTier | string, three: boolean, refreshHz: number): Bar {
  const hz = refreshHz > 0 ? refreshHz : 60;
  const interval = 1000 / hz;
  if (three && tierDef(tier)?.low && interval < LOW_3D_INTERVAL) {
    return { intervalMs: LOW_3D_INTERVAL, p95: r1(1.25 * LOW_3D_INTERVAL), p99: null, max: MAX_FRAME_MS, rule: "steady 30 fps (low tier, 3D)" };
  }
  return { intervalMs: interval, p95: r1(1.25 * interval), p99: ceil1(2 * interval), max: MAX_FRAME_MS, rule: `${Math.round(hz)} Hz` };
}

export interface Verdict {
  /** null: too few frames to judge. */
  pass: boolean | null;
  /** Plain-English reasons it failed (empty on a pass). */
  fails: string[];
}

export function verdict(stats: FrameStats | null | undefined, bar: Bar): Verdict {
  if (!stats || stats.n < MIN_FRAMES) return { pass: null, fails: ["too few frames to judge"] };
  const fails: string[] = [];
  if (stats.p95 > bar.p95 + JITTER_MS) fails.push(`1 frame in 20 slower than ${fmt(stats.p95)} ms (bar ${fmt(bar.p95)})`);
  if (bar.p99 !== null && stats.p99 > bar.p99 + JITTER_MS) fails.push(`1 frame in 100 slower than ${fmt(stats.p99)} ms (bar ${fmt(bar.p99)})`);
  if (stats.max > bar.max) fails.push(`worst frame ${fmt(stats.max)} ms (bar ${bar.max})`);
  return { pass: fails.length === 0, fails };
}

/** 20.8 → "20.8", 21 → "21", 140.04 → "140". */
export function fmt(ms: number): string {
  if (!Number.isFinite(ms)) return "?";
  return ms >= 100 ? String(Math.round(ms)) : String(Math.round(ms * 10) / 10);
}

// ── One run, as saved ────────────────────────────────────────────────────

export interface LagFacts {
  ua: string;
  /** screen.width × screen.height (CSS px). */
  screen: string;
  /** The browser window (CSS px). */
  viewport: string;
  dpr: number;
  cores: number | null;
  /** navigator.deviceMemory (GB, Chrome only, rounded by the browser). */
  memGB: number | null;
  /** The WebGL renderer string (the graphics chip, where the browser tells). */
  gpu: string | null;
  /** Opened from the Home Screen (no browser bars). */
  standalone: boolean;
  /** Settings → 3D quality as set (auto / low / medium / high). */
  quality3d: string | null;
  /** The deployed commit, when the build knows it. */
  build: string | null;
  /** Local time zone offset (minutes), so "20 Oct 14:05" reads as their time. */
  tzOffset: number;
}

export interface Snap3d { t: number; draws: number; tris: number; jsMs: number; pr: number; fps: number; worst: number; rung: number | null; tier: string | null }

export interface LagStepResult {
  id: string;
  title: string;
  status: "done" | "skipped" | "stopped";
  three: boolean;
  /** Seconds actually recorded (visible time). */
  seconds: number;
  frames: FrameStats | null;
  /** Long tasks (Chrome, Android, PC). null where the browser has none (iPhone). */
  longTasks: { count: number; totalMs: number; maxMs: number } | null;
  /** Long animation frames (newer Chrome). null where unsupported. */
  loaf: { count: number; maxMs: number; blockingMs: number } | null;
  /** How late a 20 ms timer fired (ms): blocks the page, works on iPhone too. */
  heartbeat: { n: number; p95: number; max: number; over50: number } | null;
  /** 3D counters every 2 s (window.__frame3d), when a 3D picture was drawing. */
  frame3d: Snap3d[];
  /** JS heap in MB at the start and end (Chrome only). */
  heapMB: [number, number] | null;
  /** Match phases seen (window.__starMatch, dev builds only). */
  phases: string[];
  /** Time the page was hidden mid-step (not counted). */
  hiddenMs: number;
}

export interface LagRun {
  v: 1;
  id: string;
  person: string;
  tier: LagTier;
  /** Free text: what "Other" is, or anything they typed. */
  device: string;
  /** ms since 1970. */
  startedAt: number;
  endedAt: number | null;
  facts: LagFacts;
  refresh: Refresh;
  steps: LagStepResult[];
  /** The page reloaded mid-test this many times (a phone short of memory does this). */
  reloads: number;
  /** Every step done or skipped (false: stopped early). */
  complete: boolean;
}

export function newRunId(now = Date.now()): string {
  return `lag-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The verdict of each step, on this run's tier and refresh. */
export function stepVerdict(run: Pick<LagRun, "tier" | "refresh">, step: Pick<LagStepResult, "three" | "frames" | "status">): { bar: Bar; v: Verdict } {
  const bar = barFor(run.tier, step.three, run.refresh.hz);
  if (step.status === "skipped") return { bar, v: { pass: null, fails: ["skipped"] } };
  return { bar, v: verdict(step.frames, bar) };
}

export function passCount(run: LagRun): { passed: number; judged: number } {
  let passed = 0, judged = 0;
  for (const s of run.steps) {
    const { v } = stepVerdict(run, s);
    if (v.pass === null) continue;
    judged++;
    if (v.pass) passed++;
  }
  return { passed, judged };
}

/** The most a saved run may weigh (the route refuses bigger). */
export const MAX_RUN_BYTES = 200_000;

// ── Where a run is kept: one JSON file per run on the `lag-runs` branch ──
// (Harry, 20 Oct 2026: "why are we using sql's ... just use pushes".)

export const LAG_BRANCH = "lag-runs";
export const LAG_DIR = "lag/runs";

/**
 * lag/runs/2026-10-20-1405-Harry-phone-high.json — the date and time in the
 * person's own time zone. `n` > 1 adds "-2", "-3" for a second run that
 * started in the same minute.
 */
export function lagRunPath(run: Pick<LagRun, "startedAt" | "person" | "tier" | "facts">, n = 1): string {
  const d = new Date(run.startedAt - (run.facts?.tzOffset ?? 0) * 60_000);
  const p = (x: number) => String(x).padStart(2, "0");
  const when = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  const who = run.person.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "someone";
  return `${LAG_DIR}/${when}-${who}-${run.tier}${n > 1 ? `-${n}` : ""}.json`;
}

/**
 * The file's new text for a commit (lib/star/commitScenarios.ts commitDataFile's
 * merge): the run, unless that path already holds a file. The same run there
 * already → `already` (sent before; nothing to do). A different run there →
 * `taken` (try the next path).
 */
export function lagRunFile(currentText: string, run: LagRun, saved: { at: string; build: string | null }): { text: string; ids: string[]; already?: boolean; taken?: boolean } {
  if (currentText.trim()) {
    let id: unknown = null;
    try { id = (JSON.parse(currentText) as { id?: unknown }).id; } catch { id = null; }
    return id === run.id ? { text: currentText, ids: [], already: true } : { text: currentText, ids: [], taken: true };
  }
  return { text: `${JSON.stringify({ ...run, saved }, null, 2)}\n`, ids: [run.id] };
}

/** Shape check, shared by the route and the script. Loose on purpose: old runs stay readable. */
export function isLagRun(v: unknown): v is LagRun {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (r.v !== 1) return false;
  if (typeof r.id !== "string" || !/^[\w-]{4,80}$/.test(r.id)) return false;
  if (typeof r.person !== "string" || !r.person.trim() || r.person.length > 40) return false;
  if (!isLagTier(r.tier)) return false;
  if (typeof r.device !== "string" || r.device.length > 120) return false;
  if (typeof r.startedAt !== "number") return false;
  if (!r.facts || typeof r.facts !== "object") return false;
  const rf = r.refresh as Refresh | undefined;
  if (!rf || typeof rf.hz !== "number") return false;
  if (!Array.isArray(r.steps) || r.steps.length > 20) return false;
  for (const s of r.steps as Record<string, unknown>[]) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || s.id.length > 40) return false;
    if (s.status !== "done" && s.status !== "skipped" && s.status !== "stopped") return false;
  }
  return true;
}

// ── "Copy results": text for the Team chat (2,000 characters at most) ───

const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20 Oct 2026 14:05" in the person's own time. */
export function runDate(ms: number, tzOffsetMin: number): string {
  const d = new Date(ms - tzOffsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${monthShort[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function tierLabel(run: Pick<LagRun, "tier" | "device">): string {
  const d = tierDef(run.tier);
  if (run.tier === "other") return run.device ? `Other: ${run.device}` : "Other";
  return d ? d.label : run.tier;
}

/** One line per step: "3 Shop ✓ p95 17 p99 18 max 34 · >50 0 >100 0 · 1203 f". The script reads these back. */
export function stepLine(run: LagRun, i: number): string {
  const s = run.steps[i];
  const n = i + 1;
  if (s.status === "skipped" || !s.frames) return `${n} ${s.title} — skipped`;
  const { v } = stepVerdict(run, s);
  const mark = v.pass === null ? "—" : v.pass ? "✓" : "✗";
  const f = s.frames;
  return `${n} ${s.title} ${mark} p95 ${fmt(f.p95)} p99 ${fmt(f.p99)} max ${fmt(f.max)} · >50 ${f.over50} >100 ${f.over100} · ${f.n} f`;
}

export function resultsText(run: LagRun): string {
  const f = run.facts;
  const { passed, judged } = passCount(run);
  const bar60 = barFor(run.tier, false, run.refresh.hz);
  const lines = [
    `Lag test · ${run.person} · ${tierLabel(run)} · ${run.refresh.hz} Hz · ${runDate(run.startedAt, f.tzOffset)}`,
    `Device: ${f.gpu ?? "GPU unknown"} · ${f.cores ?? "?"} cores${f.memGB ? ` · ${f.memGB} GB` : ""} · DPR ${f.dpr} · ${f.screen}${f.standalone ? " · Home Screen app" : ""}${f.build ? ` · build ${f.build.slice(0, 7)}` : ""}`,
    ...run.steps.map((_, i) => stepLine(run, i)),
    `Passed ${passed} of ${judged}${run.complete ? "" : " (stopped early)"} · bar p95 ≤ ${fmt(bar60.p95)}, p99 ≤ ${fmt(bar60.p99 ?? 0)}, max ≤ ${bar60.max}${tierDef(run.tier)?.low ? "; 3D steps: steady 30 fps" : ""}`,
    `id ${run.id}`,
  ];
  let text = lines.join("\n");
  // A very long GPU string must not push it past the chat's 2,000 characters.
  if (text.length > 2000) text = text.slice(0, 1997) + "…";
  return text;
}

export interface ParsedStepLine { n: number; title: string; mark: "✓" | "✗" | "—" | "skipped"; p95?: number; p99?: number; max?: number; over50?: number; over100?: number; frames?: number }

/** Read one pasted step line back (scripts/lag-runs.mts). null if the line isn't one. */
export function parseStepLine(line: string): ParsedStepLine | null {
  const skip = line.match(/^(\d+) (.+?) — skipped\s*$/);
  if (skip) return { n: Number(skip[1]), title: skip[2], mark: "skipped" };
  const m = line.match(/^(\d+) (.+?) (✓|✗|—) p95 ([\d.]+) p99 ([\d.]+) max ([\d.]+) · >50 (\d+) >100 (\d+) · (\d+) f\s*$/);
  if (!m) return null;
  return {
    n: Number(m[1]), title: m[2], mark: m[3] as "✓" | "✗" | "—",
    p95: Number(m[4]), p99: Number(m[5]), max: Number(m[6]), over50: Number(m[7]), over100: Number(m[8]), frames: Number(m[9]),
  };
}
