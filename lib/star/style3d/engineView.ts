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
/** Your celebration on the spot turns back towards the middle of your half (y metres out from the goal line). */
const HALF_W_CELEB = 30;
import type { EngineFrame, EngineFrameFigure } from "../engineFrame";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer, disposeObject3D, flushReleased, warmUp } from "../three3d/perf";
import { Governor, governedPixelRatio } from "../three3d/governor";
import { installShadowCache } from "../three3d/shadowCache";
import { cullSkinned } from "../three3d/cullPeople";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, setToonBuild, setPeople3dOutlineRes, type Person3D, type PersonLook } from "../people3d";
import { people3dLook } from "../look3d";
import { matchPlayerStyle, matchPlayersStyleLook } from "./toon/matchLook";
import { HOME_MATCH_BUILD } from "./toon/shader";
import { playerLookFor } from "../playerLook";
import { TOON_PLAYER_HEADS, toonBodyFor, toonHeadFor, toonHairFor, toonSkinFor, toonYou, type ToonHead } from "./toon/bodies";
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
import { playerLightLook } from "./realGameLook";
import { followStep } from "./figureFollow";
import { kickStyleFor, type KickStyle } from "./kickStyle";
import { TODS } from "./real/tod";
import { bcPose } from "./broadcastCam";
import { SIZE3D } from "./size3d";
import { worldPack, onTexturePack } from "./texturePack";
import { SMALL_MEN } from "./smallMen";
import { camZoom, setCamZoom, camHeightTest, zoomCamera, lerpCamera } from "./camZoom";
/** Open play: the default 3D framing sits this much closer than the whole scenario (zoom 0 vs 1). */
/** Open play's default = the 2D's own frame of the same chance, exactly (Harry, 12 Oct 2026: a 0.85 zoom-in cut the taker off on tight angles and cutbacks). */
const OPEN_DEFAULT_K = 1;
import { solveMatch2D, groundUnder, visibleQuad, leanFor, MATCH2D, matchScale, usesSetPieceCam, solveSetPieceCam, setPieceKeep, usesCornerCam, solveCornerCam, SET_PIECE_CAM, CORNER_CAM, keepDragRoom, usesKindCam, solveKindCam, wideFromSide, ORBIT, clampOrbit, limitOrbit, orbitMaxFor, orbitCamera, centreShare, frameTurned, solveTurnFit, easeFit, type TurnFit, showsGoal, grabsBall, overheadClipAlong, overStand, TILT, clampTilt, tiltCamera, type Match2DCamera } from "./match2dCam";
import { shotTarget, stanceFor, approachSFor, runClipTime, runBlend } from "./setPiece3d";
import { hasRunup } from "../penaltyRunup";

export interface EngineView {
  /** Every frame the 2D picture draws (EngineFrameObserver.onFrame). */
  frame(f: EngineFrame): void;
  setStyle(def: StyleDef): void;
  setTod(t: TimeOfDay): void;
  /** The TV camera's angle, degrees from straight down. */
  setTilt(deg: number): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

/** How long a new 3D match waits for look H before it opens on the kit look instead (lag pass 4). */
const H_WAIT_MS = 4000;
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
  /**
   * SMOOTH PLAYBACK (3D camera: New; Harry, 9 Oct 2026: "the animations are a
   * bit wild and rough"): every clip change crossfades at least this long (s) …
   */
  smoothFade: 0.24,
  /** … a loop is kept at least this long before the next change (no flicker between walk and jog) … */
  smoothDwell: 0.35,
  /** … a turn is never faster than this (rad/s, ~540°/s), eased in by the share-per-second rate … */
  smoothTurn: 9.4,
  /** … and his speed is read through this much smoothing (per second; Old: 8). */
  smoothVel: 5,
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
  /**
   * The keeper (Harry, 9 Oct 2026: "needs to move more fluidly and not feel so NPC").
   * His drawn spot follows the 2D keeper through a spring this stiff (rad/s): the
   * 2D walks him at a fixed pace and stops dead; this starts and stops him like a man.
   */
  keeperSpring: 11,
  /** He turns his chest to the ball, never more than this far off square (rad, ~50°). */
  keeperFaceMax: 0.87,
  /** Ball this near his goal (m): set (feet apart, weight forward) … */
  keeperSetR: 32,
  /** … and on his toes (quicker shuffle) when it is struck, crossed or in the air near the box. */
  keeperToes: 1.3,
  /** A strike near him (ball speed jumps by this, m/s): a split step, this high (m of the clip's size) for this long (s). */
  splitJump: 6, splitH: 0.045, splitS: 0.22,
};
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
  /** Hips held on his spot (no clip walking him off it) until this time (s): one-shots and a short tail after. */
  pinUntil?: number;
  /** You only: where each strike clip's kicking foot is at contact, his own frame (x, z at scale 1, hips held). */
  footAt?: Record<string, [number, number]>;
  /** The kick's backswing, held while the strike screen is up. */
  windup?: string;
  /** A one-shot (celebration, head in hands) already played this result. */
  shotDone?: string;
  /** Kicking off the left foot: the clip's ball sits further on than shot_r's, so he stands back by this (his frame, metres). */
  kickOff?: [number, number];
  /** The kick being played (lib/star/style3d/kickStyle.ts): its clip, swing and hop, and seconds since the strike. */
  kickStyle?: KickStyle; kickT?: number;
  /** The power of the last aim (0..1): how far back the strike screen's backswing goes. */
  aimP?: number;
  /** You: the run-up-and-strike clip (kick_r / kick_l) is driving him (setPiece3d.ts). */
  setRun?: boolean;
  /** You, corner / open play: seconds since the strike screen opened (the last steps in), and the stance he steps in from. */
  apT?: number; stance?: { x: number; y: number };
  /** Keeper: walking sideways along his line. */
  side?: boolean;
  /** Keeper, Motion: Mocap: the ball's speed last frame (a jump is a strike) and seconds since his split step. */
  lastBallSp?: number; splitT?: number;
  /** Keeper, Motion: Mocap: how ready he is (0 relaxed, 1 set, 2 on his toes). */
  alert?: number;
  /** The tight shadow under his feet ("3D player light: New"). */
  foot?: any;
  /** Smooth playback (3D camera: New): when his loop last changed (f.t). */
  sw?: number;
};

/** The keeper's height against his team-mates (Harry, 13 Oct 2026: "a little bit taller"): 1.07 = about 13 cm on 1.8 m. */
const KEEPER_TALL = 1.07;

export async function createEngineView(container: HTMLElement, o: { def: StyleDef; tier?: Quality3d; tod?: TimeOfDay; faces?: boolean; tilt?: number; canvas2d?: HTMLCanvasElement; onContextLost?: () => void; onContextRestored?: () => void }): Promise<EngineView> {
  const faces = !!o.faces;
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
  // the goal frame: real size (SIZE3D.goal) with every camera, set before the stadium is built
  if (o.def.real && SIZE3D.goal !== 1) await import("./real/arena").then((m) => m.setArenaGoalScale(SIZE3D.goal)).catch(() => {});
  const loader = await withMeshopt(new GLTFLoader());
  const body = people3dLook();
  // Settings → Look → "Players in a 3D match" (toon/matchLook.ts): realistic players by default; Style A stays in cut scenes
  const mStyle = matchPlayerStyle();
  const [model, animG, fb] = await Promise.all([
    loadPeople3d(loader, "player", body, TOON_PLAYER_HEADS, mStyle), loadPeople3d(loader, "anims", body), // a match has no suits: the six player heads only
    loadAnims3d(loader, "football").catch(() => null),
  ]);

  // ── renderer: at the phone's own pixel density (2 on High), so nothing is "pixelly" ──
  const { renderer, release } = acquireRenderer(THREE, container, prof);
  // the stadium's shadows drawn once and kept; the men from a lighter shadow body (three3d/shadowCache.ts)
  installShadowCache(THREE, renderer);
  const dprCap = tier === "high" || tier === "medium" ? SMALL_MEN.mediumDpr : 1.25; // Medium and High: 2.5 (Harry approved, 12 Oct 2026); // never under 1.25 on a phone: smooth edges (9 Oct 2026)
  renderer.setPixelRatio(Math.min(dprCap, window.devicePixelRatio || 1));
  // The governor (three3d/governor.ts): slow frames for 2.5 s → one rung down
  // (pixel ratio, then shadows and the post pass; look H reads the rung itself).
  const gov = new Governor({
    start: tier, name: "real game",
    onChange: (r) => {
      // the rung's ratio scaled to this tier's cap (Medium draws at SMALL_MEN.mediumDpr at its top rung)
      renderer.setPixelRatio(governedPixelRatio(dprCap, { ...r, pixelRatio: r.pixelRatio * Math.max(1, dprCap / prof.maxPixelRatio) }, window.devicePixelRatio || 1));
      if (!h) renderer.shadowMap.enabled = prof.shadows && r.shadows !== "off";
    },
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas3d = renderer.domElement as HTMLCanvasElement;
  canvas3d.style.pointerEvents = "none";
  // iPhone Safari takes the 3D away when memory runs short (Harry, 9 Oct 2026:
  // "3D just stopped working mid game"). Say so, so the screen can show the 2D
  // match again; preventDefault lets the browser offer the context back.
  const onLostEv = (e: Event) => { e.preventDefault(); o.onContextLost?.(); };
  const onRestoredEv = () => { o.onContextRestored?.(); };
  canvas3d.addEventListener("webglcontextlost", onLostEv);
  canvas3d.addEventListener("webglcontextrestored", onRestoredEv);

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
  let kit: StyleKit | null = createStyleKit(THREE, renderer, scene, tier, def);
  let stadium: Stadium | null = null;
  let h: RealLook | null = null;
  let hTod: TimeOfDay | null = o.tod ?? null;
  let hToken = 0;
  /** Look H made and its shaders built (restyle). */
  let hReady: Promise<unknown> | null = null;
  let visible = true;
  /**
   * Test pages only: ?animfix=0 draws the match as it was before the 12 Oct 2026 fixes (men resized
   * with the camera, 2D jumps drawn as teleports, one-shot clips walking him off his spot, you a
   * fixed step off the ball). For before/after stills; never set in a career.
   */
  const animFix = !(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("animfix") === "0");
  /** Smooth playback: always on (one camera). */
  const smooth = () => true;
  /** The current frame's clock (f.t), for the smooth playback's dwell. */
  let nowT = 0;

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
  const ballV = new THREE.Vector3(), ballAx = new THREE.Vector3();

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

  // ── the Golden Run-up's gold trail (EngineFrame.goldTrail, lib/star/goldenTrail.ts):
  // a pool of glowing sparks, placed from the 2D's own trail every frame. Looks only.
  const GOLD_POOL = 64;
  const goldTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,250,220,1)"); rg.addColorStop(0.25, "rgba(253,224,120,0.9)");
    rg.addColorStop(0.6, "rgba(245,158,11,0.35)"); rg.addColorStop(1, "rgba(245,158,11,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const goldSparks: any[] = [];
  for (let i = 0; i < GOLD_POOL; i++) {
    const m = new THREE.SpriteMaterial({ map: goldTex, color: "#ffd75e", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m); s.visible = false; s.renderOrder = 5; root.add(s); goldSparks.push(s);
  }
  const placeGoldTrail = (f: EngineFrame) => {
    const pts = f.goldTrail ?? [];
    for (let i = 0; i < GOLD_POOL; i++) {
      const s = goldSparks[i], p = pts[i];
      s.visible = !!p;
      if (!p) continue;
      s.position.set(p.x - CX, p.h, p.y);
      s.scale.setScalar(0.42 * p.size * (0.45 + 0.55 * p.life));
      s.material.opacity = Math.max(0, Math.min(1, p.life));
    }
  };

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

  /**
   * Shirt numbers: ONE picture per number, shared by every man wearing it
   * (lag pass 3, 9 Oct 2026). Each man used to paint and upload his own
   * 256×256 number when he first appeared (often several at a chance start):
   * the same white digits, a new texture each time, never freed.
   */
  const numberCache = new Map<number, any>();
  const numberTex = (n: number) => {
    let t = numberCache.get(n);
    if (!t) {
      const c = newNumberCanvas(); drawShirtNumber(c, n);
      t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      numberCache.set(n, t);
      renderer.initTexture(t); // uploaded now, not mid-chance on his first draw
    }
    return t;
  };
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19]) numberTex(n);
  /**
   * Style A's skin-and-hair picture at match size (lag pass 3). Each head file
   * carries a 1024×1024 colour map (5.6 MB on the GPU with its mipmaps; six
   * heads in a match = 34 MB). From the match camera a man is at most ~120
   * pixels tall, so the GPU only ever reads the 128-pixel level and below:
   * a 512 copy draws the same picture for a quarter of the memory. The
   * loaded file is left as it is (the garden, shop and close-ups share it).
   */
  const MATCH_MAP = 512;
  const smallMaps = new Map<any, any>();
  const matchSizedMap = (p: Person3D) => {
    const m = p.body?.material as any;
    // a packed (KTX2) map stays as it is: already about the size this copy would be (lag pass 4)
    if (!m || Array.isArray(m) || !m.userData?.toon || !m.map || m.map.isCompressedTexture) return;
    const src = m.map;
    let small = smallMaps.get(src);
    if (small === undefined) {
      small = null;
      const im = src.image as { width?: number; height?: number } | undefined;
      if (im && (im.width ?? 0) > MATCH_MAP && typeof document !== "undefined") {
        try {
          const c = document.createElement("canvas");
          c.width = MATCH_MAP; c.height = Math.max(1, Math.round((MATCH_MAP * (im.height ?? im.width!)) / im.width!));
          const g = c.getContext("2d");
          if (g) {
            g.imageSmoothingQuality = "high";
            g.drawImage(im as CanvasImageSource, 0, 0, c.width, c.height);
            small = src.clone();
            small.image = c;
            small.needsUpdate = true;
            small.userData = { ...src.userData, matchSized: true };
            renderer.initTexture(small);
          }
        } catch { small = null; }
      }
      smallMaps.set(src, small);
      if (small) smallMaps.set(small, small);
    }
    if (small && m.map !== small) m.map = small;
  };
  /**
   * SPARE BODIES (9 Oct 2026, Harry's phone: a 500 ms stall mid-match). A man
   * was built (skeleton copy, mixer, clips) the first frame he appeared, often
   * several at once when a chance opened. Now bodies are built ahead: a few
   * while loading, then one a frame until there are enough for a full match,
   * and a new man just takes one and is dressed (cheap: colours and a number).
   */
  const SPARE_TARGET = 24;
  // Style A (Player style: New): a man's head is seeded by who he is, so spares are kept per head
  // (his build is a scale, set again when a spare is used).
  const toonOn = mStyle === "new";
  // "Players in a 3D match: Style A" (toon/matchLook.ts): every man lit like the Home player, with an ink edge (toon/shader.ts HOME_LIGHT)
  const homeMen = toonOn && matchPlayersStyleLook() === "styleA";
  // ...and built like him: a bigger head and broader at this small size (a man is ~6% of the screen; HOME_MATCH_BUILD)
  const homeLook = homeMen ? HOME_MATCH_BUILD.look : undefined;
  if (o.def.real) void import("./real/ball").then(({ setHBallLightRing }) => setHBallLightRing(!homeMen)).catch(() => {});
  const homeLight = (p: Person3D) => {
    const pu = p.u as any, hu = pu.uHome?.value;
    if (hu) hu.x = homeMen ? 1 : 0;
    // a small man reads cleanly (smallMen.ts): flat cel, a softer skin/hair picture, no kit weave at 35 px
    if (pu.uSmall?.value) pu.uSmall.value.set(homeMen && SMALL_MEN.flatCel ? 1 : 0, homeMen ? SMALL_MEN.mapBias : 0, 0, 0);
    if (pu.uCloth?.value && homeMen && !SMALL_MEN.kitNoise) { pu.uCloth.value.x = 0; pu.uCloth.value.y = 0; }
  };
  const spareBins = new Map<string, Person3D[]>();
  const bin = (h?: ToonHead) => { const k = h ?? "-"; let l = spareBins.get(k); if (!l) { l = []; spareBins.set(k, l); } return l; };
  const spares = { push: (p: Person3D) => bin(p.toonHead).push(p), pop: () => Array.from(spareBins.values()).find((l) => l.length)?.pop() };
  let built = 0;
  const buildShell = (th?: ToonHead) => {
    const p = makePerson3d(THREE, SK, model, animG, { outline: prof.outlines ? 0.005 : 0, outlinePx: homeMen && SMALL_MEN.outlinePx > 0 ? SMALL_MEN.outlinePx : undefined, castShadow: prof.shadows, toonHead: toonOn ? (th ?? TOON_PLAYER_HEADS[built % TOON_PLAYER_HEADS.length]) : undefined, toonBody: toonOn ? "c1" : undefined, toonLook: homeLook });
    if (fb) addClips(THREE, p, fb as any);
    homeLight(p);
    cullSkinned(THREE, p.root); // off-screen men are not drawn (three3d/cullPeople.ts)
    matchSizedMap(p);
    p.root.visible = false;
    built++;
    return p;
  };
  /**
   * WHO WILL PLAY (lag pass 3, 9 Oct 2026). CanvasMatch names its men the
   * same way every chance ("mate0", "run1", "def3" …), and Style A seeds a
   * man's head from that name. So the spares are built for the heads the
   * match will really ask for, in the order the men usually appear. Before,
   * spares were dealt round the six heads in turn: a chance whose new men
   * shared a head emptied that head's pile and built the rest on the spot
   * (the chance-start stall), while other piles sat unused all match.
   */
  const LIKELY_SIDS = ["you", "keeper", "follower",
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((i) => [`def${i}`, `mate${i}`]),
    "run0", "run1", "run2", "run3"];
  // Style A match men (homeMen): each his own head, build, height, skin, hair and boots (lib/star/playerLook.ts)
  const manLook = (sid: string) => playerLookFor({ id: sid, position: sid === "keeper" ? "GK" : undefined });
  const headOf = (sid: string): ToonHead | undefined => (toonOn ? (sid === "you" ? toonYou().head : homeMen ? manLook(sid).head : toonHeadFor(sid)) : undefined);
  const spareQueue = LIKELY_SIDS.slice(0, Math.max(6, SPARE_TARGET)).map(headOf);
  for (let i = 0; i < 6 && spareQueue.length; i++) spares.push(buildShell(spareQueue.shift()));
  const topUpSpares = () => { if (spareQueue.length && built < SPARE_TARGET + 6) spares.push(buildShell(spareQueue.shift())); };
  /** Hold the hips over his spot: a clip's own travel (a step into a pass, a run-up) never walks him off where the 2D put him. */
  const pinHips = (p: Person3D) => {
    const r0 = p.rest.get(p.bones.Hips)?.[0];
    if (r0) { p.bones.Hips.position.x = r0.x; p.bones.Hips.position.z = r0.z; }
  };
  /** The strike clips you can play, and which foot meets the ball in each. */
  const STRIKES: Record<string, "R" | "L"> = { shot_r: "R", kick_l: "L", shot_low: "R", chip: "R", volley: "R", pass_inside: "R", pass_lofted: "R", kick_r: "R" };
  /**
   * You only, once, as your body is made: pose each strike clip at its contact moment (hips held,
   * as the match plays it) and note where the kicking foot is, in his own frame. You are then
   * stood so that foot meets the ball (Harry: "kicking … with the ball").
   */
  const calibrateFeet = (p: Person3D): Record<string, [number, number]> => {
    const out: Record<string, [number, number]> = {};
    const pos = p.root.position.clone(), rot = p.root.rotation.y, sc = p.root.scale.x;
    p.root.position.set(0, 0, 0); p.root.rotation.set(0, 0, 0); p.root.scale.setScalar(1);
    const v = new THREE.Vector3();
    for (const [clip, side] of Object.entries(STRIKES)) {
      const a = p.actions[clip], foot = p.bones[side === "R" ? "RightFoot" : "LeftFoot"];
      const c = info(clip)?.contact;
      if (!a || !foot || c === undefined) continue;
      a.reset(); a.play(); a.setEffectiveWeight(1); a.paused = true; a.time = c;
      p.mixer.update(0);
      pinHips(p);
      p.root.updateMatrixWorld(true);
      foot.getWorldPosition(v);
      out[clip] = [v.x, v.z];
      a.setEffectiveWeight(0); a.stop(); a.paused = false;
    }
    p.mixer.update(0);
    p.root.position.copy(pos); p.root.rotation.set(0, rot, 0); p.root.scale.setScalar(sc);
    return out;
  };
  /** Pitch metres from his root to the ball at contact in `clip`, turned by `yaw`, at size `fs` (null: not calibrated). */
  const footToBall = (b: Body, clip: string, fs: number, yaw = b.yaw): { x: number; y: number } | null => {
    const f = b.footAt?.[clip];
    if (!f) return null;
    // the ball sits just ahead of the foot bone (the clip's own ball spot minus its foot point, clip metres × his size)
    const ci = info(clip);
    const ax = ci?.ball && ci.contactPoint ? (ci.ball[0] - ci.contactPoint[0]) * b.k : 0;
    const az = ci?.ball && ci.contactPoint ? (ci.ball[1] - ci.contactPoint[2]) * b.k : 0;
    const lx = (f[0] + ax) * fs, lz = (f[1] + az) * fs;
    // three: X = x - CX, Z = y; a turn of yaw about up
    return { x: lx * Math.cos(yaw) + lz * Math.sin(yaw), y: -lx * Math.sin(yaw) + lz * Math.cos(yaw) };
  };
  /** The run-up-and-strike clip for his kicking foot, if the body has it. */
  const runClip = (b: Body, fig: EngineFrameFigure): string | null =>
    fig.kickFoot < 0 ? (b.play.has("kick_l") ? "kick_l" : null) : (b.play.has("kick_r") ? "kick_r" : null);
  /** Where the run-up clip is held while the strike screen waits: just before contact (further back for a harder aim). */
  const runHold = (clip: string, ap: number) => Math.max(0.05, (info(clip)?.contact ?? 1.37) - (0.06 + 0.16 * ap));
  const makeBody = (sid: string, shirt: string, shorts: string): Body => {
    const ml = homeMen && sid !== "you" ? manLook(sid) : null;
    const tb = toonOn ? (sid === "you" ? toonYou().body : ml ? ml.body : toonBodyFor(sid)) : undefined;
    const th = toonOn ? (sid === "you" ? toonYou().head : ml ? ml.head : toonHeadFor(sid)) : undefined;
    const spare = bin(th).pop();
    const p = spare ?? makePerson3d(THREE, SK, model, animG, { outline: prof.outlines ? 0.005 : 0, outlinePx: homeMen && SMALL_MEN.outlinePx > 0 ? SMALL_MEN.outlinePx : undefined, castShadow: prof.shadows, toonBody: tb, toonHead: th, toonLook: homeLook });
    if (!spare) { built++; cullSkinned(THREE, p.root); matchSizedMap(p); homeLight(p); }
    if (tb) setToonBuild(p, tb);
    if (tb && homeMen) p.root.children[0]?.scale.multiply(new THREE.Vector3(...HOME_MATCH_BUILD.across)).multiply(new THREE.Vector3(1, ml?.height ?? 1, 1));
    // the keeper a little taller than his team (Harry, 13 Oct 2026). His own build, under the root, so his
    // root stays SIZE3D.keeper (size3d.ts): one fixed size, the same in every chance and every frame.
    if (sid === "keeper" && (tb || !spare)) p.root.children[0]?.scale.multiply(new THREE.Vector3(1.03, KEEPER_TALL, 1.03));
    const look: PersonLook = {
      skin: toonOn ? (sid === "you" ? toonYou().skin : ml ? ml.skin : toonSkinFor(sid)) : SKINS[hashOf(sid) % SKINS.length],
      hair: toonOn ? (sid === "you" ? toonYou().hair : ml ? ml.hair : toonHairFor(sid)) : "#1b120c",
      kit: { shirt, trim: shorts }, number: numberTex(numberFor(sid)),
      accessories: [...(sid === "keeper" ? [{ slot: "hands" as const, color: "#f5f5f5", color2: "#16a34a" }] : []), ...(ml ? [{ slot: "boots" as const, color: ml.boots }] : [])],
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
    const footAt = sid === "you" && animFix ? calibrateFeet(p) : undefined;
    play.play(first, { fade: 0, ...(mo ? { from: idleOff * p.actions[first].getClip().duration, speed: rate } : {}) });
    root.add(p.root);
    kit?.stylePeople([p]);
    h?.dressPeople([p]);
    const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
    const k = fbHipsY > 0 ? hipsRest / fbHipsY : 1;
    return { p, play, look, sid, kitKey: `${shirt}|${shorts}`, x: 0, y: 0, vx: 0, vy: 0, yaw: 0, state: mo ? first : "idle", onceLeft: 0, lastAct: -1, kicking: false, seen: 0, init: false, k, idleOff, rate, turnReady: 0, footAt };
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
    const cap = mo ? MO.maxTurn : smooth() ? MO.smoothTurn : Infinity;
    b.yaw += Math.sign(step) * Math.min(Math.abs(step), cap * dt);
  };
  const startLoop = (b: Body, name: string) => {
    const n = b.play.has(name) ? name : name === "ready_shuffle" ? "idle" : name === "sprint" ? "jog" : "idle";
    if (b.state === n) return;
    if (smooth() && b.sw !== undefined && LOCO.has(b.state) && LOCO.has(n) && nowT - b.sw < MO.smoothDwell) return;
    b.play.play(n, { fade: smooth() ? Math.max(0.22, MO.smoothFade) : 0.22 });
    b.state = n; b.sw = nowT;
  };
  const startOnce = (b: Body, clip: string, ago: number, speed = 1) => {
    if (!b.play.has(clip)) return false;
    const ci = info(clip);
    const contact = ci?.contact ?? 0.3;
    const dur = ci?.duration ?? b.p.actions[clip].getClip().duration;
    const from = Math.min(dur, contact + ago * speed);
    if (from >= dur - 0.05) return false;
    b.play.play(clip, { fade: smooth() ? MO.smoothFade * 0.75 : mo ? 0.12 : 0.06, from, speed, once: true });
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
    if (smooth()) {
      // a gait change waits out the last one (no walk/jog/walk flicker); every other change still crossfades
      if (b.sw !== undefined && (LOCO.has(b.state) || b.state === "idle") && (LOCO.has(n) || n === "idle") && nowT - b.sw < MO.smoothDwell) return;
      if (fade > 0) fade = Math.max(fade, MO.smoothFade);
      b.sw = nowT;
    }
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
    // After your goal (lib/star/celebration.ts): the move you equipped, at exactly the 2D's moment
    // in it. The 2D moves him along the grass (a knee slide, a jog with his arms up); his hips stay put.
    if (fig.celeb && b.play.has(fig.celeb.clip)) {
      const c = fig.celeb.clip, st = `celeb:${c}`;
      if (b.state !== st) { b.play.play(c, { fade: 0.18, once: !fig.celeb.loop, from: fig.celeb.t }); b.state = st; }
      const a = b.p.actions[c], d = clipDur(b, c);
      if (a) { a.time = fig.celeb.loop ? fig.celeb.t % d : Math.min(fig.celeb.t, d - 0.02); a.timeScale = 0; }
      b.play.update(dt);
      b.p.mixer.update(dt);
      return;
    }
    // the kick: your own swing, off the right foot or the left, and as hard as the real kick
    // (Harry, 9 Oct 2026: "every kick animation is the same no matter the power")
    let started = false;
    const foot = fig.kickFoot < 0 && b.play.has("kick_l") ? "kick_l" : "shot_r";
    const ki = info(foot), contact = ki?.contact ?? 0.42;
    if (fig.sid === "you" && f.aim && f.phase !== "contact") b.aimP = f.aim.power;
    // the run-up and strike (setPiece3d.ts): the real capture, kick_r / kick_l, timed off the 2D's
    // own run-up clock (a penalty, a free kick) or the last steps in once the strike screen opens
    // (a corner, open play); held at the backswing while the strike screen waits
    let runT: number | null = null;
    const K = fig.sid === "you" && animFix ? runClip(b, fig) : null;
    if (f.phase === "contact" && fig.sid === "you") b.apT = (b.apT ?? 0) + dt; else if (!fig.kick) b.apT = undefined;
    if (K && !fig.kick && !b.kicking && !b.kickStyle) {
      const hold = runHold(K, b.aimP ?? 0.6);
      if (f.phase === "runup" && f.runup && hasRunup(f.kind)) runT = runClipTime(f.runup.runS, f.runup.t, hold);
      else if (f.phase === "contact") runT = hasRunup(f.kind) ? hold : Math.min(hold, Math.max(0, hold - approachSFor(f.kind)) + (b.apT ?? 0));
    }
    if (runT !== null && K) {
      if (b.state !== `wind:${K}`) {
        if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
        b.play.play(K, { fade: 0.18, from: runT, once: true });
        b.state = `wind:${K}`; b.windup = K; b.setRun = true;
      }
      const a = b.p.actions[K];
      a.time = runT; a.timeScale = 0;
    }
    if (fig.sid === "you" && !fig.kick && f.phase === "contact" && b.play.has(foot) && !b.setRun) {
      // the strike screen is up: the kick is coming. Plant and backswing (further back for a harder aim), then hold it there.
      const ap = b.aimP ?? 0.6;
      if (b.windup !== foot) {
        if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
        b.play.play(foot, { fade: 0.2, from: Math.max(0, contact - (0.25 + 0.4 * ap)), speed: 0.8, once: true });
        b.state = `wind:${foot}`; b.windup = foot;
      }
      const a = b.p.actions[foot];
      const hold = contact - (0.06 + 0.16 * ap);
      if (a.time >= hold) { a.time = hold; a.timeScale = 0; }
    }
    if (fig.kick && !b.kicking) {
      if (b.turn) { b.yaw = b.turn.start + (b.turn.h * b.turn.d) / b.turn.theta; b.turn = undefined; }
      const st = kickStyleFor(f.ball && f.ball.live ? f.ball : null, foot === "kick_l", (n) => b.play.has(n));
      const c = b.setRun && b.windup ? b.windup : b.play.has(st.clip) ? st.clip : foot;
      if (b.play.has(c)) {
        const cc = info(c)?.contact ?? contact;
        const a = b.p.actions[c];
        if (c === b.windup && b.state === `wind:${c}`) a.timeScale = st.swing; // loaded: swing through now, as hard as the kick
        else b.play.play(c, { fade: 0.1, from: Math.max(0, cc - Math.min(st.backswing, b.windup ? 0.2 : MO.lateStart)), speed: st.swing, once: true });
        b.state = `once:${c}`;
        b.kickStyle = { ...st, clip: c }; b.kickT = 0;
        const sr = info("shot_r");
        b.kickOff = c === "kick_l" && ki?.ball && sr?.ball ? [ki.ball[0] - sr.ball[0], ki.ball[1] - sr.ball[1]] : undefined;
        started = true;
      }
    }
    if (!fig.kick && b.windup && runT === null && !(fig.sid === "you" && f.phase === "contact")) { b.windup = undefined; b.setRun = undefined; if (b.state.startsWith("wind:")) b.state = ""; }
    if (fig.kick && b.windup) { b.windup = undefined; b.setRun = undefined; }
    b.kicking = fig.kick;
    // after contact: the follow-through at the kick's own pace
    if (b.kickStyle && b.state === `once:${b.kickStyle.clip}`) {
      const ks = b.kickStyle, a = b.p.actions[ks.clip];
      if (a.time >= (info(ks.clip)?.contact ?? contact)) a.timeScale = ks.follow;
      b.kickT = (b.kickT ?? 0) + dt;
    } else if (b.kickStyle && !b.state.startsWith("once:")) { b.kickStyle = undefined; b.kickT = undefined; }
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
    let lift = 0;
    const bl = f.ball;
    // the strike: any kick near him gets a split step (he lands on both feet, ready)
    const bsp = bl && bl.live ? Math.hypot(bl.vx, bl.vy, bl.vz) : 0;
    const near = !!bl && Math.hypot(bl.x - CX, bl.y) < 40;
    if (!cut && b.lastBallSp !== undefined && bsp - b.lastBallSp > MO.splitJump && near && !b.dive) b.splitT = 0;
    b.lastBallSp = bsp;
    if (b.splitT !== undefined) { b.splitT += dt; if (b.splitT > MO.splitS) b.splitT = undefined; }
    // how ready: relaxed with play far away, set as it comes near, on his toes when it is struck or in the air near the box
    const dBall = bl ? Math.hypot(bl.x - CX, bl.y) : 99;
    const flying = !!bl && bl.live && (f.phase === "flight") && (bl.vy < -2 || bl.z > 0.8 || !!f.landing);
    // a penalty: on his line, set and on his toes from the moment the taker stands over it
    const want = f.phase === "contact" || f.phase === "runup" || (f.kind === "penalty" && f.phase === "aim") || (flying && dBall < MO.keeperSetR + 8) ? 2 : dBall < MO.keeperSetR ? 1 : 0;
    b.alert = want;
    // square to the ball (a cross: to where it drops), within reason; square to the pitch in a dive
    const look = f.landing && f.landing.y < 18 ? f.landing : bl;
    const faceYaw = look && !b.dive && Math.hypot(look.x - b.x, look.y - b.y) > 0.6
      ? Math.max(-MO.keeperFaceMax, Math.min(MO.keeperFaceMax, wrapPi(yawOf(Math.atan2(look.y - b.y, look.x - b.x)))))
      : 0;
    turnTo(b, faceYaw, dt, b.dive ? 14 : 5);
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
      const fs = keeperFig();
      if (k.act && k.act.start !== b.lastAct) {
        b.lastAct = k.act.start;
        if (k.act.save === "catch" && f.ball && f.ball.z > 1.5) startOnce(b, "high_claim", Math.max(0, f.t - k.act.start));
      }
      if (b.onceLeft > 0) b.onceLeft -= dt;
      if (!(b.state.startsWith("once:") && b.onceLeft > 0)) {
        // across his body: real side steps (his left is his own +x, turned with him), a shuffle when it's quick
        const lat = b.vx * Math.cos(b.yaw) - b.vy * Math.sin(b.yaw);
        const fwd = b.vx * Math.sin(b.yaw) + b.vy * Math.cos(b.yaw);
        const ux = Math.abs(lat) / (b.k * fs);
        b.side = Math.abs(lat) > (b.side ? 0.18 : 0.3) && Math.abs(lat) > Math.abs(fwd) * 0.8;
        if (Math.hypot(b.vx, b.vy) > 2.6 && !b.side) startLoopM(b, "jog");
        else if (b.side) {
          const quick = ux > 2;
          const n = `${quick ? "shuffle" : "side_step"}_${lat > 0 ? "l" : "r"}`;
          startLoopM(b, b.play.has(n) ? n : "ready_shuffle", 0.2);
          const cs = info(n)?.speed;
          if (b.state === n && typeof cs === "number") b.p.actions[n].timeScale = Math.max(0.6, Math.min(1.8, ux / cs));
        } else if (Math.abs(fwd) > 0.35) {
          // stepping off his line or back: small steps, set (the ready shuffle moving)
          startLoopM(b, "ready_shuffle", 0.25);
          if (b.state === "ready_shuffle") b.p.actions.ready_shuffle.timeScale = b.rate * MO.keeperToes;
        } else {
          // standing: relaxed with play far away, set as it comes, on his toes when it is struck or crossed
          const n = b.alert === 0 && b.play.has("idle") ? "idle" : "ready_shuffle";
          startLoopM(b, n, 0.35);
          if (b.state === "ready_shuffle") b.p.actions.ready_shuffle.timeScale = b.rate * (b.alert === 2 ? MO.keeperToes : 1);
        }
      }
    }
    b.play.update(dt);
    b.p.mixer.update(dt);
    if (b.splitT !== undefined && !b.dive) lift += MO.splitH * b.k * keeperFig() * Math.sin((b.splitT / MO.splitS) * Math.PI);
    return lift;
  };

  /** One outfield man for this frame. */
  const placeFigure = (fig: EngineFrameFigure, f: EngineFrame, dt: number, frameNo: number, at: { x: number; y: number }) => {
    // Faces: off. Photos fitted for a head seen face-on read as a pale mask from
    // this high camera (seen in the stills); at 60 px a plain head reads better.
    const b = bodyFor(fig.sid, fig.shirt, fig.shorts, faces ? fig.face : undefined);
    b.seen = frameNo;
    // he follows the 2D spot at a man's pace (style3d/figureFollow.ts): a jump in the 2D spot is
    // caught up over a few frames, not drawn as a teleport; a cut (> FOLLOW.snapM) is taken at once
    const fw = !b.init ? { x: at.x, y: at.y, snapped: true }
      : animFix ? followStep(b, at, dt)
      : { x: at.x, y: at.y, snapped: Math.hypot(at.x - b.x, at.y - b.y) > 4 };
    const fresh = fw.snapped;
    if (fresh) { b.x = at.x; b.y = at.y; b.vx = 0; b.vy = 0; b.init = true; }
    else if (dt > 0) {
      const k = Math.min(1, dt * (smooth() ? MO.smoothVel : 8));
      // his pace from how far he is DRAWN to move (a 2D jump no longer reads as a one-frame sprint)
      b.vx += ((fw.x - b.x) / dt - b.vx) * k; b.vy += ((fw.y - b.y) / dt - b.vy) * k;
      b.x = fw.x; b.y = fw.y;
    }
    const sp = Math.hypot(b.vx, b.vy);
    // smooth playback: a man who has just (re)appeared starts in his pose for this pace, not a fade from a stale one
    if (fresh && smooth() && mo) { b.state = ""; b.sw = undefined; startLoopM(b, sp < MO.idleBelow ? "idle" : "jog", 0); b.sw = undefined; }
    // facing: where he runs, else the ball, else up the pitch
    const bl = f.ball;
    let want: number | null = null;
    if (fig.celeb) {
      // your celebration: a slide or a jog on faces where he goes; a move on the spot turns back to the pitch
      want = sp > 0.9 ? yawOf(Math.atan2(b.vy, b.vx)) : yawOf(Math.atan2(HALF_W_CELEB - b.y, CX - b.x));
    } else if (sp > (smooth() ? (LOCO.has(b.state) ? 0.5 : 0.9) : 0.7)) want = yawOf(Math.atan2(b.vy, b.vx));
    else if (fig.sid === "you" && f.aim) want = yawOf(Math.atan2(f.aim.to.y - f.aim.from.y, f.aim.to.x - f.aim.from.x));
    else if (fig.sid === "you" && f.phase === "aim" && bl && animFix && Math.hypot(bl.x - b.x, bl.y - b.y) > 0.6) {
      // the stance: looking down his run at the ball (a penalty, a free kick, a corner, open play)
      want = yawOf(Math.atan2(bl.y - b.y, bl.x - b.x));
    }
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
      if (fig.celeb && b.play.has(fig.celeb.clip)) startLoop(b, fig.celeb.clip);
      else if (f.goalSide && ((f.goalSide === "us") === (fig.team === "us"))) startLoop(b, b.play.has("celebrate_jump") ? "celebrate_jump" : "celebrate_fist");
      else if (f.goalSide && b.play.has("dejected") && sp < 0.5) startLoop(b, "dejected");
      else if (sp < 0.35) startLoop(b, "idle");
      else startLoop(b, sp > 5.4 ? "sprint" : "jog");
    }
    const ls = loopSpeed[b.state];
    if (ls) { const a = b.p.actions[b.state]; if (a) a.timeScale = Math.max(0.55, Math.min(b.state === "sprint" ? 1.35 : 1.9, sp / ls)); }
    b.play.update(dt);
    b.p.mixer.update(dt);
    }
    // a one-shot (pass, shot, tackle, header, celebration) plays on his spot: its own travel never
    // walks him off where the 2D put him and back again (the "half teleport"); a short tail covers the fade out
    if (animFix && b.sid !== "keeper") {
      if (b.state.startsWith("once:") || b.state.startsWith("wind:") || b.state.startsWith("shot1:") || b.state.startsWith("celeb:")) b.pinUntil = nowT + 0.4;
      if (b.pinUntil !== undefined && nowT < b.pinUntil) pinHips(b.p);
    }
    // Mocap, a left-foot kick: kick_l's ball sits further on than shot_r's, so he stands back by the difference
    // (not when you are stood off the calibrated foot: that already accounts for it)
    const off = mo && b.kickOff && b.state === "once:kick_l" && !b.footAt?.kick_l ? b.kickOff : null;
    const fs = figNow();
    const ox = off ? (off[1] * Math.sin(b.yaw) + off[0] * Math.cos(b.yaw)) * b.k * fs : 0;
    const oz = off ? (off[1] * Math.cos(b.yaw) - off[0] * Math.sin(b.yaw)) * b.k * fs : 0;
    // a full-power strike: a little hop off the standing foot as the leg follows through
    const hopT = mo && b.kickStyle?.hop && b.kickT !== undefined ? b.kickT : -1;
    const hop = hopT >= 0 && hopT < 0.32 ? b.kickStyle!.hop * Math.sin((hopT / 0.32) * Math.PI) * b.k * fs : 0;
    b.p.root.position.set(b.x - CX - ox, hop, b.y - oz);
    b.p.root.rotation.set(0, b.yaw, 0);
    b.p.root.scale.setScalar(fs);
    b.p.root.visible = true;
  };

  /**
   * The keeper in a really bright kit (Harry, 13 Oct 2026: "make the goalie rlly bright in 3d"): his own
   * colour's hue, full saturation and lit up, so he never sinks into the stand shadow on the goal line.
   */
  const neonKit = (hex: string) => {
    const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // a grey/black/white kit has no hue of its own, and a green one sinks into the grass: neon yellow
    const deg = hsl.h * 360;
    if (hsl.s < 0.15 || (deg > 70 && deg < 175)) return "#ffe81a";
    return `#${c.setHSL(hsl.h, 1, 0.56).getHexString()}`;
  };
  const placeKeeper = (k: NonNullable<EngineFrame["keeper"]>, f: EngineFrame, dt: number, frameNo: number) => {
    const b = bodyFor("keeper", neonKit(k.shirt), neonKit(k.shorts), faces ? k.face : undefined);
    // never capped below full white by the Home light (its 0.95 cap keeps shorts from blooming; he can glow)
    const hu = (b.p.u as any).uHome?.value;
    if (hu) hu.z = 1.6;
    b.seen = frameNo;
    const jump = Math.hypot(k.x - b.x, k.y - b.y);
    const cut = !b.init || jump > 4;
    if (!b.init || jump > 4) { b.x = k.x; b.y = k.y; b.vx = 0; b.vy = 0; b.init = true; b.dive = undefined; b.lastBallSp = undefined; b.splitT = undefined; }
    else if (mo && dt > 0 && !(k.saveLunge > 0.04 || b.dive)) {
      // Motion: Mocap — a spring onto the 2D spot: he gets going and pulls up like a man,
      // never a fixed-pace slide that stops dead (and never more than a few cm behind).
      // stiffer as he goes faster, so he is never more than ~0.3 m behind (a scramble after a spill)
      const w = Math.max(MO.keeperSpring, (2 * Math.hypot(b.vx, b.vy)) / 0.3);
      for (let s = 0, n = Math.max(1, Math.ceil(dt / 0.01)); s < n; s++) {
        const h = dt / n;
        b.vx += (w * w * (k.x - b.x) - 2 * w * b.vx) * h; b.vy += (w * w * (k.y - b.y) - 2 * w * b.vy) * h;
        b.x += b.vx * h; b.y += b.vy * h;
      }
    } else if (dt > 0) {
      const kk = Math.min(1, dt * 8);
      // in a dive he goes where the 2D dive puts him; otherwise at a man's pace (figureFollow.ts)
      const fw = k.saveLunge > 0.04 || b.dive || !animFix ? { x: k.x, y: k.y } : followStep(b, k, dt);
      b.vx += ((fw.x - b.x) / dt - b.vx) * kk; b.vy += ((fw.y - b.y) / dt - b.vy) * kk;
      b.x = fw.x; b.y = fw.y;
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
    b.p.root.scale.setScalar(keeperFig());
    b.p.root.visible = true;
  };

  type Ev3dDiag = { frames?: number; maxStep?: number; maxStepWho?: string; steps?: number[]; scales?: Record<string, number[]>; footBall?: number[]; last?: Record<string, [number, number]>; kick?: { clip: string; t: number } };
  const footV = new THREE.Vector3();
  const measureFrame = (dg: Ev3dDiag, f: EngineFrame) => {
    dg.frames = (dg.frames ?? 0) + 1;
    dg.last ??= {}; dg.scales ??= {}; dg.steps ??= []; dg.footBall ??= [];
    let worst = 0;
    for (const b of list) {
      if (!b.p.root.visible) { delete dg.last[b.sid]; continue; }
      const x = b.p.root.position.x, z = b.p.root.position.z, l = dg.last[b.sid];
      if (l) { const d = Math.hypot(x - l[0], z - l[1]); if (d > worst) { worst = d; if (d > (dg.maxStep ?? 0)) { dg.maxStep = d; dg.maxStepWho = `${b.sid} ${f.phase} ${f.kind}`; } } }
      dg.last[b.sid] = [x, z];
      (dg.scales[b.sid] ??= []).push(+b.p.root.scale.x.toFixed(4));
      if (dg.scales[b.sid].length > 4000) dg.scales[b.sid].shift();
    }
    dg.steps.push(+worst.toFixed(4));
    // your foot at the contact moment of the strike clip
    const you = bodies.get("you");
    if (you && f.ball && you.state.startsWith("once:")) {
      const clip = you.state.slice(5), side = STRIKES[clip], c = info(clip)?.contact, a = you.p.actions[clip];
      if (side && c !== undefined && a) {
        const prev = dg.kick && dg.kick.clip === clip ? dg.kick.t : -1;
        if (prev < c && a.time >= c) {
          you.p.root.updateMatrixWorld(true);
          you.p.bones[side === "R" ? "RightFoot" : "LeftFoot"].getWorldPosition(footV);
          dg.footBall.push(+Math.hypot(footV.x - ball.position.x, footV.z - ball.position.z).toFixed(3));
        }
        dg.kick = { clip, t: a.time };
      }
    } else dg.kick = undefined;
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
      hReady = import("./real/look").then(({ createRealLook }) => createRealLook(THREE, renderer, scene, tier, { tod, ball, colours: { home: "#d62828", home2: "#f4f4f4", away: "#1d4ed8" }, crisp: true, pack: worldPack() }))
        .then((made) => {
          if (tk !== hToken || !def.real) { made.dispose(); return; }
          h = made;
          clipArenaNearSide();
          kit?.setActive(false); // the kit drew the wait; its post pictures are freed now H draws
          ballShadow.visible = false;
          h.dressPeople(list.map((b) => b.p));
          for (const b of list) { const raw = b.p.body.material as any; for (const m of Array.isArray(raw) ? raw : [raw]) if (m) { m.roughness = 0.62; m.metalness = 0; } }
          const warm = warmPeople();
          (window as unknown as { __engineView3dReady?: boolean }).__engineView3dReady = true;
          return warm;
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
  function warmPeople(): Promise<void> {
    const p = spares.pop();
    if (!p) return h ? h.compile(scene, camera) : Promise.resolve();
    dressPerson3d(THREE, p, { skin: SKINS[0], hair: "#1b120c", kit: { shirt: "#d62828", trim: "#f4f4f4" }, number: numberTex(9), accessories: [] });
    kit?.stylePeople([p]);
    h?.dressPeople([p]);
    const raw = p.body.material as any;
    for (const m of Array.isArray(raw) ? raw : [raw]) if (m) { m.roughness = 0.62; m.metalness = 0; solidBody(m, playerLightLook() === "new"); }
    root.add(p.root);
    p.root.visible = true;
    p.root.position.set(0, 0, 30);
    camera.updateMatrixWorld();
    // look H draws into its own picture (no tone mapping): build THAT variant, in the background
    // (lag pass 4: warmUp built the screen's variant, so the first H frame built every shader again)
    const job = h ? h.compile(scene, camera).then(() => flushReleased()) : warmUp(THREE, renderer, scene, camera, { timeoutMs: 6000 });
    return job.catch(() => {}).finally(() => { p.root.visible = false; root.remove(p.root); spares.push(p); });
  }
  restyle();
  gov.apply();
  if (def.real) {
    // the ball's look H dressing, kept across style changes
    const { dressHBall } = await import("./real/ball");
    hball = dressHBall(THREE, ball, root, { classic: worldPack() !== "real" });
  }
  /**
   * Settings → Texture pack changed (texturePack.ts): the world (pitch, stadium, sky, light, ball)
   * is built again in the new pack, live, mid-match too. The men, the camera and every size stay.
   */
  let packNow = worldPack();
  const offPack = onTexturePack(() => {
    const pk = worldPack();
    if (pk === packNow) return;
    packNow = pk;
    if (!def.real) return;
    hToken++;
    h?.dispose(); h = null; // its own ball dressing goes with it
    hball?.dispose(); hball = null;
    void import("./real/ball").then(({ dressHBall }) => {
      if (!def.real) return;
      if (!hball) hball = dressHBall(THREE, ball, root, { classic: packNow !== "real" });
      restyle();
    }).catch(() => {});
  });

  // ── the camera: the 2D canvas's tilt, as a pinhole (see the top of the file) ──
  const tmpV = new THREE.Vector3();
  const outlineRes = new THREE.Vector2();
  let lean = 0;
  const down3 = new THREE.Vector3(0, 0, 1);
  /** `init`: the camera has been placed once (touch waits for it). */
  const tv = { x: 0, z: 0, D: 60, th: 0.7, key: "", init: false };
  /**
   * SIZES ARE ABSOLUTE; THE CAMERA ONLY MOVES (Harry, 12 Oct 2026: "why aren't they just a set
   * size?"). Every man, the keeper and the ball are real size (size3d.ts SIZE3D) with every camera,
   * on every screen: nothing here reads the camera, the screen, pixels per metre or the chance.
   */
  const figNow = (): number => SIZE3D.man;
  const keeperFig = (): number => SIZE3D.keeper;
  /**
   * THE 2D'S OWN FRAME (3D camera: New since 12 Oct 2026, lib/star/style3d/match2dCam.ts).
   * Harry: "the framing is not exactly the same on 3d and 2d … on 2d it might be able
   * to be a shot but on 3d it seems like a build up". The 3D shows the patch of grass
   * the 2D shows on the phone (its view box, turned and tilted), 50–60° down, never
   * turned off the 2D's facing; it moves exactly when the 2D's box moves. The angle
   * and lens are picked once a chance (no flicker on a glide). The near clip sits just
   * inside the nearest framed spot, so a stand between the camera and the pitch is
   * never drawn (Harry's corner still: the roof over two thirds of the screen).
   */
  const m2 = { key: "", pick: null as { elevDeg: number; fov: number } | null, sp: null as Match2DCamera | null, spKey: "", cornerA: null as Match2DCamera | null, aimBall: null as { x: number; y: number } | null, cornerStart: "" as "" | "B" | "C", cornerT0: -1, spWide: null as Match2DCamera | null, celebT0: -1 };
  /** The camera swipe (match2dCam.ts ORBIT): degrees turned round the ball now, where it is heading, a finger on it. */
  /** The turned camera's framing, eased frame to frame (match2dCam.ts solveTurnFit / easeFit). */
  const turn = { fit: null as TurnFit | null, want: null as TurnFit | null, key: "", at: 0 };
  const TURN_SOLVE_S = 0.05;
  const orbit = { deg: 0, target: 0, drag: false, ballKey: "", kind: "", t: -1, d0: 0, tilt: 0, tiltTarget: 0, tiltDrag: false, t0: 0, centre: 0 };
  (window as unknown as { __cam3dOrbit?: (deg: number) => void }).__cam3dOrbit = (deg: number) => { orbit.target = clampOrbit(deg); orbit.deg = orbit.target; }; // dev/test: stills of a turned view
  // THE CAMERA LOCK (Harry, 13 Oct 2026: "a little floating camera icon that can lock/unlock the camera
  // and maybe a double tap to get back to our default camera angle"). Locked: the angle you left it at is
  // kept for every chance and a swipe on the grass does nothing to the camera. Unlocked: swipes turn and
  // tilt it, and it eases back each chance. A double tap on open grass puts it back to the default.
  // Kept per device (a player preference, not a game setting).
  const LOCK_KEY = "star-cam3d-lock";
  const camLock = (() => { try { const v = JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); return v && v.on ? { on: true, deg: clampOrbit(+v.deg || 0), tilt: clampTilt(+v.tilt || 0) } : { on: false, deg: 0, tilt: 0 }; } catch { return { on: false, deg: 0, tilt: 0 }; } })();
  const saveLock = () => { try { localStorage.setItem(LOCK_KEY, JSON.stringify(camLock)); } catch { /* private mode */ } };
  if (camLock.on) { orbit.target = orbit.deg = camLock.deg; orbit.tiltTarget = orbit.tilt = camLock.tilt; }
  (window as unknown as { __cam3dTilt?: (deg: number) => void }).__cam3dTilt = (deg: number) => { orbit.tiltTarget = clampTilt(deg); orbit.tilt = orbit.tiltTarget; }; // dev/test: stills of a tilted view
  /** The one absolute size (size3d.ts), which the set-piece camera frames around: never per chance. */
  const mScale = matchScale();
  /**
   * The stand on the camera's side: everything of the stadium nearer the camera than
   * the bottom edge of the 2D's view (or the touchline / goal line on that side) is not drawn (a roof there sits over the grass the
   * 2D shows: Harry's corner still). Shadows are untouched (clipShadows stays off).
   * Only the stadium group, only with 3D camera New; far away (no effect) otherwise.
   */
  const arenaClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
  /** The same cut for the seats, steps and walls; a turned camera over a stand keeps them (overStand). */
  const seatClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);
  function clipArenaNearSide() {
    const g = scene.getObjectByName("h-arena");
    if (!g) return;
    renderer.localClippingEnabled = true;
    g.traverse((o: { material?: unknown }) => {
      const raw = o.material as { clippingPlanes: unknown[]; clipping?: boolean; needsUpdate: boolean } | { clippingPlanes: unknown[]; clipping?: boolean; needsUpdate: boolean }[] | undefined;
      for (const m of Array.isArray(raw) ? raw : raw ? [raw] : []) { m.clippingPlanes = [(m as { userData?: { overhead?: boolean } }).userData?.overhead ? arenaClip : seatClip]; m.clipping = true; m.needsUpdate = true; }
    });
  }
  const placeMatch2D = (f: EngineFrame) => {
    const { viewport: vp, facing, tilt, W, H } = f.cam;
    if (!(W > 0 && H > 0)) return;
    const corner = usesCornerCam(f.kind) && !!f.ball;
    // a cutback (side-on) and a tight angle (behind the taker): 3D-only cameras (match2dCam.ts KIND_CAM)
    const kindCam = usesKindCam(f.kind) && !!f.ball;
    const sp = (usesSetPieceCam(f.kind) || corner || kindCam) && !!f.ball;
    const key = `${f.kind}|${facing}|${tilt ? tilt.deg : 0}|${Math.round(W)}|${Math.round(H)}`;
    // a new set piece: a new ball spot while aiming (a shootout's next kick from the same spot keeps its camera)
    // A lead-in replaying (test pages only: CanvasMatch's `leadIn`): the 2D frame follows the passes
    // and then is fixed on the chance's own frame (lib/star/leadIn.ts). A camera of the 3D's own (a
    // tight angle's) is worked out from where the CHANCE has everyone, so it is the camera the chance
    // keeps, and the follow glides onto it as the 2D's does. Absent (the real game): nothing changes.
    const lead = f.leadIn ?? null;
    const spBall = lead ? lead.ball : f.ball;
    const spKey = sp && spBall && f.phase === "aim" ? `${key}|${spBall.x.toFixed(1)},${spBall.y.toFixed(1)}` : m2.spKey;
    const fr2 = { viewport: vp, facing, tilt, W, H };
    // a penalty / free kick: the closer set-piece camera (match2dCam.ts SET_PIECE_CAM), worked out
    // once when the chance starts and held (the taker walks in inside it); every other kind: the 2D's own frame
    if (sp && f.ball && spBall && (spKey !== m2.spKey || !m2.sp)) {
      m2.spKey = spKey;
      const kp = lead ? lead.keeper : f.keeper ? { x: f.keeper.x, y: f.keeper.y } : null;
      const spFigs = lead ? f.figures.map((g) => (lead.at[g.sid] ? { ...g, x: lead.at[g.sid].x, y: lead.at[g.sid].y } : g)) : f.figures;
      // a corner: its own closer camera (match2dCam.ts CORNER_CAM), camera only
      // the glide: start on B or C (seeded per corner), and keep the box framing (A) for after the kick
      const glide = CORNER_CAM.pick === "glide";
      m2.cornerStart = corner && glide ? CORNER_CAM.starts[hashOf(spKey) % CORNER_CAM.starts.length] : "";
      m2.cornerA = corner && glide ? solveCornerCam(fr2, { x: spBall.x, y: spBall.y }, spFigs, kp, mScale, "A") : null;
      m2.cornerT0 = -1;
      m2.sp = corner
        ? solveCornerCam(fr2, { x: spBall.x, y: spBall.y }, spFigs, kp, mScale, m2.cornerStart || undefined)
        : kindCam
        ? solveKindCam(f.kind, fr2, { x: spBall.x, y: spBall.y }, spFigs, kp, mScale)
        : solveSetPieceCam(fr2, setPieceKeep({ x: spBall.x, y: spBall.y }, spFigs, kp, mScale), { x: spBall.x, y: spBall.y }, mScale, SET_PIECE_CAM, f.kind === "penalty" ? SET_PIECE_CAM.penaltyShare : SET_PIECE_CAM.targetShare);
      // the zoom's far end for a turned camera: the whole scenario, seen from the same side
      m2.spWide = kindCam && m2.sp ? wideFromSide(fr2, m2.sp) : null;
    }
    if (!sp) { m2.sp = null; m2.spKey = ""; m2.spWide = null; }
    // the whole scenario the 2D draws (its own frame): zoomed all the way out
    const wide = key === m2.key && m2.pick ? solveMatch2D(fr2, MATCH2D, m2.pick) : solveMatch2D(fr2, MATCH2D);
    // the angle and lens are held through a chance; sizes are absolute (SIZE3D), never from c
    if (key !== m2.key) { if (tv.init) gov.hush(performance.now()); m2.key = key; m2.pick = { elevDeg: wide.elevDeg, fov: wide.fov }; }
    // ZOOM (camZoom.ts; pinch, the Settings slider, the mouse wheel): 0 = the default framing (a set
    // piece's own camera, else the 2D's frame a little closer), 1 = the whole scenario, -1 = closest.
    // It only moves the camera; it keeps between chances.
    const zoom = camZoom();
    const openDef: Match2DCamera = { ...wide, D: wide.D * OPEN_DEFAULT_K, minDepth: wide.minDepth * OPEN_DEFAULT_K };
    let def: Match2DCamera = sp && m2.sp ? (lead ? lerpCamera(openDef, m2.sp, lead.lock) : m2.sp) : openDef;
    // the corner glide: from the kick, ease to the box framing (A) in CORNER_CAM.glideS, following where the ball will land
    if (corner && m2.sp && m2.cornerA) {
      const struck = f.phase !== "aim" && f.phase !== "runup" && f.phase !== "contact";
      if (struck && m2.cornerT0 < 0) m2.cornerT0 = f.t;
      if (!struck) m2.cornerT0 = -1;
      if (m2.cornerT0 >= 0) {
        const u = Math.min(1, (f.t - m2.cornerT0) / CORNER_CAM.glideS);
        const e = u * u * (3 - 2 * u); // smooth step: eased in and out
        const land = f.landing ?? (f.ball ? { x: f.ball.x, y: f.ball.y } : null);
        const A = land ? { ...m2.cornerA, tx: m2.cornerA.tx + (land.x - CX - m2.cornerA.tx) * CORNER_CAM.followLanding * 0.5, tz: m2.cornerA.tz + (land.y - m2.cornerA.tz) * CORNER_CAM.followLanding * 0.5 } : m2.cornerA;
        def = lerpCamera(m2.sp, A, e);
      }
    }
    // after your goal (lib/star/celebration.ts): the camera eases onto you and follows your run to the
    // corner and your celebration, a little closer (it only moves; sizes stay absolute)
    {
      const you = f.celebrating ? f.figures.find((g) => g.sid === "you") : undefined;
      if (you) {
        if (m2.celebT0 < 0) m2.celebT0 = f.t;
        const u = Math.min(1, (f.t - m2.celebT0) / 0.9), e = u * u * (3 - 2 * u);
        def = { ...def, tx: def.tx + (you.x - CX - def.tx) * e, tz: def.tz + (you.y - def.tz) * e, D: def.D * (1 - 0.25 * e), minDepth: def.minDepth * (1 - 0.25 * e) };
      } else m2.celebT0 = -1;
    }
    // room to drag back (match2dCam.ts keepDragRoom): while aiming, the ball's spot stays a full-power
    // drag above the screen's bottom in every framing (default, pinched, a corner's start view); the
    // spot is held through the kick so the camera never jumps when the ball is struck
    // (a lead-in: the chance's ball, where the drag will start)
    if (f.ball && (f.phase === "aim" || f.phase === "runup" || f.phase === "contact")) m2.aimBall = lead ? { ...lead.ball } : { x: f.ball.x, y: f.ball.y };
    const farEnd = kindCam && m2.spWide ? (lead ? lerpCamera(wide, m2.spWide, lead.lock) : m2.spWide) : wide;
    const cz = zoomCamera(def, farEnd, zoom);
    const elevDeg = cz.elevDeg + camHeightTest(); // the camera-height test slider (0 in the game)
    const c0 = { ...cz, elevDeg, elev: (elevDeg * Math.PI) / 180 };
    // open play at the default zoom IS the 2D frame (it already leaves the 2D's drag room): untouched
    const kept = m2.aimBall && (sp || zoom !== 0) ? keepDragRoom(c0, m2.aimBall, W, H) : c0;
    // a lead-in: the drag room comes in as the camera fixes (none while it follows the passes)
    const cKept = lead && kept !== c0 ? lerpCamera(c0, kept, lead.lock) : kept;
    let turnDt = 0;
    // THE CAMERA SWIPE (match2dCam.ts ORBIT): turned round the ball while the chance lasts; a new chance,
    // or the end of this one, eases it back to 0
    {
      const live = f.phase === "aim" || f.phase === "runup" || f.phase === "contact" || f.phase === "flight";
      const bk = f.ball && f.phase === "aim" ? `${key}|${f.ball.x.toFixed(1)},${f.ball.y.toFixed(1)}` : orbit.ballKey;
      orbit.kind = f.kind; // the swipe's limit (match2dCam.ts limitOrbit: a corner stops softly at ±60°)
      if (!live || bk !== orbit.ballKey) { orbit.target = camLock.on ? limitOrbit(camLock.deg, f.kind) : 0; orbit.tiltTarget = camLock.on ? camLock.tilt : 0; if (!touch.orbit) orbit.drag = false; if (!touch.tilt) orbit.tiltDrag = false; }
      orbit.ballKey = bk;
      // a turn from elsewhere (the lock, a test still) past this kind's limit comes in to the limit, eased like any other
      if (Math.abs(orbit.target) > orbitMaxFor(f.kind)) orbit.target = limitOrbit(orbit.target, f.kind);
      const dt = orbit.t < 0 ? 0 : Math.max(0, Math.min(0.1, f.t - orbit.t));
      turnDt = dt;
      orbit.t = f.t;
      orbit.deg = orbit.drag ? orbit.target : orbit.deg + (orbit.target - orbit.deg) * Math.min(1, dt / ORBIT.easeS * 3);
      if (Math.abs(orbit.deg - orbit.target) < 0.05) orbit.deg = orbit.target;
      orbit.tilt = orbit.tiltDrag ? orbit.tiltTarget : orbit.tilt + (orbit.tiltTarget - orbit.tilt) * Math.min(1, dt / ORBIT.easeS * 3);
      if (Math.abs(orbit.tilt - orbit.tiltTarget) < 0.05) orbit.tilt = orbit.tiltTarget;
      // ROUND OUR PLAYER, CENTRED (match2dCam.ts centreOnPivot): eased over ORBIT.centreS by how far it is turned
      const want = centreShare(orbit.deg, orbit.tilt, orbit.drag || orbit.tiltDrag);
      orbit.centre += (want - orbit.centre) * Math.min(1, dt / ORBIT.centreS * 3);
      if (Math.abs(orbit.centre - want) < 0.002) orbit.centre = want;
    }
    const pivot = m2.aimBall ?? (f.ball ? { x: f.ball.x, y: f.ball.y } : null);
    const cTurned = pivot && orbit.deg ? orbitCamera(cKept, pivot, orbit.deg) : cKept;
    // turned: an automatic extra tilt down (ORBIT.autoTilt x the centring), so the near stand fills less of the screen
    const tiltAll = orbit.tilt + ORBIT.autoTilt * orbit.centre;
    const cTilted = pivot && tiltAll ? tiltCamera(cTurned, pivot, tiltAll, W, H) : cTurned;
    // turned or tilted: framed round our player (match2dCam.ts frameTurned): the ball near the middle with its
    // drag room, the whole goal mouth when the chance's own camera shows it, mostly pitch on the screen, inside
    // the stadium. Only ever further back or higher (never in, never a size change), smoothly with the turn.
    // The framing glides to each frame's answer (match2dCam.ts easeFit), so it never pops even where the
    // answer moves fast with the turn; the turn itself follows the finger exactly.
    let c = cTilted;
    if (pivot && orbit.centre > 0) {
      // worked out at most every TURN_SOLVE_S (a few ms each on a phone); the glide covers the frames between
      const same = !!turn.fit && turn.key === orbit.ballKey;
      if (!same || !turn.want || f.t - turn.at >= TURN_SOLVE_S || f.t < turn.at) {
        turn.want = solveTurnFit(cTilted, pivot, W, H, showsGoal(cKept, W, H));
        turn.at = f.t;
      }
      const want = turn.want;
      turn.fit = same && turn.fit ? easeFit(turn.fit, want, turnDt) : want;
      turn.key = orbit.ballKey;
      c = frameTurned(cTilted, pivot, orbit.centre, W, H, true, turn.fit);
    } else { turn.fit = null; turn.want = null; }
    const pose = bcPose(c);
    camera.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.look[0], 0, pose.look[2]);
    camera.fov = c.fov;
    camera.aspect = W / H;
    camera.near = (sp && !corner && zoom < 0.5) || orbit.deg || orbit.tilt ? Math.max(0.3, c.minDepth * 0.3) : Math.max(0.1, c.minDepth * 0.8); // a corner: nothing nearer than the framed men (the taker under the camera in A)
    camera.far = c.D + 500;
    camera.updateProjectionMatrix();
    down3.set(c.ax, 0, c.az);
    lean = mScale.lean ? leanFor(c.elevDeg) : 0;
    tv.init = true;
    // the stadium nearer the camera than the 2D view's bottom edge (1.5 m spare) is not drawn
    {
      const q = visibleQuad(fr2);
      let far = -Infinity;
      for (const p of q) far = Math.max(far, (p.x - CX) * c.ax + p.y * c.az);
      // … and never past the pitch's own edge on that side (the stand's front, its roof and truss
      // otherwise hang over the touchline the 2D shows: a corner's taker sat under the truss)
      const edge = Math.abs(c.ax) > 0.5 ? CX : 105;
      arenaClip.normal.set(-c.ax, 0, -c.az);
      arenaClip.constant = Math.min(far + 1.5, edge + 0.3);
      // turned or tilted round our player: the 2D's box no longer says what is on the screen. Keep all
      // the ground the 3D screen shows (to its bottom corners); only what stands nearer the camera than
      // that (a roof in front of the lens) is not drawn (13 Oct 2026: a 90° turn showed a black band)
      if (orbit.deg || orbit.tilt) {
        let near = -Infinity;
        for (const nx of [-1, 0, 1]) { const g = groundUnder(c, W, H, nx, -1); if (g) near = Math.max(near, (g.x - CX) * c.ax + g.y * c.az); }
        // blended in with the centring (orbit.centre), so the cut never jumps the moment a turn starts
        if (near > -Infinity) arenaClip.constant += (near + 1.5 - arenaClip.constant) * Math.min(1, orbit.centre);
      }
      // a turned camera standing over a stand (keepInBowl): its seats stay, like a reverse-angle
      // broadcast shot; only the roof, truss and lamps nearer than the screen's bottom are not drawn
      seatClip.copy(arenaClip);
      // ...and turned, no stand roof, truss or lamp (Harry, 14 Oct 2026: "I only mean the top white roof, not
      // the advertising boards and fans"; from a high camera a roof lay over 40% of the picture, 13 Oct stills)
      if ((orbit.deg || orbit.tilt) && pivot) {
        const cap = Math.min(arenaClip.constant, overheadClipAlong(c, pivot, orbit.centre));
        arenaClip.constant += (cap - arenaClip.constant) * Math.min(1, orbit.centre);
      }
      const over = !!(orbit.deg || orbit.tilt) && overStand(c);
      if (over) seatClip.constant = 1e6;
      // ...and its crowd, which faces the pitch, is seen from behind: drawn both sides while it is
      const crowd = scene.getObjectByName("h-crowd") as { material?: { side: number } } | undefined;
      if (crowd?.material) crowd.material.side = over ? THREE.DoubleSide : THREE.FrontSide;
    }
    (window as unknown as { __tvSolve?: unknown }).__tvSolve = { D: c.D, elevDeg: c.elevDeg, fov: c.fov, extra: c.extra, near: camera.near, facing, fig: SIZE3D.man, man: c.man };
  };
  // ONE camera (Harry, 12 Oct 2026: no New | Old for decided things): the 2D's own frame, with the
  // closer set-piece camera for penalties and free kicks. The old cameras are in the repo's history.
  const placeCamera = (f: EngineFrame) => placeMatch2D(f);

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
  const touch = { ev0: null as PointerEvent | null, id: -1, start3: { x: 0, y: 0 }, start2: { x: 0, y: 0 }, g0: { x: 0, y: 0 }, shot: false, mate: false, last: 0, pend: false, orbit: false, tilt: false, dbl: false, tapAt: 0, tapX: 0, tapY: 0 };
  const send = (type: string, e: PointerEvent, at: { x: number; y: number }) => {
    const c = o.canvas2d;
    if (!c) return;
    c.dispatchEvent(new PointerEvent(type, {
      clientX: at.x, clientY: at.y, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
      button: e.button, buttons: e.buttons, bubbles: true, cancelable: true, composed: true,
    }));
  };
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
    if (!visible || pinch.on) return;
    // PC: the left button only (a mouse drag on open grass turns/tilts the camera, as a finger does)
    if (e.pointerType === "mouse" && e.button !== 0) return;
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
    touch.id = e.pointerId; touch.ev0 = e; touch.start3 = { x: e.clientX, y: e.clientY }; touch.start2 = at; touch.g0 = g;
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
    // The grab zone is bounded on the GLASS round the ball as seen (match2dCam.ts grabsBall): a fingertip
    // always grabs; a little further only if the press is also in the 2D game's own zone (CanvasMatch.tsx
    // BALL_GRAB_FRACTION) or within 3.2 m on the grass. Those used to grab on their own, as circles on the
    // GRASS, which a turned camera centred on the ball blew up to most of the screen (measured: ~170 px
    // radius on a 362 px view): "it's just dragging back from anywhere on the screen".
    const b3 = ballOnGlass();
    const b2d = f?.ball ? to2dClient(f.ball) : null;
    const in2dGrab = !!b2d && !!f && Math.hypot(at.x - b2d.x, at.y - b2d.y) <= 0.2 * f.cam.H;
    const glass = b3 ? Math.hypot(e.clientX - b3.x, e.clientY - b3.y) : Infinity;
    touch.shot = !!f?.ball && f.phase === "aim" && grabsBall(glass, in2dGrab || false, Math.hypot(g.x - f.ball.x, g.y - f.ball.y));
    if (touch.shot && f?.ball) {
      const b2 = to2dClient(f.ball);
      if (b2) { touch.start2 = b2; touch.g0 = { x: f.ball.x, y: f.ball.y }; }
    }
    touch.last = performance.now();
    // THE CAMERA SWIPE: a press on open grass while aiming is held back from the 2D game until it shows
    // what it is. Sideways first → it turns the camera and NEVER reaches the 2D game (no kick, no order);
    // anything else (a tap, a drag up or down) is handed over from its start exactly as before.
    touch.orbit = false; touch.tilt = false;
    touch.pend = !touch.shot && f?.phase === "aim";
    // a second quick tap on open grass: back to the default camera (nothing reaches the 2D game)
    touch.dbl = touch.pend && performance.now() - touch.tapAt < 320 && Math.hypot(e.clientX - touch.tapX, e.clientY - touch.tapY) < 40;
    if (touch.pend) return;
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
  /**
   * A held-back press on the grass handed to the 2D game late (it was neither a turn nor a tilt).
   * The 2D canvas takes the pointer's capture on its own pointerdown when the press lands in its
   * grab zone (the ball's, or a team-mate's), so the rest of this touch went to it at the raw finger
   * spot and its "up" never came back here: this view kept that finger as still down, and every
   * later one-finger touch became a "pinch" (Harry, 14 Oct 2026: "cant drag the ball back anymore
   * and zoom/swipes mixed up"). Take the capture back, as onDown does.
   */
  const handOver = (e: PointerEvent) => {
    if (touch.ev0) send("pointerdown", touch.ev0, touch.start2);
    try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== touch.id) return;
    touch.last = performance.now();
    const dx = e.clientX - touch.start3.x, dy = e.clientY - touch.start3.y;
    if (touch.pend) {
      if (Math.hypot(dx, dy) < ORBIT.startPx) return;
      touch.pend = false; touch.dbl = false;
      if (camLock.on) handOver(e); else
      if (Math.abs(dx) > Math.abs(dy) * ORBIT.sideways) { touch.orbit = true; orbit.drag = true; orbit.d0 = orbit.target; }
      else if (Math.abs(dy) > Math.abs(dx) * TILT.upright) { touch.tilt = true; orbit.tiltDrag = true; orbit.t0 = orbit.tiltTarget; }
      else handOver(e);
    }
    if (touch.orbit) {
      const w = container.getBoundingClientRect().width || 1;
      orbit.target = limitOrbit(orbit.d0 - (dx / w) * ORBIT.degPerWidth, orbit.kind); // a corner: an eased stop at ±60°
      return;
    }
    if (touch.tilt) {
      const h = container.getBoundingClientRect().height || 1;
      orbit.tiltTarget = clampTilt(orbit.t0 + (dy / h) * TILT.degPerHeight); // finger down → higher, up → lower
      return;
    }
    const at = moveTarget(e);
    if (at) send("pointermove", e, at);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== touch.id) return;
    // a camera swipe ends here: nothing was ever sent to the 2D game
    if (touch.orbit || touch.tilt) { touch.orbit = false; touch.tilt = false; orbit.drag = false; orbit.tiltDrag = false; touch.id = -1; return; }
    // a double tap: the default camera again (and unlocked angle 0 if locked: the lock keeps the default)
    if (touch.pend && touch.dbl) {
      touch.pend = false; touch.dbl = false; touch.id = -1; touch.tapAt = 0;
      orbit.target = orbit.tiltTarget = 0;
      if (camLock.on) { camLock.deg = camLock.tilt = 0; saveLock(); }
      return;
    }
    if (touch.pend) { touch.tapAt = performance.now(); touch.tapX = e.clientX; touch.tapY = e.clientY; }
    // a held-back tap on the grass: handed over now, down and up at its start (as before)
    if (touch.pend && touch.ev0) { touch.pend = false; send("pointerdown", touch.ev0, touch.start2); }
    const at = moveTarget(e) ?? touch.start2;
    touch.id = -1;
    send(e.type === "pointercancel" ? "pointercancel" : "pointerup", e, at);
  };
  // PINCH ZOOM (Harry, 12 Oct 2026). Two fingers down = zoom only. The second finger landing ends any
  // one-finger touch first by taking it back to where it started and lifting it there: a zero-length
  // drag, which the 2D game ignores (no kick; a team-mate pressed first gets his tap, an order).
  const pinch = { pts: new Map<number, { x: number; y: number }>(), d0: 0, z0: 0, on: false };
  // dev/test: what the touch handling holds right now (scripts/star-sandbox/switch3d.mjs)
  (window as unknown as { __cam3dInput?: () => unknown }).__cam3dInput = () => ({ visible, orbit: orbit.target, tilt: orbit.tiltTarget, zoom: camZoom(), pinchOn: pinch.on, pinchPts: pinch.pts.size, touchId: touch.id, pend: touch.pend, shot: touch.shot });
  const pinchDist = () => { const a = Array.from(pinch.pts.values()); return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  const onPinchDown = (e: PointerEvent) => {
    if (!visible || e.pointerType !== "touch") return;
    pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.pts.size < 2) return;
    if (!pinch.on && touch.id !== -1 && (touch.pend || touch.orbit || touch.tilt)) { touch.pend = false; touch.orbit = false; touch.tilt = false; orbit.drag = false; orbit.tiltDrag = false; touch.id = -1; }
    if (!pinch.on && touch.id !== -1 && touch.ev0) {
      send("pointermove", touch.ev0, touch.start2);
      send("pointerup", touch.ev0, touch.start2);
      touch.id = -1;
    }
    pinch.on = true; pinch.d0 = Math.max(1, pinchDist()); pinch.z0 = camZoom();
    try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
    e.stopImmediatePropagation(); e.preventDefault();
  };
  const onPinchMove = (e: PointerEvent) => {
    if (!pinch.pts.has(e.pointerId)) return;
    pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pinch.on) return;
    // fingers apart = in (closer), together = out; a doubling of the gap is a full step of 1
    if (pinch.pts.size >= 2 && !camLock.on) setCamZoom(pinch.z0 - Math.log2(Math.max(1, pinchDist()) / pinch.d0)); // a locked camera: no zoom either
    e.stopImmediatePropagation();
  };
  const onPinchUp = (e: PointerEvent) => {
    if (!pinch.pts.delete(e.pointerId)) return;
    if (!pinch.on) return;
    if (pinch.pts.size === 0) pinch.on = false;
    e.stopImmediatePropagation();
  };
  /** Forget the one-finger touch (a camera swipe, a held press, a hand-over) without sending anything. */
  const endTouch = () => { touch.id = -1; touch.pend = false; touch.orbit = false; touch.tilt = false; touch.dbl = false; touch.shot = false; touch.mate = false; orbit.drag = false; orbit.tiltDrag = false; };
  /**
   * A finger lifted ANYWHERE (on this view, on the 2D canvas under it, on the stats bar, or while
   * the 3D is hidden) is no longer down. Checked once the lift has been handled where it landed, so
   * this view's own handlers always run first; a finger they never heard lift is dropped here. So a
   * lost "up" can never leave a stuck finger behind (a one-finger "pinch", or a pitch that ignores
   * every press). Real events only: the 2D game is sent copies of this view's own.
   */
  const onAnyUp = (e: PointerEvent) => {
    if (!e.isTrusted) return;
    const id = e.pointerId;
    setTimeout(() => {
      pinch.pts.delete(id);
      if (pinch.pts.size === 0) pinch.on = false;
      if (touch.id === id) endTouch();
    }, 0);
  };
  // THE WHEEL (Harry, 13 Oct 2026 playtest: every wheel is zoom). A mouse wheel, a precision wheel, a
  // two-finger trackpad scroll and a trackpad pinch (ctrlKey) all ZOOM, and nothing else: the camera is
  // turned and tilted on PC by click-and-drag on open grass (onDown/onMove, as a finger on a phone).
  // A locked camera ignores it.
  const onWheel = (e: WheelEvent) => {
    if (!visible) return;
    e.preventDefault();
    if (camLock.on) return;
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY; // lines / pages → pixels
    if (!px) return;
    setCamZoom(camZoom() + Math.sign(px) * Math.min(0.25, Math.abs(px) / 400));
  };
  // the floating camera button (THE CAMERA LOCK above): top-left of the pitch, clear of the ball, the commentary and the speed readout
  let camBtn: HTMLButtonElement | null = null;
  if (o.canvas2d) {
    camBtn = document.createElement("button");
    camBtn.type = "button";
    camBtn.setAttribute("data-cam-lock", "");
    Object.assign(camBtn.style, { position: "absolute", left: "10px", top: "10px", width: "40px", height: "40px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0", zIndex: "5", pointerEvents: "auto", cursor: "pointer", backdropFilter: "blur(4px)", touchAction: "manipulation" });
    const paint = () => {
      if (!camBtn) return;
      camBtn.style.background = camLock.on ? "rgba(250,204,21,0.92)" : "rgba(15,23,42,0.55)";
      const ink = camLock.on ? "#422006" : "#ffffff";
      camBtn.setAttribute("aria-label", camLock.on ? "Camera locked: tap to unlock" : "Camera free: tap to lock this angle");
      camBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="13" height="10" rx="2"/><path d="M15 10.5l5-3v9l-5-3z"/>${camLock.on
        ? `<rect x="5" y="10.5" width="6" height="4.5" rx="0.8" fill="${ink}" stroke="none"/><path d="M6.3 10.5V9.4a1.7 1.7 0 0 1 3.4 0v1.1" stroke-width="1.5"/>`
        : `<circle cx="8.5" cy="12" r="1.6" fill="#ef4444" stroke="none"/>`}</svg>`;
    };
    paint();
    const stop = (e: Event) => e.stopPropagation();
    camBtn.addEventListener("pointerdown", stop);
    camBtn.addEventListener("pointerup", stop);
    camBtn.addEventListener("pointermove", stop);
    camBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      camLock.on = !camLock.on;
      camLock.deg = camLock.on ? orbit.target : 0; camLock.tilt = camLock.on ? orbit.tiltTarget : 0;
      saveLock(); paint();
    });
    container.appendChild(camBtn);
  }
  if (o.canvas2d) {
    container.style.pointerEvents = "auto";
    container.style.touchAction = "none";
    // the pinch first, so a second finger never reaches the aim
    container.addEventListener("pointerdown", onPinchDown);
    container.addEventListener("pointermove", onPinchMove);
    container.addEventListener("pointerup", onPinchUp);
    container.addEventListener("pointercancel", onPinchUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    container.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onAnyUp, true);
    window.addEventListener("pointercancel", onAnyUp, true);
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
  // Look H usually arrives with the people (its pictures load side by side): open straight in it,
  // its shaders already built for its own picture. Without this the kit drew the first frames and
  // built 43 screen shaders on the spot, then H built its own again (lag pass 4, 9 Oct 2026: the
  // revisit's 7.7 s). A slow first download still opens on the kit after H_WAIT_MS, as before.
  // Meanwhile the spares for the first picture's ~22 men are built a few at a time, between the 2D
  // match's frames, instead of 16 of them inside the first 3D frame (lag pass 4: ~1.3 s of it here).
  const fillSpares = async () => {
    while (spareQueue.length && built < SPARE_TARGET) {
      const t = performance.now();
      while (spareQueue.length && built < SPARE_TARGET && performance.now() - t < 12) spares.push(buildShell(spareQueue.shift()));
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await Promise.all([fillSpares(), def.real && hReady ? Promise.race([hReady, new Promise((r) => setTimeout(r, H_WAIT_MS))]) : null]);
  // the drawing buffer sized now, while loading, not on the first frame (a ~1 s resize on this machine)
  { const cw = container.clientWidth, ch = container.clientHeight; if (cw > 0 && ch > 0) { size = { w: cw, h: ch }; renderer.setSize(cw, ch, false); } }
  /**
   * You, before the kick (setPiece3d.ts). A penalty / free kick: the 2D's own spot (its stance and
   * walk-in), drawn over the last stretch onto the spot where the clip's foot meets the ball.
   * A corner / open play: a stance behind the ball in the shot's direction, then the last steps
   * in once the strike screen opens. Null: the old placing (mid-kick and after, or no clip).
   */
  const takerSpot = (g: EngineFrameFigure, f: EngineFrame): { x: number; y: number } | null => {
    const b0 = bodies.get("you");
    const bl = f.ball;
    if (!b0 || !bl) return null;
    if (g.kick || b0.kicking || b0.kickStyle || b0.state.startsWith("once:")) return null;
    const K = runClip(b0, g);
    if (!K) return null;
    const target = shotTarget(f.kind, f.aim, bl);
    const shotYaw = yawOf(Math.atan2(target.y - bl.y, target.x - bl.x));
    const off = footToBall(b0, K, figNow(), shotYaw);
    const plant = off ? { x: bl.x - off.x, y: bl.y - off.y } : null;
    const lerp = (a: { x: number; y: number }, c: { x: number; y: number }, w: number) => ({ x: a.x + (c.x - a.x) * w, y: a.y + (c.y - a.y) * w });
    if (hasRunup(f.kind)) {
      if (!plant) return null;
      const hold = runHold(K, b0.aimP ?? 0.6);
      if (f.phase === "runup" && f.runup) return lerp(g, plant, runBlend(f.runup.runS, f.runup.t, hold));
      if (f.phase === "contact") return plant;
      return null;
    }
    if (f.phase === "aim" && !g.kick) {
      const st = stanceFor(f.kind, bl, target, g.kickFoot);
      b0.stance = st;
      return st;
    }
    if (f.phase === "contact" && plant) {
      const st = b0.stance ?? stanceFor(f.kind, bl, target, g.kickFoot);
      return lerp(st, plant, Math.min(1, (b0.apT ?? 0) / approachSFor(f.kind)));
    }
    return null;
  };
  return {
    frame(f) {
      frameNo++;
      nowT = f.t;
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, f.t - lastT));
      lastT = f.t;
      if (!visible) return;
      gov.frame(performance.now());
      topUpSpares();
      const cw = container.clientWidth, ch = container.clientHeight;
      if (cw !== size.w || ch !== size.h) { size = { w: cw, h: ch }; renderer.setSize(Math.max(1, cw), Math.max(1, ch), false); }
      { const db = renderer.getDrawingBufferSize(outlineRes); setPeople3dOutlineRes(THREE, db.x, db.y); } // the ink line keeps its screen pixels (smallMen.ts)
      lastFrame = f;
      placeCamera(f);
      if ((window as unknown as { __ev3dDiag?: unknown }).__ev3dDiag) (window as unknown as { __ev3dProject?: unknown }).__ev3dProject = (x: number, y: number, z: number) => { tmpV.set(x - CX, z, y).project(camera); return { X: (tmpV.x * 0.5 + 0.5) * size.w, Y: (0.5 - tmpV.y * 0.5) * size.h }; };
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
        const taker = g === you && f.ball && animFix && mo ? takerSpot(g, f) : null;
        if (taker) at = taker;
        // open play: the 2D picture lets the ball be you; here you stand over it, just off its left
        else if (g === you && !g.drawn && f.ball) {
          const b0 = bodies.get("you");
          const onBall = f.phase === "aim" || f.phase === "contact" || f.phase === "runup";
          if (!animFix) at = onBall || !b0 ? { x: f.ball.x - 0.55, y: f.ball.y + 0.42 } : { x: b0.x, y: b0.y };
          else if (!b0 || (onBall && !b0.kicking && !b0.state.startsWith("once:"))) {
            // stood so the kicking foot meets the ball at contact (calibrated off the clip itself),
            // for the foot and clip he will strike with; else the old fixed step off it
            const clip = mo ? (g.kickFoot < 0 && b0?.play.has("kick_l") ? "kick_l" : "shot_r") : "shot_r";
            const off = b0 ? footToBall(b0, clip, figNow()) : null;
            at = off ? { x: f.ball.x - off.x, y: f.ball.y - off.y } : { x: f.ball.x - 0.55, y: f.ball.y + 0.42 };
          } else at = { x: b0.x, y: b0.y }; // mid-kick and after: he stays where he struck it (never dragged after the ball)
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
        const bs = SIZE3D.ball; // real size with every camera (was up to 2x on New, the style's 1.7-2.0 x 0.85 on Old)
        ball.scale.setScalar(bs);
        const v = ballV.set(fb0.x - CX, Math.max(0, fb0.z) + BALL_R * bs, fb0.y);
        const dd = Number.isFinite(lastBall.x) ? v.distanceTo(lastBall) : 0;
        if (dd > 1e-4 && dd < 3) {
          const ax = ballAx.subVectors(v, lastBall).cross(Y).normalize().negate();
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
      // Measuring (test tools set window.__ev3dDiag = {} first; nothing runs otherwise):
      // every man's drawn step this frame, every size, and your kicking foot to the ball at contact.
      {
        const dg = (window as unknown as { __ev3dDiag?: Ev3dDiag }).__ev3dDiag;
        if (dg) measureFrame(dg, f);
      }
      ring.visible = !!f.ring;
      if (f.ring) { ring.position.set(f.ring.x - CX, 0.02, f.ring.y); ring.scale.setScalar(figNow() * 0.8); }
      placeOrders(f);
      placeGoldTrail(f);
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
        if (d.real && !hball) void import("./real/ball").then(({ dressHBall }) => { if (def.real && !hball) hball = dressHBall(THREE, ball, root, { classic: worldPack() !== "real" }); });
        if (!d.real && hball) { hball.dispose(); hball = null; }
      }
    },
    setTod(t) { hTod = t; h?.setTod(t); },
    setTilt() { /* one camera: it takes its tilt from the 2D frame (f.cam.tilt) */ },
    setVisible(on) {
      // the 2D | 3D switch mid-gesture: a pinch or a camera swipe ends here (a drag already handed to
      // the 2D game is left to finish, so a pull-back in progress still kicks)
      if (on !== visible) { pinch.pts.clear(); pinch.on = false; if (touch.pend || touch.orbit || touch.tilt) endTouch(); }
      visible = on; gov.setPaused("hidden", !on); if (!on) (window as unknown as { __engineView3dBall?: unknown }).__engineView3dBall = null; container.style.pointerEvents = on && o.canvas2d ? "auto" : "none"; canvas3d.style.visibility = on ? "" : "hidden"; svg.style.visibility = on ? "" : "hidden"; },
    dispose() {
      hToken++;
      offPack();
      gov.dispose();
      hball?.dispose(); hball = null;
      if (homeMen) void import("./real/ball").then(({ setHBallLightRing }) => setHBallLightRing(true)).catch(() => {}); // drills keep their ring
      void import("./real/arena").then((m) => m.setArenaGoalScale(1)).catch(() => {});
      h?.dispose(); h = null;
      kit?.dispose(); kit = null;
      // the spares never reached the scene, so release(root) never saw them: their own materials and bones go here
      spareBins.forEach((l) => { for (const p of l) disposeObject3D(p.root); }); spareBins.clear();
      numberCache.forEach((t) => t.dispose()); numberCache.clear();
      new Set(smallMaps.values()).forEach((t) => t?.dispose()); smallMaps.clear();
      goldSparks.forEach((s) => s.material.dispose()); goldTex.dispose();
      svg.remove();
      camBtn?.remove();
      canvas3d.removeEventListener("webglcontextlost", onLostEv);
      canvas3d.removeEventListener("webglcontextrestored", onRestoredEv);
      container.removeEventListener("pointerdown", onPinchDown);
      container.removeEventListener("pointermove", onPinchMove);
      container.removeEventListener("pointerup", onPinchUp);
      container.removeEventListener("pointercancel", onPinchUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      container.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onAnyUp, true);
      window.removeEventListener("pointercancel", onAnyUp, true);
      release(root);
    },
  };
}
