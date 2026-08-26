import { runInternationalWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONS_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * THE WIDER WORLD — RARE, AND CROSSING A REAL BOUNDARY WHEN IT HAPPENS.
 *
 * Reported directly: transfer activity only ever touched the player's own
 * twenty clubs plus free agents — a Real Madrid or a Barcelona could never
 * sell to, or buy from, the division at all, even though this game has real
 * squad data for every European giant (career.externalSquads). Requested
 * explicitly to open that up, with "you might see a big Premier League [club]
 * sign a big player from Real Madrid" as the target feel — occasional, not
 * routine, and always a genuine arrival from outside the closed system.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const EXTERNAL_CLUBS = CHAMPIONS_LEAGUE_CLUBS.filter(c => !PREMIER_LEAGUE_CLUBS.includes(c));

function squadFor(club: string, seed: number, strong: boolean): LeagueSquad {
  return {
    club,
    players: generateSquad(clubNameSeed(club) + seed).map((p, i): LeaguePlayer => ({
      id: `${club}:${i}`, name: `${p.name} (${club})`, position: p.position,
      positions: p.positions ?? [p.position],
      // Real giants rated well above a generated PL squad, so a domestic club
      // reaching for one of their players — and vice versa — is actually
      // possible under reachDown/REACH_UP, the same gate every domestic deal
      // already has to clear.
      overall: (strong ? 82 : 62) + (clubNameSeed(p.name) % 12), goals: 0, assists: 0,
    })),
  };
}

function freshCareer(season: number): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return {
    ...base,
    season,
    leagueSquads: PREMIER_LEAGUE_CLUBS.map(c => squadFor(c, season, false)),
    externalSquads: EXTERNAL_CLUBS.map(c => squadFor(c, season, true)),
  };
}

// ── No external data at all: a total no-op, not an error ───────────────────
{
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  const c = { ...base, leagueSquads: PREMIER_LEAGUE_CLUBS.map(cl => squadFor(cl, 1, false)) };
  const { career: after, moves } = runInternationalWindow(c, "summer", mulberry32(1));
  check(after === c, "with no externalSquads at all, the career object is returned completely untouched");
  check(moves.length === 0, "…and nothing is reported as having moved");
}

// ── Across many windows: rare, never more than two, and only real crossings ──
{
  let windowsWithMoves = 0, totalMoves = 0, maxInOneWindow = 0;
  const TRIALS = 300;
  for (let season = 1; season <= TRIALS; season++) {
    const career = freshCareer(season);
    const domestic = new Set(PREMIER_LEAGUE_CLUBS);
    const external = new Set(EXTERNAL_CLUBS);
    const { moves } = runInternationalWindow(career, "summer", mulberry32(season * 7919 + 3));
    if (moves.length > 0) windowsWithMoves++;
    totalMoves += moves.length;
    maxInOneWindow = Math.max(maxInOneWindow, moves.length);
    for (const m of moves) {
      const fromDomestic = domestic.has(m.from), fromExternal = external.has(m.from);
      const toDomestic = domestic.has(m.to), toExternal = external.has(m.to);
      check((fromDomestic && toExternal) || (fromExternal && toDomestic),
        `season ${season}: every move genuinely crosses the boundary (${m.from} -> ${m.to})`);
      check(m.fee > 0, `season ${season}: a marquee move always has a real fee (${m.player}: £${m.fee}m)`);
    }
  }
  const pct = (windowsWithMoves / TRIALS) * 100;
  check(windowsWithMoves > 0, `at least some summer windows produce a marquee move, across ${TRIALS} trials`);
  check(pct < 55, `…but it stays the exception, not the rule (${pct.toFixed(1)}% of summer windows had one)`);
  check(maxInOneWindow <= 2, `never more than two marquee deals in a single window (worst seen: ${maxInOneWindow})`);
  check(totalMoves > 0, "the sample actually produced real moves to check, not an empty run");
}

// ── January is quieter than summer, same as every other window in this game ──
{
  let summerWindows = 0, januaryWindows = 0;
  const TRIALS = 300;
  for (let season = 1; season <= TRIALS; season++) {
    const career = freshCareer(season);
    if (runInternationalWindow(career, "summer", mulberry32(season * 5051 + 1)).moves.length > 0) summerWindows++;
    if (runInternationalWindow(career, "january", mulberry32(season * 5051 + 2)).moves.length > 0) januaryWindows++;
  }
  check(januaryWindows < summerWindows,
    `January produces a marquee move less often than summer (${januaryWindows} vs ${summerWindows} of ${TRIALS})`);
}

// ── The move actually happened — both pools reflect it, not just the report ──
{
  let found: { player: string; from: string; to: string } | null = null;
  let after: CareerState | null = null;
  let career: CareerState | null = null;
  for (let season = 1; season <= 200 && !found; season++) {
    career = freshCareer(season);
    const result = runInternationalWindow(career, "summer", mulberry32(season * 7919 + 3));
    if (result.moves.length > 0) { found = result.moves[0]; after = result.career; }
  }
  check(!!found && !!after && !!career, "found at least one real move to verify against actual pool contents");
  if (found && after && career) {
    const domestic = new Set(PREMIER_LEAGUE_CLUBS);
    const toPool = domestic.has(found.to)
      ? (after.leagueSquads ?? []).find(s => s.club === found!.to)?.players
        ?? (found.to === career.player.club ? (after.squad ?? []) : [])
      : (after.externalSquads ?? []).find(s => s.club === found!.to)?.players;
    check(!!toPool?.some(p => p.name === found!.player),
      `${found.player} actually appears in ${found.to}'s roster after the move`);

    const fromPool = domestic.has(found.from)
      ? (after.leagueSquads ?? []).find(s => s.club === found!.from)?.players
        ?? (found.from === career.player.club ? (after.squad ?? []) : [])
      : (after.externalSquads ?? []).find(s => s.club === found!.from)?.players;
    check(!(fromPool?.some(p => p.name === found!.player)),
      `…and no longer appears in ${found.from}'s roster`);
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — the wider world trades with the division rarely, never more than two deals a window, and every move is real");
