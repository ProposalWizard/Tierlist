/**
 * Real strikers' moments → the game's drawings ("Kane drawings").
 *
 * Mikey, 9 Oct 2026: first Kane only; then "yes do this but only use
 * strikers", with Kane dealt more often. Reads strikers.jsonl
 * (tools/statsbomb/fetch_strikers.py: every free StatsBomb set with 360
 * frames) and writes public/star/kane-moments.json, which the game deals from
 * when Settings → Match → "Kane drawings (testing)" is New.
 *
 * Each striker's pass or shot becomes one drawing: he is YOU, the ball at his
 * feet; every team-mate and opponent the camera saw near the play stands
 * where he stood. A pass's target is the real team-mate nearest where it went.
 *
 * The drawing rules (Mikey's notes on the first 376 Kane drawings):
 *   - A ball from the byline is a byline cross, watched side-on.
 *   - Any chance at goal shows the WHOLE goal, with a little room behind it,
 *     and the frame ends a few metres below you (no empty pitch). A moment
 *     whose goal and ball can't both fit is dropped.
 *   - No opponent within GAP of the ball or you: the ball is always seen.
 *     Nobody stands on top of anybody else.
 *   - Moments where he was surrounded and the pass or shot failed are dropped
 *     (the only real way out was a dribble).
 *   - Each drawing is graded easy / normal / hard from the space he had and
 *     whether the real pass or shot worked; the game deals 50 / 35 / 15.
 *
 * Usage: npx tsx tools/statsbomb/kane.mts DATA_DIR
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildScenario, crossViewportOnBall, goalInView, VIEW_ASPECT, type ScenarioKind, type Vec2, type Viewport } from "../../lib/star/canvasEngine";
import { type PosOverride } from "../../lib/star/scenarioEdit";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { mulberry32 } from "../../lib/star/season";
import { buildKaneMoment, type KaneGrade, type KaneMoment } from "../../lib/star/kaneMoments";
import { CX, PITCH_W, POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";

const dir = process.argv[2] ?? "sb-data";
const toGame = ([sx, sy]: number[]): Vec2 => ({ x: sy * PITCH_W / 80, y: (120 - sx) * 105 / 120 });
const r2 = (v: number) => Math.round(v * 100) / 100;
const rv = (v: Vec2): Vec2 => ({ x: r2(v.x), y: r2(v.y) });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Opponents keep at least this far from the ball and from you. */
const GAP = 2.8;
/** Nobody stands closer than this to anybody else. */
const BODY = 1.1;
/** Other strikers' drawings kept per kind and grade (Kane's are all kept). */
const KEEP: Record<KaneGrade, number> = { easy: 90, normal: 65, hard: 35 };

/** The frame for a chance at goal: the whole goal plus a little behind it, ending
 *  a few metres below the ball. null when goal and ball can't share a frame. */
function goalCamera(ball: Vec2, extra: Vec2[]): Viewport | null {
  const top = -NET_DEPTH - 1.5;
  const want = Math.max(ball.y + 6, ...extra.map((p) => p.y + 3));
  // Wide enough for both posts (1 m in) and the ball (3 m in).
  const span = Math.max(ball.x + 3, POST_R + 1) - Math.min(ball.x - 3, POST_L - 1);
  const h = Math.min(40, Math.max(24, want - top, span / VIEW_ASPECT));
  if (ball.y + 3 > top + h) return null;
  const w = h * VIEW_ASPECT;
  // left must keep both posts 1 m in and the ball 3 m in.
  const lo = Math.max(POST_R + 1 - w, ball.x + 3 - w);
  const hi = Math.min(POST_L - 1, ball.x - 3);
  if (lo > hi) return null;
  const xs = [ball.x, ...extra.map((p) => p.x), POST_L, POST_R];
  const left = Math.min(Math.max((Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, lo), hi);
  return { x1: r2(left), x2: r2(left + w), y1: r2(top), y2: r2(top + h) };
}

/** The frame for a pass away from goal: the ball and target, tight. */
function playCamera(ball: Vec2, pts: Vec2[]): Viewport {
  const all = [ball, ...pts];
  const pad = 4;
  const x1 = Math.min(...all.map((p) => p.x)) - pad, x2 = Math.max(...all.map((p) => p.x)) + pad;
  const y1 = Math.min(...all.map((p) => p.y)) - pad, y2 = Math.max(...all.map((p) => p.y)) + pad + 3;
  const h = Math.min(36, Math.max(24, y2 - y1, (x2 - x1) / VIEW_ASPECT));
  const w = h * VIEW_ASPECT;
  const keep = 4;
  let left = (x1 + x2) / 2 - w / 2;
  left = Math.min(Math.max(left, ball.x + keep - w), ball.x - keep);
  let top = (y1 + y2) / 2 - h / 2;
  // At least 11 m of pitch above you (the view squashes the far end, and
  // figures drawn standing up lose their heads at the top edge).
  top = Math.min(Math.max(top, ball.y + keep + 2 - h), ball.y - 11);
  return { x1: r2(left), x2: r2(left + w), y1: r2(top), y2: r2(top + h) };
}

interface Raw {
  id: string; comp: string; match: string; minute: number; player?: string; kane?: boolean; kind: "pass" | "shot" | "touch";
  loc: number[]; end?: number[]; outcome?: string; assist?: boolean; through?: boolean; cross?: boolean;
  cutback?: boolean; xg?: number; type?: string; body?: string; technique?: string; pressure?: boolean;
  people: { loc: number[]; mate: boolean; keeper: boolean; actor: boolean }[];
}

function kindOf(r: Raw, ball: Vec2, end: Vec2 | null): ScenarioKind | null {
  const lat = Math.abs(ball.x - CX);
  if (r.kind === "shot") {
    if (r.type && r.type !== "Open Play") return null;
    if (r.body === "Head") return null;           // headers are switched off in the game
    if (ball.y >= 17) return "long_range";
    if (lat >= 9 && ball.y <= 15) return "tight_angle";
    return "one_on_one";
  }
  if (r.kind !== "pass") return null;
  // From the byline into the box: a byline cross, watched side-on.
  if (ball.y <= 10 && lat >= 12 && end && end.y < 18 && Math.abs(end.x - CX) < 20) return "byline_cross";
  if (r.cross) return null;
  if (ball.y > 52) return "buildup";
  if (ball.y <= 18) return "cutback";
  if (ball.y <= 33 && (r.through || (end && end.y < ball.y - 8 && end.y < 35))) return "through_ball";
  return "midfield_pass";
}

/** Opponents in the way of a shot: inside the triangle ball → both posts. */
function blockers(ball: Vec2, opps: Vec2[]): number {
  const a1 = Math.atan2(-ball.y, POST_L - ball.x), a2 = Math.atan2(-ball.y, POST_R - ball.x);
  const lo = Math.min(a1, a2) - 0.08, hi = Math.max(a1, a2) + 0.08;
  return opps.filter((o) => { const a = Math.atan2(o.y - ball.y, o.x - ball.x); return a > lo && a < hi && o.y < ball.y; }).length;
}

const SHOT_WORKED = new Set(["Goal", "Saved", "Saved To Post", "Post"]);
const out: KaneMoment[] = [];
const skipped: Record<string, number> = {};
const skip = (w: string) => { skipped[w] = (skipped[w] ?? 0) + 1; };
const file = process.argv[3] ?? "strikers.jsonl";

for (const line of readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean)) {
  const r: Raw = JSON.parse(line);
  if (r.kind === "touch") continue;
  const ball = toGame(r.loc);
  const end = r.end ? toGame(r.end) : null;
  const kind = kindOf(r, ball, end);
  if (!kind) { skip(r.cross ? "cross not from the byline" : r.body === "Head" ? "header" : r.kind === "shot" ? "set-piece shot" : "other"); continue; }
  const people = r.people.filter((p) => !p.actor).map((p) => ({ at: toGame(p.loc), mate: p.mate, keeper: p.keeper }));
  const keeperP = people.find((p) => p.keeper && !p.mate);
  const mates = people.filter((p) => p.mate && !p.keeper);
  const opps = people.filter((p) => !p.mate && !p.keeper);

  // How much room he had, and whether the real pass or shot worked.
  const near = opps.map((o) => dist(o.at, ball)).sort((a, b) => a - b);
  const nearest = near[0] ?? 99;
  const crowd = near.filter((d) => d < 2.5).length;
  const worked = r.kind === "shot" ? SHOT_WORKED.has(r.outcome ?? "") : r.outcome === "Complete";
  const inWay = r.kind === "shot" ? blockers(ball, opps.map((o) => o.at)) : 0;
  if (crowd >= 3 || (crowd >= 2 && !worked)) { skip("surrounded (only a dribble out)"); continue; }
  if (r.kind === "shot" && inWay >= 4) { skip("goal blocked by a wall of bodies"); continue; }
  const grade: KaneGrade = !worked || nearest < 1.6 || inWay >= 3 ? "hard"
    : nearest >= 3 && inWay <= 1 ? "easy" : "normal";

  const seed = Math.abs([...r.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);

  let target: Vec2 | null = null;
  if (sc.runner && end) {
    const m = mates.filter((t) => dist(t.at, end) < 14).sort((a, b) => dist(a.at, end) - dist(b.at, end))[0];
    target = m ? m.at : end;
  }
  let camera: Viewport | null;
  let facing: PosOverride["facing"];
  if (kind === "byline_cross") {
    const side = ball.x >= CX ? 1 : -1;
    camera = crossViewportOnBall(ball, side);
    facing = side > 0 ? "right" : "left";
  } else if (goalInView(kind)) {
    camera = goalCamera(ball, target ? [target] : []);
  } else {
    camera = playCamera(ball, [...(target ? [target] : []), ...(end && sc.runner ? [end] : [])]);
  }
  if (!camera) { skip("goal and ball don't fit one frame"); continue; }
  const cam = camera;
  const inside = (p: Vec2) => p.x > cam.x1 + 1.2 && p.x < cam.x2 - 1.2 && p.y > cam.y1 + 2.2 && p.y < cam.y2 - 0.8;
  // The target's name tag needs room too.
  if (target && !(target.x > cam.x1 + 2.5 && target.x < cam.x2 - 2.5 && target.y > cam.y1 + 2 && target.y < cam.y2 - 1)) target = null;

  const ov: PosOverride = { items: {}, removed: [], added: [], camera: cam, ball: rv(ball), ...(facing ? { facing } : {}) };
  const runnerItem = sc.runner ? frame.items[sc.defenders.length + 1] : undefined;
  for (const it of frame.items) if (it.removable && it !== runnerItem) ov.removed!.push(it.id);
  if (runnerItem && target) ov.items[runnerItem.id] = rv(target);
  else if (runnerItem) ov.removed!.push(runnerItem.id);
  const keeperItem = frame.items.find((it) => it.keeper)!;
  if (keeperP && goalInView(kind) && inside(keeperP.at)) ov.items[keeperItem.id] = rv(keeperP.at);
  const youItem = frame.items.find((it) => it.side === "you")!;
  const aim = end ?? { x: CX, y: 0 };
  const back = { x: ball.x - aim.x, y: ball.y - aim.y };
  const bl = Math.hypot(back.x, back.y) || 1;
  const you = { x: ball.x + back.x / bl * 0.9, y: ball.y + back.y / bl * 0.9 };
  ov.items[youItem.id] = rv(you);

  // Everybody near the play, with room for the ball and room between bodies.
  const placed: Vec2[] = [ball, you, ...(target ? [target] : []), ...(keeperP && ov.items[keeperItem.id] ? [keeperP.at] : [])];
  let n = 0;
  const others = [...opps, ...mates].filter((p) => !(target && p.mate && dist(p.at, target) < 0.01))
    .filter((p) => dist(p.at, ball) < 32 || (target && dist(p.at, target) < 12))
    .sort((a, b) => dist(a.at, ball) - dist(b.at, ball));
  for (const p of others) {
    let at = { ...p.at };
    if (!p.mate) {
      for (const from of [ball, you]) {
        const d = dist(at, from);
        if (d < GAP) {
          const ux = d > 0.01 ? (at.x - from.x) / d : (CX - from.x) / (Math.hypot(CX - from.x, from.y) || 1);
          const uy = d > 0.01 ? (at.y - from.y) / d : -from.y / (Math.hypot(CX - from.x, from.y) || 1);
          at = { x: from.x + ux * GAP, y: from.y + uy * GAP };
        }
      }
    }
    for (const q of placed) {
      const d = dist(at, q);
      if (d < BODY && d > 0.001) at = { x: q.x + (at.x - q.x) / d * BODY, y: q.y + (at.y - q.y) / d * BODY };
    }
    if (!inside(at) || placed.some((q) => dist(at, q) < BODY * 0.8)) continue;
    if (!p.mate && (dist(at, ball) < GAP - 0.05 || dist(at, you) < GAP - 0.05)) continue;
    placed.push(at);
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: p.mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(at);
  }

  const m: KaneMoment = {
    id: `sb-${r.id}`, kind, seed, override: ov, grade, kane: !!r.kane,
    runnerTo: sc.runner && end && target ? rv(end) : undefined,
    meta: {
      comp: r.comp, match: r.match, minute: r.minute, player: r.player,
      what: r.kind === "shot" ? `shot · ${r.outcome}` : r.assist ? "pass · assist" : `pass · ${worked ? "complete" : "incomplete"}`,
      xg: r.xg,
    },
    faults: [],
  };
  m.faults = scenarioFaults(buildKaneMoment(m)).filter((f) => f !== "attacker offside");
  out.push(m);
}

// Keep every Kane drawing, plus a sensible number of other strikers' per kind
// and grade (a fixed shuffle). The game deals Kane's KANE_WEIGHT times as often.
const rng = mulberry32(2026);
const shuffled = out.map((m) => ({ m, k: rng() })).sort((a, b) => (Number(b.m.kane) - Number(a.m.kane)) || a.k - b.k).map((x) => x.m);
const kept: KaneMoment[] = [];
const count = new Map<string, number>();
for (const m of shuffled) {
  if (m.faults.length) { skip("a fault the gallery would flag"); continue; }
  const key = `${m.kind}|${m.grade}`;
  if (!m.kane) {
    if ((count.get(key) ?? 0) >= KEEP[m.grade!]) continue;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  kept.push(m);
}

writeFileSync(join(process.cwd(), "public/star/kane-moments.json"), JSON.stringify({
  source: "StatsBomb open data (free, 360 frames): strikers in Bundesliga 23/24, La Liga 20/21, Ligue 1 21/22 + 22/23, MLS 2023, World Cup 2022, Euro 2020, Euro 2024, AFCON 2023. Testing only.",
  moments: kept,
}));

const by: Record<string, string> = {};
for (const k of Array.from(new Set(kept.map((m) => m.kind)))) {
  const g = (x: KaneGrade) => kept.filter((m) => m.kind === k && m.grade === x).length;
  by[k] = `${g("easy")}/${g("normal")}/${g("hard")}`;
}
console.log(`made ${out.length}, kept ${kept.length} (Kane ${kept.filter((m) => m.kane).length})`);
console.log(`by kind (easy/normal/hard): ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}`);
const ppl = kept.map((m) => m.override.added!.length);
console.log(`people in a drawing: mean ${(ppl.reduce((a, b) => a + b, 0) / ppl.length).toFixed(1)}`);
