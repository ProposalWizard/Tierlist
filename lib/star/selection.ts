import type { CareerState } from "./types";
import { STYLE_SELECTION } from "./manager";
import { getTuning } from "./tuningStore";
import { nextFixtureFor } from "./competitions";
import { attributeOverall } from "./rating";
import { mulberry32 } from "./season";

/**
 * TEAM SELECTION
 *
 * `career.status` was set to "1st Team" when the career was created and never
 * touched again. Boss, team and fans moved after every match and fed nothing but
 * achievement checks and dilemma eligibility — you could be on 3 out of 100 with
 * the manager and still start every week.
 *
 * The manager now picks the side. A run of poor ratings and a manager who has
 * lost patience puts you on the bench, and then out of the squad; from there you
 * win your place back, which is the loop those numbers existed for all along.
 *
 * Two things stop it becoming a death spiral, both deliberate:
 *  - a week out of the side softens the manager (his expectations reset), so
 *    being dropped is recoverable without playing;
 *  - the bench is the middle rung, not the floor, so a bad month costs you
 *    minutes before it costs you the squad.
 */

export type Selection = CareerState["status"];

export interface SelectionVerdict {
  status: Selection;
  /** Minute you come on. 0 when you start; 90 when you do not play at all. */
  onAt: number;
  /** The manager's reasoning, shown to the player. */
  reason: string;
  /** 0-100, the standing the decision came from. Shown so it never feels arbitrary. */
  standing: number;
}

/** A player with no recent games is judged on a neutral performance, not a bad one. */
const NEUTRAL_FORM = 6.5;
/** How many games the manager judges you on. Three (was five), so a run
 *  shows up quickly both ways: three poor games puts your place at risk and
 *  three good ones wins it back (Mikey, 25 Sep 2026: "form bites faster"). */
const FORM_WINDOW = 3;

/**
 * Recent form, over a FIXED five-game window padded with neutral performances.
 *
 * Averaging only the games actually played let a single bad match swing the
 * whole judgement — one 4.2 in your first week benched you, which is not how
 * anybody picks a side. Padding means one poor game moves you a fifth of the
 * way, and it takes a genuine run to cost you your place.
 */
function recentForm(form: number[]): number {
  const recent = form.slice(0, FORM_WINDOW);
  const sum = recent.reduce((s, r) => s + r, 0) + NEUTRAL_FORM * (FORM_WINDOW - recent.length);
  return sum / FORM_WINDOW;
}

const START_AT = 55;    // standing needed to be in the starting eleven
const BENCH_AT = 34;    // …and to make the bench at all

// ── Energy's two hard gates ──────────────────────────────────────────────
//
// Applied on TOP of the standing-based verdict above, not blended into it —
// matchFitness already has a soft 10% say in `selectionStanding`, but these
// two are meant to be an actual floor: no amount of boss goodwill or good
// form talks a manager into starting a player who cannot physically get
// through ninety minutes. A player just short of MIN_ENERGY_TO_START can
// still be trusted with a cameo; short of MIN_ENERGY_TO_SUB, not even that.
export const MIN_ENERGY_TO_START = getTuning("energy.minToStart");
export const MIN_ENERGY_TO_SUB = getTuning("energy.minToSub");

export function selectionStanding(career: CareerState): number {
  const form = recentForm(career.form);
  // Form counts for more than it did (35%, was 30%) and the manager's
  // goodwill a little less (40%, was 45%), so how you are actually playing
  // decides your place sooner.
  return Math.max(0, Math.min(100,
    career.relationships.boss * 0.40
    + (form / 10) * 100 * 0.35
    + (career.starRating / 5) * 100 * 0.15
    + career.matchFitness * 0.10,
  ));
}

// ── Winning your shirt (Mikey, 25 Sep 2026) ──────────────────────────────
//
// Your rival is the best real team-mate in your position. He only matters
// until you've won your shirt at this club:
//  - rated higher than him (a club that signs you as the main man): you start
//    on your own form, as before;
//  - rated the same or lower: he starts ahead of you until you earn it — two
//    or more appearances here with recent form 6.8+ (about a goal and an assist
//    across three cameos), or him going through a
//    bad patch (form under 6.0) while you're doing all right (6.3+).
// Once won, ratings stop mattering: you keep your place on form, fitness and
// the manager, however much higher rated he is. "It's unreasonable to expect
// people to upgrade their training ratings so much at the beginning."
// A generated squad has no ratings, so there's no rival and nothing changes.

export interface ShirtRival { name: string; overall: number; form: number; lastRating: number }

/** His rating for one week — a seeded roll around what a player of his level
 *  usually gets, so his form has real ups and downs. */
function rivalWeek(overall: number, id: string, season: number, week: number): number {
  let h = 0;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rng = mulberry32((h ^ (season * 7919) ^ (week * 104729)) >>> 0);
  const noise = (rng() + rng() + rng() - 1.5) * 1.1;
  return Math.max(4.5, Math.min(9.5, 6.6 + (overall - 75) * 0.02 + noise));
}

export function shirtRival(career: CareerState): ShirtRival | null {
  const pos = career.player.position;
  let best: CareerState["squad"][number] | null = null;
  for (const p of career.squad ?? []) {
    if (p.position !== pos || typeof p.overall !== "number") continue;
    if (!best || (p.overall ?? 0) > (best.overall ?? 0)) best = p;
  }
  if (!best || typeof best.overall !== "number") return null;
  const w = career.week;
  const weeks = [w - 1, w - 2, w - 3].map((k) => rivalWeek(best!.overall!, best!.id, career.season, k));
  return {
    name: best.shortName || best.name,
    overall: best.overall,
    form: weeks.reduce((a, b) => a + b, 0) / weeks.length,
    lastRating: weeks[0],
  };
}

/** Have you won your shirt at this club? */
export function shirtWon(career: CareerState): boolean {
  const here = career.shirt && career.shirt.club === career.player.club ? career.shirt : null;
  if (here?.won) return true;
  // An old save from before this existed: someone already playing keeps his place.
  if (!career.shirt && career.form.length > 0) return true;
  const rival = shirtRival(career);
  if (!rival) return true;
  if (attributeOverall(career.skills) > rival.overall) return true;
  const mine = recentForm(career.form);
  if ((here?.apps ?? 0) >= 2 && mine >= 6.8) return true;
  if (rival.form < 6.0 && mine >= 6.3) return true;
  return false;
}

/** Update the shirt record after a match you played in. */
export function recordAppearance(career: CareerState): CareerState["shirt"] {
  const club = career.player.club;
  const here = career.shirt && career.shirt.club === club ? career.shirt : { club, won: false, apps: 0 };
  const next = { ...here, apps: here.apps + 1 };
  return { ...next, won: next.won || shirtWon({ ...career, shirt: next }) };
}

// ── Cup rotation (Mikey, 25 Sep 2026) ──────────────────────────────────────
// A regular is never rotated out. A player who isn't a regular might start an
// early cup round (anything before the quarter-final) when the manager rests
// his first choices.
const CUP_ROTATION_CHANCE = 0.6;
function earlyCupRound(career: CareerState): boolean {
  const f = nextFixtureFor(career);
  if (!f || f.kind !== "cup") return false;
  const r = f.round ?? "";
  return !/Quarter|Semi|Final/i.test(r);
}

/**
 * Who the manager picks this week.
 *
 * Deterministic in everything except the minute a substitute comes on, which is
 * seeded off the week so it does not change under a re-render.
 */
export function selectionFor(career: CareerState): SelectionVerdict {
  // A medical decision, not a footballing one — overrides everything below,
  // including a red-hot standing. See CareerState.injury's doc comment.
  if (career.injury) {
    const weeks = career.injury.weeksRemaining;
    return {
      status: "Injured",
      onAt: 90,
      standing: 0,
      reason: `${career.injury.note}. Out for ${weeks} more week${weeks === 1 ? "" : "s"}.`,
    };
  }

  const standing = selectionStanding(career);
  const form = recentForm(career.form);

  // The man in the job has a way of doing things. Deliberately symmetric: a
  // trusting manager is harder to lose your place with AND harder to win it
  // back from, so no style is simply better to play for.
  const bend = career.manager ? STYLE_SELECTION[career.manager.style] : { start: 0, bench: 0 };
  const START = START_AT + bend.start;
  const BENCH = BENCH_AT + bend.bench;

  let status: Selection = standing >= START ? "1st Team" : standing >= BENCH ? "Substitute" : "Squad";
  let why: string | null = null;

  // Not yet the first choice here: the better-rated man in your position
  // starts ahead of you until you've won the shirt.
  if (status === "1st Team" && !shirtWon(career)) {
    const rival = shirtRival(career)!;
    status = "Substitute";
    why = `${rival.name} (${rival.overall}) starts ahead of you — his last 3 average ${rival.form.toFixed(1)}, yours ${form.toFixed(1)}. Play well when you come on to take his place.`;
  }

  // An early cup round: the manager rests his regulars, and a player who
  // isn't one gets a start. Seeded off the week so it doesn't change.
  if (status !== "1st Team" && earlyCupRound(career)) {
    const roll = mulberry32((career.season * 131 + career.week * 977) >>> 0)();
    if (roll < CUP_ROTATION_CHANCE) {
      status = "1st Team";
      why = "Cup game — the manager rests some regulars and you start.";
    }
  }

  // Energy's two floors, applied on top of the standing verdict just picked —
  // never upgrading it, only ever pulling it down. See the constants' own
  // comment above.
  if (status === "1st Team" && career.energy < MIN_ENERGY_TO_START) status = "Substitute";
  if (status === "Substitute" && career.energy < MIN_ENERGY_TO_SUB) status = "Squad";

  if (status === "1st Team") {
    return {
      status,
      onAt: 0,
      standing,
      reason: why ?? (standing >= 78
        ? "First name on the team sheet."
        : "You start."),
    };
  }

  if (status === "Substitute") {
    // Somewhere in the last half hour. Seeded off the week so it is stable.
    const onAt = 58 + ((career.week * 37 + career.season * 11) % 15);
    return {
      status,
      onAt,
      standing,
      reason: career.energy < MIN_ENERGY_TO_START
        ? "Too fatigued to start — fit enough for the bench, not for ninety minutes."
        : why
        ? why
        : career.relationships.boss < 40
        ? "The manager has left you out. You are on the bench."
        : `Form has dipped (${form.toFixed(1)} avg). You start on the bench.`,
    };
  }

  return {
    status,
    onAt: 90,
    standing,
    reason: career.energy < MIN_ENERGY_TO_SUB
      ? "Running on empty — not fit enough to risk, even off the bench."
      : career.relationships.boss < 30
      ? "You are not in the squad. The manager has made his feelings clear."
      : "You are not in the squad this week.",
  };
}

/**
 * WHEN A SUBSTITUTE COMES ON — follows the game (Mikey, 25 Sep 2026).
 *
 * It used to be a fixed minute between 58 and 72 whatever the score. Now the
 * manager reads the scoreline from the 50th minute: two down and you're on
 * straight away, one down just before the hour, level around 64, protecting
 * a one-goal lead around 72, and well ahead only for the last ten minutes.
 * `jitter` (0-4 minutes, seeded off the week) stops it being the same
 * minute every time.
 */
export function subComesOnNow(minute: number, scoreDiff: number, jitter = 0): boolean {
  const at = scoreDiff <= -2 ? 50 : scoreDiff === -1 ? 56 : scoreDiff === 0 ? 64 : scoreDiff === 1 ? 72 : 80;
  return minute >= at + jitter;
}

/**
 * A week spent not playing.
 *
 * You lose sharpness and you are paid, and the manager softens a little —
 * without that last part a bad run could put you somewhere you could never
 * climb out of, because the only thing that raises the boss relationship
 * quickly is playing well.
 */
export const MISSED_WEEK = {
  matchFitness: -7,
  boss: +3,
  energy: getTuning("energy.missedWeekEnergy"),
};

/**
 * BEING TAKEN OFF
 *
 * The manager has three reasons to take a player off, and this models all
 * three, including the flattering one — being rested with the game won is
 * not a punishment and should not read as one.
 */
export type HookReason = "form" | "rested" | "legs";

/** Below this live, in-match energy, tired legs start to become a real risk
 *  of being hooked — see hookCheck's `args.liveEnergy`. */
const HOOK_LEGS_FLOOR = getTuning("energy.hookLegsFloor");

export interface HookDecision {
  hooked: boolean;
  reason: HookReason | null;
  message: string;
}

/** Nobody is hooked before the hour, or within a quarter of an hour of coming on. */
const HOOK_EARLIEST = 60;
const HOOK_SETTLE_IN = 15;

export function hookCheck(args: {
  minute: number;
  startMinute: number;
  liveRating: number;
  /** Your goals minus theirs. */
  scoreDiff: number;
  rng: () => number;
  /** The live, in-match energy value at this point (see CanvasMatch's
   *  liveEnergyRef). Optional and defaults to fully fresh — a caller that
   *  does not track it (the star-match-dev fork, older tests) simply never
   *  sees a "legs" hook, the same as before this was reinstated. */
  liveEnergy?: number;
}): HookDecision {
  const none: HookDecision = { hooked: false, reason: null, message: "" };
  if (args.minute < HOOK_EARLIEST) return none;
  if (args.minute - args.startMinute < HOOK_SETTLE_IN) return none;

  // Later is likelier, in both cases — a manager who was going to change it
  // has more reason to as the clock runs down.
  const late = Math.max(0, Math.min(1, (args.minute - HOOK_EARLIEST) / 30));

  // Legs gone. Checked ahead of form/rested — a knackered player is the
  // manager's first read on why the game got away from him, not a symptom
  // he waits to see reflected in the rating.
  const liveEnergy = args.liveEnergy ?? 100;
  if (liveEnergy < HOOK_LEGS_FLOOR) {
    const p = (0.16 + late * 0.3) * (1 - liveEnergy / HOOK_LEGS_FLOOR);
    if (args.rng() < p) {
      return { hooked: true, reason: "legs", message: "Legs gone — you are withdrawn before you get injured." };
    }
  }

  // A bad afternoon.
  //
  // The threshold is 6.05 rather than the 5.6 that reads like a poor mark,
  // because of where the rating formula actually LIVES: it starts at 6.0 and the
  // only thing that can pull it down is a defeat, worth 0.3. A contributionless
  // game while losing bottoms out at 5.7, so a 5.6 threshold could never once
  // have fired. Six flat means you have done nothing all afternoon, which is
  // exactly the game a manager changes.
  if (args.liveRating < 6.05) {
    const p = (0.1 + late * 0.22) * Math.min(1, (6.05 - args.liveRating) / 0.4);
    if (args.rng() < p) {
      return { hooked: true, reason: "form", message: "Your number is up. You are replaced." };
    }
  }

  // Game won, legs saved for the next one. A compliment, not a hook.
  if (args.scoreDiff >= 3 && args.minute >= 72) {
    if (args.rng() < 0.14 + late * 0.2) {
      return { hooked: true, reason: "rested", message: "Job done — you get a standing ovation as you come off." };
    }
  }

  return none;
}
