/**
 * Turn real StatsBomb moments into the game's own scenarios — TESTING ONLY.
 *
 * Each real moment becomes { kind, seed, override }: the engine builds its own
 * chance of that kind from the seed, and the override puts the REAL people on
 * top of it — the shooter is you, the ball is at his feet, the keeper is where
 * the real keeper stood, and every real defender and team-mate inside the
 * camera replaces the made-up ones. Same format the gallery saves, so Play
 * runs the real engine on it with nothing new.
 *
 * Usage: npx tsx tools/statsbomb/convert.mts DATA_DIR
 * Reads  DATA_DIR/pl1516-shots.jsonl and DATA_DIR/kane-moments.jsonl
 * Writes DATA_DIR/real-moments.json (the file the dev page loads)
 * Prints the numbers: how many converted, by kind, faults, xG band.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildScenario, goalInView, VIEW_ASPECT, type ScenarioKind, type Vec2, type Viewport } from "../../lib/star/canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "../../lib/star/scenarioEdit";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { scenarioFaults } from "../../lib/star/baseScenario";
import { mulberry32 } from "../../lib/star/season";
import type { RealMoment } from "../../lib/star/realMoments";
import { CX, PITCH_W, POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";

const dir = process.argv[2] ?? "sb-data";

// StatsBomb: 120 x 80 yards, attacking towards x = 120, y = 0 on the
// attacker's left. Game: metres, goal line at y = 0, x = 0 on the left.
const toGame = ([sx, sy]: number[]): Vec2 => ({ x: sy * PITCH_W / 80, y: (120 - sx) * 105 / 120 });
const r2 = (v: number) => Math.round(v * 100) / 100;
const rv = (v: Vec2): Vec2 => ({ x: r2(v.x), y: r2(v.y) });

interface Person { at: Vec2; mate: boolean; keeper: boolean }

/** A 5:8 frame (the game's) holding the goal, the ball and the keeper. */
function cameraFor(ball: Vec2, keeper: Vec2 | null, goal: boolean): Viewport {
  const pts = [ball, ...(keeper ? [keeper] : [])];
  if (goal) pts.push({ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH });
  const pad = 4;
  let x1 = Math.min(...pts.map(p => p.x)) - pad, x2 = Math.max(...pts.map(p => p.x)) + pad;
  let y1 = Math.min(...pts.map(p => p.y)) - pad * 0.875, y2 = Math.max(...pts.map(p => p.y)) + pad * 0.875 + 6;
  const h = Math.min(42, Math.max(28, y2 - y1, (x2 - x1) / VIEW_ASPECT));
  const w = h * VIEW_ASPECT;
  const cx = (x1 + x2) / 2;
  // Hang the frame from the goal when it is in shot, as the game does.
  y1 = goal ? -NET_DEPTH - 2 : (y1 + y2) / 2 - h / 2;
  if (goal && ball.y + pad > y1 + h) y1 = ball.y + pad - h;
  return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
}

/**
 * Which of the game's chance kinds holds this moment. The kind is the engine's
 * container (camera rules, fault rules); the people are the real ones either
 * way. A close, crowded shot has no kind of its own, so it goes in "volley" —
 * the one close-range kind whose definition is only "inside 18m".
 */
function kindFor(ball: Vec2, technique: string | undefined, blockers: number): ScenarioKind {
  if (ball.y >= 17) return "long_range";
  if (Math.abs(ball.x - CX) >= 9 && ball.y <= 15) return "tight_angle";
  if (technique === "Volley" || technique === "Half Volley") return "volley";
  return blockers === 0 ? "one_on_one" : "volley";
}

function convert(id: string, source: RealMoment["source"], ballAt: Vec2, people: Person[], technique: string | undefined,
  meta: RealMoment["meta"], forceKind?: ScenarioKind): RealMoment | null {
  const keeperP = people.find(p => p.keeper && !p.mate);
  const opps = people.filter(p => !p.mate && !p.keeper);
  const mates = people.filter(p => p.mate && !p.keeper);
  // A one-on-one means nobody goal-side of the ball in the middle (baseScenario.ts).
  const blockers = opps.filter(o => o.at.y < ballAt.y - 0.5 && Math.abs(o.at.x - CX) <= 14).length;
  const kind = forceKind ?? kindFor(ballAt, technique, blockers);
  const goal = goalInView(kind);
  const seed = Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);
  const camera = cameraFor(ballAt, keeperP?.at ?? null, goal);
  const inside = (p: Vec2) => p.x > camera.x1 + 0.8 && p.x < camera.x2 - 0.8 && p.y > camera.y1 + 0.8 && p.y < camera.y2 - 0.8;

  const ov: PosOverride = { items: {}, removed: [], added: [], camera, ball: rv(ballAt) };
  for (const it of frame.items) if (it.removable) ov.removed!.push(it.id);
  const keeperItem = frame.items.find(it => it.keeper)!;
  const youItem = frame.items.find(it => it.side === "you")!;
  // The real keeper; with none in the frame he stays where the engine put him.
  if (keeperP) ov.items[keeperItem.id] = rv(keeperP.at);
  // You stand just behind the ball, on the side away from goal.
  const away = { x: ballAt.x - CX, y: ballAt.y };
  const len = Math.hypot(away.x, away.y) || 1;
  ov.items[youItem.id] = rv({ x: ballAt.x + away.x / len * 0.9, y: ballAt.y + away.y / len * 0.9 });
  let n = 0;
  for (const p of [...opps, ...mates]) {
    if (!inside(p.at) || Math.hypot(p.at.x - ballAt.x, p.at.y - ballAt.y) < 0.6) continue;
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: p.mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(p.at);
  }
  // Judge the picture the way the gallery does: on a real scenario with the
  // override applied.
  const judged = buildScenario(kind, mulberry32(seed));
  applyOverrideToScenario(judged, ov);
  return { id, source, kind, seed, override: ov, meta, faults: scenarioFaults(judged) };
}

const lines = (f: string) => readFileSync(join(dir, f), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));

const out: RealMoment[] = [];
const skipped: Record<string, number> = {};
const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };

for (const s of lines("pl1516-shots.jsonl")) {
  if (s.type === "Penalty") { skip("penalty"); continue; }
  if (s.type === "Free Kick") { skip("direct free kick"); continue; }
  if (s.type === "Corner") { skip("direct corner"); continue; }
  if (s.body === "Head") { skip("header (headers are switched off)"); continue; }
  if (!s.frame?.length) { skip("no freeze frame"); continue; }
  const people: Person[] = s.frame.map((f: { loc: number[]; mate: boolean; pos: string }) =>
    ({ at: toGame(f.loc), mate: f.mate, keeper: f.pos === "Goalkeeper" }));
  const m = convert(`pl-${s.id}`, "pl1516", toGame(s.loc), people, s.technique, {
    player: s.player, team: s.team, match: `${s.home} v ${s.away}`, minute: s.minute,
    xg: s.xg, outcome: s.outcome, body: s.body, technique: s.technique, what: "shot",
  });
  if (m) out.push(m);
}

// Kane: every touch (receipt) and shot with a 360 frame. Near goal it is a
// shooting chance; further out it is a midfield pass with what he could see.
for (const k of lines("kane-moments.jsonl")) {
  if (!k.frame360 || !k.loc) { skip("Kane: no 360 frame"); continue; }
  if (k.kind === "shot" && k.type !== "Open Play") { skip("Kane: set-piece shot"); continue; }
  const ball = toGame(k.loc);
  const people: Person[] = k.frame360.people.filter((p: { actor: boolean }) => !p.actor)
    .map((p: { loc: number[]; mate: boolean; keeper: boolean }) => ({ at: toGame(p.loc), mate: p.mate, keeper: p.keeper }));
  const far = Math.hypot(ball.x - CX, ball.y) > 30;
  const m = convert(`kane-${k.id}`, "kane", ball, people, k.technique, {
    player: "Harry Kane", team: "England", match: k.comp, minute: k.minute, xg: k.xg, outcome: k.outcome,
    body: k.body, technique: k.technique, what: k.kind === "shot" ? "shot" : "touch",
  }, far ? "midfield_pass" : undefined);
  if (m) out.push(m);
}

writeFileSync(join(dir, "real-moments.json"), JSON.stringify(out));

// ── The numbers ──
const pl = out.filter(m => m.source === "pl1516");
const by = (xs: RealMoment[], f: (m: RealMoment) => string) => {
  const c: Record<string, number> = {};
  for (const x of xs) c[f(x)] = (c[f(x)] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");
};
const band = pl.filter(m => (m.meta.xg ?? 0) >= 0.08 && (m.meta.xg ?? 0) <= 0.5);
// "Attacker offside" is not a fault in a real SHOT picture: offside is judged
// when the ball is played to him, and in the game it still is.
const real = (m: RealMoment) => m.faults.filter(f => f !== "attacker offside");
const clean = (xs: RealMoment[]) => xs.filter(m => real(m).length === 0).length;
const pct = (a: number, b: number) => `${(100 * a / Math.max(1, b)).toFixed(1)}%`;
console.log(`skipped: ${by(Object.entries(skipped).flatMap(([k, v]) => Array(v).fill({ k })) as never, (x: never) => (x as { k: string }).k)}`);
console.log(`PL converted: ${pl.length}  by kind: ${by(pl, m => m.kind)}`);
console.log(`PL in the 8-50% xG band: ${band.length} (${pct(band.length, pl.length)})`);
console.log(`PL with no faults: ${clean(pl)} (${pct(clean(pl), pl.length)}); in band: ${clean(band)}`);
console.log(`PL faults: ${by(pl.flatMap(m => m.faults.map(f => ({ ...m, f }))) as never, (x: never) => (x as { f: string }).f)}`);
const goals = pl.filter(m => m.meta.outcome === "Goal").length;
console.log(`PL real conversion: ${pct(goals, pl.length)} (${goals} goals); mean xG ${(pl.reduce((a, m) => a + (m.meta.xg ?? 0), 0) / pl.length).toFixed(3)}`);
const kane = out.filter(m => m.source === "kane");
console.log(`Kane converted: ${kane.length} (${by(kane, m => `${m.meta.what}/${m.kind}`)}); no faults ${clean(kane)}`);
const people = pl.map(m => m.override.added!.length);
console.log(`people in frame per PL moment: mean ${(people.reduce((a, b) => a + b, 0) / people.length).toFixed(1)}`);
