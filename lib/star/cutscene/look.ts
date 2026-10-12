/**
 * Cut-scene people and cut-scene camera: DECIDED NEW, no Settings row
 * (Harry, 12 Oct 2026: "the new cut scenes will be staying"). See CLAUDE.md →
 * "Decided, no toggle". Old phones' stored values ("star-look-cutscene-people",
 * "star-look-cutscene-camera") are ignored.
 *
 *   People New: the cut-scene face (lib/star/cutscene/face.ts): painted skin,
 *               real eyes that blink and look, expressions; no face photo.
 *   Camera New: the film pass (cinema.ts `filmPass`) over every scene, plus a
 *               music bed (cutscene/music.ts).
 *
 * The "old" values stay in the types, so a test page can still pass one in by
 * hand (makeCast's `look`, playScene's `camera`). The real game never does.
 */
export type CutscenePeopleLook = "new" | "old";
export type CutsceneCameraLook = "new" | "old";

/** Decided, no toggle: always New. */
export function cutscenePeopleLook(): CutscenePeopleLook { return "new"; }
export const useCutscenePeopleLook = (): CutscenePeopleLook => "new";

/** Decided, no toggle: always New. */
export function cutsceneCameraLook(): CutsceneCameraLook { return "new"; }
export const useCutsceneCameraLook = (): CutsceneCameraLook => "new";
