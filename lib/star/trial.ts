import { mulberry32 } from "./season";

/**
 * THE TRIAL — one afternoon that decides who, if anybody, signs you.
 *
 * The career used to open on a single penalty you took until it went in. You
 * could not fail it, it asked nothing of you, and it told the clubs watching
 * absolutely nothing — everybody arrived at the same club on the same wage
 * however they had played.
 *
 * A trial is five stages on the live match engine, each scored on HOW WELL
 * YOU DID, against an afternoon whose difficulty decides how hard doing well
 * was — and one number at the end that decides who comes in for you. Fail it
 * badly enough and nobody does (see §3.7 of
 * STAR_CAREER_OPENING_AND_ECONOMY.md — the free-agent life).
 *
 * That is a correction of the original "scored relative to what you were
 * asked for", which had difficulty re-pricing the result as well as setting
 * it, and so put the top of the ladder out of reach on an easy roll and made
 * the top quarter of skill invisible on a hard one. `stageScore` carries the
 * full account and the measurements.
 *
 * ── Everything random is seeded and stored ──
 *
 * The whole point of a difficulty roll is that it was not chosen by you. If
 * the roll happened live, closing the app and re-opening it would re-roll it,
 * and the optimal way to play would be to keep re-opening until the trial was
 * easy. So: one seed on the career, every roll derived from it, nothing
 * regenerated.
 *
 * ── Closing the app is not cheating, but farming it costs ──
 *
 * Decided directly, and it is worth quoting because it shaped the design:
 *
 *   "The more important thing from a refresh is that they don't lose
 *    progress. If people want to cheat we shouldn't necessarily stop them,
 *    but it should be difficult — maybe if someone refreshes more than once
 *    in a trial the difficulty gets bumped. If people are trying to cheat to
 *    get a better start, that means the game is pretty cool."
 *
 * So there is no lockout and no "you have already had your go". You come back
 * to exactly where you were. Two resumes are genuinely free. From the third
 * on, the football gets sharply harder and the SCORE IS LEFT ALONE — "don't
 * give their score a penalty, just kind of troll them" — see `RELOAD_GRACE`
 * for the full account of that reversal and what it replaced.
 *
 * ── A resume is only a resume if it interrupted something ──
 *
 * `noteReload` used to charge for any load of an unfinished trial. Two of
 * those are innocent and were being billed anyway: the very first load after
 * career creation (nothing has been played yet — there is nothing to retry),
 * and a phone evicting a backgrounded tab, which iOS does routinely. A charge
 * now needs a stage genuinely under way with no result yet — see
 * `resumeInterrupted`, which says exactly how much of that is provable today
 * and what is still missing.
 */

export type TrialStage = "penalties" | "freeKicks" | "dribbling" | "vision" | "fiveASide";

/** The order they are played in, and the order the sequencer walks. */
export const TRIAL_STAGES: TrialStage[] = [
  "penalties", "freeKicks", "dribbling", "vision", "fiveASide",
];

export const STAGE_LABEL: Record<TrialStage, string> = {
  penalties: "Penalties",
  freeKicks: "Free kicks",
  dribbling: "Take him on",
  vision: "Find the pass",
  fiveASide: "Five-a-side",
};

/**
 * THE RARE THINGS THAT GO AGAINST YOU (and two that just watch).
 *
 * v1 shipped exactly one — a sharper keeper — and its note explained why:
 * five others had been drafted and cut because nothing in the trial or the
 * drills passed conditions to any engine call, so a "heavy pitch" was new
 * plumbing in two components before it was a feature.
 *
 * That instinct was right and it still applies. Every event below is here
 * because a REAL dial already exists for it and `trialStages.ts` already
 * turns that dial — the keeper's strength, how much of his guess he shows,
 * how many men are in the wall, how far out the ball is, how quick the
 * defenders are, how many of them there are, how long you get to look and
 * how much clearer the right pass is than the wrong one. Nothing here is a
 * caption pretending to be a mechanic.
 *
 * Two of them ARE captions, and say so: `flavour: true`, weight exactly 0.
 * A notable figure standing on the touchline is worth having precisely
 * because it changes no football at all — but it must never be confused with
 * the ones that do, because the ones that do are what makes a good score
 * worth more (see `adversityWeightFor`).
 *
 * ── Rejected, and why ──
 *
 *  - **Weather (rain, a heavy pitch).** Ruled out directly by the owners for
 *    now, and the code agrees: nothing in `canvasEngine.ts` reads a surface
 *    or a wind, so it would be a label over unchanged physics.
 *  - **"The wall jumps higher."** Asked for by name, and there is genuinely
 *    no hook: `stepDefenders` sets every jumping man to the module constant
 *    `WALL_JUMP_VZ`, with no per-defender override to write to, and the
 *    engine is not this lane's to edit. `big-wall` is the honest version of
 *    the same feeling — more bodies in the way — using a dial that is real.
 *  - **A hostile crowd / playing out of position.** Same as v1: no
 *    plumbing, and inventing some is a feature, not an adversity event.
 */
export type TrialAdversityId =
  // ── Striking ──
  | "sharp-keeper"
  | "cold-keeper"
  | "big-wall"
  | "long-range"
  // ── Running at men ──
  | "quick-feet"
  | "extra-man"
  // ── Looking up ──
  | "snap-decision"
  | "crowded-picture"
  | "tight-margins"
  // ── Flavour: no football changes hands ──
  | "legend-watching"
  | "packed-touchline";

/** Kept as the stored shape it has always been — a string or null — so a
 *  career saved when "sharp-keeper" was the only value reads back unchanged. */
export type TrialAdversity = TrialAdversityId | null;

export interface TrialAdversityEvent {
  id: TrialAdversityId;
  /** Shown on the result card and the scouts' summary. */
  label: string;
  /** One line, in the trial's own voice. */
  blurb: string;
  /** The stages it can land on. A flavour event lists every stage — which one
   *  it draws makes no difference, but keeping the field uniform means
   *  nothing downstream has to special-case it. */
  stages: TrialStage[];
  /**
   * 0-1, HOW MUCH HARDER the stage it lands on genuinely is, in the same
   * units `baseDifficulty` speaks.
   *
   * This is the one number that reaches the score, and it is exactly 0 for a
   * flavour event by definition: something that changed no football cannot
   * make the afternoon worth more. See `adversityWeightFor`.
   */
  weight: number;
  /** True for the two that are a caption and nothing else. */
  flavour: boolean;
}

/**
 * How much a sharp keeper is worth, in the same 0-100 units every drill's
 * own ladder already speaks. Kept as its own exported constant because
 * `trialStages.ts` adds it to a keeper's strength directly, and it is the
 * only event whose effect is a number rather than a reshaped setup.
 */
export const SHARP_KEEPER_BONUS = 15;

const KEEPER_STAGES: TrialStage[] = ["penalties", "freeKicks", "fiveASide"];

/**
 * The catalogue. Order is meaningless; the roll is uniform over it.
 *
 * The weights are not vibes — each one is roughly the fraction of that
 * stage's OWN ladder the effect moves you up. A sharp keeper is +15 on a
 * 45-99 strength range, which is about a third of it, so 0.30. A fifth man
 * in a 2-5 wall is about a third of that range, so 0.22 once you allow that
 * the extra man is partly shootable-round. Being exact here is not possible
 * and not the point: what matters is that a genuinely harder afternoon is
 * worth more than an easy one, and that a caption is worth nothing.
 */
export const TRIAL_ADVERSITY: TrialAdversityEvent[] = [
  {
    id: "sharp-keeper",
    label: "Keeper's on fire",
    blurb: "Their keeper has turned up in the mood of his life. He is saving things he has no business saving.",
    stages: KEEPER_STAGES,
    weight: 0.30,
    flavour: false,
  },
  {
    id: "cold-keeper",
    label: "Gives nothing away",
    blurb: "This one does not flinch. He waits, he watches, and he tells you absolutely nothing before you strike it.",
    stages: ["penalties"],
    // Measured against the sharp keeper on the real engine rather than
    // eyeballed: across a whole stage the two cost a taker almost the same
    // (−6.0 points of conversion against −6.4), even though they get there
    // very differently — this one takes the first two kicks apart and is
    // worth nothing by the third, because by then the ramp has already taken
    // the tell away. See `COLD_KEEPER_TELL`.
    weight: 0.28,
    flavour: false,
  },
  {
    id: "big-wall",
    label: "One more in the wall",
    blurb: "They have put an extra body in front of you. Round it or over it — there is no through it.",
    stages: ["freeKicks"],
    weight: 0.22,
    flavour: false,
  },
  {
    id: "long-range",
    label: "Pushed further out",
    blurb: "The coach keeps waving the ball back. Every one of these is from further than you would pick.",
    stages: ["freeKicks"],
    weight: 0.25,
    flavour: false,
  },
  {
    id: "quick-feet",
    label: "They're rapid",
    blurb: "Whoever these lads are, they are quick. You are not going to stroll past anybody today.",
    stages: ["dribbling"],
    weight: 0.25,
    flavour: false,
  },
  {
    id: "extra-man",
    label: "An extra body",
    blurb: "Somebody has been thrown into the last wave. One more to beat than the man before you had.",
    stages: ["dribbling"],
    weight: 0.20,
    flavour: false,
  },
  {
    id: "snap-decision",
    label: "No time on it",
    blurb: "They are closing you down the instant you look up. Whatever you see, you see it fast.",
    stages: ["vision"],
    weight: 0.28,
    flavour: false,
  },
  {
    id: "crowded-picture",
    label: "Busy in there",
    blurb: "More bodies than the picture wants. Finding the right one means discounting the wrong ones first.",
    stages: ["vision"],
    weight: 0.20,
    flavour: false,
  },
  {
    id: "tight-margins",
    label: "Nothing in it",
    blurb: "Nobody is properly free. The best ball today is barely better than the second best.",
    stages: ["vision"],
    weight: 0.25,
    flavour: false,
  },
  {
    id: "legend-watching",
    label: "Somebody's watching",
    blurb: "A face you have seen lift trophies is standing by the dugout with his arms folded. Nobody says why.",
    stages: TRIAL_STAGES,
    weight: 0,
    flavour: true,
  },
  {
    id: "packed-touchline",
    label: "Three deep on the touchline",
    blurb: "Word got round. There are more people watching a trial than watched your last four games put together.",
    stages: TRIAL_STAGES,
    weight: 0,
    flavour: true,
  },
];

/**
 * How often ANY of them fires.
 *
 * 0.42 rather than v1's 0.34 on purpose: two of the eleven are pure flavour,
 * so 0.42 × 9/11 leaves the rate of a genuinely harder afternoon at almost
 * exactly the 34 % it has always been, and puts the two flavour events on
 * top of it rather than taking a slice out of it.
 */
export const ADVERSITY_CHANCE = 0.42;

/** The event a trial actually drew, or null. Unknown ids — a save from a
 *  build that named an event this one does not — read as null rather than
 *  crashing, which is the same "a stage that did nothing reads as nothing"
 *  rule `clamp01` follows. */
export function adversityFor(trial: Pick<TrialProgress, "adversity">): TrialAdversityEvent | null {
  if (!trial.adversity) return null;
  return TRIAL_ADVERSITY.find(e => e.id === trial.adversity) ?? null;
}

/** The event, but only when asking about the stage it actually landed on. */
export function adversityOn(
  trial: Pick<TrialProgress, "adversity" | "adversityStage">, stage: TrialStage,
): TrialAdversityEvent | null {
  if (trial.adversityStage !== stage) return null;
  return adversityFor(trial);
}

/**
 * What the adversity adds to how hard this stage genuinely was.
 *
 * **This is the half of the design the owners were explicit about**: "if you
 * performed better in a harder trial… they're worth more." v1 could not
 * actually deliver that — a sharp keeper made the stage harder and was worth
 * precisely nothing, because it reached `keeperStrength` and never reached
 * any difficulty figure at all. So the same performance against a better
 * keeper scored LESS, which is the opposite of the stated rule.
 *
 * It is deliberately kept OUT of `difficultyFor`, which is the drills' own
 * dial: the event already applies its own effect there (a bigger wall, a
 * shorter window), and adding its weight on top would apply it twice.
 */
export function adversityWeightFor(
  trial: Pick<TrialProgress, "adversity" | "adversityStage">, stage: TrialStage,
): number {
  return adversityOn(trial, stage)?.weight ?? 0;
}

export interface TrialStageResult {
  /**
   * 0-1, how well you actually did, and nothing else.
   *
   * Genuinely nothing else, as of the reload reversal: no haircut, no hidden
   * multiplier, no adjustment for how the trial was reached. Whatever the
   * stage's own reps averaged out at is what is written here, which is what
   * makes `score` recomputable from the trial's own fields — a result nobody
   * can check is a result nobody should trust.
   */
  quality: number;
  /**
   * 0-1, what was asked of you — the full figure the drills were actually
   * built from, reload bump included, so the result card's "they made that
   * hard" line is telling the truth about the afternoon you played.
   *
   * Deliberately NOT what the score was computed from: see `stageScore` and
   * `scoringDifficultyFor` for why those are two different numbers now.
   */
  difficulty: number;
  /** 0-100, what the watching clubs saw. See `stageScore`. */
  score: number;
  decidedAt: number;
}

export interface TrialProgress {
  seed: number;
  /** 0-1, rolled once for the whole trial. */
  baseDifficulty: number;
  /** Per-stage offset from the base, so one trial can be easy on penalties
   *  and hard on the five-a-side rather than uniformly hard. */
  stageRolls: Record<TrialStage, number>;
  results: Partial<Record<TrialStage, TrialStageResult>>;
  adversity: TrialAdversity;
  /** Which stage the adversity lands on. A sharp keeper means nothing in the
   *  dribbling stage, so it is rolled onto a stage where it bites. */
  adversityStage: TrialStage | null;
  /**
   * How many resumes were CHARGED for. See the note above and
   * `resumeInterrupted` — a load that interrupted nothing is not one of
   * these. `difficultyFor` reads it — via `reloadDifficultyBump` — and it is
   * the only one that costs the player anything. It no longer touches the
   * score at all; see `RELOAD_GRACE`.
   */
  reloads: number;
  /**
   * How many resumes were SEEN, charged or not.
   *
   * Kept separately because "was this trial ever loaded before" is the one
   * thing that tells an untouched trial's first load (career just created,
   * innocent) apart from its second (you have been sitting inside stage one
   * and walked out of it). Optional: a trial saved before this existed simply
   * has none, and reads as zero.
   */
  resumes?: number;
  /**
   * Which stage the player is actually INSIDE, if any — `null` between
   * stages, absent when nobody has said.
   *
   * The precise version of "did this resume interrupt anything". Set by
   * `beginStage` when a stage screen opens, cleared by `recordStage`.
   *
   * **Nothing sets it yet.** `components/star/TrialSequence.tsx` is the one
   * place that knows a stage screen has opened, and it is not this file's to
   * edit; until it calls `beginStage`, `resumeInterrupted` falls back to what
   * the trial's own data can prove (see there). The fallback gets the
   * first-load case right and the backgrounded-tab case wrong, which is the
   * whole reason this field exists.
   */
  inProgress?: TrialStage | null;
  startedAt: number;
  /**
   * A five-a-side left half-played.
   *
   * The only stage long enough that closing the app in the MIDDLE of it costs
   * anything worth keeping — the other four are a handful of attempts you
   * would simply take again. Written at the end of every touch, so coming back
   * puts you on the same scoreline with the same clock rather than kicking off
   * again.
   *
   * Typed loosely on purpose: `lib/star/fiveASide/match.ts` imports from the
   * canvas engine, and making this file depend on all of that to name one
   * field would drag the whole match engine into everything that reads a
   * trial. The one place it is actually used narrows it.
   */
  fiveASide?: unknown;
}

/**
 * 0-1, and never NaN.
 *
 * The non-finite guard is not defensive padding — these numbers are written
 * onto the career and saved. `Math.max(0, Math.min(1, NaN))` is NaN, and a
 * NaN score would survive JSON, come back as `null` on the next load, and
 * quietly poison every average computed from it. A stage that somehow
 * produced nonsense should read as "you did nothing", which is at least a
 * true statement about a stage that did not work.
 */
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * ── THE RELOAD PENALTY, INVERTED: TROLL THEM, DO NOT DOCK THEM ──
 *
 * This reverses the shape that shipped a day earlier, and the reversal was a
 * direct decision:
 *
 *   "Obviously, if someone's cheating and reloading more than 2 times on a
 *    trial, then instantly start giving them that penalty. Don't give their
 *    score a penalty. Just kind of troll them. Just make it hard, way harder
 *    than it should be, and keep that score the same."
 *
 * What was there before: a gentle +0.03-a-go difficulty bump (capped at
 * +0.15, so a farmer hit the ceiling almost immediately and every resume
 * after that was free) PLUS a quiet 2 %-per-resume haircut on the recorded
 * quality. The haircut is gone entirely — `reloadQualityHaircut` and its two
 * constants are deleted, not left disabled, because a hidden multiplier
 * eating a number the player can see is exactly the thing being overruled.
 * A score now means what it says, whatever the player did to get to it.
 *
 * What replaces it is the same idea pointed at the football instead:
 *
 *  - **Two charged resumes are genuinely free** (`RELOAD_GRACE`). Somebody
 *    whose train went into a tunnel, or whose phone evicted the tab twice,
 *    pays nothing at all — not "almost nothing", nothing. That is a real
 *    improvement on the old shape, where the very first resume already cost.
 *  - **The third and every one after it is steep** — +0.18 each, six times
 *    the old step, running all the way to +0.90. A trial rolled at the
 *    median (0.34) is asking near the top of every drill's ladder by the
 *    fifth resume and is pinned at the ceiling by the seventh.
 *
 * So the cheat stops paying because the football gets hard, not because a
 * multiplier quietly ate the number. And reloading still cannot be
 * PROFITABLE — the score for a given performance is now exactly unchanged by
 * how many times the app was re-opened (`scoringDifficultyFor` has never read
 * the bump), while the performance itself is much harder to produce.
 *
 * Worth keeping in view: the bump is not the only thing a resume does.
 * `attemptSeed` (trialStages.ts) mixes `reloads` into every "what does this
 * rep ask" roll, so a resumed stage draws genuinely new problems rather than
 * a second showing of the ones whose answers were just memorised. That is a
 * separate defence against a different cheat, and it fires on resume one —
 * the grace period below is about PUNISHMENT, not about re-rolling.
 */
export const RELOAD_GRACE = 2;
export const RELOAD_DIFFICULTY_STEP = 0.18;
export const RELOAD_DIFFICULTY_CAP = 0.9;

/**
 * What the charged resumes add to what every drill ASKS.
 *
 * Zero through the grace period, then steep. Never negative, whatever
 * nonsense is in the field — a hand-edited save claiming −99 resumes must
 * not buy an easier trial.
 */
export function reloadDifficultyBump(reloads: number): number {
  const charged = Number.isFinite(reloads) ? Math.max(0, Math.floor(reloads)) : 0;
  const past = Math.max(0, charged - RELOAD_GRACE);
  return Math.min(RELOAD_DIFFICULTY_CAP, past * RELOAD_DIFFICULTY_STEP);
}

/**
 * What a stage is worth, at the easiest possible afternoon and at the hardest.
 *
 * `SCORE_BASE` is the whole of the ceiling fix. It used to be 0.70: a stage
 * rolled at difficulty 0 could not score above 70 however flawlessly it was
 * played, and difficulty comes out at exactly 0 for about one stage roll in
 * nine. That meant a Premier League offer — appetite peaks at 96, see
 * scoutOffers.ts — was unreachable on a dice roll the player never saw and
 * could do nothing about. Perfect play now scores 95 on the kindest roll and
 * 100 on the cruellest, so the top of the ladder is always in reach and the
 * difficulty roll decides how hard it is to get there rather than whether it
 * is possible at all.
 *
 * The 0.05 that is left is not a reward for difficulty so much as a
 * tie-break: two identical afternoons should not be literally identical when
 * one of them was harder. The design story — "a 70 on a hard day means more
 * than a 70 on an easy day" — is carried by the difficulty LABEL on the
 * result card (TrialSequence.tsx reads `TrialStageResult.difficulty` for
 * exactly this), which is where it belongs: a sentence can say that without
 * quietly making the number mean two different things.
 */
export const SCORE_BASE = 0.95;
export const SCORE_DIFFICULTY_SPAN = 0.05;

/**
 * A brand-new trial. Everything it will ever need to know is decided here,
 * from the seed, and never rolled again.
 *
 * The seed itself is the one genuinely live value — it has to be, or every
 * player in the world would get the same trial. It is stored the instant it
 * is drawn, which is what makes everything downstream reproducible.
 */
export function startTrial(seed: number = Math.floor(Math.random() * 0xffffffff)): TrialProgress {
  const rng = mulberry32(seed);

  // A trial is usually a fair test and occasionally a brutal one. The exponent
  // (1.6, not 2 — an earlier comment here said "squared" and was simply wrong)
  // leans the distribution easy-to-middling while leaving a real tail: most
  // trials are winnable, a few are the afternoon you were unlucky to draw.
  const baseDifficulty = clamp01(Math.pow(rng(), 1.6));

  const stageRolls = {} as Record<TrialStage, number>;
  for (const stage of TRIAL_STAGES) {
    // ±0.2 around the base. Wide enough that a trial has a shape — a stage
    // you found hard and one you breezed — without any stage escaping the
    // afternoon's overall character.
    stageRolls[stage] = (rng() - 0.5) * 0.4;
  }

  // Something out of the ordinary about roughly two trials in five — which,
  // after the two pure-flavour events take their share, leaves the rate of a
  // genuinely HARDER afternoon at almost exactly the third it has always
  // been. See ADVERSITY_CHANCE.
  const pick = <T,>(xs: T[], r: number) => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))];
  const event = rng() < ADVERSITY_CHANCE ? pick(TRIAL_ADVERSITY, rng()) : null;
  const adversity: TrialAdversity = event ? event.id : null;
  // Onto a stage it can actually bite on. A sharp keeper means nothing in the
  // dribbling stage and a shorter look at the picture means nothing outside
  // the vision stage, so each event carries its own list rather than every
  // event drawing from one shared one. A flavour event lists all five and
  // simply draws one — nothing depends on which.
  const adversityStage = event ? pick(event.stages, rng()) : null;

  return {
    seed,
    baseDifficulty,
    stageRolls,
    results: {},
    adversity,
    adversityStage,
    reloads: 0,
    resumes: 0,
    startedAt: Date.now(),
  };
}

/**
 * How hard a given stage is, all in: the trial's own character, this stage's
 * own roll, and whatever the player has added by re-opening the app.
 *
 * **This is what the stage ASKS.** Every drill ladder reads it — keeper
 * strength, wall distance, how many options the vision stage shows, how long
 * you get — so a farmed trial genuinely plays harder. It is not what the
 * stage is scored against; `scoringDifficultyFor` is.
 */
export function difficultyFor(trial: TrialProgress, stage: TrialStage): number {
  return clamp01(
    trial.baseDifficulty + (trial.stageRolls[stage] ?? 0) + reloadDifficultyBump(trial.reloads),
  );
}

/**
 * What the stage was WORTH — the figure the score is computed from.
 *
 * Two things are deliberately different about it from `difficultyFor`:
 *
 *  - **The reload bump is not in it.** The bug that killed: difficulty was
 *    both what the stage asked AND the score's multiplier, so re-opening the
 *    app raised the multiplier on every stage still to come. Ten resumes
 *    turned a perfect trial on seed 0 from 73 into 81 — the anti-cheat paid.
 *    Splitting the two is what lets a resume make the afternoon much harder
 *    (it now does, steeply — see `reloadDifficultyBump`) without making a
 *    single point of it worth more.
 *  - **The adversity weight IS in it**, and was not before. "If you performed
 *    better in a harder trial… they're worth more" could not be true of an
 *    adversity event that never reached a difficulty figure at all: a sharp
 *    keeper made the stage harder and was worth exactly nothing, so the same
 *    performance against a better keeper scored LESS. See
 *    `adversityWeightFor`, which is also where the reason it stays out of
 *    `difficultyFor` is written down.
 *
 * The effect is bounded and small by construction — `SCORE_DIFFICULTY_SPAN`
 * is 0.05, so the hardest event in the catalogue is worth at most about one
 * and a half points out of a hundred. It is a tie-break between two
 * identical afternoons, never a reason to hope for a bad break: the quality
 * the event costs you dwarfs the credit it pays back.
 */
export function scoringDifficultyFor(trial: TrialProgress, stage: TrialStage): number {
  return clamp01(
    trial.baseDifficulty + (trial.stageRolls[stage] ?? 0) + adversityWeightFor(trial, stage),
  );
}

export function keeperBonusFor(trial: TrialProgress, stage: TrialStage): number {
  return trial.adversity === "sharp-keeper" && trial.adversityStage === stage
    ? SHARP_KEEPER_BONUS
    : 0;
}

/**
 * What a stage was worth, 0-100.
 *
 * **The score is what you did, and difficulty decides how hard that was to
 * do.** That is a correction of the shape this used to have, and the reason
 * for it is worth keeping written down, because the old shape reads sensible
 * and measured badly at both ends:
 *
 *   score = quality × (0.70 + 0.60 × difficulty)
 *
 * Difficulty was doing two jobs at once — making the drills harder AND
 * re-pricing the result — and the two multiplied. Measured over 10,000 stage
 * rolls, difficulty has a median of 0.34 and comes out at exactly 0 for 11.6 %
 * of them. At the bottom that meant a flawless stage capped at 70 and a
 * flawless TRIAL at 70-73, on a roll the player never sees: the Premier
 * League's appetite peaks at 96 (scoutOffers.ts), so the best outcome in the
 * game was unreachable through no fault of anybody's. At the top the product
 * ran past 1 and got clamped, so from about 78 % quality upward on a hard
 * roll every performance scored the same 100 — the top quarter of skill was
 * invisible and a very good player got the same offer as a perfect one.
 *
 * So: strictly increasing in quality across the whole range at every
 * difficulty, no plateau at either end, and perfect play lands on 95-100
 * whatever was rolled. What difficulty still changes is everything the drills
 * do with `difficultyFor` — the quality itself is genuinely harder to earn on
 * a hard afternoon, which is the honest place for that to bite. The story is
 * told in words on the result card, off the stored `difficulty`.
 */
export function stageScore(quality: number, difficulty: number): number {
  const worth = SCORE_BASE + SCORE_DIFFICULTY_SPAN * clamp01(difficulty);
  return Math.round(100 * clamp01(clamp01(quality) * worth));
}

/**
 * Write a stage's result onto the trial, the moment it is decided.
 *
 * **Idempotent on purpose.** This is what makes closing the app safe: the
 * result is already on the career before the next screen renders, so there is
 * nothing in flight to lose. A second call for a stage that already has a
 * result returns the trial untouched rather than overwriting it — so a resume
 * cannot quietly replace a bad score with a better one, and a double-fired
 * callback cannot either.
 *
 * Note which difficulty goes where: the stage STORES the one it was actually
 * played at (reload bump and all, so the result card is honest about the
 * afternoon) and is SCORED on the one without it, so no amount of re-opening
 * the app can raise this number. What re-opening does do is take a slice off
 * the quality before it is written down.
 */
export function recordStage(
  trial: TrialProgress, stage: TrialStage, quality: number,
): TrialProgress {
  if (trial.results[stage]) return trial;
  // No haircut any more. The score is what you did — see the note above
  // RELOAD_GRACE for why re-opening the app now costs difficulty rather than
  // a quiet slice off a number the player can see.
  const played = clamp01(quality);
  return {
    ...trial,
    // Only clear an in-progress marker that somebody is actually keeping. If
    // this wrote `inProgress: null` onto a trial nobody sets it on, every
    // later resume would read as "between stages" and the anti-cheat would
    // silently stop charging from stage two onward.
    ...(trial.inProgress !== undefined ? { inProgress: null } : null),
    results: {
      ...trial.results,
      [stage]: {
        quality: played,
        // The FELT difficulty: what the drills were built from (reload bump
        // and all, so the result card is honest about the afternoon) PLUS
        // whatever the adversity event added on top, which the drill dial
        // deliberately does not carry. This is the label's number, not the
        // score's — see `scoringDifficultyFor` for that one.
        difficulty: clamp01(difficultyFor(trial, stage) + adversityWeightFor(trial, stage)),
        score: stageScore(played, scoringDifficultyFor(trial, stage)),
        decidedAt: Date.now(),
      },
    },
  };
}

/**
 * Say which stage the player has just walked into, so a resume out of it can
 * be told apart from a resume that interrupted nothing.
 *
 * Wanted by `components/star/TrialSequence.tsx` — that component is the only
 * thing that knows a stage screen has opened — and not called from anywhere
 * yet. See `TrialProgress.inProgress`.
 */
export function beginStage(trial: TrialProgress, stage: TrialStage): TrialProgress {
  if (trial.inProgress === stage) return trial;
  return { ...trial, inProgress: stage };
}

/**
 * Did this load actually interrupt anything?
 *
 * The bar the anti-cheat is supposed to clear, and did not: a charge needs a
 * stage genuinely under way with no result yet. Two loads that were being
 * billed and should not have been —
 *
 *  - **the first load after career creation.** Nothing has been played, so
 *    there is nothing to retry and nothing to farm.
 *  - **a phone evicting a backgrounded tab.** iOS discards backgrounded tabs
 *    routinely; coming back to one is not a decision the player made.
 *
 * What is provable from the trial's own data, and what is not, stated plainly
 * because the difference matters:
 *
 *  - With `inProgress` kept (nothing keeps it yet — see `beginStage`) both
 *    cases are exact. Backgrounding the app on a between-stages result card
 *    leaves `inProgress` at null and costs nothing.
 *  - Without it, the fallback below can still prove the first-load case: an
 *    untouched trial being loaded for the first time has interrupted nothing,
 *    while a SECOND load of a still-untouched trial means the player has been
 *    sitting inside stage one and walked out of it, which is the exact thing
 *    the design set out to charge for. It cannot tell an eviction from a
 *    deliberate close, so mid-trial evictions still cost — the same as they
 *    did before, and the reason `inProgress` is worth wiring.
 */
export function resumeInterrupted(trial: TrialProgress): boolean {
  // Nothing left to walk back into.
  if (trialComplete(trial)) return false;

  if (trial.inProgress !== undefined) {
    return trial.inProgress !== null && !trial.results[trial.inProgress];
  }

  // A stage has genuinely been played, or a five-a-side is sitting half
  // finished — either way this load came back into a trial under way.
  if (trial.fiveASide !== undefined) return true;
  if (Object.keys(trial.results).length > 0) return true;

  // Untouched. The first sighting is the load right after career creation;
  // anything after that is a walk-out of stage one.
  return (trial.resumes ?? 0) > 0;
}

/**
 * Count a resume. See the note at the top of the file.
 *
 * Every resume is SEEN (`resumes`) — that is what lets the next one know it
 * is not the first. Only one that interrupted something is CHARGED
 * (`reloads`), and only the charged ones cost anything.
 */
export function noteReload(trial: TrialProgress): TrialProgress {
  const charge = resumeInterrupted(trial);
  return {
    ...trial,
    resumes: (trial.resumes ?? 0) + 1,
    reloads: trial.reloads + (charge ? 1 : 0),
  };
}

/** The first stage with no result yet, or null when the trial is over. */
export function nextStage(trial: TrialProgress): TrialStage | null {
  return TRIAL_STAGES.find(s => !trial.results[s]) ?? null;
}

export function trialComplete(trial: TrialProgress): boolean {
  return nextStage(trial) === null;
}

/**
 * The number the whole afternoon comes down to, 0-100 — what the watching
 * clubs actually saw.
 *
 * Every stage counts the same. That was a real choice: weighting the
 * five-a-side higher is tempting because it is the most football-like stage,
 * but it would make the other four feel like a warm-up you have to sit
 * through, and they are the stages that most directly test the five trained
 * stats. An unplayed stage counts as nothing rather than being skipped, so a
 * trial abandoned three stages in scores like a trial three-fifths played —
 * which it was.
 */
export function trialScore(trial: TrialProgress): number {
  const total = TRIAL_STAGES.reduce((sum, s) => sum + (trial.results[s]?.score ?? 0), 0);
  return Math.round(total / TRIAL_STAGES.length);
}
