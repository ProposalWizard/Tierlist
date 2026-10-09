/**
 * WEMBLEY — Harry's rules (8 Oct 2026), followed exactly:
 *
 *   Normal: 3–6 players (you + AI from your squad), half a pitch, one goal,
 *   one AI keeper. The keeper throws the ball out. Free for all: everyone
 *   chases, dribbles, tackles and shoots live. Score and you are SAFE for the
 *   round (you step off and stand by the post). The last player left without
 *   a goal in a round is OUT. Rounds repeat (every survivor back on) until
 *   one player remains: the winner.
 *
 *   Doubles: the same in pairs (you + one AI partner vs AI pairs). A goal by
 *   either partner makes the pair safe; the last pair to score is out; the
 *   last pair standing wins.
 *
 * One safety valve, said out loud on the HUD: if nobody scores for 60 s the
 * keeper tires and his rating drops a little (again every 60 s). Never a
 * hidden goal.
 *
 * Everything runs on the shared World (./world.ts): the men are "striker"
 * brains (./brains.ts), the keeper is the shared keeper. This file is only
 * the rules: who is safe, who is out, the restarts and the places.
 */
import { CX, POST_L, POST_R, PITCH_W, clamp, skill01 } from "./constants";
import { makePlayer, skillsOf, stepMover, towards, type P3 } from "./player";
import { BRAINS } from "./brains";
import { crossTo } from "./actions";
import { World, type Rules, type WorldEvent } from "./world";
import { gameReward } from "../relationships";
import type { Person3 } from "./freeRoam";

export type WembleyMode = "normal" | "doubles";

/**
 * The Wembley keeper's rating. The shared keeper is strong (from 12 m he stops
 * most of a 60's shots, and his reach barely changes with rating), so the
 * free-for-all uses a park keeper: measured, a 4-man session lasts about four
 * minutes at 45 (tests/star/wembley3d.mts). 9 Oct 2026: 36, and the valve floor 18, since the
 * keeper stopped diving at dribbles (he used to be on the floor when the real
 * shot came): 4.8 min a session, 22% of shots in, no stalls. Your career's keeper rating is not used.
 */
export const WEMBLEY_KEEPER = 36;

/** No goal for this long in a round → the keeper tires (rating drops). */
export const VALVE_SECONDS = 60;
/** How much his rating drops each time. */
export const VALVE_DROP = 6;
/** He never drops below this. */
export const VALVE_FLOOR = 18;
/** How long play stops after a goal / the ball going out. */
const GOAL_PAUSE = 1.5;
const OUT_PAUSE = 0.5;
/** A new round: the banner shows this long before the keeper has it. */
const ROUND_PAUSE = 2.4;
/** The keeper's lob out: how wide across the middle, how far out, how long in the air. */
const LOB_WIDTH = 22;
const LOB_Y = 12;
const LOB_T = 1.6;
/** How long the keeper holds it before the lob (the World's own throw is at 1.3 s). */
const KEEPER_HOLD = 0.6;

/** One entrant: a man (normal) or a pair (doubles). */
export interface WembleyUnit {
  id: string;
  name: string;
  members: string[];
  /** Your unit. */
  you: boolean;
  /** Scored this round. */
  safe: boolean;
  out: boolean;
  /** Final place (1 = winner), set when knocked out or when the session ends. */
  place?: number;
  goals: number;
}

export interface WembleyState {
  mode: WembleyMode;
  units: WembleyUnit[];
  round: number;
  /** Seconds since the round's last goal (or its start): the valve clock. */
  sinceGoal: number;
  keeperBase: number;
  keeperNow: number;
  /** Seconds played in each round. */
  roundTimes: number[];
  roundT: number;
  /** All seconds played. */
  t: number;
  over: boolean;
  /** You are out (watching or about to leave). */
  youOut: boolean;
  /** Watching the rest sped up. */
  watching: boolean;
  /** Left early. */
  left: boolean;
  /** The big banner (SAFE! / OUT / ROUND 2 / WINNER) and how long it stays. */
  banner: { text: string; tone: "good" | "bad" | "info"; until: number } | null;
  /** A HUD line: the last thing that happened. */
  last: string;
  /** The keeper-tiring line while it applies. */
  valveLine: string;
  /** Play is stopped, waiting for the keeper's restart (a goal or the ball out): nothing more counts till then. */
  paused: boolean;
  /** Goals in the whole session. */
  goals: number;
  /** Every time the valve fired. */
  valveFires: number;
}

export interface WembleyOptions {
  seed: number;
  mode: WembleyMode;
  /** Normal: players 3–6 (you included). Doubles: pairs 2–3. */
  count: number;
  you: Person3;
  /** AI men, in the order they are used (normal: count−1 of them; doubles: count×2−1). */
  mates: Person3[];
  keeperOverall?: number;
  /** Tests: you are an AI striker too. */
  autoYou?: boolean;
}

/**
 * A Wembley finish (tuned here, not in the engine): at the far corner, tighter
 * to the post the better the finisher (0.12 m in for a 100, 0.8 m for a 0),
 * low or rising, struck firmly. The 2D launch maths decides how true it goes.
 */
export const SHOT_MARGIN_BEST = 0.12;
export const SHOT_MARGIN_WORST = 0.8;
export function wembleyShot(w: World, p: P3) {
  const b = w.ball;
  const k = w.keeperOf();
  const fin = skill01(p.skills.shooting ?? p.skills.overall);
  const far = !k ? (w.rng() < 0.5 ? -1 : 1) : k.x < CX - 0.3 ? 1 : k.x > CX + 0.3 ? -1 : w.rng() < 0.5 ? -1 : 1;
  const margin = SHOT_MARGIN_WORST - (SHOT_MARGIN_WORST - SHOT_MARGIN_BEST) * fin + w.rng() * 0.25;
  const aimX = far > 0 ? POST_R - margin : POST_L + margin;
  const d = Math.hypot(b.x - CX, b.y);
  const power = clamp(0.62 + d / 45, 0.66, 0.97);
  const low = w.rng() < 0.6;
  const cy = low ? clamp(-0.55 + d / 60, -0.55, 0) : clamp(-0.4 + d / 45, -0.35, 0.15);
  w.strike(p, { x: aimX - b.x, y: -b.y }, power, { cx: (w.rng() - 0.5) * 0.3, cy });
}

/**
 * When a Wembley man shoots (tuned here). The shared keeper stops almost
 * everything from 16 m (measured: 90%+ even at a 50 rating), so he works it
 * closer: inside 9–12 m (further the better he finishes) with the goal open,
 * or up to 14 m if a man is on him.
 */
export function wembleyShouldShoot(w: World, p: P3): boolean {
  const b = w.ball;
  if (b.y < 1.5) return false;
  const d = Math.hypot(b.x - CX, b.y);
  const open = Math.abs(Math.atan2(POST_R - b.x, b.y) - Math.atan2(POST_L - b.x, b.y));
  const fin = skill01(p.skills.shooting ?? p.skills.overall);
  if (d < 10 + fin * 4 && open > 0.32) return true;
  const pressed = w.players.some((q) => q.active && q !== p && !q.keeper && w.hostile(p, q) && Math.hypot(q.x - p.x, q.y - p.y) < 2.5);
  return pressed && d < 17 && open > 0.28;
}

export function wembleyPlayers(mode: WembleyMode, count: number): number {
  return mode === "doubles" ? clamp(Math.round(count), 2, 3) * 2 : clamp(Math.round(count), 3, 6);
}

/** Where men stand while safe (by the left post, off the pitch) and out (off the far touchline). */
function safeSpot(i: number) { return { x: POST_L - 2.2 - i * 1.1, y: -1.2 - (i % 2) * 0.6 }; }
function outSpot(i: number) { return { x: PITCH_W + 1.8, y: 18 + i * 1.4 }; }

export function makeWembley(o: WembleyOptions): { world: World; state: WembleyState } {
  const mode = o.mode;
  const nMen = wembleyPlayers(mode, o.count);
  const nUnits = mode === "doubles" ? nMen / 2 : nMen;
  const filler = (i: number): Person3 => ({ id: `ai${i}`, name: `Player ${i + 1}`, skills: skillsOf(62) });
  const people: Person3[] = [o.you, ...Array.from({ length: nMen - 1 }, (_, i) => o.mates[i] ?? filler(i))];
  // unit k: men [k] (normal) or [2k, 2k+1] (doubles); you are man 0, so your partner is man 1
  const men: P3[] = people.map((pp, i) => {
    const unit = mode === "doubles" ? Math.floor(i / 2) : i;
    return makePlayer({
      id: pp.id, name: pp.name, team: unit, human: i === 0 && !o.autoYou,
      x: CX, y: 24, skills: pp.skills, photo: pp.photo,
      mind: { brain: "striker" },
    });
  });
  const keeperBase = o.keeperOverall ?? WEMBLEY_KEEPER;
  const keeper = makePlayer({ id: "keeper", name: "Keeper", team: 99, keeper: true, x: CX, y: 1, facing: Math.PI / 2, skills: skillsOf(keeperBase) });

  const units: WembleyUnit[] = Array.from({ length: nUnits }, (_, k) => {
    const mem = mode === "doubles" ? [men[2 * k], men[2 * k + 1]] : [men[k]];
    return {
      id: `u${k}`, you: k === 0,
      name: mode === "doubles" ? (k === 0 ? `You & ${mem[1].name}` : `${mem[0].name} & ${mem[1].name}`) : k === 0 ? "You" : mem[0].name,
      members: mem.map((m) => m.id), safe: false, out: false, goals: 0,
    };
  });
  const state: WembleyState = {
    mode, units, round: 1, sinceGoal: 0, keeperBase, keeperNow: keeperBase, roundTimes: [], roundT: 0, t: 0,
    over: false, youOut: false, watching: false, left: false, banner: { text: "ROUND 1", tone: "info", until: ROUND_PAUSE },
    last: "", valveLine: "", goals: 0, valveFires: 0, paused: true,
  };
  const unitOf = (id: string | undefined) => units.find((u) => !!id && u.members.includes(id));
  const alive = () => units.filter((u) => !u.out);
  let lastShooter: string | null = null;
  let safeCount = 0, outCount = 0;

  const banner = (w: World, text: string, tone: "good" | "bad" | "info", s = 1.8) => { state.banner = { text, tone, until: w.t + s }; };

  /** Keeper has it: he throws out when the World's clock says (1.3 s). */
  const keeperBall = (w: World) => {
    keeper.mind = {}; keeper.dive = undefined;
    keeper.x = CX; keeper.y = 1.2; keeper.facing = Math.PI / 2;
    w.placeBall(CX, 1.5, keeper.id);
    w.heldSince = w.t;
    state.paused = false;
  };

  /** Every man still in: back on, in a fan across the edge of the box. */
  const lineUp = (w: World) => {
    const on = alive().flatMap((u) => u.members).map((id) => w.get(id)!);
    on.forEach((p, i) => {
      const a = on.length === 1 ? 0 : (i / (on.length - 1) - 0.5);
      p.x = CX + a * 26 + (w.rng() - 0.5) * 2; p.y = 22 + Math.abs(a) * 6 + w.rng() * 2;
      p.vx = p.vy = 0; p.facing = -Math.PI / 2; p.cooldown = 0;
      p.sideline = false; p.mind = { brain: "striker" };
      w.add(p);
    });
  };

  const stepOff = (w: World, p: P3, where: { x: number; y: number }, act: "celebrate" | "slump") => {
    w.remove(p.id);
    p.sideline = true;
    p.act = act; p.actT = 0;
    p.mind = { walkX: where.x, walkY: where.y, walkAt: w.t + (act === "celebrate" ? 1.1 : 2.2), slow: act === "slump" };
  };

  const finish = (w: World) => {
    state.over = true;
    const win = alive()[0];
    if (win) { win.place = 1; }
    w.frozen = 1e9;
    w.timeScale = 1;
  };

  const newRound = (w: World) => {
    state.roundTimes.push(state.roundT);
    state.round++;
    state.roundT = 0; state.sinceGoal = 0;
    state.keeperNow = keeperBase; keeper.skills = skillsOf(keeperBase);
    state.valveLine = "";
    for (const u of units) u.safe = false;
    safeCount = 0;
    lineUp(w);
    banner(w, `ROUND ${state.round}`, "info", ROUND_PAUSE);
    w.frozen = ROUND_PAUSE;
    w.after(ROUND_PAUSE, () => keeperBall(w));
  };

  const scored = (w: World, who: string | undefined) => {
    const u = unitOf(who);
    state.goals++;
    state.sinceGoal = 0;
    if (state.keeperNow !== keeperBase) { state.keeperNow = keeperBase; keeper.skills = skillsOf(keeperBase); state.valveLine = ""; }
    state.paused = true;
    if (!u || u.safe || u.out) {
      // nobody to credit (an own goal off a man already safe): a restart, nothing more
      state.last = "Goal — doesn't count for anyone";
      w.frozen = GOAL_PAUSE; w.after(GOAL_PAUSE, () => keeperBall(w));
      return;
    }
    u.safe = true; u.goals++;
    const scorer = w.get(who)!;
    state.last = u.you ? (scorer.human ? "You scored — you're through!" : `${scorer.name} scored — you're both through!`) : `${scorer.name} scores — ${u.name} through`;
    banner(w, u.you ? "SAFE!" : `${u.name.toUpperCase()} SAFE`, u.you ? "good" : "info");
    for (const id of u.members) stepOff(w, w.get(id)!, safeSpot(safeCount++), "celebrate");
    const left = alive().filter((x) => !x.safe);
    if (left.length === 1) {
      const loser = left[0];
      loser.out = true;
      loser.place = alive().length + 1;
      for (const id of loser.members) stepOff(w, w.get(id)!, outSpot(outCount++), "slump");
      if (loser.you) { state.youOut = true; banner(w, "OUT", "bad", 2.6); state.last = `You're out — ${ordinal(loser.place)} place`; }
      else { state.last += ` · ${loser.name} OUT`; banner(w, `${loser.name.toUpperCase()} OUT`, "bad", 2.2); }
      const still = alive();
      if (still.length <= 1) {
        w.after(GOAL_PAUSE, () => { finish(w); if (still[0]) banner(w, still[0].you ? "WINNER!" : `${still[0].name.toUpperCase()} WINS`, still[0].you ? "good" : "info", 99); });
        w.frozen = 1e9;
        return;
      }
      w.frozen = GOAL_PAUSE;
      w.after(GOAL_PAUSE, () => newRound(w));
      return;
    }
    w.frozen = GOAL_PAUSE;
    w.after(GOAL_PAUSE, () => keeperBall(w));
  };

  /** Keeper's restart: lobbed up high so it drops in the middle and doesn't run on out of play. */
  const lobOut = (w: World) => {
    const b = w.ball;
    const tx = CX + (w.rng() - 0.5) * LOB_WIDTH, ty = LOB_Y + w.rng() * 5;
    keeper.facing = Math.atan2(ty - keeper.y, tx - keeper.x);
    b.x = keeper.x + Math.cos(keeper.facing) * 0.4; b.y = keeper.y + Math.sin(keeper.facing) * 0.4; b.z = 1.6;
    crossTo(b, keeper, { x: tx, y: ty, z: 0.2 }, LOB_T, w.rng);
    keeper.act = "throw"; keeper.actT = 0; keeper.cooldown = 0.8;
    w.owner = null; w.lastTouch = keeper.id; w.passTarget = null; w.passFrom = keeper.id; w.shotBy = null;
    w.emit({ kind: "throw", who: keeper.id });
  };

  const rules: Rules = {
    id: "wembley",
    step(w, dt) {
      // men off the pitch walk to where they stand
      for (const p of w.players) {
        if (p.active || !p.sideline) continue;
        const m = p.mind;
        const go = typeof m.walkAt === "number" && w.t >= m.walkAt;
        const tx = m.walkX as number, ty = m.walkY as number;
        const d = Math.hypot(tx - p.x, ty - p.y);
        // a man knocked out trudges off at a walk; a scorer jogs off
        const v = go && d > 0.3 ? towards(p, tx, ty, 1.2) : { x: 0, y: 0 };
        const k = m.slow ? 0.42 : 1;
        stepMover(p, { x: v.x * k, y: v.y * k }, false, dt, Math.atan2(w.ball.y - p.y, w.ball.x - p.x));
      }
      if (state.over) return;
      // the keeper's throw: a high lob into the middle for everyone to chase
      // (before the World's own 1.3 s throw to a man)
      if (w.owner === keeper.id && w.frozen <= 0 && w.t - w.heldSince > KEEPER_HOLD) lobOut(w);
      state.t += dt;
      if (w.frozen > 0 || state.paused) return;
      state.roundT += dt;
      state.sinceGoal += dt;
      // the safety valve: said on the HUD, never a hidden goal
      if (state.sinceGoal >= VALVE_SECONDS && state.keeperNow > VALVE_FLOOR) {
        const was = state.keeperNow;
        state.keeperNow = Math.max(VALVE_FLOOR, was - VALVE_DROP);
        keeper.skills = skillsOf(state.keeperNow);
        state.sinceGoal = 0;
        state.valveFires++;
        state.valveLine = `No goal for ${VALVE_SECONDS}s — the keeper's tiring (${was} → ${state.keeperNow})`;
        state.last = state.valveLine;
      }
    },
    onEvent(w, e: WorldEvent) {
      if (state.over) return;
      if ((e.kind === "shot" || e.kind === "header" || e.kind === "volley") && e.who && e.who !== keeper.id) lastShooter = e.who;
      if (e.kind === "goal") {
        if (state.paused) return;
        // off the keeper still counts for the man who shot
        const who = e.who && e.who !== keeper.id ? e.who : lastShooter ?? undefined;
        lastShooter = null;
        scored(w, who);
      } else if ((e.kind === "out" || e.kind === "byline") && !state.paused) {
        state.paused = true;
        state.last = e.kind === "byline" ? "Wide — keeper's ball" : "Out — keeper's ball";
        w.frozen = OUT_PAUSE;
        w.after(OUT_PAUSE, () => keeperBall(w));
      } else if (e.kind === "save") state.last = `Saved${e.clean ? " and held" : ""}`;
    },
    shouldShoot: wembleyShouldShoot,
    shoot: wembleyShot,
    brain(w, p, dt) {
      if (mode !== "doubles") return false;
      // doubles: a man in trouble lays it off to his partner if the partner is clear and nearer goal
      if (w.owner === p.id) {
        const mate = w.players.find((q) => q.active && q !== p && q.team === p.team && !q.keeper);
        const pressed = w.players.some((q) => q.active && !q.keeper && w.hostile(p, q) && Math.hypot(q.x - p.x, q.y - p.y) < 2);
        if (mate && pressed && Math.hypot(mate.x - CX, mate.y) + 3 < Math.hypot(p.x - CX, p.y) && w.rng() < 0.03) {
          w.passBall(p, mate);
          return true;
        }
      }
      BRAINS.striker(w, p, dt);
      return true;
    },
    // the keeper throws it into the middle for everyone to chase (not to a man)
    throwTarget: () => null,
    finished: () => state.over,
  };

  const world = new World({ seed: o.seed, players: [...men, keeper], rules });
  lineUp(world);
  world.frozen = ROUND_PAUSE;
  world.after(ROUND_PAUSE, () => keeperBall(world));
  return { world, state };
}

/** Watch the rest, sped up (after you're out). */
export function wembleyWatch(w: World, s: WembleyState) { s.watching = true; w.timeScale = 3; }
/** Leave now: your place stands, the rest is not played. */
export function wembleyLeave(w: World, s: WembleyState) { s.left = true; s.over = true; w.frozen = 1e9; w.timeScale = 1; }

/** Your finishing place (1 = won). Units out earlier finish lower. */
export function wembleyPlace(s: WembleyState): number {
  const you = s.units.find((u) => u.you)!;
  if (you.place) return you.place;
  return s.over && s.units.filter((u) => !u.out).length === 1 ? 1 : s.units.filter((u) => !u.out).length;
}

/**
 * The Team bar: the winner gets the full win; second (with 3+ in) half of it;
 * last loses a point; anywhere else nothing. relationships.ts gameReward.
 */
export function wembleyReward(s: WembleyState, team: number, roll: number) {
  const place = wembleyPlace(s);
  const n = s.units.length;
  const full = gameReward(true, team, roll, "team");
  const won = place === 1;
  const gain = won ? full : place === 2 && n >= 3 ? Math.round(full / 2) : place === n ? gameReward(false, team, roll, "team") : 0;
  return { won, gain, place };
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
