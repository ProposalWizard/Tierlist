/**
 * TEST SCENES — scripts for the bench and the filming tools only (never in a career, never in FIXTURE_LIST,
 * not scored against the generator). Open one with ?scene=director&fixture=<id>&cam=old on /star-3d-bench-dev/scene
 * (cam=old: no film pass, so the fixed camera stays put; the film pass cuts away from any walk).
 *
 *   walkers   eight players crossing a pitch together, each on his own walk, pace and place in the stride
 *             (people/life.ts ownMotion). The proof for Harry's "no variations - 22 players walking at the same
 *             pace in the same time" and the Quaternius UAL 1 walks (21 Nov 2026).
 *   walkout22 both teams, 22 men in two lines of eleven, walking out of the tunnel towards a camera on the pitch
 *             (28 Nov 2026): each on his own walk, pace (12% either way), place in the stride and habit (a glance,
 *             a look up, a clap, a sleeve, a wave), each face blinking and flickering on its own.
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

function walkout22(): CutsceneScript {
  const D = 12;
  const cast: CutsceneScript["cast"] = [];
  const tracks: Track[] = [];
  for (let row = 0; row < 11; row++) for (const side of [-1, 1]) {
    const id = side < 0 ? `home${row}` : `away${row}`;
    const x = 0.55 * side + (row % 2 ? 0.05 : -0.04) * side;
    const z = 9.4 - row * 1.05;
    cast.push({ id, role: side < 0 ? (row === 0 ? "captain" : "teammate") : "rival", mark: [x, 0, z] as Vec3, face: 0 });
    const own = ownMotion(id);
    // (each man sets off a moment of his own after the man ahead: nobody waits for a count)
    const at = 0.2 + row * 0.32 + (side > 0 ? 0.12 : 0) + 0.3 * own.habitAt;
    const dist = 1.05 * own.pace * (D - at);
    tracks.push({ type: "move", actor: id, at, dur: D - at, path: [[x * 1.1, 0, z + dist]], gait: "walk", ease: 0.15 });
  }
  const cam: CameraTrack = { type: "camera", at: 0, dur: D, name: "Out of the tunnel", cut: "cut",
    shot: { preset: "wide", subject: { point: [0, 1.0, 14] }, fixed: { pos: [2.3, 1.55, 23.2], look: [0, 1.15, 12.5], lens: 48 } } };
  return {
    id: "test-walkout22", title: "Walk-out, 22 men (test)", duration: D,
    set: { location: "tunnel", mood: "golden-hour" }, cast, props: [], beats: [],
    tracks: [...tracks, cam], seed: 23, source: { kind: "fixture", event: { kind: "walkout", stakes: 0.4, emotion: "calm", intensity: 0.4 } },
  } as CutsceneScript;
}

/** One man walking towards the camera and away again (10 s): the walk from the front and the back. */
function toAndFro(): CutsceneScript {
  const D = 10;
  const tracks: Track[] = [
    { type: "place", actor: "you", at: 0, to: [0, 0, 36] as Vec3, yaw: 0 },
    { type: "move", actor: "you", at: 0.3, dur: 4.4, path: [[0, 0, 41.2]], gait: "walk", ease: 0.2 },
    { type: "turn", actor: "you", at: 4.75, dur: 0.6, to: 180 },
    { type: "move", actor: "you", at: 5.3, dur: 4.5, path: [[0, 0, 36]], gait: "walk", ease: 0.2 },
  ];
  const cam: CameraTrack = { type: "camera", at: 0, dur: D, name: "Him", cut: "cut", shot: { preset: "full", subject: { point: [0, 0.9, 38.5] }, fixed: { pos: [0.3, 0.95, 43.6], look: [0, 0.8, 38.7], lens: 46 } } };
  return {
    id: "test-toandfro", title: "Walk to and from the camera (test)", duration: D, set: { location: "pitch", mood: "golden-hour" },
    cast: [{ id: "you", role: "you", mark: [0, 0, 36] as Vec3, face: 0 }], props: [], beats: [], tracks: [...tracks, cam], seed: 24,
    source: { kind: "fixture", event: { kind: "walkout", stakes: 0.3, emotion: "calm", intensity: 0.3 } },
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
  walkers, walkout22, toandfro: toAndFro, "solo-walk_relaxed": solo("walk_relaxed", true), "solo-walk_formal": solo("walk_formal", true), "solo-idle_relaxed": solo("idle_relaxed", false),
};
