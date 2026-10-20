/**
 * VISION MOMENTS — the real passes the Vision training drill asks about.
 *
 *   npx tsx scripts/vision/build_vision_moments.mts
 *
 * Reads data/realmoments/tracked.json + tracks.json (real tracking: every
 * man where he really stood; read data/realmoments/README.md) and writes
 * lib/star/data/visionMoments.json: one row per REAL PASS in the seconds
 * before a real shot. For each: where everyone stood when the pass was
 * played, who played it (you, in the drill), and who it went to (the right
 * answer: the man the real player actually picked).
 *
 * How a pass is found in the ball's track: the ball moving 8+ m/s for 0.3 s
 * or more (the same idea as passesInTrack, a touch looser so softer real
 * passes count). Every such pass before the shot is used when:
 *   - one of the shooter's side was on the ball when it started (≤ 2.5 m),
 *   - another of his side was on the end of it (≤ 3.5 m from where it stopped),
 *   - it stayed low (a ground pass: never above 1.6 m; the drill's kick is a
 *     ground pass), and was 5 to 40 m long.
 * Each pass is kept twice when it can be: at the frame it was played, and
 * 0.6 s before while the passer still had it at his feet (a REAL frame too:
 * runners are mid-run, which is where most offside pictures come from).
 * Nothing is placed or moved: positions are the tracking's, rounded to 0.1 m.
 * Men more than 45 m from the ball are left out (never in the picture),
 * except their keeper and their deepest outfield man (the offside line).
 *
 * Credit: every row keeps its source (dfl / skillcorner / soccertrack); the
 * drill shows the matching line from lib/star/dataCredits.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";

type Side = "you" | "mate" | "opp" | "keeper";
interface Track { t0: number; dt: number; ball: number[]; men: (string | number)[][] }
interface Moment { id: string; src: string; comp: string; match: string; minute: number; player: string; team: string; opp: string; type: string; what?: string }

const tracked = JSON.parse(readFileSync("data/realmoments/tracked.json", "utf8")) as { moments: Moment[] };
const tracks = (JSON.parse(readFileSync("data/realmoments/tracks.json", "utf8")) as { tracks: Record<string, Track> }).tracks;

const r1 = (v: number) => Math.round(v * 10) / 10;
const PASS_SPEED = 8;     // m/s
const PASS_MIN_S = 0.3;
const PASSER_R = 2.5;
const RECEIVER_R = 3.5;
const MAX_Z = 1.6;

export interface VisionMomentRow {
  id: string;
  src: string;
  comp: string;
  match: string;
  minute: number;
  team: string;
  opp: string;
  /** The real passer (you, in the drill). */
  passer: string;
  /** The real man it went to (the right answer). */
  to: string;
  /** The ball at the pass. */
  ball: [number, number];
  /** Team-mates (not the passer, not your keeper): [x, y]. */
  mates: [number, number][];
  /** Their names, same order. */
  names: string[];
  /** Index into `mates` of the man the real pass went to. */
  real: number;
  /** Their outfield men: [x, y]. */
  opps: [number, number][];
  /** Their keeper. */
  keeper: [number, number];
  /** Where the real pass ended, and how long it took (s). */
  end: [number, number];
  passS: number;
}

const rows: VisionMomentRow[] = [];
let shots = 0;
for (const m of tracked.moments) {
  if (m.what !== "shot" || m.type !== "Open Play") continue;
  const tr = tracks[m.id];
  if (!tr) continue;
  shots++;
  const n = tr.ball.length / 3;
  const ball = Array.from({ length: n }, (_, i) => ({ x: tr.ball[i * 3], y: tr.ball[i * 3 + 1], z: tr.ball[i * 3 + 2] || 0 }));
  const men = tr.men.map((row) => ({
    side: row[0] as Side, name: String(row[1] ?? ""),
    at: (i: number) => ({ x: Number(row[2 + i * 2]), y: Number(row[3 + i * 2]) }),
  }));
  // Passes in the ball's track.
  const passes: [number, number][] = [];
  let s0: number | null = null;
  for (let i = 1; i < n; i++) {
    const v = Math.hypot(ball[i].x - ball[i - 1].x, ball[i].y - ball[i - 1].y) / tr.dt;
    if (v >= PASS_SPEED && s0 === null) s0 = i - 1;
    if (v < PASS_SPEED && s0 !== null) { if ((i - 1 - s0) * tr.dt >= PASS_MIN_S) passes.push([s0, i - 1]); s0 = null; }
  }
  // The shot itself runs to the last frame: a pass must end before it.
  const before = passes.filter(([, e]) => e < n - 2);
  const nearest = (i: number, p: { x: number; y: number }) => {
    let k = -1, d = 1e9;
    men.forEach((mm, j) => { const q = mm.at(i); const dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < d) { d = dd; k = j; } });
    return { k, d };
  };
  const ours = (s: Side) => s === "mate" || s === "you";
  const oppKeeper = men.find((mm) => mm.side === "keeper");
  if (!oppKeeper) continue;
  before.forEach(([i0, i1], pi) => {
    const from = nearest(i0, ball[i0]);
    const toAt = Math.min(n - 1, i1 + 1);
    const to = nearest(toAt, ball[i1]);
    if (from.d > PASSER_R || to.d > RECEIVER_R) return;
    if (!ours(men[from.k].side) || !ours(men[to.k].side) || from.k === to.k) return;
    let maxZ = 0;
    for (let i = i0; i <= i1; i++) maxZ = Math.max(maxZ, ball[i].z);
    if (maxZ > MAX_Z) return;
    const len = Math.hypot(ball[i1].x - ball[i0].x, ball[i1].y - ball[i0].y);
    if (len < 5 || len > 40) return;
    // The frame of the pass, and 0.6 s before it while he still had it.
    for (const back of [0, 3]) {
      const f = i0 - back;
      if (f < 0) continue;
      const b0 = ball[f];
      const at = men[from.k].at(f);
      if (back > 0 && Math.hypot(at.x - b0.x, at.y - b0.y) > 1.6) continue;
      const mates: [number, number][] = [];
      const names: string[] = [];
      let real = -1;
      men.forEach((mm, j) => {
        if (j === from.k || !ours(mm.side)) return;
        const p = mm.at(f);
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        // Your own keeper, and anyone miles away, is never an option.
        if (p.y > 75 || Math.hypot(p.x - b0.x, p.y - b0.y) > 45) return;
        if (j === to.k) real = mates.length;
        mates.push([r1(p.x), r1(p.y)]);
        names.push(mm.name);
      });
      if (real < 0) continue;
      const theirs = men.filter((mm) => mm.side === "opp").map((mm) => mm.at(f))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      const deepest = theirs.reduce((a, p) => (p.y < a ? p.y : a), Infinity);
      const opps = theirs
        .filter((p) => Math.hypot(p.x - b0.x, p.y - b0.y) <= 45 || p.y === deepest)
        .map((p) => [r1(p.x), r1(p.y)] as [number, number]);
      const kp = oppKeeper.at(f);
      rows.push({
        id: `v${m.id}-${pi}${back ? "b" : ""}`, src: m.src, comp: m.comp, match: m.match, minute: m.minute, team: m.team, opp: m.opp,
        passer: men[from.k].name, to: men[to.k].name,
        ball: [r1(b0.x), r1(b0.y)], mates, names, real, opps, keeper: [r1(kp.x), r1(kp.y)],
        end: [r1(ball[i1].x), r1(ball[i1].y)], passS: r1((i1 - i0) * tr.dt),
      });
    }
  });
}

rows.sort((a, b) => a.id.localeCompare(b.id));
const out = {
  note: "Real passes that led straight to a real shot, for the Vision training drill. Made by scripts/vision/build_vision_moments.mts from data/realmoments (tracking). Positions: our pitch metres, x 0..68 from the attacking team's left, y from the goal they attack. Do not edit by hand: re-run the script.",
  moments: rows,
};
// One moment per line: small diffs, readable.
const text = `{\n  "note": ${JSON.stringify(out.note)},\n  "moments": [\n${rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]\n}\n`;
writeFileSync("lib/star/data/visionMoments.json", text);
const bySrc: Record<string, number> = {};
for (const r of rows) bySrc[r.src] = (bySrc[r.src] ?? 0) + 1;
console.log(`${shots} open-play shots with tracking → ${rows.length} real passes kept`, bySrc, `${(text.length / 1024).toFixed(0)} KB`);
