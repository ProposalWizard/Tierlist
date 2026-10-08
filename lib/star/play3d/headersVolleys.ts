/**
 * HEADERS & VOLLEYS — your two full-backs (real ones from your squad) take
 * turns to send in live crosses from the byline and the wide areas: some to
 * head, some dropping to volley, some driven low across the six-yard box for a
 * first-time finish. A ring on the grass shows where it will come down (where
 * it reaches head height, volley height, or along the grass for a low one) so
 * a phone player can get there. Move with the stick; drag (aim) or tap (auto
 * aim at the far corner) as it arrives. One AI keeper, and one defender who
 * reacts late and goes for it too. Ten crosses.
 *
 * Score: a headed goal 2, a volley 3, any other goal 1 (Harry's research:
 * "some versions score headers 2 and volleys 3").
 *
 * Runs on the shared World (./world.ts): the cross is ./actions.ts crossTo,
 * your strike is World.shoot (a drag while the ball is in the air is a
 * header or a volley, ./actions.ts airStrike), the ring is World.markers and
 * where it lands is ./ball.ts meetAt.
 */
import { BALL_R, CX, clamp } from "./constants";
import { meetAt } from "./ball";
import { crossTo } from "./actions";
import { makePlayer, skillsOf, stepMover, towards, type P3 } from "./player";
import { World, type Rules, type WorldEvent } from "./world";
import { gameReward } from "../relationships";
import type { Person3 } from "./freeRoam";

export const HV_CROSSES = 10;
/** A good session (wins the Team bar): above the measured average bot (about 6 points a session against a 66 keeper). */
export const HV_TARGET = 7;
export const HV_POINTS = { header: 2, volley: 3, other: 1 } as const;

export type CrossKind = "head" | "volley" | "low";
/** The height you meet each kind at (the ring is where the ball comes down through it). */
export const MEET_Z: Record<CrossKind, number> = { head: 1.8, volley: 0.85, low: BALL_R };
/** How long each kind is in the air / on the grass, seconds (a range). */
const FLIGHT: Record<CrossKind, [number, number]> = { head: [1.25, 1.5], volley: [1.45, 1.75], low: [0.85, 1.05] };
/** A strike may be called this early (the ball not yet in reach): it's struck as it arrives. */
export const STRIKE_EARLY = 0.3;
/** How close the ball must come to you (horizontally) to be struck. */
export const STRIKE_REACH = 1.25;
/** The telegraph: the ring shows where he's aiming this long before he hits it. */
const TELEGRAPH = 0.9;
const BETWEEN = 1.3;
/** A tap's strength (the drag's `pull`): in the air ≈ aimed a metre up; on the grass ≈ 3/4 power. */
const TAP_PULL_AIR = 0.05;
const TAP_PULL_GROUND = 0.1;

export interface HvState {
  crossesLeft: number;
  cross: number;
  points: number;
  goals: number;
  headerGoals: number;
  volleyGoals: number;
  otherGoals: number;
  /** Crosses you got a strike on. */
  struck: number;
  onTarget: number;
  /** The current cross. */
  kind: CrossKind | null;
  phase: "setup" | "flight" | "struck" | "done" | "over";
  /** What your strike was (header / volley / shot). */
  strikeKind: "header" | "volley" | "shot" | null;
  last: string;
  over: boolean;
  /** Per cross: what happened. */
  log: { kind: CrossKind; from: "left" | "right"; result: string; points: number }[];
}

export interface HvOptions {
  seed: number;
  you: Person3;
  /** Left and right full-back (real ones if the squad has them). */
  leftBack: Person3;
  rightBack: Person3;
  keeperOverall?: number;
  /** One defender who goes for it too (default on). */
  defender?: boolean;
  /** Tests: a bot plays you (moves to the ring, strikes at the best height). */
  bot?: boolean;
}

export function makeHeadersVolleys(o: HvOptions): { world: World; state: HvState } {
  const you = makePlayer({ id: o.you.id, name: o.you.name, human: true, x: CX, y: 13, skills: o.you.skills, photo: o.you.photo });
  const lb = makePlayer({ id: o.leftBack.id, name: o.leftBack.name, x: 6, y: 8, facing: 0, skills: o.leftBack.skills, photo: o.leftBack.photo, mind: { brain: "idle" } });
  const rb = makePlayer({ id: o.rightBack.id, name: o.rightBack.name, x: 62, y: 8, facing: Math.PI, skills: o.rightBack.skills, photo: o.rightBack.photo, mind: { brain: "idle" } });
  const keeper = makePlayer({ id: "keeper", name: "Keeper", team: 1, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(o.keeperOverall ?? 66) });
  const def = o.defender === false ? null : makePlayer({ id: "defender", name: "Defender", team: 1, x: CX - 1, y: 11, skills: skillsOf(60) });
  const state: HvState = {
    crossesLeft: HV_CROSSES, cross: 0, points: 0, goals: 0, headerGoals: 0, volleyGoals: 0, otherGoals: 0, struck: 0, onTarget: 0,
    kind: null, phase: "setup", strikeKind: null, last: "", over: false, log: [],
  };
  let crosser: P3 = lb;
  let from: "left" | "right" = "left";
  let meet: { x: number; y: number; t: number } | null = null;
  let deliveredAt = 0, struckAt = 0;
  /** A strike called a moment early: done as the ball arrives. */
  let pending: { dir: { x: number; y: number } | null; pull: number | null; at: number } | null = null;
  let defGoAt = 0;
  let ended = false;

  const ringAt = (w: World, x: number, y: number, color = "#facc15") => { w.markers = [{ x, y, r: 0.9, color }]; };

  const setup = (w: World) => {
    if (state.crossesLeft <= 0) { state.over = true; state.phase = "over"; w.frozen = 1e9; w.markers = []; return; }
    ended = false; pending = null; state.strikeKind = null; meet = null;
    state.cross++;
    from = state.cross % 2 === 1 ? "left" : "right";
    crosser = from === "left" ? lb : rb;
    const r = w.rng;
    const kinds: CrossKind[] = ["head", "volley", "low"];
    state.kind = kinds[Math.floor(r() * 3) % 3];
    // from the byline (deep) or the wide area (level with the box's edge)
    const deep = r() < 0.55;
    const sx = from === "left" ? 1 : -1;
    crosser.x = from === "left" ? (deep ? 9 : 5) : (deep ? 59 : 63);
    crosser.y = deep ? 3 + r() * 3 : 14 + r() * 6;
    crosser.vx = crosser.vy = 0;
    // you back to the edge of the six-yard-box area; the defender goal-side
    you.x = CX + (r() - 0.5) * 6; you.y = 13 + r() * 2; you.vx = you.vy = 0; you.facing = -Math.PI / 2; you.cooldown = 0;
    if (def) { def.x = you.x - sx * 1.2; def.y = you.y - 2.2; def.vx = def.vy = 0; def.facing = Math.PI / 2; def.cooldown = 0; }
    keeper.mind = {}; keeper.dive = undefined; keeper.x = CX + sx * -0.8; keeper.y = 1; keeper.facing = Math.PI / 2;
    // where he means to put it
    const target = state.kind === "low"
      ? { x: CX + sx * -(r() * 4), y: 9 + r() * 4 }
      : { x: CX + (r() - 0.5) * 8, y: 6.5 + r() * 5 };
    crosser.facing = Math.atan2(target.y - crosser.y, target.x - crosser.x);
    w.placeBall(crosser.x + Math.cos(crosser.facing) * 0.45, crosser.y + Math.sin(crosser.facing) * 0.45, crosser.id);
    state.phase = "setup";
    ringAt(w, target.x, target.y, "rgba(250,204,21,0.55)");
    state.last = `${from === "left" ? "Left" : "Right"} back: ${state.kind === "head" ? "one to head" : state.kind === "volley" ? "one to volley" : "driven low"}`;
    w.after(TELEGRAPH, () => deliver(w, target));
  };

  const deliver = (w: World, target: { x: number; y: number }) => {
    if (state.over) return;
    const kind = state.kind!;
    const [t0, t1] = FLIGHT[kind];
    const T = t0 + w.rng() * (t1 - t0);
    const b = w.ball;
    w.owner = null;
    const sent = crossTo(b, crosser, { x: target.x, y: target.y, z: MEET_Z[kind] }, T, w.rng, kind === "low");
    w.lastTouch = crosser.id; w.passFrom = crosser.id; w.passTarget = you.id; w.shotBy = null;
    w.emit({ kind: "pass", who: crosser.id, to: you.id, text: kind });
    // where it really comes down (the error included)
    // (a driven low ball: the point it was sent to, error included)
    const m = kind === "low" ? null : meetAt(b, MEET_Z[kind], 3);
    meet = m ? { x: m.x, y: m.y, t: w.t + m.t } : { x: sent.x, y: sent.y, t: w.t + T };
    ringAt(w, meet.x, meet.y);
    deliveredAt = w.t;
    defGoAt = w.t + 0.45 + w.rng() * 0.2;
    state.phase = "flight";
    state.crossesLeft--;
  };

  const end = (w: World, result: string, points = 0) => {
    if (ended) return;
    ended = true;
    state.phase = "done";
    state.points += points;
    state.log.push({ kind: state.kind!, from, result, points });
    state.last = result;
    w.markers = [];
    w.frozen = BETWEEN;
    w.after(BETWEEN, () => setup(w));
  };

  /**
   * Your strike, now: a drag's aim, or (a tap) the far corner from the keeper.
   * A tap's strength: in the air, aimed about a metre up; on the grass, a firm
   * first-time shot.
   */
  const strikeNow = (w: World, dir: { x: number; y: number } | null, pull: number | null) => {
    const b = w.ball;
    const far = keeper.x < CX ? 1 : -1;
    const aim = dir ?? { x: CX + far * 2.6 - b.x, y: -b.y };
    you.facing = Math.atan2(aim.y, aim.x);
    w.owner = null;
    if (w.shoot(you, aim, pull ?? (b.z > 0.65 ? TAP_PULL_AIR : TAP_PULL_GROUND))) {
      state.struck++;
      state.phase = "struck";
      struckAt = w.t;
      w.markers = [];
    }
  };

  const rules: Rules = {
    id: "headers-volleys",
    step(w, dt) {
      if (state.over || w.frozen > 0) return;
      const b = w.ball;
      // the bot: run to the ring, call the strike just before it arrives
      // (it reads the ring like a player: the telegraph first, then the real one)
      const ring = w.markers[0];
      if (o.bot && ring && (state.phase === "flight" || state.phase === "setup")) {
        const d = Math.hypot(ring.x - you.x, ring.y - you.y);
        w.input = { move: towards(you, ring.x, ring.y, 0.4), sprint: d > 1.2 };
      }
      if (o.bot && meet && state.phase === "flight") {
        if (!pending && meet.t - w.t < STRIKE_EARLY * 0.8) {
          pending = { dir: null, pull: null, at: w.t };
        }
      }
      // a strike called early fires when the ball is closest
      if (pending && state.phase === "flight") {
        const dNow = Math.hypot(b.x - you.x, b.y - you.y);
        const next = { x: b.x + b.vx * dt, y: b.y + b.vy * dt };
        const dNext = Math.hypot(next.x - you.x, next.y - you.y);
        if (dNow <= STRIKE_REACH && b.z < 2.4 && dNext >= dNow) strikeNow(w, pending.dir, pending.pull);
        else if (w.t - pending.at > STRIKE_EARLY + 0.1) { pending = null; }
      }
      // the defender: late off the mark, then attacks the ball
      if (def && state.phase === "flight") {
        if (w.t >= defGoAt && meet) stepMover(def, towards(def, meet.x, meet.y, 0.3), true, dt);
        else stepMover(def, { x: 0, y: 0 }, false, dt, Math.atan2(b.y - def.y, b.x - def.x));
      }
      // nothing came of it
      if (state.phase === "flight" && w.t - deliveredAt > 4) end(w, "Missed it");
      if (state.phase === "struck" && w.t - struckAt > 3) end(w, "Off target");
    },
    brain(w, p, dt) {
      if (p === def) return true; // moved in step()
      stepMover(p, { x: 0, y: 0 }, false, dt, Math.atan2(w.ball.y - p.y, w.ball.x - p.x));
      return true;
    },
    onReach(w, p) {
      if (state.phase !== "flight") return true;
      if (p === def) {
        // he gets there first: heads it away
        const out = { x: p.x < CX ? -1 : 1, y: 0.6 };
        w.strike(p, out, 0.55, { cx: 0, cy: 0.5 });
        p.act = "header"; p.actT = 0;
        end(w, "Cleared by the defender");
        return true;
      }
      // you: only a strike plays it (the ball runs on past otherwise)
      return true;
    },
    onAction(w, a) {
      if (state.over || w.frozen > 0) return true;
      if (state.phase !== "flight") return true;
      if (a.kind !== "shoot" && a.kind !== "tap") return true;
      const b = w.ball;
      const dir = a.kind === "shoot" ? a.dir : null;
      const pull = a.kind === "shoot" ? a.pull : null;
      if (Math.hypot(b.x - you.x, b.y - you.y) <= STRIKE_REACH && b.z < 2.4) strikeNow(w, dir, pull);
      else pending = { dir, pull, at: w.t };
      return true;
    },
    onEvent(w, e: WorldEvent) {
      if (state.over) return;
      if (e.who === you.id && (e.kind === "header" || e.kind === "volley" || e.kind === "shot")) state.strikeKind = e.kind;
      if (e.kind === "goal") {
        if (state.phase === "struck" && state.strikeKind) {
          const pts = state.strikeKind === "header" ? HV_POINTS.header : state.strikeKind === "volley" ? HV_POINTS.volley : HV_POINTS.other;
          state.goals++; state.onTarget++;
          if (state.strikeKind === "header") state.headerGoals++; else if (state.strikeKind === "volley") state.volleyGoals++; else state.otherGoals++;
          you.act = "celebrate"; you.actT = 0;
          end(w, `${state.strikeKind === "header" ? "HEADER" : state.strikeKind === "volley" ? "VOLLEY" : "GOAL"}! +${pts}`, pts);
        } else end(w, "In off nobody — doesn't count");
      } else if (e.kind === "save" || e.kind === "catch") {
        if (state.phase === "struck") { state.onTarget++; end(w, "Saved"); }
        else end(w, "Keeper's ball");
      } else if (e.kind === "byline" || e.kind === "out") end(w, state.phase === "struck" ? "Wide" : "Missed it");
      else if (e.kind === "post" || e.kind === "bar") { if (state.phase === "struck") state.onTarget++; }
    },
    throwTarget: () => null,
    finished: () => state.over,
  };
  const world = new World({ seed: o.seed, players: [you, lb, rb, keeper, ...(def ? [def] : [])], rules });
  setup(world);
  return { world, state };
}

/** Where a cross kind is met, as a word (the HUD). */
export function crossWord(k: CrossKind | null): string { return k === "head" ? "Head it" : k === "volley" ? "Volley it" : k === "low" ? "First time" : ""; }

export function hvReward(s: HvState, team: number, roll: number) {
  const won = s.points >= HV_TARGET;
  return { won, gain: gameReward(won, team, roll, "team") };
}

export { clamp };
