/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE REAL GAME IN 3D — same brain, new camera.
 *
 * Harry, 9 Oct 2026: "we are making the normal game here … you need to update
 * the actual 3D of the real base 2D engine." This draws the REAL match (the
 * one engine, CanvasMatch, mounted through EnginePlay) in three.js, in a Style
 * Testing look. It decides nothing: every frame CanvasMatch hands over what it
 * has just drawn (lib/star/engineFrame.ts) and this puts the same men, keeper
 * and ball in a 3D stadium.
 *
 * THE CAMERA IS THE 2D CANVAS'S OWN. The new match view tips its finished
 * canvas back with a CSS perspective (lib/star/cameraTilt.ts). Tipping a flat
 * picture back is exactly what a pinhole camera sees of a flat pitch, so the
 * camera here is built from those same numbers: every spot on the grass lands
 * on the same screen pixel in 3D as in 2D. That is why input needs nothing:
 * the 2D canvas stays underneath (invisible) and takes every touch, through
 * its own exact inverse, so a drag kicks exactly as it does in the 2D game.
 *
 * Height is real here (2D draws it as a lift up the screen), so a ball in the
 * air sits where a camera would see it; on the grass the two agree exactly.
 *
 * Pitch metres → three: X = x − CX, Y = z (up), Z = y (out from the goal line).
 */
import { humanBodyLook } from "../human3d/look";
import { CX } from "../pitch";
import type { EngineFrame, EngineFrameFigure } from "../engineFrame";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer, warmUp } from "../three3d/perf";
import { Governor, governedPixelRatio } from "../three3d/governor";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D, type PersonLook } from "../people3d";
import { people3dLook } from "../look3d";
import { playerStyleLook } from "./toon/look";
import { TOON_BODIES, toonBodyFor, toonHairFor, toonYou, type ToonBody } from "./toon/bodies";
import { addClips, clipInfo, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import { faceFromUrl } from "../three3d/faceFromUrl";
import { motionLook } from "../motionLook";
import { newNumberCanvas, drawShirtNumber } from "../signing3dTextures";
import { canvasToScreen } from "../cameraTilt";
import { createStyleKit, type StyleKit } from "./kit";
import { buildStadium, type Stadium } from "./stadium";
import type { StyleDef } from "./styles";
import type { RealLook } from "./real/look";
import type { TimeOfDay } from "./real/assets";
import { realCameraLook, playerLightLook } from "./realGameLook";
import { TODS } from "./real/tod";

export interface EngineView {
  /** Every frame the 2D picture draws (EngineFrameObserver.onFrame). */
  frame(f: EngineFrame): void;
  setStyle(def: StyleDef): void;
  setTod(t: TimeOfDay): void;
  /** Men drawn this many times life size (the 2D game draws them big too). */
  setFigureScale(k: number): void;
  /** The TV camera's angle, degrees from straight down. */
  setTilt(deg: number): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

/**
 * Men drawn bigger than life on the match camera, as every top-down football
 * game does (a true 1.8 m man is a speck from up there). With the TV camera
 * (24 m across) 1.3 puts a man at about 40 px on a 390 px phone, the 2D
 * match's own size (coordinator, 9 Oct 2026).
 */
export const ENGINE_VIEW_FIG_SCALE = 1.3;
/** The keeper a size down, so he still fits his goal (the 2D draws him small on purpose too). */
const KEEPER_SHARE = 0.85;
/**
 * Motion: Mocap's numbers (Harry, 9 Oct 2026: the on-pitch motion "isn't 100%").
 * Motion: Old never reads them.
 */
const MO = {
  /** The fastest a man turns, rad/s. */
  maxTurn: 6,
  /** A bigger turn than this (rad, ~100°) while nearly still is a step round (turn_l / turn_r) … */
  turnClipMin: 1.75,
  /** … below this speed (m/s on the pitch), played this much quicker. */
  turnClipBelow: 1,
  turnSpeed: 1.35,
  /** Standing still below this (m/s on the pitch). */
  idleBelow: 0.35,
  /** A man's own pace (m/s at his drawn size) → which loop: walk, jog, run, sprint. */
  gaits: [["walk", 1.7], ["jog", 3.3], ["run", 4.9], ["sprint", Infinity]] as [string, number][],
  /** Stay in a gait this far past its edge before changing (no flicker). */
  gaitBand: 0.2,
  /** The kick: the backswing starts this long before contact … */
  windup: 0.55,
  /** … and is held this long before contact while the strike screen is up. */
  windupHold: 0.12,
  /** A kick seen only at the strike: from this long before contact, played this fast until the foot gets there. */
  lateStart: 0.2,
  lateSpeed: 2,
  /** Seconds of dive clip per second, at most, while it follows the 2D lunge (no one-frame pop). */
  diveCatchUp: 3,
  diveFade: 0.16,
};
/** How tall a man stands on the glass at the action with the TV camera, CSS px (the 2D match screen's men, coordinator 9 Oct 2026). */
const TARGET_PX = 46;
/**
 * The men lean back from the camera by this share of (90° − tilt). 0: they
 * stand upright (round 3, 9 Oct 2026: leaning men read small and wrong on the
 * side-by-side with Harry's target). Kept as a number to tune, not a feature.
 */
const LEAN_SHARE = 0;
const SKINS = ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e", "#f1c27d", "#a0673f"];
const BALL_R = 0.11;

const hashOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const numberFor = (sid: string): number => {
  if (sid === "you") return 9;
  if (sid === "keeper") return 1;
  if (sid === "follower") return 10;
  const n = Number(sid.replace(/\D+/g, "")) || 0;
  if (sid.startsWith("def") || sid.startsWith("chase")) return [4, 5, 6, 3, 2, 8, 14, 15][n % 8];
  if (sid.startsWith("run")) return [11, 7, 17, 19][n % 4];
  return [8, 7, 14, 16, 18][n % 5];
};

type Body = {
  p: Person3D; play: ClipPlayer; look: PersonLook;
  sid: string; kitKey: string; faceUrl?: string; faceAsked?: boolean;
  x: number; y: number; vx: number; vy: number; yaw: number;
  state: string; onceLeft: number; lastAct: number; kicking: boolean;
  seen: number; init: boolean;
  /** Keeper: the side of the dive being played, and whether it has reached full stretch. */
  dive?: { clip: string; full: boolean };
  // ── Motion: Mocap only (the Old motion never reads these) ──
  /** This body's size over the clips' (hips height): a clip's metres × k. */
  k: number;
  /** His own idle: where in the clip he starts (0..1) and how fast he breathes. */
  idleOff: number; rate: number;
  /** A turn on the spot being played: from which way, how far, and how far the clip itself turns his hips. */
  turn?: { clip: string; start: number; d: number; theta: number; h: number };
  turnReady: number;
  /** The kick's backswing, held while the strike screen is up. */
  windup?: string;
  /** A one-shot (celebration, head in hands) already played this result. */
  shotDone?: string;
  /** Kicking off the left foot: the clip's ball sits further on than shot_r's, so he stands back by this (his frame, metres). */
  kickOff?: [number, number];
  /** Keeper: walking sideways along his line. */
  side?: boolean;
  /** The tight shadow under his feet ("3D player light: New"). */
  foot?: any;
};

/**
 * The TV camera's numbers. Framed like the 2D match screen (coordinator, 9 Oct
 * 2026: "the ball and the goal both in view, the action centred, figures at
 * about the same on-screen size as the 2D match, roughly 40 px").
 */
export const TV_CAMERA = {
  /** Vertical field of view, degrees. */
  fov: 38,
  /** Never closer / wider than this (metres across at the action). */
  minViewW: 16,
  maxViewW: 44,
  /** Room round the outermost men at the screen's sides, CSS px. */
  marginPx: 26,
  /** The group's top and bottom stay inside these shares of the screen. */
  top: 0.16,
  /**
   * Goal in the chance: the goal line sits this far down the screen, so only
   * a slim strip of stand shows above the net (about 8–10%, Harry's target).
   */
  goalLineAt: 0.12,
  bottom: 0.84,
  /** Where the middle of the group sits (a touch above the middle: the stands above, the HUD below). */
  centre: 0.47,
}

/**
 * THE NEW TV CAMERA (Settings → Look → "3D camera: New", lib/star/style3d/realGameLook.ts).
 * Harry, 9 Oct 2026: "a mix of A and B … less of it was empty grass".
 *   A: the camera a little lower (more like a TV picture): the angle dial plus `tiltAdd`.
 *   B: it frames only the ACTION (the ball, you, the nearest defenders, the keeper and
 *      goal when the goal is in the chance), so men at the edges may go off screen and
 *      the camera sits tighter. The nearest man's feet sit near `bottom`.
 * Every other number as TV_CAMERA.
 */
export const TV_CAMERA_NEW = {
  ...TV_CAMERA,
  tiltAdd: 5,
  minViewW: 12,
  marginPx: 10,
  goalLineAt: 0.12,
  bottom: 0.86,
  /** The defenders (them) kept on screen: this many nearest the ball, within `nearR` m. */
  nearDefenders: 2,
  nearR: 8,
  /** Any man this near the ball stays on screen too (a team-mate in the move). */
  closeR: 6,
  /** Our men this near the ball stay on screen (the ones you can pass to). */
  mateR: 22,
  /** The men, the keeper and the ball, this many times life size (1 = true size). */
  fig: 1.6,
  /** No goal in the chance: the nearest man's feet are pinned this far down the screen. */
  pinBottom: 0.82,
  /** Goal in the chance: the nearest man's feet are wanted at least this far down the screen … */
  fillTo: 0.8,
  /** … by bringing the goal line down, never lower than this. */
  goalLineMax: 0.24,
};

export async function createEngineView(container: HTMLElement, o: { def: StyleDef; tier?: Quality3d; tod?: TimeOfDay; figScale?: number; faces?: boolean; tilt?: number; camera?: "tv" | "exact"; canvas2d?: HTMLCanvasElement }): Promise<EngineView> {
  const faces = !!o.faces;
  let tvTilt = o.tilt ?? 40;
  const camMode = o.camera ?? "tv";
  const tier = o.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  // Start-up (Harry, 9 Oct 2026: "the long load is when the game first starts"):
  // the code, the people's files and look H's pictures all load side by side,
  // not one after another. The 2D match plays meanwhile.
  const [THREE, { GLTFLoader }, SkU, lookMod]: any[] = await Promise.all([
    import("three"), import("three/examples/jsm/loaders/GLTFLoader.js"), import("three/examples/jsm/utils/SkeletonUtils.js"),
    o.def.real ? import("./real/look").catch(() => null) : Promise.resolve(null),
  ]);
  const SK = SkU.default ?? SkU;
  if (lookMod && o.def.real) lookMod.preloadRealLook(THREE, o.tod ?? o.def.real);
  if (o.def.real) void import("./real/ball").catch(() => null);
  const loader = await withMeshopt(new GLTFLoader());
  const body = people3dLook();
  const [model, animG, fb] = await Promise.all([
    loadPeople3d(loader, "player", body), loadPeople3d(loader, "anims", body),
    loadAnims3d(loader, "football").catch(() => null),
  ]);

  // ── renderer: at the phone's own pixel density (2 on High), so nothing is "pixelly" ──
  const { renderer, release } = acquireRenderer(THREE, container, prof);
  const dprCap = tier === "high" ? 2 : tier === "medium" ? 1.5 : 1.25; // never under 1.25 on a phone: smooth edges (9 Oct 2026)
  renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
  // The governor (three3d/governor.ts): slow frames for 2.5 s → one rung down
  // (pixel ratio, then shadows and the post pass; look H reads the rung itself).
  const gov = new Governor({
    start: tier, name: "real game",
    onChange: (r) => {
      renderer.setPixelRatio(governedPixelRatio(dprCap, r, window.devicePixelRatio || 1));
      if (!h) renderer.shadowMap.enabled = prof.shadows && r.shadows !== "off";
    },
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas3d = renderer.domElement as HTMLCanvasElement;
  canvas3d.style.pointerEvents = "none";

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  // A soft rim light from beyond the play, low over the grass, so the men's
  // edges catch it and they lift off the pitch (it barely touches flat grass).
  const rimLight = new THREE.DirectionalLight("#fff1dc", 0.9);
  root.add(rimLight, rimLight.target);

  /**
   * Plain heads until the new human body lands (the people builder is
   * replacing it): from this high camera the body's head texture read as a
   * pale mask. Here the head is painted flat — hair on top and at the back,
   * skin on the face — on these men only (their own material copy).
   */
  const plainHead = (p: Person3D, skin: string, hair: string) => {
    const m = p.body?.material as any;
    // The human body (Settings → Look "3D body: Human") has its own face and a
    // different material (no userData/uFaceF): it needs no plain head. Without
    // this guard the career match's 3D view crashed on Preview (9 Oct 2026).
    if (!m || Array.isArray(m) || !m.userData || m.userData.toon || humanBodyLook() === "human") return;
    const u = { uHeadSkin: { value: new THREE.Color(skin) }, uHeadHair: { value: new THREE.Color(hair) } };
    if (!m.userData.plainHead) {
      const inner = m.onBeforeCompile;
      const innerKey = m.customProgramCacheKey?.bind(m);
      m.onBeforeCompile = (sh: any, r: any) => {
        inner?.(sh, r);
        Object.assign(sh.uniforms, m.userData.plainHead);
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 uHeadSkin, uHeadHair;")
          .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec3 hr = vRest;
  float hd = smoothstep(uFaceF.x - 0.01, uFaceF.x + 0.01, hr.y);
  float onTop = max(step(uFaceF.z - 0.01, hr.y), step(hr.z, uFaceF.w - 0.06));
  vec3 headCol = mix(uHeadSkin, uHeadHair * 0.8, onTop);
  diffuseColor.rgb = mix(diffuseColor.rgb, headCol, hd);
}`);
      };
      m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-plainhead`;
      m.userData.plainHead = u;
      m.needsUpdate = true;
    } else {
      m.userData.plainHead.uHeadSkin.value.set(skin);
      m.userData.plainHead.uHeadHair.value.set(hair);
    }
  };
  /**
   * SOLID PLAYERS (Settings → Look → "3D player light: New", lib/star/style3d/realGameLook.ts).
   * Harry, 9 Oct 2026: "the players on the pitch still look slightly flat". On the
   * players only (their own material copy), never the grass or crowd:
   *   - a soft key light from the camera's upper left, so a body has a lit and a shaded side;
   *   - a rim on the edges facing the sun (the light from behind on a TV picture);
   *   - less flat fill (sky/bounce light), and darker under the arms, the chin and the feet.
   * The key is white and only adds brightness, so the kits keep their true colours.
   * Off ("Old"): the shader is exactly as before (nothing is added to it).
   */
  const SOLID = { key: 0.9, rim: 0.85, fill: 0.6 };
  const solidU = {
    uSolidKeyDir: { value: new THREE.Vector3(-0.55, 0.55, 0.63).normalize() },
    uSolidRimDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
    uSolidKeyCol: { value: new THREE.Color("#ffffff") },
    uSolidRimCol: { value: new THREE.Color("#fff4e2") },
    uSolidKey: { value: SOLID.key }, uSolidRim: { value: SOLID.rim }, uSolidFill: { value: SOLID.fill },
  };
  const solidBody = (m: any, on: boolean): void => {
    // the human body has a list of materials
    if (Array.isArray(m)) { for (const x of m) solidBody(x, on); return; }
    if (!m?.userData || m.userData.toon) return; // Style A lights itself (cel bands + rim)
    if (!m.userData.solidWrapped) {
      const inner = m.onBeforeCompile;
      const innerKey = m.customProgramCacheKey?.bind(m);
      const own = { uSolidBase: { value: 0 }, uSolidScale: { value: 1 } };
      m.userData.solidOwn = own;
      m.onBeforeCompile = (sh: any, r: any) => {
        inner?.call(m, sh, r);
        if (!m.userData.solid) return;
        Object.assign(sh.uniforms, solidU, own);
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uSolidBase, uSolidScale;\nvarying float vSolidH, vSolidNy;")
          .replace("#include <project_vertex>", `#include <project_vertex>
vSolidH = ((modelMatrix * vec4(transformed, 1.0)).y - uSolidBase) / max(uSolidScale, 0.01);
vSolidNy = normalize(mat3(modelMatrix) * objectNormal).y;`);
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 uSolidKeyDir, uSolidRimDir, uSolidKeyCol, uSolidRimCol;\nuniform float uSolidKey, uSolidRim, uSolidFill;\nvarying float vSolidH, vSolidNy;")
          .replace("#include <aomap_fragment>", `#include <aomap_fragment>
{
  float sH = clamp(vSolidH / 1.8, 0.0, 1.0);
  float sUnder = clamp(vSolidNy * 0.5 + 0.5, 0.0, 1.0);
  float sOcc = mix(0.45, 1.0, smoothstep(0.0, 0.5, sH)) * mix(0.5, 1.0, sUnder);
  reflectedLight.indirectDiffuse *= sOcc * uSolidFill;
  reflectedLight.indirectSpecular *= sOcc * uSolidFill;
  reflectedLight.directDiffuse *= mix(0.72, 1.0, smoothstep(0.0, 0.3, sH));
  float sKey = max(dot(normal, uSolidKeyDir), 0.0);
  reflectedLight.directDiffuse += diffuseColor.rgb * uSolidKeyCol * sKey * uSolidKey * mix(0.55, 1.0, sH);
  float sFres = pow(1.0 - saturate(dot(normal, geometryViewDir)), 2.5);
  float sSide = smoothstep(-0.25, 0.65, dot(normal, uSolidRimDir));
  reflectedLight.directSpecular += uSolidRimCol * sFres * sSide * uSolidRim * smoothstep(0.05, 0.3, sH);
}`);
      };
      m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-solid${m.userData.solid ? 1 : 0}`;
      m.userData.solidWrapped = true;
    }
    if (!!m.userData.solid !== on) { m.userData.solid = on; m.needsUpdate = true; }
  };
  // a tight dark patch right under each man's feet (with "3D player light: New")
  const footTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.5, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const footMat = new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false, opacity: 0.6 });
  const footGeo = new THREE.PlaneGeometry(1, 1);
  const FEET_MAX = 40;
  const feet = new THREE.InstancedMesh(footGeo, footMat, FEET_MAX);
  feet.count = 0; feet.renderOrder = 2; feet.frustumCulled = false;
  root.add(feet);
  const footMx = new THREE.Matrix4(), footQ = new THREE.Quaternion(), footE = new THREE.Euler(), footP = new THREE.Vector3(), footS = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera(39, 0.5, 0.1, 700);

  let def = o.def;
  let figScale = o.figScale ?? ENGINE_VIEW_FIG_SCALE;
  let kit: StyleKit | null = createStyleKit(THREE, renderer, scene, tier, def);
  let stadium: Stadium | null = null;
  let h: RealLook | null = null;
  let hTod: TimeOfDay | null = o.tod ?? null;
  let hToken = 0;
  let visible = true;

  // ── the ball (play3d's, dressed in look H when H is on) ──
  const ball = new THREE.Group();
  {
    const s = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ color: "#fbfbf8", roughness: 0.45 }));
    s.castShadow = prof.shadows; ball.add(s);
    const patch = new THREE.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.5 });
    for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3]]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.038, 5), patch);
      const v = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      p.position.copy(v.multiplyScalar(0.1105)); p.lookAt(v.clone().multiplyScalar(2)); ball.add(p);
    }
  }
  root.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; root.add(ballShadow);
  let hball: { update(dt: number, v: { x: number; y: number; z: number }): void; setNight(on: boolean): void; dispose(): void } | null = null;
  const lastBall = new THREE.Vector3(NaN, 0, 0);

  // ── markers on the grass: the ring under the man on the ball, and where a lofted ball lands ──
  const ringMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 4; root.add(ring);
  const crossMat = new THREE.MeshBasicMaterial({ color: "#fad64a", transparent: true, opacity: 0.95, depthWrite: false });
  const cross = new THREE.Group();
  for (const r of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.16), crossMat);
    bar.rotation.set(-Math.PI / 2, 0, r); cross.add(bar);
  }
  cross.position.y = 0.02; cross.renderOrder = 4; root.add(cross);

  // ── the captain's orders on the grass (EngineFrame.orders), in the Free
  // Roam style: flat gold marks on the pitch, as the 3D drills' rings. A run
  // is an arrow from the man to where he was sent (the one being dragged
  // now solid, the ones already given softer); the lay-off is a double ring
  // round the man it goes to. Gold is the armband's colour (the 2D game's too).
  const ORDER_GOLD = "#fbbf24";
  const orderMat = (o: number) => new THREE.MeshBasicMaterial({ color: ORDER_GOLD, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
  const shaftGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  const headGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(-0.5, -1); sh.lineTo(0.5, -1); sh.closePath();
    return new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2);
  })();
  type OrderArrow = { g: any; shaft: any; head: any };
  const arrows: OrderArrow[] = [];
  const arrowMats = { given: orderMat(0.72), live: orderMat(0.95) };
  const arrowAt = (i: number): OrderArrow => {
    while (arrows.length <= i) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, arrowMats.given), head = new THREE.Mesh(headGeo, arrowMats.given);
      shaft.renderOrder = 5; head.renderOrder = 5;
      g.add(shaft, head); g.position.y = 0.03; g.visible = false;
      root.add(g);
      arrows.push({ g, shaft, head });
    }
    return arrows[i];
  };
  const relayRings = new THREE.Group();
  for (const [r0, r1, o] of [[0.95, 1.12, 0.95], [1.3, 1.4, 0.4]] as const) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), orderMat(o));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 5; relayRings.add(m);
  }
  relayRings.position.y = 0.03; relayRings.visible = false; root.add(relayRings);
  const placeOrders = (f: EngineFrame) => {
    const o = f.orders;
    const k = figNow();
    const list2 = o ? [...o.runs.map((r) => ({ ...r, live: false })), ...(o.drag ? [{ ...o.drag, live: true }] : [])] : [];
    list2.forEach((r, i) => {
      const a = arrowAt(i);
      const dx = r.to.x - r.from.x, dz = r.to.y - r.from.y, len = Math.hypot(dx, dz);
      const head = Math.min(len * 0.5, 0.9 * k);
      a.g.visible = len > 0.3;
      a.g.position.set(r.from.x - CX, 0.03, r.from.y);
      a.g.rotation.set(0, Math.atan2(dx, dz), 0);
      const mat = r.live ? arrowMats.live : arrowMats.given;
      a.shaft.material = mat; a.head.material = mat;
      // the shaft starts clear of his feet and stops at the head
      const start = Math.min(len * 0.25, 0.55 * k);
      a.shaft.position.z = start;
      a.shaft.scale.set(0.24 * k, 1, Math.max(0.01, len - head - start));
      a.head.position.z = len;
      a.head.scale.set(0.75 * k, 1, head);
    });
    for (let i = list2.length; i < arrows.length; i++) arrows[i].g.visible = false;
    relayRings.visible = !!o?.relay;
    if (o?.relay) { relayRings.position.set(o.relay.x - CX, 0.03, o.relay.y); relayRings.scale.setScalar(k); }
  };

  // ── the aim arrow: the 2D game's own arrow, drawn on the glass over the 3D picture ──
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg") as SVGSVGElement;
  svg.setAttribute("width", "100%"); svg.setAttribute("height", "100%");
  Object.assign(svg.style, { position: "absolute", inset: "0", pointerEvents: "none", overflow: "visible" });
  svg.innerHTML = `<defs><linearGradient id="ev3dShaft" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#ea580c"/></linearGradient></defs>
    <line data-shaft stroke="url(#ev3dShaft)" stroke-linecap="round"/><polygon data-head fill="#f97316" stroke="rgba(124,45,18,0.6)" stroke-linejoin="round"/>`;
  container.appendChild(svg);
  const shaftEl = svg.querySelector("[data-shaft]") as SVGLineElement;
  const headEl = svg.querySelector("[data-head]") as SVGPolygonElement;
  const gradEl = svg.querySelector("#ev3dShaft") as SVGLinearGradientElement;

  // ── people ──
  const bodies = new Map<string, Body>();
  /** The same men, as a list (iterating a Map needs a newer compile target). */
  const list: Body[] = [];
  const info = (n: string) => clipInfo(fb as any, n);
  const loopSpeed: Record<string, number> = { jog: 3.2, sprint: 7.4, run: 5.2, walk: 1.4 };
  for (const n of Object.keys(loopSpeed)) { const s = info(n)?.speed; if (typeof s === "number") loopSpeed[n] = s; }
  /** Motion: Mocap (Settings → Look). Off (Old): every body moves exactly as it did before 9 Oct 2026. */
  const mo = motionLook() === "mocap" && !!fb;
  const fbHipsY = ((fb as any)?.scene?.userData?.hipsY as number | undefined) ?? 0;

  const numberTex = (n: number) => {
    const c = newNumberCanvas(); drawShirtNumber(c, n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  /**
   * SPARE BODIES (9 Oct 2026, Harry's phone: a 500 ms stall mid-match). A man
   * was built (skeleton copy, mixer, clips) the first frame he appeared, often
   * several at once when a chance opened. Now bodies are built ahead: a few
   * while loading, then one a frame until there are enough for a full match,
   * and a new man just takes one and is dressed (cheap: colours and a number).
   */
  const SPARE_TARGET = 24;
  // Style A (Player style: New): a man's body is seeded by who he is, so spares are kept per body.
  const toonOn = playerStyleLook() === "new";
  const spareBins = new Map<string, Person3D[]>();
  const bin = (b?: ToonBody) => { const k = b ?? "-"; let l = spareBins.get(k); if (!l) { l = []; spareBins.set(k, l); } return l; };
  const spares = { push: (p: Person3D) => bin(p.toon).push(p), pop: () => Array.from(spareBins.values()).find((l) => l.length)?.pop() };
  let built = 0;
  const buildShell = (tb?: ToonBody) => {
    const p = makePerson3d(THREE, SK, model, animG, { outline: prof.outlines ? 0.005 : 0, castShadow: prof.shadows, toonBody: toonOn ? (tb ?? TOON_BODIES[built % TOON_BODIES.length]) : undefined });
    if (fb) addClips(THREE, p, fb as any);
    p.root.visible = false;
    built++;
    return p;
  };
  for (let i = 0; i < 6; i++) spares.push(buildShell());
  const topUpSpares = () => { if (built < SPARE_TARGET) spares.push(buildShell()); };
  const makeBody = (sid: string, shirt: string, shorts: string): Body => {
    const tb = toonOn ? (sid === "you" ? toonYou().body : toonBodyFor(sid)) : undefined;
    const spare = bin(tb).pop();
    const p = spare ?? makePerson3d(THREE, SK, model, animG, { outline: prof.outlines ? 0.005 : 0, castShadow: prof.shadows, toonBody: tb });
    if (!spare) built++;
    const look: PersonLook = {
      skin: sid === "you" && toonOn ? toonYou().skin : SKINS[hashOf(sid) % SKINS.length],
      hair: toonOn ? (sid === "you" ? toonYou().hair : toonHairFor(sid)) : "#1b120c",
      kit: { shirt, trim: shorts }, number: numberTex(numberFor(sid)),
      accessories: sid === "keeper" ? [{ slot: "hands", color: "#f5f5f5", color2: "#16a34a" }] : [],
    };
    dressPerson3d(THREE, p, look);
    plainHead(p, look.skin, look.hair ?? "#1b120c");
    relaxHands(THREE, p);
    if (fb && !spare) addClips(THREE, p, fb as any);
    p.root.visible = true;
    const play = new ClipPlayer(THREE, p.actions);
    const first = sid === "keeper" && play.has("ready_shuffle") ? "ready_shuffle" : "idle";
    // Mocap: every man starts his idle at his own moment and breathes at his own pace (no one in step)
    const idleOff = ((hashOf(sid) * 0.6180339887) % 1 + 1) % 1;
    const rate = 0.9 + (hashOf(`${sid}~rate`) % 21) / 100;
    play.play(first, { fade: 0, ...(mo ? { from: idleOff * p.actions[first].getClip().duration, speed: rate } : {}) });
    root.add(p.root);
    kit?.stylePeople([p]);
    h?.dressPeople([p]);
    const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
    const k = fbHipsY > 0 ? hipsRest / fbHipsY : 1;
    return { p, play, look, sid, kitKey: `${shirt}|${shorts}`, x: 0, y: 0, vx: 0, vy: 0, yaw: 0, state: mo ? first : "idle", onceLeft: 0, lastAct: -1, kicking: false, seen: 0, init: false, k, idleOff, rate, turnReady: 0 };
  };
  const bodyFor = (sid: string, shirt: string, shorts: string, face?: string): Body => {
    let b = bodies.get(sid);
    if (!b) { b = makeBody(sid, shirt, shorts); bodies.set(sid, b); list.push(b); }
    const key = `${shirt}|${shorts}`;
    if (b.kitKey !== key) { b.kitKey = key; b.look.kit = { shirt, trim: shorts }; dressPerson3d(THREE, b.p, b.look); }
    if (face && face !== b.faceUrl) {
      b.faceUrl = face;
      const bb = b;
      void faceFromUrl(face).then((r) => {
        if (!r || bb.faceUrl !== face || !bodies.has(bb.sid)) return;
        bb.look.face = r.face; bb.look.faceSkin = r.skin; bb.look.skin = r.skin;
        dressPerson3d(THREE, bb.p, bb.look);
      });
    }
    return b;
  };

  /** Pitch angle (0 = +x) → the root's turn (0 faces +y, out of the goal). */
  const yawOf = (facing: number) => Math.PI / 2 - facing;
  const turnTo = (b: Body, want: number, dt: number, rate = 9) => {
    let d = want - b.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const step = d * Math.min(1, dt * rate);
    // Mocap: never faster than a man can turn (a fixed share per frame spun him on planted feet)
    b.yaw += mo ? Math.sign(step) * Math.min(Math.abs(step), MO.maxTurn * dt) : step;
  };
  const startLoop = (b: Body, name: string) => {
    const n = b.play.has(name) ? name : name === "ready_shuffle" ? "idle" : name === "sprint" ? "jog" : "idle";
    if (b.state === n) return;
    b.play.play(n, { fade: 0.22 });
    b.state = n;
  };
  const startOnce = (b: Body, clip: string, ago: number, speed = 1) => {
    if (!b.play.has(clip)) return false;
    const ci = info(clip);
    const contact = ci?.contact ?? 0.3;
    const dur = ci?.duration ?? b.p.actions[clip].getClip().duration;
    const from = Math.min(dur, contact + ago * speed);
    if (from >= dur - 0.05) return false;
    b.play.play(clip, { fade: mo ? 0.12 : 0.06, from, speed, once: true });
    b.state = `once:${clip}`;
    b.onceLeft = (dur - from) / speed;
    return true;
  };
  const clipForAct = (b: Body, kind: string, mode?: string): string | null => {
    const has = (n: string) => b.play.has(n);
    switch (kind) {
      case "shot":
        if (mode === "header") return "header_stand";
        if (mode === "volley") return "volley";
        if (mode === "chip" && has("chip")) return "chip";
        return "shot_r";
      case "pass": return mode === "header" ? "header_stand" : has("pass_inside") ? "pass_inside" : "pass";
      case "clearance": return mode === "header" ? "header_stand" : "pass_lofted";
      case "block": return "poke_tackle";
      case "touch": return mode === "header" ? "header_stand" : "first_touch";
      default: return null;
    }
  };

  // ── MOTION: MOCAP — how the men move (Settings → Look → "Motion: Mocap | Old") ──
  // The on-pitch motion pass (Harry, 9 Oct 2026: "isn't 100%"). Only these
  // functions read MO; with Motion: Old the code above plays exactly as before.
  const wrapPi = (d: number) => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  /** The hips' turn about the up axis (the clips turn him through the hips). */
  const hipsYaw = (b: Body) => { const q = b.p.bones.Hips.quaternion; return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x)); };
  const clipDur = (b: Body, n: string) => b.p.actions[n]?.getClip().duration ?? info(n)?.duration ?? 1;
  const LOCO = new Set(["walk", "jog", "run", "sprint"]);
  /** A loop, mocap way: a stride continues at the same foot (walk → jog), an idle starts at the man's own moment. */
  const startLoopM = (b: Body, name: string, fade = 0.25) => {
    const n = b.play.has(name) ? name : name === "run" ? "jog" : name === "walk" ? "jog" : name === "ready_shuffle" ? "idle" : name === "sprint" ? "jog" : "idle";
    if (b.state === n) return;
    const dur = clipDur(b, n);
    let from = b.idleOff * dur;
    const pa = b.p.actions[b.state];
    if (LOCO.has(b.state) && LOCO.has(n) && pa) {
      const plant = (c: string) => (info(c)?.plants?.L?.[0]?.[0] as number | undefined) ?? 0;
      const pd = clipDur(b, b.state);
      const ph = ((((pa.time - plant(b.state)) / pd) % 1) + 1) % 1;
      from = (plant(n) + ph * dur) % dur;
    }
    b.play.play(n, { fade, from, speed: n === "idle" || n === "ready_shuffle" ? b.rate : 1 });
    b.state = n;
  };
  /** Which loop his pace wants: idle, walk, jog, run, sprint (a band at each edge so he doesn't flicker). */
  const gaitFor = (b: Body, sp: number, u: number) => {
    if (sp < (b.state === "idle" ? MO.idleBelow : MO.idleBelow * 0.7)) return "idle";
    const g = MO.gaits;
    let i = g.findIndex(([, lim]) => u < lim);
    const cur = g.findIndex(([n]) => n === b.state);
    if (cur >= 0 && Math.abs(i - cur) === 1 && Math.abs(u - g[Math.min(i, cur)][1]) < MO.gaitBand) i = cur;
    return g[i][0];
  };
  /** A one-shot (celebration, head in hands): played once, then he stands. */
  const oneShotThenIdle = (b: Body, name: string) => {
    if (b.shotDone === name || !b.play.has(name)) { startLoopM(b, "idle"); return; }
    if (b.state !== `shot1:${name}`) { b.play.play(name, { fade: 0.22, once: true }); b.state = `shot1:${name}`; return; }
    const a = b.p.actions[name];
    if (a.time >= clipDur(b, name) - 0.05) { b.shotDone = name; startLoopM(b, "idle", 0.35); }
  };
  /** A big turn standing still: a step round, not a spin. Returns false when it can't. */
  const startTurn = (b: Body, d: number, t: number) => {
    const clip = d > 0 ? "turn_l" : "turn_r";
    if (!b.play.has(clip)) return false;
    b.play.play(clip, { fade: 0.12, from: 0.15, speed: MO.turnSpeed, once: true });
    b.state = `turn:${clip}`;
    // how far the clip itself turns his hips (turn_l ≈ +92°, turn_r ≈ −88°)
    b.turn = { clip, start: b.yaw, d, theta: d > 0 ? 1.6 : -1.5, h: 0 };
    b.turnReady = t + 1.6;
    return true;
  };
  /** After the mixer: drive his root so hips + root turn exactly `d`, keep him on his spot, and end the turn. */
  const settleTurn = (b: Body, sp: number) => {
    const tr = b.turn;
    if (!tr) return;
    const a = b.p.actions[tr.clip];
    const h = tr.h = wrapPi(hipsYaw(b));
    const over = b.state !== `turn:${tr.clip}` || a.time >= clipDur(b, tr.clip) - 0.06;
    if (over || sp > 1.2) {
      // end: the root takes the whole turn; cut (no fade) so the hips don't swing back
      b.yaw = over ? tr.start + tr.d : tr.start + (h * tr.d) / tr.theta;
      b.turn = undefined;
      if (b.state === `turn:${tr.clip}`) { b.state = ""; startLoopM(b, sp < MO.idleBelow ? "idle" : "walk", 0); b.play.update(0); b.p.mixer.update(0); }
      return;
    }
    b.yaw = tr.start + h * (tr.d / tr.theta - 1);
    // the capture walks him round; here he turns on his spot
    const r0 = b.p.rest.get(b.p.bones.Hips)?.[0];
    if (r0) { b.p.bones.Hips.position.x = r0.x; b.p.bones.Hips.position.z = r0.z; }
  };

  /** An outfield man's moves, Motion: Mocap. Runs the mixer itself. */
  const moveMocap = (b: Body, fig: EngineFrameFigure, f: EngineFrame, dt: number, sp: number, want: number | null) => {
    const u = sp / (b.k * figNow());
    const onceActive = () => {
      if (!b.state.startsWith("once:")) return false;
      const n = b.state.slice(5), a = b.p.actions[n];
      return !!a && a.time < clipDur(b, n) - 0.05;
    };
    // turning
    if (!b.turn && want !== null) {
      const d = wrapPi(want - b.yaw);
      const aiming = fig.sid === "you" && (!!f.aim || f.phase === "aim" || f.phase === "runup" || f.phase === "contact");
      if (!aiming && !onceActive() && !b.windup && sp < MO.turnClipBelow && Math.abs(d) > MO.turnClipMin && f.t >= b.turnReady) startTurn(b, d, f.t);
      else turnTo(b, want, dt, sp > 0.7 ? 7 : 4);
    }
    // the kick: your own swing, off the right foot or the left
    let started = false;
    const foot = fig.kickFoot < 0 && b.play.has("kick_l") ? "kick_l" : "shot_r";
    const ki = info(foot), contact = ki?.contact ?? 0.42;
    if (fig.sid === "you" && !fig.kick && f.phase === "contact" && b.play.has(foot)) {
      // the strike screen is up: the kick is coming. Plant and backswing, then hold it there.
      if (b.windup !== foot) {
        if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
        b.play.play(foot, { fade: 0.2, from: Math.max(0, contact - MO.windup), speed: 0.8, once: true });
        b.state = `wind:${foot}`; b.windup = foot;
      }
      const a = b.p.actions[foot];
      if (a.time >= contact - MO.windupHold) { a.time = contact - MO.windupHold; a.timeScale = 0; }
    }
    if (fig.kick && !b.kicking && b.play.has(foot)) {
      if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
      const a = b.p.actions[foot];
      if (b.windup === foot && b.state === `wind:${foot}`) a.timeScale = MO.lateSpeed; // loaded: swing through now
      else b.play.play(foot, { fade: 0.12, from: Math.max(0, contact - MO.lateStart), speed: MO.lateSpeed, once: true });
      b.state = `once:${foot}`;
      const sr = info("shot_r");
      b.kickOff = foot === "kick_l" && ki?.ball && sr?.ball ? [ki.ball[0] - sr.ball[0], ki.ball[1] - sr.ball[1]] : undefined;
      started = true;
    }
    if (!fig.kick && b.windup && !(fig.sid === "you" && f.phase === "contact")) { b.windup = undefined; if (b.state.startsWith("wind:")) b.state = ""; }
    if (fig.kick && b.windup) b.windup = undefined;
    b.kicking = fig.kick;
    // back to normal speed once the foot has reached the ball
    if (b.state === `once:${foot}`) { const a = b.p.actions[foot]; if (a.time >= contact) a.timeScale = 1; }
    if (!started && fig.act && fig.act.start !== b.lastAct) {
      b.lastAct = fig.act.start;
      const c = clipForAct(b, fig.act.kind, fig.act.mode);
      if (c) {
        if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
        started = startOnce(b, c, Math.max(0, f.t - fig.act.start));
      }
    }
    if (!f.goalSide) b.shotDone = undefined;
    if (!started && !onceActive() && !b.turn && !b.state.startsWith("wind:")) {
      if (f.goalSide && ((f.goalSide === "us") === (fig.team === "us"))) oneShotThenIdle(b, b.play.has("celebrate_jump") ? "celebrate_jump" : "celebrate_fist");
      else if (f.goalSide && b.play.has("dejected") && sp < 0.5) oneShotThenIdle(b, "dejected");
      else startLoopM(b, gaitFor(b, sp, u));
    }
    // a stride as long as his drawn legs: the feet stay where they land
    const cs = info(b.state)?.speed;
    if (LOCO.has(b.state) && typeof cs === "number" && cs > 0) b.p.actions[b.state].timeScale = Math.max(0.5, Math.min(1.6, u / cs));
    b.play.update(dt);
    b.p.mixer.update(dt);
    settleTurn(b, sp);
  };

  /** The keeper, Motion: Mocap. Runs the mixer itself; returns how far a high dive lifts him. */
  const keeperMocap = (b: Body, k: NonNullable<EngineFrame["keeper"]>, f: EngineFrame, dt: number, cut: boolean): number => {
    turnTo(b, 0, dt, 6);
    let lift = 0;
    if (cut && b.state.startsWith("dive:")) { b.state = ""; startLoopM(b, "ready_shuffle", 0); }
    const diving = k.saveLunge > 0.04 && k.saveDir !== 0;
    if (diving || b.dive) {
      // facing out (+y), his left is +x. Low, high or middle, as the 2D save is.
      const side = k.saveDir > 0 ? "left" : "right";
      const kindClip = k.saveKind === "low" ? `dive_${side}_low` : k.saveKind === "high" || k.saveKind === "fingertip" ? `dive_${side}_high` : `dive_${side}`;
      const clip = b.dive?.clip ?? (b.play.has(kindClip) ? kindClip : `dive_${side}`);
      const ci = info(clip);
      if (ci && b.play.has(clip)) {
        const launch = (ci.launch as number) ?? 0.12, reach = ci.contact ?? 0.42, land = (ci.land as number) ?? 0.7;
        const getUp = (ci.getUp as number | undefined) ?? land + 0.4;
        const dur = clipDur(b, clip);
        // from his set position (the crouch and push are in the clip), never a jump straight to the launch
        if (!b.dive) { b.play.play(clip, { fade: MO.diveFade, from: 0.02, once: true }); b.state = `dive:${clip}`; b.dive = { clip, full: false }; }
        const a = b.p.actions[clip];
        if (!b.dive.full) {
          // follow the 2D lunge, but never faster than a real dive
          const target = k.saveLunge >= 0.985 ? reach : launch + Math.min(1, k.saveLunge) * (reach - launch);
          a.timeScale = 0;
          if (target > a.time) a.time = Math.min(target, a.time + dt * MO.diveCatchUp);
          if (k.saveLunge >= 0.985 && a.time >= reach - 1e-3) b.dive.full = true;
        }
        if (b.dive.full) a.timeScale = 1;
        if (k.saveKind === "high" || k.saveKind === "fingertip") {
          const s = Math.max(0, Math.min(1, (a.time - launch) / (land - launch)));
          lift = (clip.endsWith("_high") ? 0.3 : 0.55) * Math.sin(s * Math.PI);
        }
        // a new chance: he gets up now (the clip's own get-up), not a slide from lying to standing
        if (!diving && k.saveLunge === 0 && k.saveKind === null) {
          b.dive.full = true;
          if (a.time < getUp) a.time = getUp;
          a.timeScale = 1.5;
        }
        // up again: back to his set position
        if (a.time >= dur - 0.05) { b.dive = undefined; b.state = ""; startLoopM(b, "ready_shuffle", 0.3); }
      } else b.dive = undefined;
    } else {
      const fs = figNow() * KEEPER_SHARE;
      if (k.act && k.act.start !== b.lastAct) {
        b.lastAct = k.act.start;
        if (k.act.save === "catch" && f.ball && f.ball.z > 1.5) startOnce(b, "high_claim", Math.max(0, f.t - k.act.start));
      }
      if (b.onceLeft > 0) b.onceLeft -= dt;
      if (!(b.state.startsWith("once:") && b.onceLeft > 0)) {
        // along his line: real side steps (his left is +x), a shuffle when it's quick; else set and alive
        const ux = Math.abs(b.vx) / (b.k * fs);
        b.side = Math.abs(b.vx) > (b.side ? 0.2 : 0.35) && Math.abs(b.vx) > Math.abs(b.vy);
        if (Math.hypot(b.vx, b.vy) > 2.6 && !b.side) startLoopM(b, "jog");
        else if (b.side) {
          const quick = ux > 2;
          const n = `${quick ? "shuffle" : "side_step"}_${b.vx > 0 ? "l" : "r"}`;
          startLoopM(b, b.play.has(n) ? n : "ready_shuffle", 0.2);
          const cs = info(n)?.speed;
          if (b.state === n && typeof cs === "number") b.p.actions[n].timeScale = Math.max(0.6, Math.min(1.8, ux / cs));
        } else startLoopM(b, "ready_shuffle");
      }
    }
    b.play.update(dt);
    b.p.mixer.update(dt);
    return lift;
  };

  /** One outfield man for this frame. */
  const placeFigure = (fig: EngineFrameFigure, f: EngineFrame, dt: number, frameNo: number, at: { x: number; y: number }) => {
    // Faces: off. Photos fitted for a head seen face-on read as a pale mask from
    // this high camera (seen in the stills); at 60 px a plain head reads better.
    const b = bodyFor(fig.sid, fig.shirt, fig.shorts, faces ? fig.face : undefined);
    b.seen = frameNo;
    const jump = Math.hypot(at.x - b.x, at.y - b.y);
    if (!b.init || jump > 4) { b.x = at.x; b.y = at.y; b.vx = 0; b.vy = 0; b.init = true; }
    else if (dt > 0) {
      const k = Math.min(1, dt * 8);
      b.vx += ((at.x - b.x) / dt - b.vx) * k; b.vy += ((at.y - b.y) / dt - b.vy) * k;
      b.x = at.x; b.y = at.y;
    }
    const sp = Math.hypot(b.vx, b.vy);
    // facing: where he runs, else the ball, else up the pitch
    const bl = f.ball;
    let want: number | null = null;
    if (sp > 0.7) want = yawOf(Math.atan2(b.vy, b.vx));
    else if (fig.sid === "you" && f.aim) want = yawOf(Math.atan2(f.aim.to.y - f.aim.from.y, f.aim.to.x - f.aim.from.x));
    else if (fig.sid === "you" && (f.phase === "aim" || f.phase === "runup")) want = yawOf(Math.atan2(0 - b.y, CX - b.x));
    else if (bl && Math.hypot(bl.x - b.x, bl.y - b.y) > 0.4) want = yawOf(Math.atan2(bl.y - b.y, bl.x - b.x));
    if (mo) moveMocap(b, fig, f, dt, sp, want);
    else {
    if (want !== null) turnTo(b, want, dt, sp > 0.7 ? 7 : 4);
    // what he is doing
    if (b.onceLeft > 0) b.onceLeft -= dt;
    const once = b.state.startsWith("once:") && b.onceLeft > 0;
    let started = false;
    if (fig.kick && !b.kicking) started = startOnce(b, "shot_r", 0.02);
    b.kicking = fig.kick;
    if (!started && fig.act && fig.act.start !== b.lastAct) {
      b.lastAct = fig.act.start;
      const c = clipForAct(b, fig.act.kind, fig.act.mode);
      if (c) started = startOnce(b, c, Math.max(0, f.t - fig.act.start));
    }
    if (!started && !once) {
      if (f.goalSide && ((f.goalSide === "us") === (fig.team === "us"))) startLoop(b, b.play.has("celebrate_jump") ? "celebrate_jump" : "celebrate_fist");
      else if (f.goalSide && b.play.has("dejected") && sp < 0.5) startLoop(b, "dejected");
      else if (sp < 0.35) startLoop(b, "idle");
      else startLoop(b, sp > 5.4 ? "sprint" : "jog");
    }
    const ls = loopSpeed[b.state];
    if (ls) { const a = b.p.actions[b.state]; if (a) a.timeScale = Math.max(0.55, Math.min(b.state === "sprint" ? 1.35 : 1.9, sp / ls)); }
    b.play.update(dt);
    b.p.mixer.update(dt);
    }
    // Mocap, a left-foot kick: kick_l's ball sits further on than shot_r's, so he stands back by the difference
    const off = mo && b.kickOff && b.state === "once:kick_l" ? b.kickOff : null;
    const fs = figNow();
    const ox = off ? (off[1] * Math.sin(b.yaw) + off[0] * Math.cos(b.yaw)) * b.k * fs : 0;
    const oz = off ? (off[1] * Math.cos(b.yaw) - off[0] * Math.sin(b.yaw)) * b.k * fs : 0;
    b.p.root.position.set(b.x - CX - ox, 0, b.y - oz);
    b.p.root.rotation.set(0, b.yaw, 0);
    b.p.root.scale.setScalar(fs);
    b.p.root.visible = true;
  };

  const placeKeeper = (k: NonNullable<EngineFrame["keeper"]>, f: EngineFrame, dt: number, frameNo: number) => {
    const b = bodyFor("keeper", k.shirt, k.shorts, faces ? k.face : undefined);
    b.seen = frameNo;
    const jump = Math.hypot(k.x - b.x, k.y - b.y);
    const cut = !b.init || jump > 4;
    if (!b.init || jump > 4) { b.x = k.x; b.y = k.y; b.vx = 0; b.vy = 0; b.init = true; b.dive = undefined; }
    else if (dt > 0) {
      const kk = Math.min(1, dt * 8);
      b.vx += ((k.x - b.x) / dt - b.vx) * kk; b.vy += ((k.y - b.y) / dt - b.vy) * kk;
      b.x = k.x; b.y = k.y;
    }
    let lift = 0;
    if (mo) lift = keeperMocap(b, k, f, dt, cut);
    else {
    // square to the pitch, out of his goal
    turnTo(b, 0, dt, 6);
    const diving = k.saveLunge > 0.04 && k.saveDir !== 0;
    if (diving || b.dive) {
      // facing out (+y), his left is +x
      const clip = b.dive?.clip ?? (k.saveDir > 0 ? "dive_left" : "dive_right");
      const ci = info(clip);
      if (ci && b.play.has(clip)) {
        const launch = (ci.launch as number) ?? 0.12, reach = ci.contact ?? 0.42, land = (ci.land as number) ?? 0.7;
        if (!b.dive) { b.play.play(clip, { fade: 0.06, from: launch, once: true }); b.state = `dive:${clip}`; b.dive = { clip, full: false }; }
        const a = b.p.actions[clip];
        if (!b.dive.full && k.saveLunge < 0.985) { a.time = launch + Math.min(1, k.saveLunge) * (reach - launch); a.timeScale = 0; }
        else { b.dive.full = true; a.timeScale = 1; }
        if (k.saveKind === "high" || k.saveKind === "fingertip") {
          const s = Math.max(0, Math.min(1, (a.time - launch) / (land - launch)));
          lift = 0.55 * Math.sin(s * Math.PI);
        }
      } else b.dive = undefined;
      // a new chance stands him back up
      if (!diving && k.saveLunge === 0 && k.saveKind === null) { b.dive = undefined; startLoop(b, "ready_shuffle"); }
    } else {
      const sp = Math.hypot(b.vx, b.vy);
      if (k.act && k.act.start !== b.lastAct) {
        b.lastAct = k.act.start;
        if (k.act.save === "catch" && f.ball && f.ball.z > 1.5) startOnce(b, "high_claim", Math.max(0, f.t - k.act.start));
      }
      if (!(b.state.startsWith("once:") && b.onceLeft > 0)) startLoop(b, sp > 2.2 ? "jog" : "ready_shuffle");
      if (b.state === "ready_shuffle") { const a = b.p.actions.ready_shuffle; if (a) a.timeScale = 0.7; }
      if (b.onceLeft > 0) b.onceLeft -= dt;
    }
    b.play.update(dt);
    b.p.mixer.update(dt);
    }
    b.p.root.position.set(b.x - CX, lift, b.y);
    b.p.root.rotation.set(0, b.yaw, 0);
    b.p.root.scale.setScalar(figNow() * (camMode === "tv" && tv.init && realCameraLook() === "new" ? 1 : KEEPER_SHARE));
    b.p.root.visible = true;
  };

  // ── the look: H (style3d/real) or one of the kit styles with its stadium ──
  const restyle = () => {
    if (!kit) return;
    kit.apply(def);
    if (stadium) { root.remove(stadium.group); stadium = null; }
    const tk = ++hToken;
    const all = list.map((b) => b.p);
    if (def.real) {
      kit.setActive(false);
      const tod = hTod ?? def.real;
      if (h) { h.setTod(tod); return; }
      void import("./real/look").then(({ createRealLook }) => createRealLook(THREE, renderer, scene, tier, { tod, ball, colours: { home: "#d62828", home2: "#f4f4f4", away: "#1d4ed8" } }))
        .then((made) => {
          if (tk !== hToken || !def.real) { made.dispose(); return; }
          h = made;
          ballShadow.visible = false;
          h.dressPeople(list.map((b) => b.p));
          for (const b of list) { const raw = b.p.body.material as any; for (const m of Array.isArray(raw) ? raw : [raw]) if (m) { m.roughness = 0.62; m.metalness = 0; } }
          warmPeople();
          (window as unknown as { __engineView3dReady?: boolean }).__engineView3dReady = true;
        })
        .catch((e) => console.error("look H failed to load", e));
      return;
    }
    if (h) { h.dispose(); h = null; ballShadow.visible = true; }
    kit.setActive(true);
    kit.stylePeople(all);
    stadium = buildStadium(THREE, kit, tier);
    root.add(stadium.group);
    (window as unknown as { __engineView3dReady?: boolean }).__engineView3dReady = true;
  };
  /**
   * Build every shader a man needs before the first chance (9 Oct 2026: the
   * first man of a match compiled his shaders mid-play). One spare is dressed
   * as a player, shown for a one-pixel draw while the scene compiles, then
   * put back.
   */
  function warmPeople() {
    const p = spares.pop();
    if (!p) return;
    dressPerson3d(THREE, p, { skin: SKINS[0], hair: "#1b120c", kit: { shirt: "#d62828", trim: "#f4f4f4" }, number: numberTex(9), accessories: [] });
    kit?.stylePeople([p]);
    h?.dressPeople([p]);
    const raw = p.body.material as any;
    for (const m of Array.isArray(raw) ? raw : [raw]) if (m) { m.roughness = 0.62; m.metalness = 0; solidBody(m, playerLightLook() === "new"); }
    root.add(p.root);
    p.root.visible = true;
    p.root.position.set(0, 0, 30);
    camera.updateMatrixWorld();
    void warmUp(THREE, renderer, scene, camera, { timeoutMs: 6000 }).finally(() => { p.root.visible = false; root.remove(p.root); spares.push(p); });
  }
  restyle();
  gov.apply();
  if (def.real) {
    // the ball's look H dressing, kept across style changes
    const { dressHBall } = await import("./real/ball");
    hball = dressHBall(THREE, ball, root);
  }

  // ── the camera: the 2D canvas's tilt, as a pinhole (see the top of the file) ──
  const tmpV = new THREE.Vector3();
  let lean = 0;
  let down3 = new THREE.Vector3(0, 0, 1);
  /** The 2D canvas's own camera, exactly (every spot on the grass on the same pixel). */
  const placeExactCamera = (f: EngineFrame) => {
    const { viewport: v, facing, tilt, W, H } = f.cam;
    if (!(W > 0 && H > 0)) return;
    const spanX = v.x2 - v.x1, spanY = v.y2 - v.y1;
    // canvas right / down as pitch directions, and pixels per metre
    let right: [number, number], down: [number, number], k: number;
    if (facing === "right") { right = [0, -1]; down = [1, 0]; k = (W / spanY + H / spanX) / 2; }
    else if (facing === "left") { right = [0, 1]; down = [-1, 0]; k = (W / spanY + H / spanX) / 2; }
    else { right = [1, 0]; down = [0, 1]; k = (W / spanX + H / spanY) / 2; }
    void right;
    const th = tilt ? (tilt.deg * Math.PI) / 180 : 0;
    const d = tilt ? tilt.d : 1.4 * H;
    const s = tilt ? tilt.s : 1;
    const D = d / (s * k);
    const cx = (v.x1 + v.x2) / 2 - CX, cz = (v.y1 + v.y2) / 2;
    down3 = new THREE.Vector3(down[0], 0, down[1]);
    camera.position.set(cx + down3.x * D * Math.sin(th), D * Math.cos(th), cz + down3.z * D * Math.sin(th));
    camera.up.set(-down3.x, 0, -down3.z);
    if (th > 1e-3) camera.up.set(-down3.x * Math.cos(th), Math.sin(th), -down3.z * Math.cos(th));
    camera.lookAt(cx, 0, cz);
    camera.fov = (2 * Math.atan(H / (2 * d)) * 180) / Math.PI;
    camera.aspect = W / H;
    camera.near = Math.max(0.1, D * 0.05);
    camera.far = D + 500;
    camera.updateProjectionMatrix();
    lean = (Math.max(0, 90 - (th * 180) / Math.PI) * LEAN_SHARE * Math.PI) / 180;
  };
  /**
   * THE TV CAMERA: goal at the top, the ball and you in the lower middle,
   * about 24 m of pitch across at the action, at the page's tilt. It follows
   * play smoothly and cuts on a new chance. Side-on chances (corners, byline
   * crosses) keep the 2D's own side-on camera.
   */
  const tv = { x: 0, z: 0, D: 60, th: 0.7, key: "", init: false };
  /** The new camera's men, keeper and ball (× life size). Test page: ?fig=1 (true size) to compare. */
  const FIG_NEW = (() => {
    const q = typeof window === "undefined" ? NaN : Number(new URLSearchParams(window.location.search).get("fig"));
    return q >= 0.8 && q <= 2.6 ? q : TV_CAMERA_NEW.fig;
  })();
  /** The TV camera's figure scale this frame (see TARGET_PX). */
  let tvFig = ENGINE_VIEW_FIG_SCALE;
  const figNow = () => (camMode === "tv" && tv.init ? tvFig : figScale);
  type TvCam = typeof TV_CAMERA & { pinBottom?: number };
  /** The TV camera for this frame at angle `thDeg`, framing `pts` with the numbers in C. */
  const tvSolveAt = (f: EngineFrame, C: TvCam, thDeg: number, pts: { x: number; y: number }[], nu: boolean) => {
    const { W, H } = f.cam;
    const th = (Math.max(5, Math.min(70, thDeg)) * Math.PI) / 180;
    const hv = (TV_CAMERA.fov * Math.PI) / 360;
    const hh = Math.atan(Math.tan(hv) * (W / H));
    const vp = f.cam.viewport;
    const ball = f.ball ?? { x: (vp.x1 + vp.x2) / 2, y: (vp.y1 + vp.y2) / 2 };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const lx = Math.max(-34 + 6, Math.min(34 - 6, (x0 + x1) / 2 - CX));
    // ground point (along the pitch) at screen share `fr` from the top: and back
    const shareOf = (zg: number, lookZ: number, D: number) => {
      const hc = D * Math.cos(th), camZ = lookZ + D * Math.sin(th);
      const phi = Math.atan2(camZ - zg, hc);
      return (1 - Math.tan(phi - th) / Math.tan(hv)) / 2;
    };
    const lookFor = (zg: number, fr: number, D: number) => {
      const hc = D * Math.cos(th);
      const phi = th + Math.atan((1 - 2 * fr) * Math.tan(hv));
      return zg + hc * Math.tan(phi) - D * Math.sin(th);
    };
    const dFor = (w: number) => w / 2 / Math.tan(hh);
    const Dmin = dFor(C.minViewW), Dmax = dFor(C.maxViewW);
    const topAt = f.goalInView ? C.goalLineAt : C.top;
    // where the camera looks for distance D: the goal end pinned near the top,
    // or (no goal) the group centred — or, new camera, the nearest man pinned near the bottom
    const lzFor = (D: number) => {
      if (f.goalInView) return lookFor(y0, topAt, D);
      if (nu && C.pinBottom) return lookFor(y1, C.pinBottom, D);
      let fr = C.top;
      for (let i = 0; i < 3; i++) {
        const lzi = lookFor(y0, fr, D);
        const mid = (shareOf(y0, lzi, D) + shareOf(y1, lzi, D)) / 2;
        fr = Math.max(0.04, Math.min(0.5, fr + (C.centre - mid)));
      }
      return lookFor(y0, fr, D);
    };
    // Everyone actually on the glass (projected through this camera, not
    // estimated at the look point: the action is beyond it, where the
    // picture is wider). Closest camera that fits, so the men are big.
    const tH = Math.tan(hv), tW = Math.tan(hh), sn = Math.sin(th), cs = Math.cos(th);
    const xMargin = 1 - (2 * C.marginPx) / Math.max(1, W);
    const shareAt = (q: { x: number; y: number }, D: number, lz: number) => {
      const cy = D * cs, cz = lz + D * sn;
      const vx = q.x - CX - lx, vy = -cy, vz = q.y - cz;
      const depth = -cs * vy - sn * vz;
      if (depth <= 0.1) return null;
      return { nx: vx / (depth * tW), fr: (1 - (sn * vy - cs * vz) / (depth * tH)) / 2 };
    };
    const fitsAll = (D: number) => {
      const lz = lzFor(D);
      for (const q of pts) {
        const s = shareAt(q, D, lz);
        if (!s) return false;
        if (Math.abs(s.nx) > xMargin || s.fr > C.bottom) return false;
        if (nu && !f.goalInView && s.fr < C.top) return false;
      }
      return true;
    };
    let lo = Math.min(Dmin, dFor(10)), hi = Dmax;
    if (fitsAll(lo)) hi = lo;
    else if (!fitsAll(hi)) lo = hi;
    else for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fitsAll(m)) hi = m; else lo = m; }
    const D = hi;
    const lz = lzFor(D);
    // how far the action is from the camera (the men are sized there, not at the look point)
    const ballDepth = (() => { const cy = D * cs, cz = lz + D * sn; return Math.max(1, cs * cy - sn * (ball.y - cz)); })();
    // the lowest point of the framed action on the screen (share of the height)
    let low = 0;
    for (const q of pts) { const s = shareAt(q, D, lz); if (s) low = Math.max(low, s.fr); }
    return { x: lx, z: lz, D, th, fov: TV_CAMERA.fov, W, H, ballDepth, low };
  };
  const tvSolve = (f: EngineFrame) => {
    const nu = realCameraLook() === "new";
    const vp = f.cam.viewport;
    const ball = f.ball ?? { x: (vp.x1 + vp.x2) / 2, y: (vp.y1 + vp.y2) / 2 };
    const extra: { x: number; y: number }[] = [];
    if (f.goalInView) extra.push({ x: CX - 4.5, y: -0.5 }, { x: CX + 4.5, y: -0.5 });
    if (f.keeper) extra.push({ x: f.keeper.x, y: f.keeper.y });
    if (!nu) {
      // Old: everyone in the chance, the ball, and the goal mouth when the goal is in it:
      // all of it on the screen, centred, as close as that allows.
      const pts = [{ x: ball.x, y: ball.y }, ...f.figures.map((g) => ({ x: g.x, y: g.y })), ...extra];
      return tvSolveAt(f, TV_CAMERA, tvTilt, pts, false);
    }
    // New: the action only (see TV_CAMERA_NEW); the rest may go off screen.
    // Framed inside the part of the pitch box the phone actually shows, so the
    // play is never under the fold (Harry, 9 Oct 2026: "you can't see the full
    // pitch at once" — the box is taller than the screen under the test page's
    // controls, and a touch on the pitch cannot scroll the page).
    const vis = (() => {
      const r = container.getBoundingClientRect();
      if (!(r.height > 0) || typeof window === "undefined") return { a: 0, b: 1 };
      const a = Math.max(0, Math.min(0.5, -r.top / r.height));
      const b = Math.max(0.5, Math.min(1, (window.innerHeight - r.top) / r.height));
      return { a, b };
    })();
    const sh = (v: number) => vis.a + v * (vis.b - vis.a);
    const N = { ...TV_CAMERA_NEW, top: sh(TV_CAMERA_NEW.top), bottom: sh(TV_CAMERA_NEW.bottom), goalLineAt: sh(TV_CAMERA_NEW.goalLineAt), goalLineMax: sh(TV_CAMERA_NEW.goalLineMax), pinBottom: sh(TV_CAMERA_NEW.pinBottom), fillTo: sh(TV_CAMERA_NEW.fillTo) };
    const near = (g: { x: number; y: number }) => Math.hypot(g.x - ball.x, g.y - ball.y);
    const them = f.figures.filter((g) => g.team === "them" && near(g) <= N.nearR)
      .sort((a, b) => near(a) - near(b)).slice(0, N.nearDefenders);
    // our men in the move (the pass is to them) stay on; their far men may go
    const action = f.figures.filter((g) => g.sid === "you" || them.includes(g) || near(g) <= N.closeR
      || (g.team === "us" && near(g) <= N.mateR));
    const pts = [{ x: ball.x, y: ball.y }, ...action.map((g) => ({ x: g.x, y: g.y })), ...extra];
    const base = tvTilt + N.tiltAdd;
    // No goal: the nearest man is pinned near the bottom (no grass under him).
    // Goal in view: the goal line is pinned near the top and the whole goal mouth
    // must fit across, so on a tall phone a chance 11–12 m out cannot reach the
    // bottom. Then the goal line comes down a little (more crowd above the net,
    // less grass under the men), never past `goalLineMax`.
    let t = tvSolveAt(f, N, base, pts, true);
    if (f.goalInView && t.low < N.fillTo) {
      const g = Math.min(N.goalLineMax, N.goalLineAt + (N.fillTo - t.low));
      t = tvSolveAt(f, { ...N, goalLineAt: g }, base, pts, true);
    }
    return t;
  };
  const placeTvCamera = (f: EngineFrame, dt: number) => {
    const t = tvSolve(f);
    (window as unknown as { __tvSolve?: unknown }).__tvSolve = { D: t.D, thDeg: (t.th * 180) / Math.PI, low: t.low, goal: f.goalInView };
    // a new chance (or a cut in the 2D) cuts here too
    const vp = f.cam.viewport;
    const key = `${f.kind}|${Math.round(vp.x1)}|${Math.round(vp.y1)}|${Math.round(vp.x2)}|${Math.round(vp.y2)}`;
    if (!tv.init || key !== tv.key) { tv.x = t.x; tv.z = t.z; tv.D = t.D; tv.th = t.th; tv.key = key; tv.init = true; }
    else {
      const k = Math.min(1, dt * 2.5);
      tv.x += (t.x - tv.x) * k; tv.z += (t.z - tv.z) * k; tv.D += (t.D - tv.D) * k;
      // the new camera's angle moves with the play (smoothly); the old one is the dial's
      tv.th = realCameraLook() === "new" ? tv.th + (t.th - tv.th) * k : t.th;
    }
    t.th = tv.th;
    down3 = new THREE.Vector3(0, 0, 1);
    camera.position.set(tv.x, tv.D * Math.cos(t.th), tv.z + tv.D * Math.sin(t.th));
    camera.up.set(0, Math.sin(t.th), -Math.cos(t.th));
    camera.lookAt(tv.x, 0, tv.z);
    camera.fov = t.fov;
    camera.aspect = t.W / t.H;
    camera.near = Math.max(0.1, tv.D * 0.05);
    camera.far = tv.D + 500;
    camera.updateProjectionMatrix();
    lean = (Math.max(0, 90 - (t.th * 180) / Math.PI) * LEAN_SHARE * Math.PI) / 180;
    // men at the 2D match screen's size whatever the zoom: a man ~TARGET_PX tall at the action
    const pxPerM = t.H / (2 * t.ballDepth * Math.tan((t.fov * Math.PI) / 360));
    // an upright man is foreshortened by sin(tilt) from this camera
    tvFig = Math.max(1, Math.min(2.6, TARGET_PX / (1.8 * pxPerM * Math.max(0.35, Math.sin(t.th)))));
    // New camera: men, keeper and ball near TRUE size against the goal (Harry, 9 Oct 2026:
    // "the players and goalie should be a lot smaller in game, with the ball as well").
    // One fixed size: 1.6 → a 2.9 m man (Harry: 1.15 was "a bit TOO small", a third of the way
    // back towards the old size; the old camera drew him
    // 1.3–2.6× → 2.3–4.7 m, the keeper 0.85 of that).
    if (realCameraLook() === "new") tvFig = FIG_NEW;
  };
  const placeCamera = (f: EngineFrame, dt: number) => {
    if (camMode === "tv" && f.cam.facing === "up") placeTvCamera(f, dt);
    else { tv.init = false; placeExactCamera(f); }
  };

  // ── touch: the 3D picture's grass → the 2D canvas's pixel for the same spot ──
  // The 2D canvas (invisible, underneath) is the game: every touch is handed to
  // it at the spot of grass under the finger. A shot's drag keeps the finger's
  // own travel on the glass (so it kicks exactly as hard as the same drag in
  // the 2D game) and its direction on the grass (so it aims where it points).
  let lastFrame: EngineFrame | null = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const groundAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const r = container.getBoundingClientRect();
    if (!(r.width > 0)) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x + CX, y: hit.z };
  };
  const to2dClient = (p: { x: number; y: number }): { x: number; y: number } | null => {
    const f = lastFrame;
    if (!f) return null;
    const v = f.cam.viewport, fc = f.cam.facing, r = container.getBoundingClientRect();
    const fx = (p.x - v.x1) / (v.x2 - v.x1), fy = (p.y - v.y1) / (v.y2 - v.y1);
    const sx = fc === "right" ? 1 - fy : fc === "left" ? fy : fx;
    const sy = fc === "right" ? fx : fc === "left" ? 1 - fx : fy;
    const g = canvasToScreen(f.cam.tilt, sx, sy, f.cam.W, f.cam.H);
    return { x: r.left + g.X, y: r.top + g.Y };
  };
  const touch = { id: -1, start3: { x: 0, y: 0 }, start2: { x: 0, y: 0 }, g0: { x: 0, y: 0 }, shot: false, mate: false, last: 0 };
  const send = (type: string, e: PointerEvent, at: { x: number; y: number }) => {
    const c = o.canvas2d;
    if (!c) return;
    c.dispatchEvent(new PointerEvent(type, {
      clientX: at.x, clientY: at.y, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
      button: e.button, buttons: e.buttons, bubbles: true, cancelable: true, composed: true,
    }));
  };
  /** How near the ball's picture a press grabs it, CSS px (a fingertip either side of a small ball). */
  const GRAB_PX = 48;
  /** Where the ball is on the glass right now (client px), or null. */
  const ballOnGlass = (): { x: number; y: number } | null => {
    if (!lastFrame?.ball || !ball.visible) return null;
    const r = container.getBoundingClientRect();
    const v = ball.position.clone().project(camera);
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  /**
   * A team-mate the captain can order, under a press on the glass (client px),
   * or null. A man here is drawn standing up and big, so a finger on his body
   * is on grass well behind his feet: the 2D game would never find him there.
   * So a press near his body AS SEEN (feet to head) picks him, and the 2D game
   * is pressed at his feet (Harry, 9 Oct 2026: captain orders in 3D).
   */
  const PICK_PX = 30;
  const mateOnGlass = (cx: number, cy: number): { x: number; y: number } | null => {
    const f = lastFrame;
    if (!f?.orders?.pickable.length) return null;
    const r = container.getBoundingClientRect();
    const toPx = (v: any) => ({ x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height });
    let best: { x: number; y: number } | null = null, bd = PICK_PX;
    for (const sid of f.orders.pickable) {
      const fig = f.figures.find((g) => g.sid === sid);
      const b = bodies.get(sid);
      if (!fig || !b || !b.p.root.visible) continue;
      const pos = b.p.root.position, h = 1.75 * (b.p.root.scale.y || 1);
      const a = toPx(tmpV.set(pos.x, 0, pos.z).project(camera)), c = toPx(tmpV.set(pos.x, h, pos.z).project(camera));
      // distance from the press to the line feet → head
      const vx = c.x - a.x, vy = c.y - a.y, l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((cx - a.x) * vx + (cy - a.y) * vy) / l2));
      const d = Math.hypot(cx - (a.x + vx * t), cy - (a.y + vy * t));
      if (d < bd) { bd = d; best = { x: fig.x, y: fig.y }; }
    }
    return best;
  };
  /** dev: where each orderable team-mate's chest is on the glass (client px), so a test bot can tap him as a player would. */
  const matesOnGlass = (f: EngineFrame): Record<string, { x: number; y: number }> => {
    const out: Record<string, { x: number; y: number }> = {};
    const r = container.getBoundingClientRect();
    for (const sid of f.orders?.pickable ?? []) {
      const b = bodies.get(sid);
      if (!b || !b.p.root.visible) continue;
      const p = b.p.root.position;
      tmpV.set(p.x, 1.1 * (b.p.root.scale.y || 1), p.z).project(camera);
      out[sid] = { x: r.left + (tmpV.x + 1) / 2 * r.width, y: r.top + (1 - tmpV.y) / 2 * r.height };
    }
    return out;
  };
  const onDown = (e: PointerEvent) => {
    if (!visible) return;
    // One finger at a time — but a touch that never ended here (its "up" went
    // elsewhere) must never lock the pitch: the same pointer pressing again, or
    // a touch silent for a second, starts afresh. (The bug behind "stuck on
    // round 2", 9 Oct 2026: the 2D canvas took the first touch's capture, its
    // "up" never came back here, and every later press was ignored.)
    if (touch.id !== -1 && touch.id !== e.pointerId && performance.now() - touch.last < 1000) return;
    const g = groundAt(e.clientX, e.clientY);
    const at = g && to2dClient(g);
    if (!g || !at) return;
    e.preventDefault();
    try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
    const f = lastFrame;
    touch.id = e.pointerId; touch.start3 = { x: e.clientX, y: e.clientY }; touch.start2 = at; touch.g0 = g;
    // a team-mate first (as the 2D game does: he takes priority over the ball)
    const mate = f?.phase === "aim" ? mateOnGlass(e.clientX, e.clientY) : null;
    const m2 = mate && to2dClient(mate);
    touch.mate = !!m2;
    if (m2 && mate) {
      touch.shot = false; touch.start2 = m2; touch.g0 = mate;
      touch.last = performance.now();
      send("pointerdown", e, m2);
      try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
      return;
    }
    // A press on or near the ball AS SEEN (its 3D picture, lifted off the grass
    // and drawn big) grabs the ball: the 2D game is pressed exactly on its own
    // ball, so the aim starts as surely as a press on the 2D ball does.
    const b3 = ballOnGlass();
    const nearBall = !!b3 && Math.hypot(e.clientX - b3.x, e.clientY - b3.y) <= GRAB_PX;
    touch.shot = !!f?.ball && f.phase === "aim" && (nearBall || Math.hypot(g.x - f.ball.x, g.y - f.ball.y) < 3.2);
    if (touch.shot && f?.ball) {
      const b2 = to2dClient(f.ball);
      if (b2) { touch.start2 = b2; touch.g0 = { x: f.ball.x, y: f.ball.y }; }
    }
    touch.last = performance.now();
    send("pointerdown", e, touch.start2);
    // The 2D canvas captures the pointer on its own pointerdown, which would
    // send the rest of this touch to it at the raw finger spot (not the
    // matching grass) and never back here. Take the capture back.
    try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  const moveTarget = (e: PointerEvent) => {
    const g = groundAt(e.clientX, e.clientY);
    // a team-mate picked: a tap stays on him (a lay-off); a drag sends him to the grass under the finger (a run)
    if (touch.mate && Math.hypot(e.clientX - touch.start3.x, e.clientY - touch.start3.y) < 14) return touch.start2;
    if (!touch.shot) return g ? to2dClient(g) : null;
    const len = Math.hypot(e.clientX - touch.start3.x, e.clientY - touch.start3.y);
    const a = to2dClient(touch.g0), b = g ? to2dClient(g) : null;
    if (!a || !b) return null;
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy);
    if (dl < 1e-6) return touch.start2;
    return { x: touch.start2.x + (dx / dl) * len, y: touch.start2.y + (dy / dl) * len };
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== touch.id) return;
    touch.last = performance.now();
    const at = moveTarget(e);
    if (at) send("pointermove", e, at);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== touch.id) return;
    const at = moveTarget(e) ?? touch.start2;
    touch.id = -1;
    send(e.type === "pointercancel" ? "pointercancel" : "pointerup", e, at);
  };
  if (o.canvas2d && camMode === "tv") {
    container.style.pointerEvents = "auto";
    container.style.touchAction = "none";
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
  }

  const leanQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3();
  /** Lean every man back from the camera (feet planted), for the picture only: shadows are drawn from them standing. */
  const leanAll = () => {
    axis.crossVectors(down3, Y).normalize();
    for (const b of list) {
      if (!b.p.root.visible) continue;
      yawQ.setFromAxisAngle(Y, b.yaw);
      leanQ.setFromAxisAngle(axis, lean);
      b.p.root.quaternion.copy(leanQ.multiply(yawQ));
    }
  };
  const standAll = () => { for (const b of list) b.p.root.rotation.set(0, b.yaw, 0); };

  // ── the arrow on the glass ──
  const toScreen = (x: number, y: number, W: number, H: number) => {
    tmpV.set(x - CX, 0, y).project(camera);
    return { X: (tmpV.x + 1) / 2 * W, Y: (1 - tmpV.y) / 2 * H };
  };
  const drawArrow = (f: EngineFrame) => {
    const a = f.aim;
    if (!a || f.phase === "contact") { svg.style.display = "none"; return; }
    svg.style.display = "";
    const { W, H } = f.cam;
    const p0 = toScreen(a.from.x, a.from.y, W, H), p1 = toScreen(a.to.x, a.to.y, W, H);
    const ang = Math.atan2(p1.Y - p0.Y, p1.X - p0.X);
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const len = Math.hypot(p1.X - p0.X, p1.Y - p0.Y) || 1;
    // the 2D arrow's own proportions (CanvasMatch drawAimArrow), in CSS px
    const headLen = Math.max(W * 0.02, Math.min(len * 0.45, W * 0.045));
    const headHalf = W * 0.022, shaftW = W * 0.014;
    const bx = p1.X - ux * headLen, by = p1.Y - uy * headLen;
    gradEl.setAttribute("x1", `${p0.X}`); gradEl.setAttribute("y1", `${p0.Y}`); gradEl.setAttribute("x2", `${p1.X}`); gradEl.setAttribute("y2", `${p1.Y}`);
    shaftEl.setAttribute("x1", `${p0.X}`); shaftEl.setAttribute("y1", `${p0.Y}`); shaftEl.setAttribute("x2", `${bx}`); shaftEl.setAttribute("y2", `${by}`);
    shaftEl.setAttribute("stroke-width", `${shaftW}`);
    headEl.setAttribute("points", `${p1.X},${p1.Y} ${bx + nx * headHalf},${by + ny * headHalf} ${bx - nx * headHalf},${by - ny * headHalf}`);
    headEl.setAttribute("stroke-width", `${Math.max(1, W * 0.004)}`);
  };

  let lastT: number | null = null;
  let frameNo = 0;
  let cheered = false;
  let size = { w: 0, h: 0 };
  return {
    frame(f) {
      frameNo++;
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, f.t - lastT));
      lastT = f.t;
      if (!visible) return;
      gov.frame(performance.now());
      topUpSpares();
      const cw = container.clientWidth, ch = container.clientHeight;
      if (cw !== size.w || ch !== size.h) { size = { w: cw, h: ch }; renderer.setSize(Math.max(1, cw), Math.max(1, ch), false); }
      lastFrame = f;
      placeCamera(f, dt);
      {
        // the rim light sits beyond the play, opposite the camera, low
        const lx = camera.position.x, lz = camera.position.z;
        const tx = (f.cam.viewport.x1 + f.cam.viewport.x2) / 2 - CX, tz = (f.cam.viewport.y1 + f.cam.viewport.y2) / 2;
        const dx = tx - lx, dz = tz - lz, dl = Math.hypot(dx, dz) || 1;
        rimLight.position.set(tx + (dx / dl) * 60, 9, tz + (dz / dl) * 60);
        rimLight.target.position.set(tx, 1, tz);
        rimLight.intensity = def.real ? 0.9 : 0.5;
      }
      // people
      const you = f.figures.find((g) => g.sid === "you");
      for (const g of f.figures) {
        let at = { x: g.x, y: g.y };
        // open play: the 2D picture lets the ball be you; here you stand over it, just off its left
        if (g === you && !g.drawn && f.ball) {
          const b0 = bodies.get("you");
          const onBall = f.phase === "aim" || f.phase === "contact" || f.phase === "runup";
          at = onBall || !b0 ? { x: f.ball.x - 0.55, y: f.ball.y + 0.42 } : { x: b0.x, y: b0.y };
        }
        placeFigure(g, f, dt, frameNo, at);
      }
      if (f.keeper) placeKeeper(f.keeper, f, dt, frameNo);
      for (const b of list) if (b.seen !== frameNo) { b.p.root.visible = false; b.init = false; b.dive = undefined; }
      {
        // "3D player light": the players' own key, rim and shade (see solidBody)
        const solidOn = playerLightLook() === "new";
        const sd = TODS[h?.tod ?? hTod ?? (def.real || "day")]?.sunDir ?? TODS.day.sunDir;
        camera.updateMatrixWorld();
        solidU.uSolidRimDir.value.set(sd[0], sd[1], sd[2]).normalize().transformDirection(camera.matrixWorldInverse);
        let nFeet = 0;
        for (const b of list) {
          const m = b.p.body.material as any;
          solidBody(m, solidOn);
          const own = Array.isArray(m) ? undefined : m?.userData?.solidOwn;
          if (own) { own.uSolidBase.value = b.p.root.position.y; own.uSolidScale.value = b.p.root.scale.x || 1; }
          // the foot shades: one instanced draw for every man (9 Oct 2026: was a draw each)
          if (solidOn && b.p.root.visible && nFeet < FEET_MAX) {
            const sc = b.p.root.scale.x || 1;
            footE.set(-Math.PI / 2, 0, -b.yaw);
            footP.set(b.p.root.position.x, 0.02, b.p.root.position.z); footS.set(0.52 * sc, 0.4 * sc, 1);
            feet.setMatrixAt(nFeet++, footMx.compose(footP, footQ.setFromEuler(footE), footS));
          }
        }
        feet.count = nFeet;
        feet.instanceMatrix.needsUpdate = true;
      }
      // the ball
      const fb0 = f.ball;
      ball.visible = !!fb0;
      if (fb0) {
        // New camera: the ball at the men's own scale (0.22 m × the men's size: true proportions)
        const bs = camMode === "tv" && tv.init && realCameraLook() === "new" ? figNow() : def.ballScale * 0.85;
        ball.scale.setScalar(bs);
        const v = new THREE.Vector3(fb0.x - CX, Math.max(0, fb0.z) + BALL_R * bs, fb0.y);
        const dd = Number.isFinite(lastBall.x) ? v.distanceTo(lastBall) : 0;
        if (dd > 1e-4 && dd < 3) {
          const ax = new THREE.Vector3().subVectors(v, lastBall).cross(Y).normalize().negate();
          if (ax.lengthSq() > 0) ball.rotateOnWorldAxis(ax, dd / (BALL_R * bs));
        }
        lastBall.copy(v);
        ball.position.copy(v);
        ballShadow.position.set(v.x, 0.01, v.z);
        const kk = Math.max(0.35, 1 - fb0.z / 4);
        ballShadow.scale.setScalar(kk * bs); ballShadow.material.opacity = 0.32 * kk;
        hball?.update(dt, { x: fb0.vx, y: fb0.vz, z: fb0.vy });
      }
      ballShadow.visible = !!fb0 && !h;
      ring.visible = !!f.ring;
      if (f.ring) { ring.position.set(f.ring.x - CX, 0.02, f.ring.y); ring.scale.setScalar(figNow() * 0.8); }
      placeOrders(f);
      cross.visible = !!f.landing;
      if (f.landing) { cross.position.set(f.landing.x - CX, 0.02, f.landing.y); cross.scale.setScalar(figNow() * 0.6); }
      // the crowd goes up for a goal
      if (f.goalSide === "us" && !cheered) { cheered = true; h?.cheer(1); } else if (!f.goalSide) cheered = false;
      const focus = { x: (f.cam.viewport.x1 + f.cam.viewport.x2) / 2 - CX, z: (f.cam.viewport.y1 + f.cam.viewport.y2) / 2 };
      standAll();
      if (h) h.update(dt, camera, focus, fb0 ? { x: fb0.x - CX, y: fb0.y, z: fb0.z, vx: fb0.vx, vy: fb0.vy, vz: fb0.vz } : undefined);
      else kit?.update(dt, camera, { x: focus.x, y: 0, z: focus.z });
      stadium?.update(dt, f.t);
      drawArrow(f);
      // dev: where the 3D ball is on the glass (the filming tool drags from it)
      (window as unknown as { __engineView3dBall?: { x: number; y: number } | null }).__engineView3dBall = visible ? ballOnGlass() : null;
      // dev: how much of the screen below the lowest man (or ball) on it is empty grass (a share of the height)
      {
        let low = 0, on = 0, off = 0;
        const feet = (x: number, y: number, z: number) => {
          tmpV.set(x, z, y).project(camera);
          const sx = (tmpV.x + 1) / 2, sy = (1 - tmpV.y) / 2;
          if (sx < 0 || sx > 1 || sy < 0 || sy > 1) { off++; return; }
          on++; low = Math.max(low, sy);
        };
        for (const b of list) if (b.p.root.visible) feet(b.p.root.position.x, b.p.root.position.z, 0);
        if (fb0) feet(fb0.x - CX, fb0.y, 0);
        (window as unknown as { __engineView3dFrame?: unknown }).__engineView3dFrame = { emptyBelow: on ? 1 - low : 1, onScreen: on, offScreen: off, kind: f.kind, phase: f.phase, ballTo2d: fb0 ? to2dClient(fb0) : null, orders: f.orders ?? null, mates: matesOnGlass(f) };
      }
      // frame-stepped filming (lib/star/virtualClock.ts) draws only the frames it films
      if ((window as unknown as { __view3dSkipDraw?: boolean }).__view3dSkipDraw) { leanAll(); return; }
      if (f.phase === "contact" || f.phase === "fpDribble") return; // the strike screen (or the dribble run, its own picture) covers the pitch
      if (h) h.render(scene, camera, { beforeShadows: () => {}, afterShadows: leanAll });
      else { leanAll(); kit?.render(scene, camera); }
    },
    setStyle(d) {
      const wasReal = !!def.real;
      def = d;
      restyle();
      if (!!d.real !== wasReal) {
        if (d.real && !hball) void import("./real/ball").then(({ dressHBall }) => { if (def.real && !hball) hball = dressHBall(THREE, ball, root); });
        if (!d.real && hball) { hball.dispose(); hball = null; }
      }
    },
    setTod(t) { hTod = t; h?.setTod(t); },
    setFigureScale(k) { figScale = k; },
    setTilt(d) { tvTilt = d; },
    setVisible(on) { visible = on; gov.setPaused("hidden", !on); if (!on) (window as unknown as { __engineView3dBall?: unknown }).__engineView3dBall = null; container.style.pointerEvents = on && o.canvas2d && camMode === "tv" ? "auto" : "none"; canvas3d.style.visibility = on ? "" : "hidden"; svg.style.visibility = on ? "" : "hidden"; },
    dispose() {
      hToken++;
      gov.dispose();
      hball?.dispose(); hball = null;
      h?.dispose(); h = null;
      kit?.dispose(); kit = null;
      svg.remove();
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      release(root);
    },
  };
}
