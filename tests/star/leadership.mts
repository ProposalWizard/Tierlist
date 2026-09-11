import {
  isBodyPresident, canStandForBodyPresidency, proposeBodyPresidencyVote, resolveBodyPresidencyVote,
  canOverrulePresidencyVote,
} from "../../lib/star/leadership";
import { investInfluence } from "../../lib/star/governingBodies";
import { proposeRuleChangeVote, canOverruleRuleVote } from "../../lib/star/ruleBook";
import { forceClubIntoPremierLeague, canForceClubMovement } from "../../lib/star/forcedMovement";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * PRESIDENT / KING — THE END-GAME POWER FANTASY (§5), PREVIOUSLY CUT.
 *
 * Built as president of a real governing body rather than an invented
 * country (see leadership.ts's own header for why). Checks: standing for
 * election needs real, high thresholds on BOTH world reputation and
 * influence; the vote itself is real and reuses Phase 2's engine;
 * winning genuinely records the title; and — the actual point of the
 * feature — a president can genuinely propose a rule change, overrule a
 * vote, and force a club's league position REGARDLESS of their own
 * influence level, because those three real gates (in ruleBook.ts and
 * forcedMovement.ts) each check the presidency as an alternative path.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, money: 100_000_000, ...overrides };
}

// ── Standing for election needs real, high thresholds on BOTH axes ────────
{
  const career = freshCareer();
  check(!isBodyPresident(career, "FA"), "nobody starts as president of anything");
  check(!canStandForBodyPresidency(career, "FA"), "no reputation or influence at all means no standing to run");

  const repOnly = { ...career, reputation: { ...career.reputation, world: 95 } };
  check(!canStandForBodyPresidency(repOnly, "FA"), "high world reputation alone isn't enough — real influence is also required");

  const withInfluence = investInfluence(repOnly, "FA", 100_000_000) as CareerState;
  check(canStandForBodyPresidency(withInfluence, "FA"), "high reputation AND high influence together genuinely clears the bar");
  check(!canStandForBodyPresidency(withInfluence, "UEFA"), "clearing the bar in one body doesn't leak into another you have no influence in");
}

// ── The vote itself is real, and winning genuinely records the title ──────
{
  let career = freshCareer({ reputation: { world: 95, club: 50, government: 50, shareholders: 50 } });
  career = investInfluence(career, "FA", 100_000_000) as CareerState;

  const blocked = proposeBodyPresidencyVote({ ...career, reputation: { ...career.reputation, world: 10 } }, "FA", mulberry32(1));
  check(!blocked.ok, "can't stand for election without clearing the real bar");

  const proposed = proposeBodyPresidencyVote(career, "FA", mulberry32(2));
  check(proposed.ok, `a qualified candidate can genuinely put themselves to a real vote (${!proposed.ok ? proposed.reason : ""})`);
  if (proposed.ok) {
    check(proposed.proposal.tally.electorate > 0, "the presidency vote is a real electorate, not a placeholder");

    const alreadyPresident = proposeBodyPresidencyVote(
      { ...career, governingBodyPresidencies: ["FA"] }, "FA", mulberry32(3),
    );
    check(!alreadyPresident.ok, "can't stand for a presidency you already hold");

    const forcedWin = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" } };
    const beforeRep = career.reputation.world;
    const elected = resolveBodyPresidencyVote(career, forcedWin, false);
    check(elected.ok, `winning the vote genuinely succeeds (${!elected.ok ? elected.reason : ""})`);
    if (elected.ok) {
      check(isBodyPresident(elected.career, "FA"), "…and the title is genuinely recorded");
      check(elected.career.reputation.world > beforeRep, "holding the vote at all nudges world reputation up, same pattern every other vote uses");
    }
  }
}

// ── Losing, and the overrule that needs an even higher bar ─────────────────
{
  // 92, deliberately: clears the 90-level bar to STAND, but sits below the
  // 95-level bar to OVERRULE — the two are genuinely different thresholds.
  let career = freshCareer({ reputation: { world: 92, club: 50, government: 50, shareholders: 50 } });
  career = investInfluence(career, "FA", 46_000) as CareerState; // just enough influence to stand, not to overrule

  const proposed = proposeBodyPresidencyVote(career, "FA", mulberry32(4));
  if (proposed.ok) {
    const losing = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "no" } };
    const rejected = resolveBodyPresidencyVote(career, losing, false);
    check(!rejected.ok && !isBodyPresident(rejected.career, "FA"), "losing a real vote genuinely doesn't grant the title");

    check(!canOverrulePresidencyVote(career, "FA"), "the 90-level bar that lets you STAND is not automatically enough to overrule a loss");

    let evenHigherStanding = { ...career, reputation: { ...career.reputation, world: 96 } };
    evenHigherStanding = investInfluence(evenHigherStanding, "FA", 5_000) as CareerState; // tops influence up past the overrule bar too
    check(canOverrulePresidencyVote(evenHigherStanding, "FA"), "…but clearing the genuinely higher overrule bar (both reputation AND influence) does allow it");
    const overruled = resolveBodyPresidencyVote(evenHigherStanding, losing, true);
    check(overruled.ok && isBodyPresident(overruled.career, "FA"), "overruling a lost presidency vote at high enough standing genuinely grants the title anyway");
    check(overruled.ok && overruled.career.reputation.world < evenHigherStanding.reputation.world + 3,
      "…at a real reputation cost on top of the ordinary vote-held gain");
  } else {
    check(false, "fixture assumption failed: could not propose the vote to test losing/overruling");
  }
}

// ── The actual point: a president bypasses the ordinary influence gates ───
{
  const notPresident = freshCareer({ reputation: { world: 50, club: 50, government: 50, shareholders: 50 } });
  check(!canOverruleRuleVote(notPresident, "FA"), "fixture assumption: no influence at all means no ordinary overrule right");
  check(!canForceClubMovement(notPresident, "FA"), "fixture assumption: no influence at all means no ordinary forced-movement right");

  const president = { ...notPresident, governingBodyPresidencies: ["FA" as const] };
  check(canOverruleRuleVote(president, "FA"), "a president can overrule a Rule Book vote in their own body with ZERO ordinary influence");
  check(canForceClubMovement(president, "FA"), "a president can force a club's league position in their own body with ZERO ordinary influence");
  check(!canOverruleRuleVote(president, "UEFA"), "…but being president of the FA grants no authority at all inside UEFA");

  const proposedByPresident = proposeRuleChangeVote(president, "FA", { noDraws: true }, mulberry32(5));
  check(proposedByPresident.ok, "a president can genuinely propose ANY rule change in their body, bypassing the ordinary proposal threshold entirely");

  const forced = forceClubIntoPremierLeague(president, "Real Madrid");
  check(forced.ok, `a president can genuinely force a club's league position with no other influence at all (${forced.reason ?? ""})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — becoming president of a real governing body needs real, high standing on two separate axes, is decided by a real vote, and genuinely bypasses every ordinary influence gate once won");
