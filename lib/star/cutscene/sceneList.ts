/**
 * THE ONE LIST OF CUT SCENES the admin shows (Harry, 21 Oct 2026: "In the
 * scene editor I'm seeing cut scenes I don't see in the admin pages for 3D").
 *
 * The 3D Scene Editor's scene buttons and the 3D Area's "Cut scenes" cards
 * both read this, so they can never drift apart again:
 *   - the hand-made scenes (fixtures.ts FIXTURE_LIST), each with a real still
 *     (public/admin/3d-area/cut-<id>.webp, made by scripts/admin3d/stills.mjs);
 *   - every scene kept from the Scene generator (sceneEdits/kept.ts: this
 *     device and the shared table), newest first.
 * A new hand-made scene = one line in FIXTURE_LIST, one CUT_STILL_AT entry,
 * then re-run the stills script.
 */
import { FIXTURE_LIST } from "./fixtures";
import { keptScenes, loadKeptLocal, type KeptScene } from "../sceneEdits/kept";

export interface CutsceneEntry {
  id: string;
  name: string;
  /** "hand": written by hand (fixtures.ts). "kept": kept from the Scene generator. */
  kind: "hand" | "kept";
  /** A real still of the scene (hand-made scenes only). */
  still?: string;
  /** Opens this scene in the 3D Scene Editor. */
  href: string;
}

/** The second each hand-made scene's card still is taken at (scripts/admin3d/stills.mjs). */
export const CUT_STILL_AT: Record<string, number> = {
  signing: 10.1, goal: 6.5, trophy: 4.1, walkout: 2.3, press: 6.7, mentor: 5, farewell: 4,
};

export const editorHref = (id: string) => `/star-scene-editor-dev?place=director&scene=${encodeURIComponent(id)}`;

/** Every cut scene, hand-made first (in their written order), then the kept ones as given. */
export function cutsceneList(kept: KeptScene[] = []): CutsceneEntry[] {
  return [
    ...FIXTURE_LIST.map((f) => ({ id: f.id, name: f.name, kind: "hand" as const, still: `/admin/3d-area/cut-${f.id}.webp`, href: editorHref(f.id) })),
    ...kept.map((k) => ({ id: k.id, name: k.name, kind: "kept" as const, href: editorHref(k.id) })),
  ];
}

/** The kept scenes as the Scene Editor sees them: the shared table (if it answers) and this device. */
export async function fetchKeptScenes(): Promise<KeptScene[]> {
  const local = loadKeptLocal();
  try {
    const r = await fetch("/api/star/cutscene-edits", { cache: "no-store" });
    const j = await r.json();
    return keptScenes((j?.edits ?? {}) as Record<string, unknown>, local);
  } catch { return keptScenes({}, local); }
}
