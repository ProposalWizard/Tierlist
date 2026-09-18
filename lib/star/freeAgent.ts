import { canAct, spendAction, startNewWeek } from "./week";
import { startTrial } from "./trial";
import type { CareerState } from "./types";

/**
 * LIFE WITHOUT A CLUB.
 *
 * A career can now genuinely exist before anybody has signed it — a trialist,
 * or a player whose trial went badly enough that nobody came in for him. This
 * is what his week is made of.
 *
 * ── Why these four and nothing else ──
 *
 * The cut-down dashboard was specified directly: "home, video games, gym,
 * social". That is a short list on purpose, and the omissions are the point —
 * a clubless career has no fixtures, no league table, no squad, no team sheet,
 * no manager, no cups, no Europe, no transfer window and no contract screen,
 * because not one of them has anything to point at. Showing them greyed out
 * would be a worse lie than not showing them.
 *
 * ── The money ──
 *
 * ★10 a week, decided directly and deliberately much lower than the ★50 first
 * floated: it is a scrape, not a living.
 *
 * Against the shop as it stands today — cheapest item ★6,000 — that is not
 * "save up for a while", it is out of reach for the entire phase. An earlier
 * version of this note claimed both things in the same file, which is the sort
 * of contradiction that only survives because nobody reads two paragraphs
 * together. The honest statement is the second one: the shop is closed to a
 * free agent until step 9 of the rework prices a cheap band against THIS
 * number rather than against a signed player's wage.
 */

/**
 * What a week out of work pays: ★10. Literally ten, and NOT multiplied by
 * `MONEY_SCALE`.
 *
 * ── Why this one is not scaled, when three others had to be ──
 *
 * `MONEY_SCALE` exists because every money value in the game was multiplied by
 * 2000 on 14 Sep 2026, and a handful of figures written before that were left
 * behind. The instinct, having just fixed three of those, is to scale anything
 * new — and it is wrong here, because ★10 was given as a figure on the CURRENT
 * scale, not the old one.
 *
 * Scaling it would have paid a free agent ★20,000 a week. A starting
 * professional earns ★2,000 a week. So a man nobody will sign would have been
 * on ten times a first-team wage, which is the opposite of the point.
 *
 * Caught by this file's own test, which asserts the pay is less than the
 * cheapest thing in the shop. It was not.
 *
 * ── What it means, stated rather than discovered later ──
 *
 * ★10 a week against a shop whose cheapest item is ★6,000 means the shop is
 * entirely out of reach while you are a free agent. That is deliberate — the
 * phase is meant to be lean — but it also means the cheap band of the shop
 * (step 9 of the rework) has to be priced against THIS number and not against
 * a signed player's wage, or the free agent's shop is a locked door.
 */
export const FREE_AGENT_WEEKLY_PAY = 10;

/**
 * The ceiling on training alone.
 *
 * Declared here, above its only user, because there were briefly TWO of it — a
 * `const cap = 55` inside the function and this one — in a file whose own
 * comment said the number was "stated once". Caught in review.
 *
 * Shown on the bar in the screen, so a player sees where the garden runs out
 * rather than discovering it by grinding into a wall.
 */
export const GARDEN_GYM_CAP = 55;

export type LeisureAction = "games" | "social" | "gym";

export interface LeisureResult {
  career: CareerState;
  note: string;
}

/**
 * What an afternoon spent on something other than football does.
 *
 * Deliberately small numbers. These are not a route to anything — they are
 * what the weeks are made of while you wait for a trial, and a free agent who
 * could train his way to a Premier League contract from his garden would make
 * the whole phase pointless. The real way out is another trial.
 */
export function spendOn(career: CareerState, what: LeisureAction): LeisureResult {
  if (!canAct(career)) {
    return { career, note: "Nothing left in you this week." };
  }
  const base = spendAction(career);
  switch (what) {
    case "games":
      return {
        career: { ...base, happiness: Math.min(100, base.happiness + 6) },
        note: "A few hours lost to the console. You needed it.",
      };
    case "social":
      return {
        career: {
          ...base,
          happiness: Math.min(100, base.happiness + 9),
          // Seeing people costs money, even cheaply — priced against what a
          // free agent actually has coming in (see FREE_AGENT_WEEKLY_PAY), not
          // against a professional's wage.
          money: Math.max(0, base.money - 3),
        },
        note: "Out with your mates. Cheaper than it used to be.",
      };
    case "gym": {
      // Training alone improves you, slowly, and only to a point — there is no
      // coach, no team, and nobody telling you what you are doing wrong.
      const bump = (v: number) => (v >= GARDEN_GYM_CAP ? v : Math.min(GARDEN_GYM_CAP, v + 1));
      return {
        career: {
          ...base,
          skills: {
            ...base.skills,
            power: bump(base.skills.power),
            technique: bump(base.skills.technique),
          },
          energy: Math.max(0, base.energy - 8),
          happiness: Math.max(0, base.happiness - 2),
        },
        note: base.skills.technique >= GARDEN_GYM_CAP
          ? "You are as sharp as a garden gym is going to get you."
          : "Weights, then the wall. Nobody watching.",
      };
    }
  }
}




/**
 * END THE WEEK.
 *
 * A free agent has no fixtures, and a week normally rolls over when a fixture
 * is settled — so without this the week simply never ended: three actions and
 * the screen said "that is the week gone" forever. Found in review, and it is
 * the difference between a loop and a dead end.
 *
 * This is also the only thing that ever pays him. `FREE_AGENT_WEEKLY_PAY` was
 * written, displayed on screen, and credited by nothing.
 */
/**
 * How many weeks out of work before somebody gives you a look.
 *
 * Long enough to be a real stretch of nothing, short enough that the phase is
 * a story rather than a punishment. Four is about a month of the garden, the
 * console and your mates, which is what the whole thing is for.
 */
export const WEEKS_BETWEEN_TRIALS = 4;

/** Has somebody invited you in? */
export function trialDue(career: CareerState): boolean {
  if (career.trial && !career.trial.results.fiveASide) return false;
  return (career.weeksSinceTrial ?? 0) >= WEEKS_BETWEEN_TRIALS;
}

/**
 * A new trial, at a lower bar than the one that turned you down.
 *
 * ── The dead end this exists to close ──
 *
 * `startTrial` was called in exactly one place in the whole game: career
 * creation. So a player whose first trial scored under the interest bar went
 * to the free-agent shell and could NEVER reach a club again, by any path —
 * while the file beside this one told him "the real way out is another trial"
 * and the screen told him "now you wait". He was waiting for something that
 * did not exist. Found by an independent check of the review.
 *
 * The bar is lower because the way back is downward into the leagues: a man
 * nobody in the Premier League wanted is being looked at by a National League
 * club, and the afternoon should be winnable. That is the shape §3.7 of the
 * rework asks for — the route back is real, and it starts at the bottom.
 */
export function grantTrial(career: CareerState): CareerState {
  const trial = startTrial();
  return {
    ...career,
    weeksSinceTrial: 0,
    // ── What actually makes a retrial a lower bar ──
    //
    // Counting this is the whole mechanism. `generateScoutOffers` reads it
    // (via `ScoutContext.retrial`, scoutOffers.ts) and judges the afternoon
    // against a bar of 18 rather than 30, on a ladder shifted a rung down — so
    // an afternoon that brought nobody first time genuinely brings a National
    // League club on the second look.
    //
    // It has to live here rather than on `TrialProgress` because the trial's
    // own shape is not this module's to change, and because "how many looks
    // has this career had" is a fact about the career, not about one
    // afternoon. `undefined` reads as 1 — a career that has only ever had the
    // trial it opened with.
    trialsTaken: (career.trialsTaken ?? 1) + 1,
    trial: {
      ...trial,
      // A shade easier than a first trial, because a lower-tier club is asking
      // for less. Not free: you still have to play it.
      //
      // Worth being honest about how little this does on its own now. Under
      // the scoring model in trial.ts today a stage is worth
      // `0.95 + 0.05 × difficulty`, so an EASIER afternoon has a very slightly
      // LOWER ceiling — the drills genuinely get kinder (everything reading
      // `difficultyFor` does), but the number at the end barely moves, and a
      // retrial that only did this would be neutral at best. The real drop in
      // the bar is `trialsTaken` above.
      baseDifficulty: Math.max(0, trial.baseDifficulty - 0.15),
    },
  };
}

/**
 * ── The four-tap re-roll this refuses ──
 *
 * The free-agent shell's bottom-nav "Week" button called this with no check on
 * whether the week had actually been lived. Four taps rolled the week over
 * four times, `weeksSinceTrial` hit `WEEKS_BETWEEN_TRIALS`, and a fresh trial
 * was due — with a brand-new random seed, since `grantTrial` calls
 * `startTrial()`. Failing a trial on purpose was therefore the cheapest re-roll
 * in the game, which is the exact opposite of the "closing the app should cost
 * you" design the whole seeded-trial anti-cheat is built around (see trial.ts).
 *
 * A week ends when it has been spent, and not before. Returning the career
 * untouched rather than throwing keeps this the same shape as `spendOn` above,
 * which already refuses an action there is no day left for — and lets the
 * screen tell the player why instead of silently doing nothing.
 */
export function endFreeAgentWeek(career: CareerState): CareerState {
  if (canAct(career)) return career;
  return {
    ...career,
    weeksSinceTrial: (career.weeksSinceTrial ?? 0) + 1,
    ...startNewWeek(),
    week: career.week + 1,
    money: career.money + FREE_AGENT_WEEKLY_PAY,
    // Living on nothing wears at you. Small, and Rest and the other actions
    // are there to push back against it — this is a drift, not a doom clock.
    happiness: Math.max(0, career.happiness - 1),
    // Nobody is taking it out of you, so you arrive at the next week fresh.
    energy: Math.min(100, career.energy + 25),
  };
}
