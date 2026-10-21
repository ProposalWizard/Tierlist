"use client";
/**
 * THE BENCH'S SCENE SHOT — a bare, full-screen 3D scene for the 3D bench's
 * shots and the filming tools: a cut scene stopped at a second, or the 3D free
 * roam. Not an admin page: it is listed nowhere, has no menu entry and no
 * guide. It took over from the old "Art styles + cut-scene director" page
 * (/star-style-dev), deleted on 21 Oct 2026 (Harry: "remove the page art
 * styles + cut scene director"). Watching and editing cut scenes is the 3D
 * Scene Editor's job (/star-scene-editor-dev → Cut-scene Director).
 *
 * Address (the same as the old page's): ?scene=director&fixture=signing&clean=1&t=10.1
 *   ?scene=director&event=scored&stakes=0.8&emotion=joy&seed=3   a made-up scene
 *   ?scene=play3d   the 3D free roam   ?style=real|mix|…   ?tod=day|golden|night
 * clean=1 hides every control (the stills and film tools always pass it).
 * The Lag test's last step (the cut scene) opens it without clean=1, so its
 * play controls show, and the Lag test pill carries on here.
 */
import StyleTest3D from "@/components/star/StyleTest3D";
import LagTestHost from "@/components/star/LagTest";

export default function BenchSceneShot() {
  return (
    <>
      <StyleTest3D />
      <LagTestHost />
    </>
  );
}
