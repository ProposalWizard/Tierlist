import {
  addRecentGoal, saveReplayToSlot, deleteSavedReplay, firstEmptySlot, RECENT_GOALS_MAX, SAVED_REPLAYS_MAX,
} from "../../lib/star/goalReplays";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import {
  buildWeightedScenario, initDefenders, launch, stepBall, stepDefenders, stepKeeper, stepReactions,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import type { GoalReplay, StarPlayer } from "../../lib/star/types";

/**
 * GOAL REPLAYS.
 *
 * Two things have to hold. First, the slot bookkeeping (goalReplays.ts) —
 * plain list management, nothing exciting. Second, and the one that actually
 * matters: the physics claim CanvasMatch's replay mode rests on — that a
 * scenario snapshot, taken at the instant of the strike, plus the rng
 * fast-forwarded by exactly the number of draws it had already made,
 * reproduces the SAME outcome as the original, every time. If this stops
 * being true, a "replay" quietly stops being a replay.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function replay(id: string, label: string): GoalReplay {
  return {
    id, label, savedAt: new Date().toISOString(),
    seed: 1, callsBeforeStrike: 0,
    scenario: {} as GoalReplay["scenario"],
    dir: { x: 0, y: -1 }, power: 0.8, contact: { cx: 0, cy: -0.4 },
    skills: { power: 60, technique: 60 },
  };
}

// ── Recent goals: newest first, capped ──────────────────────────────────────
{
  const player: StarPlayer = { firstName: "Test", lastName: "Player", age: 22, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer;
  let c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]);
  check((c.recentGoals ?? []).length === 0, "a fresh career has no recent goals");

  for (let i = 0; i < RECENT_GOALS_MAX + 3; i++) c = addRecentGoal(c, replay(`g${i}`, `Goal ${i}`));
  check(c.recentGoals!.length === RECENT_GOALS_MAX, `capped at ${RECENT_GOALS_MAX} (${c.recentGoals!.length})`);
  check(c.recentGoals![0].id === `g${RECENT_GOALS_MAX + 2}`, "newest first");
  check(!c.recentGoals!.some(r => r.id === "g0"), "the oldest ones fall off the front of the cap");
}

// ── Saved slots: a real choice, capped at three, immune to recent's churn ──
{
  const player: StarPlayer = { firstName: "Test", lastName: "Player", age: 22, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer;
  let c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]);

  check(firstEmptySlot(c) === 0, "all three slots open on a fresh career");
  c = saveReplayToSlot(c, firstEmptySlot(c), replay("a", "First"));
  check(firstEmptySlot(c) === 1, "one taken, the next slot is offered");
  c = saveReplayToSlot(c, firstEmptySlot(c), replay("b", "Second"));
  c = saveReplayToSlot(c, firstEmptySlot(c), replay("c", "Third"));
  check(firstEmptySlot(c) === -1, `full at ${SAVED_REPLAYS_MAX} reports no empty slot`);
  check(c.savedReplays!.length === SAVED_REPLAYS_MAX, "exactly three kept");

  // Explicitly overwriting a slot replaces just that one.
  c = saveReplayToSlot(c, 1, replay("d", "Replaced the second"));
  check(c.savedReplays!.map(r => r.id).join(",") === "a,d,c", `slot 1 swapped, the others untouched (${c.savedReplays!.map(r => r.id).join(",")})`);

  c = deleteSavedReplay(c, "d");
  check(c.savedReplays!.length === 2 && !c.savedReplays!.some(r => r.id === "d"), "deleting frees the slot");
  check(firstEmptySlot(c) === 2, "…and it's offered again");
}

// ── The physics actually replay bit-for-bit ─────────────────────────────────
//
// The exact mechanism CanvasMatch's replay mode uses: count rng() draws from
// the moment the scenario is (re)seeded to the moment of the strike, snapshot
// the fully-built scenario, then on replay fast-forward a FRESH rng from the
// same seed by that many draws before calling launch() again. If the two
// runs (original vs replayed) ever disagree, a saved goal would sometimes
// come back as a miss.
{
  function countedRng(seed: number) {
    const raw = mulberry32(seed);
    const counter = { current: 0 };
    return { rng: () => { counter.current++; return raw(); }, counter };
  }

  function play(seed: number, position: string, dir: { x: number; y: number }, power: number, rngOverride?: () => number, callsBeforeStrike?: number, scenarioOverride?: unknown) {
    let rng: () => number;
    let counter = { current: 0 };
    let sc;
    if (rngOverride && callsBeforeStrike !== undefined && scenarioOverride) {
      rng = rngOverride;
      sc = JSON.parse(JSON.stringify(scenarioOverride));
    } else {
      const c = countedRng(seed);
      rng = c.rng;
      counter = c.counter;
      sc = buildWeightedScenario(rng, position, 62, 60, 55);
      initDefenders(sc, rng);
    }
    const contact = { cx: 0.1, cy: -0.35 };
    const skills = { power: 70, technique: 65 };
    const calls = counter.current;
    const snapshot = JSON.parse(JSON.stringify(sc));
    const ball = launch(sc, dir, power, contact, skills, rng);
    const dt = 1 / 60, steps = 3, h = dt / steps;
    let outcome = "timeout";
    for (let frame = 0; frame < 400; frame++) {
      let out: string | null = null;
      for (let i = 0; i < steps; i++) {
        stepDefenders(sc, h, ball.pos, false, ball);
        stepKeeper(sc, h);
        stepReactions(sc, ball, h, rng);
        out = stepBall(ball, sc, rng, h);
        if (out) break;
      }
      if (out) { outcome = out; break; }
    }
    return { outcome, finalPos: { x: ball.pos.x, y: ball.pos.y, z: ball.z }, calls, snapshot };
  }

  for (const [seed, position] of [[11, "ST"], [22, "CAM"], [33, "LW"], [44, "ST"], [55, "CAM"]] as const) {
    const dir = { x: 0.2, y: -1 };
    const original = play(seed, position, dir, 0.9);

    const replayRng = mulberry32(seed);
    for (let i = 0; i < original.calls; i++) replayRng();
    const replayed = play(seed, position, dir, 0.9, replayRng, original.calls, original.snapshot);

    check(replayed.outcome === original.outcome,
      `seed=${seed} pos=${position}: replay resolves the same way (${original.outcome} vs ${replayed.outcome})`);
    check(
      Math.abs(replayed.finalPos.x - original.finalPos.x) < 1e-9
      && Math.abs(replayed.finalPos.y - original.finalPos.y) < 1e-9
      && Math.abs(replayed.finalPos.z - original.finalPos.z) < 1e-9,
      `seed=${seed} pos=${position}: replay lands in the exact same spot`,
    );
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — recent goals cap and roll, saved slots are a real choice, and a replay is bit-for-bit the same chance");
