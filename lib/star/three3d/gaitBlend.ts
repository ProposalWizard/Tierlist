/**
 * THE GARDEN'S, SHOP'S AND HOUSE'S LEGS — idle / walk / jog / run / sprint on
 * one mixer's actions, mixed by his real speed on one stride clock
 * (three3d/animBlend.ts): the two loops either side of his speed share the
 * weight, every loop has the same foot down, and the clock runs at ground
 * speed ÷ the mixed stride, so the feet never slide and nothing flickers
 * (9 Oct 2026, "clean animations in every mode"). Motion: Mocap only; Motion: Old keeps
 * each scene's own walk/jog blend.
 */
import type * as THREE from "three";
import { addClips, loadMocap, type ClipInfo } from "./footballAnims";
import { withMeshopt } from "./meshopt";
import { STROLL_SPEEDS, type Gait, type GaitSpeeds } from "./gait";
import { LocoPhase, locoWeights, type LocoLoop } from "./animBlend";
import { footMark } from "./locomotion";
import { LOCO_MIX_TAU } from "./footballAnims";

export class GaitBlend {
  /** The loop with the most weight just now (for anything that wants a name). */
  gait: Gait = "idle";
  private loops: { g: Gait; a: THREE.AnimationAction; loop: LocoLoop }[] = [];
  private phase = new LocoPhase();
  private w: number[] = [];
  private idleW = 1;
  private T: typeof import("three") | null = null;

  /**
   * `acts`: the loops (missing ones are skipped). `info`: their measured
   * speeds. `size`: body ÷ capture actor. `T` (three) lets each loop's
   * left-foot moment be measured; without it the capture's plant marks are used.
   */
  constructor(
    private acts: Partial<Record<Gait, THREE.AnimationAction>>,
    private info: Partial<Record<Gait, ClipInfo | null | undefined>>,
    speeds: GaitSpeeds,
    private size = 1,
    T?: typeof import("three"),
  ) {
    void speeds;
    this.T = T ?? null;
    for (const a of Object.values(acts)) if (a) { a.play(); a.setEffectiveWeight(0); }
    acts.idle?.setEffectiveWeight(1);
    for (const g of ["walk", "jog", "run", "sprint"] as Gait[]) {
      const a = acts[g], sp = info[g]?.speed as number | undefined;
      if (!a || !sp) continue;
      const measured = this.T ? footMark(this.T, a.getClip(), a.getRoot() as THREE.Object3D) : null;
      const mark = measured ?? ((info[g]?.plants?.L?.[0]?.[0] as number | undefined) ?? 0);
      this.loops.push({ g, a, loop: { speed: sp * size, dur: a.getClip().duration, mark } });
    }
    this.loops.sort((x, y) => x.loop.speed - y.loop.speed);
    this.w = this.loops.map(() => 0);
  }

  /** `speed` m/s on the ground; `scale` 0..1 (a gesture playing over the top takes the rest). */
  update(speed: number, dt: number, scale = 1) {
    const L = this.loops.map((l) => l.loop);
    const target = locoWeights(speed, L);
    const k = dt > 0 ? 1 - Math.exp(-dt / LOCO_MIX_TAU) : 1;
    for (let i = 0; i < L.length; i++) this.w[i] += (target.w[i] - this.w[i]) * k;
    this.idleW += (target.idle - this.idleW) * k;
    const rate = this.phase.step(dt, speed, L, this.w);
    let best = this.idleW, bestG: Gait = "idle";
    for (let i = 0; i < this.loops.length; i++) {
      const l = this.loops[i];
      l.a.time = this.phase.timeOf(l.loop);
      l.a.timeScale = 0;
      l.a.setEffectiveWeight(this.w[i] * scale);
      if (this.w[i] > best) { best = this.w[i]; bestG = l.g; }
    }
    if (this.acts.idle) this.acts.idle.setEffectiveWeight(this.idleW * scale);
    this.gait = bestG;
    void rate; void this.size;
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
  return new GaitBlend(acts, { walk: info("walk"), jog: info("jog"), run: info("run"), sprint: info("sprint") }, STROLL_SPEEDS, size, T);
}
