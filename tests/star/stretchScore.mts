import { newMatch, advanceTo, resolveScenario, type HiddenMatchInputs, type HiddenMatchEvent } from "../../lib/star/hiddenMatch";
import { runStretch } from "../../lib/star/stretchRun";

/**
 * The scoreboard counts goal LINES; the stats screen reads the SCORE. They must
 * agree. Reported 3 times (11 Oct 2026): taken off late, the stats screen
 * showed the other side one goal more than the scoreboard (France 2-0 on the
 * board, 3-0 after). The cause: every run of the match before a free kick or
 * penalty somebody else took had its lines thrown away (lib/star/stretchRun.ts).
 *
 * Plays 1,500 whole matches the way CanvasMatch does — run until needed, take
 * the chance, hooked at a random late minute and the rest played without you —
 * as a player who takes no set pieces, and counts goal lines against the score.
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

const INPUTS: HiddenMatchInputs = { teamStrength: 66, oppStrength: 80, playerSkill: 60 };
const FULL = 94;

function play(seed: number, buggy: boolean): { lines: [number, number]; score: [number, number] } {
  const rng = mulberry32(seed);
  const st = newMatch(rng);
  const lines: HiddenMatchEvent[] = [];
  const hookAt = 60 + Math.floor(rng() * 30);
  for (let guard = 0; guard < 200 && st.minute < FULL; guard++) {
    const step = runStretch(st, INPUTS, rng, FULL, () => false, [], buggy);
    lines.push(...step.events);
    if (!step.request) break;
    if (st.minute >= hookAt) { lines.push(...advanceTo(st, INPUTS, rng, FULL)); break; }
    const r = rng();
    const result = r < 0.15 ? "goal" : r < 0.7 ? "saved" : "lost";
    if (result === "goal") lines.push({ minute: st.minute, text: "you score", isGoal: true });
    resolveScenario(st, result);
  }
  const ours = lines.filter(l => l.isGoal && (l.teammateGoal || l.text === "you score")).length;
  const theirs = lines.filter(l => l.isGoal && !l.teammateGoal && l.text !== "you score").length;
  return { lines: [ours, theirs], score: [st.userScore, st.oppScore] };
}

const N = 1500;
let bugOff = 0, fixOff = 0, fixTheirs = 0;
for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7919;
  const b = play(seed, true);
  if (b.lines[0] !== b.score[0] || b.lines[1] !== b.score[1]) bugOff++;
  const f = play(seed, false);
  if (f.lines[0] !== f.score[0] || f.lines[1] !== f.score[1]) {
    fixOff++;
    if (f.lines[1] !== f.score[1]) fixTheirs++;
  }
}
console.log(`old loop: ${bugOff}/${N} matches with the scoreboard short of the score; now: ${fixOff}/${N}`);
check(bugOff > 0, `the old loop reproduces the reported mismatch (got ${bugOff}/${N})`);
check(fixOff === 0, `every goal in the score has its line (${fixOff}/${N} off, ${fixTheirs} on their side)`);

if (problems.length) {
  console.error("FAIL stretchScore:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("stretchScore: ok");
