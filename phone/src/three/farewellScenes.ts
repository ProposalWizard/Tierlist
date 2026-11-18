/**
 * THE FAREWELL'S 3D SCENES ON THE PHONE: the guard of honour
 * (lib/star/farewell3d.ts) and the standing ovation (lib/star/ovation3d.ts),
 * the website's own scene code, run as is.
 *
 * Each scene makes its own WebGLRenderer, sizes itself from its container and
 * runs its own frame loop (requestAnimationFrame, capped by the 3D quality
 * tier). On the phone its "container" is the GL view: the renderer is handed
 * the phone's GL (./gl.ts sceneCanvas) through the stand-in document
 * (./env.ts), and its size is the GL view's own pixels.
 */
import type { GuardSceneHandle, GuardSceneOptions } from "@/lib/star/farewell3d";
import type { OvationSceneHandle, OvationSceneOptions } from "@/lib/star/ovation3d";
import { offerGlCanvas, withSceneDocument } from "./env";
import { prepareGl, sceneCanvas } from "./gl";

function containerFor(gl: WebGL2RenderingContext) {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  return { clientWidth: w, clientHeight: h, appendChild() { /* the GL view is already on screen */ } } as unknown as HTMLElement;
}

export function startGuardOfHonour(gl: WebGL2RenderingContext, opts: GuardSceneOptions): Promise<GuardSceneHandle> {
  prepareGl(gl);
  return withSceneDocument(async () => {
    const { createGuardScene } = await import("@/lib/star/farewell3d");
    offerGlCanvas(sceneCanvas(gl));
    try { return await createGuardScene(containerFor(gl), opts); } finally { offerGlCanvas(null); }
  });
}

export function startOvation(gl: WebGL2RenderingContext, opts: OvationSceneOptions): Promise<OvationSceneHandle> {
  prepareGl(gl);
  return withSceneDocument(async () => {
    const { createOvationScene } = await import("@/lib/star/ovation3d");
    offerGlCanvas(sceneCanvas(gl));
    try { return await createOvationScene(containerFor(gl), opts); } finally { offerGlCanvas(null); }
  });
}
