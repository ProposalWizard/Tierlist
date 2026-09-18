import { canAct, spendAction } from "./week";
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
 * floated: it is a scrape, not a living. The point is that the cheap end of
 * the shop is REACHABLE IF YOU SAVE FOR IT, which is exactly the feeling this
 * phase is meant to have — at this rate the cheapest useful thing is weeks of
 * doing without, and that is the story.
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
      const cap = 55;
      const bump = (v: number) => (v >= cap ? v : Math.min(cap, v + 1));
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
        note: base.skills.technique >= cap
          ? "You are as sharp as a garden gym is going to get you."
          : "Weights, then the wall. Nobody watching.",
      };
    }
  }
}

/** The ceiling on training alone — stated once so the screen can say it
 *  rather than the player discovering it by grinding into a wall. */
export const GARDEN_GYM_CAP = 55;
