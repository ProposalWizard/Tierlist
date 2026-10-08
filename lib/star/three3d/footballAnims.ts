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
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGltfCached } from "./perf";
import { withMeshopt } from "./meshopt";
import type { Person3D } from "../people3d";

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
  /** Juggling / dribbling touches: [time s, foot, ball point [x, y, z] his frame]. */
  touches?: [number, "L" | "R", [number, number, number]][];
  [k: string]: unknown;
}

/** If the file can't say (it always should), the numbers it was built with. */
export const KICK_FALLBACK: ClipInfo = { duration: 2.3, loop: false, contact: 1.26, foot: "R", ball: [-0.187, 3.453], end: [0, 3.95] };

/** Load (once per page) a clip set for a body. */
export async function loadAnims3d(
  loader: { loadAsync(url: string): Promise<unknown>; setMeshoptDecoder(d: never): unknown },
  set: Anims3dSet, body: Anims3dBody = "people",
): Promise<GLTF> {
  await withMeshopt(loader as never);
  return loadGltfCached<GLTF>(loader, ANIMS3D_FILES[set][body]);
}

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
    for (const tr of c.tracks) {
      if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
    }
    const a = p.mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(0);
    p.actions[clip.name] = a;
    names.push(clip.name);
  }
  void T;
  return names;
}

/**
 * Plays one clip at a time on a mixer's actions with a short crossfade.
 * Every other action is held at weight 0. Call update(dt) BEFORE mixer.update(dt).
 */
export class ClipPlayer {
  current: string | null = null;
  private from: string | null = null;
  private fade = 0;
  private fadeLen = 0;
  private onEnd: (() => void) | null = null;
  private once = false;

  constructor(private T: Three, private actions: Record<string, THREE.AnimationAction>) {}

  has(name: string) { return !!this.actions[name]; }

  play(name: string, o: { fade?: number; once?: boolean; onEnd?: () => void; from?: number; speed?: number } = {}) {
    const a = this.actions[name];
    if (!a) return false;
    if (this.current && this.current !== name) { this.from = this.current; this.fadeLen = this.fade = o.fade ?? 0.2; }
    else { this.from = null; this.fade = this.fadeLen = 0; }
    this.current = name;
    this.once = !!o.once;
    this.onEnd = o.onEnd ?? null;
    a.reset();
    a.setLoop(o.once ? this.T.LoopOnce : this.T.LoopRepeat, Infinity);
    a.clampWhenFinished = true;
    a.timeScale = o.speed ?? 1;
    a.time = o.from ?? 0;
    a.play();
    this.update(0);
    return true;
  }

  /** Seconds into the current clip. */
  time() { return this.current ? this.actions[this.current].time : 0; }

  update(dt: number) {
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt);
    const k = this.fadeLen > 0 ? 1 - this.fade / this.fadeLen : 1;
    for (const [n, a] of Object.entries(this.actions)) {
      a.setEffectiveWeight(n === this.current ? k : n === this.from && this.fade > 0 ? 1 - k : 0);
    }
    if (this.current && this.once && this.onEnd) {
      const a = this.actions[this.current];
      if (a.time + dt >= a.getClip().duration - 1e-3) { const f = this.onEnd; this.onEnd = null; f(); }
    }
  }
}
