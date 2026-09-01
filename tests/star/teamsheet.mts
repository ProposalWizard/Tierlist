import {
  matchdayFor, sheetReady, formationForClub, alternatePositions, offeredPositions,
  startingTeammateRoles, onPitchToday,
} from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { buildLeagueSquad, type RosterRow } from "../../lib/star/leagueSquads";
import { fitness } from "../../lib/star/formations";
import type { CareerState, Fixture } from "../../lib/star/types";

/**
 * THE TEAM SHEET.
 *
 * Two elevens drawn from two squads that were built for a different question,
 * so what has to hold is mostly about not producing nonsense: eleven men and
 * eleven only, one goalkeeper, nobody in two places, and the side a manager
 * would actually pick rather than the eleven best names.
 *
 * The one that matters most is the last: `autoPick` picks on fitness first and
 * rating second, and a version that got that the wrong way round fields four
 * centre-halves and no left-back. It looks fine in a list and absurd on a pitch.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

function roster(club: string, n = 24): RosterRow[] {
  const rng = mulberry(club.length * 17 + club.charCodeAt(0));
  const POS = ["GK", "CB", "CB,LB", "RB", "LB", "CDM", "CM", "CM,CAM", "CAM", "LW", "RW", "ST"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${club}-${i}`,
    name: `${club.slice(0, 3)} Player${i}`,
    positions: POS[i % POS.length],
    overall: 60 + Math.floor(rng() * 32),
    image: i % 3 === 0 ? `https://cdn/${club}-${i}.png` : undefined,
    nation: ["England", "France", "Brazil", "Spain"][i % 4],
  }));
}

function career(club = "Liverpool"): CareerState {
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 19, position: "ST",
    club, nationality: "England", startYear: 2027, skinTone: "light",
    clubBadge: null,
  } as never;
  return {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(c => buildLeagueSquad(c, roster(c))),
  };
}

const fixture = (opponent: string, home: boolean): Fixture => ({
  week: 3, opponent, home, played: false,
});

// ── Eleven men, and eleven only ─────────────────────────────────────────────
{
  const c = career();
  const md = matchdayFor(c, fixture("Arsenal", true), true);
  check(sheetReady(md), "both sides are drawable");

  for (const [label, sheet] of [["yours", md.home], ["theirs", md.away]] as const) {
    check(sheet.xi.length === 11, `${label}: eleven men (${sheet.xi.length})`);
    check(new Set(sheet.xi.map(p => p.id)).size === 11, `${label}: nobody is in two places at once`);
    check(sheet.xi.filter(p => p.role === "GK").length === 1,
      `${label}: exactly one goalkeeper (${sheet.xi.filter(p => p.role === "GK").length})`);
    // A bench is picked from whoever did not start, so an overlap means somebody
    // is on the pitch and on the bench.
    const starting = new Set(sheet.xi.map(p => p.id));
    check(!sheet.bench.some(p => starting.has(p.id)), `${label}: nobody starts and sits`);
    check(sheet.bench.length > 0 && sheet.bench.length <= 9,
      `${label}: a bench of at most nine (${sheet.bench.length})`);
    check(sheet.xi.every(p => p.short.length > 0), `${label}: everybody has a name to print`);
    // Positions come off the formation, so the pitch cannot have two men on the
    // same spot.
    const spots = new Set(sheet.xi.map(p => `${p.x},${p.y}`));
    check(spots.size === 11, `${label}: eleven distinct places on the pitch (${spots.size})`);
  }
}

// ── The side a manager would pick, not the eleven best names ────────────────
{
  const c = career();
  const md = matchdayFor(c, fixture("Chelsea", false), true);
  for (const [label, sheet] of [["yours", md.away], ["theirs", md.home]] as const) {
    // Every man is at least a passable fit for the shirt he is in. 22 is what
    // `fitness` returns for "no relation whatsoever" — a striker at left-back.
    const misfits = sheet.xi.filter(p => p.role !== "GK" && fitness(p.role, p.role) < 100);
    check(misfits.length === 0, `${label}: every slot is filled by its own role (${misfits.length} off)`);
    // …and the shape is a real one rather than eleven men in a line.
    const bands = new Set(sheet.xi.map(p => Math.round(p.y * 20)));
    check(bands.size >= 4, `${label}: the side has at least four lines to it (${bands.size})`);
  }
}

// ── You are in your own team sheet ──────────────────────────────────────────
{
  const c = career();
  const starting = matchdayFor(c, fixture("Everton", true), true);
  const you = starting.home.xi.filter(p => p.isYou);
  check(you.length === 1, `you are in the side, once (${you.length})`);
  check(you[0]?.short === "Vass", `and under your own name (${you[0]?.short})`);
  check(you[0]?.role === "ST", `in your own position (${you[0]?.role})`);
  check(starting.home.xi.length === 11, "and the side is still eleven");
  check(!starting.away.xi.some(p => p.isYou), "you are not in the opposition");

  // Benched or dropped, the sheet is the eleven he picked instead — putting you
  // on it would contradict the screen that just told you that.
  const benched = matchdayFor(c, fixture("Everton", true), false);
  check(!benched.home.xi.some(p => p.isYou), "left out, you are not on the pitch");
  check(benched.home.xi.length === 11, "and somebody else fills the shirt");

  // Named among the substitutes — not starting, but part of the eighteen —
  // your own name has to actually be drawn among the nine. Reported directly:
  // "on the substitutes out of the nine, I don't see my name anywhere."
  // `onBench` is the only thing that changes here versus the "benched" case
  // just above; everything else about the call is identical.
  const subbed = matchdayFor(c, fixture("Everton", true), false, undefined, undefined, undefined, true);
  check(!subbed.home.xi.some(p => p.isYou), "still not in the starting eleven");
  const onBench = subbed.home.bench.filter(p => p.isYou);
  check(onBench.length === 1, `and you ARE drawn among the substitutes (${onBench.length})`);
  check(onBench[0]?.short === "Vass", `under your own name there too (${onBench[0]?.short})`);
  check(subbed.home.bench.length === 9, `the bench stays nine deep (${subbed.home.bench.length})`);
  check(!subbed.away.bench.some(p => p.isYou), "never on the opposition's bench");

  // Dropped from the matchday squad altogether — no `onBench` flag — and the
  // old, honest "you are nowhere on this sheet" behaviour is untouched.
  check(!benched.home.bench.some(p => p.isYou), "…and truly dropped, you are nowhere on the sheet at all");
}

// ── Home and away are the way round the fixture says ────────────────────────
{
  const c = career();
  const atHome = matchdayFor(c, fixture("Burnley", true), true);
  check(atHome.home.club === "Liverpool" && atHome.away.club === "Burnley",
    `at home you are the home side (${atHome.home.club} v ${atHome.away.club})`);
  check(atHome.home.yours && !atHome.away.yours, "and yours is the one marked yours");

  const away = matchdayFor(c, fixture("Burnley", false), true);
  check(away.home.club === "Burnley" && away.away.club === "Liverpool",
    `away you are not (${away.home.club} v ${away.away.club})`);
  check(away.away.yours && !away.home.yours, "…and the mark follows you");
}

// ── A club plays its own shape, every week ──────────────────────────────────
{
  // Twice for the same club is the same answer — a side whose formation is
  // redrawn each match is not a side, it is a dice roll.
  for (const club of CLUBS) {
    check(formationForClub(club).id === formationForClub(club).id, `${club} is stable`);
  }
  const shapes = new Set(CLUBS.map(c => formationForClub(c).id));
  check(shapes.size >= 3, `the division does not all play one shape (${shapes.size} shapes)`);
  // Every one of them is a real formation with eleven places in it.
  for (const club of CLUBS) {
    const f = formationForClub(club);
    check(f.slots.length === 11, `${club}: ${f.name} has eleven places (${f.slots.length})`);
    check(f.slots.filter(s => s.role === "GK").length === 1, `${club}: and one goalkeeper`);
  }
}

// ── Faces and flags come through ────────────────────────────────────────────
{
  const c = career();
  const md = matchdayFor(c, fixture("Arsenal", true), true);
  const theirs = md.away.xi;
  check(theirs.some(p => p.face), "the opposition have photographs where the database has them");
  check(theirs.every(p => p.nation), "and everybody has a nation for his flag");
  // Nothing is invented: a man with no photograph gets none rather than
  // somebody else's.
  check(theirs.some(p => !p.face), "…and a man without one is simply without one");
}

// ── Asking to play somewhere else ────────────────────────────────────────────
{
  const c = career();   // you are ST, per the fixture above
  const fx = fixture("Everton", true);
  const shape = formationForClub("Liverpool");

  const asStriker = matchdayFor(c, fx, true);
  const asStrikerYou = asStriker.home.xi.find(p => p.isYou);
  check(asStrikerYou?.role === "ST", `by default you take your own slot (${asStrikerYou?.role})`);

  // Only what the club's own shape can actually seat you in — see
  // offeredPositions. A formation with no wide men (the "Christmas tree",
  // 4-3-2-1) has nothing to offer for LW, and asking for it anyway used to fall
  // back to "the weakest outfielder", which was a full-back standing in for a
  // winger. This is the same list VersusScreen offers as buttons.
  const offered = offeredPositions("ST", shape);
  check(offered.every(o => shape.slots.some(s => s.role === o.role)),
    `every offered role is one the shape actually has (${shape.name}: ${offered.map(o => o.role).join(",")})`);
  // Given directly: only these four are ever worth asking for, regardless of
  // your real position — not a per-position neighbour table.
  check(offered.every(o => (["CAM", "LW", "RW"] as const).includes(o.role as "CAM" | "LW" | "RW")),
    `nothing outside Striker/Attacking Mid/either wing is ever offered (${offered.map(o => o.role).join(",")})`);

  for (const { role } of offered) {
    const md = matchdayFor(c, fx, true, role);
    const you = md.home.xi.find(p => p.isYou);
    check(you?.role === role, `asking for ${role} seats you at ${role} (got ${you?.role})`);
    check(md.home.xi.length === 11, `…and ${role} is still an eleven`);
    // The real striker did not stop existing — he plays the shirt you vacated.
    const strikers = md.home.xi.filter(p => p.role === "ST");
    check(strikers.length === (role === "ST" ? 1 : 1) && !strikers.some(s => s.isYou),
      `your club's actual striker starts at ST instead (${strikers.map(s => s.short).join(",")})`);
  }

  // Across every shape a club can actually play, offeredPositions never lies
  // about what is there — this is the check that would have caught the bug.
  for (const shapeId of ["433", "4231", "442", "352", "4321", "4141", "3421"]) {
    const f = formationOf(shapeId);
    for (const real of ["ST", "CM", "CB"] as const) {
      const off = offeredPositions(real, f);
      check(off.every(o => f.slots.some(s => s.role === o.role)),
        `${f.name}: nothing is offered for ${real} that the shape does not have (${off.map(o => o.role).join(",")})`);
    }
  }

  // Nothing outside the fixed four is ever offered — a centre-back or a
  // goalkeeper (or, under the new fixed menu, even a deep midfielder) has
  // nothing sensible to ask for, since real position is always ST in this
  // game anyway.
  check(alternatePositions("GK").length === 0, "a goalkeeper has no alternates offered");
  check(alternatePositions("CB").length === 0, "…nor does a centre-back");
  check(alternatePositions("CM").length === 0, "…nor a deep midfielder — outside the fixed four, nothing is offered");
  check(alternatePositions("ST").length === 3, `a striker is offered the other three (${alternatePositions("ST").join(",")})`);

  // A flat wide midfielder reads as "LM"/"RM" in the picker, not "LW"/"RW" —
  // the same Role and the same slot underneath (see Slot.label in
  // formations.ts), but what the picker offers should say what the pitch
  // will actually print, not the generic role name.
  const flatFour = formationOf("3142");
  const flatOffered = offeredPositions("ST", flatFour);
  const left = flatOffered.find(o => o.role === "LW");
  const right = flatOffered.find(o => o.role === "RW");
  check(left?.label === "LM", `a flat wide midfielder on the left reads "LM", not "Left Wing" (got "${left?.label}")`);
  check(right?.label === "RM", `…and "RM" on the right (got "${right?.label}")`);

  // A real winger formation still reads as a winger.
  const wingFour = formationOf("433");
  const wingOffered = offeredPositions("ST", wingFour);
  const wingLeft = wingOffered.find(o => o.role === "LW");
  check(wingLeft?.label === "Left Wing", `a real winger still reads "Left Wing" (got "${wingLeft?.label}")`);
}

// ── A thin or missing squad does not produce a broken pitch ─────────────────
{
  const c = career();
  const bare: CareerState = { ...c, leagueSquads: [] };
  const md = matchdayFor(bare, fixture("Arsenal", true), true);
  check(!sheetReady(md), "an opposition with no squad is not drawable, and says so");
  check(md.home.xi.length === 11, "…while your own side is unaffected");

  // Nine men is the line: below it the pitch has holes in it.
  const thin: CareerState = {
    ...c,
    leagueSquads: [{ club: "Arsenal", players: (c.leagueSquads ?? [])[1].players.slice(0, 8) }],
  };
  check(!sheetReady(matchdayFor(thin, fixture("Arsenal", true), true)),
    "and neither is a squad of eight");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — two elevens, one goalkeeper each, everybody in a shirt that fits");

// ── A team-mate's goal can only be credited to a team-mate who is playing ────
//
// The bug this exists to catch: a goal your side scores while you are off the
// ball has always needed a name, and the name used to come from the WHOLE
// squad — twenty-odd men deep, bench and reserves included. A player never
// selected for this match could still be credited with the goal that won it.
// Reported as exactly that, twice, in two different careers.
{
  const c = career();   // you are ST at Liverpool, per the fixture helper above
  const fx = fixture("Everton", true);

  const roles = startingTeammateRoles(c, fx);
  check(roles !== null, "a normal club fixture has a restriction to compute");
  check(roles !== null && !roles.has("you"), "you are never in your OWN team-mates list");
  check(roles !== null && roles.size === 10, `ten other starters, not the whole squad (${roles?.size})`);

  const md = matchdayFor(c, fx, true);
  const startersXI = md.home.xi.filter(p => !p.isYou);
  check(startersXI.every(p => roles?.has(p.id)), "every id is one of the eleven the team sheet actually showed");
  check(new Set(startersXI.map(p => p.id)).size === startersXI.length, "…with no starter counted twice");
  check(startersXI.every(p => roles?.get(p.id) === p.role),
    "…and each one is mapped to the SLOT the team sheet actually has him in");

  // The full squad is twenty-plus; restricted to today's XI it is ten.
  const wholeSquad = (c.squad ?? []).map(p => ({ id: p.id, position: p.position }));
  check(wholeSquad.length > 15, `the squad itself is much bigger than eleven (${wholeSquad.length})`);
  const restricted = onPitchToday(wholeSquad, roles);
  check(restricted.length === 10, `narrowed down to the ten actually playing (${restricted.length})`);
  check(restricted.every(p => roles?.has(p.id)), "and every one of them is a genuine starter");

  // A reserve who did not make today's eleven must not survive the narrowing.
  const benchIds = new Set(md.home.bench.map(p => p.id));
  const benchInWholeSquad = wholeSquad.filter(p => benchIds.has(p.id));
  check(benchInWholeSquad.length > 0, "the sample squad does have substitutes to test against");
  check(!onPitchToday(wholeSquad, roles).some(p => benchIds.has(p.id)),
    "…and none of them come back out of the restriction");

  // The bug this whole map exists for: a man deployed at a slot other than
  // his own natural position must be cast as that slot, not his day job —
  // reported directly and repeatably: a player started at CDM kept losing
  // every CDM-shaped moment to a bench player whose OWN position happened
  // to say "CDM", because casting read `position` alone and had no idea
  // the lineup had put someone else there.
  const outOfPosition = startersXI.find(p => {
    const real = (c.squad ?? []).find(sq => sq.id === p.id);
    return real && real.position !== p.role;
  });
  if (outOfPosition) {
    const cast = onPitchToday(wholeSquad, roles).find(p => p.id === outOfPosition.id);
    check(cast?.position === outOfPosition.role,
      `a player started out of his own position is cast AS the slot he's playing, not his own (${cast?.position} vs ${outOfPosition.role})`);
  }

  // With no restriction at all (international, or the sandbox with no fixture),
  // nothing is narrowed — the credit-restriction costs nothing when there is
  // nothing to restrict it to.
  check(onPitchToday(wholeSquad, null).length === wholeSquad.length,
    "no restriction means the full squad is still eligible");

  // An international fixture has no club sheet to restrict by.
  const intl = startingTeammateRoles(c, { ...fx, kind: "international" });
  check(intl === null, "an international fixture is not restricted at all");
}

// ── The exact bug, reproduced deterministically ─────────────────────────────
//
// Reported directly, repeatably, across two separate matches: a player
// deliberately started at CDM in the lineup builder — whose own real
// position is something else entirely, not even listed among his
// `positions` — kept losing every CDM-shaped moment in the match itself to
// a bench player whose OWN position happened to say "CDM". `loadLineup` is
// localStorage-backed and returns null in this test environment, so
// `startingTeammateRoles` above only ever exercises the AUTOPICK path —
// this constructs the override map directly instead, the same shape
// `startingTeammateRoles` hands `onPitchToday` for a real saved lineup, so
// the fix itself is pinned regardless of what any one career's autopick
// happens to produce.
{
  const midfielder = { id: "p1", position: "CM" as const };
  const centreBack = { id: "p2", position: "CB" as const };
  const squad = [midfielder, centreBack];

  // The lineup builder put the CM at CDM this match — a real tactical
  // choice, and CDM is not even among a plain `{position}` record's
  // options for him, exactly the case reported.
  const roles = new Map<string, "CDM" | "CB">([["p1", "CDM"], ["p2", "CB"]]);
  const cast = onPitchToday(squad, roles);

  const castMidfielder = cast.find(p => p.id === "p1");
  check(castMidfielder?.position === "CDM",
    `deployed at CDM this match, he is CAST as a CDM — not his own natural CM (got ${castMidfielder?.position})`);
  const castCentreBack = cast.find(p => p.id === "p2");
  check(castCentreBack?.position === "CB",
    "…and a player whose slot matches his own position is untouched either way");

  // The original object is never mutated — only the returned copy differs.
  check(midfielder.position === "CM", "the source squad record itself is left exactly as it was");
}
