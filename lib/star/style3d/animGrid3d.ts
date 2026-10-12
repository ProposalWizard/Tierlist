/**
 * THE 3D ANIMATION TEST AREA's picture (/star-anim3d-dev). Harry, 12 Oct 2026:
 * "the animation suck for 3d players in game I think we need to lay them out
 * in the test area like we have for 2d".
 *
 * Every move the 3D match plays, each on its own man, looping, seen through
 * the real match camera (the broadcast camera's angle and field of view, a man
 * at its 6% of a 390 × 844 phone screen, the men at BROADCAST.fig × life) and
 * cropped to a tile. One renderer draws every tile (scissor), so the page
 * uses one WebGL canvas however many tiles there are.
 *
 * The men are the match's own: realistic bodies (Players in a 3D match), the
 * match's clip file (football.glb + mocap), a one-shot played on the spot as
 * engineView now plays it (hips held), the keeper in his gloves. A kick, pass,
 * tackle, header or volley shows a ball where the clip says the ball is met.
 */
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { matchPlayerStyle } from "./toon/matchLook";
import { TOON_PLAYER_HEADS } from "./toon/bodies";
import { addClips, clipInfo, loadAnims3d } from "../three3d/footballAnims";
import { BROADCAST } from "./broadcastCam";

import type * as THREE from "three";
type Three = typeof import("three");

export interface AnimTile {
  /** The label under the tile. */
  label: string;
  /** Clip name tried first, then stand-ins in order. */
  clips: string[];
  keeper?: boolean;
  /** Shown facing: radians about up, 0 = away from the camera (towards goal), as you shoot. */
  yaw?: number;
}

/** Every move the 3D match plays (engineView.ts: clipForAct, the gaits, moveMocap, keeperMocap). */
export const ANIM_TILES: { group: string; tiles: AnimTile[] }[] = [
  { group: "Outfield", tiles: [
    { label: "Idle", clips: ["idle"] },
    { label: "Walk", clips: ["walk"] },
    { label: "Jog", clips: ["jog"] },
    { label: "Run", clips: ["run", "jog"] },
    { label: "Sprint", clips: ["sprint"] },
    { label: "Turn (left)", clips: ["turn_l"] },
    { label: "Turn (right)", clips: ["turn_r"] },
    { label: "Dribble touch", clips: ["dribble_run", "first_touch"] },
    { label: "First touch", clips: ["first_touch"] },
    { label: "Pass", clips: ["pass_inside", "pass"] },
    { label: "Lofted pass", clips: ["pass_lofted"] },
    { label: "Shot (right)", clips: ["shot_r"] },
    { label: "Shot (left)", clips: ["kick_l"] },
    { label: "Low drive", clips: ["shot_low", "shot_r"] },
    { label: "Chip", clips: ["chip", "shot_r"] },
    { label: "Header", clips: ["header_stand"] },
    { label: "Volley", clips: ["volley"] },
    { label: "Tackle", clips: ["poke_tackle"] },
    { label: "Slide tackle", clips: ["sliding_tackle"] },
    { label: "Celebrate (jump)", clips: ["celebrate_jump", "celebrate_fist"] },
    { label: "Celebrate (fist)", clips: ["celebrate_fist"] },
    { label: "Dejected", clips: ["dejected", "frustrated"] },
  ] },
  { group: "Keeper", tiles: [
    { label: "Set", clips: ["ready_shuffle", "idle"], keeper: true, yaw: Math.PI },
    { label: "Shuffle", clips: ["shuffle_l", "side_step_l", "ready_shuffle"], keeper: true, yaw: Math.PI },
    { label: "Side step", clips: ["side_step_r", "ready_shuffle"], keeper: true, yaw: Math.PI },
    { label: "Dive low ←", clips: ["dive_left_low", "dive_left"], keeper: true, yaw: Math.PI },
    { label: "Dive ←", clips: ["dive_left"], keeper: true, yaw: Math.PI },
    { label: "Dive high ←", clips: ["dive_left_high", "dive_left"], keeper: true, yaw: Math.PI },
    { label: "Dive low →", clips: ["dive_right_low", "dive_right"], keeper: true, yaw: Math.PI },
    { label: "Dive →", clips: ["dive_right"], keeper: true, yaw: Math.PI },
    { label: "Dive high →", clips: ["dive_right_high", "dive_right"], keeper: true, yaw: Math.PI },
    { label: "Catch (chest)", clips: ["catch_chest", "high_claim"], keeper: true, yaw: Math.PI },
    { label: "Catch (high) / punch", clips: ["high_claim"], keeper: true, yaw: Math.PI },
    { label: "Kick out", clips: ["kick_r"], keeper: true, yaw: 0 },
    { label: "Throw out", clips: ["throw_out"], keeper: true, yaw: 0 },
  ] },
];

/** The keeper's clips that move him across his goal themselves (a dive): not held on the spot. */
const MOVES_ITSELF = /^dive_/;

export interface AnimGrid {
  /** Tile i: its clip name actually played (null: none of its clips exist), and its length (s). */
  info: { clip: string | null; duration: number }[];
  /** Draw tile i at its own time `t` (s into its clip; loops wrap). */
  draw(times: number[]): void;
  resize(cols: number, tileW: number, tileH: number): void;
  setView(v: { yaw?: number; zoom?: number }): void;
  dispose(): void;
}

export async function createAnimGrid(canvas: HTMLCanvasElement, tiles: AnimTile[], cols: number, tileW: number, tileH: number): Promise<AnimGrid> {
  const [THREE, { GLTFLoader }, SkU] = await Promise.all([
    import("three"), import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/utils/SkeletonUtils.js"),
  ]);
  const T = THREE as unknown as Three;
  const SK = (SkU as unknown as { default?: unknown }).default ?? SkU;
  const loader = await withMeshopt(new GLTFLoader());
  const [model, animG, fb] = await Promise.all([
    loadPeople3d(loader, "player", people3dLook(), TOON_PLAYER_HEADS, matchPlayerStyle()),
    loadPeople3d(loader, "anims", people3dLook()),
    loadAnims3d(loader, "football").catch(() => null),
  ]);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setScissorTest(true);
  const scene = new T.Scene();
  scene.background = new T.Color("#2f6b34");
  scene.add(new T.HemisphereLight(0xdfefff, 0x3a5a2a, 1.6));
  const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(30, 60, 20); scene.add(sun);
  const SPACING = 40;
  const grass = new T.Mesh(new T.PlaneGeometry(SPACING * (tiles.length + 2), 80), new T.MeshLambertMaterial({ color: 0x3f8a43 }));
  grass.rotation.x = -Math.PI / 2; grass.position.x = (SPACING * tiles.length) / 2; scene.add(grass);
  const FIG = BROADCAST.fig;
  const ballGeo = new T.SphereGeometry(0.11, 18, 12), ballMat = new T.MeshLambertMaterial({ color: 0xffffff });

  type Man = { p: Person3D; clip: string | null; act: THREE.AnimationAction | null; ball: THREE.Mesh | null; x: number; tile: AnimTile; hold: boolean };
  const men: Man[] = [];
  tiles.forEach((tile, i) => {
    const p = makePerson3d(T, SK as never, model, animG, { outline: 0 });
    if (fb) addClips(T, p, fb as never);
    dressPerson3d(T, p, {
      skin: ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e"][i % 4], hair: "#1b120c",
      kit: tile.keeper ? { shirt: "#16a34a", trim: "#111827" } : { shirt: "#dc2626", trim: "#ffffff" },
      accessories: tile.keeper ? [{ slot: "hands", color: "#f5f5f5", color2: "#16a34a" }] : [],
    });
    relaxHands(T, p);
    const clip = tile.clips.find((c) => p.actions[c]) ?? null;
    const act = clip ? p.actions[clip] : null;
    for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
    if (act) { act.reset(); act.play(); act.setEffectiveWeight(1); act.paused = true; }
    const x = i * SPACING;
    p.root.position.set(x, 0, 0);
    p.root.scale.setScalar(FIG);
    scene.add(p.root);
    // a ball where the clip meets it (his frame, clip metres × his size)
    let ball: THREE.Mesh | null = null;
    const ci = clip ? clipInfo(fb as never, clip) : null;
    if (ci?.ball && ci.contactPoint && !tile.keeper) {
      ball = new T.Mesh(ballGeo, ballMat);
      scene.add(ball);
    }
    men.push({ p, clip, act, ball, x, tile, hold: !tile.keeper || !MOVES_ITSELF.test(clip ?? "") });
  });

  // the match camera: the broadcast angle and lens, a man at manShare of an 844 px phone screen
  const cam = new T.PerspectiveCamera(BROADCAST.fov, 390 / 844, 0.5, 400);
  let view = { yaw: 0, zoom: 1 };
  let size = { cols, tileW, tileH };
  const elev = (BROADCAST.elevDeg * Math.PI) / 180;
  const D = (BROADCAST.manH * FIG * Math.cos(elev)) / (BROADCAST.manShare * 2 * Math.tan((BROADCAST.fov * Math.PI) / 360));
  const fit = () => {
    const w = size.cols * size.tileW, h = Math.ceil(men.length / size.cols) * size.tileH;
    renderer.setSize(w, h, false);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  };
  fit();
  const v = new T.Vector3();
  return {
    info: men.map((m) => ({ clip: m.clip, duration: m.act?.getClip().duration ?? 1 })),
    draw(times) {
      const H = Math.ceil(men.length / size.cols) * size.tileH;
      men.forEach((m, i) => {
        m.p.root.rotation.set(0, (m.tile.yaw ?? 0) + view.yaw, 0);
        if (m.act) {
          const d = m.act.getClip().duration;
          m.act.time = ((times[i] % d) + d) % d;
          m.p.mixer.update(0);
          if (m.hold) { const r0 = m.p.rest.get(m.p.bones.Hips)?.[0]; if (r0) { m.p.bones.Hips.position.x = r0.x; m.p.bones.Hips.position.z = r0.z; } }
        }
        if (m.ball && m.clip) {
          const ci = clipInfo(fb as never, m.clip)!;
          // where the kicking foot is at contact, hips held (as the match plays it): the ball sits there
          const a = m.act!, keep = a.time;
          a.time = ci.contact ?? 0; m.p.mixer.update(0);
          if (m.hold) { const r0 = m.p.rest.get(m.p.bones.Hips)?.[0]; if (r0) { m.p.bones.Hips.position.x = r0.x; m.p.bones.Hips.position.z = r0.z; } }
          m.p.root.updateMatrixWorld(true);
          const right = (ci.foot ?? (m.clip === "kick_l" ? "L" : "R")) === "R" && m.clip !== "kick_l";
          m.p.bones[right ? "RightFoot" : "LeftFoot"].getWorldPosition(v);
          m.ball.scale.setScalar(FIG);
          m.ball.position.set(v.x, 0.11 * FIG, v.z);
          a.time = keep; m.p.mixer.update(0);
          if (m.hold) { const r0 = m.p.rest.get(m.p.bones.Hips)?.[0]; if (r0) { m.p.bones.Hips.position.x = r0.x; m.p.bones.Hips.position.z = r0.z; } }
        }
        const col = i % size.cols, row = Math.floor(i / size.cols);
        const x0 = col * size.tileW, y0 = H - (row + 1) * size.tileH;
        renderer.setViewport(x0, y0, size.tileW, size.tileH);
        renderer.setScissor(x0, y0, size.tileW, size.tileH);
        // camera behind the play at the match angle, the man at 60% down a 390 × 844 screen, cropped to the tile
        const dd = D / view.zoom;
        cam.position.set(m.x, dd * Math.sin(elev) + 0.9, dd * Math.cos(elev));
        cam.lookAt(m.x, 0.9, 0);
        const cw = 390, ch = 844;
        cam.aspect = cw / ch;
        cam.setViewOffset(cw, ch, (cw - size.tileW) / 2, ch / 2 - size.tileH * 0.62, size.tileW, size.tileH);
        cam.updateProjectionMatrix();
        renderer.render(scene, cam);
      });
    },
    resize(c, w, h) { size = { cols: c, tileW: w, tileH: h }; fit(); },
    setView(nv) { view = { ...view, ...nv }; },
    dispose() {
      renderer.dispose();
      scene.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (g) g.dispose(); });
    },
  };
}
