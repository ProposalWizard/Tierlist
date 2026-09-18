import { makeIdentity, attachClub, makeInitialCareer } from "../../lib/star/careerFlow";
// Deliberately imported from where it actually lives, not through careerFlow's
// re-export: `hasClub` sits in calendar.ts precisely BECAUSE that file imports
// nothing, so storage.ts and the /api/star/career server route can ask it
// without pulling the whole career engine into their bundles.
import { hasClub } from "../../lib/star/calendar";
import { computeStarRating } from "../../lib/star/rating";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import { readFileSync } from "node:fs";

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
  // Deliberately compared against a rating computed independently of
  // attachClub, not against the identity it copies from — `attachClub` spreads
  // the identity and never writes starRating, so comparing the two is `x === x`
  // and would pass however wrong the rating was. Caught in review.
  const signed = attachClub(id, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(
    signed.starRating === computeStarRating(signed),
    `a signed career's rating must still be the one its own skills and honours give it `
    + `— stored ${signed.starRating}, recomputed ${computeStarRating(signed)}`,
  );
  check(
    signed.starRating === computeStarRating(id),
    "…and it is the same rating the unsigned player already had",
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

  // ── …and they are genuinely two careers, not one wearing two badges ──
  //
  // Comparing `a.skills` and `b.skills` with JSON, as the two checks above do,
  // passes whether they are copies OR THE SAME OBJECT. That is not a hair
  // being split: the offer screen builds a candidate career per interested
  // club from one identity, and if those share their nested objects then
  // training in one moves the others. Caught in review; this is the test that
  // would have caught it instead.
  //
  // Checked by mutating, because that is the only thing that can tell an alias
  // from a copy.
  a.skills.technique += 11;
  a.relationships.boss += 7;
  a.money += 1234;
  a.trophies.push({ competition: "Premier League", season: 1 } as never);
  a.achievements.push("test-only");
  a.sponsors[0].active = true;
  a.kibCans.basic += 3;
  a.currentBoot.technique += 5;

  check(b.skills.technique === id.skills.technique, "training at one club must not train you at another");
  check(b.relationships.boss === id.relationships.boss, "relationships must not be shared between two careers");
  check(b.money === id.money, "money must not be shared between two careers");
  check(b.trophies.length === id.trophies.length, "a trophy won in one career must not appear in another");
  check(b.achievements.length === id.achievements.length, "achievements must not be shared");
  check(b.sponsors[0].active === false, "a sponsor signed in one career must not be signed in another");
  check(b.kibCans.basic === id.kibCans.basic, "stock must not be shared between two careers");
  check(b.currentBoot.technique === id.currentBoot.technique, "boots must not be shared between two careers");
  // And the identity itself is untouched by either signing.
  check(id.skills.technique !== a.skills.technique, "the identity is not the career that was signed from it");
}

// ── makeInitialCareer is unchanged, which is what keeps every save safe ──
//
// ── The version of this test that proved nothing ──
//
// The obvious check is to build a career both ways and compare:
//
//     makeInitialCareer(p, clubs, div)   vs   attachClub(makeIdentity(p, div), ...)
//
// That is what this file did first, and it is a TAUTOLOGY: `makeInitialCareer`
// IS literally that expression now, so the two sides are the same code and the
// assertion cannot fail under any change to either function. It was caught in
// review, not by running it — which is exactly the kind of test that is worse
// than no test, because it reads like proof.
//
// The real question is whether the split changed what the OLD function
// produced, and the only thing that can answer it is the old function. So
// `tests/star/fixtures/preSplitCareers.json` holds five whole careers built by
// `makeInitialCareer` as it was at commit 014febb, the last commit before the
// split. This compares against those.
{
  const golden = JSON.parse(
    readFileSync(new URL("./fixtures/preSplitCareers.json", import.meta.url), "utf8"),
  ) as { player: StarPlayer; clubs: string[]; division: "premier" | "championship"; career: CareerState }[];

  check(golden.length >= 5, `expected a real set of golden careers, got ${golden.length}`);

  for (const g of golden) {
    const now = makeInitialCareer(g.player, g.clubs, g.division);
    check(
      JSON.stringify(now) === JSON.stringify(g.career),
      `${g.player.club} (${g.division}): today's career differs from the one built before the split`,
    );
    check(hasClub(now), `${g.player.club}: a career built the old way still has a club`);
  }

  // And the two halves agree with the old function too — which is the claim
  // that actually matters, and is NOT a tautology because the right-hand side
  // is a recorded fixture rather than the same expression.
  for (const g of golden) {
    const halves = attachClub(makeIdentity(g.player, g.division), g.player.club, g.clubs, g.division);
    check(
      JSON.stringify(halves) === JSON.stringify(g.career),
      `${g.player.club}: makeIdentity + attachClub differs from the pre-split career`,
    );
  }

  // Still deterministic — two calls with the same inputs agree.
  const g0 = golden[0];
  check(
    JSON.stringify(makeInitialCareer(g0.player, g0.clubs, g0.division))
      === JSON.stringify(makeInitialCareer(g0.player, g0.clubs, g0.division)),
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
