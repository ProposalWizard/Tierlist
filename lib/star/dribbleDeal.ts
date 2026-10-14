/**
 * THE TOP-DOWN DRIBBLE AS A CHANCE IN THE NEW DEAL (Settings → Chances: New).
 *
 * Harry, 14 Oct 2026: "we need to reintroduce the top down dribbling as a
 * chance too" and "as you go up the leagues the live scenarios could get more
 * intense with off-ball movement and maybe even dribbling introduced".
 *
 * Before this, the unseen match rolled its own flat dribble (DRIBBLE_CHANCE,
 * hiddenMatch.ts): about 12% of open play in every league, from any break or
 * settled move that reached the final third. With Chances: New the deal
 * decides instead:
 *
 *   - only when the radar's moment fits: a break (pattern "transition") or the
 *     match's own "space to run into" moment, with the ball in the middle or
 *     the attacking third (not the box: no grass ahead to run into);
 *   - with a share of open play set by the league you play in
 *     (DRIBBLE_SHARE_BY_LEVEL, below);
 *   - never two dribbles in a row, at most two in any eight chances (the
 *     same rule the per-kind guard uses, kindMix.ts).
 *
 * A dribble the match asked for that the deal turns down is served as the
 * break it was: an ordinary open-play chance from that zone.
 *
 * Its own random stream, so the unseen match (scores, minutes, every other
 * chance) is untouched by it. Old never calls this: Old is byte-identical.
 */
import { kindsForZone, type ScenarioRequest } from "./hiddenMatch";
import type { CareerDivision } from "./calendar";
import { GUARD_WINDOW, GUARD_MAX_IN_WINDOW } from "./kindMix";

export type DribbleLevel = "national" | "league_two" | "league_one" | "championship" | "premier" | "europe";

/**
 * Share of OPEN PLAY chances that are a top-down dribble, by level.
 * A GUESS TO TUNE (14 Oct 2026): 3% at the bottom (a dribble about every
 * other match), 10% at the top (about one a match). Measured in
 * tests/star/chanceJudge.mts ("dribble share by league").
 */
export const DRIBBLE_SHARE_BY_LEVEL: Record<DribbleLevel, number> = {
  national: 0.03,
  league_two: 0.045,
  league_one: 0.06,
  championship: 0.08,
  premier: 0.10,
  europe: 0.10,
};

/**
 * How much of open play is a fitting moment (a break or "space to run into"
 * in the middle or attacking third). Measured over two sets of 400 radar
 * matches on 14 Oct 2026: 15.5% and 16.4% of open play. The share above is
 * divided by this to get the chance a fitting moment becomes a dribble (the
 * guard trims the top end a little).
 */
export const FIT_SHARE = 0.16;

const EUROPE = new Set(["Champions League", "Europa League", "Conference League", "Super Cup"]);

/** The level a match is played at: a European tie is "europe"; anything else
 *  (league, cups) is your division. No career → Premier League. */
export function dribbleLevelFor(division: CareerDivision | undefined, competition?: string): DribbleLevel {
  if (competition && EUROPE.has(competition)) return "europe";
  switch (division) {
    case "national_league": case "national_league_north": case "national_league_south": return "national";
    case "league_two": return "league_two";
    case "league_one": return "league_one";
    case "championship": return "championship";
    default: return "premier";
  }
}

/** Open play: not a set piece and not a penalty your side has won. */
export const isOpenPlay = (r: ScenarioRequest) => r.pattern !== "set_piece" && !r.penaltyWon;

/** Does the radar's moment fit a run with the ball? */
export function dribbleMomentFits(r: ScenarioRequest): boolean {
  if (!isOpenPlay(r) || r.lateCharge) return false;
  if (r.zone !== "middle" && r.zone !== "attacking") return false;
  return !!r.dribble || r.pattern === "transition";
}

/** One match's record of what the deal served (true = a dribble), oldest first. */
export interface DribbleDeal { served: boolean[] }
export const newDribbleDeal = (): DribbleDeal => ({ served: [] });

/** The guard: never twice in a row, at most GUARD_MAX_IN_WINDOW in any GUARD_WINDOW. */
export function dribbleGuardAllows(deal: DribbleDeal): boolean {
  const s = deal.served;
  if (s.length && s[s.length - 1]) return false;
  return s.slice(-(GUARD_WINDOW - 1)).filter(Boolean).length < GUARD_MAX_IN_WINDOW;
}

/**
 * The request as the New deal serves it, and noted in `deal`. Draws exactly
 * one rng() for a fitting moment, none otherwise.
 */
export function dealDribble(req: ScenarioRequest, level: DribbleLevel, deal: DribbleDeal, rng: () => number): ScenarioRequest {
  let out: ScenarioRequest = req;
  if (dribbleMomentFits(req)) {
    const p = Math.min(1, DRIBBLE_SHARE_BY_LEVEL[level] / FIT_SHARE);
    const roll = rng();
    if (dribbleGuardAllows(deal) && roll < p) {
      out = req.dribble ? req : {
        ...req, dribble: true, kinds: ["one_on_one"],
        reason: "You pick it up on the break with space to run into",
      };
    } else if (req.dribble) {
      out = { ...req, dribble: false, kinds: kindsForZone(req.zone, req.lane ?? "centre"), pattern: "transition" };
    }
  } else if (req.dribble) {
    // A dribble the moment does not fit (cannot happen today: the match only
    // asks from the final third) is served as the open-play chance it was.
    out = { ...req, dribble: false, kinds: kindsForZone(req.zone, req.lane ?? "centre"), pattern: "transition" };
  }
  if (isOpenPlay(out)) deal.served.push(!!out.dribble);
  return out;
}
