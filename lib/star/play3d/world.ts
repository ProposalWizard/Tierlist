/**
 * PLAY3D WORLD — the one fixed-step simulation every 3D game runs on.
 * Deterministic (seeded rng, fixed STEP), so a test can run it headless.
 *
 * It owns: the ball, any number of people (you, team-mates, opponents,
 * keepers), who has the ball, the loose-ball scramble (who gets there
 * first, 50-50s), dribbling, tackles, a keeper's saves and throw-outs, and
 * a list of what happened. A drill brings its own RULES (./drills.ts and its
 * own file): scoring, restarts, and any special brain or touch.
 *
 * The renderer (./scene.ts) only reads this; the screen only feeds it input.
 */
import { HALF_LEN, PITCH_W, REACH_FOOT, REACH_JUMP_Z, STEP, clamp, skill01, type Contact3 } from "./constants";
import { GOAL, newBall, predictBall, stepBall3d, type Ball3, type BallEvent, type GoalShape } from "./ball";
import { angDiff, speedOf, stepHuman, stepMover, type P3 } from "./player";
import { canSprint, effortOf, freshStamina, speedsForPace, stepStamina, type Stamina } from "../three3d/gait";
import {
  airStrike, ballAtFeet, strikeBall, dribbleTouch, firstTouch, passTo, passArrive, groundPassTime, shootFromPull, tackle, throwOut,
} from "./actions";
import { stepKeeper3d } from "./keeper";
import { makeRng, type Rng } from "./rng";
import { BRAINS, BRAIN_REACH } from "./brains";

/** A man on the ball turning: within this of the ball, and the ball rolling more than this (radians) off his heading, he hooks it round. */
export const TURN_HOOK_R = 2.0;
export const TURN_HOOK_ANGLE = 0.6;

export interface WorldInput { move: { x: number; y: number }; sprint: boolean }

export type Action3 =
  /** Tap: pass to the team-mate you face if you have it; touch it if it's at your feet; tackle if a man near you has it; else call for it. */
  | { kind: "tap"; /** The man tapped on screen, if the tap landed on one (a pass goes to him). */ to?: string }
  /** Drag and release: the 2D game's shot (`pull` = fraction of the real match's canvas height). */
  | { kind: "shoot"; dir: { x: number; y: number }; pull: number; contact?: Contact3 }
  | { kind: "pass"; lofted?: boolean; to?: string };

export type WorldEventKind =
  | "goal" | "save" | "catch" | "post" | "bar" | "byline" | "out" | "bounce"
  | "shot" | "pass" | "touch" | "clean-pass" | "heavy-touch" | "fifty"
  | "tackle-won" | "tackle-lost" | "throw" | "header" | "volley" | "juggle" | "drop" | "info";
export interface WorldEvent { t: number; kind: WorldEventKind; who?: string; to?: string; clean?: boolean; text?: string }

/**
 * A DRILL'S RULES — the extension point. Everything optional except id and
 * finished. Headers & Volleys and Wembley plug in here.
 */
export interface Rules {
  id: string;
  /** Called each step before anyone moves. */
  step?(w: World, dt: number): void;
  /** Something happened (a goal, a save, a touch …). */
  onEvent?(w: World, e: WorldEvent): void;
  /** A man has reached a loose ball. Return true if the drill dealt with it (a volley, a keepy-up …). */
  onReach?(w: World, p: P3): boolean;
  /** Your input. Return true if the drill dealt with it. */
  onAction?(w: World, a: Action3): boolean;
  /** Move an AI man yourself. Return true if handled (else his brain runs). */
  brain?(w: World, p: P3, dt: number): boolean;
  /** When an AI man shoots (default: brains.ts shouldShoot). The brains ask this. */
  shouldShoot?(w: World, p: P3): boolean;
  /** How an AI man shoots (default: brains.ts aiShoot). */
  shoot?(w: World, p: P3): void;
  /** Where the keeper throws it (default: a random outfielder). */
  throwTarget?(w: World, k: P3): P3 | null;
  finished(w: World): boolean;
  /** Sprinting uses stamina (Free Roam). Off: you sprint as long as you like. Only with World.newFeel. */
  stamina?: boolean;
}

export interface WorldOptions {
  seed: number;
  players: P3[];
  ball?: Ball3;
  goal?: GoalShape | null;
  rules: Rules;
  /** The playing area (default: the half pitch nearest the goal). */
  bounds?: { x1: number; x2: number; y1: number; y2: number };
  owner?: string | null;
}

export class World {
  t = 0;
  rng: Rng;
  ball: Ball3;
  players: P3[];
  goal: GoalShape | null;
  rules: Rules;
  bounds: { x1: number; x2: number; y1: number; y2: number };
  /** Who has the ball (id), or null if it's loose / in flight. */
  owner: string | null = null;
  /** Who touched it last. */
  lastTouch: string | null = null;
  /** The man a pass in flight is meant for. */
  passTarget: string | null = null;
  passFrom: string | null = null;
  /** A shot in flight (who struck it), cleared when it's dealt with. */
  shotBy: string | null = null;
  /** Counts every strike (yours and the AI's): the keeper dives at most once per number. */
  shotSeq = 0;
  input: WorldInput = { move: { x: 0, y: 0 }, sprint: false };
  /**
   * Your movement, the new feel (Harry, 9 Oct 2026): stick push sets walk /
   * jog / run, a full push sprints, speed builds and eases off
   * (play3d/player.ts stepHuman). The screen sets it from Settings → Look →
   * Motion (Mocap: on; Old: off, the feel from before). Off by default so the
   * tests' measured AI numbers stay as they were.
   */
  newFeel = false;
  /** Your sprint bar (rules.stamina): 0..1, and locked out after running it to empty. */
  stamina: Stamina = freshStamina();
  /** A drill's helping hand: moves YOU only while the stick is let go (Two Touch walks you under the ball). */
  assist: WorldInput | null = null;
  private queue: Action3[] = [];
  events: WorldEvent[] = [];
  /** Every event since the start (tests). */
  log: WorldEvent[] = [];
  /** Frozen (a restart beat): nobody moves and the ball is held. */
  frozen = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private acc = 0;
  /** The ball's coming path, every 0.1 s for 3 s (who-gets-there-first). */
  path: { t: number; x: number; y: number; z: number }[] = [];
  private pathAt = -1;
  /** The ball has gone out: no more "out" until it's placed again. */
  dead = false;
  /** When the keeper took hold of it. */
  heldSince = 0;
  /** How fast the World runs against real time (1 = real time; a drill's "watch it sped up" sets 3). */
  timeScale = 1;
  /** Rings on the grass the picture draws (a cross's landing spot …). A drill sets and clears them. */
  markers: { x: number; y: number; r?: number; color?: string }[] = [];
  /** Who a tap would pass to right now (you have the ball and a team-mate is on): the picture rings him. */
  aimMate: string | null = null;

  constructor(o: WorldOptions) {
    this.rng = makeRng(o.seed);
    this.players = o.players;
    this.ball = o.ball ?? newBall(34, 20);
    this.goal = o.goal === undefined ? GOAL : o.goal;
    this.rules = o.rules;
    this.bounds = o.bounds ?? { x1: 0, x2: PITCH_W, y1: -3, y2: HALF_LEN };
    this.owner = o.owner ?? null;
  }

  get(id: string | null | undefined): P3 | undefined { return id ? this.players.find((p) => p.id === id) : undefined; }
  you(): P3 | undefined { return this.players.find((p) => p.human); }
  active(): P3[] { return this.players.filter((p) => p.active); }
  keeperOf(): P3 | undefined { return this.players.find((p) => p.keeper && p.active); }
  hostile(a: P3, b: P3) { return a.team !== b.team; }

  /** Take a man off (a scorer stepping off, a man knocked out). Safe mid-play. */
  remove(id: string) {
    const p = this.get(id);
    if (!p) return;
    p.active = false;
    p.vx = 0; p.vy = 0;
    if (this.owner === id) this.owner = null;
    if (this.passTarget === id) this.passTarget = null;
  }
  /** Put a man (back) on. */
  add(p: P3) { if (!this.players.includes(p)) this.players.push(p); p.active = true; }

  emit(e: Omit<WorldEvent, "t">) {
    const ev = { ...e, t: this.t };
    this.events.push(ev);
    this.log.push(ev);
    if (this.log.length > 4000) this.log.shift();
    this.rules.onEvent?.(this, ev);
  }
  /** Events since last asked (the screen's HUD). */
  drain(): WorldEvent[] { const e = this.events; this.events = []; return e; }

  after(seconds: number, fn: () => void) { this.timers.push({ at: this.t + seconds, fn }); }
  act(a: Action3) { this.queue.push(a); }

  /** Put the ball somewhere, dead, optionally at a man's feet. */
  placeBall(x: number, y: number, ownerId: string | null = null) {
    const b = this.ball;
    Object.assign(b, newBall(x, y));
    this.dead = false;
    this.owner = ownerId;
    this.passTarget = null; this.shotBy = null;
    const o = this.get(ownerId);
    if (o) ballAtFeet(b, o);
  }

  /** Real seconds in → fixed steps out. */
  advance(realDt: number) {
    this.acc += Math.min(0.25, Math.max(0, realDt)) * Math.max(0, this.timeScale);
    let n = 0;
    while (this.acc >= STEP && n++ < 240) { this.step(STEP); this.acc -= STEP; }
    if (this.acc >= STEP) this.acc = 0;
  }

  step(dt: number) {
    this.t += dt;
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= this.t);
      if (due.length) { this.timers = this.timers.filter((x) => x.at > this.t); due.forEach((x) => x.fn()); }
    }
    this.rules.step?.(this, dt);
    if (this.frozen > 0) { this.frozen = Math.max(0, this.frozen - dt); this.queue.length = 0; return; }
    if (this.t - this.pathAt > 0.1) this.refreshPath();

    // your input
    const you = this.you();
    while (this.queue.length) {
      const a = this.queue.shift()!;
      if (you?.active && !this.rules.onAction?.(this, a)) this.doAction(you, a);
    }

    // people
    for (const p of this.players) {
      if (!p.active) continue;
      if (p.keeper) {
        const holding = this.owner === p.id;
        const ev = stepKeeper3d(p, this.ball, dt, this.rng, holding, this.shotBy ? this.shotSeq : 0, !this.owner && !this.passTarget && !this.shotBy);
        if (ev === "save") { this.lastTouch = p.id; this.shotBy = null; this.passTarget = null; this.emit({ kind: "save", who: p.id }); }
        else if (ev === "catch" || ev === "claim") {
          this.owner = p.id; this.lastTouch = p.id; this.heldSince = this.t;
          if (this.shotBy) this.emit({ kind: "save", who: p.id, clean: true });
          this.shotBy = null; this.passTarget = null;
          this.emit({ kind: "catch", who: p.id });
        }
        if (holding && this.t - this.heldSince > 1.3) this.keeperDistribute(p);
        continue;
      }
      if (p.human) {
        const i = this.assist && Math.hypot(this.input.move.x, this.input.move.y) < 0.1 ? this.assist : this.input;
        if (this.newFeel) {
          const useSt = !!this.rules.stamina;
          stepHuman(p, i.move, i.sprint, dt, !useSt || canSprint(this.stamina));
          if (useSt) this.stamina = stepStamina(this.stamina, effortOf(speedOf(p), !!p.sprinting, speedsForPace(p.skills.pace)), dt);
        } else stepMover(p, i.move, i.sprint, dt);
      }
      else if (!this.rules.brain?.(this, p, dt)) (BRAINS[(p.mind.brain as string) ?? "idle"] ?? BRAINS.idle)(this, p, dt);
      // stay on the pitch
      p.x = clamp(p.x, this.bounds.x1 - 2, this.bounds.x2 + 2);
      p.y = clamp(p.y, Math.max(0.3, this.bounds.y1), this.bounds.y2 + 2);
    }

    this.aimMate = you && this.owner === you.id ? this.bestTarget(you, this.passFacing(you))?.id ?? null : null;

    // the ball
    const owner = this.get(this.owner);
    if (owner?.keeper) {
      const b = this.ball;
      b.x = owner.x + Math.cos(owner.facing) * 0.3; b.y = owner.y + Math.sin(owner.facing) * 0.3; b.z = 1.2;
      b.vx = 0; b.vy = 0; b.vz = 0;
    } else {
      if (owner) this.carry(owner);
      if (!(owner && speedOf(owner) < 1.2)) {
        for (const e of stepBall3d(this.ball, dt, this.goal)) this.ballEvent(e);
      }
      if (!this.owner) this.scramble();
      this.tackles(dt);
    }
    // out of the playing area
    const b = this.ball;
    if (!this.dead && !b.inNet && (b.x < this.bounds.x1 - 1 || b.x > this.bounds.x2 + 1 || b.y > this.bounds.y2 + 1 || b.y < this.bounds.y1 - 1)) {
      if (this.owner === null || !this.get(this.owner)?.keeper) { this.dead = true; this.owner = null; this.shotBy = null; this.passTarget = null; this.emit({ kind: "out" }); }
    }
  }

  private ballEvent(e: BallEvent) {
    if (e.kind === "goal") { this.emit({ kind: "goal", who: this.shotBy ?? this.lastTouch ?? undefined }); this.shotBy = null; this.owner = null; }
    else if (e.kind === "byline") { this.emit({ kind: "byline", who: this.lastTouch ?? undefined }); this.shotBy = null; }
    else if (e.kind === "post" || e.kind === "bar") this.emit({ kind: e.kind, who: this.lastTouch ?? undefined });
    else if (e.kind === "bounce") this.emit({ kind: "bounce" });
  }

  private refreshPath() {
    this.pathAt = this.t;
    const c = { ...this.ball };
    const out = [{ t: 0, x: c.x, y: c.y, z: c.z }];
    for (let i = 1; i <= 30; i++) { stepBall3d(c, 0.1, null); out.push({ t: i * 0.1, x: c.x, y: c.y, z: c.z }); }
    this.path = out;
  }

  /**
   * WHO GETS THERE FIRST: the earliest moment on the ball's coming path a man
   * can be at it with the ball low enough to play (feet up to a jump).
   */
  intercept(p: P3, maxZ = 1.9): { x: number; y: number; t: number } | null {
    for (const s of this.path) {
      if (s.z > maxZ) continue;
      if (s.x < this.bounds.x1 - 1 || s.x > this.bounds.x2 + 1 || s.y > this.bounds.y2 + 1) break;
      const need = Math.hypot(s.x - p.x, s.y - p.y) / Math.max(4, speedOf(p) + 3.5 + skill01(p.skills.pace) * 2) + 0.15;
      if (need <= s.t || s.t >= 3) return { x: s.x, y: s.y, t: s.t };
    }
    const last = this.path[this.path.length - 1];
    return last ? { x: last.x, y: last.y, t: 3 } : null;
  }

  /** The man in possession runs with it: carried while slow, knocked on ahead while running. */
  private carry(p: P3) {
    const b = this.ball;
    const sp = speedOf(p);
    const fx = p.x + Math.cos(p.facing) * 0.45, fy = p.y + Math.sin(p.facing) * 0.45;
    const gap = Math.hypot(b.x - fx, b.y - fy);
    if (sp < 1.2) {
      if (gap < 1.2 && b.z < 0.5) { ballAtFeet(b, p, 0.45); b.vx = p.vx; b.vy = p.vy; return; }
    } else if (gap < 0.45 && p.cooldown <= 0) {
      const along = b.vx * Math.cos(p.facing) + b.vy * Math.sin(p.facing);
      if (along <= sp + 0.2) {
        const r = dribbleTouch(b, p, { x: Math.cos(p.facing), y: Math.sin(p.facing) }, this.rng);
        this.lastTouch = p.id;
        p.cooldown = 0.12;
        if (r.lost) { this.owner = null; p.cooldown = 0.35; this.emit({ kind: "heavy-touch", who: p.id }); }
        return;
      }
    }
    // a turn: the ball is still at his feet but rolling away from where he now
    // heads (he was sprinting one way and turns): he hooks it round with him,
    // a dribble touch the new way (heavy if his dribbling can't take it)
    const bs = Math.hypot(b.vx, b.vy);
    if (bs > 1.5 && p.cooldown <= 0 && b.z < 0.5 && Math.hypot(b.x - p.x, b.y - p.y) < TURN_HOOK_R
      && Math.abs(angDiff(p.facing, Math.atan2(b.vy, b.vx))) > TURN_HOOK_ANGLE) {
      const r = dribbleTouch(b, p, { x: Math.cos(p.facing), y: Math.sin(p.facing) }, this.rng);
      this.lastTouch = p.id;
      p.cooldown = 0.15;
      if (r.lost) { this.owner = null; p.cooldown = 0.35; this.emit({ kind: "heavy-touch", who: p.id }); }
      return;
    }
    if (Math.hypot(b.x - p.x, b.y - p.y) > 3.2) this.owner = null;
  }

  /** A loose ball: anyone who can reach it now. Two at once is a 50-50. */
  private scramble() {
    const b = this.ball;
    if (b.inNet) return;
    const near: P3[] = [];
    for (const p of this.players) {
      if (!p.active || p.keeper || p.cooldown > 0) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      const reach = b.z > 1.4 ? REACH_FOOT * 0.7 : REACH_FOOT;
      if (d < reach && b.z < REACH_JUMP_Z) near.push(p);
    }
    if (!near.length) return;
    let p = near[0];
    if (near.length > 1) {
      // a 50-50: the stronger, closer man is likelier to come away with it
      const w = near.map((q) => 0.4 + skill01(q.skills.overall) + (REACH_FOOT - Math.hypot(b.x - q.x, b.y - q.y)));
      let r = this.rng() * w.reduce((s, x) => s + x, 0);
      for (let i = 0; i < near.length; i++) { r -= w[i]; if (r <= 0) { p = near[i]; break; } }
      this.emit({ kind: "fifty", who: p.id, text: near.map((q) => q.id).join(",") });
      for (const q of near) if (q !== p) q.cooldown = 0.4;
    }
    if (this.rules.onReach?.(this, p)) return;
    if (BRAIN_REACH[(p.mind.brain as string) ?? ""]?.(this, p)) return;
    this.receive(p);
  }

  /** A first touch on a loose ball. */
  receive(p: P3) {
    const from = this.passFrom, meant = this.passTarget;
    const r = firstTouch(this.ball, p, this.rng);
    this.lastTouch = p.id;
    this.shotBy = null;
    this.passTarget = null; this.passFrom = null;
    if (r.clean) this.owner = p.id;
    this.emit({ kind: "touch", who: p.id, clean: r.clean });
    if (from && meant === p.id && r.clean) {
      const f = this.get(from);
      if (f && !this.hostile(f, p)) this.emit({ kind: "clean-pass", who: from, to: p.id });
    }
    return r.clean;
  }

  /** AI men close down whoever has it, and poke at it. */
  private tackles(dt: number) {
    const o = this.get(this.owner);
    if (!o || o.keeper) return;
    for (const p of this.players) {
      if (!p.active || p.keeper || p.human || p === o || !this.hostile(p, o) || p.cooldown > 0) continue;
      const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      if (d > 1.05) continue;
      if (this.rng() > 2.2 * dt) continue;
      this.tackleBy(p, o);
      if (this.owner !== o.id) return;
    }
  }

  tackleBy(p: P3, o: P3) {
    const won = tackle(this.ball, p, o, this.rng);
    this.emit({ kind: won ? "tackle-won" : "tackle-lost", who: p.id, to: o.id });
    if (won) { this.owner = null; this.lastTouch = p.id; }
  }

  /** The keeper throws it out (to whoever the drill says, else a random outfielder). */
  keeperDistribute(k: P3) {
    const target = this.rules.throwTarget ? this.rules.throwTarget(this, k) : (() => {
      const pool = this.players.filter((p) => p.active && !p.keeper);
      return pool.length ? pool[Math.floor(this.rng() * pool.length)] : null;
    })();
    const tx = target ? target.x : 34 + (this.rng() - 0.5) * 30;
    const ty = target ? target.y : 18 + this.rng() * 12;
    k.facing = Math.atan2(ty - k.y, tx - k.x);
    throwOut(this.ball, k, tx, ty, this.rng);
    this.owner = null; this.lastTouch = k.id;
    this.passTarget = target?.id ?? null; this.passFrom = k.id;
    this.emit({ kind: "throw", who: k.id, to: target?.id });
  }

  // ── Actions (yours, and the AI's through the same doors) ──

  passBall(p: P3, to: P3, lofted?: boolean) {
    // into his stride: where he'll be when it gets there (a few passes at the
    // ball's real travel time), firmer the further it goes
    const b = this.ball;
    let tx = to.x, ty = to.y;
    const loft = lofted ?? Math.hypot(to.x - b.x, to.y - b.y) > 24;
    for (let i = 0; i < 4; i++) {
      const d = Math.hypot(tx - b.x, ty - b.y);
      const t = loft ? 0.7 + d * 0.045 : groundPassTime(d, passArrive(d));
      const lead = Math.min(2.6, t);
      tx = to.x + to.vx * lead; ty = to.y + to.vy * lead;
    }
    passTo(b, p, tx, ty, loft, this.rng, passArrive(Math.hypot(tx - b.x, ty - b.y)));
    this.owner = null; this.lastTouch = p.id; this.shotBy = null;
    this.passTarget = to.id; this.passFrom = p.id;
    this.refreshPath(); // the receiver reads the new path this step, not 0.1 s late
    this.emit({ kind: "pass", who: p.id, to: to.id });
  }

  /** An AI (or scripted) strike at a set power 0-1: the same launch maths as yours. */
  strike(p: P3, dir: { x: number; y: number }, power: number, contact: Contact3 = { cx: 0, cy: 0 }) {
    strikeBall(this.ball, p, dir, power, contact, this.rng);
    this.shotSeq++;
    this.owner = null; this.lastTouch = p.id; this.shotBy = p.id; this.passTarget = null; this.passFrom = null;
    this.emit({ kind: "shot", who: p.id });
  }

  shoot(p: P3, dir: { x: number; y: number }, pull: number, contact: Contact3 = { cx: 0, cy: 0 }) {
    const b = this.ball;
    if (b.z > 0.65) {
      // in the air: a volley or a header, at the goal along your line
      const kind = b.z > 1.45 ? "header" : "volley";
      const d = Math.hypot(dir.x, dir.y) || 1;
      const dist = Math.max(4, Math.min(30, b.y));
      airStrike(b, p, kind, { x: b.x + dir.x / d * dist, y: b.y + dir.y / d * dist, z: 0.4 + Math.min(1, pull * 6) * 1.6 }, this.rng);
      this.emit({ kind, who: p.id });
    } else {
      if (!shootFromPull(b, p, dir, pull, contact, this.rng)) return false;
      this.emit({ kind: "shot", who: p.id });
    }
    this.owner = null; this.lastTouch = p.id; this.shotBy = p.id; this.passTarget = null; this.shotSeq++;
    return true;
  }

  /** Which way a pass goes: the stick if you're pushing it, else the way you face. */
  passFacing(p: P3): number {
    const move = this.input.move;
    return p.human && Math.hypot(move.x, move.y) > 0.2 ? Math.atan2(move.y, move.x) : p.facing;
  }

  /** The team-mate you're looking at (or nearest). */
  bestTarget(p: P3, facing = p.facing): P3 | null {
    let best: P3 | null = null, score = Infinity;
    for (const q of this.players) {
      if (!q.active || q === p || q.keeper || this.hostile(p, q)) continue;
      const a = Math.abs(angDiff(facing, Math.atan2(q.y - p.y, q.x - p.x)));
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      const s = d * (1 + a * 1.6) + (a > 1.3 ? 60 : 0);
      if (s < score) { score = s; best = q; }
    }
    return best;
  }

  private doAction(p: P3, a: Action3) {
    const b = this.ball;
    const dBall = Math.hypot(b.x - p.x, b.y - p.y);
    if (a.kind === "shoot") {
      if ((this.owner === p.id || (!this.owner && dBall < 1.6)) && b.z < REACH_JUMP_Z) this.shoot(p, a.dir, a.pull, a.contact);
      return;
    }
    if (a.kind === "pass" || (a.kind === "tap" && this.owner === p.id)) {
      if (this.owner !== p.id && !(dBall < 1.3 && b.z < 1)) return;
      // a team-mate named (tapped on screen) goes first; else the one you face
      const named = a.to ? this.get(a.to) : null;
      const to = (named && named.active && !named.keeper && !this.hostile(p, named) && named !== p ? named : null)
        ?? this.bestTarget(p, this.passFacing(p));
      if (to) this.passBall(p, to, a.kind === "pass" ? a.lofted : undefined);
      return;
    }
    // tap without the ball
    const o = this.get(this.owner);
    if (o && !o.keeper && this.hostile(p, o) && dBall < 1.5) { this.tackleBy(p, o); return; }
    if (!this.owner && dBall < 1.3 && b.z < 1.8) { this.receive(p); return; }
    if (o && !this.hostile(p, o) && !o.human) { o.mind.call = this.t; this.emit({ kind: "info", who: p.id, text: "call" }); }
  }
}

