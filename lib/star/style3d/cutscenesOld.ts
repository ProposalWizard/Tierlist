/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * STYLE TESTING — CUT SCENES, in the style kit.
 *
 *   goal     wide → behind the shooter → the run → a low close-up of the knee
 *            slide, team-mates piling in (people3d + the football clips; the
 *            knee slide is the clip's body with the legs and arms set by IK).
 *   signing  an office high in the stand: manager and player shake hands over
 *            the desk, the pitch through the window (the same stadium).
 *
 * Every frame is worked out from the clock alone (each man's clip and clip
 * time are set from t), so a cut scene can be scrubbed, replayed and stilled.
 */
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer, disposeObject3D } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { addClips, loadAnims3d } from "../three3d/footballAnims";
import { aimBone, rotateBoneWorld, solveArm } from "../signing3dRig";
import { createStyleKit, glowTexture, glowSprite, type StyleKit } from "./kit";
import { buildStadium, type Stadium } from "./stadium";
import type { StyleDef } from "./styles";
import { numberTexture, HOME, AWAY, KEEPER } from "./gameplay";

export type CutKind = "goal" | "signing";

export interface CutScene {
  readonly duration: number;
  setStyle(def: StyleDef): void;
  replay(): void;
  /** Hold still at t seconds (stills). */
  seek(t: number): void;
  /** Frame stepping: stop the real-time loop and draw exactly t (forward in small steps, so repeatable). */
  frameSeek(t: number): void;
  /** The shot on screen now (for the page's label). */
  onShot?: (name: string) => void;
  dispose(): void;
}

type V3 = [number, number, number];
type Seg = { at: number; clip: string; from?: number; speed?: number; loop?: boolean };

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

interface Actor { p: Person3D; segs: Seg[] }

function poseAt(T: any, a: Actor, t: number, fade = 0.22, stepped = 0) {
  if (stepped > 0) t = Math.floor(t * stepped) / stepped;
  const segs = a.segs;
  let i = 0;
  for (let j = 0; j < segs.length; j++) if (segs[j].at <= t) i = j;
  const cur = segs[i], prev = i > 0 ? segs[i - 1] : null;
  // back to the bind pose first: IK and bone turns from the last frame must not pile up
  a.p.rest.forEach(([p, q], b) => { b.position.copy(p); b.quaternion.copy(q); });
  for (const act of Object.values(a.p.actions)) act.setEffectiveWeight(0);
  const set = (s: Seg, w: number) => {
    const act = a.p.actions[s.clip];
    if (!act) return;
    const d = act.getClip().duration;
    let tt = (s.from ?? 0) + (t - s.at) * (s.speed ?? 1);
    tt = s.loop ? ((tt % d) + d) % d : Math.min(d - 1e-3, Math.max(0, tt));
    act.enabled = true; act.paused = false;
    act.time = tt;
    act.setEffectiveWeight(w);
  };
  const k = prev ? Math.min(1, Math.max(0, (t - cur.at) / fade)) : 1;
  set(cur, k);
  if (prev && k < 1) set(prev, 1 - k);
  a.p.mixer.update(0);
  void T;
}

function makeBall(T: any) {
  const ball = new T.Group();
  const s = new T.Mesh(new T.SphereGeometry(0.11, 20, 14), new T.MeshStandardMaterial({ color: "#fbfbf8", roughness: 0.45 }));
  s.castShadow = true; ball.add(s);
  const patch = new T.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.5 });
  for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3]]) {
    const p = new T.Mesh(new T.CircleGeometry(0.038, 5), patch);
    const v = new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
    p.position.copy(v.multiplyScalar(0.1105)); p.lookAt(v.clone().multiplyScalar(2)); ball.add(p);
  }
  return ball;
}

export async function createCutScene(container: HTMLElement, kind: CutKind, first: StyleDef, o: { tier?: Quality3d; onShot?: (n: string) => void } = {}): Promise<CutScene> {
  const tier = o.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const T: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkU.default ?? SkU;
  const loader = await withMeshopt(new GLTFLoader());
  const body = people3dLook();
  const [player, manager, animG, fb] = await Promise.all([
    loadPeople3d(loader, "player", body),
    kind === "signing" ? loadPeople3d(loader, "manager", body) : Promise.resolve(null),
    loadPeople3d(loader, "anims", body),
    loadAnims3d(loader, "football").catch(() => null),
  ]);

  const { renderer, release } = acquireRenderer(T, container, prof);
  const scene = new T.Scene();
  const root = new T.Group();
  scene.add(root);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 300);
  let def = first;
  const kit: StyleKit = createStyleKit(T, renderer, scene, tier, def);

  const actors: Actor[] = [];
  const mk = (model: any, look: Parameters<typeof dressPerson3d>[2], segs: Seg[]): Actor => {
    const p = makePerson3d(T, SK, model, animG, { outline: 0.006, castShadow: prof.shadows, outlineNear: 4 });
    dressPerson3d(T, p, look);
    relaxHands(T, p);
    if (fb) addClips(T, p, fb);
    for (const a of Object.values(p.actions)) { a.setLoop(T.LoopRepeat, Infinity); a.play(); a.setEffectiveWeight(0); }
    root.add(p.root);
    const a = { p, segs };
    actors.push(a);
    return a;
  };
  const up = new T.Vector3(0, 1, 0);
  const wp = (b: any) => { const v = new T.Vector3(); b.getWorldPosition(v); return v; };
  const place = (a: Actor, x: number, z: number, yaw: number, y = 0) => { a.p.root.position.set(x, y, z); a.p.root.rotation.set(0, yaw, 0); a.p.root.updateMatrixWorld(true); };
  const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);

  /** Knees on the grass, body back, arms wide: the clip's body, legs and arms set by IK, `w` of the way. */
  const kneel = (a: Actor, f: any, w: number, armsUp: number) => {
    if (w <= 0) return;
    const B = a.p.bones;
    const left = new T.Vector3().crossVectors(up, f).normalize();
    for (const [S, sx] of [["Left", 1], ["Right", -1]] as const) {
      const ul = B[`${S}UpLeg`], lo = B[`${S}Leg`], ft = B[`${S}Foot`];
      if (!ul || !lo || !ft) continue;
      const hip = wp(ul), knee = wp(lo), foot = wp(ft);
      const thigh = hip.distanceTo(knee), shin = knee.distanceTo(foot);
      const kt = hip.clone().add(new T.Vector3(0, -thigh * 0.96, 0)).add(f.clone().multiplyScalar(0.16)).add(left.clone().multiplyScalar(0.07 * sx));
      aimBone(T, ul, knee, kt, w);
      const k2 = wp(lo);
      const ftT = k2.clone().add(f.clone().multiplyScalar(-shin * 0.95)).add(new T.Vector3(0, -0.04, 0));
      aimBone(T, lo, wp(ft), ftT, w);
    }
    const ky = Math.min(wp(B.LeftLeg).y, wp(B.RightLeg).y);
    a.p.root.position.y -= (ky - 0.08) * w;
    a.p.root.updateMatrixWorld(true);
    if (B.Spine) rotateBoneWorld(T, B.Spine, new T.Quaternion().setFromAxisAngle(new T.Vector3().crossVectors(f, up).normalize(), 0.16 * w));
    if (B.Head) rotateBoneWorld(T, B.Head, new T.Quaternion().setFromAxisAngle(new T.Vector3().crossVectors(f, up).normalize(), -0.06 * w));
    for (const [S, sx] of [["Left", 1], ["Right", -1]] as const) {
      const ua = B[`${S}Arm`], fa = B[`${S}ForeArm`], h = B[`${S}Hand`];
      if (!ua || !fa || !h) continue;
      const sh = wp(ua);
      const tgt = sh.clone().add(left.clone().multiplyScalar(0.58 * sx)).add(new T.Vector3(0, 0.12 + 0.35 * armsUp, 0)).add(f.clone().multiplyScalar(0.12));
      solveArm(T, ua, fa, h, tgt, new T.Vector3(0, -1, 0).add(f.clone().multiplyScalar(-0.6)), w);
    }
  };

  // ── the cast and the clock ──
  const skins = ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e", "#f1c27d", "#a36a3e"];
  let env: { group: any; update(dt: number, t: number): void } | null = null;
  let update: (t: number) => void = () => {};
  let duration = 8;
  let shotName = "";
  const focus = { x: 0, y: 0, z: 0 };

  const setCam = (pos: V3, look: V3, fov: number) => {
    camera.position.set(...pos);
    camera.lookAt(...look);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };
  const shot = (n: string) => { if (n !== shotName) { shotName = n; o.onShot?.(n); } };

  if (kind === "goal") {
    duration = 9.6;
    const ball = makeBall(T);
    ball.scale.setScalar(1.15);
    root.add(ball);
    const gmap = glowTexture(T);
    const sparks = glowSprite(T, gmap), aura = glowSprite(T, gmap);
    root.add(sparks, aura);
    const scorer = mk(player, { skin: skins[0], hair: "#2b1b10", kit: HOME, number: numberTexture(T, 9) }, [
      { at: 0, clip: "dribble_run", loop: true, speed: 0.95 },
      { at: 2.45, clip: "shot_r", from: 0 },
      { at: 3.45, clip: "jog", loop: true },
      { at: 3.9, clip: "sprint", loop: true },
      { at: 5.0, clip: "celebrate_fist", from: 0.3, speed: 0.5 },
    ]);
    const keeper = mk(player, { skin: skins[1], hair: "#111", kit: KEEPER, number: numberTexture(T, 1), accessories: [{ slot: "hands", color: "#f5f5f5", color2: "#16a34a" }] }, [
      { at: 0, clip: "ready_shuffle", loop: true },
      { at: 2.7, clip: "dive_left", from: 0.05 },
    ]);
    const def4 = mk(player, { skin: skins[2], hair: "#1b120c", kit: AWAY, number: numberTexture(T, 4) }, [
      { at: 0, clip: "sprint", loop: true },
      { at: 2.9, clip: "jog", loop: true },
      { at: 3.4, clip: "frustrated", from: 0 },
    ]);
    const def5 = mk(player, { skin: skins[3], hair: "#0f0b08", kit: AWAY, number: numberTexture(T, 5) }, [
      { at: 0, clip: "jog", loop: true },
      { at: 3.3, clip: "frustrated", from: 0.2 },
    ]);
    const m7 = mk(player, { skin: skins[4], hair: "#4a2e1c", kit: HOME, number: numberTexture(T, 7) }, [
      { at: 0, clip: "jog", loop: true },
      { at: 4.4, clip: "sprint", loop: true },
      { at: 7.1, clip: "celebrate_fist", from: 0 },
    ]);
    const m10 = mk(player, { skin: skins[5], hair: "#1b120c", kit: HOME, number: numberTexture(T, 10) }, [
      { at: 0, clip: "jog", loop: true },
      { at: 4.6, clip: "sprint", loop: true },
      { at: 7.4, clip: "celebrate", loop: true },
    ]);
    // where things go (Z out from the goal line, the goal at Z = 0)
    const D0: V3 = [-5.5, 0, 24], SHOT: V3 = [-2.6, 0, 14.2];
    const fRun = new T.Vector3(-0.43, 0, 0.9).normalize();
    const RUN_END: V3 = [-5.3, 0, 20.2];
    const S: V3 = [RUN_END[0] + fRun.x * 2.1, 0, RUN_END[2] + fRun.z * 2.1];
    const CONTACT = 2.45 + 0.31;
    const TARGET: V3 = [2.95, 1.9, -0.15];
    // confetti
    const CN = tier === "low" ? 60 : 180;
    const conf = new T.InstancedMesh(new T.PlaneGeometry(0.09, 0.06), new T.MeshBasicMaterial({ side: T.DoubleSide, vertexColors: false }), CN);
    const confCols = ["#e63946", "#ffffff", "#f4c542", "#d62828"];
    const cs: number[][] = [];
    for (let i = 0; i < CN; i++) { cs.push([Math.random() * 6 - 3, Math.random() * 5, Math.random() * 6 - 3, Math.random() * 6, Math.random() * 6]); conf.setColorAt(i, new T.Color(confCols[i % 4])); }
    root.add(conf);
    const mtx = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1), pv = new T.Vector3();

    update = (t) => {
      for (const a of actors) poseAt(T, a, t, 0.22, def.stepped ?? 0);
      // scorer
      if (t < 2.45) {
        const k = t / 2.45;
        const p = lerp3(D0, SHOT, k);
        place(scorer, p[0], p[2], yawTo(SHOT[0] - D0[0], SHOT[2] - D0[2]));
      } else if (t < 3.45) {
        place(scorer, SHOT[0], SHOT[2] - Math.min(0.5, (t - 2.45) * 0.6), Math.PI + 0.12);
      } else if (t < 5.0) {
        const k = seg(t, 3.45, 5.0);
        const from: V3 = [SHOT[0], 0, SHOT[2] - 0.5];
        const p = lerp3(from, RUN_END, k);
        const turn = Math.min(1, (t - 3.45) / 0.45);
        place(scorer, p[0], p[2], lerp(Math.PI + 0.12, yawTo(fRun.x, fRun.z) + (fRun.x < 0 ? 0 : 0), turn) + (turn < 1 ? 0 : 0));
        if (turn >= 1) scorer.p.root.rotation.y = yawTo(fRun.x, fRun.z);
      } else {
        const k = Math.min(1, (t - 5.0) / 1.05);
        const slide = 1 - (1 - k) * (1 - k);
        place(scorer, RUN_END[0] + fRun.x * 2.1 * slide, RUN_END[2] + fRun.z * 2.1 * slide, yawTo(fRun.x, fRun.z));
        kneel(scorer, fRun, Math.min(1, (t - 5.0) / 0.22), seg(t, 5.6, 6.6));
      }
      // ball
      if (t < CONTACT) {
        const sp = scorer.p.root.position;
        const fwd = t < 2.45 ? new T.Vector3(SHOT[0] - D0[0], 0, SHOT[2] - D0[2]).normalize() : new T.Vector3(0.12, 0, -1).normalize();
        const touch = t < 2.45 ? 0.75 + 0.25 * Math.abs(Math.sin(t * 4.5)) : 0.42;
        ball.position.set(sp.x + fwd.x * touch - 0.12, 0.11 * 1.15, sp.z + fwd.z * touch);
        ball.rotation.x -= 0.15;
      } else if (t < CONTACT + 0.52) {
        const k = (t - CONTACT) / 0.52;
        const from: V3 = [SHOT[0] - 0.1, 0.13, SHOT[2] - 0.45];
        ball.position.set(lerp(from[0], TARGET[0], k) + Math.sin(k * Math.PI) * 0.6, lerp(from[1], TARGET[1], k) + Math.sin(k * Math.PI) * 0.5, lerp(from[2], TARGET[2], k));
        ball.rotation.y += 0.4;
      } else if (t < CONTACT + 1.2) {
        const k = (t - CONTACT - 0.52) / 0.68;
        ball.position.set(TARGET[0] + 0.2 * k, Math.max(0.12, TARGET[1] - 1.9 * k * k), TARGET[2] - 1.6 * Math.min(1, k * 1.6));
      }
      // sparks on the struck ball; the aura round the scorer on the big moments; impact frames; speed lines
      const flying = t >= CONTACT && t < CONTACT + 0.55;
      sparks.visible = !!def.ballSparks && flying;
      if (sparks.visible) { sparks.material.color.set(def.ballSparks!); sparks.position.copy(ball.position); const k = 1.1 + Math.random() * 0.5; sparks.scale.set(k, k, 1); }
      const auraOn = !!def.aura && ((t > 2.0 && t < 3.2) || t > 5.0);
      aura.visible = auraOn;
      if (auraOn) {
        aura.material.color.set(def.aura!);
        const sp0 = scorer.p.root.position;
        // behind him (away from the camera), so he stands in front of his own glow
        const away = new T.Vector3(sp0.x - camera.position.x, 0, sp0.z - camera.position.z).normalize().multiplyScalar(0.8);
        aura.position.set(sp0.x + away.x, t > 5 ? 0.85 : 1.15, sp0.z + away.z);
        const k = (t > 5 ? 2.0 : 2.4) + Math.sin(t * 18) * 0.12;
        aura.scale.set(k * 0.8, k * 1.2, 1);
        aura.material.opacity = (t > 5 ? Math.min(1, (t - 5) * 2) : 1) * 0.7;
      }
      const imp = def.impact ? ((t > CONTACT && t < CONTACT + 0.07) || (t > CONTACT + 0.5 && t < CONTACT + 0.56) ? 1 : 0) : 0;
      kit.setImpact(imp);
      kit.setBurst(def.burst ? Math.max(t > 2.05 && t < 2.76 ? 0.8 : 0, t > 5.0 ? 1 - seg(t, 5.6, 8.5) * 0.6 : 0) : 0);
      // keeper: on his line, then the dive to his left (towards +X)
      const dk = seg(t, 2.78, 3.25);
      place(keeper, 0.2 + dk * 1.3 + (t < 2.7 ? Math.sin(t * 2.2) * 0.25 : 0), 0.7, 0, Math.sin(Math.min(1, Math.max(0, (t - 2.85) / 0.5)) * Math.PI) * 0.35);
      // defenders
      if (t < 3.0) { const p = lerp3([-9.5, 0, 25], [-5.4, 0, 16.8], t / 3.0); place(def4, p[0], p[2], yawTo(SHOT[0] - p[0], SHOT[2] - p[2])); }
      else place(def4, -5.4, 16.8, yawTo(0, -1));
      { const p = lerp3([2.5, 0, 9], [1.2, 0, 7.6], Math.min(1, t / 3)); place(def5, p[0], p[2], yawTo(-0.4, 1)); }
      // team-mates pile in from behind him (the goal side)
      const S7: V3 = [S[0] - 1.3, 0, S[2] - 1.6], S10: V3 = [S[0] + 1.2, 0, S[2] - 1.9];
      { const k = seg(t, 4.4, 7.1); const p = lerp3([3, 0, 9], S7, k); place(m7, p[0], p[2], k < 1 ? yawTo(S7[0] - 3, S7[2] - 9) : yawTo(S[0] - S7[0], S[2] - S7[2])); }
      { const k = seg(t, 4.6, 7.4); const p = lerp3([-12, 0, 11], S10, k); place(m10, p[0], p[2], k < 1 ? yawTo(S10[0] + 12, S10[2] - 11) : yawTo(S[0] - S10[0], S[2] - S10[2])); }
      // confetti in front of the close-up
      conf.visible = def.confetti && t > 5.4;
      if (conf.visible) {
        for (let i = 0; i < CN; i++) {
          const c = cs[i];
          const y = 5.5 - (((t - 5.4) * 0.9 + c[1]) % 5.5);
          pv.set(S[0] + c[0] + Math.sin(t * 1.3 + c[3]) * 0.3, y, S[2] + c[2] + 1.5);
          e.set(t * 3 + c[3], t * 2 + c[4], 0); q.setFromEuler(e);
          mtx.compose(pv, q, sc); conf.setMatrixAt(i, mtx);
        }
        conf.instanceMatrix.needsUpdate = true;
      }
      // the camera
      const sp = scorer.p.root.position;
      if (t < 2.45) {
        shot("Wide");
        const k = t / 2.45;
        setCam(lerp3([-26, 10.5, 30], [-23, 9, 22], k), [sp.x + 3, 0.8, sp.z - 6], 42);
      } else if (def.impact && t >= 2.05 && t < 2.62) {
        // Anime: the eyes, before the strike
        shot("The eyes");
        const hd = wp(scorer.p.bones.Head);
        const fw = new T.Vector3(0.12, 0, -1).normalize();
        const k = seg(t, 2.05, 2.62);
        setCam([hd.x + fw.x * 0.55 + 0.04, hd.y + 0.06, hd.z + fw.z * 0.55], [hd.x, hd.y + lerp(0.06, 0.08, k), hd.z], lerp(22, 16, k));
      } else if (t < 3.9) {
        shot("Behind the shooter");
        const k = seg(t, 2.45, 3.9);
        setCam(lerp3([-4.6, 1.35, 19.6], [-3.9, 1.5, 18.2], k), [lerp(0.2, 2.0, k), 1.1, 1.5], 34);
      } else if (t < 5.0) {
        shot("The run");
        setCam([sp.x + 4.5, 1.5, sp.z + 6.5], [sp.x, 1.0, sp.z], 38);
      } else {
        shot("Knee slide · close");
        const k = seg(t, 5.0, duration);
        const d = lerp(3.6, 2.5, k), h = lerp(0.42, 0.62, k);
        const sx = S[0] + fRun.x * d + 0.55, sz = S[2] + fRun.z * d;
        setCam([sx, h, sz], [S[0], lerp(0.9, 1.05, k), S[2] - 0.2], 44);
      }
      focus.x = sp.x; focus.z = sp.z;
    };
  } else {
    duration = 8.2;
    // the office: high in the near stand, the pitch through the window
    const room = new T.Group();
    root.add(room);
    const buildRoom = () => {
      room.clear();
      const wood = kit.mat("#7a4a2a", { rough: 0.5 });
      const wall = kit.mat("#d9cbb8", { rough: 0.9 });
      const dark = kit.mat("#2a2420", { rough: 0.7 });
      const floor = new T.Mesh(new T.BoxGeometry(9, 0.1, 7.5), kit.mat("#5b3a26", { rough: 0.6 }));
      floor.position.set(0, -0.05, -0.2); floor.receiveShadow = true; room.add(floor);
      const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: any, cast = true) => {
        const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = cast; b.receiveShadow = true; room.add(b); return b;
      };
      // back wall with a big window (x −3.2..3.2, y 0.85..2.95)
      box(9, 0.85, 0.2, 0, 0.425, -3.5, wall); box(9, 0.6, 0.2, 0, 3.25, -3.5, wall);
      box(1.3, 2.1, 0.2, -3.85, 1.9, -3.5, wall); box(1.3, 2.1, 0.2, 3.85, 1.9, -3.5, wall);
      for (const x of [-3.2, -1.07, 1.07, 3.2]) box(0.08, 2.1, 0.14, x, 1.9, -3.45, dark);
      box(6.4, 0.08, 0.14, 0, 2.95, -3.45, dark); box(6.4, 0.08, 0.14, 0, 0.88, -3.45, dark);
      // side wall, picture
      box(0.2, 3.6, 7.5, -4.4, 1.8, -0.2, wall);
      box(0.05, 0.8, 1.1, -4.27, 1.9, -0.8, kit.mat("#c47a4a"));
      // desk, chair, lamp, paper, plant
      box(1.9, 0.07, 0.34, -0.05, 0.76, -0.6, wood);
      box(1.85, 0.7, 0.04, -0.05, 0.38, -0.75, wood);
      for (const x of [-0.95, 0.85]) box(0.06, 0.73, 0.3, x, 0.365, -0.6, wood);
      box(0.6, 0.08, 0.55, -0.1, 0.5, -1.45, dark); box(0.6, 0.9, 0.08, -0.1, 1.0, -1.75, dark);
      box(0.3, 0.005, 0.24, 0.35, 0.8, -0.6, kit.mat("#f7f3ea"), false);
      const lampBase = box(0.16, 0.03, 0.16, 0.8, 0.81, -0.62, kit.mat("#b08a3a", { metal: 0.7, rough: 0.3 }));
      void lampBase;
      const shade = new T.Mesh(new T.ConeGeometry(0.17, 0.2, 16, 1, true), kit.mat("#2f5d3a", { side: T.DoubleSide }));
      shade.position.set(0.8, 1.18, -0.62); room.add(shade);
      box(0.025, 0.36, 0.025, 0.8, 0.99, -0.62, kit.mat("#b08a3a", { metal: 0.7, rough: 0.3 }));
      const bulb = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), new T.MeshBasicMaterial({ color: new T.Color(4, 3.2, 2) }));
      bulb.position.set(0.8, 1.1, -0.62); room.add(bulb);
      const lamp = new T.PointLight("#ffc98a", 3.2, 6, 1.6);
      lamp.position.set(0.8, 1.05, -0.62); room.add(lamp);
      const fill = new T.PointLight("#ffe2c0", 1.6, 9, 1.4);
      fill.position.set(2.6, 2.6, 1.8); room.add(fill);
      box(0.32, 0.4, 0.32, -3.6, 0.2, -2.9, kit.mat("#9a5b3a"));
      const leaves = new T.Mesh(new T.IcosahedronGeometry(0.45, 0), kit.mat("#3d7a3a"));
      leaves.position.set(-3.6, 0.8, -2.9); room.add(leaves);
    };
    const boss = mk(manager, { skin: "#e0ac69", hair: "#2b1d14", grey: 0.35 }, [{ at: 0, clip: animG ? "boss-idle" : "idle", loop: true }]);
    const you = mk(player, { skin: "#c68642", hair: "#2b1b10", kit: { shirt: "#1f2433", trim: "#1f2433" }, accessories: [{ slot: "arms", color: "#1f2433" }, { slot: "neck", color: "#1f2433" }] }, [{ at: 0, clip: "idle", loop: true }]);
    if (!boss.p.actions["boss-idle"]) boss.segs = [{ at: 0, clip: "idle", loop: true }];
    let P: V3 = [0.05, 1.05, -0.55];
    update = (t) => {
      for (const a of actors) poseAt(T, a, t);
      place(boss, -0.1, -0.95, 0);
      place(you, -0.25, -0.2, Math.PI);
      { const a = wp(boss.p.bones.RightArm), b = wp(you.p.bones.RightArm); P = [(a.x + b.x) / 2, 1.06, (a.z + b.z) / 2]; }
      const w = seg(t, 2.0, 2.9);
      const pump = t > 3.0 && t < 4.8 ? Math.sin((t - 3.0) * Math.PI * 2 * 1.6) * 0.035 * (1 - seg(t, 4.3, 4.8)) : 0;
      const B1 = boss.p.bones, B2 = you.p.bones;
      if (w > 0) {
        solveArm(T, B1.RightArm, B1.RightForeArm, B1.RightHand, new T.Vector3(P[0] - 0.05, P[1] + pump, P[2] - 0.06), new T.Vector3(0.6, -1, -0.2), w);
        solveArm(T, B2.RightArm, B2.RightForeArm, B2.RightHand, new T.Vector3(P[0] + 0.05, P[1] + pump, P[2] + 0.06), new T.Vector3(-0.6, -1, 0.2), w);
      }
      // heads towards each other
      for (const [b, to] of [[B1.Head, [-0.25, 1.62, -0.2]], [B2.Head, [-0.1, 1.62, -0.95]]] as const) {
        if (!b) continue;
        const hp = wp(b);
        const want = new T.Vector3(...(to as V3)).sub(hp).normalize();
        const fwd = new T.Vector3(0, 0, 1).applyQuaternion(b.getWorldQuaternion(new T.Quaternion()));
        fwd.y = 0; want.y *= 0.4;
        if (fwd.lengthSq() > 1e-4) rotateBoneWorld(T, b, new T.Quaternion().setFromUnitVectors(fwd.normalize(), want.normalize()).slerp(new T.Quaternion(), 0.45));
      }
      if (t < 2.7) {
        shot("Wide · the office");
        const k = seg(t, 0, 2.7);
        setCam(lerp3([3.0, 1.75, 2.4], [2.5, 1.6, 1.8], k), [-0.2, 1.2, -0.7], 46);
      } else if (t < 5.3) {
        shot("Over his shoulder");
        const k = seg(t, 2.7, 5.3);
        setCam(lerp3([0.35, 1.75, 0.75], [0.3, 1.72, 0.6], k), [-0.1, 1.45, -0.95], 40);
      } else {
        shot("The handshake · close");
        const k = seg(t, 5.3, duration);
        setCam(lerp3([P[0] + 1.7, P[1] + 0.35, P[2] + 0.55], [P[0] + 1.45, P[1] + 0.3, P[2] + 0.45], k), [P[0] - 0.2, P[1] + 0.12, P[2] - 0.2], 40);
      }
      focus.x = 0; focus.z = 0;
    };
    env = { group: room, update() {} };
    (env as any).rebuild = buildRoom;
  }

  let stadium: Stadium | null = null;
  const restyle = () => {
    kit.apply(def);
    if (stadium) { root.remove(stadium.group); disposeObject3D(stadium.group); }
    stadium = buildStadium(T, kit, tier, kind === "signing" ? { skip: ["S"] } : {});
    if (kind === "signing") stadium.group.position.set(0, -16, -3.6 - 9.5 - 105 - 1);
    root.add(stadium.group);
    if ((env as any)?.rebuild) (env as any).rebuild();
    kit.stylePeople(actors.map((a) => a.p));
    const ch = def.chunky ?? 1;
    for (const a of actors) a.p.root.scale.set(ch, 1, ch);
    kit.setBurst(0); kit.setImpact(0);
  };
  restyle();

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  let t = 0, held: number | null = null;
  let last = performance.now();
  /** One picture at scene time `tt`; `dt` moves the crowd, sparks and so on. `draw` false skips only the (slow) render. */
  const tick = (dt: number, tt: number, draw: boolean) => {
    update(tt);
    stadium?.update(dt, tt);
    kit.update(dt, camera, focus);
    if (draw) kit.render(scene, camera);
  };
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (held === null) t = Math.min(duration + 1.5, t + dt);
    tick(dt, held ?? Math.min(t, duration), true);
  };
  renderer.setAnimationLoop(frame);
  (window as any).__styleCut = { seek: (s: number) => { held = s; }, play: () => { held = null; }, actors, camera };

  // FRAME STEPPING (lib/star/frameStep.ts): stop the real-time loop, then walk the clock to exactly `s` in
  // 1/60 s steps (so the crowd and sparks move the same every time), drawing only the last.
  let fsNow = 0;
  const frameSeek = (s: number) => {
    renderer.setAnimationLoop(null);
    held = s;
    if (s < fsNow) fsNow = 0;
    if (s - fsNow < 1e-6) { tick(0, s, true); return; }
    while (s - fsNow > 1e-6) {
      const dt = Math.min(1 / 60, s - fsNow);
      fsNow += dt;
      tick(dt, fsNow, s - fsNow <= 1e-6);
    }
  };

  return {
    duration,
    setStyle(d) { def = d; restyle(); },
    replay() { t = 0; held = null; },
    seek(s) { held = s; },
    frameSeek,
    dispose() {
      ro?.disconnect();
      renderer.setAnimationLoop(null);
      kit.dispose();
      release(root);
    },
  };
}
