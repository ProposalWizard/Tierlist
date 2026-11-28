/**
 * The four games the waiting stories needed (story world plan 5a, D1-D4; components/star/life/StoryModes.tsx).
 *  1. The four stories play now (not in WAITING_ARCS) and their talks open a mode the checker knows.
 *  2. The sprint (lib/star/life/sprint.ts): seeded; a faster man wins; a false start restarts; a tired
 *     man's bar is capped by his energy; holding the whole way beats saving it.
 *  3. The gym board (lib/star/life/gymBoard.ts): a steady thumb beats both records, a bad one beats neither.
 *  4. Keep-ups (lib/star/play3d/keepUps.ts): a steady thumb keeps it up to the hundred; the ball waits
 *     for your first tap, and untouched after it, it hits the grass at 0; her count is seeded and inside its range.
 *  5. The dice give each mode a result the story can read.
 */
import { ARCS, WAITING_ARCS } from "../../lib/star/life/arcBook.ts";
import { sprintStart, sprintStep, sprintResult, sprintBot, type SprintSetup } from "../../lib/star/life/sprint.ts";
import { BOARD_RECORD, beatsBoard, boardLiftFor } from "../../lib/star/life/gymBoard.ts";
import { startGame, stepGame, botHold } from "../../lib/star/gym/games.ts";
import { makeKeepUps, KID_COUNT, KEEP_UPS_MAX } from "../../lib/star/play3d/keepUps.ts";
import { diceActivity } from "../../lib/star/life/talk.ts";
import { mulberry32 } from "../../lib/star/season.ts";
import type { LifeActivity } from "../../lib/star/life/types.ts";
import type { CareerState } from "../../lib/star/types.ts";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL:", msg); } else console.log("ok  ", msg); };

// 1. The stories
const STORIES: [string, string][] = [["arc-ten-minutes", "penalties"], ["arc-the-gym-board", "gym"], ["arc-keep-ups", "two-touch"], ["arc-the-race", "pace-sprint"]];
for (const [id, mode] of STORIES) {
  const arc = ARCS.find((a) => a.id === id);
  check(!!arc && !WAITING_ARCS.some((a) => a.id === id), `${id} plays now`);
  const modes = (arc?.beats ?? []).flatMap((b) => Object.values(b.event.talk?.nodes ?? {}).map((n) => n.activity?.mode).filter(Boolean));
  check(modes.includes(mode as LifeActivity["mode"]), `${id} opens "${mode}"`);
}

// 2. The sprint
const race = (setup: SprintSetup, plan: "smart" | "flat" = "flat") => {
  let s = sprintStart(setup);
  for (let i = 0; i < 3000 && s.phase !== "done"; i++) s = sprintStep(s, 1 / 60, sprintBot(s, plan), setup);
  return { s, r: sprintResult(s) };
};
const base: SprintSetup = { seed: 5, metres: 40, you: { pace: 60, energy: 100 }, him: { pace: 60 } };
const a = race(base), b = race(base);
check(a.r.yourTime === b.r.yourTime && a.r.hisTime === b.r.hisTime, "the same seed runs the same race");
check(a.r.yourTime! > 5 && a.r.yourTime! < 8, `40 m in a plausible time (${a.r.yourTime?.toFixed(2)} s)`);
check(race({ ...base, you: { pace: 80, energy: 100 } }).r.won, "pace 80 beats pace 60");
check(!race({ ...base, you: { pace: 40, energy: 100 } }).r.won, "pace 40 loses to pace 60");
const tired = sprintStart({ ...base, you: { pace: 60, energy: 50 } });
check(Math.abs(tired.you.legs.cap - 0.5) < 1e-9 && tired.you.legs.stamina.v <= 0.5, "at 50 energy the bar stops at half");
check(race({ ...base, you: { pace: 60, energy: 50 } }).r.yourTime! > a.r.yourTime!, "a tired man is slower");
check(race(base, "flat").r.yourTime! <= race(base, "smart").r.yourTime! + 1e-9, "holding the whole way is never slower than saving it");
{
  // press during "set": a false start, and the race starts again
  let s = sprintStart(base);
  while (s.phase !== "set") s = sprintStep(s, 1 / 60, false, base);
  s = sprintStep(s, 1 / 60, true, base);
  check(s.falseStarts === 1 && s.phase === "marks" && s.flash.what === "false-start", "a press before GO is a false start");
}

// 3. The gym board
check(boardLiftFor("bench") === "bench" && boardLiftFor("go") === "plank" && boardLiftFor(undefined) === "plank", "the reply picks the lift");
for (const lift of ["plank", "bench"] as const) {
  for (const [skill, want] of [[1, true], [0.3, false]] as const) {
    let g = startGame(lift, 1, 7);
    for (let i = 0; i < 60 * 60 && !(g as { done: boolean }).done; i++) g = stepGame(g, 1 / 60, botHold(g, skill));
    check(beatsBoard(lift, g) === want, `${lift}: a ${skill === 1 ? "steady" : "jumpy"} thumb ${want ? "beats" : "doesn't beat"} ${BOARD_RECORD[lift].words}`);
  }
}

// 4. Keep-ups
const you = { id: "you", name: "You", skills: { overall: 65, pace: 65, power: 65, technique: 60 } };
{
  const { world, state } = makeKeepUps({ seed: 3, you, autoYou: true });
  for (let i = 0; i < 60 * 160 && !state.over; i++) world.step(1 / 60);
  check(state.count === KEEP_UPS_MAX, `a steady thumb keeps it up to ${KEEP_UPS_MAX} (${state.count})`);
}
{
  const { world, state } = makeKeepUps({ seed: 3, you: { ...you, id: "y2" } });
  for (let i = 0; i < 60 * 5; i++) world.step(1 / 60);
  check(!state.over && !state.started && world.ball.z > 1, "before your first tap the ball waits in your hands");
  world.act({ kind: "tap" });
  for (let i = 0; i < 60 * 10 && !state.over; i++) world.step(1 / 60);
  check(state.started && state.over && state.count === 0, "one tap drops it; no touch after and it hits the grass at 0");
  const again = makeKeepUps({ seed: 3, you: { ...you, id: "y3" } }).state.kid;
  check(state.kid === again && state.kid >= KID_COUNT.min && state.kid <= KID_COUNT.max, `her count is seeded and in range (${state.kid})`);
}

// 5. The dice
const c = { skills: { pace: 60, power: 60, technique: 60, vision: 60, freeKick: 60 } } as unknown as CareerState;
for (const [, mode] of STORIES) {
  const r = diceActivity(c, {} as never, { mode, name: "", dials: { shots: 1 }, score: "", canAbandon: true, fallback: null } as LifeActivity, mulberry32(9));
  check(r.byDice === true && Number.isFinite(r.score) && typeof r.won === "boolean", `the dice play "${mode}" (score ${r.score}, ${r.won ? "won" : "lost"})`);
}

console.log(fails ? `\n${fails} FAILED` : "\nlifeModes: all passed");
process.exit(fails ? 1 : 0);
