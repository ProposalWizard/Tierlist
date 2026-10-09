/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * STYLE TESTING — GAMEPLAY. Real Free Roam on the shared 3D engine
 * (lib/star/play3d: its World, its people and clips, its picture), with:
 *   - a fixed camera: `tilt` degrees from straight down, following the ball,
 *     never turning (the stick's "up" is always towards the goal);
 *   - a full stadium round it (stadium.ts) in the chosen style (kit.ts);
 *   - four opponents in the picture who drift goal-side of the ball. They
 *     are scenery: the World does not know them, so they never tackle;
 *   - "2D": the same play with every man drawn as a flat card (flatFigure.ts),
 *     plain heads, no faces.
 */
import { drillById, type DrillSession } from "../play3d/drills";
import type { Person3 } from "../play3d/freeRoam";
import type { Play3DBuilt, Play3DController } from "../play3d/scene";
import { skillsOf } from "../play3d/player";
import { CX } from "../play3d/constants";
import { quality3dTier, type Quality3d } from "../three3d/quality";
import { disposeObject3D } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { addClips, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import { newNumberCanvas, drawShirtNumber } from "../signing3dTextures";
import { createStyleKit, glowTexture, glowSprite, type StyleKit } from "./kit";
import { buildStadium, type Stadium } from "./stadium";
import { FlatFigure, type FlatKit } from "./flatFigure";
import type { StyleDef } from "./styles";

export const HOME = { shirt: "#d62828", trim: "#ffffff" };
export const AWAY = { shirt: "#1d4ed8", trim: "#ffffff" };
export const KEEPER = { shirt: "#16a34a", trim: "#0b3d1d" };

export interface StyleGameplay {
  session: DrillSession;
  heading(): number;
  setStyle(def: StyleDef): void;
  setFlat(on: boolean): void;
  setTilt(deg: number): void;
  dispose(): void;
}

export function numberTexture(T: any, n: number) {
  const c = newNumberCanvas();
  drawShirtNumber(c, n);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** Players drawn this much bigger than life on the fixed camera (a top-down man is mostly head and shoulders). */
const FIG_SCALE = 2.0;
const SKINS = ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e", "#f1c27d"];

export async function createStyleGameplay(container: HTMLElement, o: { def: StyleDef; flat: boolean; tilt: number; seed?: number; tier?: Quality3d }): Promise<StyleGameplay> {
  const tier = o.tier ?? quality3dTier();
  const seed = o.seed ?? 7;
  const you: Person3 = { id: "you", name: "You", skills: skillsOf(78) };
  const mates: Person3[] = [{ id: "m1", name: "Saka", skills: skillsOf(80) }, { id: "m2", name: "Rice", skills: skillsOf(79) }];
  const drill = drillById("free-roam")!;
  const session = drill.start!({ seed, you, mates, squad: [] });
  const world = session.world;

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

  const people: Record<string, any> = {};
  world.players.forEach((p, i) => { people[p.id] = { skin: SKINS[i % SKINS.length], hair: "#1b120c", hairStyle: "short" }; });

  let def = o.def;
  let flat = o.flat;
  let tilt = o.tilt;
  let kit: StyleKit | null = null;
  let stadium: Stadium | null = null;
  let built: Play3DBuilt | null = null;
  const numbers: Record<string, number> = { you: 9, m1: 7, m2: 10, keeper: 1 };

  // scenery opponents
  type Extra = { p: Person3D; play: ClipPlayer; x: number; z: number; vx: number; vz: number; lane: number; depth: number; state: string; num: number; yaw: number };
  const extras: Extra[] = [];
  let flats: { fig: FlatFigure; get: () => { x: number; z: number; vx: number; vz: number; fz: number } }[] = [];
  let ring: any = null;
  const glowMap = glowTexture(THREE);
  const sparks = glowSprite(THREE, glowMap);
  const aura = glowSprite(THREE, glowMap);
  const shadowMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.3, depthWrite: false });

  const focus = { x: 0, z: 18 };
  let aspect = 0.55;
  /**
   * The fixed camera: `tilt` from straight down, never turning. Framed like
   * the 2D match: about 30 m of pitch across the screen; while the ball is in
   * the attacking third the goal, the keeper and a strip of advert boards and
   * stand sit at the top; further out it follows the ball.
   */
  const VIEW_W = 22, VFOV = 36;
  const rig = () => {
    const b = world.ball;
    const th = (Math.max(3, Math.min(75, tilt)) * Math.PI) / 180;
    const hv = (VFOV * Math.PI) / 360;
    const hh = Math.atan(Math.tan(hv) * aspect);
    const D = Math.min(130, Math.max(20, VIEW_W / 2 / Math.tan(hh)));
    // the look point that puts the top of the screen at Z = -12 (boards and the first rows behind the goal)
    const k = Math.sin(th) - Math.cos(th) * Math.tan(th + hv);
    const goalTop = -12 - D * k;
    // the bottom of the screen, as a distance below the look point
    const below = D * (Math.cos(th) * Math.tan(th) - Math.cos(th) * Math.tan(Math.max(0, th - hv))) ;
    const fz = Math.max(goalTop, b.y - below * 0.45);
    const fx = Math.max(-34 + VIEW_W / 2 - 2, Math.min(34 - VIEW_W / 2 + 2, (b.x - CX) * 0.85));
    focus.x += (fx - focus.x) * 0.06; focus.z += (fz - focus.z) * 0.06;
    const look: [number, number, number] = [focus.x, 0, focus.z];
    return { pos: [look[0], D * Math.cos(th), look[2] + D * Math.sin(th)] as [number, number, number], look, heading: -Math.PI / 2, fov: VFOV };
  };
  /** The men lean back towards the fixed camera (the top-down trick): at 40° that is 30°, so a man reads near full height, not as a head and shoulders. */
  const leanQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const lean = (root: any) => {
    const a = ((90 - Math.max(3, Math.min(75, tilt))) * 0.6 * Math.PI) / 180;
    yawQ.setFromAxisAngle(Y, root.rotation.y);
    leanQ.setFromAxisAngle(X, -a);
    root.quaternion.copy(leanQ.multiply(yawQ));
  };

  const flatKitFor = (team: number, keeper: boolean, num: number, i: number): FlatKit => {
    const k = keeper ? KEEPER : team === 0 ? HOME : AWAY;
    return { shirt: k.shirt, shorts: keeper ? k.trim : k.trim, socks: k.shirt, skin: SKINS[i % SKINS.length], hair: "#1b120c", number: num, gloves: keeper ? "#f5f5f5" : undefined };
  };

  const rebuildFlats = () => {
    if (!built) return;
    for (const f of flats) { built.root.remove(f.fig.sprite, f.fig.shadow); f.fig.dispose(); }
    flats = [];
    if (!flat) return;
    const pixel = def.post.pixel > 0;
    const outline = def.personOutline ? def.outlineColor : "#1b1b22";
    world.players.forEach((p, i) => {
      const fig = new FlatFigure(THREE, flatKitFor(p.team, p.keeper, numbers[p.id] ?? 8, i), pixel, outline, shadowMat);
      fig.sprite.scale.multiplyScalar(FIG_SCALE);
      built!.root.add(fig.sprite, fig.shadow);
      flats.push({ fig, get: () => ({ x: p.x - CX, z: p.y, vx: p.vx, vz: p.vy, fz: Math.sin(p.facing) }) });
    });
    extras.forEach((e, i) => {
      const fig = new FlatFigure(THREE, flatKitFor(1, false, e.num, i + 2), pixel, outline, shadowMat);
      fig.sprite.scale.multiplyScalar(FIG_SCALE);
      built!.root.add(fig.sprite, fig.shadow);
      flats.push({ fig, get: () => ({ x: e.x, z: e.z, vx: e.vx, vz: e.vz, fz: 1 }) });
    });
  };

  const applyBodies = () => {
    if (!built || !kit) return;
    const all = [...built.bodies.map((b) => b.p), ...extras.map((e) => e.p)];
    kit.stylePeople(all);
    const ch = def.chunky ?? 1;
    for (const p of all) {
      p.body.visible = !flat; if (flat) p.outline.visible = false;
      p.root.scale.set(FIG_SCALE * ch, FIG_SCALE, FIG_SCALE * ch);
    }
    built.ball.scale.setScalar(def.ballScale);
    sparks.material.color.set(def.ballSparks ?? "#ffffff");
    aura.material.color.set(def.aura ?? "#ffffff");
    rebuildFlats();
  };

  const restyle = () => {
    if (!built || !kit) return;
    kit.apply(def);
    if (stadium) { built.root.remove(stadium.group); disposeObject3D(stadium.group); }
    stadium = buildStadium(THREE, kit, tier);
    built.root.add(stadium.group);
    applyBodies();
  };

  const { createPlay3DScene } = await import("../play3d/scene");
  const ctrl: Play3DController = await createPlay3DScene(container, world, { kit: HOME, keeperKit: KEEPER, people }, {
    camera: "chase", quality: tier, bare: true,
    rig: () => rig(),
    draw: (_r, scene, camera) => {
      if (!flat && built) {
        for (const b of built.bodies) lean(b.p.root);
        for (const e of extras) { e.p.root.rotation.set(0, e.yaw, 0); lean(e.p.root); }
      }
      kit?.render(scene, camera);
    },
    onBuilt: (ctx) => {
      built = ctx;
      kit = createStyleKit(THREE, ctx.renderer, ctx.scene, tier, def);
      ctx.camera.far = 300; ctx.camera.updateProjectionMatrix();
      // numbers on the 3D backs; everyone a size up, so a man reads from above (the 2D game draws them big too)
      for (const b of ctx.bodies) {
        b.p.root.scale.setScalar(FIG_SCALE);
        const n = numbers[b.who.id];
        if (n) { (b.p.u as any).uNum.value = numberTexture(THREE, n); (b.p.u as any).uNumOn.value = 1; }
      }
      // four opponents (scenery)
      const lanes = [[-9, 9], [-3, 4], [4, 6], [10, 11]];
      lanes.forEach(([lane, depth], i) => {
        const p = makePerson3d(THREE, SK, model, animG, { outline: 0.006, castShadow: tier !== "low" });
        dressPerson3d(THREE, p, { skin: SKINS[(i + 2) % SKINS.length], hair: "#1b120c", kit: AWAY, number: numberTexture(THREE, [4, 5, 6, 3][i]) });
        relaxHands(THREE, p);
        if (fb) addClips(THREE, p, fb);
        const play = new ClipPlayer(THREE, p.actions);
        play.play("idle", { fade: 0 });
        p.root.scale.setScalar(FIG_SCALE);
        ctx.root.add(p.root);
        extras.push({ p, play, x: lane, z: depth + 6, vx: 0, vz: 0, lane, depth, state: "idle", num: [4, 5, 6, 3][i], yaw: 0 });
      });
      ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32), new THREE.MeshBasicMaterial({ color: "#facc15", transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ctx.root.add(ring, sparks, aura);
      restyle();
      const box = container.getBoundingClientRect();
      aspect = box.width / Math.max(1, box.height);
    },
    onFrame: (dt) => {
      if (!built || !kit) return;
      const box = container.clientWidth / Math.max(1, container.clientHeight);
      if (box > 0) aspect = box;
      const b = world.ball;
      // scenery opponents: goal-side of the ball, a step behind
      for (const e of extras) {
        const tx = (b.x - CX) * 0.75 + e.lane, tz = Math.max(3, b.y * 0.6 + e.depth * 0.4 - 2);
        const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
        const want = d > 0.6 ? Math.min(6.2, d * 1.4) : 0;
        const ax = d > 0.01 ? (dx / d) * want : 0, az = d > 0.01 ? (dz / d) * want : 0;
        e.vx += (ax - e.vx) * Math.min(1, dt * 3); e.vz += (az - e.vz) * Math.min(1, dt * 3);
        e.x += e.vx * dt; e.z += e.vz * dt;
        const sp = Math.hypot(e.vx, e.vz);
        const st = sp < 0.5 ? "ready_shuffle" : sp > 5 ? "sprint" : "jog";
        const clip = e.play.has(st) ? st : st === "ready_shuffle" ? "idle" : "jog";
        if (clip !== e.state) { e.play.play(clip, { fade: 0.25 }); e.state = clip; }
        const a = e.p.actions[clip];
        if (a && clip !== "idle" && clip !== "ready_shuffle") a.timeScale = Math.max(0.6, Math.min(1.5, sp / (clip === "sprint" ? 7.4 : 3.2)));
        e.play.update(dt); e.p.mixer.update(dt);
        e.p.root.position.set(e.x, 0, e.z);
        // face the ball
        e.yaw = Math.atan2((b.x - CX) - e.x, b.y - e.z);
        e.p.root.rotation.set(0, e.yaw, 0);
      }
      // sparks round a ball struck hard; an aura round you as you shoot
      const bsp = Math.hypot(b.vx, b.vy, b.vz);
      const glow = def.ballSparks ? Math.max(0, Math.min(1, (bsp - 9) / 12)) : 0;
      sparks.visible = glow > 0.02;
      if (sparks.visible) {
        sparks.position.copy(built.ball.position);
        const k = 1.4 + glow * 1.6 + Math.random() * 0.4;
        sparks.scale.set(k, k, 1);
        sparks.material.opacity = glow;
      }
      const yu = world.you();
      const shooting = !!def.aura && !!yu && (yu.act === "shot" || yu.act === "volley" || yu.act === "header") && yu.actT < 0.9;
      aura.visible = shooting;
      if (shooting && yu) { aura.position.set(yu.x - CX, 0.9, yu.y - 0.7); const k = 2.6 + Math.sin(yu.actT * 20) * 0.25; aura.scale.set(k * 0.8, k * 1.2, 1); aura.material.opacity = 0.75 * (1 - yu.actT / 0.9); }
      if (ring && yu) { ring.position.set(yu.x - CX, 0.03, yu.y); ring.visible = true; }
      for (const f of flats) { const s = f.get(); f.fig.set(s.x, s.z, s.vx, s.vz, s.fz, dt); }
      stadium?.update(dt, 0);
      kit.update(dt, built.camera, { x: focus.x, y: 0, z: focus.z });
    },
  });

  return {
    session,
    heading: () => ctrl.heading(),
    setStyle(d) { def = d; restyle(); },
    setFlat(on) { flat = on; applyBodies(); },
    setTilt(deg) { tilt = deg; },
    dispose() {
      for (const f of flats) f.fig.dispose();
      kit?.dispose();
      ctrl.dispose();
    },
  };
}
