/**
 * Corrections: silent evidence, not a base and not an instant rule.
 *
 * The load-bearing property is that a correction only counts as evidence
 * when the move GENUINELY repaired something measurable. Without that, "I
 * nudged a defender" would be read as support for whatever rule happened to
 * be nearby — which is exactly how this project has twice ended up with a
 * plausible rule that was wrong about thousands of pictures.
 */

import {
  movesBetween, faultsRepaired, makeCorrection, proposalsFrom,
  PROPOSAL_THRESHOLD, MIN_MOVE_M, type Correction,
} from "@/lib/star/scenarioCorrections";
import type { MatchScenario } from "@/lib/star/scenarios";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } };

const CX = 34;
const base = (players: MatchScenario["players"], ball = { x: CX, y: 12 }): MatchScenario => ({
  id: "t", name: "t", kind: "open_play",
  camera: { centerX: CX, centerY: 17, viewHeight: 42, facing: "up" },
  ball, players, updatedAt: 0,
  source: { kind: "one_on_one", seed: 1, tool: "gallery", planId: null },
});

const YOU = { id: "iY", side: "you", x: CX, y: 13, label: "YOU" };
const GK = { id: "iK", side: "opponent", x: CX, y: 2, label: "GK" };

// ── a move has to be a real move ─────────────────────────────────────────
{
  const a = base([YOU, GK, { id: "i0", side: "opponent", x: 30, y: 8, label: "D1" }]);
  const tiny = base([YOU, GK, { id: "i0", side: "opponent", x: 30.2, y: 8, label: "D1" }]);
  ok(movesBetween(a, tiny).length === 0, `a ${MIN_MOVE_M}m-or-less nudge is not a move`);
  const real = base([YOU, GK, { id: "i0", side: "opponent", x: 24, y: 8, label: "D1" }]);
  ok(movesBetween(a, real).length === 1, "a real drag is one move");
  ok(movesBetween(a, real)[0].dist > 5, "…and it records how far");
}

// ── a defender dragged OUT of the shooting lane ──────────────────────────
{
  // in the corridor between ball and goal, then pulled wide
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
  const f = faultsRepaired(before, after);
  ok(f.includes("defender-in-lane"), "pulling a defender out of the lane is evidence of that");
  // and the reverse must NOT read as a repair
  ok(!faultsRepaired(after, before).includes("defender-in-lane"),
    "pushing one INTO the lane repairs nothing");
}

// ── a defender dragged behind the ball ───────────────────────────────────
{
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: 20, y: 6, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 20, y: 17, label: "D1" }]);
  ok(faultsRepaired(before, after).includes("defender-goal-side"),
    "dragging a defender behind the ball is evidence of that");
}

// ── a move that fixes NOTHING is recorded but is not evidence ────────────
{
  // a defender well wide and already behind the ball, shuffled sideways
  const before = base([YOU, GK, { id: "i0", side: "opponent", x: 8, y: 20, label: "D1" }]);
  const after = base([YOU, GK, { id: "i0", side: "opponent", x: 12, y: 20, label: "D1" }]);
  const c = makeCorrection("c", "one_on_one", before, after);
  ok(c.moves.length === 1, "the move is still recorded");
  ok(c.faults.length === 0, "…but it is evidence of nothing, because it repaired nothing");
}

// ── one is noise, several is a proposal ──────────────────────────────────
{
  const mk = (i: number): Correction => {
    const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
    const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
    return makeCorrection(`c${i}`, "one_on_one", before, after);
  };
  const few = Array.from({ length: PROPOSAL_THRESHOLD - 1 }, (_, i) => mk(i));
  ok(proposalsFrom(few).length === 0,
    `${PROPOSAL_THRESHOLD - 1} corrections propose nothing — one is noise`);

  const enough = Array.from({ length: PROPOSAL_THRESHOLD }, (_, i) => mk(i));
  const props = proposalsFrom(enough);
  ok(props.length === 1, `${PROPOSAL_THRESHOLD} agreeing is one proposal`);
  ok(props[0].fault === "defender-in-lane", "…naming what they agree on");
  ok(props[0].count === PROPOSAL_THRESHOLD, "…and how many said it");
  ok(props[0].from.length === PROPOSAL_THRESHOLD, "…keeping the examples to show");
  ok(/shooting lane/i.test(props[0].rule), "…as a rule in plain English");
}

// ── the same fault in DIFFERENT situations is not one claim ──────────────
{
  const mk = (i: number, kind: string): Correction => {
    const before = base([YOU, GK, { id: "i0", side: "opponent", x: CX, y: 7, label: "D1" }]);
    const after = base([YOU, GK, { id: "i0", side: "opponent", x: 14, y: 7, label: "D1" }]);
    return makeCorrection(`${kind}${i}`, kind, before, after);
  };
  const mixed = [
    ...Array.from({ length: 2 }, (_, i) => mk(i, "one_on_one")),
    ...Array.from({ length: 2 }, (_, i) => mk(i, "long_range")),
  ];
  ok(proposalsFrom(mixed).length === 0,
    "2 + 2 across two kinds is not 4 — a rule is scoped to the situation it is about");
}

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log(`scenarioCorrections: all checks passed (threshold ${PROPOSAL_THRESHOLD})`);
