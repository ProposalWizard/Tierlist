/**
 * THE GYM (lib/star/gym): the three mini-games and the progress model. Phase 1 of
 * docs/research/gym-compound-driving-2026-11-27.md, on the test page /star-world3d-dev?place=gym.
 *
 *  - each game lasts 20 to 40 s for a decent player, is the same at 30 and 120 frames a second,
 *    and can be failed (the bar dropped too fast, falling off the treadmill);
 *  - Strength / Cardio / Focus: four levels, one ring per gap between matches, the workout window
 *    (inside: full points; closed: half; missed: Strength and Cardio slip, Focus never), sleep and
 *    protein help, no stat maxed in one go;
 *  - the career: an old save loads with no gym; with the flag OFF nothing but the gym moves.
 */
import {
  startGame, stepGame, resultOf, botHold, benchStart, benchStep, BENCH, treadmillStart, treadmillStep, TREADMILL, BAG,
  type GameState, type GymGameKind,
} from "../../lib/star/gym/games";
import {
  newGym, gymOf, doExercise, levelOf, missedWindows, windowOpen, windowLeft, gymAt, takeProtein, gymExercise, gymView,
  GYM_CAREER_EFFECT, MACHINE_POINTS, PER_GAP_MAX, MAX_POINTS, SLIP, WINDOW_GAPS, type GymState, type Gap,
} from "../../lib/star/gym/progress";
import type { CareerState } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** Play a game to the end with the bot thumb at a frame rate. */
function play(kind: GymGameKind, fps: number, skill = 1, seed = 3) {
  let s: GameState = startGame(kind, 1, seed);
  let n = 0;
  while (!s.done && n < 100000) { s = stepGame(s, 1 / fps, botHold(s, skill)); n++; }
  return s;
}

// ── the games ──
for (const kind of ["bench", "treadmill", "bag"] as GymGameKind[]) {
  const a = play(kind, 30), b = play(kind, 120);
  check(a.done && a.t >= 20 && a.t <= 40, `${kind}: a decent player's go lasts 20-40 s (${a.t.toFixed(1)} s)`);
  const ra = resultOf(a), rb = resultOf(b);
  // the same thumb (a fixed pattern in time) gives the same game at 30 and 120 frames a second
  const fixed = (fps: number) => { let s: GameState = startGame(kind, 1, 3); for (let i = 0; i < fps * 45 && !s.done; i++) s = stepGame(s, 1 / fps, Math.floor(s.t * 2.5) % 3 !== 0); return resultOf(s).quality; };
  const f30 = fixed(30), f120 = fixed(120);
  check(Math.abs(f30 - f120) < 0.05, `${kind}: the same at 30 and 120 fps (${f30} vs ${f120})`);
  check(rb.quality >= 0.6, `${kind}: good at 120 fps too (${rb.quality})`);
  check(ra.quality >= 0.6 && !ra.failed, `${kind}: a decent player does well (${ra.quality}, ${ra.headline})`);
  const bad = resultOf(play(kind, 60, 0));
  check(bad.quality < ra.quality, `${kind}: a poor player does worse (${bad.quality} < ${ra.quality})`);
  // the same seed plays the same game
  check(JSON.stringify(play(kind, 60, 1, 9)) === JSON.stringify(play(kind, 60, 1, 9)), `${kind}: seeded`);
}
{
  // bench: letting go at the top drops the bar onto your chest: a bounce, then the set ends at two
  let s = benchStart(1);
  for (let i = 0; i < 2000 && !s.done; i++) s = benchStep(s, 1 / 60, s.phase !== "down");
  check(s.strikes === BENCH.strikesOut && s.done && resultOf(s).failed && s.reps === 0, `bench: let go at the top and it bounces, two strikes end it (${s.strikes} strikes, ${s.reps} reps)`);
  // a full good set: 8 reps, most lowered slowly
  const g = play("bench", 60) as ReturnType<typeof benchStart>;
  check(g.reps === BENCH.reps && g.clean >= BENCH.reps - 1, `bench: the good set is ${BENCH.reps} reps, lowered slowly (${g.reps}, ${g.clean} slow)`);
  // let go halfway up: back down, no rep, no strike
  let h = benchStart(1);
  for (let i = 0; i < 20; i++) h = benchStep(h, 1 / 60, true);
  for (let i = 0; i < 120; i++) h = benchStep(h, 1 / 60, false);
  check(h.reps === 0 && h.strikes === 0 && h.bar === 0, "bench: giving up halfway is no rep and no harm");
  // stronger lifters push harder
  check(benchStep(benchStart(4), 0.5, true).bar > benchStep(benchStart(1), 0.5, true).bar, "bench: Strength 4 pushes faster than Strength 1");
}
{
  // treadmill: never hold and the belt takes you off the back
  let s = treadmillStart(1, 1);
  for (let i = 0; i < 3000 && !s.done; i++) s = treadmillStep(s, 1 / 60, false);
  check(s.fell && s.done && resultOf(s).failed && s.t < 12, `treadmill: no running = you fall off (${s.t.toFixed(1)} s)`);
  // holding all the time: you hit the front (bump), never fall
  let f = treadmillStart(1, 1);
  for (let i = 0; i < 4000 && !f.done; i++) f = treadmillStep(f, 1 / 60, true);
  check(!f.fell && f.bumps >= 1 && f.kmh === TREADMILL.kmh[TREADMILL.kmh.length - 1], `treadmill: always running = the console, not a fall, up to ${f.kmh} km/h`);
}
{
  const s = play("bag", 60) as Extract<GameState, { kind: "bag" }>;
  check(s.hits >= 30 && s.best >= 10, `bag: a decent go lands punches (${s.hits}, best combo ${s.best})`);
  check(s.t >= BAG.secs - 0.01, "bag: lasts its full time");
}

// ── progress ──
const G = (week: number, season = 1): Gap => ({ season, week });
{
  const g0 = newGym();
  check(levelOf(0) === 1 && levelOf(99) === 1 && levelOf(100) === 2 && levelOf(MAX_POINTS) === 4 && levelOf(9999) === 4, "levels 1-4, 100 points each");
  // the first visit: window closed, so half points; it opens the window
  const a = doExercise(g0, G(1), { kind: "bench", quality: 1 });
  check(a.cold && a.gained === MACHINE_POINTS / 2 && windowOpen(a.gym, G(1)), `first visit counts half (${a.gained}) and opens the window`);
  // the same machine again this gap: nothing
  const a2 = doExercise(a.gym, G(1), { kind: "bench", quality: 1 });
  check(a2.gained === 0 && a2.why === "machineDone", "the same machine twice in a gap pays nothing");
  // close the ring
  const b = doExercise(a.gym, G(1), { kind: "treadmill", quality: 1 });
  const c = doExercise(b.gym, G(1), { kind: "bag", quality: 1 });
  check(c.ringClosed && c.ringBonus > 0 && c.gym.rings === 1 && c.gym.visits === 1, "three machines close the ring, one visit");
  const d = doExercise(c.gym, G(1), { kind: "treadmill", quality: 1 });
  check(d.why === "ringClosed" && d.gained === 0, "after the ring closes, more does nothing");
  // next gap, inside the window: full points
  const e = doExercise(c.gym, G(2), { kind: "bench", quality: 1 });
  check(!e.cold && e.gained === MACHINE_POINTS, `inside the window: full points (${e.gained})`);
  check(windowLeft(c.gym, G(1)) === WINDOW_GAPS && windowLeft(c.gym, G(1 + WINDOW_GAPS)) === 0 && windowLeft(c.gym, G(2 + WINDOW_GAPS)) === -1, "the window counts down over the next gaps");
  // miss it: Strength and Cardio slip, Focus does not
  const later = G(1 + WINDOW_GAPS + 1);
  check(missedWindows(c.gym.last, later) === 1, "one window missed");
  const { gym: slipped, slipped: n } = gymAt(c.gym, later);
  check(n === 1 && slipped.points.strength === Math.max(0, c.gym.points.strength - SLIP) && slipped.points.focus === c.gym.points.focus, "a missed window: Strength and Cardio slip, Focus stays");
  check(missedWindows(G(3), G(40)) === 3, "at most 3 windows slip at once");
  check(missedWindows(G(30, 1), G(1, 2)) >= 1, "the summer closes the window");
  // never below zero
  check(gymAt({ ...newGym(), last: G(1) }, G(30)).gym.points.strength === 0, "slipping never goes below 0");
}
{
  // sleep and protein; the per-gap cap
  let g: GymState = newGym();
  g = doExercise(g, G(1), { kind: "bench", quality: 1 }).gym; // opens the window
  const plain = doExercise(g, G(2), { kind: "bench", quality: 1 }).gained;
  const slept = doExercise(g, G(2), { kind: "bench", quality: 1 }, { slept: true }).gained;
  const both = doExercise(takeProtein(g, G(2)), G(2), { kind: "bench", quality: 1 }, { slept: true }).gained;
  check(slept > plain && both > slept && both <= PER_GAP_MAX, `sleep and protein help, never past the gap's cap (${plain} < ${slept} < ${both} ≤ ${PER_GAP_MAX})`);
  // how long to Strength 4 with a perfect week every week, both boosts: never in one go
  let k = 0, s = newGym();
  while (levelOf(s.points.strength) < 4 && k < 100) {
    k++;
    s = takeProtein(s, G(k));
    for (const kind of ["bench", "treadmill", "bag"] as GymGameKind[]) s = doExercise(s, G(k), { kind, quality: 1 }, { slept: true }).gym;
  }
  check(k >= 6 && k <= 12, `Strength 1 to 4 takes ${k} perfect gaps (6-12)`);
  check(levelOf(s.points.focus) >= 3, "the ring's bonus lifts Focus too");
}

// ── the career ──
{
  const base = { season: 1, week: 4, energy: 60, weekActions: 3, skills: { pace: 70, power: 70 } } as unknown as CareerState;
  check(GYM_CAREER_EFFECT === "off", "the career effect is OFF until Harry decides");
  check(gymOf(base).visits === 0 && gymOf({} as CareerState).points.strength === 0, "an old save (no gym) loads with a new gym");
  const off = gymExercise(base, { kind: "bench", quality: 1 });
  check(off.career.energy === 60 && off.career.weekActions === 3 && off.career.skills.power === 70 && !off.spentAction && !!off.career.gym, "flag off: only the gym's own numbers change");
  check(base.gym === undefined, "the career passed in is not changed");
  const en = gymExercise(base, { kind: "bench", quality: 1 }, "energy");
  check(en.spentAction && en.career.weekActions === 2 && en.energy > 0, `"energy": a visit is one of the week's things and gives energy (${en.energy})`);
  const en2 = gymExercise(en.career, { kind: "treadmill", quality: 1 }, "energy");
  check(!en2.spentAction && en2.career.weekActions === 2, `"energy": the second machine of the visit is the same visit`);
  // Power on a Strength level up
  const strong = { ...base, gym: { ...newGym(), points: { strength: 95, cardio: 0, focus: 0 }, last: G(3) } } as CareerState;
  const pp = gymExercise(strong, { kind: "bench", quality: 1 }, "energyPowerPace");
  check(pp.power === 1 && pp.career.skills.power === 71 && pp.career.skills.pace === 70, `"energyPowerPace": +1 Power on a Strength level up`);
  const none = gymExercise({ ...base, weekActions: 0 }, { kind: "bench", quality: 1 }, "energy");
  check(!none.spentAction && none.energy === 0, "no week's things left: no energy");
  const v = gymView(off.career.gym!, G(4));
  check(v.stats.length === 3 && v.ring.done.length === 1 && v.window === WINDOW_GAPS, "the view: three stats, the ring, the window");
}

if (problems.length) {
  console.error(`gym: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("gym: three mini-games (length, fail, frame-rate free, seeded), Strength/Cardio/Focus levels, ring, window, slip, sleep + protein, career flag off — all OK");
