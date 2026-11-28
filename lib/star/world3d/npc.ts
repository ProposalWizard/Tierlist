/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A PERSON WHO LIVES IN A 3D PLACE (world kit, phase 1). One Person3D
 * (people3d.ts), the tap-walk path finder (tapWalk.ts TapWalker) for his
 * legs' route, the clean clip player (three3d/footballAnims.ts ClipPlayer:
 * walk/jog mixed by real speed on one stride clock, so no foot slide) and a
 * small state machine:
 *
 *   walk → turn → enter (sit_down) → use (the object's loop) → exit (stand_up)
 *
 * He books his slot on the object first (smartObject.ts SlotBook), so two
 * people never take one seat. He never walks through anyone: he slows and
 * steps aside for a body ahead, and a hard push-out keeps every two bodies
 * apart; after two seconds blocked he finds a new way round.
 *
 * SITTING WITHOUT GOING INTO THE SEAT. Each body measures itself once
 * (measureSit): where its hips sit and its lowest point under them in the
 * capture's seated pose (CMU 143_18). For a seat, his feet stand where the
 * hips then land exactly over the seat's middle, and he is raised or lowered
 * (only while he goes down, never at the feet's start) so the underside of
 * his seat rests on the seat's top.
 *
 * Two small moves the clips don't have yet are added on top, after the clip:
 * a drink (the right hand brought up to just in front of the mouth, never
 * into the face) and a look (the head turned towards whoever he talks to).
 * Used by every person in the world kit, you included ("you" walks the same way).
 */
import type * as THREE from "three";
import type { Person3D } from "../people3d";
import { ClipPlayer, type LocoSpec } from "../three3d/footballAnims";
import { TapWalker, findPath, freeAt, type WalkGrid, type XZ } from "../tapWalk";
import { turnTo, angDiff } from "../three3d/animBlend";
import { ownMotion, lifeSeed, WALK_SPEED, type OwnMotion } from "../people/life";
import { toonFaceOf, blinkAt, wanderGaze } from "../style3d/toon/face";
import { fwdOf, rightOf, type ClipStep, type SlotBook, type SmartObject, type SmartSlot } from "./smartObject";

type Three = typeof import("three");

/** A body another person must not walk through. */
export interface Body { id: string; x: number; z: number; r: number }

/** What a person needs from the place. */
export interface NpcWorld {
  grid: WalkGrid;
  book: SlotBook;
  /** Every body in the place (his own included; he skips it). */
  bodies(): Body[];
}

/** Measured on one body: its seated hips and seat underside, in his own frame. */
export interface SitFit {
  hx: number; hz: number;
  /** His seat's underside under the hips (m, his frame). */
  under: number;
  /** The underside of seat and thighs every 2 cm from 12 cm behind the hips forward (Infinity past the knee). */
  profile?: number[];
}

/** How low he comes over a seat that reaches `front` metres in front of his hips. */
export function underOver(fit: SitFit, front: number): number {
  if (!fit.profile) return fit.under;
  const n = Math.max(1, Math.min(fit.profile.length, Math.floor((front + 0.12) / 0.02) + 1));
  return Math.min(...fit.profile.slice(0, n));
}

/** His walking pace (m/s): a stroll, and a jog for a long trip. */
export const NPC_WALK = 1.25;
export const NPC_JOG = 2.6;
/** A body's radius on the floor (m). */
export const BODY_R = 0.3;

/**
 * Measure where this body's hips and seat are in the capture's seated pose
 * (clip at `t`). Done once, before anything plays. Null if the body has no
 * seated clip.
 */
export function measureSit(T: Three, p: Person3D, clip = "sit_down", t = 1.55): SitFit | null {
  const a = p.actions[clip];
  if (!a || !p.bones.Hips) return null;
  const saved = Object.values(p.actions).map((x) => [x, x.getEffectiveWeight(), x.time, x.enabled] as const);
  for (const [x] of saved) x.setEffectiveWeight(0);
  a.enabled = true; a.play(); a.setEffectiveWeight(1); a.time = t; a.timeScale = 0;
  // twice: an action's first update only switches it on
  p.mixer.update(0); a.time = t; p.mixer.update(0);
  p.root.updateMatrixWorld(true);
  const hp = new T.Vector3();
  p.bones.Hips.getWorldPosition(hp);
  const local = p.root.worldToLocal(hp.clone());
  // the underside of his seat and thighs, from the bones (a skin scan read some heads' last drawn
  // pose): under the hip joints by 8.5 cm (measured on the Style A body: 0.502 → 0.419 m), along
  // the thigh to the knee tapering to 6 cm. A profile by distance in front of the hips, so a seat
  // knows how low his thighs come over its whole depth (Harry: "legs are through the bench").
  const loc = (b?: THREE.Bone) => (b ? p.root.worldToLocal(b.getWorldPosition(new T.Vector3())) : null);
  const ul = [loc(p.bones.LeftUpLeg), loc(p.bones.RightUpLeg)].filter(Boolean) as THREE.Vector3[];
  const kn = [loc(p.bones.LeftLeg), loc(p.bones.RightLeg)].filter(Boolean) as THREE.Vector3[];
  const avg = (vs: THREE.Vector3[]) => vs.reduce((a, v) => a.add(v), new T.Vector3()).multiplyScalar(1 / Math.max(1, vs.length));
  const U = ul.length ? avg(ul) : local.clone(), K = kn.length ? avg(kn) : U.clone().add(new T.Vector3(0, 0, 0.42));
  const profile: number[] = [];
  for (let d = -0.12; d <= 0.6001; d += 0.02) {
    const z = local.z + d;
    let y: number;
    if (z <= U.z) y = U.y - 0.085;
    else if (z <= K.z) { const k = (z - U.z) / Math.max(1e-3, K.z - U.z); y = U.y + (K.y - U.y) * k - (0.085 + (0.06 - 0.085) * k); }
    else y = Infinity; // past the knee the calves hang down in front of the seat
    profile.push(y);
  }
  // cloth clothes (style3d/toon/clothes): trousers and a hem sit a little outside the skin, so the profile comes down
  // to the lowest cloth under his seat and thighs in this pose (only within 5 cm under the bones' line: the shins
  // hanging past the knee are not his seat). Without cloth nothing changes.
  const cloth = (p.body.parent as THREE.Object3D | null)?.getObjectByName("Cloth") as THREE.SkinnedMesh | undefined;
  if (cloth?.isSkinnedMesh) {
    p.body.skeleton.update();
    const v = new T.Vector3(), n = cloth.geometry.getAttribute("position").count;
    for (let k = 0; k < n; k += 2) {
      cloth.getVertexPosition(k, v); v.applyMatrix4(cloth.matrixWorld); p.root.worldToLocal(v);
      if (Math.abs(v.x - local.x) > 0.26 || v.y > U.y) continue;
      const i = Math.round((v.z - local.z + 0.12) / 0.02);
      if (i < 0 || i >= profile.length || !Number.isFinite(profile[i])) continue;
      if (v.y < profile[i] && v.y > profile[i] - 0.05) profile[i] = v.y;
    }
  }
  const rootY = 0;
  const under = Math.min(...profile.slice(0, 7));
  for (const [x, w, tm, en] of saved) { x.setEffectiveWeight(w); x.time = tm; x.enabled = en; }
  a.timeScale = 1;
  p.mixer.update(0);
  return { hx: local.x, hz: local.z, under: under - rootY, profile };
}

/** Where his feet (root) go for a seat, and how high (so his seat rests on it). */
export function sitRootFor(slot: SmartSlot, fit: SitFit | null): { at: XZ; y: number } {
  if (!slot.seat) return { at: slot.stand, y: 0 };
  if (!fit) return { at: slot.stand, y: 0 };
  const f = fwdOf(slot.facing), r = rightOf(slot.facing);
  const at: XZ = [slot.seat.at[0] - (r[0] * fit.hx + f[0] * fit.hz), slot.seat.at[1] - (r[1] * fit.hx + f[1] * fit.hz)];
  return { at, y: slot.seat.y - underOver(fit, slot.seat.front ?? 0.3) };
}

type State = "hidden" | "stand" | "walk" | "turn" | "enter" | "use" | "exit" | "act";

interface UseJob {
  obj: SmartObject; slot: SmartSlot; root: { at: XZ; y: number };
  loop: ClipStep[]; secs: number; t: number; k: number; stepT: number;
  onStart?: () => void; onIn?: () => void; onOut?: () => void;
}

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Npc {
  readonly id: string;
  name: string;
  state: State = "stand";
  x = 0; z = 0; yaw = 0; y = 0;
  speed = 0;
  readonly play: ClipPlayer;
  readonly walker = new TapWalker();
  /** Measured once (measureSit). */
  readonly sit: SitFit | null;
  /** A prop in his right hand (a can), if any. */
  prop: any = null;
  /** Look at this point (head turn), or null. */
  lookAt: XZ | null = null;
  /** Debug: the last thing he did. */
  note = "";
  private yawS = { yaw: 0, vel: 0 };
  private job: UseJob | null = null;
  private goal: { to: XZ; face: number | null; onArrive?: () => void; tries: number; run: boolean } | null = null;
  private blockedT = 0;
  private replanT = 0;
  private faceTarget: number | null = null;
  private actEnd: (() => void) | null = null;
  private actT = 0;
  private gestureW = { drink: 0, look: 0 };
  private gestureWant = { drink: 0 };
  private clock = 0;
  private lastClip = "";
  private q0 = new Map<any, any>();
  /** Bones an added move turned this frame, and how the clip had left them. */
  private posed = new Map<THREE.Object3D, THREE.Quaternion>();
  private tmp: Record<string, any>;

  /** His own motion (people/life.ts): his pace, which walk he has; the same from his id every time. */
  readonly own: OwnMotion;
  private faceSeed: number;

  constructor(private T: Three, readonly person: Person3D, opts: { id: string; name?: string; loco: LocoSpec[]; sit?: SitFit | null }) {
    this.id = opts.id;
    this.name = opts.name ?? opts.id;
    this.own = ownMotion(opts.id);
    this.faceSeed = lifeSeed(opts.id);
    this.play = new ClipPlayer(T, person.actions);
    // each person has his own walk and standing idle (people/life.ts), the walk's speed scaled so the feet still keep up
    const acts = person.actions as Record<string, unknown>;
    const w = this.own.walk;
    const loco = w !== "walk" && acts[w] ? opts.loco.map((l) => (l.name === "walk" ? { ...l, name: w, speed: l.speed * WALK_SPEED[w] } : l)) : opts.loco;
    this.play.setLoco(loco, acts[this.own.idle] ? this.own.idle : "idle");
    this.play.loco(0, { fade: 0 });
    this.sit = opts.sit ?? null;
    this.tmp = { v: new T.Vector3(), w: new T.Vector3(), a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), q: new T.Quaternion(), p: new T.Quaternion(), d: new T.Quaternion() };
  }

  get root() { return this.person.root; }
  get busy() { return this.state !== "stand" && this.state !== "hidden"; }
  get seated() { return this.state === "enter" || this.state === "use" || this.state === "exit"; }
  get using(): SmartObject | null { return this.job?.obj ?? null; }
  /** Is he walking or playing a clip that moves a lot (for the budget). */
  get moving() { return this.state === "walk" || this.state === "turn" || this.state === "enter" || this.state === "exit" || this.state === "act"; }

  /** Where his body is on the floor (his hips: seated, that is the seat). */
  bodyXZ(): XZ {
    const h = this.person.bones.Hips;
    if (!h || !this.seated) return [this.x, this.z];
    h.getWorldPosition(this.tmp.v);
    return [this.tmp.v.x, this.tmp.v.z];
  }

  place(x: number, z: number, yaw: number) {
    this.x = x; this.z = z; this.yaw = yaw; this.y = 0;
    this.yawS = { yaw, vel: 0 };
    this.sync();
  }
  show(on: boolean) {
    this.root.visible = on;
    if (!on) { this.state = "hidden"; this.walker.cancel(); this.goal = null; }
    else if (this.state === "hidden") this.state = "stand";
  }

  /** Walk a straight line through these points, no path finding (through a doorway, off the room's floor grid). */
  walkLine(points: XZ[], onArrive?: () => void): boolean {
    if (this.seated || !points.length) return false;
    this.gestureWant.drink = 0;
    this.goal = { to: points[points.length - 1], face: null, onArrive, tries: 6, run: false };
    this.walker.go(points, { onArrive: () => this.arrived() });
    this.state = "walk";
    this.blockedT = 0;
    return true;
  }

  /** Walk to a point (round things); `face` = the facing to turn to there. */
  walkTo(world: NpcWorld, to: XZ, o: { face?: number | null; onArrive?: () => void; run?: boolean } = {}): boolean {
    if (this.seated) return false;
    this.gestureWant.drink = 0;
    this.goal = { to, face: o.face ?? null, onArrive: o.onArrive, tries: 0, run: !!o.run };
    return this.plan(world);
  }

  private plan(world: NpcWorld): boolean {
    const g = this.goal;
    if (!g) return false;
    // people standing still are in the way too: a path round them (not through)
    const others = world.bodies().filter((b) => b.id !== this.id);
    const blocked: [number, number][] = [];
    for (const b of others) {
      // the cells under another body are shut while this path is found (his goal stays open)
      if (Math.hypot(b.x - g.to[0], b.z - g.to[1]) < 0.45) continue;
      const R = b.r + BODY_R * 0.8;
      const c = world.grid.cell;
      for (let dz = -R; dz <= R; dz += c) for (let dx = -R; dx <= R; dx += c) {
        if (dx * dx + dz * dz > R * R) continue;
        const i = Math.floor((b.x + dx - world.grid.x0) / c), j = Math.floor((b.z + dz - world.grid.z0) / c);
        if (i < 0 || j < 0 || i >= world.grid.nx || j >= world.grid.nz) continue;
        const n = j * world.grid.nx + i;
        if (world.grid.free[n] && Math.hypot(this.x - (b.x + dx), this.z - (b.z + dz)) > 0.5) { world.grid.free[n] = 0; blocked.push([n, 1]); }
      }
    }
    const path = findPath(world.grid, [this.x, this.z], g.to);
    for (const [n] of blocked) world.grid.free[n] = 1;
    if (!path) { this.note = "no way"; return false; }
    // already there (the start and the goal in one cell): no walk at all
    if (!path.length) { this.state = "stand"; this.arrived(); return true; }
    // the last point exactly (findPath snaps to a free cell: a seat's front is free)
    if (Math.hypot(path[path.length - 1][0] - g.to[0], path[path.length - 1][1] - g.to[1]) < 0.8) path[path.length - 1] = g.to;
    this.walker.go(path, { run: g.run, onArrive: () => this.arrived() });
    this.state = "walk";
    this.blockedT = 0;
    return true;
  }

  private arrived() {
    const g = this.goal;
    this.goal = null;
    if (g && g.face !== null) { this.faceTarget = g.face; this.state = "turn"; this.afterTurn = g.onArrive ?? null; }
    else { this.state = "stand"; g?.onArrive?.(); }
  }
  private afterTurn: (() => void) | null = null;

  /**
   * Use an object: book a slot (the free one nearest him), walk there, go in,
   * play its loop for `secs` (Infinity: until leave()), come out. False if
   * every slot is taken or there is no way there.
   */
  use(world: NpcWorld, obj: SmartObject, o: { slot?: string; secs?: number; loop?: ClipStep[]; onStart?: () => void; onIn?: () => void; onOut?: () => void; near?: number } = {}): boolean {
    if (this.seated) return false;
    const slot = world.book.book(obj, this.id, { slot: o.slot, near: [this.x, this.z] });
    if (!slot) return false;
    const root = sitRootFor(slot, this.sit);
    this.job = { obj, slot, root, loop: o.loop?.length ? o.loop : obj.loop, secs: o.secs ?? Infinity, t: 0, k: 0, stepT: 0, onStart: o.onStart, onIn: o.onIn, onOut: o.onOut };
    // `near`: how close counts as there (he eases the last bit in while he turns; a seat's own spot is inside the seat, past the floor a walk can reach)
    const near = Math.hypot(root.at[0] - this.x, root.at[1] - this.z) < (o.near ?? 0.2);
    if (near) { this.faceTarget = slot.facing; this.state = "turn"; this.afterTurn = () => this.enter(); return true; }
    this.goal = { to: root.at, face: slot.facing, tries: 0, run: false, onArrive: () => this.enter() };
    if (!this.plan(world)) { world.book.release(this.id); this.job = null; return false; }
    this.afterTurn = null;
    return true;
  }

  private enter() {
    const j = this.job;
    if (!j) return;
    // the last few centimetres to the exact spot, while he turns
    this.x = j.root.at[0]; this.z = j.root.at[1];
    j.onStart?.();
    const e = j.obj.enter;
    const name = e ? this.pick(e) : null;
    if (name) {
      this.state = "enter";
      this.play.play(name, { once: true, fade: 0.25, speed: e?.speed, onEnd: () => this.inUse() });
      this.lastClip = name;
    } else this.inUse();
  }

  private inUse() {
    const j = this.job;
    if (!j) return;
    this.state = "use";
    j.t = 0; j.k = 0; j.stepT = 0;
    this.y = j.slot.seat ? j.root.y : 0;
    this.playStep(j.loop[0]);
    j.onIn?.();
  }

  /** Already sitting there when the place opens (no walk, no sit-down clip). */
  sitNow(world: NpcWorld, obj: SmartObject, o: { slot?: string; loop?: ClipStep[] } = {}): boolean {
    const slot = world.book.book(obj, this.id, { slot: o.slot });
    if (!slot) return false;
    const root = sitRootFor(slot, this.sit);
    this.job = { obj, slot, root, loop: o.loop?.length ? o.loop : obj.loop, secs: Infinity, t: 0, k: 0, stepT: 0 };
    this.place(root.at[0], root.at[1], slot.facing);
    this.lastClip = "";
    this.inUse();
    this.play.update(1); // straight into the seated pose
    this.sync();
    return true;
  }

  /** Leave the object now (stand up, let go of the slot). */
  leave(onOut?: () => void) {
    const j = this.job;
    if (typeof window !== "undefined" && (window as any).__world3dTrace) this.note = `leave@${this.clock.toFixed(2)} ${new Error().stack?.split("\n").slice(2, 5).join(" | ")}`;
    if (!j) { onOut?.(); return; }
    if (this.state === "exit") {
      // already on his way up: do this after the rest
      if (onOut) { const prev = j.onOut; j.onOut = () => { prev?.(); onOut(); }; }
      return;
    }
    if (onOut) { const prev = j.onOut; j.onOut = () => { prev?.(); onOut(); }; }
    this.gestureWant.drink = 0;
    const e = j.obj.exit;
    const name = e ? this.pick(e) : null;
    if (name) {
      this.state = "exit";
      const back = (e?.speed ?? 1) < 0;
      this.exitBack = back;
      this.play.play(name, { once: true, fade: back ? 0.15 : 0.25, speed: e?.speed, from: e?.from, onEnd: back ? undefined : () => this.outOf() });
      this.lastClip = name;
    } else this.outOf();
  }

  /** Out of a seat now, standing where the seat put him (a watchdog for a stand-up that never ended). */
  forceOut() { if (this.state === "exit" || this.state === "enter" || this.state === "use") this.outOf(); }

  private bookRef: SlotBook | null = null;
  private exitBack = false;
  private holdOn: number | null = null;
  private outOf() {
    const j = this.job;
    this.job = null;
    this.y = 0;
    this.state = "stand";
    this.play.loco(0, { fade: 0.35 });
    this.lastClip = "";
    this.bookRef?.release(this.id);
    j?.onOut?.();
  }

  /** Play a clip where he stands (a stretch, a wave) for `secs`, then stand. */
  act(clip: string | ClipStep, secs: number, onDone?: () => void): boolean {
    if (this.seated) return false;
    const step: ClipStep = typeof clip === "string" ? { clip } : clip;
    const name = this.pick(step);
    if (!name) { onDone?.(); return false; }
    this.walker.cancel(); this.goal = null;
    this.state = "act";
    this.actT = secs;
    this.actEnd = onDone ?? null;
    this.play.play(name, { fade: 0.35, speed: step.speed });
    this.lastClip = name;
    return true;
  }

  /** Sip from what he holds while he stands (stops when he walks, sits or acts). */
  sip(on: boolean) { this.gestureWant.drink = on ? 1 : 0; }

  /** Stop what he is doing on foot (not a seat: use leave()). */
  stop() {
    if (this.seated) return;
    this.walker.cancel(); this.goal = null;
    if (this.state !== "hidden") { this.state = "stand"; this.play.loco(0, { fade: 0.3 }); }
  }

  /** Turn on the spot towards a facing (then stand). */
  face(yaw: number, then?: () => void) {
    if (this.seated) return;
    this.walker.cancel(); this.goal = null;
    this.faceTarget = yaw; this.state = "turn"; this.afterTurn = then ?? null;
  }

  private pick(s: ClipStep): string | null {
    for (const n of [s.clip, ...(s.or ?? [])]) if (this.play.has(n)) return n;
    return null;
  }

  private playStep(s: ClipStep) {
    const name = this.pick(s);
    this.gestureWant.drink = s.gesture === "drink" ? 1 : 0;
    if (!name) return;
    if (name === this.lastClip && this.state === "use" && this.holdOn === (s.hold ?? null)) return; // the same seated clip goes on: no restart
    this.holdOn = s.hold ?? null;
    if (s.hold !== undefined) this.play.play(name, { from: s.hold, speed: 0, fade: 0.3, once: true });
    else {
      // a short seated clip held as a slow breath (it is a still moment of the capture, played to and fro)
      const slow = name === "sit_idle";
      this.play.play(name, { fade: 0.3, speed: s.speed ?? (slow ? 0.12 : 1), from: slow ? 0.3 : undefined });
      if (slow) this.play_actions(name)?.setLoop(this.T.LoopPingPong, Infinity);
    }
    this.lastClip = name;
  }
  private play_actions(name: string): THREE.AnimationAction | undefined { return (this.play as any).actions?.[name]; }

  /**
   * One frame. `animate`: this frame his body is posed (the budget may skip
   * far or off-screen people); `adt` is the time since his last pose.
   */
  update(dt: number, world: NpcWorld, animate = true, adt = dt): boolean {
    this.bookRef = world.book;
    this.clock += dt;
    if (this.state === "hidden") return false;
    // ── legs ──
    if (this.state === "walk") this.stepWalk(dt, world);
    else this.speed = Math.max(0, this.speed - dt * 4);
    if (this.state === "turn" && this.faceTarget !== null) {
      // the last few centimetres to a seat's exact spot, eased while he turns
      const jt = this.job;
      if (jt) { const k = Math.min(1, dt * 4); this.x += (jt.root.at[0] - this.x) * k; this.z += (jt.root.at[1] - this.z) * k; }
      this.yaw = turnTo(this.yawS, this.yaw, this.faceTarget, dt, 0.35);
      if (Math.abs(angDiff(this.yaw, this.faceTarget)) < 0.04) {
        this.yaw = this.faceTarget; this.faceTarget = null;
        this.state = "stand";
        const cb = this.afterTurn; this.afterTurn = null;
        cb?.();
      }
    }
    if (this.state === "stand" || this.state === "walk" || this.state === "turn") this.play.loco(this.speed);
    // ── his face's life: blinks and glances at his own times (only if he has a moving face; a few uniforms) ──
    if (animate) {
      const rig = toonFaceOf(this.person);
      if (rig) {
        const g = wanderGaze(this.clock * 0.6 * this.own.restless + this.own.phase * 40, this.faceSeed);
        rig.set({ blink: blinkAt(this.clock, this.faceSeed), gaze: g });
      }
    }
    // ── the object's loop ──
    const j = this.job;
    if (j && this.state === "use") {
      j.t += dt; j.stepT += dt;
      const s = j.loop[j.k % j.loop.length];
      if (j.stepT >= (s.secs ?? 4) && j.loop.length > 1) { j.k++; j.stepT = 0; this.playStep(j.loop[j.k % j.loop.length]); }
      if (j.t >= j.secs) this.leave();
    }
    if (this.state === "act") {
      this.actT -= dt;
      if (this.actT <= 0) { this.state = "stand"; this.play.loco(0, { fade: 0.4 }); this.lastClip = ""; const cb = this.actEnd; this.actEnd = null; cb?.(); }
    }
    // ── seat height: raised or lowered only while he goes down or comes up ──
    if (j && j.slot.seat) {
      if (this.state === "enter") this.y = j.root.y * smooth(0.25, 0.9, this.play.time() / Math.max(0.01, this.clipLen()));
      else if (this.state === "exit") {
        const p = this.play.time() / Math.max(0.01, this.clipLen());
        this.y = j.root.y * (1 - smooth(0.1, 0.75, this.exitBack ? 1 - p : p));
      }
      else if (this.state === "use") this.y = j.root.y;
    } else if (j && j.slot.lift) {
      // standing on it (a treadmill, a shower tray): stepped up while in, down as he comes out
      const want = this.state === "enter" || this.state === "use" ? j.slot.lift : 0;
      this.y += (want - this.y) * Math.min(1, dt * 10);
    }
    // standing up is the sit played backwards: done at its first frame
    if (this.state === "exit" && this.exitBack && this.play.time() <= 0.03) this.outOf();
    this.sync();
    // going in or out of a seat runs on its clip's own clock: never frozen by the budget
    if (!animate && this.state !== "enter" && this.state !== "exit") return false;
    // put back the bones the added moves turned last time: a bone the clip has no track for
    // would otherwise keep each frame's turn on top of the last (the neck wound round and round)
    this.posed.forEach((q, bone) => bone.quaternion.copy(q));
    this.posed.clear();
    this.play.update(adt);
    this.person.mixer.update(adt);
    this.gestures(adt);
    return true;
  }

  /** How far down he is (0 standing, 1 sat), from the sit clip's own time. */
  private sitAmount(): number {
    const p = this.play.time() / Math.max(0.01, this.clipLen());
    return smooth(0.45, 0.95, this.state === "exit" && this.exitBack ? p : this.state === "exit" ? 1 - p : p);
  }

  private clipLen(): number {
    const a = this.play_actions(this.lastClip);
    return a ? a.getClip().duration : 1;
  }

  private stepWalk(dt: number, world: NpcWorld) {
    const s = this.walker.step(this.x, this.z, dt);
    if (!s) {
      // the walker gave up (something in the way): find a new way, a few times
      if (this.goal && this.state === "walk" && !this.walker.active) {
        this.replanT += dt;
        if (this.replanT > 0.6) {
          this.replanT = 0;
          this.goal.tries++;
          if (this.goal.tries > 6 || !this.plan(world)) { this.note = "gave up"; const g = this.goal; this.goal = null; this.state = "stand"; if (this.job) { world.book.release(this.id); this.job = null; } void g; }
        }
      }
      this.speed = Math.max(0, this.speed - dt * 4);
      return;
    }
    // (his own pace, 12% either way: the stride clock follows the ground, so his feet keep up)
    let want = this.goal?.run ? NPC_JOG * this.own.pace : NPC_WALK * this.own.pace * Math.min(1, s.push / 0.9);
    let dirYaw = s.yaw;
    // ── people ahead: slow down and step aside ──
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    let side = 0;
    for (const b of world.bodies()) {
      if (b.id === this.id) continue;
      const dx = b.x - this.x, dz = b.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.6 || d < 1e-4) continue;
      const ahead = (dx * fx + dz * fz) / d;
      if (ahead < 0.25) continue;
      const gap = d - b.r - BODY_R;
      want = Math.min(want, NPC_WALK * this.own.pace * Math.max(0, Math.min(1, (gap - 0.05) / 0.6)));
      // which side: away from him
      side += (dx * fz - dz * fx) > 0 ? -1 : 1;
    }
    if (side) dirYaw += Math.sign(side) * 0.6;
    if (want < 0.15) {
      this.blockedT += dt;
      if (this.blockedT > 2 && this.goal) { this.blockedT = 0; this.plan(world); }
    } else this.blockedT = 0;
    this.speed += (want - this.speed) * Math.min(1, dt * 4);
    this.yaw = turnTo(this.yawS, this.yaw, side ? dirYaw : s.yaw, dt, 0.3);
    // move the way he faces (a turn eases in; he never slides sideways)
    let nx = this.x + Math.sin(this.yaw) * this.speed * dt, nz = this.z + Math.cos(this.yaw) * this.speed * dt;
    // ── never into another body ──
    for (const b of world.bodies()) {
      if (b.id === this.id) continue;
      const min = b.r + BODY_R;
      const dx = nx - b.x, dz = nz - b.z, d = Math.hypot(dx, dz);
      const was = Math.hypot(this.x - b.x, this.z - b.z);
      if (d < min && d < was) {
        const k = Math.max(d, 1e-4);
        nx = b.x + (dx / k) * Math.min(min, was);
        nz = b.z + (dz / k) * Math.min(min, was);
      }
    }
    // ── never through a wall (the last step up to a seat's front may go into its margin) ──
    const lastStep = !!this.goal && Math.hypot(this.goal.to[0] - nx, this.goal.to[1] - nz) < 0.7;
    if (lastStep || freeAt(world.grid, nx, nz) || !freeAt(world.grid, this.x, this.z)) { this.x = nx; this.z = nz; }
    else if (freeAt(world.grid, nx, this.z)) this.x = nx;
    else if (freeAt(world.grid, this.x, nz)) this.z = nz;
  }

  private sync() {
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
  }

  // ── the small added moves (after the clip, each frame he is posed) ──
  private gestures(dt: number) {
    const k = 1 - Math.exp(-dt * 3);
    this.gestureW.drink += (this.gestureWant.drink - this.gestureW.drink) * k;
    this.gestureW.look += ((this.lookAt ? 1 : 0) - this.gestureW.look) * k;
    const b = this.person.bones;
    if (this.gestureW.look > 0.01 && this.lookAt && b.Head) this.look(this.lookAt, this.gestureW.look);
    // hands come to the thighs as he settles, and go back to the clip as he gets up
    const sat = this.state === "use" ? 1 : this.state === "enter" || this.state === "exit" ? this.sitAmount() : 0;
    if (sat > 0.01) this.handsOnThighs(sat);
    if (this.gestureW.drink > 0.01 && b.RightArm && b.RightForeArm && b.RightHand && b.Head) {
      // the can comes up in a slow sip: up, a hold at the lips, down (a 4 s cycle)
      const ph = (this.clock % 4) / 4;
      const sip = ph < 0.25 ? smooth(0, 0.25, ph) : ph < 0.6 ? 1 : 1 - smooth(0.6, 0.85, ph);
      this.drink(this.gestureW.drink * (0.35 + 0.65 * sip));
    }
  }

  /**
   * Turn his head towards a point, at most 55° off his facing. The turn goes
   * on the NECK only: Style A's neck is scaled (thicker, people3d.ts), and a
   * head turned under a scaled neck shears (the skin stretched out flat).
   */
  private look(p: XZ, w: number) {
    const { v, d } = this.tmp;
    const neck = this.person.bones.neck ?? this.person.bones.Head;
    this.person.bones.Head.getWorldPosition(v);
    const want = Math.atan2(p[0] - v.x, p[1] - v.z);
    const off = Math.max(-0.95, Math.min(0.95, angDiff(this.yaw, want)));
    d.setFromAxisAngle(this.tmp.a.set(0, 1, 0), off * w);
    this.rotWorld(neck, d);
  }

  /** The right hand to just below and in front of his mouth (two-bone CCD), blended by w. */
  private drink(w: number) {
    const b = this.person.bones;
    const tv = this.tmp.b;
    b.Head.getWorldPosition(tv);
    const f = fwdOf(this.yaw);
    // 17 cm in front of the head bone, 6 cm below it: the can at the lips, the hand clear of the face
    tv.x += f[0] * 0.17; tv.z += f[1] * 0.17; tv.y -= 0.06;
    this.reach("Right", tv, w);
    // the check for the no-part-inside-another rule (RUL-3D-005): how near his hand comes to his head
    b.RightHand.getWorldPosition(this.tmp.w); b.Head.getWorldPosition(this.tmp.v);
    this.handHead = Math.min(this.handHead, this.tmp.w.distanceTo(this.tmp.v));
  }

  /**
   * Seated, his hands rest on his thighs (the capture's hands are pressed flat on the chair
   * seat, which sank them 5-8 cm into a bench: the seat check). A side the drink holds is left out.
   */
  private handsOnThighs(w: number) {
    const b = this.person.bones;
    for (const side of ["Left", "Right"] as const) {
      if (side === "Right" && this.gestureW.drink > 0.02) continue;
      const ul = b[`${side}UpLeg`], kn = b[`${side}Leg`];
      if (!ul || !kn) continue;
      const t = this.tmp.b;
      ul.getWorldPosition(this.tmp.v); kn.getWorldPosition(this.tmp.w);
      t.copy(this.tmp.v).lerp(this.tmp.w, 0.6);
      t.y += 0.11; // the wrist above the thigh's top (its bone is ~7 cm under the skin)
      this.reach(side, t, w);
    }
  }

  /** One arm's hand towards a point (two-bone CCD), blended by w over what the clip gave. */
  private reach(side: "Left" | "Right", target: THREE.Vector3, w: number) {
    const b = this.person.bones;
    const { v, w: hp, a, d } = this.tmp;
    const arm = b[`${side}Arm`], fore = b[`${side}ForeArm`], hand = b[`${side}Hand`];
    if (!arm || !fore || !hand) return;
    const q0a = arm.quaternion.clone(), q0f = fore.quaternion.clone();
    for (let it = 0; it < 4; it++) {
      for (const bone of [fore, arm]) {
        bone.getWorldPosition(v);
        hand.getWorldPosition(hp);
        a.subVectors(hp, v).normalize();
        this.tmp.c.subVectors(target, v).normalize();
        d.setFromUnitVectors(a, this.tmp.c);
        this.rotWorld(bone, d);
      }
    }
    const qa = arm.quaternion.clone(), qf = fore.quaternion.clone();
    arm.quaternion.copy(q0a).slerp(qa, w);
    fore.quaternion.copy(q0f).slerp(qf, w);
    arm.updateMatrixWorld(true);
  }
  /** The nearest his right hand came to his head bone while drinking (m; Infinity: never drank). */
  handHead = Infinity;

  /** Turn a bone by a world-space rotation. */
  private rotWorld(bone: THREE.Object3D, dWorld: THREE.Quaternion) {
    const { p, q } = this.tmp;
    if (!this.posed.has(bone)) this.posed.set(bone, bone.quaternion.clone());
    bone.parent!.getWorldQuaternion(p);
    q.copy(p).invert().multiply(dWorld).multiply(p).multiply(bone.quaternion);
    bone.quaternion.copy(q);
    bone.updateMatrixWorld(true);
  }

  /** For the debug readout and the filming checks. */
  info() {
    return { id: this.id, state: this.state, x: +this.x.toFixed(2), z: +this.z.toFixed(2), y: +this.y.toFixed(3), yaw: +this.yaw.toFixed(2), speed: +this.speed.toFixed(2), clip: this.play.current, using: this.job ? `${this.job.obj.id}#${this.job.slot.id}` : null, note: this.note, handHead: isFinite(this.handHead) ? +this.handHead.toFixed(3) : null };
  }
}
