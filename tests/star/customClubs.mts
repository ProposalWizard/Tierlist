import { poolFor, replaceableClubsIn } from "../../lib/star/euro";
import { proposeRuleChangeVote, resolveRuleChangeVote, ruleBookFor, changeMagnitude, fanCostOf, DEFAULT_RULE_BOOK, type CustomClubEntry } from "../../lib/star/ruleBook";
import { investInfluence } from "../../lib/star/governingBodies";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * CUSTOM CLUBS IN EUROPE — A REAL, VOTABLE RULE BOOK CHANGE.
 *
 * Requested directly: invent a fake club (app/admin/custom-clubs — a real
 * name, a real invented squad, a kit, a badge) and vote it into the
 * Champions or Europa League. `replaces`/`strength` are decided ONCE, at
 * proposal time (RuleBookScreen.tsx's `buildCustomClubEntry`, not exercised
 * directly here since it needs a live Supabase read — these tests build the
 * resulting CustomClubEntry by hand and check what euro.ts's `poolFor` does
 * with it, which is the real, testable mechanism).
 */

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
  return { ...makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]), money: 1_000_000 };
}

// ── replaceableClubsIn: real names, never a main-nation club, sorted weakest first ──
{
  const career = freshCareer();
  for (const comp of ["Champions League", "Europa League"] as const) {
    const options = replaceableClubsIn(comp, career);
    check(options.length > 10, `${comp}: a real, sizeable list of replaceable clubs (${options.length})`);
    const pool = poolFor(comp, career);
    const names = new Set(pool.map(c => c.name));
    check(options.every(c => names.has(c)), `${comp}: every option is a real club actually in this season's field`);
    // A spot-check main-nation club must never be offered.
    const mainNationInPool = pool.find(c => ["Arsenal", "Real Madrid", "FC Barcelona", "Juventus", "Paris Saint-Germain", "Borussia Dortmund"].includes(c.name));
    if (mainNationInPool) {
      check(!options.includes(mainNationInPool.name), `${comp}: a main-nation club (${mainNationInPool.name}) is never offered as replaceable`);
    }
  }
}

// ── A custom club entry genuinely swaps into the real field ──────────────
{
  const career = freshCareer();
  const before = poolFor("Champions League", career);
  const target = replaceableClubsIn("Champions League", career)[0];
  check(before.some(c => c.name === target), "fixture assumption: the target club is really in the pre-swap field");

  const entry: CustomClubEntry = { customClub: "Rovers United", competition: "champions", replaces: target, strength: 80 };
  const withEntry: CareerState = {
    ...career,
    ruleBook: { ...(career.ruleBook ?? {}), UEFA: { ...DEFAULT_RULE_BOOK, customClubEntries: [entry] } },
  };

  const after = poolFor("Champions League", withEntry);
  check(after.some(c => c.name === "Rovers United"), "the custom club genuinely appears in the real Champions League field");
  check(!after.some(c => c.name === target), `…and the real club it replaced (${target}) is genuinely gone`);
  check(after.length === before.length, `the real field size is unchanged (${before.length} -> ${after.length}) — a substitution, not an expansion`);

  // Europa League is untouched by a Champions-League-only entry.
  const europaBefore = poolFor("Europa League", career);
  const europaAfter = poolFor("Europa League", withEntry);
  check(europaAfter.length === europaBefore.length && !europaAfter.some(c => c.name === "Rovers United"),
    "a Champions League entry never leaks into the Europa League field");

  // Idempotent: calling poolFor twice never double-applies or duplicates.
  const again = poolFor("Champions League", withEntry);
  check(again.filter(c => c.name === "Rovers United").length === 1, "the custom club never appears more than once, even read repeatedly");
}

// ── Composes correctly with the Saudi-clubs swap already applied ─────────
{
  const career = freshCareer();
  const target = replaceableClubsIn("Europa League", career)[0];
  const entry: CustomClubEntry = { customClub: "Harbour City", competition: "europa", replaces: target, strength: 78 };
  const withBoth: CareerState = {
    ...career,
    ruleBook: { ...(career.ruleBook ?? {}), UEFA: { ...DEFAULT_RULE_BOOK, saudiClubsInEurope: true, customClubEntries: [entry] } },
  };
  const champions = poolFor("Champions League", withBoth);
  const europa = poolFor("Europa League", withBoth);
  check(champions.length === 36 && europa.length === 36, `both competitions stay the real 36 apiece with both rules active (saw ${champions.length}/${europa.length})`);
  check(europa.some(c => c.name === "Harbour City"), "the custom club still lands in Europa League alongside an active Saudi swap");
}

// ── A real vote can actually admit a custom club ──────────────────────────
{
  let career = freshCareer();
  career = investInfluence(career, "UEFA", 25_000) as CareerState;
  const target = replaceableClubsIn("Champions League", career)[0];
  const entry: CustomClubEntry = { customClub: "Dockside Athletic", competition: "champions", replaces: target, strength: 82 };
  const current = ruleBookFor(career, "UEFA");

  check(changeMagnitude(current, { customClubEntries: [entry] }) > 0, "proposing a custom club registers as a real, non-zero rule change");
  check(fanCostOf(current, { customClubEntries: [entry] }) > 0, "…with a real fan-reputation cost attached, same as any other real rule change");

  const proposed = proposeRuleChangeVote(career, "UEFA", { customClubEntries: [...current.customClubEntries, entry] }, mulberry32Local(5));
  check(proposed.ok, `a real proposal can be put to a vote (${!proposed.ok ? proposed.reason : ""})`);
  if (proposed.ok) {
    const winning = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" as const } };
    const resolved = resolveRuleChangeVote(career, winning, false);
    check(resolved.ok, `a won vote genuinely admits the custom club (${resolved.reason ?? ""})`);
    if (resolved.ok) {
      check(ruleBookFor(resolved.career, "UEFA").customClubEntries.some(e => e.customClub === "Dockside Athletic"),
        "…and the entry is genuinely on record in the real rule book afterward");
      check(poolFor("Champions League", resolved.career).some(c => c.name === "Dockside Athletic"),
        "…which means the real Champions League field now genuinely includes it");
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a custom club can be voted into the Champions or Europa League, genuinely replacing one real club, composing correctly with the Saudi-clubs swap already there");
