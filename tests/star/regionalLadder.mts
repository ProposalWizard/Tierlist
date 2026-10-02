import { resolveLadder, membershipOf } from "../../lib/star/promotion";
import { seedPlayOffs, settlePlayOffFixture } from "../../lib/star/playoffs";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import {
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, NATIONAL_LEAGUE_CLUBS,
  STEP3_NORTH_CLUBS, STEP3_SOUTH_CLUBS,
} from "../../lib/star/clubs";
import { PLAY_OFF_SLOTS } from "../../lib/star/calendar";
import { CLUB_PROFILES } from "../../lib/star/data/clubProfiles";
import { auditAll } from "../../lib/star/data/clubAudit";
import { CLUB_KITS } from "../../lib/star/kits";
import type { CareerState, StarPlayer, Fixture } from "../../lib/star/types";

/**
 * NATIONAL LEAGUE NORTH AND SOUTH, 2026/27 (Mikey, 2 Oct 2026).
 *
 * The clubs as given; 1st up; 2nd-7th play off (4v7 and 5v6, then 2nd and
 * 3rd at home, then a one-off final at the higher finisher's ground); 21st-
 * 24th down to Step 3; Step 3's four waiting clubs all come up each season.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}
function withStandings(career: CareerState, order: string[]): CareerState {
  return {
    ...career,
    league: career.league.map((t) => {
      const at = order.indexOf(t.name);
      const points = (order.length - at) * 3;
      return { ...t, played: 46, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
    }),
  };
}
const north = [...NATIONAL_LEAGUE_NORTH_CLUBS];
function northEndingAt(place: number, you = north[10]): CareerState {
  const order = north.filter(c => c !== you);
  order.splice(place - 1, 0, you);
  return withStandings(makeInitialCareer(playerAt(you), north, "national_league_north"), order);
}

// ── The clubs, exactly as given ─────────────────────────────────────────────
check(north.length === 24 && NATIONAL_LEAGUE_SOUTH_CLUBS.length === 24, "24 in each region");
for (const c of ["Harborough Town", "Hebburn Town", "Oxford City", "Spalding United"]) check(north.includes(c), `${c} in North`);
for (const c of ["Billericay Town", "Dover Athletic", "Farnham Town", "Folkestone Invicta", "Walton & Hersham"])
  check(NATIONAL_LEAGUE_SOUTH_CLUBS.includes(c), `${c} in South`);
for (const c of ["Alfreton Town", "Curzon Ashton", "Leamington", "Peterborough Sports", "Bath City", "Chippenham Town", "Eastbourne Borough", "St Albans City"])
  check(!north.includes(c) && !NATIONAL_LEAGUE_SOUTH_CLUBS.includes(c), `${c} is no longer in North/South`);
check(STEP3_NORTH_CLUBS.join() === "Guiseley,Bury Town,Cleethorpes Town,Real Bedford", "Step 3 North as given");
check(STEP3_SOUTH_CLUBS.join() === "Enfield Town,Welling United,Lewes,Uxbridge", "Step 3 South as given");

// ── Down to Step 3, and Step 3 all up ───────────────────────────────────────
{
  const career = northEndingAt(10);
  const out = resolveLadder(career, mulberry32(5));
  const bottom = north.filter(c => c !== north[10]);
  bottom.splice(9, 0, north[10]);
  const expectedDown = bottom.slice(-4);
  check(out.relegatedFromNorth.join() === expectedDown.join(), `the bottom four go down (${out.relegatedFromNorth.join(", ")})`);
  check(out.promotedFromStep3North.join() === STEP3_NORTH_CLUBS.join(), "all four Step 3 North clubs come up");
  check(out.relegatedFromSouth.length === 4 && out.promotedFromStep3South.length === 4, "South too: four down, four up");
  const d = out.divisions;
  check(d.nationalLeagueNorth.length === 24 && d.nationalLeagueSouth.length === 24, `still 24 each (${d.nationalLeagueNorth.length}/${d.nationalLeagueSouth.length})`);
  check(STEP3_NORTH_CLUBS.every(c => d.nationalLeagueNorth.includes(c)), "Step 3 North clubs are now in North");
  check((d.step3North ?? []).join() === expectedDown.join(), "and the relegated four wait in Step 3 North");
  check((d.step3South ?? []).length === 4, "four wait in Step 3 South");

  // Your own club bottom: never sent to Step 3 (it has no fixtures).
  const last = northEndingAt(24);
  const outLast = resolveLadder(last, mulberry32(9));
  check(!outLast.relegatedFromNorth.includes(last.player.club), "your own club is never relegated into Step 3");
}

// ── An old save catches up ──────────────────────────────────────────────────
{
  const career = northEndingAt(10);
  const m = membershipOf(career);
  const oldNorth = [...m.nationalLeagueNorth.filter(c => c !== "Harborough Town"), "Alfreton Town"];
  const old = { ...career, divisions: { ...m, nationalLeagueNorth: oldNorth, step3North: undefined, step3South: undefined } } as CareerState;
  const caught = membershipOf(old);
  check(!caught.nationalLeagueNorth.includes("Alfreton Town"), "an old save loses Alfreton Town");
  check(caught.nationalLeagueNorth.includes("Harborough Town"), "and gains Harborough Town");
  check(caught.step3North.length === 4 && caught.step3South.length === 4, "and gets the Step 3 clubs");
}

// ── The play-offs you play ──────────────────────────────────────────────────
{
  for (const place of [1, 8, 12]) check(seedPlayOffs(northEndingAt(place)) === null, `${place}th: no play-offs`);
  for (const place of [2, 3, 4, 5, 6, 7]) check(seedPlayOffs(northEndingAt(place)) !== null, `${place}th: in the play-offs`);

  const [SF1, SF2, FINAL] = PLAY_OFF_SLOTS;
  const second = seedPlayOffs(northEndingAt(2))!;
  check(second.fixtures[0].week === SF2.week && second.fixtures[0].home && second.fixtures[0].round === "Play-Off Semi-Final",
    "2nd goes straight to a home semi-final");
  const fourth = seedPlayOffs(northEndingAt(4))!;
  check(fourth.fixtures[0].week === SF1.week && fourth.fixtures[0].home && fourth.fixtures[0].round === "Play-Off Qualifier",
    "4th hosts the qualifier");
  const seventh = seedPlayOffs(northEndingAt(7))!;
  check(!seventh.fixtures[0].home, "7th is away in the qualifier");

  // 5th: win the qualifier, away at 2nd, win, then the final.
  const base = northEndingAt(5);
  const seeded = seedPlayOffs(base)!;
  const second2 = seeded.state.contenders[0];
  let c: CareerState = { ...base, playOffState: seeded.state };
  const q = settlePlayOffFixture(c, seeded.fixtures[0], 2, 0)!;
  check(q.result === "through" && q.fixtures[0].opponent === second2 && !q.fixtures[0].home, "5th wins the qualifier and goes to 2nd's ground");
  c = { ...c, playOffState: q.state };
  const s = settlePlayOffFixture(c, q.fixtures[0], 1, 0)!;
  check(s.result === "through" && s.fixtures[0].week === FINAL.week, "wins the semi, into the final");
  c = { ...c, playOffState: s.state };
  const f = settlePlayOffFixture(c, s.fixtures[0] as Fixture, 3, 1)!;
  check(f.result === "promoted" && f.state.promoted === base.player.club, "wins the final and goes up");
  const next = resolveLadder({ ...c, playOffState: f.state }, mulberry32(3));
  check(next.yourMove === "promoted", "and the rollover honours it");

  // Knocked out in the qualifier: someone else is promoted, decided now.
  const lose = settlePlayOffFixture({ ...base, playOffState: seeded.state }, seeded.fixtures[0], 0, 1)!;
  check(lose.result === "eliminated" && !!lose.state.promoted && lose.state.promoted !== base.player.club,
    "knocked out: the bracket is finished without you");
}

// ── Club sheets and the tracker ─────────────────────────────────────────────
{
  const regional = [...north, ...NATIONAL_LEAGUE_SOUTH_CLUBS, ...STEP3_NORTH_CLUBS, ...STEP3_SOUTH_CLUBS];
  const noProfile = regional.filter(c => !CLUB_PROFILES[c]);
  check(noProfile.length === 0, `every North/South/Step 3 club has a sheet row (missing: ${noProfile.join(", ")})`);
  const noKit = regional.filter(c => !CLUB_KITS[c]);
  check(noKit.length === 0, `every North/South/Step 3 club has a kit (missing: ${noKit.join(", ")})`);
  const rows = auditAll();
  check(new Set(rows.map(r => r.club)).size === rows.length, "the tracker lists each club once");
  check(NATIONAL_LEAGUE_CLUBS.every(c => rows.some(r => r.club === c)), "the tracker includes the National League");
  check(rows.length > 200, `the tracker covers every club (${rows.length})`);
}

if (problems.length) {
  console.error("FAIL\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("PASS — North/South clubs as given, four down to Step 3, Step 3 up, six-club play-offs, old saves catch up, every club tracked");
