import type { CareerState, LeagueSquad, LeaguePlayer, LeagueResult } from "./types";
import type { Role } from "./formations";
import { bestFitness } from "./formations";
import { formationForClub } from "./clubFormation";

/**
 * THE STARTING JOB ISN'T LOST THE MOMENT SOMEBODY BETTER IS SIGNED.
 *
 * Requested directly, in full mechanical detail, after reporting that a
 * newly-signed 90-rated striker sat behind Chelsea's existing 86-rated one
 * with no sign either would ever change: a real manager doesn't bench his
 * in-form striker the day a better one arrives, but he also doesn't keep
 * picking him forever once he stops delivering. The rule, exactly as given:
 *
 *   · Only a STRICTLY better bench player challenges the current starter at
 *     his own role — a same-or-lower-rated bench player is just squad depth,
 *     never a threat to the job.
 *   · The incumbent gets a number of "grace games" — real matches he can
 *     start without delivering and still keep the shirt next time — that
 *     SHRINKS as the rating gap to his challenger grows: barely any real gap
 *     (1-2) earns him 3 grace games, a real one (4) only 1-2, a wide one
 *     (6+) earns him none at all — the challenger takes over immediately.
 *     `graceGamesFor` below is the exact agreed formula.
 *   · What counts as "delivering" depends on the role: a goal or an assist
 *     for the attacking positions (ST/LW/RW/CAM — a winger or a striker is
 *     judged on end product), the team's own result for everyone else (a
 *     win or a draw is a pass, a loss counts against him — you don't drop a
 *     centre-back who keeps winning). Any real pass resets his grace back
 *     to full; a real miss spends one.
 *   · Once grace is spent, the challenger becomes the new incumbent (with
 *     his own fresh grace against whoever's now the bench threat), and the
 *     demoted man doesn't vanish — see `teamsheet.ts`'s own note on
 *     `previousStarterId` for the one real exception this game can still
 *     make good on: he gets started again specifically for a CUP tie.
 *
 * ── Where this actually reaches, and why ──
 *
 * Scoped to `career.leagueSquads` only — the player's own division's other
 * nineteen real, weekly-simulated clubs. Two things this deliberately does
 * NOT touch, both for the same reason: they're not this system to begin
 * with. `career.externalSquads` (Championship/Europa/Saudi clubs) are never
 * simulated week to week, so there's no real per-week form/result signal to
 * judge them by. And the human's own club reads `career.squad` — a
 * completely different shape (`SquadPlayer`, not `LeaguePlayer`) driven by
 * the player's own choices about his own match, which this was never asked
 * to override.
 *
 * ── How "starting" is actually read and written ──
 *
 * `leagueSquads.ts` already has a real, load-bearing convention: a squad's
 * `players` array holds its starting XI in the first 11 slots and its bench
 * from index 11 on (`averageStartingXIRating`, `weightedPick`'s own
 * `BENCH_WEIGHT` discount). A "promotion" here is exactly swapping the
 * challenger's and the demoted starter's positions in that same array —
 * nothing new to teach the goal-simulation or strength-reading code, it
 * already reads whoever ends up in the first 11.
 */

export interface IncumbencyRecord {
  club: string;
  position: Role;
  starterId: string;
  /** The man this record's current starter took the job from — kept
   *  around (not cleared) so a cup tie can start him instead. See
   *  `teamsheet.ts`'s own cup-preference note. */
  previousStarterId?: string;
  graceRemaining: number;
  /** The incumbent's own cumulative season goals+assists as of the last
   *  evaluation — the only way to tell "did he contribute THIS week"
   *  without a second, parallel per-week attribution system: a rise since
   *  last week means yes, unchanged means no. */
  lastGoalsPlusAssists: number;
}

const ATTACKING_ROLES: Role[] = ["ST", "LW", "RW", "CAM"];

/** The exact agreed curve: barely any gap buys plenty of patience, a real
 *  gap buys much less, and a wide-enough gap buys none at all. */
export function graceGamesFor(gap: number): number {
  return Math.max(0, 3 - Math.floor(gap / 2));
}

function isAttacking(role: Role): boolean {
  return ATTACKING_ROLES.includes(role);
}

/** Whether `club` won or drew this week (a "pass" for a non-attacking
 *  incumbent) — absent from `results` entirely (a bye, or simply not
 *  found) counts as a pass too: no evidence against him is not evidence
 *  against him. */
function wonOrDrew(club: string, results: LeagueResult[]): boolean {
  const r = results.find(res => res.home === club || res.away === club);
  if (!r) return true;
  return r.hs === r.as || (r.home === club ? r.hs >= r.as : r.as >= r.hs);
}

/** The real current starter and his real strictly-better challenger at one
 *  role, from one club's actual squad. Without a tracked record yet, "the
 *  starter" is read off the real array-order convention (index < 11 — see
 *  this file's own header) rather than simply whoever's rated highest —
 *  the whole point is that a higher-rated BENCH player is a challenger,
 *  not already the incumbent. Once tracked, the incumbent stays "the
 *  starter" for as long as he's still genuinely a fit here (a sale needs a
 *  fresh incumbent with no memory of a rivalry that no longer applies). */
function starterAndChallenger(
  squad: LeagueSquad, role: Role, trackedStarterId: string | undefined,
): { starter: LeaguePlayer | undefined; starterIndex: number; challenger: LeaguePlayer | undefined; challengerIndex: number } {
  const fits = squad.players.map((p, i) => ({ p, i, fit: bestFitness(role, p) })).filter(x => x.fit >= 82);
  const startingFits = fits.filter(x => x.i < 11).sort((a, b) => b.p.overall - a.p.overall);
  const benchFits = fits.filter(x => x.i >= 11).sort((a, b) => b.p.overall - a.p.overall);
  if (startingFits.length === 0) return { starter: undefined, starterIndex: -1, challenger: undefined, challengerIndex: -1 };
  const tracked = trackedStarterId ? fits.find(x => x.p.id === trackedStarterId) : undefined;
  const best = tracked ?? startingFits[0];
  const rival = benchFits.find(x => x.p.overall > best.p.overall);
  return { starter: best.p, starterIndex: best.i, challenger: rival?.p, challengerIndex: rival?.i ?? -1 };
}

/**
 * One week's worth of grace, spend, and — when it runs out — promotion,
 * for every real rivalry currently live across the whole division.
 *
 * `results` is that week's real `LeagueResult[]` (every club, not just the
 * player's own match) — `careerFlow.ts`'s `creditMatchResult` already has
 * exactly this from `playLeagueWeek`, the same week `leagueSquads`' own
 * goal/assist tallies were just updated for.
 */
export function advanceIncumbencyWeek(career: CareerState, results: LeagueResult[]): CareerState {
  const squads = career.leagueSquads ?? [];
  if (squads.length === 0) return career;

  const records = [...(career.incumbents ?? [])];
  let changedSquads = false;
  const nextSquads = squads.map(sq => {
    if (sq.club === career.player.club) return sq; // out of scope — see this file's own header
    const formation = formationForClub(sq.club);
    const roles = Array.from(new Set(formation.slots.map(s => s.role)));
    let players = sq.players;
    let mutated = false;

    for (const role of roles) {
      const idx = records.findIndex(r => r.club === sq.club && r.position === role);
      const existing = idx >= 0 ? records[idx] : undefined;
      const { starter, starterIndex, challenger, challengerIndex } =
        starterAndChallenger({ ...sq, players }, role, existing?.starterId);
      if (!starter) continue;
      if (!challenger) {
        // No live rivalry this week (nobody strictly better on the bench
        // any more — a sale, most likely) — the record has nothing left
        // to track.
        if (idx >= 0) records.splice(idx, 1);
        continue;
      }

      const gap = challenger.overall - starter.overall;
      const grace = graceGamesFor(gap);
      const isFreshRivalry = !existing || existing.starterId !== starter.id;

      const doSwap = () => {
        if (players === sq.players) players = [...sq.players];
        [players[starterIndex], players[challengerIndex]] = [players[challengerIndex], players[starterIndex]];
        mutated = true;
        return {
          club: sq.club, position: role, starterId: challenger.id, previousStarterId: starter.id,
          graceRemaining: graceGamesFor(0), lastGoalsPlusAssists: challenger.goals + challenger.assists,
        };
      };

      let record: IncumbencyRecord;
      if (isFreshRivalry) {
        // A rivalry only just became real this week (a new signing, most
        // often) — nothing to compare THIS week's total against yet, so
        // there's no fail to charge him for it. The one real exception: a
        // gap wide enough to earn zero grace at all gets no grace period
        // to wait out — the challenger starts right away.
        record = grace === 0 ? doSwap()
          : { club: sq.club, position: role, starterId: starter.id, graceRemaining: grace, lastGoalsPlusAssists: starter.goals + starter.assists };
      } else {
        const currentTotal = starter.goals + starter.assists;
        const passed = isAttacking(role) ? currentTotal > existing!.lastGoalsPlusAssists : wonOrDrew(sq.club, results);
        record = passed
          ? { ...existing!, graceRemaining: grace, lastGoalsPlusAssists: currentTotal }
          : existing!.graceRemaining <= 0
            ? doSwap()
            : { ...existing!, graceRemaining: existing!.graceRemaining - 1, lastGoalsPlusAssists: currentTotal };
      }

      if (idx >= 0) records[idx] = record; else records.push(record);
    }

    if (mutated) changedSquads = true;
    return mutated ? { ...sq, players } : sq;
  });

  return { ...career, incumbents: records, ...(changedSquads ? { leagueSquads: nextSquads } : {}) };
}

/** For `teamsheet.ts`'s own cup-preference override — every real rivalry
 *  currently tracked for one club, whatever role each is at. */
export function incumbencyRecordsFor(career: CareerState, club: string): IncumbencyRecord[] {
  return (career.incumbents ?? []).filter(r => r.club === club);
}
