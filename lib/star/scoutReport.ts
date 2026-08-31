import type { CareerState, LeagueSquad, LeaguePlayer, SquadPlayer } from "./types";
import { sortLeague } from "./season";
import { groundFor, crowdFor } from "./stadiums";

/**
 * THE SCOUT REPORT.
 *
 * What the pre-match screen tells you about who you're about to play —
 * requested directly, with a real-game screenshot as the reference for the
 * shape of it: top scorer, assist king, best player, a couple of strengths
 * and weaknesses, a tactical hint, where they sit in the table, the ground,
 * and your own history against them.
 *
 * Everything here is either read straight off data the game already tracks
 * (leagueSquads/externalSquads, the league table, headToHead) or DERIVED
 * from it — nothing is invented. Strengths/weaknesses specifically: no stat
 * called "Attacking Width" or "Press Resistance" exists anywhere in this
 * game, and inventing one to look FM-authentic would just be a more
 * convincing-looking lie than the plain truth. What genuinely exists is a
 * squad of players with real overalls and real positions, so that's what
 * gets compared — attack/midfield/defence/depth, each versus the division's
 * own average — which is honest and still reads exactly like a scout's
 * verdict.
 */

const ATTACK: SquadPlayer["position"][] = ["ST", "LW", "RW", "CAM"];
const MIDFIELD: SquadPlayer["position"][] = ["CDM", "CM"];
const DEFENCE: SquadPlayer["position"][] = ["GK", "CB", "LB", "RB"];

export interface ScoutPlayer {
  name: string;
  value: number;
  position: string;
}

export interface ScoutFactor {
  label: string;
  /** +1..+3 a real strength, -1..-3 a real weakness, magnitude only used for the bar. */
  level: number;
}

export interface ScoutReport {
  club: string;
  ground: { name: string; crowd: number };
  /** Null when the opponent isn't in your own division's table — a cup
   *  shock against an outside club, mainly. */
  table: { position: number; of: number } | null;
  topScorer: ScoutPlayer | null;
  topAssister: ScoutPlayer | null;
  bestPlayer: ScoutPlayer | null;
  strengths: ScoutFactor[];
  weaknesses: ScoutFactor[];
  tacticalHint: string;
  headToHead: { wins: number; draws: number; losses: number } | null;
}

function squadFor(career: CareerState, club: string): LeagueSquad | undefined {
  return (career.leagueSquads ?? []).find(s => s.club === club)
    ?? (career.externalSquads ?? []).find(s => s.club === club);
}

function avgOverall(players: LeaguePlayer[], positions: SquadPlayer["position"][]): number | null {
  const in_ = players.filter(p => positions.includes(p.position));
  if (!in_.length) return null;
  return in_.reduce((s, p) => s + p.overall, 0) / in_.length;
}

function best<T>(items: T[], value: (t: T) => number): T | null {
  return items.reduce<T | null>((top, item) => (top === null || value(item) > value(top) ? item : top), null);
}

/** The four things a squad can be judged on, for one club — null for any
 *  metric its available squad data can't support. */
function ratingsFor(squad: LeagueSquad | undefined): Record<"Attack" | "Midfield" | "Defence" | "Depth", number | null> {
  if (!squad || !squad.players.length) return { Attack: null, Midfield: null, Defence: null, Depth: null };
  const overall = squad.players.reduce((s, p) => s + p.overall, 0) / squad.players.length;
  return {
    Attack: avgOverall(squad.players, ATTACK),
    Midfield: avgOverall(squad.players, MIDFIELD),
    Defence: avgOverall(squad.players, DEFENCE),
    Depth: overall,
  };
}

const HINTS: Record<string, string> = {
  Attack: "They don't carry much of a goal threat — a clean sheet is well within reach.",
  Midfield: "They get overrun through the middle — press them high and win the ball back.",
  Defence: "Their back line is there to be got at — a direct ball in behind could pay off.",
  Depth: "Their squad is thin — keep the tempo high and it'll show late on.",
  Form: "They're out of form and there for the taking.",
};

/** How far apart two ratings have to be before it's worth calling out, and
 *  how many "levels" apart maps to the bar's 1-3 segments. */
const FACTOR_STEP = 3;

export function scoutReportFor(career: CareerState, opponent: string, week: number): ScoutReport {
  const squad = squadFor(career, opponent);
  const table = sortLeague(career.league);
  const idx = table.findIndex(t => t.name === opponent);
  const team = idx >= 0 ? table[idx] : null;

  const topScorer = squad ? best(squad.players, p => p.goals) : null;
  const topAssister = squad ? best(squad.players, p => p.assists) : null;
  const bestPlayer = squad ? best(squad.players, p => p.overall) : null;

  // League-wide averages, over whichever clubs actually have squad data —
  // a partial roll-out (some clubs fetched, some not yet) still produces a
  // meaningful comparison rather than none at all.
  const clubRatings = career.league
    .map(t => ratingsFor(squadFor(career, t.name)))
    .filter(r => r.Attack !== null || r.Midfield !== null || r.Defence !== null || r.Depth !== null);
  const leagueAvg = (key: "Attack" | "Midfield" | "Defence" | "Depth"): number | null => {
    const vals = clubRatings.map(r => r[key]).filter((v): v is number => v !== null);
    return vals.length >= 3 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  const mine = ratingsFor(squad);
  const factors: { label: string; diff: number }[] = [];
  for (const key of ["Attack", "Midfield", "Defence", "Depth"] as const) {
    const avg = leagueAvg(key);
    if (mine[key] === null || avg === null) continue;
    factors.push({ label: key, diff: mine[key]! - avg });
  }
  // Form: points per game so far, against the division's own average —
  // meaningless in week 1, when nobody has played anything yet.
  if (team && team.played > 0) {
    const leaguePpg = table.filter(t => t.played > 0);
    if (leaguePpg.length >= 3) {
      const avgPpg = leaguePpg.reduce((s, t) => s + t.points / t.played, 0) / leaguePpg.length;
      factors.push({ label: "Form", diff: (team.points / team.played - avgPpg) * 2.5 });
    }
  }

  const toFactor = (f: { label: string; diff: number }): ScoutFactor => ({
    label: f.label,
    level: Math.max(1, Math.min(3, Math.round(Math.abs(f.diff) / FACTOR_STEP))),
  });
  const sorted = [...factors].sort((a, b) => b.diff - a.diff);
  const strengths = sorted.filter(f => f.diff > FACTOR_STEP * 0.5).slice(0, 2).map(toFactor);
  const weaknesses = sorted.filter(f => f.diff < -FACTOR_STEP * 0.5).slice(-2).reverse().map(toFactor);

  const worst = weaknesses[0];
  const tacticalHint = worst ? HINTS[worst.label] : "Nothing obvious to exploit — this one will be earned.";

  const g = groundFor(opponent);
  return {
    club: opponent,
    ground: { name: g.name, crowd: crowdFor(opponent, week) },
    table: team ? { position: idx + 1, of: table.length } : null,
    topScorer: topScorer && topScorer.goals > 0 ? { name: topScorer.name, value: topScorer.goals, position: topScorer.position } : null,
    topAssister: topAssister && topAssister.assists > 0 ? { name: topAssister.name, value: topAssister.assists, position: topAssister.position } : null,
    bestPlayer: bestPlayer ? { name: bestPlayer.name, value: bestPlayer.overall, position: bestPlayer.position } : null,
    strengths,
    weaknesses,
    tacticalHint,
    headToHead: career.headToHead?.[opponent] ?? null,
  };
}
