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
import { GAME_NAMES, HOW_TO, MAX_SECS } from "../../lib/star/gym/games";
import { GYM2_KINDS, start2, step2, SQUAT, type pullupStart, type squatStart, type Gym2State } from "../../lib/star/gym/games2";
import { hudView } from "../../lib/star/gym/hudView";
import { STAT_MIX, STAT_OF, bodyPoints } from "../../lib/star/gym/progress";
import { gymBodyScale, pointsForLevel } from "../../lib/star/gym/body";
import { setGymEffectForTest, gymEffectMode, gymSkillBonus, recoveryScale, lateEnergyBack, resilienceInjuryScale, LASTING_BONUS, MATCH_LIFT, LATE_DRAIN_CUT, RECOVERY_BOOST, INJURY_SCALE } from "../../lib/star/gym/effect";

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
  for (let i = 0; i < 2000 && !s.done; i++) s = benchStep(s, 1 / 60, s.phase === "up");
  check(s.strikes === BENCH.strikesOut && s.done && resultOf(s).failed && s.reps === 0, `bench: let go at the top and it bounces, two strikes end it (${s.strikes} strikes, ${s.reps} reps)`);
  // a full good set: 8 reps, most lowered slowly
  const g = play("bench", 60) as ReturnType<typeof benchStart>;
  check(g.reps === BENCH.reps && g.clean >= BENCH.reps - 1, `bench: the good set is ${BENCH.reps} reps, lowered slowly (${g.reps}, ${g.clean} slow)`);
  // lower it slowly, press a little, let go: back onto the chest gently, no rep, no strike
  let h = benchStart(1);
  for (let i = 0; i < 600 && h.phase === "down"; i++) h = benchStep(h, 1 / 60, h.v < -0.55);
  for (let i = 0; i < 8; i++) h = benchStep(h, 1 / 60, true);
  for (let i = 0; i < 60; i++) h = benchStep(h, 1 / 60, false);
  check(h.reps === 0 && h.strikes === 0 && h.bar === 0, `bench: giving up low is no rep and no harm (${h.reps}, ${h.strikes}, ${h.bar})`);
  // stronger lifters push harder
  check(benchStep({ ...benchStart(4), bar: 0, phase: "up" }, 0.4, true).bar > benchStep({ ...benchStart(1), bar: 0, phase: "up" }, 0.4, true).bar, "bench: Strength 4 pushes faster than Strength 1");
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
  check(v.stats.length === 4 && v.ring.done.length === 1 && v.window === WINDOW_GAPS, "the view: four stats, the ring, the window");
}

// ── phase 2: the ten new exercises ──
for (const kind of GYM2_KINDS) {
  const a = play(kind, 30), b = play(kind, 120);
  check(a.done && a.t >= 20 && a.t <= 40, `${kind}: a decent player's go lasts 20-40 s (${a.t.toFixed(1)} s)`);
  const ra = resultOf(a), rb = resultOf(b);
  check(ra.quality >= 0.6 && !ra.failed, `${kind}: a decent player does well (${ra.quality}, ${ra.headline})`);
  check(rb.quality >= 0.6 && !rb.failed, `${kind}: good at 120 fps too (${rb.quality})`);
  check(Math.abs(ra.quality - rb.quality) < 0.08, `${kind}: the same thumb, about the same grade at 30 and 120 fps (${ra.quality} vs ${rb.quality})`);
  const fixed = (fps: number) => { let s: GameState = startGame(kind, 1, 3); for (let i = 0; i < fps * 45 && !s.done; i++) s = stepGame(s, 1 / fps, Math.floor(s.t * 2.5) % 3 !== 0); return resultOf(s).quality; };
  const f30 = fixed(30), f120 = fixed(120);
  check(Math.abs(f30 - f120) < 0.05, `${kind}: a fixed thumb is the same at 30 and 120 fps (${f30} vs ${f120})`);
  const bad = resultOf(play(kind, 60, 0));
  check(bad.failed && bad.quality < ra.quality, `${kind}: a poor thumb fails it (${bad.headline})`);
  check(JSON.stringify(play(kind, 60, 1, 9)) === JSON.stringify(play(kind, 60, 1, 9)), `${kind}: seeded`);
  check(!!GAME_NAMES[kind] && !!HOW_TO[kind] && MAX_SECS[kind] >= 20 && MAX_SECS[kind] <= 40, `${kind}: named, explained, at most 40 s`);
  check(Object.values(STAT_MIX[kind]).reduce((x, y) => x + (y ?? 0), 0) === 1 && !!STAT_OF[kind], `${kind}: feeds the stats (shares add to 1)`);
}
{
  // each thumb is its own: the specific fails
  let p = start2("pullup", 1, 1) as ReturnType<typeof pullupStart>;
  for (let i = 0; i < 6000 && !p.done; i++) p = step2(p, 1 / 60, i % 2 === 0) as typeof p; // mash every frame: 30 taps a second
  check(p.dropped, "pull-ups: mashing burns the grip and you drop off the bar");
  let q = start2("squat", 1, 1) as ReturnType<typeof squatStart>;
  for (let i = 0; i < 6000 && !q.done; i++) q = step2(q, 1 / 60, true) as typeof q; // never let go
  check(q.strikes >= SQUAT.strikesOut && resultOf(q).failed, "squat: never letting go = stuck in the hole");
  let pl = start2("plank", 1, 1);
  for (let i = 0; i < 6000 && !pl.done; i++) pl = step2(pl, 1 / 60, false); // never brace
  check(resultOf(pl).failed, "plank: never bracing = the hips drop");
  // Resilience exercises feed Resilience
  for (const k of ["nordic", "copenhagen", "landing", "mobility"] as const) check((STAT_MIX[k].resilience ?? 0) >= 0.7, `${k} feeds Resilience`);
  check(STAT_OF.pullup === "strength" && STAT_OF.squat === "strength" && STAT_OF.ladder === "cardio" && STAT_OF.nordic === "resilience", "main stats");
}
// ── phase 2: the screen's meter for each new game (lib/star/gym/hudView.ts) ──
for (const kind of GYM2_KINDS) {
  let s = startGame(kind, 1, 3) as Gym2State, okAll = true;
  for (let i = 0; i < 60 * 40 && !s.done; i++) {
    s = stepGame(s, 1 / 60, botHold(s, 1)) as Gym2State;
    if (i % 30) continue;
    const v = hudView(s);
    const inRange = (x?: number) => x === undefined || (x >= -0.2 && x <= 1.2);
    if (!v.big || !v.cue || !inRange(v.meter?.marker) || !inRange(v.ring) || (v.dots ?? []).some((d) => !inRange(d))) okAll = false;
  }
  check(okAll, `${kind}: the screen always has a count, a cue and a meter in range`);
}
// ── phase 2: the ring of three, Resilience, the body trail ──
{
  const g0 = { ...newGym(), last: G(1) } as GymState; // window open
  const a = doExercise(g0, G(2), { kind: "nordic", quality: 1 });
  check(a.by.resilience === MACHINE_POINTS && a.gym.points.resilience === MACHINE_POINTS, `Nordic: Resilience +${a.by.resilience}`);
  const mixed = doExercise(g0, G(2), { kind: "ladder", quality: 1 });
  check(mixed.by.cardio === 24 && mixed.by.focus === 16, `the ladder shares: Cardio 24, Focus 16 (${JSON.stringify(mixed.by)})`);
  // three Strength exercises: the visit is full but the ring is not closed (one kind of training)
  let s = doExercise(g0, G(2), { kind: "bench", quality: 1 }).gym;
  s = doExercise(s, G(2), { kind: "pullup", quality: 1 }).gym;
  const third = doExercise(s, G(2), { kind: "squat", quality: 1 });
  check(!third.ringClosed && third.gym.points.strength === PER_GAP_MAX, `three Strength: no ring, and Strength stops at ${PER_GAP_MAX} this gap (${third.gym.points.strength})`);
  const fourth = doExercise(third.gym, G(2), { kind: "nordic", quality: 1 });
  check(fourth.why === "ringFull" && fourth.gained === 0, "after three, a fourth pays nothing");
  // three covering two stats closes it
  let m = doExercise(g0, G(2), { kind: "pullup", quality: 1 }).gym;
  m = doExercise(m, G(2), { kind: "squat", quality: 1 }).gym;
  const close = doExercise(m, G(2), { kind: "mobility", quality: 1 });
  check(close.ringClosed && close.gym.rings === 1, "three covering two stats close the ring");
  check(close.gym.points.resilience === MACHINE_POINTS + close.ringBonus && close.gym.points.focus === 0, "the bonus goes to what you trained (Resilience yes, Focus no)");
  // Resilience slips half, Focus never
  const r = { ...newGym(), points: { strength: 200, cardio: 200, focus: 200, resilience: 200 }, last: G(1) } as GymState;
  const later = gymAt(r, G(1 + WINDOW_GAPS + 1)).gym.points;
  check(later.strength === 200 - SLIP && later.resilience === 200 - SLIP / 2 && later.focus === 200, `slips: Strength -${SLIP}, Resilience -${SLIP / 2}, Focus 0`);
  // an old phase 1 gym loads with Resilience 0
  const old = gymOf({ gym: { v: 1, points: { strength: 50, cardio: 10, focus: 5 }, visits: 1, rings: 0 } as unknown as GymState });
  check(old.points.resilience === 0 && old.points.strength === 50, "a phase 1 save gets Resilience 0");
  // the body: nothing until a window after the first visit, then the points from then
  const v1 = doExercise(newGym(), G(1), { kind: "bench", quality: 1 }).gym;
  check(bodyPoints(v1, G(1)).strength === 0 && bodyPoints(v1, G(1 + WINDOW_GAPS)).strength === v1.points.strength, `the body catches up a window later (${bodyPoints(v1, G(1 + WINDOW_GAPS)).strength})`);
  const v2 = doExercise(v1, G(2), { kind: "bench", quality: 1 }).gym;
  check(bodyPoints(v2, G(3)).strength === v1.points.strength && bodyPoints(v2, G(4)).strength === v2.points.strength, "the body lags the stat by one window");
  const lapsed = bodyPoints(v2, G(30));
  check(lapsed.strength <= gymAt(v2, G(30)).gym.points.strength, "the body never shows more than the stat now (it fades with a lapse)");
}
// ── phase 2: the body's shape ──
{
  const top = gymBodyScale({ strength: MAX_POINTS, cardio: 0 }), lean = gymBodyScale({ strength: 0, cardio: MAX_POINTS }), none = gymBodyScale({ strength: 0, cardio: 0 });
  check(none.join() === "1,1,1", "no gym, no change");
  check(Math.abs(top[0] - 1.045) < 1e-6 && top[1] === 1, `Strength 4: +4.5% across, height the same (${top})`);
  check(lean[0] < 1 && lean[2] < 1 && lean[1] === 1, `Cardio 4 leans him out (${lean})`);
  let ok = true;
  for (let s = 0; s <= 400; s += 25) for (let c = 0; c <= 400; c += 25) { const k = gymBodyScale({ strength: s, cardio: c }); if (k[1] !== 1 || k[0] < 0.98 || k[0] > 1.0451 || k[2] < 0.97 || k[2] > 1.031) ok = false; }
  check(ok, "every shape within 0.98..1.045 across, 0.97..1.03 front to back, height exactly 1");
  check(pointsForLevel(1) === 0 && pointsForLevel(4) === MAX_POINTS, "the slider's levels");
}
// ── phase 2: the career effect (option C), off and on ──
{
  const strong = { ...newGym(), points: { strength: 250, cardio: 120, focus: 0, resilience: 300 }, last: G(4) } as GymState;
  const c0 = { season: 1, week: 4, energy: 80, gym: strong, skills: { pace: 70, power: 70 } } as unknown as CareerState;
  check(gymEffectMode() === "off", "the effect is OFF by default");
  check(gymSkillBonus(c0).power === 0 && recoveryScale(c0) === 1 && lateEnergyBack(c0, 60, 90) === 0 && resilienceInjuryScale(c0) === 1, "off: no Power, no Pace, no energy, no injury change");
  setGymEffectForTest("mix");
  const b = gymSkillBonus(c0);
  check(b.lasting.power === LASTING_BONUS[2] && b.lasting.pace === LASTING_BONUS[1] && b.lift === 0, `on: Strength 3 = Power +${b.lasting.power}, Cardio 2 = Pace +${b.lasting.pace}, no visit = no lift`);
  let vis = doExercise(strong, G(4), { kind: "bench", quality: 1 }).gym;
  check(gymSkillBonus({ ...c0, gym: vis }).lift === MATCH_LIFT.trained, "one exercise this gap: +1 next match");
  vis = doExercise(vis, G(4), { kind: "treadmill", quality: 1 }).gym;
  vis = doExercise(vis, G(4), { kind: "nordic", quality: 1 }).gym;
  check(gymSkillBonus({ ...c0, gym: vis }).lift === MATCH_LIFT.ring, "the ring closed: +2 next match");
  check(gymSkillBonus({ ...c0, week: 5, gym: vis }).lift === 0, "the lift is gone after that match (the next gap)");
  const maxed = { ...c0, gym: { ...strong, points: { strength: 300, cardio: 300, focus: 300, resilience: 300 } } } as CareerState;
  check(gymSkillBonus(maxed).power <= 5 + MATCH_LIFT.ring && LASTING_BONUS[3] === 5, "capped: +5 lasting, +7 with the lift");
  check(Math.abs(lateEnergyBack(c0, 60, 90) - 60 * (30 / 90) * LATE_DRAIN_CUT[3]) < 1e-9 && lateEnergyBack(c0, 20, 30) === 0, `Resilience 4: ${lateEnergyBack(c0, 60, 90).toFixed(1)} energy back from a 60-energy match; a 30-minute sub, none`);
  check(recoveryScale(c0) === 1 + RECOVERY_BOOST[3] && resilienceInjuryScale(c0) === INJURY_SCALE[3], "Resilience 4: rest days ×1.08, injury chance ×0.75 (the hook)");
  // a missed window takes the lasting gain down with it
  check(gymSkillBonus({ ...c0, week: 4 + WINDOW_GAPS * 3 + 1 }).lasting.power < b.lasting.power, "a lapse slips the lasting gain");
  // the visit costs one of the week's things in "mix", gives no energy
  const mixOut = gymExercise({ ...c0, weekActions: 3, gym: undefined } as unknown as CareerState, { kind: "bench", quality: 1 }, "mix");
  check(mixOut.spentAction && mixOut.career.weekActions === 2 && mixOut.energy === 0, `"mix": a visit is one of the week's things, no energy`);
  setGymEffectForTest(null);
  check(gymSkillBonus(c0).power === 0, "back off after the test");
}

if (problems.length) {
  console.error(`gym: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("gym: thirteen mini-games (length, fail, frame-rate free, seeded), four stats with Resilience, the ring of three, window, slip, sleep + protein, the body trail and shape, the career effect off and on — all OK");
