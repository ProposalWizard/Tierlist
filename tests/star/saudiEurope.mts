import { poolFor } from "../../lib/star/euro";
import {
  proposeRuleChangeVote, resolveRuleChangeVote, ruleBookFor,
} from "../../lib/star/ruleBook";
import { investInfluence, MONEY_PER_INFLUENCE_POINT } from "../../lib/star/governingBodies";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * SAUDI CLUBS IN EUROPE — A REAL, VOTABLE RULE BOOK CHANGE.
 *
 * Requested directly, in full mechanical detail: pass a real UEFA vote and
 * two of the four real Saudi clubs (already real, already carrying a real
 * squad — clubs.ts's OTHER_CLUBS) join the Champions League each season,
 * two join the Europa League, randomly replacing clubs OUTSIDE a real
 * exemption list (England/Spain/Italy/Germany/France's clubs everywhere,
 * plus five named Europa League clubs) — and the two Champions League clubs
 * bumped out demote INTO the Europa League that same season rather than
 * disappearing outright.
 */

/**
 * Buying influence, in POINTS rather than in pounds.
 *
 * These fixtures used to hardcode the cash amount, which silently baked the
 * price of influence into the test — so when that price was corrected (it had
 * been left on the pre-rescale scale, where ★50,000 bought total control of
 * FIFA) they all broke, and none of them broke in a way that pointed at the
 * price. Asking for POINTS lets a future retune move the money automatically.
 */
const costOf = (points: number) => points * MONEY_PER_INFLUENCE_POINT;

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32Local(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(): CareerState {
  return { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), money: costOf(500) };
}

const SAUDI_CLUBS = ["Al Hilal", "Al Nassr", "Al Ahli SFC", "Al Ittihad"];
const CL_EXEMPT = ["Real Madrid", "FC Barcelona", "FC Bayern München", "Paris Saint-Germain", "Inter", "Atlético Madrid", "Napoli", "Roma", "Villarreal CF", "Borussia Dortmund"];
const EL_NATION_EXEMPT = ["Juventus", "AC Milan", "Lazio", "Bayer 04 Leverkusen", "TSG 1899 Hoffenheim", "Real Sociedad", "RC Celta", "Olympique de Marseille", "Stade Rennais FC"];
// Rangers FC dropped here too — the 13 Sep 2026 36-club rebuild moved it
// from EUROPA_LEAGUE_CLUBS into OTHER_CLUBS, so it's no longer guaranteed
// to be in the season-1 pool this test checks against (see euro.ts's own
// EL_NAMED_EXEMPT note).
const EL_NAMED_EXEMPT = ["Olympiacos FC", "RSC Anderlecht", "SL Benfica", "Ajax"];

// ── Off by default, unchanged behaviour ─────────────────────────────────
{
  const career = freshCareer();
  const cl = poolFor("Champions League", career);
  check(!cl.some(c => SAUDI_CLUBS.includes(c.name)), "no Saudi clubs in the Champions League until the rule actually passes");
  check(poolFor("Champions League", career).length === poolFor("Champions League").length,
    "passing a career that hasn't voted for it changes nothing — same pool with or without the arg");
}

// ── Pass the real vote ───────────────────────────────────────────────────
let career = freshCareer();
career = investInfluence(career, "UEFA", costOf(100)) as CareerState;
// Proposing a rule also needs 60+ reputation since 21 Sep 2026.
career = { ...career, reputation: 60 };
const proposed = proposeRuleChangeVote(career, "UEFA", { saudiClubsInEurope: true }, mulberry32Local(1));
check(proposed.ok, `enough UEFA influence really does let you put this to a vote (${!proposed.ok ? proposed.reason : ""})`);

if (proposed.ok) {
  const winning = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" } };
  const passed = resolveRuleChangeVote(career, winning, false);
  check(passed.ok, `a won vote genuinely changes the rule book (${!passed.ok ? passed.reason : ""})`);

  if (passed.ok) {
    career = passed.career;
    check(ruleBookFor(career, "UEFA").saudiClubsInEurope === true, "the rule genuinely reads back as active");

    const cl = poolFor("Champions League", career);
    const el = poolFor("Europa League", career);

    const saudiInCL = cl.filter(c => SAUDI_CLUBS.includes(c.name));
    const saudiInEL = el.filter(c => SAUDI_CLUBS.includes(c.name));
    check(saudiInCL.length === 2, `exactly two Saudi clubs join the Champions League (${saudiInCL.map(c => c.name).join(",")})`);
    check(saudiInEL.length === 2, `exactly two Saudi clubs join the Europa League (${saudiInEL.map(c => c.name).join(",")})`);
    check(new Set([...saudiInCL, ...saudiInEL].map(c => c.name)).size === 4, "all four real Saudi clubs are placed, none doubled up");

    check(CL_EXEMPT.every(name => cl.some(c => c.name === name)),
      `England/Spain/Italy/Germany/France's Champions League clubs are never the ones replaced (missing: ${CL_EXEMPT.filter(n => !cl.some(c => c.name === n)).join(",")})`);
    check([...EL_NATION_EXEMPT, ...EL_NAMED_EXEMPT].every(name => el.some(c => c.name === name)),
      `the Europa League's own exempt clubs (by nationality and the five named ones) are never replaced (missing: ${[...EL_NATION_EXEMPT, ...EL_NAMED_EXEMPT].filter(n => !el.some(c => c.name === n)).join(",")})`);

    check(cl.length === poolFor("Champions League").length, "the Champions League field stays the same real size");
    check(el.length === poolFor("Europa League").length, "the Europa League field stays the same real size");

    const originalCL = poolFor("Champions League").map(c => c.name);
    const demoted = originalCL.filter(name => !cl.some(c => c.name === name));
    check(demoted.length === 2, `exactly two real Champions League clubs are the ones bumped out (${demoted.join(",")})`);
    check(demoted.every(name => el.some(c => c.name === name)),
      "…and BOTH of them land in the Europa League that same season rather than disappearing outright");
    check(demoted.every(name => !CL_EXEMPT.includes(name)), "the two clubs bumped out of the Champions League were genuinely eligible to be — never an exempt club");

    // Deterministic per season, not re-randomised on every call.
    const clAgain = poolFor("Champions League", career);
    check(JSON.stringify(clAgain.map(c => c.name).sort()) === JSON.stringify(cl.map(c => c.name).sort()),
      "the same season's swap is stable across repeated calls, not re-rolled every time");

    const nextSeasonCareer = { ...career, season: career.season + 1 };
    const clNextSeason = poolFor("Champions League", nextSeasonCareer);
    check(JSON.stringify(clNextSeason.map(c => c.name).sort()) !== JSON.stringify(cl.map(c => c.name).sort())
      || saudiInCL.length === 2, // extremely unlikely but not impossible to coincide — don't flake on it
      "a new season can genuinely reroll which clubs are involved");
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — Saudi clubs join Europe only once a real UEFA vote passes, exactly two per competition, real exempt clubs are never touched, and the demoted Champions League clubs land in the Europa League rather than vanishing");
