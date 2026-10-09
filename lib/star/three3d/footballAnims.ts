/**
 * THE FOOTBALL AND CASINO MOVES (Harry, 8 Oct 2026: "build all the animations
 * for any new 3D areas and for 3D kicking").
 *
 * Hand-made clips (tools/anims3d/build.py + clips.py), one set per 3D body:
 *   /star/anims3d/football.glb, casino.glb          the new 3D people (people3d.ts, the one body)
 *   /star/anims3d/football-ual.glb, casino-ual.glb  the old shop/garden footballer (shop3d/character.glb)
 * Same clip names in both. Only bone turns and the hips' position, so a clip
 * plays on any body of that skeleton. Packed small: loaded through withMeshopt.
 *
 * FOOTBALL (football.glb)
 *   kick_r       2.3 s  three running steps, plant, RIGHT-foot strike, follow
 *                       through, one step on, stand. ROOT MOTION: he ends
 *                       `end[1]` m (3.95) further forward. Foot meets ball at
 *                       `contact` (1.26 s); the ball sits at `ball` [x, z]
 *                       from where he started (his frame: x = his left, z = forward).
 *   kick_l       2.3 s  the same, left foot (a mirror).
 *   celebrate_fist 2.0 s arms flung up, a hop, two right-fist pumps, stands.
 *   frustrated   2.2 s  hands on head, head back, half a step back, drops them.
 *   juggle       1.2 s  loop: keepy-uppies, right then left; `touches` = [time, foot, ball point].
 *   pass         1.6 s  loop: right side-foot pass at `contact` (0.55), trap under the sole at `trap` (1.3).
 *   stretch      6.0 s  loop: quad stretch right, then left, holding the ankle.
 *   cone_dribble 1.2 s  loop: low weaving touches (in place: move him yourself); `touches`.
 *   Jogging: use the body's own "jog" (people3d) / "Jog_Fwd_Loop" (old footballer).
 *
 *   The 3D training drills' moves (play3d/scene.ts picks them). All in place
 *   (the game moves him). `contact` = when the ball is met, `part` = what meets
 *   it, `contactPoint` [x, y, z] = where that part is then (measured, his frame).
 *   sprint        0.62 s loop  real sprint cycle (`speed` 7.4 m/s at timeScale 1)
 *   dribble_run   0.70 s loop  running with the ball, right-foot touch each stride (`touches`, `speed` 4.6)
 *   header_stand  1.1 s  jump, arch, neck snap at contact (0.50), land
 *   header_diving 1.3 s  launch flat out, head at contact (0.40) ~1.2 m up, land on the chest; body ends 0.8 m on
 *   volley        1.15 s side-on, right foot at contact (0.45) ~0.8 m up
 *   first_touch   0.85 s cushion with the right foot (0.32)
 *   chest_control 1.0 s  lean back, chest out (0.38), drop it
 *   thigh_control 0.9 s  right thigh up (0.30), kill it
 *   pass_lofted   1.15 s laces under it (0.50), follow through high
 *   shot_r        1.35 s the kick's plant and strike without the run-up (0.31); ball 0.45 m ahead
 *   poke_tackle   0.75 s lunge, toe at the ball (0.26)
 *   sliding_tackle 1.5 s down on the left hip, right leg along the grass (0.40), up again; body ends 0.95 m on
 *   ready_shuffle 1.0 s loop  keeper's set position, little steps
 *   dive_left / dive_right 1.5 s  keeper's dive: `launch` 0.12, full stretch at contact 0.42, `land` 0.70, lies
 *   high_claim    1.2 s  keeper takes off, both hands at contact (0.46) ~2.3 m, into the chest
 *   throw_out     1.3 s  keeper's overarm throw, `release` 0.72 (0–0.2: holding it at the chest)
 *   celebrate_safe 0.70 s loop  jogging off with both arms up (`speed` 3.4)
 *   slump_walk    1.25 s loop  head-down walk off (`speed` 1.15)
 *
 * CASINO (casino.glb). Table/bar top ≈ 0.97–1.02 m, ~0.35–0.5 m in front of his feet.
 *   dealer_idle    4.0 s loop  croupier, hands on the table edge, looking round
 *   dealer_deal    1.0 s loop  left hand holds the deck, right flicks a card out at `flick` (0.45)
 *   dealer_spin    1.6 s       reaches right to the wheel, sweeps it round (`release` 0.65)
 *   lean_table     4.0 s loop  leaning on his forearms on a table
 *   slot_sit       4.0 s loop  sat on a stool (seat `seatY` 0.70 m), hands by the buttons
 *   slot_pull      1.4 s       from slot_sit: lever on his right (top ≈ x −0.40, y 1.22, z 0.32), pulled at `pulled` (0.75)
 *   cheer_win      1.2 s loop  fists up, bouncing
 *   groan_loss     2.4 s       hand to forehead, other on hip, slumped, back to standing
 *   bartender_idle 4.0 s loop  wiping the bar in circles
 *
 * Using them:
 *   const g = await loadAnims3d(loader, "football");               // people3d bodies
 *   addClips(T, person, g);                                          // person.actions.kick_r … now exist
 *   const play = new ClipPlayer(T, person.mixer, person.actions);    // optional: crossfades + one-shots
 *   play.play("kick_r", { once: true, onEnd: () => … });
 *   clipInfo(g, "kick_r") → { contact, ball, end, … }  (measured off the solved body)
 * The old footballer (shop/garden): loadAnims3d(loader, "football", "ual"), then
 * mixer.clipAction(clip) for each of gltf.animations, as shop3d/scene.ts does.
 */
import { relaxIdleArms, IDLE_POSTURE_CLIPS, levelToonLean, TOON_LEAN_MAX } from "./runPosture";
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGltfCached } from "./perf";
import { FadeWeights, LocoPhase, locoWeights, type LocoLoop } from "./animBlend";
import { footMark } from "./locomotion";
import { withMeshopt } from "./meshopt";
import type { Person3D } from "../people3d";
import { motionLook } from "../motionLook";

type Three = typeof import("three");

export const ANIMS3D_FILES = {
  football: { people: "/star/anims3d/football.glb", ual: "/star/anims3d/football-ual.glb" },
  casino: { people: "/star/anims3d/casino.glb", ual: "/star/anims3d/casino-ual.glb" },
} as const;

export type Anims3dSet = keyof typeof ANIMS3D_FILES;
export type Anims3dBody = "people" | "ual";

export interface ClipInfo {
  duration: number;
  loop: boolean;
  /** When the foot meets the ball (s). */
  contact?: number;
  trap?: number;
  foot?: "L" | "R";
  /** Where the ball sits at contact: [x, z] metres from where he started, his frame (x = his left). */
  ball?: [number, number];
  /** Root motion: where he ends, [x, z] metres, his frame. */
  end?: [number, number];
  /** What meets the ball at `contact`: "foot", "head", "chest", "thighR", "hands", "handR". */
  part?: string;
  /** Where that part is at `contact`: [x, y, z] metres, his frame, from his feet. */
  contactPoint?: [number, number, number];
  /** A loop's own running speed (m/s) at timeScale 1. */
  speed?: number;
  /** Juggling / dribbling touches: [time s, foot, ball point [x, y, z] his frame]. */
  touches?: [number, "L" | "R", [number, number, number]][];
  /** Mocap clips: when each foot is planted, [from, to] seconds (contact markers, measured off the capture). */
  plants?: { L: [number, number][]; R: [number, number][] };
  /** Mocap clips: which CMU capture it is ("CMU 11_01", "(mirrored)", and what was adapted). */
  source?: string;
  /** Keyed keeper dives (tools/mocap3d/keyed.py): he gets back up inside the clip, from this second on. */
  getUp?: number;
  /** Mocap loops: the travel taken out, m/s in his frame (x = his left, z = forward). */
  travel?: [number, number];
  [k: string]: unknown;
}

/**
 * Is that foot planted `t` seconds into the clip (looping clips wrap)? For a
 * runtime ground lock: while it is, keep that foot where it first landed
 * (two-bone IK on thigh + shin) and it can never slide or float, on any body.
 */
export function plantedAt(info: ClipInfo | null | undefined, foot: "L" | "R", t: number): boolean {
  const runs = info?.plants?.[foot];
  if (!runs?.length) return false;
  const tt = info!.loop && info!.duration > 0 ? ((t % info!.duration) + info!.duration) % info!.duration : t;
  return runs.some(([a, b]) => tt >= a && tt <= b);
}

/**
 * A body taller or shorter than the one the clips were cut for: addClips /
 * makePerson3d already scale the hips' motion by k = this body's hips height
 * over the clips' (so a longer leg takes a longer stride). Everything measured
 * in metres must be scaled by the same k: where the ball sits, the contact
 * point, the root motion, a loop's speed. Times stay as they are.
 */
export function scaleInfo(info: ClipInfo, k: number): ClipInfo {
  const s2 = (v?: [number, number]) => (v ? ([v[0] * k, v[1] * k] as [number, number]) : v);
  const s3 = (v?: [number, number, number]) => (v ? ([v[0] * k, v[1] * k, v[2] * k] as [number, number, number]) : v);
  return {
    ...info,
    ball: s2(info.ball), end: s2(info.end), travel: s2(info.travel), contactPoint: s3(info.contactPoint),
    speed: info.speed === undefined ? undefined : info.speed * k,
    touches: info.touches?.map(([t, f, p]) => [t, f, s3(p)!] as [number, "L" | "R", [number, number, number]]),
  };
}

/** If the file can't say (it always should), the numbers it was built with. */
export const KICK_FALLBACK: ClipInfo = { duration: 2.3, loop: false, contact: 1.26, foot: "R", ball: [-0.187, 3.453], end: [0, 3.95] };

/**
 * THE MOTION-CAPTURE CLIPS (Settings → Look → "Motion: Mocap | Old",
 * lib/star/motionLook.ts). Real human motion capture (CMU Graphics Lab
 * database) put onto the same two skeletons by tools/mocap3d/build.py.
 * Same clip names as above, plus new ones (walk, run, turn_l/_r,
 * side_step_l/_r, shuffle_l/_r, shot_low, chip, pass_inside, celebrate_jump,
 * celebrate_airplane, dejected, handshake, wave, applause, shirt_hold).
 * Its clips go in over the old ones by name; anything it does not have stays
 * the old hand-made clip. scene extras clips[name].source names the capture.
 */
export const MOCAP_FILES = { people: "/star/anims3d/mocap.glb", ual: "/star/anims3d/mocap-ual.glb" } as const;

type Loader = { loadAsync(url: string): Promise<unknown>; setMeshoptDecoder(d: never): unknown };

/**
 * `base` with `extra`'s clips in over it by name (only those `keep` allows),
 * the measured moments (scene extras "clips") merged the same way. Both files
 * must be cut for the same skeleton (same hipsY). Neither input is changed.
 */
export function mergeClips(base: GLTF, extra: GLTF | null, keep: (name: string) => boolean = () => true): GLTF {
  if (!extra) return base;
  const take = extra.animations.filter((a) => keep(a.name));
  if (!take.length) return base;
  const names = new Set(take.map((a) => a.name));
  const bu = (base.scene?.userData ?? {}) as { clips?: Record<string, ClipInfo> };
  const eu = (extra.scene?.userData ?? {}) as { clips?: Record<string, ClipInfo> };
  const clips = { ...(bu.clips ?? {}) };
  names.forEach((n) => { if (eu.clips?.[n]) clips[n] = eu.clips[n]; });
  const scene = Object.assign(Object.create(base.scene), { userData: { ...bu, clips } });
  return { ...base, animations: [...base.animations.filter((a) => !names.has(a.name)), ...take], scene } as GLTF;
}

const mocapCache = new Map<string, Promise<GLTF | null>>();
/** The motion-capture clips for a body, or null (Motion: Old, or the file failed: the old clips play). */
export async function loadMocap(loader: Loader, body: Anims3dBody = "people"): Promise<GLTF | null> {
  if (motionLook() !== "mocap") return null;
  await withMeshopt(loader as never);
  const url = MOCAP_FILES[body];
  let p = mocapCache.get(url);
  if (!p) {
    p = loadGltfCached<GLTF>(loader, url)
      .then(async (g) => {
        if (body === "people") levelMocapHeads(g);
        // the running neck: upright neck, lowered shoulders on the moving loops (runPosture.ts)
        const [T, rp] = await Promise.all([import("three"), import("./runPosture")]);
        try { rp.uprightRunPosture(T, g as never, body === "people" ? rp.PEOPLE_POSTURE : rp.UAL_POSTURE); } catch (e) { console.error("run posture", e); }
        return g;
      })
      .catch((e) => { console.error("mocap clips failed to load; the old clips play", e); mocapCache.delete(url); return null; });
    mocapCache.set(url, p);
  }
  return p;
}

/**
 * THE BENT NECK (Harry, 9 Oct 2026: "his neck is bent"). The capture actors
 * stood and ran with the head held to one side: over the whole mocap idle the
 * neck sits tilted 13° sideways and turned 10°, and the head turned another
 * 14° on top (walk and jog: 4–12° the same way). Put on our body, that reads
 * as a crooked neck in every still. For the standing and moving clips, each
 * neck and head track keeps its motion and its forward/back pitch, but its
 * average sideways tilt and turn are taken out, so on average he looks
 * straight ahead. Done once per loaded file (the clips are shared).
 */
export const LEVEL_HEAD_CLIPS = new Set(["idle", "walk", "jog", "run", "sprint", "dribble_run", "walk_confident"]);
const LEVEL_HEAD_BONES = ["neck", "Head"];
const leveled = new WeakSet<object>();
export function levelMocapHeads(g: GLTF): void {
  for (const clip of g.animations ?? []) {
    if (!LEVEL_HEAD_CLIPS.has(clip.name) || leveled.has(clip)) continue;
    leveled.add(clip);
    for (const tr of clip.tracks) {
      const bone = tr.name.slice(0, tr.name.lastIndexOf("."));
      if (!tr.name.endsWith(".quaternion") || !LEVEL_HEAD_BONES.includes(bone)) continue;
      tr.values = levelQuatTrack(tr.values as Float32Array) as never;
    }
  }
}
/** Pre-multiply every key so the track's average turn has no yaw or roll (its pitch kept). Pure: returns new values. */
export function levelQuatTrack(v: ArrayLike<number>): Float32Array {
  const n = v.length / 4;
  const out = Float32Array.from(v as ArrayLike<number>);
  if (!n) return out;
  let mx = 0, my = 0, mz = 0, mw = 0;
  for (let i = 0; i < n; i++) {
    const s = v[i * 4 + 3] < 0 ? -1 : 1;
    mx += v[i * 4] * s; my += v[i * 4 + 1] * s; mz += v[i * 4 + 2] * s; mw += v[i * 4 + 3] * s;
  }
  const L = Math.hypot(mx, my, mz, mw) || 1;
  mx /= L; my /= L; mz /= L; mw /= L;
  // the average's pitch (rotation about x, XYZ order), the only part kept
  const pitch = Math.atan2(2 * (mw * mx + my * mz), 1 - 2 * (mx * mx + my * my));
  const tx = Math.sin(pitch / 2), tw = Math.cos(pitch / 2);
  // c = target * inverse(mean)
  const [ix, iy, iz, iw] = [-mx, -my, -mz, mw];
  const cx = tw * ix + tx * iw, cy = tw * iy - tx * iz, cz = tw * iz + tx * iy, cw = tw * iw - tx * ix;
  for (let i = 0; i < n; i++) {
    const qx = v[i * 4], qy = v[i * 4 + 1], qz = v[i * 4 + 2], qw = v[i * 4 + 3];
    out[i * 4] = cw * qx + cx * qw + cy * qz - cz * qy;
    out[i * 4 + 1] = cw * qy - cx * qz + cy * qw + cz * qx;
    out[i * 4 + 2] = cw * qz + cx * qy - cy * qx + cz * qw;
    out[i * 4 + 3] = cw * qw - cx * qx - cy * qy - cz * qz;
  }
  return out;
}

/** The bodies' own clips that the mocap set replaces (people3d anims.glb / shop3d anims.glb). */
export const MOCAP_PEOPLE_OWN = new Set(["idle", "jog"]);
export const MOCAP_UAL_OWN = new Set(["Idle_Loop", "Jog_Fwd_Loop", "Walk_Loop"]);

/** A body's own clip file (people3d anims.glb or shop3d anims.glb) with the mocap idle/jog/walk in, when Motion is Mocap. */
export async function withMocapOwn(loader: Loader, own: GLTF, body: Anims3dBody = "people"): Promise<GLTF> {
  const m = await loadMocap(loader, body).catch((e) => { console.error("mocap clips", e); return null; });
  return mergeClips(own, m, (n) => (body === "people" ? MOCAP_PEOPLE_OWN : MOCAP_UAL_OWN).has(n));
}

/** Load (once per page) a clip set for a body. The football set comes with the mocap clips in when Motion is Mocap. */
export async function loadAnims3d(
  loader: Loader,
  set: Anims3dSet, body: Anims3dBody = "people",
): Promise<GLTF> {
  await withMeshopt(loader as never);
  const base = await loadGltfCached<GLTF>(loader, ANIMS3D_FILES[set][body]);
  if (set !== "football") return base;
  const m = await loadMocap(loader, body).catch((e) => { console.error("mocap clips", e); return null; });
  if (!m) return base;
  const key = `${body}`;
  let merged = mergedCache.get(key);
  if (!merged || merged.base !== base || merged.extra !== m) {
    merged = { base, extra: m, out: mergeClips(base, m, (n) => !MOCAP_UAL_OWN.has(n)) };
    mergedCache.set(key, merged);
  }
  return merged.out;
}
const mergedCache = new Map<string, { base: GLTF; extra: GLTF; out: GLTF }>();

/** The measured moments of one clip (contact, ball spot, root motion, touches). */
export function clipInfo(g: GLTF | null | undefined, name: string): ClipInfo | null {
  const all = (g?.scene?.userData as { clips?: Record<string, ClipInfo> } | undefined)?.clips;
  const c = all?.[name];
  if (c) return c;
  if (name === "kick_r") return KICK_FALLBACK;
  if (name === "kick_l") return { ...KICK_FALLBACK, foot: "L", ball: [-KICK_FALLBACK.ball![0], KICK_FALLBACK.ball![1]] };
  return null;
}

/**
 * Give a people3d person these clips (as makePerson3d does with its own: the
 * hips' height brought to this body's). Adds to person.actions; returns the names.
 * A name the body already has (its own "idle", "jog", "celebrate" …) is kept as it was.
 */
export function addClips(T: Three, p: Person3D, g: GLTF): string[] {
  const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
  const k = hipsRest / ((g.scene.userData as { hipsY?: number }).hipsY || hipsRest);
  const names: string[] = [];
  for (const clip of g.animations) {
    if (p.actions[clip.name]) { names.push(clip.name); continue; }
    const c = clip.clone();
    // Style A: a standing idle gets the relaxed arms (three3d/runPosture.ts)
    if (p.toon && IDLE_POSTURE_CLIPS.has(clip.name)) relaxIdleArms(T, p.root, p.bones, c, { L: p.hand.L.palm, R: p.hand.R.palm });
    // Style A: the run and sprint no longer hunch on the shorter torso (runPosture.ts levelToonLean)
    if (p.toon && TOON_LEAN_MAX[clip.name] !== undefined) levelToonLean(T, p.root, p.bones, c, TOON_LEAN_MAX[clip.name]);
    for (const tr of c.tracks) {
      if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
    }
    const a = p.mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(0);
    p.actions[clip.name] = a;
    names.push(clip.name);
  }
  return names;
}

/** One moving loop for ClipPlayer.loco: its name and its own ground speed at this body's size (m/s at timeScale 1). */
export interface LocoSpec { name: string; speed: number }

type Act = THREE.AnimationAction;
const LOCO = "@loco" as const;
type Key = Act | typeof LOCO;

/**
 * Plays clips on a mixer's actions, one in charge at a time, with crossfades
 * that never pop (Harry, 9 Oct 2026: "the animations are a bit wild and
 * rough"). Call update(dt) BEFORE mixer.update(dt).
 *
 *  - Every change fades from the pose he is in now, however many changes come
 *    inside one fade (animBlend.ts FadeWeights); no clip drops out in one frame.
 *  - A clip asked for again while it still shows (a second kick straight after
 *    the first) gets a twin, so the one still fading out keeps its own frame
 *    instead of jumping back to the start.
 *  - loco(speed): walk / jog / run / sprint (and the idle) mixed by his real
 *    speed on one stride clock, each loop from its own left-foot moment, the
 *    clock at ground speed ÷ the mixed stride: no flicker, no foot slide, the
 *    same foot down through every change. Set the loops once with setLoco.
 *
 * `actions[name]` always points at the action now in charge of that clip, so
 * scenes that set `actions[name].time` or `.timeScale` keep working.
 */
export class ClipPlayer {
  current: string | null = null;
  private fw = new FadeWeights<Key>();
  private onEnd: (() => void) | null = null;
  private once = false;
  /** Every action this player has shown and not yet zeroed. */
  private shown = new Set<Act>();
  /** name → its copies (the original first). */
  private copies = new Map<string, Act[]>();
  // locomotion
  private locoSpecs: LocoSpec[] = [];
  private locoIdle: string | null = null;
  private members: { a: Act; loop: LocoLoop }[] = [];
  private idleAct: Act | null = null;
  private phase = new LocoPhase();
  private locoW: number[] = [];
  private locoIdleW = 1;
  private locoSpeed = 0;
  private locoRate = 0;
  private locoTop: number | undefined;

  constructor(private T: Three, private actions: Record<string, THREE.AnimationAction>) {
    // as before: every action starts held at 0 (only the clips this player shows get a weight)
    for (const [n, a] of Object.entries(actions)) { this.copies.set(n, [a]); a.setEffectiveWeight(0); }
  }

  has(name: string) { return !!this.actions[name]; }

  /** Is this action on screen at all just now? */
  private visible(a: Act): boolean {
    if (this.fw.get(a) > 0) return true;
    if (this.fw.get(LOCO) > 0) return this.members.some((m) => m.a === a) || this.idleAct === a;
    return false;
  }

  /** The action for `name` that is free to restart (a twin if the one in charge still shows). */
  private free(name: string): Act {
    const a = this.actions[name];
    if (!this.visible(a)) return a;
    let list = this.copies.get(name);
    if (!list) { list = [a]; this.copies.set(name, list); }
    let pick = list.find((c) => !this.visible(c));
    if (!pick && list.length < 3) {
      const clip = a.getClip();
      const c2 = new this.T.AnimationClip(clip.name, clip.duration, clip.tracks, clip.blendMode);
      pick = a.getMixer().clipAction(c2, a.getRoot());
      pick.play();
      pick.setEffectiveWeight(0);
      list.push(pick);
    }
    // every copy still shows: take the faintest
    if (!pick) pick = list.reduce((b, c) => (this.fw.get(c) < this.fw.get(b) ? c : b));
    this.actions[name] = pick;
    return pick;
  }

  play(name: string, o: { fade?: number; once?: boolean; onEnd?: () => void; from?: number; speed?: number } = {}) {
    if (!this.actions[name]) return false;
    const cur = this.actions[name];
    // the same loop again, already in charge and no new start point: keep it going
    if (this.current === name && (this.fw.current as unknown) === cur && !o.once && o.from === undefined && cur.loop === this.T.LoopRepeat) {
      cur.timeScale = o.speed ?? 1;
      this.onEnd = o.onEnd ?? null;
      return true;
    }
    const a = this.free(name);
    this.current = name;
    this.once = !!o.once;
    this.onEnd = o.onEnd ?? null;
    a.enabled = true;
    a.setLoop(o.once ? this.T.LoopOnce : this.T.LoopRepeat, Infinity);
    a.clampWhenFinished = true;
    a.paused = false;
    a.timeScale = o.speed ?? 1;
    a.time = o.from ?? 0;
    a.play();
    this.fw.to(a, o.fade ?? 0.2);
    this.shown.add(a);
    this.update(0);
    return true;
  }

  /** Seconds into the current clip. */
  time() {
    if (this.current === "loco") return this.members[0] ? this.members[0].a.time : 0;
    return this.current ? this.actions[this.current].time : 0;
  }

  /**
   * The loops loco() mixes (speeds at this body's size) and the standing clip
   * it fades to at a stop. Loops the body lacks are skipped.
   */
  setLoco(loops: LocoSpec[], idle: string | null = "idle") {
    this.locoSpecs = loops.filter((l) => this.actions[l.name] && l.speed > 0).sort((x, y) => x.speed - y.speed);
    this.locoIdle = idle && this.actions[idle] ? idle : null;
    this.members = [];
  }
  /** The loops loco() mixes, slowest first (for a `top` index). */
  locoNames() { return this.locoSpecs.map((s) => s.name); }

  /**
   * Walk / jog / run / sprint by ground speed (m/s), mixed, on one stride clock.
   * `top`: the fastest loop allowed (index into locoNames(); e.g. no sprint
   * loop unless sprinting). `fade`: how quickly loco takes over from a one-off.
   */
  loco(speed: number, o: { fade?: number; top?: number } = {}) {
    if (!this.locoSpecs.length) return false;
    this.locoSpeed = speed;
    this.locoTop = o.top;
    if (this.fw.current === LOCO) return true;
    if (!this.fw.has(LOCO)) {
      // take the loops as they are now; a loop playing on its own hands its stride over
      const fc = this.fw.current as Key | null;
      const curA: Act | null = fc && fc !== LOCO ? fc : null;
      this.members = [];
      let synced = false;
      for (const s of this.locoSpecs) {
        let a = this.actions[s.name];
        const mine = a === curA;
        if (!mine && this.visible(a)) a = this.free(s.name);
        const mark = footMark(this.T, a.getClip(), a.getRoot() as THREE.Object3D) ?? 0;
        const loop: LocoLoop = { speed: s.speed, dur: a.getClip().duration, mark };
        this.members.push({ a, loop });
        if (mine && curA) { this.phase.syncTo(loop, curA.time); synced = true; }
      }
      if (!synced) this.phase.phase = 0;
      this.idleAct = null;
      if (this.locoIdle) {
        let ia = this.actions[this.locoIdle];
        if (ia !== curA && this.visible(ia)) ia = this.free(this.locoIdle);
        this.idleAct = ia;
      }
      for (const m of this.members) {
        if (m.a !== curA) m.a.time = this.phase.timeOf(m.loop);
        m.a.enabled = true; m.a.setLoop(this.T.LoopRepeat, Infinity); m.a.paused = false; m.a.play(); this.shown.add(m.a);
      }
      if (this.idleAct) {
        const ia = this.idleAct;
        if (ia !== curA) { ia.time = 0; ia.setLoop(this.T.LoopRepeat, Infinity); }
        ia.timeScale = 1; ia.enabled = true; ia.paused = false; ia.play(); this.shown.add(ia);
      }
      // the mix starts where his speed already is
      const lw = locoWeights(speed, this.members.map((m) => m.loop), o.top);
      this.locoW = lw.w; this.locoIdleW = this.idleAct ? lw.idle : 0;
      // the loop he was on hands its weight straight to loco (no dip)
      if (curA && (this.members.some((m) => m.a === curA) || curA === this.idleAct)) this.fw.rekey(curA, LOCO);
    }
    this.current = "loco";
    this.once = false;
    this.onEnd = null;
    this.fw.to(LOCO, o.fade ?? 0.2);
    this.update(0);
    return true;
  }

  update(dt: number) {
    const gone = this.fw.step(dt);
    for (const k of gone) if (k !== LOCO) k.setEffectiveWeight(0);
    const wl = this.fw.get(LOCO);
    const weights = new Map<Act, number>();
    if (wl > 0 && this.members.length) {
      // the mix follows his speed smoothly; the stride clock follows the ground
      const target = locoWeights(this.locoSpeed, this.members.map((m) => m.loop), this.locoTop);
      const k = dt > 0 ? 1 - Math.exp(-dt / LOCO_MIX_TAU) : 0;
      for (let i = 0; i < this.members.length; i++) this.locoW[i] = (this.locoW[i] ?? 0) + (target.w[i] - (this.locoW[i] ?? 0)) * k;
      if (this.idleAct) this.locoIdleW += (target.idle - this.locoIdleW) * k;
      else { const s = this.locoW.reduce((x, y) => x + y, 0); if (s > 0) this.locoW = this.locoW.map((x) => x / s); this.locoIdleW = 0; }
      const loops = this.members.map((m) => m.loop);
      const rate = this.phase.step(dt, this.locoSpeed, loops, this.locoW);
      if (rate > 0) this.locoRate = rate;
      for (let i = 0; i < this.members.length; i++) {
        const m = this.members[i];
        m.a.time = this.phase.timeOf(m.loop);
        m.a.timeScale = 0;
        weights.set(m.a, (weights.get(m.a) ?? 0) + wl * this.locoW[i]);
      }
      if (this.idleAct) weights.set(this.idleAct, (weights.get(this.idleAct) ?? 0) + wl * this.locoIdleW);
    } else if (this.members.length && !this.fw.has(LOCO)) {
      // loco has gone: its loops run on at their last stride rate while they fade (never frozen mid-stride)
      for (const m of this.members) if (m.a.timeScale === 0) m.a.timeScale = Math.max(0.3, this.locoRate * m.loop.dur);
      this.members = [];
    }
    for (const [k, w] of this.fw.entries()) if (k !== LOCO) weights.set(k, (weights.get(k) ?? 0) + w);
    this.shown.forEach((a) => {
      if (!weights.has(a)) { a.setEffectiveWeight(0); this.shown.delete(a); }
    });
    weights.forEach((w, a) => { a.setEffectiveWeight(w); this.shown.add(a); });
    if (this.current && this.current !== "loco" && this.once && this.onEnd) {
      const a = this.actions[this.current];
      if (a.time + dt >= a.getClip().duration - 1e-3) { const f = this.onEnd; this.onEnd = null; f(); }
    }
  }
}

/** How quickly the walk/jog/run/sprint mix follows a change of speed, s. */
export const LOCO_MIX_TAU = 0.09;
