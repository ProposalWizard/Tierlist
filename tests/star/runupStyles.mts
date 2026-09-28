/**
 * PENALTY RUN-UPS AND FREE-KICK RUN-UPS — two separate sets, measured on the
 * real engine.
 *
 * A style (lib/star/runupStyles.ts) is looks only. Every kick here is struck
 * the way CanvasMatch strikes one: the picture as the match serves it, the
 * taker standing back where HIS style starts, the keeper brain for this
 * keeper, a moment of aiming, then the style's own run-up — its own length,
 * path and pace, `stepKeeper` + the keeper brain's `brainRunUp` every frame —
 * then launch(), `brainStrike` (and the kind's strike rules) and the 180 Hz
 * loop.
 *
 * Pinned:
 *   - the contract: both sets, every id in order, ids unique across the two,
 *     each set's Standard the free default, an old save's `runupStyle` read as
 *     its penalty run-up;
 *   - scoring (keeper 62, 1,500 kicks, the same seeds and the same kicks for
 *     every style) is within 1 point of Standard's for every penalty style
 *     and every free-kick style;
 *   - release → strike screen is 1.5–3.2 s for every style, and each set's
 *     Standard is exactly penaltyRunup.ts's run-up (same path, same 2.4 s);
 *   - every run ends with the standing foot beside the ball, starts behind
 *     it, stays inside the picture, and the styles really do differ;
 *   - a team-mate's or an opponent's style is the same every time for the
 *     same player — one from each set, the right one for the kick.
 *
 * Run: npx tsx tests/star/runupStyles.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario, type Vec2,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules, strikeKind, stepKind } from "../../lib/star/kindRules";
import { makeChance } from "../../lib/star/chanceMaker";
import { brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { penaltyReadFor } from "../../lib/star/penaltyKeeper";
import { RUNUP, runupPath, playerAt, standBack, plantBeside, goalLineX } from "../../lib/star/penaltyRunup";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
import {
  PENALTY_RUNUPS, FREE_KICK_RUNUPS, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP, RUNUP_MOTION,
  RUNUP_STYLES, DEFAULT_RUNUP_STYLE,
  penaltyRunupOf, freeKickRunupOf, isPenaltyRunupId, isFreeKickRunupId, ownsRunup,
  ownedPenaltyRunups, ownedFreeKickRunups, careerPenaltyRunup, careerFreeKickRunup,
  takerPenaltyRunup, takerFreeKickRunup, takerRunupFor, yourRunupFor,
  standBackFor, planRunup, runupPositionAt, runupPoseAt, runupProgress, type RunupId,
} from "../../lib/star/runupStyles";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const ALL = [...PENALTY_RUNUPS, ...FREE_KICK_RUNUPS];

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE TWO SETS");
{
  ok(PENALTY_RUNUPS.map((s) => s.id).join() === "standard,stroll,skip,sprint,stutter,two_step,arc", `penalties: ${PENALTY_RUNUPS.map((s) => s.name).join(", ")}`);
  ok(FREE_KICK_RUNUPS.map((s) => s.id).join() === "fk_standard,fk_power_stance,fk_stance_sprint,fk_calm_curl,fk_stutter_curl,fk_angled_whip,fk_long_diagonal", `free kicks: ${FREE_KICK_RUNUPS.map((s) => s.name).join(", ")}`);
  ok(PENALTY_RUNUPS.map((s) => s.name).join() === "Standard,The Stroll,The Skip,The Sprint,Stutter Step,Two Steps,The Arc", "the penalty set's on-screen names (the shop contract)");
  ok(new Set(ALL.map((s) => s.id)).size === ALL.length, "no id is in both sets (ownedAnimations holds both)");
  ok(FREE_KICK_RUNUPS.every((s) => s.id.startsWith("fk_")) && !PENALTY_RUNUPS.some((s) => s.id.startsWith("fk_")), "free-kick ids start fk_, penalty ids never do");
  const players = FREE_KICK_RUNUPS.map((s) => s.player).filter(Boolean).join(",");
  ok(players === "Ronaldo,Bale,Messi,Neymar,Maddison,Trent", `each free-kick style is modelled on one elite taker (${players})`);
  ok(ALL.every((s) => s.blurb.length > 0), "every one has a line to show in the shop");
  ok(DEFAULT_PENALTY_RUNUP === "standard" && DEFAULT_FREE_KICK_RUNUP === "fk_standard", "each set's Standard is the default");
  ok(RUNUP_STYLES === PENALTY_RUNUPS && DEFAULT_RUNUP_STYLE === "standard", "the shop contract's first names are the penalty set");
  ok(penaltyRunupOf(undefined) === "standard" && penaltyRunupOf("fk_calm_curl") === "standard" && penaltyRunupOf("skip") === "skip", "a penalty run-up never takes a free-kick id");
  ok(freeKickRunupOf(undefined) === "fk_standard" && freeKickRunupOf("skip") === "fk_standard" && freeKickRunupOf("fk_angled_whip") === "fk_angled_whip", "…and the other way round");
  ok(isPenaltyRunupId("arc") && !isPenaltyRunupId("Arc") && isFreeKickRunupId("fk_power_stance") && !isFreeKickRunupId("arc"), "ids are exact");
  ok(careerPenaltyRunup({ runupStyle: "skip" }) === "skip" && careerPenaltyRunup({ penaltyRunup: "arc", runupStyle: "skip" }) === "arc" && careerPenaltyRunup({}) === "standard", "an old save's runupStyle is read as its penalty run-up");
  ok(careerFreeKickRunup({}) === "fk_standard" && careerFreeKickRunup({ freeKickRunup: "fk_calm_curl" }) === "fk_calm_curl", "a free-kick run-up defaults to Standard");
  ok(ownsRunup(undefined, "standard") && ownsRunup(undefined, "fk_standard") && !ownsRunup(undefined, "skip") && ownsRunup(["fk_calm_curl"], "fk_calm_curl"), "each set's Standard is always owned; the rest only once unlocked");
  ok(ownedPenaltyRunups(["arc", "stroll", "fk_calm_curl"]).map((s) => s.id).join() === "standard,stroll,arc", "Settings' penalty picker: Standard plus what you own, in order");
  ok(ownedFreeKickRunups(["arc", "fk_long_diagonal", "fk_calm_curl"]).map((s) => s.id).join() === "fk_standard,fk_calm_curl,fk_long_diagonal", "…and its free-kick picker, from the same owned list");
  ok(yourRunupFor("penalty", "skip", "fk_calm_curl") === "skip" && yourRunupFor("free_kick", "skip", "fk_calm_curl") === "fk_calm_curl", "your penalty style on penalties, your free-kick style on free kicks");
  ok(ALL.every((s) => RUNUP_MOTION[s.id] !== undefined), "every style has its movement");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nHOW LONG, AND WHERE");
{
  for (const s of ALL) {
    const T = RUNUP_MOTION[s.id].runS;
    ok(T >= 1.5 && T <= 3.2, `${s.name} (${s.id}): letting go → strike screen ${T.toFixed(1)} s (1.5–3.2)`);
  }
  // Standard IS penaltyRunup.ts's run-up, in both sets.
  const ball = { x: 34, y: 11 }, drawn = { x: 34, y: 12.8 };
  for (const id of ["standard", "fk_standard"] as RunupId[]) {
    const sb = standBackFor(id, ball, drawn);
    ok(dist(sb, standBack(ball, drawn)) < 1e-12 && RUNUP_MOTION[id].runS === RUNUP.runupS, `${id} stands exactly where it always did, for exactly 2.4 s`);
    const r = planRunup(id, ball, sb), p = runupPath(ball, drawn);
    let same = true;
    for (let t = 0; t <= RUNUP.runupS; t += 0.05) if (dist(runupPositionAt(r, t), playerAt(p, t / RUNUP.runupS)) > 1e-12) same = false;
    ok(same && runupPoseAt(r, 1) === null, "…jogs the same path at the same pace, with the match's own running figure");
  }

  // Every style: starts behind the ball, ends beside it, in the picture.
  const view = { x1: 12, x2: 56, y1: -3.7, y2: 38.3 };
  const fk = { x: 42, y: 27 }, fkView = { x1: 18, x2: 60, y1: -4, y2: 33 };
  for (const s of ALL) {
    const from = standBackFor(s.id, ball, drawn, view);
    const plan = planRunup(s.id, ball, from);
    const T = RUNUP_MOTION[s.id].runS;
    const end = runupPositionAt(plan, T), start = runupPositionAt(plan, 0);
    const beside = dist(end, plantBeside(ball, from)) < 1e-9 && dist(end, ball) < 0.7;
    ok(beside && dist(start, from) < 1e-9 && from.y > ball.y - 0.5, `${s.name}: from ${dist(from, ball).toFixed(1)} m back, ends with his standing foot beside the ball`);
    const f = standBackFor(s.id, fk, { x: 42, y: 28 }, fkView);
    const inside = f.x >= fkView.x1 + 1.5 && f.x <= fkView.x2 - 1.5 && f.y <= fkView.y2 - 1.5;
    ok(inside, `${s.name}: a free kick from 27 m still starts on screen (${f.x.toFixed(1)}, ${f.y.toFixed(1)})`);
  }

  // They really differ: start distance, time, and what the body does.
  for (const set of [PENALTY_RUNUPS, FREE_KICK_RUNUPS] as { id: RunupId }[][]) {
    const froms = set.map((s) => dist(standBackFor(s.id, ball, drawn, view), ball));
    ok(Math.max(...froms) > 2.5 * Math.min(...froms), `start distances range ${Math.min(...froms).toFixed(1)}–${Math.max(...froms).toFixed(1)} m`);
  }
  const plan = (id: RunupId) => planRunup(id, ball, standBackFor(id, ball, drawn, view));
  const maxOf = (id: RunupId, f: (p: NonNullable<ReturnType<typeof runupPoseAt>>) => number) => {
    let m = 0; const pl = plan(id);
    for (let t = 0; t <= RUNUP_MOTION[id].runS; t += 0.01) { const p = runupPoseAt(pl, t); if (p) m = Math.max(m, f(p)); }
    return m;
  };
  ok(maxOf("skip", (p) => p.lift) > 0.2 && ALL.every((s) => s.id === "skip" || maxOf(s.id, (p) => p.lift) < 0.05), "only The Skip really leaves the ground (a walker's bob and a sprinter's stride stay under 5% of his height)");
  ok(maxOf("sprint", (p) => p.crouch) >= 0.2 && maxOf("sprint", (p) => Math.abs(p.legSwing)) > 1.5, "The Sprint runs low with the longest stride");
  ok(maxOf("stroll", (p) => Math.abs(p.legSwing)) < 0.45, "The Stroll takes short walking steps");
  ok(maxOf("arc", (p) => Math.abs(p.lean)) > 0.25, "The Arc leans into the bend");
  const moved = runupProgress("stutter", 2.1) - runupProgress("stutter", 1.2);
  ok(moved < 0.05, `Stutter Step stops dead for ~1 s (${(moved * 100).toFixed(1)}% of the run in 0.9 s)`);
  ok(runupProgress("two_step", 0.6) === 0, "Two Steps stands set before its two strides");
  const a = plan("arc"), mid = runupPositionAt(a, RUNUP_MOTION.arc.runS / 2);
  const dx = a.to.x - a.from.x, dy = a.to.y - a.from.y, L = Math.hypot(dx, dy);
  const off = Math.abs((mid.x - a.from.x) * dy - (mid.y - a.from.y) * dx) / L;
  ok(off > 0.8, `The Arc bends: ${off.toFixed(2)} m off the straight line at halfway`);
  // Free kicks.
  const stanceHeld = (id: RunupId, until: number) => {
    const pl = plan(id); let wide = true;
    for (let t = 0; t < until; t += 0.05) { if (runupProgress(id, t) !== 0) wide = false; const p = runupPoseAt(pl, t)!; if (p.legSwing < 1) wide = false; }
    return wide;
  };
  ok(stanceHeld("fk_power_stance", 1.25), "Power Stance (Ronaldo) stands legs-wide for 1.3 s before he goes");
  const breath = [0.2, 0.7, 1.15].map((t) => runupPoseAt(plan("fk_power_stance"), t)!.crouch);
  ok(breath[1] < breath[0] - 0.05 && breath[2] > breath[1] + 0.05, "…and takes a deep breath: he rises and settles");
  ok(stanceHeld("fk_stance_sprint", 0.75) && maxOf("fk_stance_sprint", (p) => Math.abs(p.legSwing)) > 1.4, "Stance and Sprint (Bale): the stance, then long sprinting strides");
  ok(maxOf("fk_calm_curl", (p) => Math.abs(p.legSwing)) < 0.65 && RUNUP_MOTION.fk_calm_curl.startBack < 2.6, "The Calm Curl (Messi): short, unhurried steps from close in");
  const shimmy = runupProgress("fk_stutter_curl", 1.45) - runupProgress("fk_stutter_curl", 0.95);
  ok(shimmy < 0.07 && maxOf("fk_stutter_curl", (p) => Math.abs(p.lean)) > 0.1, `Stutter Curl (Neymar): stops and shimmies (${(shimmy * 100).toFixed(1)}% of the run in 0.5 s)`);
  ok(RUNUP_MOTION.fk_angled_whip.startAngleDeg >= 50 && maxOf("fk_angled_whip", (p) => Math.abs(p.lean)) > 0.1, "The Whip (Maddison): a short approach from a wide angle, body across");
  ok(RUNUP_MOTION.fk_long_diagonal.startBack >= 6.5 && RUNUP_MOTION.fk_long_diagonal.startAngleDeg >= 40, "Long Diagonal (Trent): the longest run, on the diagonal");
}

// ─────────────────────────────────────────────────────────────────────────
interface Kick { off: number; power: number; cy: number; cx: number }
function mixKick(rng: () => number): Kick {
  const u = rng(), side = rng() < 0.5 ? -1 : 1, p = 0.6 + rng() * 0.3, cy = -1 + rng() * 1.25;
  if (u < 0.7) return { off: side * (1.4 + 2.15 * Math.sqrt(rng())), power: p, cy, cx: 0 };
  if (u < 0.9) return { off: (rng() - 0.5) * 0.8, power: p, cy, cx: 0 };
  return { off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: 0.3 + rng() * 0.45, cx: 0 };
}
/** A free kick: over the wall or bent round it, at a post — the ways a real taker goes. */
function fkKick(rng: () => number): Kick {
  const side = rng() < 0.5 ? -1 : 1;
  const over = rng() < 0.5;
  return {
    off: side * (2.2 + rng() * 1.3),
    power: 0.62 + rng() * 0.3,
    cy: over ? 0.35 + rng() * 0.45 : -0.2 + rng() * 0.4,
    cx: over ? (rng() - 0.5) * 0.3 : -side * (0.35 + rng() * 0.4),
  };
}

/** One dead ball, struck the way CanvasMatch strikes it. */
function strike(kind: "penalty" | "free_kick", seed: number, k: Kick, style: RunupId, ks = 62): boolean {
  const rng = mulberry32(seed);
  let sc: Scenario;
  if (kind === "penalty") {
    sc = buildScenario("penalty", rng, ks, 60, 55);
    enforceHardRules(sc);
  } else {
    sc = makeChance({ source: { from: "kind", kind: "free_kick" }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null }).sc;
  }
  initDefenders(sc, rng);
  sc.player = standBackFor(style, sc.ball, sc.player, sc.viewport);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { penalty: penaltyReadFor(ks) });
  for (let t = 0; t < 1.5; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
  const tx = kind === "penalty" ? (sc.goal.x1 + sc.goal.x2) / 2 + k.off : Math.max(POST_L + 0.3, Math.min(POST_R - 0.3, CX + k.off));
  const dx = tx - sc.ball.x, dy = 0 - sc.ball.y, L = Math.hypot(dx, dy);
  const dir: Vec2 = { x: dx / L, y: dy / L };
  const plan = planRunup(style, sc.ball, sc.player);
  const T = RUNUP_MOTION[style].runS;
  for (let t = 0; t < T; t += 1 / 60) {
    stepKeeper(sc, 1 / 60);
    brainRunUp(sc, 1 / 60, t + 1 / 60, goalLineX(sc.ball, dir));
    sc.player = runupPositionAt(plan, t + 1 / 60);
  }
  const ball = launch(sc, dir, k.power, { cx: k.cx, cy: k.cy }, { power: 60, technique: 60 }, rng);
  brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
  const kd = strikeKind(sc, ball, mulberry32((seed ^ 0x6b1d) >>> 0), { keeperStrength: ks, power: 60, technique: 60 });
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    stepKind(sc, ball, h, kd);
    brainStep(sc, ball, h);
    res = stepBall(ball, sc, rng, h);
  }
  return (res === "goal" || res === "rebound") && !sc.follower.shot;
}
function rate(kind: "penalty" | "free_kick", style: RunupId, N = 1500): number {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const seed = 1000 + i * 7919;
    const g = mulberry32((seed ^ 0xa11ce) >>> 0);
    if (strike(kind, seed, kind === "penalty" ? mixKick(g) : fkKick(g), style)) s++;
  }
  return s / N;
}

console.log("\nWHO SCORES — the same for every style (keeper 62, 1,500 kicks, same seeds)");
{
  const std = rate("penalty", "standard");
  console.log(`  penalties — Standard ${pct(std)}`);
  ok(std >= 0.7 && std <= 0.81, `Standard penalties still score the real match's ~70-80 % (${pct(std)})`);
  for (const s of PENALTY_RUNUPS) {
    if (s.id === "standard") continue;
    const r = rate("penalty", s.id);
    ok(Math.abs(r - std) <= 0.01, `${s.name}: ${pct(r)} (Standard ${pct(std)}, within 1 point)`);
  }
  const fstd = rate("free_kick", "fk_standard");
  console.log(`  free kicks — Standard ${pct(fstd)}`);
  ok(fstd > 0.02 && fstd < 0.4, `a free kick at a post, over or round the wall, sometimes goes in (${pct(fstd)})`);
  for (const s of FREE_KICK_RUNUPS) {
    if (s.id === "fk_standard") continue;
    const r = rate("free_kick", s.id);
    ok(Math.abs(r - fstd) <= 0.01, `${s.name}: ${pct(r)} (Standard ${pct(fstd)}, within 1 point)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTEAM-MATES AND OPPONENTS");
{
  const ids = Array.from({ length: 350 }, (_, i) => `sofifa-${200000 + i * 37}`);
  ok(ids.map(takerPenaltyRunup).join() === ids.map(takerPenaltyRunup).join() && ids.map(takerFreeKickRunup).join() === ids.map(takerFreeKickRunup).join(), "the same player always runs up the same way, in both sets");
  ok(takerPenaltyRunup("Bruno Fernandes") === takerPenaltyRunup("Bruno Fernandes"), "…keyed by name too, when there's no id");
  ok(takerPenaltyRunup("") === "standard" && takerFreeKickRunup(undefined) === "fk_standard", "nobody named: Standard");
  ok(ids.every((id) => isPenaltyRunupId(takerRunupFor("penalty", id)) && isFreeKickRunupId(takerRunupFor("free_kick", id))), "a penalty gets a penalty run-up, a free kick a free-kick one");
  for (const [set, pick] of [[PENALTY_RUNUPS, takerPenaltyRunup], [FREE_KICK_RUNUPS, takerFreeKickRunup]] as const) {
    const counts = new Map<string, number>();
    for (const id of ids) { const s = (pick as (k: string) => string)(id); counts.set(s, (counts.get(s) ?? 0) + 1); }
    console.log(`  350 players: ${set.map((s) => `${s.id} ${counts.get(s.id) ?? 0}`).join(", ")}`);
    ok(set.every((s) => (counts.get(s.id) ?? 0) >= 20), "a squad spreads across all seven");
  }
  const sameIndex = ids.filter((id) => PENALTY_RUNUPS.findIndex((s) => s.id === takerPenaltyRunup(id)) === FREE_KICK_RUNUPS.findIndex((s) => s.id === takerFreeKickRunup(id))).length;
  ok(sameIndex < ids.length * 0.3, `his free-kick style isn't just his penalty style's twin (${sameIndex}/${ids.length} line up)`);
}

void CX;
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
