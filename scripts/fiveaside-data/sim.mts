/**
 * FIVE-A-SIDE, SIMULATED — the real five-a-side match, played by a bot.
 *
 * Harry, 19 Oct 2026: "Bring it back as its own test area … see what data we
 * can find on it." This plays whole five-a-side matches the way FiveASide.tsx
 * plays them, with nobody at the screen:
 *
 *   resumeAction → advanceFlow (the football between touches)
 *                → buildPassage / buildMateAttack / buildTheirAttack
 *                → launch, then the screen's flight loop (three substeps a
 *                  frame: stepDefenders → stepKeeper → stepReactions → stepBall)
 *                → applyOutcome / applyMateAttack / applyTheirAttack
 *
 * Every one of those is the real function the screen calls. The ONLY stand-in
 * is the bot for your thumb (and it never uses the brace-window tap). Lives in
 * scripts/ on purpose: it calls the engine's physics, which the one-engine
 * guard allows only in the match itself, tests and scripts.
 *
 * Kept in step with FiveASide.tsx by hand: if the screen's loop changes, change
 * `fly` and the dispatch below the same way.
 */
import {
  initDefenders, launch, stepBall, stepKeeper, stepReactions, stepDefenders, setOffsideRuleEnabled,
  type Ball, type Outcome, type Scenario, type Vec2,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import {
  buildPassage, buildTheirAttack, aimTheirShot, worldFromTheirAttack,
  buildMateAttack, worldFromMateAttack, passLeadsToShot, type FiveWorld,
} from "../../lib/star/fiveASide/passage";
import { leftPitch, mirror, insideFivePitch, FIVE_KEEPER_STRENGTH } from "../../lib/star/fiveASide/geometry";
import { BRACE_MS } from "../../lib/star/fiveASide/defend";
import { MATE_MISS, THEM_MISS } from "../../lib/star/fiveASide/flow";
import {
  newFiveMatch, applyOutcome, advanceFlow, applyTheirAttack, applyMateAttack, resumeAction,
  type FiveMatchState,
} from "../../lib/star/fiveASide/match";
import { passageQuality } from "../../lib/star/fiveASide/score";
import {
  scenarioState, scenarioName, scenarioRollSeed, FIVE_CHANCE_SEEDS, type FiveScenarioKind,
} from "../../lib/star/fiveASide/scenarios";
import {
  longestRuns, isGoal,
  type FiveSimChance, type FiveSimMatch, type FiveSimScenarioRun, type FiveSimSettings,
} from "../../lib/star/fiveASide/simSummary";

/** The screen's defaults (FiveASide.tsx) and the test area's. */
export const SIM_DEFAULTS = {
  difficulty: 0.5,
  /** Your power and technique. The test area's "Your skill: 70". */
  skill: 70,
  /** YOUR keeper (FiveASide's `keeperStrength` default). */
  yourKeeper: 60,
  /** THEIR keeper: the screen floors it at FIVE_KEEPER_STRENGTH. */
  theirKeeper: FIVE_KEEPER_STRENGTH,
};

export const BOT_RULES = [
  "In the last third, the bot shoots for a corner of the goal (a little off, like a thumb).",
  "From further than 13 m out it squares it instead when a team-mate is 4 m or more nearer goal.",
  "Anywhere else it taps a pass to its most forward team-mate.",
  "It takes about a second to aim, like a person, and never uses the tap when they attack.",
];

const FRAME = 1 / 60;
/** A kick still live after this long is one the screen would sit on forever. */
const STUCK_S = 20;
const AIM_FRAMES = 60;
const BRACE_FRAMES = Math.round((BRACE_MS / 1000) / FRAME);

/** FiveASide.tsx's `countingRng`: the screen's own stream, wound forward. */
function countingRng(seed: number, wound: number) {
  const base = mulberry32(seed);
  const from = Math.max(0, Math.floor(wound) || 0);
  for (let i = 0; i < from; i++) base();
  let n = from;
  return { next: () => { n++; return base(); }, drawn: () => n };
}

/** The screen's flight branch: three substeps a frame, the match's order. */
function fly(sc: Scenario, ball: Ball, rng: () => number, theirs: boolean): Outcome | "out" | null {
  for (let f = 0; f < STUCK_S / FRAME; f++) {
    let res: Outcome | null = null;
    for (let i = 0; i < 3 && !res; i++) {
      const h = FRAME / 3;
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      res = stepBall(ball, sc, rng, h);
    }
    if (!res && leftPitch(theirs ? mirror(ball.pos) : ball.pos)) return "out";
    if (res) return res;
  }
  return null;
}

/** The screen's goal/frame setup, done after every chance is built. */
function frameIt(sc: Scenario, next: () => number) {
  sc.goal = { ...FIVE_A_SIDE.goal };
  sc.crossbar = FIVE_A_SIDE.crossbar;
  sc.viewport = { ...FIVE_A_SIDE.view };
  initDefenders(sc, next);
}

const GOAL_CX = (FIVE_A_SIDE.goal.x1 + FIVE_A_SIDE.goal.x2) / 2;

/** The bot's kick for your touch. */
function botKick(sc: Scenario, bot: () => number): { dir: Vec2; power: number; contact: { cx: number; cy: number }; how: "shot" | "pass" } {
  const pass = (t: Vec2) => {
    const dir = { x: t.x - sc.ball.x, y: t.y - sc.ball.y };
    // The screen's tap-to-pass weight.
    return { dir, power: Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32), contact: { cx: 0, cy: -0.2 }, how: "pass" as const };
  };
  const mates: Vec2[] = sc.secondaryRunners.map((r) => r.pos);
  if (passLeadsToShot(sc.kind)) {
    mates.push({ x: sc.follower.x, y: sc.follower.y });
    const toGoal = (p: Vec2) => Math.hypot(p.x - GOAL_CX, p.y);
    const mine = toGoal(sc.ball);
    const better = mates.filter((m) => toGoal(m) <= mine - 4).sort((a, b) => toGoal(a) - toGoal(b))[0];
    if (mine > 13 && better) return pass(better);
    const side = bot() < 0.5 ? -1 : 1;
    const half = (sc.goal.x2 - sc.goal.x1) / 2;
    const tx = GOAL_CX + side * Math.max(0.2, half - 0.35) * (0.55 + bot() * 0.45);
    return {
      dir: { x: tx - sc.ball.x + (bot() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) },
      power: Math.min(1, 0.42 + mine / 40) * (0.85 + bot() * 0.3),
      contact: { cx: (bot() - 0.5) * 0.8, cy: -0.1 - bot() * 0.45 },
      how: "shot",
    };
  }
  const ahead = [...mates].sort((a, b) => a.y - b.y)[0];
  if (ahead) return pass(ahead);
  // Nobody to pass to: hit it toward goal.
  return { dir: { x: GOAL_CX - sc.ball.x, y: -Math.max(sc.ball.y, 1) }, power: 0.7, contact: { cx: 0, cy: -0.2 }, how: "shot" };
}

interface Ctx {
  state: FiveMatchState;
  screen: ReturnType<typeof countingRng>;
  bot: () => number;
  difficulty: number;
  skill: number;
  yourKeeper: number;
}

/** What one engine chance did. */
interface Played { state: FiveMatchState; chance: FiveSimChance; stuck: boolean; ballAt: Vec2 }

/** YOUR touch: build the picture, aim for a second, kick, fly, fold it in. */
function playYours(c: Ctx): Played {
  const sc = buildPassage(c.state.world, {
    keeperStrength: Math.min(FIVE_KEEPER_STRENGTH, SIM_DEFAULTS.theirKeeper),
    teamRelationship: 55, rng: c.screen.next,
  });
  frameIt(sc, c.screen.next);
  for (let i = 0; i < AIM_FRAMES; i++) stepKeeper(sc, FRAME);
  const k = botKick(sc, c.bot);
  const ball = launch(sc, k.dir, k.power, k.contact, { power: c.skill, technique: c.skill }, c.screen.next);
  const res = fly(sc, ball, c.screen.next, false);
  const outcome: Outcome | "out" = res ?? "short";
  const crossX = outcome === "goal" || outcome === "wide" || outcome === "over" || outcome === "post" ? ball.pos.x : null;
  const quality = passageQuality(outcome, sc, crossX, FIVE_A_SIDE);
  const assist = isGoal(outcome) && !!sc.receiverShot;
  const state = applyOutcome(c.state, outcome, sc, ball, quality, { assist, passageDraws: c.screen.drawn() });
  return { state, chance: { who: "you", kind: sc.kind, outcome, how: k.how, ...(assist ? { assist: true } : {}) }, stuck: !res, ballAt: ball.pos };
}

/** A TEAM-MATE's chance, watched: struck by the engine's own aim. */
function playMate(c: Ctx): Played {
  const from = c.state.world;
  const sc = buildMateAttack(from, {
    keeperStrength: Math.min(FIVE_KEEPER_STRENGTH, SIM_DEFAULTS.theirKeeper),
    teamRelationship: 55, rng: c.screen.next,
  });
  frameIt(sc, c.screen.next);
  const shot = aimTheirShot(sc, c.difficulty, c.screen.next);
  const ball = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, c.screen.next);
  const res = fly(sc, ball, c.screen.next, false);
  const outcome: Outcome | "out" = res ?? "short";
  const world = worldFromMateAttack(sc, ball.pos, from);
  const state = applyMateAttack(c.state, outcome, world, { passageDraws: c.screen.drawn() });
  return { state, chance: { who: "mate", kind: sc.kind, outcome }, stuck: !res, ballAt: ball.pos };
}

/** THEIR chance: the brace window passes (no tap), they strike, it flies. */
function playThem(c: Ctx): Played {
  const from = c.state.world;
  const sc = buildTheirAttack(from, {
    keeperStrength: Math.max(1, Math.min(99, c.yourKeeper)),
    teamRelationship: 55, rng: c.screen.next,
  });
  frameIt(sc, c.screen.next);
  const shot = aimTheirShot(sc, c.difficulty, c.screen.next);
  for (let i = 0; i < BRACE_FRAMES; i++) stepKeeper(sc, FRAME);
  const ball = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, c.screen.next);
  const res = fly(sc, ball, c.screen.next, true);
  const outcome: Outcome | "out" = res ?? "short";
  const world = worldFromTheirAttack(sc, ball.pos, from);
  const state = applyTheirAttack(c.state, outcome, world, { passageDraws: c.screen.drawn() });
  return { state, chance: { who: "them", kind: sc.kind, outcome }, stuck: !res, ballAt: ball.pos };
}

const bodiesOf = (w: FiveWorld) => [w.ball, w.you, ...w.mates, ...w.opps, w.yourKeeper, w.theirKeeper];
const badCount = (w: FiveWorld) =>
  bodiesOf(w).filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !insideFivePitch(p)).length;

/** One whole five-a-side match, kick-off to full time. */
export function simulateMatch(seed: number, opts: Partial<typeof SIM_DEFAULTS> = {}): FiveSimMatch {
  const set = { ...SIM_DEFAULTS, ...opts };
  setOffsideRuleEnabled(false);
  const c: Ctx = {
    state: newFiveMatch(seed, FIVE_A_SIDE),
    screen: countingRng(seed, 0),
    bot: mulberry32(seed * 7919 + 13),
    difficulty: set.difficulty, skill: set.skill, yourKeeper: set.yourKeeper,
  };
  const out: FiveSimMatch = {
    seed, difficulty: set.difficulty, score: [0, 0],
    goals: { you: 0, assist: 0, mateWatched: 0, mateRolled: 0, themWatched: 0 },
    rolled: { mate: 0, them: 0 }, chances: [], beats: { you: 0, them: 0 }, longestSpell: { you: 0, them: 0 },
    stuck: 0, finished: false, badPositions: 0,
  };
  const seq: ("you" | "them")[] = [];
  let lastKey = "";
  let sameTwice = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const act = resumeAction(c.state);
    if (act === "done") break;
    // A dispatch that changes nothing, over and over, is a freeze.
    const key = `${act}:${c.state.minute}:${c.state.score.join("-")}:${c.state.world.ball.x.toFixed(3)}`;
    sameTwice = key === lastKey ? sameTwice + 1 : 0;
    lastKey = key;
    if (sameTwice > 5) break;
    if (act === "flow") {
      const r = advanceFlow(c.state, { difficulty: c.difficulty, playerSkill: c.skill }, { passageDraws: c.screen.drawn() });
      for (const b of r.beats) {
        const s = b.possession === "them" ? "them" : "you";
        seq.push(s);
        out.beats[s]++;
        out.badPositions += badCount(b.world);
      }
      for (const e of r.events) {
        if (e.goal === "you") { out.goals.mateRolled++; out.rolled.mate++; }
        else if (MATE_MISS.includes(e.text)) out.rolled.mate++;
        else if (THEM_MISS.includes(e.text)) out.rolled.them++;
      }
      c.state = r.state;
      continue;
    }
    const played = act === "passage" ? playYours(c) : act === "mate" ? playMate(c) : playThem(c);
    out.chances.push(played.chance);
    if (played.stuck) out.stuck++;
    const side = played.chance.who === "them" ? "them" : "you";
    seq.push(side);
    out.beats[side]++;
    if (isGoal(played.chance.outcome)) {
      if (played.chance.who === "you") played.chance.assist ? out.goals.assist++ : out.goals.you++;
      else if (played.chance.who === "mate") out.goals.mateWatched++;
      else out.goals.themWatched++;
    }
    c.state = played.state;
    out.badPositions += badCount(c.state.world);
  }
  out.score = [...c.state.score] as [number, number];
  out.finished = c.state.over;
  out.longestSpell = longestRuns(seq);
  setOffsideRuleEnabled(true);
  return out;
}

/**
 * One fixed scenario, played `plays` times. Play k uses the same roll the
 * test area's "Roll k+1" does (screen seed = picture seed × 100 + k), so a
 * team-mate's chance or their attack ends the same way here as on screen
 * when you don't tap.
 */
export function simulateScenario(kind: FiveScenarioKind, seed: number, plays: number, opts: Partial<typeof SIM_DEFAULTS> = {}): FiveSimScenarioRun {
  const set = { ...SIM_DEFAULTS, ...opts };
  setOffsideRuleEnabled(false);
  const outcomes: Record<string, number> = {};
  let goals = 0;
  for (let k = 0; k < plays; k++) {
    const state = scenarioState(kind, seed);
    const c: Ctx = {
      state, screen: countingRng(scenarioRollSeed(seed, k), 0), bot: mulberry32(seed * 31 + k * 977 + 5),
      difficulty: set.difficulty, skill: set.skill, yourKeeper: set.yourKeeper,
    };
    const played = kind === "yours" ? playYours(c) : kind === "mate" ? playMate(c) : playThem(c);
    outcomes[played.chance.outcome] = (outcomes[played.chance.outcome] ?? 0) + 1;
    if (isGoal(played.chance.outcome)) goals++;
  }
  setOffsideRuleEnabled(true);
  return { kind, seed, name: scenarioName(kind, seed), plays, goals, outcomes };
}

/**
 * THE PASS PROBE — can a pass in the last third become a team-mate's shot?
 *
 * The bot shoots in the last third, so the matches above hardly ever test
 * this. Every chance picture, `rolls` times: tap a pass to the team-mate
 * nearest their goal, the screen's way, and see what the engine does with it.
 */
export function probeLastThirdPass(rolls = 100): { passes: number; delivered: number; lost: number; mateShot: number } {
  setOffsideRuleEnabled(false);
  const out = { passes: 0, delivered: 0, lost: 0, mateShot: 0 };
  for (const seed of FIVE_CHANCE_SEEDS) {
    for (let k = 0; k < rolls; k++) {
      const screen = countingRng(scenarioRollSeed(seed, k), 0);
      const sc = buildPassage(scenarioState("yours", seed).world, {
        keeperStrength: SIM_DEFAULTS.theirKeeper, teamRelationship: 55, rng: screen.next,
      });
      frameIt(sc, screen.next);
      if (!passLeadsToShot(sc.kind)) continue;
      const mates = [...sc.secondaryRunners.map((r) => r.pos), { x: sc.follower.x, y: sc.follower.y }];
      const t = mates.sort((a, b) => a.y - b.y)[0];
      const dir = { x: t.x - sc.ball.x, y: t.y - sc.ball.y };
      const ball = launch(sc, dir, Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32), { cx: 0, cy: -0.2 },
        { power: SIM_DEFAULTS.skill, technique: SIM_DEFAULTS.skill }, screen.next);
      const res = fly(sc, ball, screen.next, false);
      out.passes++;
      if (res === "delivered") out.delivered++;
      else if (res === "tackled" || res === "blocked") out.lost++;
      if (sc.receiverShot) out.mateShot++;
    }
  }
  setOffsideRuleEnabled(true);
  return out;
}

export function settingsFor(matches: number, opts: Partial<typeof SIM_DEFAULTS> = {}): FiveSimSettings {
  const set = { ...SIM_DEFAULTS, ...opts };
  return {
    matches, difficulty: set.difficulty, skill: set.skill,
    yourKeeper: set.yourKeeper, theirKeeper: set.theirKeeper, bot: BOT_RULES,
  };
}

export const ALL_SCENARIOS: { kind: FiveScenarioKind; seed: number }[] =
  (["yours", "mate", "them"] as FiveScenarioKind[]).flatMap((kind) => FIVE_CHANCE_SEEDS.map((seed) => ({ kind, seed })));
