import { runTransferWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { goldenBootRace, assistRace } from "../../lib/star/recognition";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, LeagueSquad, LeaguePlayer, SquadPlayer, StarPlayer } from "../../lib/star/types";

/**
 * A TRANSFER WINDOW MUST NOT REWRITE THE GOLDEN BOOT.
 *
 * `runTransferWindow` rebuilds the human's whole squad every time it runs —
 * `career.squad` goes through fromSquadPlayer into the internal Candidate
 * shape and comes back out through toSquadPlayer, for EVERY player, whether
 * he moved or not. Anything SquadPlayer carries that Candidate does not is
 * therefore silently dropped on the way through.
 *
 * `leagueGoals`/`leagueAssists` were exactly that: the league-only subset the
 * Golden Boot and Assist King charts actually read (recognition.ts), kept
 * separate from `seasonGoals` precisely so a team-mate's cup goals stay off a
 * chart that has only ever counted league football. Dropped, they fall back
 * to `?? seasonGoals` — cup goals and all — so the January window silently
 * inflated every one of your own team-mates' Golden Boot tallies by whatever
 * they had scored in the cups, mid-season, with no way for the player to tell
 * the numbers had changed.
 *
 * The summer window hides it (both are 0 at that point in the season), which
 * is why it survived: it only ever showed up in January, and only for your
 * own club's players.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

/** A mid-season squad: everyone has scored in the league AND in the cups, so
 *  the two tallies are genuinely different numbers and a drop is visible. */
function midSeasonSquad(): SquadPlayer[] {
  const roles: SquadPlayer["position"][] = [
    "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST",
    "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST", "CAM", "CAM",
  ];
  return roles.map((position, i) => ({
    id: `mine-${i}`, name: `Squad Player ${i}`, shortName: `SP${i}`, position,
    // 4 cup goals on top of the league tally, for everybody.
    seasonGoals: i + 4, seasonAssists: i + 4,
    leagueGoals: i, leagueAssists: i,
    careerGoals: 100 + i, careerAssists: 50 + i,
    overall: 70,
  }));
}

function career(season: number): CareerState {
  const base = makeInitialCareer(player(), CLUBS);
  return {
    ...base,
    season,
    squad: midSeasonSquad(),
    leagueSquads: CLUBS.map((c): LeagueSquad => ({
      club: c,
      players: generateSquad(clubNameSeed(c) + season).map((p): LeaguePlayer => ({
        id: p.id, name: p.name, position: p.position, positions: p.positions ?? [p.position],
        overall: 60 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
      })),
    })),
  };
}

// ── The league-only tallies survive a window ────────────────────────────────
{
  const before = career(1);
  const kept = new Map(before.squad.map(p => [p.id, p]));

  // January, because that is the window that happens with real numbers on the
  // board — a summer window runs when everything is still zero and could not
  // show this either way.
  const { career: after } = runTransferWindow(before, "january", mulberry32(4242));

  let dropped = 0, changed = 0;
  for (const p of after.squad) {
    const was = kept.get(p.id);
    if (!was) continue; // an incoming signing has no "before" to compare against
    if (p.leagueGoals === undefined || p.leagueAssists === undefined) dropped++;
    else if (p.leagueGoals !== was.leagueGoals || p.leagueAssists !== was.leagueAssists) changed++;
  }
  check(dropped === 0, `no player loses his league-only tallies passing through a transfer window (${dropped} did)`);
  check(changed === 0, `and nobody's league tallies are silently rewritten to a different number (${changed} were)`);
}

// ── …so the Golden Boot shows the same numbers before and after ────────────
//
// The end-to-end version of the check above, and the one a player would
// actually have noticed: the chart itself must not move because a window ran.
{
  const before = career(1);
  const bootBefore = new Map(goldenBootRace(before).map(r => [r.name, r.goals]));
  const assistBefore = new Map(assistRace(before).map(r => [r.name, r.goals]));

  const { career: after } = runTransferWindow(before, "january", mulberry32(9191));

  const stillHere = new Set(after.squad.map(p => p.name));
  let bootMoved = 0, assistMoved = 0;
  for (const r of goldenBootRace(after)) {
    if (!stillHere.has(r.name)) continue;          // sold: gone from the chart legitimately
    const was = bootBefore.get(r.name);
    if (was !== undefined && was !== r.goals) bootMoved++;
  }
  for (const r of assistRace(after)) {
    if (!stillHere.has(r.name)) continue;
    const was = assistBefore.get(r.name);
    if (was !== undefined && was !== r.goals) assistMoved++;
  }
  check(bootMoved === 0, `the Golden Boot race is unchanged for everyone still at the club (${bootMoved} tallies moved)`);
  check(assistMoved === 0, `and so is the Assist King race (${assistMoved} tallies moved)`);
}

// ── Career totals survive too ───────────────────────────────────────────────
//
// Same failure mode, different field: careerGoals/careerAssists ARE carried by
// Candidate, so these should already be safe — checked so a future edit to the
// converters cannot quietly break them either.
{
  const before = career(1);
  const kept = new Map(before.squad.map(p => [p.id, p]));
  const { career: after } = runTransferWindow(before, "january", mulberry32(7373));

  let lost = 0;
  for (const p of after.squad) {
    const was = kept.get(p.id);
    if (!was) continue;
    if (p.careerGoals !== was.careerGoals || p.careerAssists !== was.careerAssists) lost++;
  }
  check(lost === 0, `career totals survive a transfer window untouched (${lost} changed)`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a transfer window leaves every surviving player's tallies exactly as they were");
