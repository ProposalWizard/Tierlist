/**
 * TEST SCENES — scripts for the bench and the filming tools only (never in a career, never in FIXTURE_LIST,
 * not scored against the generator). Open one with ?scene=director&fixture=<id>&cam=old on /star-3d-bench-dev/scene
 * (cam=old: no film pass, so the fixed camera stays put; the film pass cuts away from any walk).
 *
 *   walkers   eight players crossing a pitch together, each on his own walk, pace and place in the stride
 *             (people/life.ts ownMotion). The proof for Harry's "no variations - 22 players walking at the same
 *             pace in the same time" and the Quaternius UAL 1 walks (21 Nov 2026).
 */
import type { CameraTrack, CutsceneScript, Track, Vec3 } from "./types";
import { ownMotion } from "../people/life";
import { GAIT_SPEED } from "./presets/clips";

function walkers(): CutsceneScript {
  const D = 7;
  // two loose rows of four, walking towards the camera
  const lanes: [number, number][] = [[-1.8, 37.0], [-0.6, 37.6], [0.7, 36.7], [1.9, 37.3], [-1.2, 34.8], [0.1, 35.4], [1.3, 34.4], [2.4, 35.0]];
  const cast = lanes.map(([x, z], i) => ({ id: `walker${i}`, role: "teammate" as const, mark: [x, 0, z] as Vec3, face: 0 }));
  const tracks: Track[] = [];
  lanes.forEach(([x, z], i) => {
    const own = ownMotion(`walker${i}`);
    const speed = 1.35 * own.pace;
    const at = (i % 3) * 0.15;
    const dist = speed * (D - at);
    tracks.push({ type: "move", actor: `walker${i}`, at, dur: D - at, path: [[x + (i % 2 ? 0.15 : -0.1), 0, z + dist]], gait: "walk", ease: 0 });
  });
  const cam: CameraTrack = { type: "camera", at: 0, dur: D, name: "The group", cut: "cut",
    shot: { preset: "wide", subject: { point: [0.3, 0.5, 39.5] }, fixed: { pos: [0.9, 3.8, 53.5], look: [0.3, 0.5, 39.5], lens: 40 } } };
  return {
    id: "test-walkers", title: "Walkers (test)", duration: D,
    set: { location: "pitch", mood: "golden-hour" }, cast, props: [], beats: [],
    tracks: [...tracks, cam], seed: 21, source: { kind: "fixture", event: { kind: "walkout", stakes: 0.3, emotion: "calm", intensity: 0.3 } },
  } as CutsceneScript;
}

/** One player on a clip, alone on the pitch: a walk travels at the clip's own speed (feet planted), an idle stands. */
function solo(clip: string, walk: boolean): () => CutsceneScript {
  return () => {
    const D = 6;
    const sp = GAIT_SPEED[clip] ?? 1.2;
    const tracks: Track[] = walk
      ? [{ type: "move", actor: "you", at: 0, dur: D, path: [[0, 0, 40 + sp * D]], gait: clip, ease: 0 }]
      : [{ type: "clip", actor: "you", at: 0, clip, loop: true }];
    const cam: CameraTrack = { type: "camera", at: 0, dur: D, name: "Him", cut: "cut", shot: { preset: "full", subject: { actor: "you" }, side: 1 } };
    return {
      id: `test-${clip}`, title: `${clip} (test)`, duration: D, set: { location: "pitch", mood: "golden-hour" },
      cast: [{ id: "you", role: "you", mark: [0, 0, 40] as Vec3, face: 0 }], props: [], beats: [], tracks: [...tracks, cam], seed: 22,
      source: { kind: "fixture", event: { kind: "walkout", stakes: 0.3, emotion: "calm", intensity: 0.3 } },
    } as CutsceneScript;
  };
}

export const TEST_SCENES: Record<string, () => CutsceneScript> = {
  walkers, "solo-walk_relaxed": solo("walk_relaxed", true), "solo-walk_formal": solo("walk_formal", true), "solo-idle_relaxed": solo("idle_relaxed", false),
};
