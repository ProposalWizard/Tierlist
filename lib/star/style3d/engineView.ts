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
import { CX } from "../pitch";
import type { EngineFrame, EngineFrameFigure } from "../engineFrame";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D, type PersonLook } from "../people3d";
import { people3dLook } from "../look3d";
import { addClips, clipInfo, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import { faceFromUrl } from "../three3d/faceFromUrl";
import { newNumberCanvas, drawShirtNumber } from "../signing3dTextures";
import { canvasToScreen } from "../cameraTilt";
import { createStyleKit, type StyleKit } from "./kit";
import { buildStadium, type Stadium } from "./stadium";
import type { StyleDef } from "./styles";
import type { RealLook } from "./real/look";
import type { TimeOfDay } from "./real/assets";

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

export async function createEngineView(container: HTMLElement, o: { def: StyleDef; tier?: Quality3d; tod?: TimeOfDay; figScale?: number; faces?: boolean; tilt?: number; camera?: "tv" | "exact"; canvas2d?: HTMLCanvasElement }): Promise<EngineView> {
  const faces = !!o.faces;
  let tvTilt = o.tilt ?? 40;
  const camMode = o.camera ?? "tv";
  const tier = o.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkU.default ?? SkU;
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
    const m = p.body.material as any;
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

  const numberTex = (n: number) => {
    const c = newNumberCanvas(); drawShirtNumber(c, n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const makeBody = (sid: string, shirt: string, shorts: string): Body => {
    const p = makePerson3d(THREE, SK, model, animG, { outline: prof.outlines ? 0.005 : 0, castShadow: prof.shadows });
    const look: PersonLook = {
      skin: SKINS[hashOf(sid) % SKINS.length], hair: "#1b120c",
      kit: { shirt, trim: shorts }, number: numberTex(numberFor(sid)),
      accessories: sid === "keeper" ? [{ slot: "hands", color: "#f5f5f5", color2: "#16a34a" }] : [],
    };
    dressPerson3d(THREE, p, look);
    plainHead(p, look.skin, look.hair ?? "#1b120c");
    relaxHands(THREE, p);
    if (fb) addClips(THREE, p, fb as any);
    const play = new ClipPlayer(THREE, p.actions);
    play.play(sid === "keeper" && play.has("ready_shuffle") ? "ready_shuffle" : "idle", { fade: 0 });
    root.add(p.root);
    kit?.stylePeople([p]);
    h?.dressPeople([p]);
    return { p, play, look, sid, kitKey: `${shirt}|${shorts}`, x: 0, y: 0, vx: 0, vy: 0, yaw: 0, state: "idle", onceLeft: 0, lastAct: -1, kicking: false, seen: 0, init: false };
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
    b.yaw += d * Math.min(1, dt * rate);
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
    b.play.play(clip, { fade: 0.06, from, speed, once: true });
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
    b.p.root.position.set(b.x - CX, 0, b.y);
    b.p.root.rotation.set(0, b.yaw, 0);
    b.p.root.scale.setScalar(figNow());
    b.p.root.visible = true;
  };

  const placeKeeper = (k: NonNullable<EngineFrame["keeper"]>, f: EngineFrame, dt: number, frameNo: number) => {
    const b = bodyFor("keeper", k.shirt, k.shorts, faces ? k.face : undefined);
    b.seen = frameNo;
    const jump = Math.hypot(k.x - b.x, k.y - b.y);
    if (!b.init || jump > 4) { b.x = k.x; b.y = k.y; b.vx = 0; b.vy = 0; b.init = true; b.dive = undefined; }
    else if (dt > 0) {
      const kk = Math.min(1, dt * 8);
      b.vx += ((k.x - b.x) / dt - b.vx) * kk; b.vy += ((k.y - b.y) / dt - b.vy) * kk;
      b.x = k.x; b.y = k.y;
    }
    // square to the pitch, out of his goal
    turnTo(b, 0, dt, 6);
    let lift = 0;
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
    b.p.root.position.set(b.x - CX, lift, b.y);
    b.p.root.rotation.set(0, b.yaw, 0);
    b.p.root.scale.setScalar(figNow() * KEEPER_SHARE);
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
          for (const b of list) { const m = b.p.body.material as any; m.roughness = 0.62; m.metalness = 0; }
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
  restyle();
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
  const tv = { x: 0, z: 0, D: 60, key: "", init: false };
  /** The TV camera's figure scale this frame (see TARGET_PX). */
  let tvFig = ENGINE_VIEW_FIG_SCALE;
  const figNow = () => (camMode === "tv" && tv.init ? tvFig : figScale);
  const tvSolve = (f: EngineFrame) => {
    const { W, H } = f.cam;
    const th = (Math.max(5, Math.min(70, tvTilt)) * Math.PI) / 180;
    const hv = (TV_CAMERA.fov * Math.PI) / 360;
    const hh = Math.atan(Math.tan(hv) * (W / H));
    const vp = f.cam.viewport;
    const ball = f.ball ?? { x: (vp.x1 + vp.x2) / 2, y: (vp.y1 + vp.y2) / 2 };
    // Everyone in the chance, the ball, and the goal mouth when the goal is in it:
    // all of it on the screen, centred, as close as that allows.
    const pts: { x: number; y: number }[] = [{ x: ball.x, y: ball.y }, ...f.figures.map((g) => ({ x: g.x, y: g.y }))];
    if (f.goalInView) pts.push({ x: CX - 4.5, y: -0.5 }, { x: CX + 4.5, y: -0.5 });
    if (f.keeper) pts.push({ x: f.keeper.x, y: f.keeper.y });
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
    const Dmin = dFor(TV_CAMERA.minViewW), Dmax = dFor(TV_CAMERA.maxViewW);
    const topAt = f.goalInView ? TV_CAMERA.goalLineAt : TV_CAMERA.top;
    // where the camera looks for distance D: the goal end pinned near the top,
    // or (no goal) the group centred
    const lzFor = (D: number) => {
      if (f.goalInView) return lookFor(y0, topAt, D);
      let fr = TV_CAMERA.top;
      for (let i = 0; i < 3; i++) {
        const lzi = lookFor(y0, fr, D);
        const mid = (shareOf(y0, lzi, D) + shareOf(y1, lzi, D)) / 2;
        fr = Math.max(0.04, Math.min(0.5, fr + (TV_CAMERA.centre - mid)));
      }
      return lookFor(y0, fr, D);
    };
    // Everyone actually on the glass (projected through this camera, not
    // estimated at the look point: the action is beyond it, where the
    // picture is wider). Closest camera that fits, so the men are big.
    const tH = Math.tan(hv), tW = Math.tan(hh), sn = Math.sin(th), cs = Math.cos(th);
    const xMargin = 1 - (2 * TV_CAMERA.marginPx) / Math.max(1, W);
    const fitsAll = (D: number) => {
      const lz = lzFor(D);
      const cy = D * cs, cz = lz + D * sn;
      for (const q of pts) {
        const vx = q.x - CX - lx, vy = -cy, vz = q.y - cz;
        const depth = -cs * vy - sn * vz;
        if (depth <= 0.1) return false;
        const nx = vx / (depth * tW);
        const ny = (sn * vy - cs * vz) / (depth * tH);
        if (Math.abs(nx) > xMargin || (1 - ny) / 2 > TV_CAMERA.bottom) return false;
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
    return { x: lx, z: lz, D, th, fov: TV_CAMERA.fov, W, H, ballDepth };
  };
  const placeTvCamera = (f: EngineFrame, dt: number) => {
    const t = tvSolve(f);
    // a new chance (or a cut in the 2D) cuts here too
    const vp = f.cam.viewport;
    const key = `${f.kind}|${Math.round(vp.x1)}|${Math.round(vp.y1)}|${Math.round(vp.x2)}|${Math.round(vp.y2)}`;
    if (!tv.init || key !== tv.key) { tv.x = t.x; tv.z = t.z; tv.D = t.D; tv.key = key; tv.init = true; }
    else {
      const k = Math.min(1, dt * 2.5);
      tv.x += (t.x - tv.x) * k; tv.z += (t.z - tv.z) * k; tv.D += (t.D - tv.D) * k;
    }
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
  const touch = { id: -1, start3: { x: 0, y: 0 }, start2: { x: 0, y: 0 }, g0: { x: 0, y: 0 }, shot: false };
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
  const onDown = (e: PointerEvent) => {
    if (!visible || touch.id !== -1) return;
    const g = groundAt(e.clientX, e.clientY);
    const at = g && to2dClient(g);
    if (!g || !at) return;
    e.preventDefault();
    try { container.setPointerCapture(e.pointerId); } catch { /* fine */ }
    const f = lastFrame;
    touch.id = e.pointerId; touch.start3 = { x: e.clientX, y: e.clientY }; touch.start2 = at; touch.g0 = g;
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
    send("pointerdown", e, touch.start2);
  };
  const moveTarget = (e: PointerEvent) => {
    const g = groundAt(e.clientX, e.clientY);
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
      // the ball
      const fb0 = f.ball;
      ball.visible = !!fb0;
      if (fb0) {
        const bs = def.ballScale * 0.85;
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
      // frame-stepped filming (lib/star/virtualClock.ts) draws only the frames it films
      if ((window as unknown as { __view3dSkipDraw?: boolean }).__view3dSkipDraw) { leanAll(); return; }
      if (f.phase === "contact") return; // the strike screen covers the pitch
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
    setVisible(on) { visible = on; if (!on) (window as unknown as { __engineView3dBall?: unknown }).__engineView3dBall = null; container.style.pointerEvents = on && o.canvas2d && camMode === "tv" ? "auto" : "none"; canvas3d.style.visibility = on ? "" : "hidden"; svg.style.visibility = on ? "" : "hidden"; },
    dispose() {
      hToken++;
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
