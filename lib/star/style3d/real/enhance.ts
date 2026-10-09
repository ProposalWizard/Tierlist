/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H FOR A SCENE THAT BUILDS ITS OWN WORLD (the garden, the 3D shop):
 * the scene keeps its models, and look H adds
 *   - light from a real sky (image-based, from the HDR files), outdoors only
 *   - the broadcast pass: real bloom, ACES with an S-curve, a gentle split
 *     tone, sharpening (High) or FXAA (Medium), vignette, fine grain
 *   - (9 Oct 2026) the set's baked light (lib/star/look/bakedLight.ts: the
 *     garden's open-sky shade, wall and tree shadows and bounce; the shop's
 *     corner shade), and outdoors the broadcast colour grade (a 3D LUT)
 * Old (Settings → Look → "3D look: Old") never calls this: the scene draws
 * exactly as before.
 */
import type { Quality3d } from "../../three3d/quality";
import { envFor, type TimeOfDay } from "./assets";
import { makeHPost, type HGrade, type HPost } from "./post";
import { bakedLightNow, type BakedLight, type BakeSet } from "../../look/bakedLight";
import { lookLut } from "../../look/params";

export interface HEnhance {
  render(scene: any, camera: any): void;
  /**
   * The loading cover's last step (speed job B, 9 Oct 2026). Waits (at most
   * a few seconds) for the baked light and the sky's light, puts the bake on
   * every material, then builds every shader for the target the frames are
   * really drawn into. Before: the scene compiled for the screen, then the
   * first frame (drawn into the pass's picture) built every shader again on
   * the page thread, and the bake's arrival a third time — the garden's 11 s
   * first frame. Same picture; the work is done once, in the background.
   */
  compile(scene: any, camera: any): Promise<void>;
  dispose(): void;
}

const GRADES: Record<TimeOfDay | "indoor", HGrade> = {
  day: { exposure: 1, bloom: 0.25, bloomThresh: 1.5, contrast: 1.07, sat: 1.04, tint: [1, 1, 0.99], lift: [0, 0.003, 0.008], vignette: 0.2 },
  golden: { exposure: 1, bloom: 0.4, bloomThresh: 1.2, contrast: 1.08, sat: 1.06, tint: [1.03, 1.0, 0.95], lift: [0.008, 0.004, 0], vignette: 0.26 },
  night: { exposure: 1, bloom: 0.7, bloomThresh: 0.9, contrast: 1.1, sat: 1.04, tint: [0.98, 1, 1.05], lift: [0, 0.003, 0.012], vignette: 0.32 },
  indoor: { exposure: 1, bloom: 0.35, bloomThresh: 1.1, contrast: 1.06, sat: 1.05, tint: [1.02, 1, 0.97], lift: [0.004, 0.002, 0], vignette: 0.24 },
};

/**
 * `tod` lights the scene from that real sky (outdoors); "indoor" keeps the
 * scene's own environment. `exposure` is the scene's own tone-mapping exposure.
 */
export function enhanceH(T: any, renderer: any, scene: any, tier: Quality3d, tod: TimeOfDay | "indoor", o: { exposure: number; envIntensity?: number; bake?: BakeSet | null; lutAmt?: number; msaa?: number }): HEnhance {
  // msaa: a scene may ask for real 4x antialias on Medium too (the casino: Harry's "jagged edges", 9 Oct 2026)
  const post: HPost = makeHPost(T, renderer, tier, o.msaa === undefined ? {} : { msaa: o.msaa });
  const grade: HGrade = { ...GRADES[tod], exposure: o.exposure };
  let dead = false;
  // the set's baked light: the garden outdoors, the shop indoors (unless told otherwise)
  const set: BakeSet | null = o.bake === undefined ? (tod === "indoor" ? "shop" : "garden") : o.bake;
  let baked: BakedLight | null = null;
  let frames = 0;
  /** What the first frame's shaders depend on, loading in the background (compile waits for them). */
  const waits: Promise<unknown>[] = [];
  if (set) {
    // patched now, its pictures arriving in the background (lag pass 3, 9 Oct 2026): patched when they
    // arrived, every lit shader in the place was built twice, the second time after the cover came down
    const b = bakedLightNow(T, set, tod === "indoor" ? "indoor" : tod);
    if (b) {
      baked = b;
      // the bounce is the sun's light thrown back: find the scene's strongest sun-like light
      let sun: any = null;
      scene.traverse((x: any) => { if (x.isDirectionalLight && (!sun || x.intensity > sun.intensity)) sun = x; });
      if (sun) b.setLight(sun.color, sun.intensity);
      // the garden's live sun shadow already covers the whole garden: the baked one only softens it
      // (at full strength the two sat a hand apart on the stable's front and read as a smudge, 9 Oct still)
      if (set === "garden") b.setStrength({ shade: 0.3, ao: 0.85 });
      b.apply(scene);
    }
  }
  if (tod !== "indoor") {
    void lookLut(T, tod).then((t) => { if (!dead && t) { grade.lut = t; grade.lutAmt = o.lutAmt ?? 0.8; } });
  }
  if (tod !== "indoor") {
    waits.push(envFor(T, renderer, tod).then((env) => {
      if (dead) return;
      scene.environment = env;
      if (o.envIntensity !== undefined) scene.environmentIntensity = o.envIntensity;
    }).catch(() => { /* keep the scene's own light */ }));
  }
  return {
    render(sc, camera) {
      // things built or swapped in after the start (models load in) pick up the baked light too
      if (baked && (frames++ % 60) === 0) baked.apply(sc);
      post.render(sc, camera, grade);
    },
    async compile(sc, camera) {
      await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 6000))]);
      if (dead) return;
      if (baked) baked.apply(sc); // everything built so far wears the bake before its shader is built
      if (typeof renderer.compileAsync !== "function") return;
      const rt = post.sceneTarget();
      const prevT = renderer.getRenderTarget(), tm = renderer.toneMapping;
      if (rt) { renderer.toneMapping = T.NoToneMapping; renderer.setRenderTarget(rt); }
      let job: Promise<unknown> = Promise.resolve();
      // compileAsync picks each shader's variant now, from the target set; only the waiting is async
      try { job = renderer.compileAsync(sc, camera); } catch { /* built on first use */ }
      renderer.setRenderTarget(prevT); renderer.toneMapping = tm;
      await Promise.race([job.catch(() => {}), new Promise((r) => setTimeout(r, 8000))]);
    },
    dispose() { dead = true; baked?.dispose(); baked = null; post.dispose(); },
  };
}
