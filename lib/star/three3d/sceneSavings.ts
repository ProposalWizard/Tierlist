/**
 * The "same picture, less work" savings for a 3D place with its own renderer
 * (garden, shop, casino), in one call made just BEFORE its shaders are
 * compiled (a lamp-free shader is a different shader, so it must be built
 * with the rest, not later):
 *   - the shadow cache (shadowCache.ts): still things' shadows drawn once;
 *     people from a lighter shadow body;
 *   - lights only where they reach (lightReach.ts): dark lights out of the
 *     shader, lamp loops out of materials no lamp can reach.
 * A light check every 2 s puts back anything no longer safe. Stats on
 * window.__sceneSavings.
 */
import type * as THREE from "three";
import { installShadowCache } from "./shadowCache";
import { lightReach } from "./lightReach";

export function sceneSavings(T: typeof import("three"), renderer: THREE.WebGLRenderer, scene: THREE.Object3D): { dispose(): void } {
  installShadowCache(T, renderer);
  const reach = lightReach(T, scene);
  reach.update();
  const show = () => { if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__sceneSavings = { ...reach.stats }; };
  show();
  const timer = typeof window !== "undefined" ? window.setInterval(() => { reach.check(); show(); }, 2000) : null;
  return { dispose() { if (timer !== null) window.clearInterval(timer); reach.dispose(); } };
}
