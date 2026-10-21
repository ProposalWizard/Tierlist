/**
 * PLAY3D SAVE RATE PER GAME (Harry, 20 Oct 2026: "Keepers in the 3D minigames
 * are overpowered"; asked what is fair, "about 1 in 3 shots saved").
 *
 * Every fully 3D game with a keeper, played by three bot shooters on the
 * game's own World, its own keeper rating and its own kind of chance:
 *
 *   decent    average skills (60), the side with more room, about a metre
 *             inside the post, normal power
 *   good      80 skills, tight to the post, firmer
 *   careless  50 skills, anywhere across the goal (often at the keeper), any power
 *
 * The count is the real one: of the shots that were going in if nobody
 * touched them (the same ball run on with no keeper), how many the keeper
 * stopped. A shot wide, over or off the woodwork and out is not on target; a
 * shot a defender blocks is left out.
 *
 *   Free Roam          you with the ball 9–20 m out, keeper at Free Roam's rating
 *   Headers & Volleys  the real crosses; the bot runs to the ring and strikes
 *   Wembley            you 8–14 m out (where Wembley men shoot), Wembley's keeper;
 *                      and the real AI men's shots in full 4-man sessions
 *
 * Want: a decent player about 1 in 3 saved (28–38%), a good one clearly fewer,
 * a careless one clearly more. SAVE_N=… sets shots per bot (default 600; Headers
 * & Volleys plays SAVE_N/5 sessions of ten crosses), SAVE_GAME=free|headers|wembley
 * runs one game.
 *
 * Measured (B16, 20 Oct 2026), saved of on-target, before → after the keeper change
 * (lib/star/play3d/keeper.ts), every game at its own keeper:
 *   Free Roam (66)           decent 70% → 33%, good 25% → 14%, careless 75% → 56%
 *   Headers & Volleys (66)   decent 52% → 31%, good 37% → 20%, careless 75% → 54%
 *   Wembley, you (70 → 66)   decent 69% → 33%, good 40% → 15%, careless 76% → 55%
 *   Wembley, AI men          60s 45% → 18%, the 80 31% → 11%
 */
import { BALL_R, CX, POST_L, POST_R, STEP, powerFromPull, strikeNumbers } from "../../lib/star/play3d/constants";
import { GOAL, stepBall3d, type Ball3 } from "../../lib/star/play3d/ball";
import { makePlayer, skillsOf } from "../../lib/star/play3d/player";
import { keeperSpot } from "../../lib/star/play3d/keeper";
import { makeRng, type Rng } from "../../lib/star/play3d/rng";
import { World, type WorldEvent } from "../../lib/star/play3d/world";
import { makeFreeRoam } from "../../lib/star/play3d/freeRoam";
import { makeHeadersVolleys } from "../../lib/star/play3d/headersVolleys";
import { makeWembley, WEMBLEY_KEEPER } from "../../lib/star/play3d/wembley";

const N = Number(process.env.SAVE_N ?? 600);

type BotId = "decent" | "good" | "careless";
interface Bot { ov: number; inside: [number, number]; power: [number, number]; anywhere?: boolean; airPull: [number, number] }
const BOTS: Record<BotId, Bot> = {
  decent: { ov: 60, inside: [0.7, 1.4], power: [0.7, 0.85], airPull: [0.04, 0.07] },
  good: { ov: 80, inside: [0.35, 0.8], power: [0.8, 0.95], airPull: [0.03, 0.05] },
  careless: { ov: 50, inside: [0.3, 3.4], power: [0.5, 1.0], anywhere: true, airPull: [0.02, 0.12] },
};
const between = (r: Rng, [a, b]: [number, number]) => a + r() * (b - a);

/** Where the bot aims across the goal line. */
function aimX(bot: Bot, keeperX: number, r: Rng): number {
  if (bot.anywhere) return CX + (r() - 0.5) * 2 * ((POST_R - POST_L) / 2 - 0.3);
  // the side with more room three times in four, the other side the rest
  const room = keeperX < CX - 0.15 ? 1 : keeperX > CX + 0.15 ? -1 : r() < 0.5 ? -1 : 1;
  const side = r() < 0.75 ? room : -room;
  const inside = between(r, bot.inside);
  return side > 0 ? POST_R - inside : POST_L + inside;
}

/** The thumb's pull that buys this power for this man (the 2D game's drag maths). */
const pullFor = (power: number, powerSkill: number) => power * (0.01 / powerFromPull(0.01, powerSkill));

/** Would this ball go in with nobody touching it? */
function ghostIn(b: Ball3): boolean {
  const c = { ...b };
  for (let i = 0; i < 120 * 4; i++) {
    for (const e of stepBall3d(c, STEP, GOAL)) { if (e.kind === "goal") return true; if (e.kind === "byline") return false; }
    if (c.y < -0.5 || c.y > 60) return false;
  }
  return false;
}

interface Tally { on: number; saved: number; goals: number; shots: number; blocked: number }
const tally = (): Tally => ({ on: 0, saved: 0, goals: 0, shots: 0, blocked: 0 });
const saveRate = (t: Tally) => t.saved / Math.max(1, t.on);

/** Step a shot out: "goal" | "saved" | "off" | "blocked". */
function outcome(w: World, onTarget: boolean, shooter: string, done?: () => boolean): "goal" | "saved" | "off" | "blocked" {
  for (let i = 0; i < 120 * 4; i++) {
    const evs: WorldEvent[] = w.drain();
    for (const e of evs) {
      if (e.kind === "goal") return onTarget ? "goal" : "off";
      if (e.kind === "save" || e.kind === "catch") return onTarget ? "saved" : "off";
      if (e.kind === "byline" || e.kind === "out") return "off";
      if (e.kind === "touch" && e.who !== shooter) return onTarget ? "blocked" : "off";
    }
    if (done?.()) return onTarget ? "blocked" : "off";
    w.step(STEP);
  }
  return onTarget ? "blocked" : "off";
}

function count(t: Tally, o: ReturnType<typeof outcome>) {
  t.shots++;
  if (o === "goal") { t.on++; t.goals++; }
  else if (o === "saved") { t.on++; t.saved++; }
  else if (o === "blocked") t.blocked++;
}

/**
 * How hard he hits it. A swipe has no contact point (it is struck through the
 * middle), so the ball always climbs about the same (6–7 m/s up) whatever the
 * power: from 12–20 m a firm strike is still rising at the line and can clear
 * the bar. A decent or good player learns the firmest strike that crosses
 * under KEEP_UNDER (his own strike, run on with no keeper, noise left out); a
 * careless one just hits it.
 */
const KEEP_UNDER = 2.15;
function crossingZ(power: number, ov: number, from: { x: number; y: number }, to: { x: number }): number {
  const n = strikeNumbers(power, { cx: 0, cy: 0 }, ov, ov);
  const dx = to.x - from.x, dy = -from.y, d = Math.hypot(dx, dy);
  const c: Ball3 = { x: from.x, y: from.y, z: BALL_R + 0.01, vx: dx / d * n.Sh, vy: dy / d * n.Sh, vz: n.vz, spin: n.spin, topspin: n.topspin, inNet: false };
  for (let i = 0; i < 120 * 3 && c.y > 0; i++) stepBall3d(c, STEP, null);
  return c.z;
}
function footPower(bot: Bot, from: { x: number; y: number }, aim: number, r: Rng): number {
  const want = between(r, bot.power);
  if (bot.anywhere) return want;
  let best = want, low = Infinity;
  for (let p = want; p >= 0.45; p -= 0.02) {
    const z = crossingZ(p, bot.ov, from, { x: aim });
    if (z <= KEEP_UNDER) return p;
    if (z < low) { low = z; best = p; }
  }
  return best;
}

/** One shot from a spot with the ball at your feet, the keeper set: Free Roam (its own World) or a bare World at a rating. */
function footShot(bot: Bot, seed: number, spot: { x: number; y: number }, keeperOverall: number | "free-roam"): ReturnType<typeof outcome> {
  const you = { id: "you", name: "You", skills: skillsOf(bot.ov) };
  let w: World;
  if (keeperOverall === "free-roam") w = makeFreeRoam({ seed, you, mates: [] }).world;
  else {
    const p = makePlayer({ id: "you", human: true, x: spot.x, y: spot.y, skills: you.skills });
    const k = makePlayer({ id: "keeper", team: 1, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(keeperOverall) });
    w = new World({ seed, players: [p, k], rules: { id: "measure", finished: () => false } });
  }
  const p = w.you()!, k = w.keeperOf()!, r = makeRng(seed * 7 + 3);
  p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0;
  p.facing = Math.atan2(-spot.y, CX - spot.x);
  w.placeBall(spot.x, spot.y, p.id);
  const s = keeperSpot(w.ball);
  k.x = s.x; k.y = s.y; k.vx = k.vy = 0; k.mind = {}; k.dive = undefined;
  for (let i = 0; i < 36; i++) w.step(STEP); // he settles, square to the ball
  w.drain();
  const b = w.ball;
  const ax = aimX(bot, k.x, r);
  w.act({ kind: "shoot", dir: { x: ax - b.x, y: -b.y }, pull: pullFor(footPower(bot, b, ax, r), bot.ov) });
  w.step(STEP);
  return outcome(w, ghostIn(w.ball), p.id);
}

/** A spot `d` metres out, up to `deg` degrees off straight. */
function spotAt(r: Rng, d: [number, number], deg: number) {
  const dist = between(r, d), a = (r() - 0.5) * 2 * deg * Math.PI / 180;
  return { x: CX + Math.sin(a) * dist, y: Math.cos(a) * dist };
}

function freeRoam(bot: Bot, n = N): Tally {
  const t = tally(), r = makeRng(101);
  for (let i = 0; i < n; i++) count(t, footShot(bot, 1000 + i, spotAt(r, [9, 20], 35), "free-roam"));
  return t;
}

function wembleyYou(bot: Bot, n = N, keeper = WEMBLEY_KEEPER): Tally {
  const t = tally(), r = makeRng(202);
  for (let i = 0; i < n; i++) count(t, footShot(bot, 2000 + i, spotAt(r, [8, 14], 35), keeper));
  return t;
}

/** Headers & Volleys: the real session, the bot runs to the ring and strikes as it arrives. */
function headersVolleys(bot: Bot, sessions = Math.ceil(N / 5)): Tally {
  const t = tally();
  for (let s = 1; s <= sessions; s++) {
    const person = (id: string, ov: number) => ({ id, name: id, skills: skillsOf(ov) });
    const { world: w, state } = makeHeadersVolleys({ seed: 300 + s * 13, you: person("you", bot.ov), leftBack: person("lb", 65), rightBack: person("rb", 65) });
    const you = w.you()!, k = w.keeperOf()!, r = makeRng(400 + s);
    let acted = -1;
    for (let i = 0; i < 120 * 150 && !state.over; i++) {
      const ring = w.markers[0];
      if (ring && (state.phase === "flight" || state.phase === "setup")) {
        const d = Math.hypot(ring.x - you.x, ring.y - you.y);
        const dx = ring.x - you.x, dy = ring.y - you.y, l = Math.hypot(dx, dy) || 1;
        w.input = { move: d > 0.4 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 }, sprint: d > 1.2 };
      } else w.input = { move: { x: 0, y: 0 }, sprint: false };
      const b = w.ball;
      if (state.phase === "flight" && acted !== state.cross) {
        const dNow = Math.hypot(b.x - you.x, b.y - you.y), sp = Math.max(1, Math.hypot(b.vx, b.vy));
        if (dNow / sp < 0.22) {
          acted = state.cross;
          const ax = aimX(bot, k.x, r);
          const air = b.z > 0.65 || b.vz < -1;
          const pull = air ? between(r, bot.airPull) : pullFor(between(r, bot.power), bot.ov);
          // aimed from where you'll strike it (your spot), the way a thumb swipes at the goal
          w.act({ kind: "shoot", dir: { x: ax - you.x, y: -you.y }, pull });
        }
      }
      const was = state.phase;
      w.step(STEP);
      if (was !== "struck" && state.phase === "struck") {
        w.drain();
        count(t, outcome(w, ghostIn(w.ball), you.id, () => state.phase !== "struck"));
      } else w.drain();
    }
  }
  return t;
}

/** Wembley's own AI men in full 4-man sessions (one 80, three 60s): their shots, by shooter. */
function wembleySessions(n = 60): { sixty: Tally; eighty: Tally } {
  const sixty = tally(), eighty = tally();
  for (let seed = 1; seed <= n; seed++) {
    const { world: w, state: s } = makeWembley({
      seed, mode: "normal", count: 4, autoYou: true,
      you: { id: "p80", name: "Eighty", skills: skillsOf(80) },
      mates: [1, 2, 3].map((i) => ({ id: `p60_${i}`, name: `Sixty${i}`, skills: skillsOf(60) })),
    });
    let open: { who: string; on: boolean } | null = null;
    for (let i = 0; i < 120 * 900 && !s.over; i++) {
      w.step(STEP);
      for (const e of w.drain()) {
        if (open) {
          let o: ReturnType<typeof outcome> | null = null;
          if (e.kind === "goal") o = open.on ? "goal" : "off";
          else if (e.kind === "save" || e.kind === "catch") o = open.on ? "saved" : "off";
          else if (e.kind === "byline" || e.kind === "out") o = "off";
          else if ((e.kind === "touch" && e.who !== open.who) || e.kind === "tackle-won") o = open.on ? "blocked" : "off";
          if (o) { count(open.who === "p80" ? eighty : sixty, o); open = null; }
        }
        if (e.kind === "shot" && e.who && e.who !== "keeper") open = { who: e.who, on: ghostIn(w.ball) };
      }
    }
  }
  return { sixty, eighty };
}

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const line = (name: string, t: Tally) => `${name.padEnd(9)} saved ${pct(saveRate(t)).padStart(4)} of ${String(t.on).padStart(3)} on target (${t.goals} goals, ${t.shots} shots, ${pct(t.on / Math.max(1, t.shots))} on target${t.blocked ? `, ${t.blocked} blocked` : ""})`;

const games: [string, (b: Bot) => Tally][] = [
  ["Free Roam", (b) => freeRoam(b)],
  ["Headers & Volleys", (b) => headersVolleys(b)],
  ["Wembley (you)", (b) => wembleyYou(b)],
];
const only = process.env.SAVE_GAME?.toLowerCase();
const problems: string[] = [];
for (const [name, run] of games) {
  if (only && !name.toLowerCase().includes(only)) continue;
  console.log(`── ${name}`);
  const res = {} as Record<BotId, Tally>;
  for (const id of ["decent", "good", "careless"] as BotId[]) { res[id] = run(BOTS[id]); console.log("  " + line(id, res[id])); }
  const d = saveRate(res.decent), g = saveRate(res.good), c = saveRate(res.careless);
  if (d < 0.28 || d > 0.38) problems.push(`${name}: a decent player's on-target shots saved ${pct(d)} (want 28–38%, about 1 in 3)`);
  if (g > d - 0.05) problems.push(`${name}: a good player should be saved clearly less than a decent one (good ${pct(g)}, decent ${pct(d)})`);
  if (c < d + 0.05) problems.push(`${name}: a careless player should be saved clearly more than a decent one (careless ${pct(c)}, decent ${pct(d)})`);
}
if (!only || "wembley (ai)".includes(only)) {
  const ai = wembleySessions(Number(process.env.SAVE_SESSIONS ?? 60));
  console.log("── Wembley (AI men, 4-man sessions)");
  console.log("  " + line("60s", ai.sixty));
  console.log("  " + line("the 80", ai.eighty));
  if (!(saveRate(ai.eighty) < saveRate(ai.sixty))) problems.push(`Wembley AI: the 80's shots should be saved less than the 60s' (80 ${pct(saveRate(ai.eighty))}, 60s ${pct(saveRate(ai.sixty))})`);
}

if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("play3dSaveRate: all checks pass");
