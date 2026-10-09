/**
 * THE GARDEN'S AND THE SHOP'S LEGS — idle / walk / jog / run / sprint on one
 * mixer's actions, the gait picked by speed (three3d/gait.ts), a 0.2 s
 * crossfade, the new loop on the same foot, and each loop played at the
 * speed its own feet go (no slide). Motion: Mocap only; Motion: Old keeps
 * each scene's own walk/jog blend.
 */
import type * as THREE from "three";
import { addClips, loadMocap, type ClipInfo } from "./footballAnims";
import { withMeshopt } from "./meshopt";
import { GAIT_BLEND, STROLL_SPEEDS, gaitEdges, loopRate, pickGait, sameFootTime, type Gait, type GaitSpeeds } from "./gait";

export class GaitBlend {
  gait: Gait = "idle";
  private from: Gait | null = null;
  private fade = 0;
  private edges: [number, number, number, number];

  /**
   * `acts`: the loops (missing ones fall back to the nearest there is).
   * `info`: their measured speeds and foot plants. `size`: body ÷ capture actor.
   */
  constructor(
    private acts: Partial<Record<Gait, THREE.AnimationAction>>,
    private info: Partial<Record<Gait, ClipInfo | null | undefined>>,
    speeds: GaitSpeeds,
    private size = 1,
  ) {
    this.edges = gaitEdges(speeds);
    for (const a of Object.values(acts)) if (a) { a.play(); a.setEffectiveWeight(0); }
    acts.idle?.setEffectiveWeight(1);
  }

  private act(g: Gait | null) { return g ? this.acts[g] : undefined; }

  /** `speed` m/s on the ground; `scale` 0..1 (a gesture playing over the top takes the rest). */
  update(speed: number, dt: number, scale = 1) {
    const want = pickGait(this.gait, speed / this.size, this.edges);
    if (want !== this.gait && this.acts[want]) {
      const pa = this.act(this.gait), na = this.acts[want]!;
      const plant = (g: Gait) => (this.info[g]?.plants?.L?.[0]?.[0] as number | undefined) ?? 0;
      if (pa && this.gait !== "idle" && want !== "idle") {
        na.time = sameFootTime(pa.time, pa.getClip().duration, plant(this.gait), na.getClip().duration, plant(want));
      } else if (want !== "idle") na.time = plant(want);
      this.from = this.gait;
      this.gait = want;
      this.fade = GAIT_BLEND;
    }
    this.fade = Math.max(0, this.fade - dt);
    const k = 1 - this.fade / GAIT_BLEND;
    for (const g of Object.keys(this.acts) as Gait[]) {
      const a = this.acts[g]!;
      const w = g === this.gait ? k : g === this.from && this.fade > 0 ? 1 - k : 0;
      a.setEffectiveWeight(w * scale);
      if (g !== "idle") a.timeScale = loopRate(Math.max(speed, 0.3), this.info[g]?.speed as number | undefined, this.size, 0.45, 1.7);
    }
  }
}

/**
 * Your legs in the shop and the garden, Motion: Mocap: the capture's walk,
 * run and sprint added to the body (its own idle and jog kept), driven by
 * GaitBlend. Null under Motion: Old (each scene keeps its walk/jog blend).
 * `person`: the one body (people3d); null: the old footballer (its own mixer).
 */
export async function strideFor(
  T: typeof import("three"), person: any | null, mixer: any,
  own: { idle: any; walk: any; jog: any },
): Promise<GaitBlend | null> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const m: any = await loadMocap(loader as never, person ? "people" : "ual");
  if (!m) return null;
  const info = (n: string) => ((m.scene?.userData?.clips ?? {}) as Record<string, ClipInfo>)[n] ?? null;
  const has = (n: string) => m.animations.some((a: any) => a.name === n);
  if (!["walk", "jog", "run", "sprint"].every(has)) return null;
  let acts: Record<string, any>;
  let size = 1;
  if (person) {
    addClips(T, person, m);
    const hipsRest = person.rest.get(person.bones.Hips)?.[0].y ?? person.bones.Hips.position.y;
    const hy = m.scene?.userData?.hipsY as number | undefined;
    size = hy ? hipsRest / hy : 1;
    // the body's own jog is the capture's jog already (people3d: withMocapOwn); walk, run, sprint come in here
    acts = { idle: own.idle, walk: person.actions.walk, jog: own.jog, run: person.actions.run, sprint: person.actions.sprint };
  } else {
    const a = (n: string) => mixer.clipAction(m.animations.find((c: any) => c.name === n));
    acts = { idle: own.idle, walk: a("walk"), jog: a("jog"), run: a("run"), sprint: a("sprint") };
  }
  // the old made-up walk sits out (the capture's walk takes over)
  if (own.walk && own.walk !== acts.walk) own.walk.setEffectiveWeight(0);
  if (own.jog && own.jog !== acts.jog) own.jog.setEffectiveWeight(0);
  return new GaitBlend(acts, { walk: info("walk"), jog: info("jog"), run: info("run"), sprint: info("sprint") }, STROLL_SPEEDS, size);
}
