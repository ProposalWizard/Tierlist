import {
  makeIdentity, attachClub, makeInitialCareer, SIGNING_ON_FEE, STARTER_CONTRACT,
} from "../../lib/star/careerFlow";
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
  // NOT compared against `computeStarRating(id)`. Signing unlocks
  // "first-contract", and `honourPoints` (rating.ts) counts every achievement,
  // so the rating legitimately moves by exactly that one unlock — which is why
  // `attachClub` recomputes it rather than carrying the identity's forward.
  // What must hold is that nothing ABOUT THE CLUB moved it, and the check
  // above proves that by recomputing from the signed career itself.
  check(
    signed.starRating > computeStarRating(id),
    "signing unlocks an achievement, so the rating it recomputes is the one that includes it",
  );
  check(
    signed.starRating - computeStarRating(id) < 0.2,
    "…and a badge is worth an achievement, not a promotion",
  );
}

// ── Nobody has signed you, so nothing has been paid ─────────────────────
//
// All three of these used to be handed out by `makeIdentity`: ★5,000 in the
// bank, a ★2,000-a-week three-year contract at whichever club was picked on
// the profile screen, and the "first-contract" achievement — on a career
// nobody had made an offer to. The rejection screen said "nothing in the
// bank" while the next screen showed ★5,000, and at the free agent's ★10 a
// week that balance was five hundred weeks of pay before a ball was kicked.
{
  const id = makeIdentity(unsigned());

  check(id.money === 0, `an unsigned career has nothing in the bank (had ${id.money})`);
  check(id.contract.wage === 0, `…and is on no wage (had ${id.contract.wage})`);
  check(id.contract.seasonsRemaining === 0, "…for no seasons");
  check(id.contract.goalBonus === 0 && id.contract.assistBonus === 0, "…with no bonuses");
  check(
    !id.achievements.includes("first-contract"),
    "…and has not unlocked the achievement for a contract he does not have",
  );

  // …and every one of them arrives the moment a club actually signs him.
  const signed = attachClub(id, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(signed.money === SIGNING_ON_FEE, `signing pays the fee (got ${signed.money})`);
  check(signed.contract.wage === STARTER_CONTRACT.wage, "signing puts you on a wage");
  check(signed.contract.club === "Arsenal", "…at the club that signed you");
  check(signed.achievements.includes("first-contract"), "signing unlocks the first contract");
}

// ── …and it is a SIGNING-ON fee, paid once ──────────────────────────────
//
// A career that moves club later must not collect ★5,000 again, and must keep
// the deal it already has rather than being reset to the starter terms.
{
  const first = attachClub(makeIdentity(unsigned()), "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  const earned: CareerState = {
    ...first,
    money: first.money + 1_000_000,
    contract: { ...first.contract, wage: 40_000, seasonsRemaining: 4 },
  };
  const moved = attachClub(earned, CHAMPIONSHIP_CLUBS[0], [...CHAMPIONSHIP_CLUBS], "championship");

  check(moved.money === earned.money, `a second club pays no signing-on fee (got ${moved.money})`);
  check(moved.contract.wage === 40_000, "…and does not reset you to a starter wage");
  check(moved.contract.seasonsRemaining === 4, "…or a starter contract length");
  check(moved.contract.club === CHAMPIONSHIP_CLUBS[0], "…but the deal is at the new club");
  check(
    moved.achievements.filter(a => a === "first-contract").length === 1,
    "…and the first contract is only ever unlocked once",
  );
}

// ── Signing restarts the week, and the garden weeks are kept ────────────
//
// `attachClub` builds a fixture list starting at week 1, but `career.week`
// keeps counting while a free agent sits at home — and transfer windows,
// Player of the Month, deadline day and the competition-betting cutoff all
// read the raw week. A player who failed a trial, spent twelve weeks in the
// garden and then signed got the January window while his own fixtures said
// October, silently and permanently for that save.
{
  const gardened: CareerState = { ...makeIdentity(unsigned()), week: 13 };
  const signed = attachClub(gardened, "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");

  check(signed.week === 1, `signing at week 13 restarts the week (got ${signed.week})`);

  // The claim that actually matters: the week and the fixtures agree, so
  // nothing that reads the raw week is looking at a different month from the
  // one the fixture list is playing.
  // `Fixture.kind` is optional and `buildFixtures` leaves it unset for an
  // ordinary league game — filtering on the string alone finds nothing.
  const league = signed.fixtures
    .filter(f => f.kind === undefined || f.kind === "league")
    .sort((a, b) => a.week - b.week);
  check(league.length > 0, "signing builds league fixtures, or this proves nothing");
  check(
    league[0].week === signed.week,
    `the first fixture and the week must agree — fixture at week ${league[0].week}, career at week ${signed.week}`,
  );

  // The twelve weeks still happened.
  check(signed.gardenWeeks === 12, `the garden weeks are kept (got ${signed.gardenWeeks})`);

  // A career that was never out of work does not grow the field at all — a
  // key that is always there would change every save built the old way, which
  // is what the golden fixtures below would catch.
  const straight = attachClub(makeIdentity(unsigned()), "Arsenal", [...PREMIER_LEAGUE_CLUBS], "premier");
  check(straight.gardenWeeks === undefined, "a career signed straight away has no garden weeks");

  // …and a second spell adds to the first rather than replacing it.
  const secondSpell: CareerState = { ...signed, week: 6 };
  const resigned = attachClub(secondSpell, CHAMPIONSHIP_CLUBS[0], [...CHAMPIONSHIP_CLUBS], "championship");
  check(resigned.gardenWeeks === 17, `a second spell adds to the first (got ${resigned.gardenWeeks})`);
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
  // Compared against what a signing leaves rather than against the identity:
  // `attachClub` pays a signing-on fee, so both careers are legitimately
  // ★5,000 up on the identity they came from. What must not happen is one of
  // them seeing the OTHER's ★1,234.
  check(b.money === id.money + SIGNING_ON_FEE, "money must not be shared between two careers");
  check(b.trophies.length === id.trophies.length, "a trophy won in one career must not appear in another");
  // Both signings unlock "first-contract", so both are one ahead of the
  // identity — but the "test-only" one pushed onto `a` must not be on `b`.
  check(b.achievements.length === id.achievements.length + 1, "achievements must not be shared");
  check(!b.achievements.includes("test-only"), "…not even one pushed on after the fact");
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
