/**
 * The three states a scenario can be in, and the pending-commit list.
 *
 * These exist because all three were being confused for one another on
 * screen: a draft nobody else can see, a save every device sees, and a
 * commit that is in the code. The distinction that costs real time is
 * MODIFIED — committed once, edited, saved again — where the database and
 * the code disagree and only one of them is right.
 */

import { AUTHORED_SCENARIOS } from "@/lib/star/authoredScenarios";
import { statusOf, pendingCommit, samePicture } from "@/lib/star/scenarioStatus";
import type { MatchScenario } from "@/lib/star/scenarios";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } };

const committedIds = Object.keys(AUTHORED_SCENARIOS);
ok(committedIds.length > 0, `there are committed scenarios to test against (${committedIds.length})`);
const real = AUTHORED_SCENARIOS[committedIds[0]];

// ── draft ────────────────────────────────────────────────────────────────
ok(statusOf(null).state === "draft", "nothing saved reads as a draft");
ok(statusOf(undefined).tuning === false, "a draft does NOT feed the auto-tuner");

// ── committed ────────────────────────────────────────────────────────────
{
  const s = statusOf(real);
  ok(s.state === "committed", "a scenario matching the code reads as committed");
  ok(s.tuning === true, "…and it feeds the auto-tuner");
}

// ── saved only ───────────────────────────────────────────────────────────
{
  const novel: MatchScenario = { ...real, id: "gallery-not-in-the-code-at-all" };
  const s = statusOf(novel);
  ok(s.state === "saved", "an id the code has never seen reads as saved-only");
  ok(s.tuning === true, "…and it STILL feeds the auto-tuner — saving is enough");
}

// ── modified ─────────────────────────────────────────────────────────────
{
  const moved: MatchScenario = { ...real, ball: { x: real.ball.x + 5, y: real.ball.y } };
  ok(statusOf(moved).state === "modified", "same id, different picture reads as modified");
  // A re-save that changed nothing must NOT read as modified, or the pending
  // list fills with scenarios that have nothing pending about them.
  const resaved: MatchScenario = { ...real, updatedAt: (real.updatedAt ?? 0) + 99999 };
  ok(statusOf(resaved).state === "committed",
    "a re-save with no change is still committed — timestamps are not the test");
}

// A moved PLAYER counts too, not just the ball.
{
  const p = real.players[0];
  const movedPlayer: MatchScenario = {
    ...real,
    players: [{ ...p, x: p.x + 3 }, ...real.players.slice(1)],
  };
  ok(!samePicture(movedPlayer, real), "moving one player is a different picture");
  ok(statusOf(movedPlayer).state === "modified", "…so it reads as modified");
}

// ── the pending list ─────────────────────────────────────────────────────
{
  const novel: MatchScenario = { ...real, id: "gallery-brand-new" };
  const moved: MatchScenario = { ...real, ball: { x: real.ball.x + 5, y: real.ball.y } };
  const pending = pendingCommit([real, novel, moved]);
  const ids = pending.map((s) => s.id);
  ok(pending.length === 2, `only the two that need committing are pending (${pending.length})`);
  ok(ids.includes("gallery-brand-new"), "a new save is pending");
  ok(ids.includes(real.id), "a modified one is pending");
  ok(pendingCommit([real]).length === 0, "an already-committed scenario is NOT pending");
  ok(pendingCommit([]).length === 0, "nothing saved means nothing pending");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log(`scenarioStatus: all checks passed (${committedIds.length} committed scenarios)`);
