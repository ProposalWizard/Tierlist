import {
  freeKickDrill, visionDrill, strikeSpot, shotQuality,
  type FreeKickDrillConfig, type VisionDrillConfig,
} from "./trainingDrills";
import {
  difficultyFor, keeperBonusFor, adversityOn,
  type TrialProgress, type TrialStage,
} from "./trial";
import { CX, PEN_SPOT_Y } from "./pitch";

/**
 * THE FOUR STAGES BEFORE THE FIVE-A-SIDE.
 *
 * Penalties, free kicks, taking a man on, and finding the pass. What each one
 * ASKS of you, and what your attempt at it was WORTH — the numbers, with no
 * pictures. The screens read this; they do not decide any of it.
 *
 * ── Built on the ladders that already exist ──
 *
 * `trainingDrills.ts` already knows how to make a striking drill harder: how
 * far out to put the ball, how many men in the wall, how good the keeper is,
 * how long you get to pick a pass and how much better the right pass is than
 * the wrong one. Those ladders are tuned, they are already what training feels
 * like, and reusing them means the trial feels like the same game rather than
 * a separate one bolted onto the front of it.
 *
 * The one translation this file makes: a drill's ladder is indexed by YOUR
 * STAT (a vision-70 player gets the vision-70 drill). A trial is indexed by
 * how hard the DAY is — which is the same 0-1 scale pointed at a different
 * thing, so difficulty 0 asks the bottom rung of the ladder and difficulty 1
 * asks the top.
 *
 * ── Everything is scored relative to what was asked ──
 *
 * Each stage reports a 0-1 quality, never a pass/fail and never a score out of
 * a hundred. `trial.ts` applies the difficulty scaling on top; doing it here
 * as well would apply it twice, which is a mistake the five-a-side's own
 * scoring already made once and had to have measured out of it.
 */

/** A trial difficulty (0-1) as a rung on a drill's own ladder (0-100). */
export function ladderLevel(difficulty: number): number {
  return Math.max(0, Math.min(100, (Number.isFinite(difficulty) ? difficulty : 0) * 100));
}

/**
 * THE SEED EVERY "WHAT DOES THIS REP ASK" ROLL IS DRAWN FROM.
 *
 * `trial.seed` alone is not it, and the difference is the whole of a real bug
 * this file shipped with.
 *
 * Seeding off the bare seed makes a rep reproducible, which is what the trial
 * wants BETWEEN stages: come back and you are looking at the same afternoon.
 * But a stage's rep counter lives in React state and is not saved, so coming
 * back MID-STAGE restarts it at rep 1 — and if the answer to rep 1 is a pure
 * function of `trial.seed`, it is the same answer you were shown a moment ago.
 * Play the vision stage through once watching which man rings green, close the
 * app, reopen: six remembered taps, near-perfect score, no football in it at
 * all. The same trick retakes a penalty stage against a keeper who leans the
 * same way every time.
 *
 * `reloads` is the fix, and it is already exactly the right number: the trial
 * counts a resume for its own difficulty bump, so a resume is already a thing
 * the trial knows happened. Folding it in here means a resumed stage draws
 * genuinely NEW problems — at the bumped difficulty — rather than a second
 * showing of the ones whose answers you have just memorised.
 *
 * Mixed rather than added: `seed ^ reloads` would collide across trials whose
 * seeds differ in the low bits, and the low bits are exactly where a small
 * integer lives.
 */
export function attemptSeed(trial: TrialProgress): number {
  const reloads = Math.max(0, Math.floor(Number.isFinite(trial.reloads) ? trial.reloads : 0));
  return (((trial.seed >>> 0) ^ ((reloads + 1) * 0x9e3779b1)) >>> 0);
}

/**
 * How many attempts each stage gives you. Enough that one fluke neither makes
 * nor breaks it; few enough that the whole trial is minutes, not an evening.
 *
 * ── Penalties is FOUR, and it is a floor rather than a preference ──
 *
 * Three was asked for by name. Do not quietly put it back.
 *
 * `strikeQuality` bands an attempt widely on purpose — a block is 0.16, a
 * save 0.34, a goal 0.55 to 1.0 depending on where it crossed — so a single
 * unlucky rep moves a short stage's mean by roughly a fifth of the whole
 * scale. Measured against the real bands in `tests/star/trialStages.mts`,
 * with a taker who scores 70 % of his penalties against one who scores 50 %,
 * and counting how often the WORSE of the two comes out ahead over a stage:
 *
 *   3 reps — 32.1 %      4 reps — 29.4 %      6 reps — 25.2 %
 *
 * Worth being straight about what that does and does not say. Four is a real
 * improvement on three and it is not a large one; the curve is shallow, and
 * a stage short enough to sit inside a five-stage trial is never going to be
 * a clean read on a player. Four is the point where the stage stops being
 * decided by one kick without turning the trial into an evening — a floor
 * arrived at by measurement, not an optimum. If the trial ever gets room to
 * breathe, five or six is strictly better and the numbers above say by how
 * much.
 *
 * Four also happens to be exactly the length the tell ramp wants: rep 1 is
 * the telegraphed one, rep 2 is shaded, and reps 3 and 4 are the pure
 * placement test the stage builds toward (`PENALTY_TELL_RAMP`).
 */
export const REPS: Record<Exclude<TrialStage, "fiveASide">, number> = {
  penalties: 4,
  freeKicks: 4,
  dribbling: 3,
  vision: 6,
};

// ── 1. Penalties ────────────────────────────────────────────────────────

export interface PenaltySetup {
  /** Where the ball sits — the spot, always. */
  ball: { x: number; y: number };
  /** 0-100, how good the keeper is. */
  keeperStrength: number;
  /** Which way he is favouring, -1 left … 1 right. A keeper who guesses is
   *  what makes a penalty a decision rather than a formality; zero means he
   *  has not committed and you are simply picking a corner. */
  keeperLean: number;
  /**
   * How far he sets off along his line the moment the ball is struck, in
   * metres — 0 meaning he holds his ground and backs himself to react.
   *
   * The direction is `keeperLean`'s own sign; this is only the distance. See
   * `penaltyCommit` for why this exists at all, and `commitKeeperGuess` in
   * TrialPenalties.tsx for what does it.
   */
  keeperCommit: number;
}

/**
 * HOW MUCH OF HIS GUESS HE SHOWS YOU — the whole of what this stage is.
 *
 * ── It used to run backwards ──
 *
 * The scaling was `0.3 + 0.7 × d`: the harder the trial, the FURTHER off
 * centre he stood before you had even started your run-up. A difficulty-1
 * keeper announced his guess at full volume and a difficulty-0 keeper barely
 * moved, so the hardest penalties in the game were the ones where the answer
 * was most obvious.
 *
 * ── And it used to be the same decision five times ──
 *
 * Fixing the direction left a second problem that the fix could not reach:
 * every rep asked the identical question at identical odds. A proposal to
 * make the keeper "react faster each rep" turned out to be unbuildable —
 * `stepKeeper` does not react to the ball at all (its own header: "He does
 * not advance. He breathes."), the save is a reach test at the moment the
 * ball passes his line, and the dive is animation played out after the
 * outcome is already decided. That blindness is load-bearing: `launch`'s own
 * note says it is why curl and placement can reliably beat him.
 *
 * So the ramp is on the TELL instead, which is real and is already here:
 *
 *   rep 1 — he is committed. Read him and shoot the other way.
 *   rep 2 — he is shading. There is something to see, but you have to look.
 *   rep 3+ — he shows you nothing. A pure placement test.
 *
 * Three genuinely different decisions rather than one decision at worse odds.
 *
 * ── Why the magnitude is the ramp and the SIDE is the random part ──
 *
 * The lean used to be a uniform random number scaled by difficulty, so how
 * much there was to see was itself a dice roll — a rep could draw a lean of
 * 0.03 and read as "he hasn't shown you a thing" on what was meant to be the
 * telegraphed one. Now the magnitude is exactly what the rep asks for and
 * only WHICH WAY he goes is drawn, so rep 1 genuinely is the readable one on
 * every trial. The on-screen line (TrialPenalties.tsx's subtitle) still
 * reports the magnitude honestly and still never names the side.
 *
 * ── The sharp-keeper collision ──
 *
 * A sharp keeper and a vanished tell land on the same stage often enough to
 * have been worth measuring rather than guarding against by reflex. See the
 * note above `penaltyTell` for the numbers, and for the tell floor that was
 * built, measured, found to be worth four centimetres, and deleted.
 */
export const PENALTY_TELL_EASY = 1;
/**
 * The tell at the hardest possible afternoon.
 *
 * Raised from 0.25 when the rep ramp landed, and the reason is arithmetic
 * rather than taste: the ramp multiplies this, so at 0.25 a difficulty-1
 * trial showed 0.25 / 0.105 / 0.03 across the three steps — which is
 * "shading", "nothing", "nothing". The three-way shape the ramp exists to
 * create collapsed to two on exactly the afternoons that most need the
 * variety. At 0.6 the hardest trial shows 0.60 / 0.25 / 0.07, which still
 * lands in all three bands the subtitle reads, and difficulty keeps biting
 * where it always has: `keeperStrength`, which runs 45 → 90.
 */
export const PENALTY_TELL_HARD = 0.6;

/**
 * The ramp itself, one entry per step, holding at the last one.
 *
 * Four penalties are taken and there are three entries: rep 4 stays on the
 * pure placement test rather than cycling back to a telegraphed one. That is
 * deliberate — the stage builds toward the hardest version of itself and
 * stays there, the way a session of penalties against a keeper who has
 * stopped guessing actually would.
 *
 * ── A ramp against a flat mean would have made the stage WORSE ──
 *
 * This is why the ramp and `REP_WEIGHT_RAMP` had to land together rather than
 * one after the other. A stage used to score `mean(rep qualities)`, and the
 * only difficulty credit anywhere is `SCORE_DIFFICULTY_SPAN` — five points,
 * for the whole trial, not for a rep. So turning rep 4 into the hardest thing
 * in the stage while every rep still counted the same would have paid nothing
 * at all for surviving it and charged full price for fluffing it: strictly a
 * worse deal than the flat version it replaced. See `weightedQuality`.
 *
 * The values are chosen against the three bands TrialPenalties' own subtitle
 * reads (> 0.55, > 0.22, and the rest), at BOTH ends of the difficulty range.
 * `tests/star/trialStages.mts` pins that: if either of these numbers or
 * either threshold moves, the test says which rep stopped landing where it
 * was meant to.
 */
export const PENALTY_TELL_RAMP = [1, 0.42, 0.12];

/**
 * ── THE SHARP KEEPER STANDING BEHIND THE NO-TELL REP: MEASURED ──
 *
 * The worry was specific and it was worth having. `keeperBonusFor` adds +15
 * to a keeper already at 45 + 45·d, and the ramp takes the tell to nothing by
 * the third kick — the biggest save radius in the game standing behind the one
 * rep that tells you nothing, on the same stage, stacking. Nobody had ever run
 * that combination, and the two mitigations on the table were a tell floor
 * whenever an adversity event is live, or making the adversity pick a
 * different stage.
 *
 * Neither was needed. `tests/star/trialStageScreens.mts` drives the screen's
 * own `buildPenaltyScenario` through the real engine with a taker who reads
 * the lean when there is one and picks a side when there is not. The table
 * below is a 1,200-strike run per cell; the permanent regression check in
 * that file runs 500 a cell, which is plenty to catch a lockout and quick
 * enough to sit in the suite:
 *
 *                              rep 1        rep 3 (no tell)
 *   good taker, hard day       94 → 93 %      75 → 65 %
 *   poor taker, hard day       91 → 89 %      61 → 52 %
 *   good taker, hardest day    92 → 92 %      67 → 64 %
 *   poor taker, hardest day    87 → 86 %      53 → 51 %
 *                            (clean → sharp keeper)
 *
 * So the worst cell in the game — a poor taker, the hardest afternoon, a
 * keeper on fire, and the rep that shows him nothing — still scores one in
 * two. A real step down and a long way from unwinnable, which is exactly the
 * shape the stacking should have.
 *
 * ── The floor that was there, and why it is gone ──
 *
 * A first version of this DID add a tell floor (0.1) whenever a non-flavour
 * event was live. The measurement is what killed it: on the hardest day the
 * ramped tell is 0.072 and the floor would have lifted it to 0.100, which
 * through `PENALTY_LEAN_M` is four centimetres of keeper. Nobody reads four
 * centimetres. It was a constant that looked like a safety net and was a
 * placebo, and since the thing it was protecting against does not happen, it
 * is deleted rather than kept as reassurance.
 */

/** How much of his guess is visible on a given rep of a given trial, 0-1. */
export function penaltyTell(trial: TrialProgress, rep: number): number {
  const d = difficultyFor(trial, "penalties");
  const i = Math.max(0, Math.floor(Number.isFinite(rep) ? rep : 0));
  const step = PENALTY_TELL_RAMP[Math.min(i, PENALTY_TELL_RAMP.length - 1)];
  const ceiling = PENALTY_TELL_EASY + (PENALTY_TELL_HARD - PENALTY_TELL_EASY) * d;
  const tell = step * ceiling;
  // The one event whose entire content is a smaller tell.
  return adversityOn(trial, "penalties")?.id === "cold-keeper"
    ? tell * COLD_KEEPER_TELL
    : tell;
}

/**
 * What the "gives nothing away" event does: most of the tell, gone.
 *
 * Note what it deliberately does NOT do — reach past the ramp. By rep 3 the
 * ramp has already taken the tell to nothing on its own, so this event bites
 * on the first two kicks and then has nothing left to take. Measured: it
 * costs a good taker on a hard day 94 → 85 % on rep 1 and 89 → 74 % on rep 2,
 * and is worth nothing at all on reps 3 and 4. That is the honest behaviour
 * for an event that removes information rather than adding difficulty, and
 * it is why its weight sits just under the sharp keeper's rather than well
 * under it: across the whole stage the two cost almost exactly the same
 * (−6.0 and −6.4 points of conversion respectively).
 */
export const COLD_KEEPER_TELL = 0.35;

/**
 * ── WHETHER HE ACTUALLY GOES, AND HOW FAR ──
 *
 * The trial penalty was very nearly unmissable, and measuring it found
 * something more useful than "make the keeper better".
 *
 * Conversion of a real trial penalty through the real engine, by how far off
 * centre it was aimed (n = 300 a point): 2.7 % down the middle, 52.3 % at
 * 2 m, and **88.0 % in the corner**. With the stage's own tell in play:
 * read the lean and shoot the other way, 99.8 % — and with the lean deleted
 * entirely, 99.5 %. **The tell was worth three tenths of a point.** So the
 * ramp was never the lever, and shrinking it would have fixed nothing.
 *
 * The cause is geometry, not strength. `keeperAttempt` only fires when the
 * ball reaches the keeper's OWN line, and nothing moves him before then, so
 * the save collapses to a static test of `|xCross − keeper.x|` against a save
 * radius that measures 2.37 m on a real trial penalty — against a goal half
 * width of 3.66 m. **A band roughly 1.0-1.3 m inside each post cannot be
 * saved at any keeper strength**; even a 99-rated keeper reaches 2.65 m, a
 * metre short of the post. `keeperStrength` genuinely cannot reach this.
 *
 * What a penalty actually is, is a guess made before the ball is struck. So
 * he makes one: `commitKeeperGuess` (TrialPenalties.tsx) sets him travelling
 * the instant it is hit, and this decides whether and how far.
 *
 * ── Both numbers are measured, and the first one that was tried was wrong ──
 *
 * The obvious version — he always goes, as far as the engine lets him
 * (3.2 m) — was built first and measured, and it replaced "too easy" with
 * "no football in it at all": a corner converted 0 % when he guessed right
 * and 100 % when he guessed wrong, so placement stopped mattering entirely
 * and the stage became a coin flip. Worse, he vacated the middle every time,
 * which turned a 2.7 % shot into a 96.8 % one.
 *
 * A grid over (how far, how often), n = 250 a cell, against two targets: a
 * corner should convert about what the same shot converts in a real match's
 * `one_on_one` (64-71 %), and the middle should stay clearly the worst
 * option so that placement still means something.
 *
 *   how far   how often   corner   2 m out   middle
 *     1.4 m      65 %      74.0 %   46.0 %    9.6 %
 *     1.4 m      80 %      67.2 %   47.6 %   12.8 %   ← the shape wanted
 *     1.9 m      80 %      59.2 %   47.6 %   46.8 %
 *     3.2 m     100 %      50.0 %   50.0 %   96.0 %   ← the first attempt
 *
 * 1.4 m is the whole point: it is far enough that a correct guess puts the
 * corner right at the edge of his reach — a marginal save rather than a
 * certainty — and short enough that he never abandons the middle. How OFTEN
 * he commits is then the difficulty dial, which is the honest place for it.
 */
export const PENALTY_COMMIT_M = 1.4;
export const PENALTY_COMMIT_CHANCE_EASY = 0.65;
export const PENALTY_COMMIT_CHANCE_HARD = 0.95;

/** Metres he sets off to travel on this rep, or 0 if he holds his ground. */
export function penaltyCommit(trial: TrialProgress, rep: number): number {
  const d = difficultyFor(trial, "penalties");
  const chance = PENALTY_COMMIT_CHANCE_EASY
    + (PENALTY_COMMIT_CHANCE_HARD - PENALTY_COMMIT_CHANCE_EASY) * d;
  // The same seeded-wobble idiom `penaltySetup` already uses for the side, on
  // its own multipliers so the two draws can never move together — a rep where
  // he leans left must not also be the rep where he always commits.
  const wobble = Math.sin((attemptSeed(trial) % 1013) * 3.77 + rep * 57.31) * 12911.7;
  return (wobble - Math.floor(wobble)) < chance ? PENALTY_COMMIT_M : 0;
}

/**
 * A penalty is the same kick every time, so difficulty lives entirely in the
 * keeper: how good he is, how much of his guess he lets you see, and whether
 * he backs that guess by actually going.
 */
export function penaltySetup(trial: TrialProgress, rep: number): PenaltySetup {
  const d = difficultyFor(trial, "penalties");
  const bonus = keeperBonusFor(trial, "penalties");
  // Seeded off the trial, the resume count and the rep — so the same penalty
  // is the same penalty for as long as you are actually playing it, and a
  // stage retaken after a reload is a fresh set of guesses rather than a
  // memory test against a keeper who leans the same way every time. See
  // `attemptSeed`. Only the SIDE is drawn; how much there is to see is the
  // rep's own, deterministic — see `penaltyTell`.
  const wobble = Math.sin((attemptSeed(trial) % 1000) + rep * 12.9898) * 43758.5453;
  const side = (wobble - Math.floor(wobble)) < 0.5 ? -1 : 1;
  return {
    ball: { x: CX, y: PEN_SPOT_Y },
    keeperStrength: Math.min(99, 45 + d * 45 + bonus),
    keeperLean: side * penaltyTell(trial, rep),
    keeperCommit: penaltyCommit(trial, rep),
  };
}

// ── 2. Free kicks ───────────────────────────────────────────────────────

export interface FreeKickSetup extends FreeKickDrillConfig {
  ball: { x: number; y: number };
}

/** What "one more in the wall" and "pushed further out" are worth. Sized
 *  against the drill's own ladder rather than picked by eye: the wall runs
 *  2-5, so one man is a third of it; the distance runs 16-30, so 3.5 m is a
 *  quarter of it. */
export const BIG_WALL_MEN = 1;
export const LONG_RANGE_M = 3.5;

export function freeKickSetup(trial: TrialProgress, rep: number): FreeKickSetup {
  const d = difficultyFor(trial, "freeKicks");
  const cfg = freeKickDrill(ladderLevel(d), rep);
  const ev = adversityOn(trial, "freeKicks");
  const keeperStrength = Math.min(99, cfg.keeperStrength + keeperBonusFor(trial, "freeKicks"));
  // A sixth man is not a wall any more, it is a hedge — and the engine only
  // ever draws what `initDefenders` is asked for, so the cap is a real one.
  const wall = ev?.id === "big-wall" ? Math.min(6, cfg.wall + BIG_WALL_MEN) : cfg.wall;
  const distance = ev?.id === "long-range" ? cfg.distance + LONG_RANGE_M : cfg.distance;
  const withAdversity = { ...cfg, keeperStrength, wall, distance };
  // `strikeSpot` clamps the ball onto the actual pitch, so a long-range roll
  // on top of the top rung of the ladder cannot put it in the stand.
  return { ...withAdversity, ball: strikeSpot(distance, cfg.offset) };
}

// ── 3. Taking a man on ──────────────────────────────────────────────────

export interface DribbleSetup {
  /** 0-100, fed straight to the first-person run. */
  oppStrength: number;
  /**
   * The waves, and therefore exactly how many men you face.
   *
   * Passed to the run rather than left to it. It used to only carry a total,
   * which was never handed over — so the run picked its own waves and the
   * scoring then divided the men you beat by a number unrelated to the men on
   * the screen. Beating everyone could score 0.72 while beating three of nine
   * scored 1.0. Caught in review.
   */
  waveSizes: number[];
  /** How many men that adds up to — what `dribbleQuality` divides by, and now
   *  genuinely the number you faced. */
  defenders: number;
}

/**
 * Deliberately thin, because the dribbling stage reuses the first-person run
 * UNMODIFIED. Everything about how it plays is already built and already
 * tuned; all a trial has to decide is who you are running at.
 */
/** What the two running-at-men events are worth, on the same principle: the
 *  ladder runs 35-95, so +15 is a quarter of it, and one extra body in a run
 *  that is three to ten men long is about the same again. */
export const QUICK_FEET_BONUS = 15;
export const EXTRA_MAN = 1;

export function dribbleSetup(trial: TrialProgress): DribbleSetup {
  const d = difficultyFor(trial, "dribbling");
  const ev = adversityOn(trial, "dribbling");
  // Two to four waves, widening with the difficulty, capped at the run's own
  // ceiling of ten — a real match has eleven men and one of them is in goal.
  const waves = Math.round(2 + d * 2);
  const sizes: number[] = [];
  let total = 0;
  for (let i = 0; i < waves; i++) {
    const want = Math.max(1, Math.round(1 + d * 2 + (i === waves - 1 ? 1 : 0)));
    const room = Math.max(0, 10 - total);
    const take = Math.min(want, room);
    if (take <= 0) break;
    sizes.push(take);
    total += take;
  }
  // "An extra body… thrown into the last wave" — literally that, and only if
  // the run's own ten-man ceiling still has room for him. Pushed onto the LAST
  // wave on purpose: it is already the biggest one, and the stage should get
  // harder as it goes rather than opening on its worst moment.
  if (ev?.id === "extra-man" && total < 10 && sizes.length > 0) {
    sizes[sizes.length - 1] += EXTRA_MAN;
    total += EXTRA_MAN;
  }
  return {
    oppStrength: Math.min(100, 35 + d * 60 + (ev?.id === "quick-feet" ? QUICK_FEET_BONUS : 0)),
    waveSizes: sizes,
    defenders: total,
  };
}

/** What a run was worth. `beaten` counts more than `cleared` on purpose: a man
 *  who takes on four and is stopped by the fifth has shown a scout more than
 *  one who walked through a gap. */
export function dribbleQuality(
  result: { cleared: boolean; beaten: number }, setup: DribbleSetup,
): number {
  const share = setup.defenders > 0 ? Math.min(1, result.beaten / setup.defenders) : 0;
  return Math.max(0, Math.min(1, share * 0.75 + (result.cleared ? 0.25 : 0)));
}

// ── 4. Finding the pass ─────────────────────────────────────────────────

export interface VisionSetup extends VisionDrillConfig {
  /**
   * Which of the options is the right one.
   *
   * Seeded off `attemptSeed`, not off the bare `trial.seed`, and the comment
   * that used to sit here claimed the opposite of what the code did: "seeded,
   * so a reload cannot be used to see the answer and then restart" was exactly
   * backwards. Seeding off the bare seed is what MADE that possible — the rep
   * counter is React state and is never saved, so a resume restarted the stage
   * at rep 1 with the same six pictures and the same six answers you had just
   * watched ring green. Six remembered taps, near-perfect score, no football.
   *
   * Folding the resume count in means a resumed stage genuinely draws six new
   * pictures, at the bumped difficulty. See `attemptSeed`, and `layoutVision`
   * in TrialVision.tsx, which is seeded from the same number so the PICTURE
   * changes too and not just which man in it is the answer.
   */
  correct: number;
}

/**
 * What the three looking-up events are worth.
 *
 * `SNAP_DECISION_WINDOW` multiplies rather than subtracts because the window
 * itself runs 2.6 s down to 0.85 s: a flat second off would be a nuisance at
 * the bottom of the ladder and a lockout at the top. The floor it is clamped
 * to is `visionDrill`'s own 0.85 s, so this event can never ask for a window
 * shorter than the hardest ordinary rep in the game.
 */
export const SNAP_DECISION_WINDOW = 0.75;
export const SNAP_DECISION_FLOOR = 0.85;
export const CROWDED_PICTURE_MEN = 2;
export const CROWDED_PICTURE_MAX = 9;
export const TIGHT_MARGINS_SCALE = 0.65;
export const TIGHT_MARGINS_FLOOR = 0.6;

export function visionSetup(trial: TrialProgress, rep: number): VisionSetup {
  const d = difficultyFor(trial, "vision");
  const base = visionDrill(ladderLevel(d), rep);
  const ev = adversityOn(trial, "vision");
  // Nine is `layoutVision`'s own working ceiling — its jittered grid is sized
  // for "up to nine men in a twenty-eight metre box", and more than that is a
  // picture nobody can read however fair the numbers underneath it are.
  const cfg: VisionDrillConfig = {
    options: ev?.id === "crowded-picture"
      ? Math.min(CROWDED_PICTURE_MAX, base.options + CROWDED_PICTURE_MEN)
      : base.options,
    window: ev?.id === "snap-decision"
      ? Math.max(SNAP_DECISION_FLOOR, base.window * SNAP_DECISION_WINDOW)
      : base.window,
    margin: ev?.id === "tight-margins"
      ? Math.max(TIGHT_MARGINS_FLOOR, base.margin * TIGHT_MARGINS_SCALE)
      : base.margin,
  };
  const wobble = Math.sin((attemptSeed(trial) % 997) * 7.13 + rep * 91.7) * 24634.6345;
  const pick = Math.floor((wobble - Math.floor(wobble)) * cfg.options);
  return { ...cfg, correct: Math.max(0, Math.min(cfg.options - 1, pick)) };
}

/**
 * What one pass was worth.
 *
 * Picking the right man is most of it, but not all of it: how quickly you saw
 * it counts too, because the whole point of the top of this ladder is that you
 * have under a second and the right ball is barely better than the wrong one.
 * Picking nothing at all scores zero — a scout learns nothing from a player
 * who never lifted his head.
 */
export function visionQuality(
  picked: number | null, setup: VisionSetup, tookSeconds: number,
): number {
  if (picked === null) return 0;
  if (picked !== setup.correct) {
    // A wrong pass is not worthless if it was at least a quick decision, but
    // it is close to it.
    return 0.08;
  }
  const speed = Math.max(0, Math.min(1, 1 - tookSeconds / Math.max(0.2, setup.window)));
  return Math.max(0, Math.min(1, 0.65 + speed * 0.35));
}

// ── Turning reps into the stage's own quality ───────────────────────────

/**
 * The mean of what you actually did.
 *
 * A mean rather than a best-of: a trial is watched, and a scout who sees one
 * good penalty and four bad ones has seen a player who scores one in five.
 */
export function meanQuality(reps: number[]): number {
  if (!reps.length) return 0;
  const clean = reps.map(q => (Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0));
  return clean.reduce((s, q) => s + q, 0) / clean.length;
}

/**
 * ── WHAT THE LATER REPS ARE WORTH, AND WHY A FLAT MEAN WAS A BUG ──
 *
 * Every rep-based stage in the trial gets harder as it goes, and that was
 * always true — `freeKickDrill` walks the ball back 0.9 m a rep, `visionDrill`
 * shaves the window and adds a man, and `PENALTY_TELL_RAMP` now takes the
 * keeper's tell away entirely by the third kick. What was NOT true is that
 * any of it counted for anything.
 *
 * `meanQuality` weighs the last rep exactly as heavily as the first, and the
 * only credit for a hard afternoon anywhere in the trial is
 * `SCORE_DIFFICULTY_SPAN` — five points, applied to the whole stage, and
 * driven by the trial's own roll rather than by which rep you were on. Put
 * those two together and an escalating stage is strictly a worse deal than a
 * flat one: the last rep is the hardest thing in it, pays nothing extra for
 * being survived, and costs full price for being fluffed. Sharpening the
 * ramp without this would have made the stage feel worse, not harder — which
 * is why the two shipped in the same change.
 *
 * So a rep is worth more the later it comes. 1 / 1.25 / 1.5, holding at the
 * last entry for however many reps a stage actually has, which means:
 *
 *  - penalties (4): 1 / 1.25 / 1.5 / 1.5 — the two no-tell kicks at the end
 *    carry half again the weight of the telegraphed opener.
 *  - free kicks (4): the same, against a ball walked steadily backwards.
 *  - vision (6): 1 / 1.25 / 1.5 / 1.5 / 1.5 / 1.5 — the tightest windows and
 *    the busiest pictures are the ones that count.
 *
 * Deliberately gentle. At 1.5 the last rep is worth about 29 % of a four-rep
 * stage against 19 % for the first, which is enough to be felt and nowhere
 * near enough to make the opening reps decorative. Anything steeper and the
 * stage stops being four attempts and becomes one attempt with a warm-up.
 *
 * Bounded exactly like the mean it replaces: all-perfect is 1, all-nothing is
 * 0, nonsense is 0, nothing at all is 0. Every weight is positive, so this can
 * never invert — a better rep can never lower the stage's quality.
 */
export const REP_WEIGHT_RAMP = [1, 1.25, 1.5];

export function weightedQuality(reps: number[]): number {
  if (!reps.length) return 0;
  let top = 0, bottom = 0;
  reps.forEach((raw, i) => {
    const q = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    const w = REP_WEIGHT_RAMP[Math.min(i, REP_WEIGHT_RAMP.length - 1)];
    top += q * w;
    bottom += w;
  });
  return bottom > 0 ? Math.max(0, Math.min(1, top / bottom)) : 0;
}

/** A struck-shot stage (penalties, free kicks) judges every attempt the same
 *  way, using the drills' own existing shot judgement. */
export function strikeQuality(outcome: string, crossX: number | null): number {
  return shotQuality(outcome, crossX);
}

// ── Having already been taught ──────────────────────────────────────────

/**
 * WHETHER THE PLAYER HAS BEEN SHOWN A DRILL'S INSTRUCTION BEFORE.
 *
 * Reported directly: "you should be able to get rid of the little tutorial."
 * Two halves to that, and only one of them is a close button.
 *
 * The teaching is genuinely good the first time — it is the whole reason the
 * first rep of every drill carries a card instead of an 11 px grey hint. It
 * is not good the fourth time. A trial can be re-taken, a stage can be
 * resumed (`reloads`), and a second career starts the whole thing again from
 * penalty one, so somebody who already knows the game can meet the same
 * paragraph a dozen times over. So dismissing it has to STICK.
 *
 * ── Why localStorage, and why per device ──
 *
 * "Has this person been told how to drag a ball" is a display preference, not
 * a fact about a career: it belongs to whoever is holding the phone, not to
 * the save. Putting it on `TrialProgress` would reset it with every new
 * career, sync a returning player's knowledge onto a friend's borrowed
 * account, and grow the cloud save for nothing. The same reasoning
 * `star-match-muted` and the Face Editor's own keys already follow.
 *
 * Every read and write is wrapped: a private window, blocked site data, or a
 * server render all throw on `localStorage` (a bare reference, the same way
 * `faceStyle.ts` reaches it, so a test can inject one), and the honest
 * failure here is "show the tutorial" — never a stage that will not open.
 */
export type TeachableDrill = Exclude<TrialStage, "fiveASide">;

export const TEACH_SEEN_KEY = "star-trial-taught";

/** Every drill that teaches. The five-a-side is not one: it has no single
 *  first rep to hang an instruction on. */
export const TEACHABLE_DRILLS: TeachableDrill[] = [
  "penalties", "freeKicks", "dribbling", "vision",
];

function teachKeyFor(drill: TeachableDrill): string {
  return `${TEACH_SEEN_KEY}-${drill}`;
}

/** Has this drill's instruction been dismissed before, on this device? */
export function teachSeen(drill: TeachableDrill): boolean {
  try {
    return localStorage.getItem(teachKeyFor(drill)) === "1";
  } catch {
    return false;
  }
}

/** Remember that it has. Never throws — a device that cannot store this just
 *  teaches the drill again next time, which is the harmless failure. */
export function markTeachSeen(drill: TeachableDrill): void {
  try {
    localStorage.setItem(teachKeyFor(drill), "1");
  } catch {
    /* A tutorial nobody can dismiss permanently is a nuisance, not a bug. */
  }
}

/** Teach every drill again — exported for a settings/dev control and for the
 *  tests, which must be able to put a device back to never-taught. */
export function clearTeachSeen(): void {
  try {
    for (const d of TEACHABLE_DRILLS) localStorage.removeItem(teachKeyFor(d));
  } catch {
    /* Nothing stored, nothing to clear. */
  }
}
