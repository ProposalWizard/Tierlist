import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * A FRESH SEASON'S ROSTERS ARE HAND-CURATED — LEAVE THEM ALONE UNTIL JANUARY.
 *
 * Requested directly: the database's starting rosters for the season are set
 * up by hand, so the league AI transfer engine's own automatic first pass —
 * which used to fire the moment the season's real-world calendar date first
 * landed in a window, not on any deliberate trigger — would immediately
 * rebuild every club's squad on top of that curation before the player had
 * even finished their first match (the season opens in mid-August, and week
 * 2 already reads as the summer window). The fix seeds `lastTransferWindowKey`
 * as already-run for season 1's summer in makeInitialCareer, so that specific
 * occurrence is skipped while every later window — season 1's January
 * onward, and every season after this one — still fires exactly as before.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function leagueSquadsFor(clubs: readonly string[], season: number): LeagueSquad[] {
  return clubs.map((c): LeagueSquad => ({
    club: c,
    players: generateSquad(clubNameSeed(c) + season).map((p, i): LeaguePlayer => ({
      id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position,
      positions: p.positions ?? [p.position],
      overall: 60 + (clubNameSeed(p.name) % 22), goals: 0, assists: 0,
    })),
  }));
}

function freshCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, leagueSquads: leagueSquadsFor(PREMIER_LEAGUE_CLUBS, 1) };
}

function statsFor(us: number, them: number, home: boolean): MatchStats {
  return {
    chances: 5, goals: Math.min(us, them), assists: 1, passes: 28, rating: 7.2, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 2,
    homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90,
  };
}

/** All squad ids currently on the books, everywhere — your own club plus
 *  every league squad — as a single sorted fingerprint. */
function rosterFingerprint(c: CareerState): string {
  const mine = (c.squad ?? []).map(p => p.id).sort();
  const others = (c.leagueSquads ?? [])
    .flatMap(sq => sq.players.map(p => `${sq.club}:${p.id}`))
    .sort();
  return JSON.stringify({ mine, others });
}

// ── A brand new career already treats season 1's summer window as done ─────
{
  const c = freshCareer();
  check(c.lastTransferWindowKey === "1-summer",
    `a fresh career seeds the season-1 summer window as already run (got ${c.lastTransferWindowKey})`);
}

// ── Playing the first match does not touch a single roster ─────────────────
{
  let c = freshCareer();
  const before = rosterFingerprint(c);
  const first = c.fixtures.find(f => !f.played)!;
  c = creditMatchResult(c, first, statsFor(1, 0, first.home)).career;
  check(c.lastTransferWindowKey === "1-summer",
    `the window key is unchanged after the first match (got ${c.lastTransferWindowKey})`);
  check(rosterFingerprint(c) === before,
    "not a single roster — yours or any other club's — changed after the first match");
}

// ── January still opens exactly as before ───────────────────────────────────
{
  let c = freshCareer();
  const before = rosterFingerprint(c);
  let sawJanuaryKey = false;
  let rostersChangedAfterJanuary = false;
  let guard = 0;
  while (guard++ < 60) {
    const next = c.fixtures.find(f => !f.played);
    if (!next) break;
    const fingerprintBefore = rosterFingerprint(c);
    c = creditMatchResult(c, next, statsFor(1, 1, next.home)).career;
    if (c.lastTransferWindowKey === "1-january" && !sawJanuaryKey) {
      sawJanuaryKey = true;
      rostersChangedAfterJanuary = rosterFingerprint(c) !== fingerprintBefore;
    }
  }
  check(sawJanuaryKey, "season 1's January window still opens and runs, across the season's real fixtures");
  check(rostersChangedAfterJanuary, "…and it actually moves players — this is a real window running, not a no-op");
  check(rosterFingerprint(c) !== before, "by January, rosters have genuinely diverged from the hand-curated start");
}

// ── Season 2's summer window is untouched by any of this ───────────────────
{
  let c = freshCareer();
  let guard = 0;
  while (guard++ < 60) {
    const next = c.fixtures.find(f => !f.played);
    if (!next) break;
    c = creditMatchResult(c, next, statsFor(1, 1, next.home)).career;
  }
  c = advanceSeason(c, false).career;
  check(c.season === 2, `rolled into season 2 (got ${c.season})`);
  check(c.lastTransferWindowKey === "1-january",
    `the rollover itself does not touch the window key (still ${c.lastTransferWindowKey})`);

  let sawSeason2Summer = false;
  guard = 0;
  while (guard++ < 60) {
    const next = c.fixtures.find(f => !f.played);
    if (!next) break;
    c = creditMatchResult(c, next, statsFor(1, 1, next.home)).career;
    if (c.lastTransferWindowKey === "2-summer") { sawSeason2Summer = true; break; }
  }
  // Whether it actually moves anyone is need-driven and not guaranteed on any
  // given seed (by season 2 the squads this test builds may simply have
  // nothing left to fix) — the property that matters here is narrower: the
  // skip was only ever for season 1's summer, and season 2's own is not
  // silently skipped too.
  check(sawSeason2Summer, "season 2's own summer window opens and runs — the skip was only ever for season 1's");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — season 1's summer window is skipped, every other window (January onward) fires exactly as before");
