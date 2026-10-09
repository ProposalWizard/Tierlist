/**
 * STYLE TESTING — CUT SCENES. The goal and the signing are now SCRIPTS on the
 * cut-scene system (lib/star/cutscene: fixtures.ts, played by director.ts).
 * The first hand-coded versions are kept, untouched, in cutscenesOld.ts
 * (?cut=old on /star-style-dev).
 */
import type { Quality3d } from "../three3d/quality";
import type { StyleDef } from "./styles";

export type CutKind = "goal" | "signing";

export interface CutScene {
  readonly duration: number;
  setStyle(def: StyleDef): void;
  replay(): void;
  /** Hold still at t seconds (stills). */
  seek(t: number): void;
  /** Frame stepping: stop the real-time loop and draw exactly t. */
  frameSeek(t: number): void;
  onShot?: (name: string) => void;
  dispose(): void;
}

export async function createCutScene(container: HTMLElement, kind: CutKind, first: StyleDef, o: { tier?: Quality3d; onShot?: (n: string) => void; old?: boolean } = {}): Promise<CutScene> {
  if (o.old) return (await import("./cutscenesOld")).createCutScene(container, kind, first, o);
  const [{ createDirector }, { FIXTURES }] = await Promise.all([import("../cutscene/director"), import("../cutscene/fixtures")]);
  let shot = "";
  const d = await createDirector(container, FIXTURES[kind](), { def: first, tier: o.tier, onOverlay: (ov) => { if (ov.shot !== shot) { shot = ov.shot; o.onShot?.(shot); } } });
  return {
    duration: d.duration,
    setStyle: (def) => d.setStyleDef(def),
    replay: () => d.replay(),
    seek: (t) => d.seek(t),
    frameSeek: (t) => d.frameSeek(t),
    dispose: () => d.dispose(),
  };
}
