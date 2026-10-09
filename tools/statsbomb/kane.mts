/**
 * Harry Kane's real moments → the game's drawings.
 *
 * Mikey, 9 Oct 2026: "creating a lot of scenarios for each type of
 * scenario ... based upon the actual data ... games that Harry Kane is in
 * where he gets touches or shots or passes or assists ... the players on his
 * team ... and the opposition, their positions ... build it for kane only."
 *
 * Reads kane-recent.jsonl (tools/statsbomb/fetch_kane.py: 21 matches, Euro
 * 2020, World Cup 2022, Euro 2024, Bayern v Leverkusen 2023/24) and writes
 * public/star/kane-moments.json, which the game deals from when Settings →
 * Match → "Kane drawings (testing)" is New.
 *
 * Each of Kane's passes and shots becomes one drawing:
 *   - Kane is YOU, the ball at his feet.
 *   - Every team-mate and opponent the camera saw, inside the frame, stands
 *     where he stood. Nobody the camera didn't see is invented.
 *   - A pass: the team-mate nearest where the ball went is the man you are
 *     playing in (the chance's target), running to where it actually went.
 *   - The kind comes from where it happened and what he did with it.
 * Skipped: crosses (13; a cross is watched side-on, a different camera),
 * headers (switched off in the game), set-piece shots, and Kane's other touches (each is the same moment as the
 * pass or shot right after it).
 *
 * Usage: npx tsx tools/statsbomb/kane.mts DATA_DIR
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildScenario, goalInView, VIEW_ASPECT, type ScenarioKind, type Vec2, type Viewport } from "../../lib/star/canvasEngine";
import { type PosOverride } from "../../lib/star/scenarioEdit";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { mulberry32 } from "../../lib/star/season";
import { buildKaneMoment, type KaneMoment } from "../../lib/star/kaneMoments";
import { CX, PITCH_W, POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";

const dir = process.argv[2] ?? "sb-data";
const toGame = ([sx, sy]: number[]): Vec2 => ({ x: sy * PITCH_W / 80, y: (120 - sx) * 105 / 120 });
const r2 = (v: number) => Math.round(v * 100) / 100;
const rv = (v: Vec2): Vec2 => ({ x: r2(v.x), y: r2(v.y) });
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** A 5:8 frame (the game's) around the play: ball, target, and the goal when it is in view. */
function cameraFor(ball: Vec2, pts: Vec2[], goal: boolean): Viewport {
  const all = [ball, ...pts];
  if (goal) all.push({ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH });
  const pad = 5;
  const x1 = Math.min(...all.map((p) => p.x)) - pad, x2 = Math.max(...all.map((p) => p.x)) + pad;
  const y1 = Math.min(...all.map((p) => p.y)) - pad, y2 = Math.max(...all.map((p) => p.y)) + pad + 4;
  const h = Math.min(42, Math.max(28, y2 - y1, (x2 - x1) / VIEW_ASPECT));
  const w = h * VIEW_ASPECT;
  // You are always in the picture: when the play is wider or deeper than the
  // frame, it slides to keep the ball (and you) 4 m inside, and the far end
  // of the pass is what falls outside.
  const keep = 4;
  let left = (x1 + x2) / 2 - w / 2;
  left = Math.min(Math.max(left, ball.x + keep - w), ball.x - keep);
  let top = goal ? -NET_DEPTH - 2 : (y1 + y2) / 2 - h / 2;
  if (!goal) top = Math.min(Math.max(top, ball.y + keep + 2 - h), ball.y - keep);
  return { x1: r2(left), x2: r2(left + w), y1: r2(top), y2: r2(top + h) };
}

interface Raw {
  id: string; comp: string; match: string; minute: number; kind: "pass" | "shot" | "touch";
  loc: number[]; end?: number[]; outcome?: string; assist?: boolean; through?: boolean; cross?: boolean;
  cutback?: boolean; xg?: number; type?: string; body?: string; technique?: string;
  people: { loc: number[]; mate: boolean; keeper: boolean; actor: boolean }[];
}

function kindOf(r: Raw, ball: Vec2, end: Vec2 | null): ScenarioKind | null {
  const lat = Math.abs(ball.x - CX);
  if (r.kind === "shot") {
    if (r.type && r.type !== "Open Play") return null;
    // Headers are switched off in the game (lib/star/switchedOffKinds.ts).
    if (r.body === "Head") return null;
    if (ball.y >= 17) return "long_range";
    if (lat >= 9 && ball.y <= 15) return "tight_angle";
    return "one_on_one";
  }
  if (r.kind !== "pass" || r.cross) return null;
  if (ball.y > 52) return "buildup";
  if (ball.y <= 18) return "cutback";
  // A through ball's picture hangs from the goal (42 m at most), so it only
  // holds you up to about 33 m out; from deeper it is a midfield pass.
  if (ball.y <= 33 && (r.through || (end && end.y < ball.y - 8 && end.y < 35))) return "through_ball";
  return "midfield_pass";
}

const out: KaneMoment[] = [];
const skipped: Record<string, number> = {};
const skip = (w: string) => { skipped[w] = (skipped[w] ?? 0) + 1; };

for (const line of readFileSync(join(dir, "kane-recent.jsonl"), "utf8").split("\n").filter(Boolean)) {
  const r: Raw = JSON.parse(line);
  if (r.kind === "touch") { skip("touch (same moment as the pass or shot after it)"); continue; }
  const ball = toGame(r.loc);
  const end = r.end ? toGame(r.end) : null;
  const kind = kindOf(r, ball, end);
  if (!kind) { skip(r.cross ? "cross" : r.body === "Head" ? "header" : "set-piece shot"); continue; }
  const people = r.people.filter((p) => !p.actor).map((p) => ({ at: toGame(p.loc), mate: p.mate, keeper: p.keeper }));
  const keeperP = people.find((p) => p.keeper && !p.mate);
  const mates = people.filter((p) => p.mate && !p.keeper);
  const opps = people.filter((p) => !p.mate && !p.keeper);

  const seed = Math.abs([...r.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);
  const goal = goalInView(kind);

  // The man he is playing in: the team-mate nearest where the ball went.
  let target: Vec2 | null = null;
  if (sc.runner && end) {
    const near = mates.filter((m) => dist(m.at, end) < 14).sort((a, b) => dist(a.at, end) - dist(b.at, end))[0];
    target = near ? near.at : end;
  }
  const camera = cameraFor(ball, [...(target ? [target] : []), ...(end && sc.runner ? [end] : []),
    ...(goal && keeperP ? [keeperP.at] : [])], goal);
  const inside = (p: Vec2) => p.x > camera.x1 + 0.8 && p.x < camera.x2 - 0.8 && p.y > camera.y1 + 0.8 && p.y < camera.y2 - 0.8;

  const ov: PosOverride = { items: {}, removed: [], added: [], camera, ball: rv(ball) };
  // Everyone the builder made goes, except the target (moved onto the real man).
  // frameFromScenario pushes the defenders, then the keeper, then the runner.
  const runnerItem = sc.runner ? frame.items[sc.defenders.length + 1] : undefined;
  for (const it of frame.items) if (it.removable && it !== runnerItem) ov.removed!.push(it.id);
  if (runnerItem && target) ov.items[runnerItem.id] = rv(target);
  else if (runnerItem) ov.removed!.push(runnerItem.id);
  const keeperItem = frame.items.find((it) => it.keeper)!;
  if (keeperP && goal) ov.items[keeperItem.id] = rv(keeperP.at);
  const youItem = frame.items.find((it) => it.side === "you")!;
  // You stand just behind the ball, on the side away from where it is going.
  const aim = end ?? { x: CX, y: 0 };
  const back = { x: ball.x - aim.x, y: ball.y - aim.y };
  const bl = Math.hypot(back.x, back.y) || 1;
  ov.items[youItem.id] = rv({ x: ball.x + back.x / bl * 0.9, y: ball.y + back.y / bl * 0.9 });
  let n = 0;
  for (const p of [...opps, ...mates]) {
    if (!inside(p.at) || dist(p.at, ball) < 0.6) continue;
    if (target && p.mate && dist(p.at, target) < 0.01) continue;
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: p.mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(p.at);
  }

  const m: KaneMoment = {
    id: `kane-${r.id}`, kind, seed, override: ov,
    runnerTo: sc.runner && end ? rv(end) : undefined,
    meta: {
      comp: r.comp, match: r.match, minute: r.minute,
      what: r.kind === "shot" ? `shot · ${r.outcome}` : r.assist ? "pass · assist" : `pass · ${r.outcome === "Complete" ? "complete" : "incomplete"}`,
      xg: r.xg,
    },
    faults: [],
  };
  m.faults = scenarioFaults(buildKaneMoment(m)).filter((f) => f !== "attacker offside");
  out.push(m);
}

writeFileSync(join(process.cwd(), "public/star/kane-moments.json"), JSON.stringify({ source: "StatsBomb open data (free): Euro 2020, World Cup 2022, Euro 2024, Bundesliga 2023/24 (Bayern v Leverkusen). Testing only.", moments: out }));

const by: Record<string, number> = {};
for (const m of out) by[m.kind] = (by[m.kind] ?? 0) + 1;
console.log(`Kane drawings: ${out.length}  by kind: ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`skipped: ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(", ")}`);
const faulty = out.filter((m) => m.faults.length);
const fc: Record<string, number> = {};
for (const m of faulty) for (const f of m.faults) fc[f] = (fc[f] ?? 0) + 1;
console.log(`with a fault the gallery would flag: ${faulty.length} (${Object.entries(fc).map(([k, v]) => `${k} ${v}`).join(", ") || "none"})`);
const ppl = out.map((m) => m.override.added!.length);
console.log(`people in a drawing: mean ${(ppl.reduce((a, b) => a + b, 0) / ppl.length).toFixed(1)}; targets on a real team-mate: ${out.filter((m) => m.runnerTo).length}`);
