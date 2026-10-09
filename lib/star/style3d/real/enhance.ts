/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H FOR A SCENE THAT BUILDS ITS OWN WORLD (the garden, the 3D shop):
 * the scene keeps its models, and look H adds
 *   - light from a real sky (image-based, from the HDR files), outdoors only
 *   - the broadcast pass: real bloom, ACES with an S-curve, a gentle split
 *     tone, sharpening (High) or FXAA (Medium), vignette, fine grain
 * Old (Settings → Look → "3D look: Old") never calls this: the scene draws
 * exactly as before.
 */
import type { Quality3d } from "../../three3d/quality";
import { envFor, type TimeOfDay } from "./assets";
import { makeHPost, type HGrade, type HPost } from "./post";

export interface HEnhance {
  render(scene: any, camera: any): void;
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
export function enhanceH(T: any, renderer: any, scene: any, tier: Quality3d, tod: TimeOfDay | "indoor", o: { exposure: number; envIntensity?: number }): HEnhance {
  const post: HPost = makeHPost(T, renderer, tier);
  const grade: HGrade = { ...GRADES[tod], exposure: o.exposure };
  let dead = false;
  if (tod !== "indoor") {
    envFor(T, renderer, tod).then((env) => {
      if (dead) return;
      scene.environment = env;
      if (o.envIntensity !== undefined) scene.environmentIntensity = o.envIntensity;
    }).catch(() => { /* keep the scene's own light */ });
  }
  return {
    render(sc, camera) { post.render(sc, camera, grade); },
    dispose() { dead = true; post.dispose(); },
  };
}
