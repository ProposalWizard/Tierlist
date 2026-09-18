import { makeIdentity, attachClub, makeInitialCareer } from "../../lib/star/careerFlow";
// Deliberately imported from where it actually lives, not through careerFlow's
// re-export: `hasClub` sits in calendar.ts precisely BECAUSE that file imports
// nothing, so storage.ts and the /api/star/career server route can ask it
// without pulling the whole career engine into their bundles.
import { hasClub } from "../../lib/star/calendar";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * WHO YOU ARE vs WHERE YOU PLAY.
 *
 * `makeInitialCareer` used to invent a person and sign him for a club in one
 * breath, which was fine only while a career could not begin any other way.
 * It now happens in two steps — `makeIdentity` then `attachClub` — so a
 * career can genuinely exist before anybody has signed it: a trialist, a
 * free agent training in his garden. Without the split there is nothing
 * honest to save for that player, and the alternative (invent a club so the
 * shape is filled in) puts a club he does not play for into his save.
 *
 * Two properties carry the whole refactor, and both are tested below by
 * measurement rather than by reading the code:
 *
 *  1. `makeInitialCareer` is BYTE-IDENTICAL to what it produced before. Every
 *     existing caller, every save already on a player's device, and the eight
 *     test suites that build a career this way must not notice this happened.
 *  2. An identity is genuinely CLUBLESS — empty rather than placeholdered —
 *     and `attachClub` is genuinely reusable, because the point of splitting
 *     them is to sign the same person to whichever club the trial actually
 *     earns him.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027, ...overrides,
  };
}

/** A player nobody has signed — the state the trial actually runs in. */
const unsigned = (o: Partial<StarPlayer> = {}) => player({ club: "", ...o });

// ── An identity has no club, and says so ────────────────────────────────
{
  const id = makeIdentity(unsigned());

  check(!hasClub(id), "a career nobody has signed does not claim to have a club");
  check(id.league.length === 0, "an unsigned career has no league table");
  check(id.fixtures.length === 0, "an unsigned career has no fixtures");
  check((id.squad ?? []).length === 0, "an unsigned career has no team-mates");
  check(id.contract.club === "", "an unsigned career's contract names no club");
  check(id.manager === undefined, "an unsigned career has no manager");
  check(id.squadNumber === undefined, "an unsigned career has no squad number");
  check(id.cupState === undefined, "an unsigned career has no cup draw");
  check(id.euroState === undefined, "an unsigned career is in no European competition");
  check(id.europeanQualification === null, "an unsigned career has qualified for nothing");

  // Empty rather than borrowed: the danger with a placeholder is that it is
  // some REAL club's data sitting in a save for a player who does not play
  // there. Nothing here may match a real club's answer.
  const arsenal = attachClub(makeIdentity(unsigned()), "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(
    id.kitPrimary !== arsenal.kitPrimary || id.kitSecondary !== arsenal.kitSecondary,
    "an unsigned career must not be wearing some real club's colours",
  );
}

// ── The person is fully real even with nobody's badge on him ────────────
{
  const id = makeIdentity(unsigned({ position: "CM", age: 18 }));

  check(id.money > 0, "an unsigned career still has his own money");
  check(id.skills.technique > 0, "an unsigned career still has trained attributes");
  check(id.starRating > 0, "an unsigned career still has a star rating");
  check(id.weekActions > 0, "an unsigned career still has a week to spend");
  check(id.sponsors.length > 0, "an unsigned career still has the sponsor slate");
  check(id.relationships.boss > 0, "an unsigned career still has relationships");
  check(id.reputation.world > 0, "an unsigned career still has a reputation");
  check(!!id.currentBoot, "an unsigned career still has boots on");

  // The rating is computed off skills and honours, neither of which a club
  // touches — so signing must not move it.
  const signed = attachClub(id, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(
    signed.starRating === id.starRating,
    `signing for a club must not change the player's rating — ${id.starRating} became ${signed.starRating}`,
  );
}

// ── Attaching a club fills in everything a club owns ────────────────────
{
  const signed = attachClub(makeIdentity(unsigned()), "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");

  check(hasClub(signed), "a signed career says it has a club");
  check(signed.player.club === "Arsenal", "signing writes the club onto the player");
  check(signed.contract.club === "Arsenal", "signing writes the club onto the contract");
  check(signed.league.length === PREMIER_LEAGUE_CLUBS.length, "signing builds the whole division's table");
  check(signed.fixtures.length > 0, "signing builds a fixture list");
  check((signed.squad ?? []).length > 0, "signing puts team-mates around you");
  check(signed.squadNumber !== undefined, "signing gives you a squad number");
  check(!!signed.manager, "signing gives you a manager");
  check((signed.availableManagers ?? []).length > 0, "signing opens the manager job market");
  // The domestic cups live in `cupState` (one entry per cup, keyed by index);
  // `cups` is the season's finished RUNS and is legitimately empty in August.
  check(Object.keys(signed.cupState ?? {}).length > 0, "signing draws you into the domestic cups");
  check(
    signed.fixtures.some(f => f.kind === "cup"),
    "signing puts a cup tie on the calendar",
  );
}

// ── attachClub does not mutate the identity it is given ─────────────────
{
  const id = makeIdentity(unsigned());
  const before = JSON.stringify(id);
  attachClub(id, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(
    JSON.stringify(id) === before,
    "attachClub must return a new career, not sign the one it was handed",
  );
}

// ── The same person can be signed by whoever actually wants him ─────────
//
// This is the point of the split. A trial ends with one of several clubs
// making an offer, and the person who did the trial is the same person
// whichever one it is.
{
  const id = makeIdentity(unsigned({ position: "CM" }));
  const a = attachClub(id, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  const b = attachClub(id, CHAMPIONSHIP_CLUBS[0], [...CHAMPIONSHIP_CLUBS], "championship");

  check(a.player.club === "Arsenal" && b.player.club === CHAMPIONSHIP_CLUBS[0],
    "the same identity can be signed by two different clubs");
  check(a.division === "premier" && b.division === "championship",
    "each signing carries its own division");
  check(a.league.length === PREMIER_LEAGUE_CLUBS.length && b.league.length === CHAMPIONSHIP_CLUBS.length,
    "each signing builds its own division's table");
  check(a.kitPrimary !== b.kitPrimary || a.kitSecondary !== b.kitSecondary,
    "each signing wears its own club's colours");

  // Everything that is about the PERSON is the same in both.
  for (const key of ["money", "starRating", "fame", "happiness", "weekActions"] as const) {
    check(a[key] === b[key], `${key} is about the player, not the club, and must survive both signings`);
  }
  check(
    JSON.stringify(a.skills) === JSON.stringify(b.skills),
    "trained attributes are about the player, not the club",
  );
  check(
    JSON.stringify(a.relationships) === JSON.stringify(b.relationships),
    "relationships are about the player, not the club",
  );
}

// ── makeInitialCareer is unchanged, which is what keeps every save safe ──
//
// The strongest available check: the two halves in a row must produce
// exactly what the one function produced, for real clubs in both real
// divisions. An assertion on a handful of fields would pass happily while
// something further down had quietly moved.
{
  const cases: [StarPlayer, string[], "premier" | "championship"][] = [
    [player(), [...PREMIER_LEAGUE_CLUBS], "premier"],
    [player({ club: "Manchester City", position: "CM" }), [...PREMIER_LEAGUE_CLUBS], "premier"],
    [player({ club: "Liverpool", position: "GK", age: 31 }), [...PREMIER_LEAGUE_CLUBS], "premier"],
    [player({ club: CHAMPIONSHIP_CLUBS[0], position: "CB", age: 18 }), [...CHAMPIONSHIP_CLUBS], "championship"],
    [player({ club: CHAMPIONSHIP_CLUBS[7], position: "LW" }), [...CHAMPIONSHIP_CLUBS], "championship"],
  ];

  for (const [p, clubs, division] of cases) {
    const whole = makeInitialCareer(p, clubs, division);
    const halves = attachClub(makeIdentity(p, division), p.club, clubs, division);
    check(
      JSON.stringify(whole) === JSON.stringify(halves),
      `${p.club}: makeInitialCareer must be exactly makeIdentity + attachClub`,
    );
    check(hasClub(whole), `${p.club}: a career built the old way still has a club`);
  }

  // And it is still deterministic — two calls with the same inputs agree.
  const [p0, c0, d0] = cases[0];
  check(
    JSON.stringify(makeInitialCareer(p0, c0, d0)) === JSON.stringify(makeInitialCareer(p0, c0, d0)),
    "the same player at the same club opens the same career every time",
  );
}

// ── hasClub does not take a club name's word for it ─────────────────────
//
// A career with a club name but no division to play in is broken in exactly
// the way callers need told about — every screen that would break on a
// clubless career breaks on the missing table, not the missing name.
{
  const signed = attachClub(makeIdentity(unsigned()), "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  const nameOnly: CareerState = { ...signed, league: [] };
  const tableOnly: CareerState = { ...signed, player: { ...signed.player, club: "" } };
  check(!hasClub(nameOnly), "a club name with no division is not a club");
  check(!hasClub(tableOnly), "a division with no club name is not a club");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  an identity and a signing are two things, and the old path is unchanged");
