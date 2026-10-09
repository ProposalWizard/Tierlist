/**
 * THE DRIBBLE RUN IN 3D — a career match's dribble chance, played on the
 * shared 3D engine (Harry, 9 Oct 2026: "I really like the 3D style in Style
 * Testing where it's top down and you're running around (Free Roam 3D) … it
 * would be great for in-game dribbling").
 *
 * The SAME run as the first-person duel (lib/star/firstPersonDribble.ts), only
 * played with the stick:
 *   - the same waves (`waveSizes`, from pickWaveSizes: at most 10 men), the
 *     same real defenders (`roster`), your team-mates to pass to;
 *   - the SAME result (FpDribbleResult's shape): cleared, men beaten, waves
 *     beaten of how many, a pass that arrived (after how many waves, where),
 *     a pass cut out. CanvasMatch's finishFpDribble reads it exactly as it
 *     reads the duel's, so what comes next in the match is unchanged.
 *
 * How it plays: you start 48 m out with the ball and run at goal. Each wave
 * holds its line until you come near, then its nearest two close you down
 * (the rest cover). A man you get past with the ball is beaten, for good.
 *   cleared  you are past every wave with the ball and a yard of space, or
 *            you have it 12 m out (the duel's CLEAR_Y)
 *   passed   a pass of yours is controlled by a team-mate
 *   lost     a tackle wins it, a defender (or the keeper) gets it, it goes
 *            out, or 20 s pass (the duel's RUN_TIMEOUT)
 * A drag-shot is not part of the run (the shot is the next chance).
 *
 * 3D games are the one-engine rule's exception: nothing here touches
 * lib/star/canvasEngine.ts or the 2D match.
 */
import { CX, clamp, skill01 } from "./constants";
import { makePlayer, skillsOf, stepMover, towards, timeToReach, type P3, type Skills3 } from "./player";
import { World, type Rules } from "./world";
import type { Person3 } from "./freeRoam";
import type { DrillSession } from "./drills";
import { gameReward } from "../relationships";

/** Where you start (the duel's START_Y), and where you are through (its CLEAR_Y). */
export const DRIBBLE3D_START_Y = 48;
export const DRIBBLE3D_CLEAR_Y = 12;
/** The waves stand between these lines (metres from the goal line). */
export const WAVE_FIRST_Y = 40;
export const WAVE_LAST_Y = 19;
/** Half the width the waves are spread across (the duel's CORRIDOR_HALF). */
export const WAVE_HALF_W = 9;
/** A wave steps up to you when you are this close to its line. */
export const ENGAGE_M = 11;
/** Past a man by this much (with the ball) and he is beaten. */
export const BEATEN_BY = 1.0;
/** Through: every man beaten and none within this of you. */
export const CLEAR_SPACE = 2.7;
/** Running into a man: within this (m), and this far in front of you (cos of the angle off your heading), he tries a tackle this often (per second). */
export const BLOCK_R = 1.25;
export const BLOCK_AHEAD = 0.55;
export const BLOCK_RATE = 6;
/** The duel's RUN_TIMEOUT. */
export const DRIBBLE3D_TIMEOUT = 20;
/** The playing area: wide enough to go round a wave, not the whole pitch. */
export const DRIBBLE3D_HALF_W = 22;

/** A real defender (FirstPersonDribble's FpIdentity, by shape). */
export interface DefenderId { id: string; name?: string; shortName?: string; face?: string; defending?: number; overall?: number }

/** The result, by shape the same as FirstPersonDribble's FpDribbleResult. */
export interface DribbleRunResult {
  cleared: boolean;
  beaten: number;
  wavesBeaten?: number;
  totalWaves?: number;
  passedAfterWaves?: number;
  passTo?: { x: number; y: number };
  passFailed?: boolean;
}

export type DribbleRunEnd = "clear" | "passed" | "lost";

export interface DribbleRunState {
  /** Wave number of each defender, by id. */
  waveOf: Record<string, number>;
  waveSizes: number[];
  beaten: Set<string>;
  timeLeft: number;
  end: DribbleRunEnd | null;
  /** Why it ended, for the banner ("TACKLED", "THROUGH" …). */
  why: string;
  /** A pass of yours is on its way (a cut-out then counts as passFailed). */
  passOut: boolean;
  passedAfterWaves?: number;
  passTo?: { x: number; y: number };
  passFailed?: boolean;
  last: string;
}

export interface DribbleRunOptions {
  seed: number;
  you: Person3;
  waveSizes: number[];
  /** Real defenders, deepest first (CanvasMatch's fpRoster). Absent: made-up men of `oppStrength`. */
  roster?: DefenderId[];
  /** The duel's oppStrength (0-100): the made-up men's level when there is no roster. */
  oppStrength?: number;
  /** Team-mates to pass to (the duel's passOptions). */
  mates?: Person3[];
  keeperOverall?: number;
}

/** How many whole waves are beaten. */
export function wavesBeatenOf(s: DribbleRunState): number {
  let n = 0;
  for (let w = 0; w < s.waveSizes.length; w++) {
    const ids = Object.keys(s.waveOf).filter((id) => s.waveOf[id] === w);
    if (ids.length && ids.every((id) => s.beaten.has(id))) n++; else break;
  }
  return n;
}

/** The result in the duel's shape (call once it has ended). */
export function dribbleRunResult(s: DribbleRunState): DribbleRunResult {
  return {
    cleared: s.end === "clear",
    beaten: s.beaten.size,
    wavesBeaten: s.end === "clear" ? s.waveSizes.length : wavesBeatenOf(s),
    totalWaves: s.waveSizes.length,
    ...(s.end === "passed" ? { passedAfterWaves: s.passedAfterWaves ?? 0, passTo: s.passTo } : {}),
    ...(s.end === "lost" && s.passFailed ? { passFailed: true } : {}),
  };
}

/** Each wave's men, spread at random across the corridor (the duel's placeWave: random, not one per band). */
function laneXs(size: number, rng: () => number): number[] {
  const width = WAVE_HALF_W * 2;
  const minGap = Math.min(2.2, width / (size + 1));
  const xs: number[] = [];
  for (let i = 0; i < size; i++) {
    let x = CX - WAVE_HALF_W + rng() * width;
    for (let t = 0; t < 20 && xs.some((o) => Math.abs(o - x) < minGap); t++) x = CX - WAVE_HALF_W + rng() * width;
    xs.push(x);
  }
  return xs;
}

const defSkills = (d: DefenderId | undefined, opp: number): Skills3 => {
  const def = d?.defending ?? d?.overall ?? opp;
  const ov = d?.overall ?? def;
  return skillsOf(ov, { defending: clamp(def, 30, 99), pace: clamp(ov, 30, 99) });
};

export function makeDribbleRun(o: DribbleRunOptions): { world: World; state: DribbleRunState } {
  const sizes = o.waveSizes.length ? o.waveSizes.slice(0, 10) : [1];
  // never more than ten men, as the duel
  let total = 0;
  const waveSizes: number[] = [];
  for (const n of sizes) { const k = Math.min(n, 10 - total); if (k <= 0) break; waveSizes.push(k); total += k; }

  const state: DribbleRunState = { waveOf: {}, waveSizes, beaten: new Set(), timeLeft: DRIBBLE3D_TIMEOUT, end: null, why: "", passOut: false, last: "" };
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: true, x: CX, y: DRIBBLE3D_START_Y, skills: o.you.skills, photo: o.you.photo });
  const opp = o.oppStrength ?? 70;

  // the waves: placed up front, seeded
  const placeRng = (() => { let s = (o.seed ^ 0x9e3779b9) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const roster = o.roster ? [...o.roster] : [];
  // shuffled once, so which real man stands in which wave changes run to run (as the duel)
  for (let i = roster.length - 1; i > 0; i--) { const j = Math.floor(placeRng() * (i + 1)); [roster[i], roster[j]] = [roster[j], roster[i]]; }
  const defenders: P3[] = [];
  let k = 0;
  waveSizes.forEach((n, w) => {
    const lineY = waveSizes.length === 1 ? (WAVE_FIRST_Y + WAVE_LAST_Y) / 2
      : WAVE_FIRST_Y - (w * (WAVE_FIRST_Y - WAVE_LAST_Y)) / (waveSizes.length - 1);
    laneXs(n, placeRng).forEach((x) => {
      const who = roster.length ? roster[k % roster.length] : undefined;
      const id = `d${k}`;
      const p = makePlayer({
        id, name: who?.shortName ?? who?.name ?? `Defender ${k + 1}`, team: 1, x, y: lineY, facing: Math.PI / 2,
        skills: defSkills(who, opp), photo: who?.face, mind: { brain: "wave", wave: w, slotX: x, lineY },
      });
      state.waveOf[id] = w;
      defenders.push(p);
      k++;
    });
  });

  const mates = (o.mates ?? []).slice(0, 3).map((m, i) => {
    const lane = i % 2 ? 1 : -1;
    return makePlayer({ id: m.id, name: m.name, x: CX + lane * (13 + Math.floor(i / 2) * 4), y: DRIBBLE3D_START_Y - 4 - i * 2, skills: m.skills, photo: m.photo, mind: { brain: "wide", lane, n: Math.floor(i / 2) } });
  });
  const keeper = makePlayer({ id: "keeper", name: "Keeper", team: 1, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(o.keeperOverall ?? 70) });

  const end = (w: World, how: DribbleRunEnd, why: string) => {
    if (state.end) return;
    if (how === "passed") state.passedAfterWaves = wavesBeatenOf(state);
    state.end = how; state.why = why; state.last = why;
    w.frozen = 1e9;
  };

  /** A defender's brain: hold the line, step up when you come, cover once beaten. */
  const waveBrain = (w: World, p: P3, dt: number) => {
    const b = w.ball, m = p.mind;
    const me = w.you();
    const lineY = m.lineY as number, slotX = m.slotX as number, wave = m.wave as number;
    const face = Math.atan2(b.y - p.y, b.x - p.x);
    if (state.beaten.has(p.id)) {
      // beaten: he turns and chases back, a step slower (he has to turn first)
      const gx = b.x, gy = b.y - 1.2;
      stepMover(p, towards(p, gx, gy, 0.8), timeToReach(p, gx, gy) > 1.2 && skill01(p.skills.pace) > 0.6, dt);
      return;
    }
    const near = b.y - lineY < ENGAGE_M;
    // the two of his wave nearest the ball go at it; the others cover the gap goal-side
    const wavemates = w.players.filter((q) => q.active && q.mind.brain === "wave" && q.mind.wave === wave && !state.beaten.has(q.id));
    const rank = wavemates.map((q) => Math.hypot(q.x - b.x, q.y - b.y)).sort((a, c) => a - c).indexOf(Math.hypot(p.x - b.x, p.y - b.y));
    if (near && rank < 2) {
      // close him down: goal-side of the ball, then at it (World.tackles pokes)
      const gd = Math.hypot(CX - b.x, b.y) || 1;
      const gx = b.x + (CX - b.x) / gd * 0.7, gy = b.y - b.y / gd * 0.7;
      stepMover(p, towards(p, gx, gy, 0.3), timeToReach(p, gx, gy) > 0.5, dt, face);
      return;
    }
    // hold the line, sliding across with the ball
    const tx = clamp(slotX + (b.x - CX) * (near ? 0.6 : 0.35), CX - DRIBBLE3D_HALF_W + 2, CX + DRIBBLE3D_HALF_W - 2);
    const ty = near ? Math.min(lineY, b.y - 4) : lineY;
    const d = Math.hypot(tx - p.x, ty - p.y);
    stepMover(p, d > 0.4 ? towards(p, tx, ty, 2) : { x: 0, y: 0 }, false, dt, face);
    if (me && near) p.facing = face;
  };

  /**
   * A team-mate: keeps wide of the waves (outside their corridor), level with
   * you or a yard ahead, so a pass to him is on; a pass on its way, he goes to meet it.
   */
  const wideBrain = (w: World, p: P3, dt: number) => {
    const b = w.ball, me = w.you();
    if (w.passTarget === p.id) {
      const i = w.intercept(p);
      if (i) { stepMover(p, towards(p, i.x, i.y, 0.6), true, dt); return; }
    }
    const lane = (p.mind.lane as number) ?? 1, n = (p.mind.n as number) ?? 0;
    const ref = me ?? p;
    const tx = CX + lane * (WAVE_HALF_W + 5 + n * 3.5), ty = clamp(ref.y - 2 - n * 3, 8, 50);
    const d = Math.hypot(tx - p.x, ty - p.y);
    stepMover(p, d > 0.6 ? towards(p, tx, ty, 2.5) : { x: 0, y: 0 }, d > 4, dt, Math.atan2(b.y - p.y, b.x - p.x));
  };

  const rules: Rules = {
    id: "dribble-run",
    stamina: true,
    step(w, dt) {
      if (state.end || w.frozen > 0) return; // not started yet (the screen holds it frozen until a tap), or over
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) { end(w, "lost", "Closed down"); return; }
      const me = w.you();
      if (!me) return;
      const owner = w.get(w.owner);
      // who has it now
      if (owner && owner.team !== me.team) { end(w, "lost", owner.keeper ? "Keeper's ball" : state.passOut ? "Cut out" : "Tackled"); if (state.passOut) state.passFailed = true; return; }
      if (owner && owner !== me && owner.team === me.team) {
        state.passTo = { x: owner.x, y: owner.y };
        end(w, "passed", "Laid off");
        return;
      }
      if (owner === me) state.passOut = false;
      const onBall = owner === me || (!owner && !state.passOut && w.lastTouch === me.id && Math.hypot(w.ball.x - me.x, w.ball.y - me.y) < 2.4);
      if (!onBall) return;
      // running into a man: one standing in your path (in front, within a
      // body's width) gets a foot in, often — so you have to go ROUND him,
      // not through him. The tackle itself is the World's (skills decide it).
      if (owner === me) {
        const hx = Math.cos(me.facing), hy = Math.sin(me.facing);
        for (const d of defenders) {
          if (!d.active || state.beaten.has(d.id) || d.cooldown > 0) continue;
          const dx = d.x - me.x, dy = d.y - me.y, dist = Math.hypot(dx, dy);
          if (dist > BLOCK_R) continue;
          const ahead = (dx * hx + dy * hy) / (dist || 1);
          if (ahead < BLOCK_AHEAD) continue;
          if (w.rng() < BLOCK_RATE * dt) { w.tackleBy(d, me); if (state.end || w.owner !== me.id) return; }
        }
      }
      // past a man with the ball: beaten, for good
      for (const d of defenders) if (!state.beaten.has(d.id) && me.y < d.y - BEATEN_BY) state.beaten.add(d.id);
      if (owner === me) {
        const all = state.beaten.size === defenders.length;
        const space = defenders.every((d) => Math.hypot(d.x - me.x, d.y - me.y) > CLEAR_SPACE);
        if ((all && space) || me.y <= DRIBBLE3D_CLEAR_Y) {
          for (const d of defenders) if (me.y < d.y) state.beaten.add(d.id);
          end(w, "clear", "Through!");
        }
      }
    },
    onEvent(w, e) {
      if (state.end) return;
      const me = w.you();
      if (e.kind === "pass" && e.who === me?.id) { state.passOut = true; state.last = "Pass"; }
      if (e.kind === "tackle-won") { if (state.passOut) state.passFailed = true; end(w, "lost", "Tackled"); }
      if (e.kind === "tackle-lost") state.last = "Rode the tackle";
      if (e.kind === "touch" && e.who) {
        const p = w.get(e.who);
        if (p && me && p.team !== me.team) { if (state.passOut) state.passFailed = true; end(w, "lost", state.passOut ? "Cut out" : "Lost it"); }
      }
      if (e.kind === "out" || e.kind === "byline" || e.kind === "goal") { if (state.passOut) state.passFailed = true; end(w, "lost", "Out of play"); }
      if (e.kind === "catch" || e.kind === "save") { if (state.passOut) state.passFailed = true; end(w, "lost", "Keeper's ball"); }
    },
    onAction(_w, a) {
      // no shooting on a dribble run: the shot is the next chance
      if (a.kind === "shoot") { state.last = "Beat them first"; return true; }
      return false;
    },
    brain(w, p, dt) {
      if (p.mind.brain === "wave") { waveBrain(w, p, dt); return true; }
      if (p.mind.brain === "wide") { wideBrain(w, p, dt); return true; }
      return false;
    },
    // a team-mate who gets it never shoots (the run ends on his touch anyway)
    shouldShoot: () => false,
    finished: () => state.end !== null,
  };
  const world = new World({
    seed: o.seed, players: [you, ...mates, ...defenders, keeper], rules,
    bounds: { x1: CX - DRIBBLE3D_HALF_W, x2: CX + DRIBBLE3D_HALF_W, y1: -3, y2: 52 },
  });
  you.facing = -Math.PI / 2;
  world.placeBall(you.x, you.y - 0.5, you.id);
  return { world, state };
}

/**
 * The run as a 3D drill session (the Style Testing gameplay picture plays a
 * DrillSession): the HUD's wave squares live in the screen, not here.
 */
export function dribbleRunSession(o: DribbleRunOptions): DrillSession & { state: DribbleRunState } {
  const { world, state } = makeDribbleRun(o);
  return {
    world, state,
    camera: "chase",
    hint: "Stick: run with it · tap: pass",
    hud: () => ({ big: `${wavesBeatenOf(state)}/${state.waveSizes.length}`, small: "Waves beaten", timeLeft: state.timeLeft, flash: state.last }),
    done: () => state.end !== null,
    // never shown (a match chance, not a training drill)
    result: (team, roll) => ({ won: state.end === "clear", gain: gameReward(state.end === "clear", team, roll, "team"), line: state.why }),
  };
}
