/**
 * SLEEPING IN YOUR HOUSE (Harry, 20 Nov 2026: "sleeping in the house should actually pass time").
 *
 * The career has no clock between matches: it has the WEEK, the gap from one match to the next,
 * with its few things to do (week.ts: train, a relationship, or Rest). So a night's sleep is tied
 * to that gap, not to a calendar day:
 *
 *  - Sleep in your bed = the week's Rest, once per gap between matches. It spends one of the
 *    week's things and gives back exactly what Rest gives (REST_ENERGY, more when you are happy).
 *    Never more than Rest, so it is not a free top-up, and it never moves a fixture: the season's
 *    calendar only turns when a match is played.
 *  - A second sleep in the same gap, a sleep with nothing left to do this week, or a sleep at full
 *    energy changes nothing on the career (the house still goes to the next morning).
 *
 * The 3D side (the fade, night to morning through the windows, team-mates starting their day) is
 * lib/star/home3d/scene.ts and lib/star/world3d/houseLife.ts. Pure: no three.js.
 */
import type { CareerState } from "../types";
import { actionsLeft, rest } from "../week";
import { nextFixtureFor } from "../competitions";

export type SleepWhy = "rested" | "sleptAlready" | "nothingLeft" | "fullEnergy";

export interface SleepResult {
  career: CareerState;
  /** True when the career changed (energy back, one of the week's things spent). */
  rested: boolean;
  why: SleepWhy;
  /** Energy gained (0 unless rested). */
  gained: number;
  /** The card's words after the night. */
  text: string;
}

/** Has this gap between matches had its night's sleep already? */
export function sleptThisWeek(c: Pick<CareerState, "season" | "week" | "lastSleep">): boolean {
  return !!c.lastSleep && c.lastSleep.season === c.season && c.lastSleep.week === c.week;
}

/** "Next: Chelsea (home)", or nothing when there is no match to come. */
function nextLine(c: CareerState): string {
  try {
    const f = nextFixtureFor(c);
    return f ? ` Next: ${f.opponent} (${f.home ? "home" : "away"}).` : "";
  } catch { return ""; }
}

/** A night in your bed. Returns the same career object when nothing changes. */
export function sleepNight(c: CareerState): SleepResult {
  if (sleptThisWeek(c)) return { career: c, rested: false, why: "sleptAlready", gained: 0, text: `You've already slept since the last match: no more energy until it's played.${nextLine(c)}` };
  if (actionsLeft(c) <= 0) return { career: c, rested: false, why: "nothingLeft", gained: 0, text: `A good night, but this week's three things are used up: no energy back.${nextLine(c)}` };
  if (c.energy >= 100) return { career: c, rested: false, why: "fullEnergy", gained: 0, text: `A good night. Your energy was already full (100).${nextLine(c)}` };
  const next = rest(c);
  const gained = next.energy - c.energy;
  return {
    career: { ...next, lastSleep: { season: c.season, week: c.week } },
    rested: true, why: "rested", gained,
    text: `Rested: energy ${c.energy} → ${next.energy} (+${gained}). That was this week's rest.${nextLine(c)}`,
  };
}
