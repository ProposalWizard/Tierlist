/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H, PUT TOGETHER — one call dresses a three.js scene in Console
 * Realism: the real sky to look at and to be lit by (image-based light), the
 * sun or the floodlights with soft shadows, the PBR pitch, the stadium, a
 * proper ball, contact shadows under every player, fabric on the kits, and
 * the broadcast pass. Used by the Style Testing page and by the 3D drills
 * (Settings → Look → "3D look: H | Old").
 *
 * The leaned men (the fixed camera's trick) would throw long, wrong shadows,
 * so their shadows are drawn from them standing up: `render` takes a
 * `beforeShadows` / `afterShadows` pair to un-lean and re-lean them.
 *
 * Baked light and the broadcast grade (9 Oct 2026, lib/star/look): the
 * stadium's light is baked in Blender per time of day (open-sky shade, the
 * stands' and roofs' sun shadow over the whole bowl, light bounced off the
 * stands), read by every lit surface and by the players; the last step of
 * the picture is a colour grade matched to the benchmark broadcast frames.
 * The dials (lib/star/look/params.ts) were set by the look-tuner.
 */
import { TIER_PROFILES, type Quality3d } from "../../three3d/quality";
import type { Person3D } from "../../people3d";
import { envFor, grassMaps, hTexture, preloadHdr, SKY_SCALE, type TimeOfDay } from "./assets";
import { TODS, type TodLook } from "./tod";
import { buildRealPitch, type RealPitch } from "./pitch";
import { buildArena, type Arena, type ArenaColours } from "./arena";
import { makeHPost, type HPost } from "./post";
import { currentGovernor, type GovRung } from "../../three3d/governor";
import { dressHBall, type HBall } from "./ball";
import { createBakedLight, type BakedLight } from "../../look/bakedLight";
import { lookLut, lookParams, lookTuneHook, lookVersion, tuneGrass, type LookParams } from "../../look/params";
import { shadowCacheOff } from "../../three3d/shadowCache";
import { lightReachOff } from "../../three3d/lightReach";

/** Each of the three extra floodlight banks, as a share of the night "sun" (the fourth bank). */
const FLOOD_BANK = 1.0;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */ `
uniform sampler2D tSky;
uniform float scale, gain, rot, sunDisc;
uniform vec3 sunDir, sunCol, below;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float u = atan(d.x, -d.z) / 6.2831853 + 0.5 + rot;
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = (1.5707963 - el) / 3.1415926 / 0.625;
  vec3 c = v < 1.0 ? texture2D(tSky, vec2(u, 1.0 - v)).rgb * scale * gain : below;
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(sd, 400.0) * 40.0 + pow(sd, 24.0) * 0.6) * sunDisc;
  gl_FragColor = vec4(c, 1.0);
}`;

export interface RealLookOptions {
  tod: TimeOfDay;
  /** Full stadium (default) or none (a training patch: grass to the horizon, no lines). */
  arena?: boolean;
  lines?: boolean;
  colours?: ArenaColours;
  /** play3d's ball group, to dress. */
  ball?: any;
  /**
   * Sharp (the 3D drills): MSAA in the broadcast pass on Medium too (2×; High
   * keeps 4×), and the pitch, crowd and boards filtered at up to 8× anisotropy
   * so they hold up at a low angle instead of going to mush.
   */
  sharp?: boolean;
}

export interface RealLook {
  readonly tod: TimeOfDay;
  setTod(tod: TimeOfDay): void;
  setColours(c: ArenaColours): void;
  /** Kit fabric, contact shadows, roughness on these people. */
  dressPeople(people: Person3D[]): void;
  cheer(v: number): void;
  update(dt: number, camera: any, focus: { x: number; z: number }, ball?: { x: number; y: number; z: number; vx: number; vy: number; vz: number }): void;
  render(scene: any, camera: any, hooks?: { beforeShadows?: () => void; afterShadows?: () => void }): void;
  dispose(): void;
}

/** Fabric and per-part sheen on a people3d body: rest-space knit bumps on the kit, shinier boots and skin. */
function fabric(m: any, on: boolean): void {
  // the human body has a list of materials
  if (Array.isArray(m)) { for (const x of m) fabric(x, on); return; }
  if (!m?.userData) return;
  if (!m.userData.fabricWrapped) {
    const inner = m.onBeforeCompile;
    const innerKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh: any, r: any) => {
      inner?.(sh, r);
      if (!m.userData.fabric) return;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
// real cloth and skin reflect well under half the light (white kit ~0.7): keeps colours rich under a strong sun
if (uKit > 0.5) diffuseColor.rgb *= mix(0.74, 1.0, step(uFaceF.x - 0.04, vRest.y));`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
{
  float hY = vRest.y;
  float isShirt = step(uLines.x, hY), isBoot = 1.0 - step(uLines.z, hY);
  float isShorts = step(uLines.y, hY) * (1.0 - isShirt);
  roughnessFactor = mix(roughnessFactor, 0.62, isShirt * uKit);
  roughnessFactor = mix(roughnessFactor, 0.48, isShorts * uKit);
  roughnessFactor = mix(roughnessFactor, 0.26, isBoot * uKit);
}`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{
  float hY = vRest.y;
  float knit = uKit * step(uLines.y, hY) * (1.0 - p3Face);
  vec3 rp = vRest * 900.0;
  float k1 = sin(rp.x + sin(rp.y * 0.5) * 2.0) * sin(rp.y * 1.3);
  vec3 bump = vec3(dFdx(k1), dFdy(k1), 0.0);
  normal = normalize(normal - vec3(bump.xy, 0.0) * 0.06 * knit);
}`);
    };
    m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-fab${m.userData.fabric ? 1 : 0}`;
    m.userData.fabricWrapped = true;
  }
  if (!!m.userData.fabric !== on) { m.userData.fabric = on; m.needsUpdate = true; }
}

/**
 * Start-up (9 Oct 2026, Harry: "the long load is when the game first starts"):
 * fetch and decode the look's pictures — grass, crowd, boards, sky, light,
 * grade — while the people's files load, instead of after them. Everything
 * it starts is cached, so createRealLook picks the same promises up.
 */
export function preloadRealLook(T: any, tod: TimeOfDay, o: { arena?: boolean } = {}) {
  const ok = (p: Promise<unknown>) => { p.catch(() => {}); };
  ok(grassMaps(T));
  if (o.arena !== false) { ok(hTexture(T, "crowd.webp")); ok(hTexture(T, "led.webp")); ok(import("three/examples/jsm/utils/BufferGeometryUtils.js")); }
  ok(hTexture(T, `sky-${tod}.webp`, { repeat: false }));
  ok(preloadHdr(T, tod));
  ok(lookLut(T, tod));
}

export async function createRealLook(T: any, renderer: any, scene: any, tier: Quality3d, o: RealLookOptions): Promise<RealLook> {
  const prof = TIER_PROFILES[tier];
  const root = new T.Group();
  root.name = "h-look";
  scene.add(root);
  const withArena = o.arena !== false;
  const [maps, crowdTex, ledTex, bgu] = await Promise.all([
    grassMaps(T),
    withArena ? hTexture(T, "crowd.webp") : Promise.resolve(null),
    withArena ? hTexture(T, "led.webp") : Promise.resolve(null),
    withArena ? import("three/examples/jsm/utils/BufferGeometryUtils.js").catch(() => null) : Promise.resolve(null),
  ]);
  let tod: TimeOfDay = o.tod;
  let look: TodLook = TODS[tod];
  let p: LookParams = lookParams(tod);
  let seenVersion = lookVersion();
  let lut: any = null;
  let baked: BakedLight | null = null;
  let dead = false;
  let rungSeen: GovRung | null = null;

  // ── sky ──
  const su: Record<string, { value: any }> = {
    tSky: { value: null }, scale: { value: 1 }, gain: { value: 1 }, rot: { value: 0.12 }, sunDisc: { value: 0 },
    sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: new T.Color() }, below: { value: new T.Color("#1a1f1a") },
  };
  const sky = new T.Mesh(new T.SphereGeometry(400, 48, 24), new T.ShaderMaterial({ uniforms: su, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: T.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  root.add(sky);

  // ── lights ──
  const hemi = new T.HemisphereLight("#ffffff", "#444444", 0.3);
  const sun = new T.DirectionalLight("#ffffff", 3);
  root.add(hemi, sun, sun.target);
  if (prof.shadows) {
    sun.castShadow = true;
    const s = prof.shadowScale >= 1 ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 320 });
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
  }
  // night: three more lamp banks round the bowl, one per roof corner (the "sun" is the fourth). Each casts its
  // own soft shadow, so a player at night stands on the four-way shadow star of a floodlit pitch, not on flat
  // grass (Harry, 9 Oct 2026: night to golden hour's quality). Their maps are half the sun's.
  const floods = [new T.DirectionalLight("#dfe8ff", 0), new T.DirectionalLight("#dfe8ff", 0), new T.DirectionalLight("#dfe8ff", 0)];
  for (const f of floods) {
    root.add(f, f.target);
    if (prof.shadows) {
      const s = prof.shadowScale >= 1 ? 1024 : 512;
      f.shadow.mapSize.set(s, s);
      Object.assign(f.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 320 });
      f.shadow.bias = -0.0003;
      f.shadow.normalBias = 0.03;
      f.shadow.radius = 4;
    }
  }
  // a rim light from beyond the action, towards the camera: lifts players off the grass (a TV picture's edge light)
  const rim = new T.DirectionalLight("#fff6ea", 0.7);
  root.add(rim, rim.target);

  // ── pitch, stadium, ball ──
  const pitch: RealPitch = buildRealPitch(T, maps, { lines: o.lines !== false, stripes: o.lines !== false, w: withArena ? 104 : 600, l: withArena ? 141 : 600 });
  root.add(pitch.mesh);
  const arena: Arena | null = withArena ? buildArena(T, tier, { crowd: crowdTex, led: ledTex }, { colours: o.colours, merge: (bgu as any)?.mergeGeometries }) : null;
  if (arena) root.add(arena.group);
  // the crowd keeps a neutral, lifted shade under the baked light (lib/star/look/bakedLight.ts)
  arena?.group.traverse((x: any) => { if (x.name === "h-crowd" && x.material) x.material.userData.bakeNeutral = true; });
  // a far ring of trees and roofs for the training patch (no stadium)
  if (!withArena) {
    const hedge = new T.Mesh(new T.CylinderGeometry(150, 150, 9, 64, 1, true), new T.MeshStandardMaterial({ color: "#2b4a24", roughness: 1, side: T.BackSide }));
    hedge.position.set(0, 4.5, 30); root.add(hedge);
  }
  const hball: HBall | null = o.ball ? dressHBall(T, o.ball, root) : null;

  // contact shadows: a soft dark patch under each person's feet
  const csTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.75)"); gr.addColorStop(0.45, "rgba(0,0,0,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const csMat = new T.MeshBasicMaterial({ map: csTex, transparent: true, depthWrite: false, opacity: 0.6 });
  const csGeo = new T.PlaneGeometry(1, 1);
  csGeo.rotateX(-Math.PI / 2);
  // one draw for every contact shadow (9 Oct 2026: was one draw a man, 22 in a match)
  const CS_MAX = 40;
  const csInst = new T.InstancedMesh(csGeo, csMat, CS_MAX);
  csInst.renderOrder = 1; csInst.count = 0; csInst.frustumCulled = false;
  root.add(csInst);
  const csM = new T.Matrix4(), csQ = new T.Quaternion(), csP = new T.Vector3(), csS = new T.Vector3();
  const contacts: { p: Person3D }[] = [];

  const post: HPost = makeHPost(T, renderer, tier, o.sharp && tier !== "low" ? { msaa: tier === "high" ? 4 : 2 } : {});
  if (o.sharp) {
    const an = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() ?? 4);
    for (const t of [maps.col, maps.nrm, maps.orh, crowdTex, ledTex]) if (t && t.anisotropy < an) { t.anisotropy = an; t.needsUpdate = true; }
  }
  // the shadow-only pass: a 1-pixel target and a camera that sees nothing
  const shadowOnly = new T.WebGLRenderTarget(1, 1);
  const BLIND_LAYER = 31;
  const blindCam = new T.PerspectiveCamera(1, 1, 0.001, 0.002);
  blindCam.position.set(0, -500, 0); blindCam.lookAt(0, -1000, 0);
  const prevEnv = scene.environment, prevFog = scene.fog, prevBg = scene.background;
  let envToken = 0;
  /** The dials onto the lights, the grass and the bake (cheap: also run when the tuner turns one). */
  const applyDials = () => {
    p = lookParams(tod);
    sun.intensity = look.sunIntensity * p.sun;
    for (const f of floods) f.intensity = look.floods ? sun.intensity * FLOOD_BANK : 0;
    // a bank at nothing (by day) leaves the lighting altogether: same picture, three fewer lights for every pixel
    for (const f of floods) f.visible = f.intensity > 0 || lightReachOff();
    hemi.intensity = look.hemi.intensity * p.hemi;
    scene.environmentIntensity = look.env * p.env;
    pitch.setLook({ grass: [tuneGrass(look.grass[0], p), tuneGrass(look.grass[1], p)], wet: look.wet, blades: p.blades, stripes: p.stripes });
    baked?.setStrength({ ao: p.ao, shade: p.shade, bounce: p.bounce });
    baked?.setLight(sun.color, sun.intensity);
  };
  const applyTod = async () => {
    look = TODS[tod];
    const tk = ++envToken;
    sun.color.set(look.sunColor); sun.intensity = look.sunIntensity;
    hemi.color.set(look.hemi.sky); hemi.groundColor.set(look.hemi.ground); hemi.intensity = look.hemi.intensity;
    scene.fog = new T.Fog(look.fog.color, look.fog.near, look.fog.far);
    scene.background = null;
    su.sunDir.value.set(...look.sunDir).normalize(); su.sunCol.value.set(look.sunColor); su.sunDisc.value = look.sunDisc;
    su.gain.value = look.sky; su.scale.value = SKY_SCALE[tod];
    su.below.value.set(look.fog.color).multiplyScalar(0.4);
    for (const f of floods) { f.castShadow = prof.shadows && look.floods && rungSeen?.shadows === "full"; }
    pitch.setLook({ grass: look.grass, wet: look.wet });
    arena?.setNight(look.floods);
    hball?.setNight(look.floods);
    renderer.toneMappingExposure = look.exposure;
    void baked?.setTod(tod);
    const [env, skyTex, lt] = await Promise.all([envFor(T, renderer, tod), hTexture(T, `sky-${tod}.webp`, { repeat: false }), lookLut(T, tod)]);
    if (tk !== envToken) return;
    skyTex.wrapS = T.RepeatWrapping; skyTex.needsUpdate = true;
    su.tSky.value = skyTex;
    scene.environment = env;
    lut = lt;
    applyDials();
  };
  await applyTod();
  // the stadium's baked light (the training patch has no stadium to bake)
  if (withArena) {
    void createBakedLight(T, "stadium", tod).then((b) => {
      if (!b) return;
      if (dead) { b.dispose(); return; }
      baked = b;
      void b.setTod(tod);
      b.apply(scene);
      applyDials();
    }).catch(() => { /* no bake: the live light alone, as before */ });
  }
  let frameN = 0;
  let last: { scene: any; camera: any } | null = null;
  /**
   * Below High the sun's shadow map is redrawn every other frame (9 Oct 2026,
   * lag): it is the people drawn a second time (their skinned bodies are most
   * of the triangles). A shadow one frame behind at 60 a second can't be seen.
   */
  const shadowEvery = tier === "high" ? 1 : 2;
  let shadowFrame = 0;
  /**
   * The governor's rung (three3d/governor.ts), read each frame:
   *   full  as built (High and Medium exactly as before)
   *   lite  emergency only (a phone still under ~45 fps): the sun only (no
   *         flood maps); people and the stands stop casting (the contact
   *         shadows stay); one combined post pass
   *   off   no live shadow map, no post pass
   */
  let shadowsOn = prof.shadows;
  let peopleCast = prof.shadows;
  const applyRung = (r: GovRung) => {
    rungSeen = r;
    post.setMode(r.post);
    const mode = prof.shadows ? r.shadows : "off";
    shadowsOn = mode !== "off";
    peopleCast = mode === "full";
    sun.castShadow = shadowsOn;
    for (const f of floods) f.castShadow = mode === "full" && look.floods;
    renderer.shadowMap.enabled = shadowsOn;
    arena?.group.traverse((x: any) => { if (x.isMesh) { if (x.userData.castOrig === undefined) x.userData.castOrig = !!x.castShadow; x.castShadow = mode === "full" && x.userData.castOrig; } });
    for (const c of contacts) c.p.root.traverse((x: any) => { if (x.isSkinnedMesh) { if (x.userData.castOrig === undefined) x.userData.castOrig = !!x.castShadow; x.castShadow = peopleCast && x.userData.castOrig; } });
  };
  const fallbackRung: GovRung = { tier, pixelRatio: 2, shadows: tier === "low" ? "off" : "full", post: tier === "low" ? "off" : "full" };
  applyRung(fallbackRung);

  const dir = new T.Vector3();
  const api: RealLook = {
    get tod() { return tod; },
    setTod(t) { if (t !== tod) { tod = t; void applyTod(); } },
    setColours(c) { arena?.setColours(c); },
    dressPeople(people) {
      for (const p of people) {
        fabric(p.body.material as any, true);
        if (!contacts.some((c) => c.p === p)) contacts.push({ p });
        // people cast on the full rung; on the emergency rungs the contact shadow stands in
        p.root.traverse((x: any) => { if (x.isSkinnedMesh) { if (x.userData.castOrig === undefined) x.userData.castOrig = !!x.castShadow; x.castShadow = peopleCast && x.userData.castOrig; } });
      }
    },
    cheer(v) { arena?.cheer(v); },
    update(dt, camera, focus, ball) {
      sky.position.copy(camera.position);
      // things added after the build (people, props) pick up the baked light too
      if (baked && (frameN++ % 45) === 0) baked.apply(scene);
      if (lookVersion() !== seenVersion) { seenVersion = lookVersion(); applyDials(); }
      dir.set(...look.sunDir).normalize();
      // the shadow box follows the action in 4 m steps (no swimming shadows)
      const fx = Math.round(focus.x / 4) * 4, fz = Math.round(focus.z / 4) * 4;
      sun.target.position.set(fx, 0, fz);
      sun.position.set(fx + dir.x * 150, dir.y * 150, fz + dir.z * 150);
      // the other three roof corners: the main bank's direction mirrored across the pitch's two axes
      floods.forEach((f, i) => {
        const mx = i === 1 ? 1 : -1, mz = i === 0 ? 1 : -1;
        f.position.set(fx + dir.x * mx * 150, dir.y * 150, fz + dir.z * mz * 150);
        f.target.position.set(fx, 0, fz);
      });
      const cx = camera.position.x - fx, cz = camera.position.z - fz, cl = Math.hypot(cx, cz) || 1;
      rim.position.set(fx - (cx / cl) * 60, 14, fz - (cz / cl) * 60); rim.target.position.set(fx, 1, fz);
      rim.intensity = (look.floods ? 1.1 : 0.7) * p.rim;
      let ci = 0;
      for (const c of contacts) {
        const r = c.p.root;
        if (!(r.visible && c.p.body.visible !== false) || ci >= CS_MAX) continue;
        const s = r.scale.x || 1;
        csP.set(r.position.x, 0.015, r.position.z + 0.04 * s); csS.set(0.75 * s, 1, 0.75 * s);
        csInst.setMatrixAt(ci++, csM.compose(csP, csQ, csS));
      }
      csInst.count = ci;
      csInst.instanceMatrix.needsUpdate = true;
      arena?.update(dt, ball);
      if (hball && ball) hball.update(dt, { x: ball.vx, y: ball.vz, z: ball.vy });
    },
    render(sc, camera, hooks) {
      const gr = currentGovernor()?.rung ?? fallbackRung;
      if (gr !== rungSeen) applyRung(gr);
      const freshShadow = shadowFrame++ % shadowEvery === 0;
      if (hooks?.beforeShadows && shadowsOn && !freshShadow) {
        // keep last frame's shadow map; the picture still gets its lean
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = false;
        hooks.afterShadows?.();
      } else if (hooks?.beforeShadows && shadowsOn) {
        // shadows from the men standing up, then the picture with them leaned
        hooks.beforeShadows();
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
        // a draw that sees nothing, just to refresh the shadow map
        // With the shadow cache on this renderer (three3d/shadowCache.ts) the blind camera sees
        // a layer nothing is on, so the men (never frustum-culled) are not drawn a third time
        // into the 1-pixel target; the cache reads the casters on the real camera's layers.
        const blind = !!(renderer as any).__shadowCache && !shadowCacheOff();
        blindCam.layers.set(blind ? BLIND_LAYER : 0);
        blindCam.userData.shadowLayers = blind ? camera.layers.mask : undefined;
        for (const l of [sun, ...floods]) { if (blind) l.layers.enable(BLIND_LAYER); else l.layers.disable(BLIND_LAYER); }
        renderer.setRenderTarget(shadowOnly);
        renderer.render(sc, blindCam);
        renderer.setRenderTarget(null);
        hooks.afterShadows?.();
      } else {
        renderer.shadowMap.autoUpdate = freshShadow;
        renderer.shadowMap.needsUpdate = false;
      }
      if (lookVersion() !== seenVersion) { seenVersion = lookVersion(); applyDials(); }
      post.render(sc, camera, {
        exposure: look.exposure * p.exposure, bloom: look.bloom * p.bloom, bloomThresh: look.bloomThresh,
        contrast: look.contrast * p.contrast, sat: look.sat * p.sat, tint: look.tint, lift: look.lift,
        vignette: look.vignette * p.vignette, lut, lutAmt: p.lut, sharpen: p.sharpen,
      });
      renderer.shadowMap.autoUpdate = true;
      // dev builds: the look-tuner re-draws this same frame after turning a dial
      if (!last) {
        const hook = lookTuneHook();
        if (hook) hook.redraw = () => { if (last && !dead) api.render(last.scene, last.camera); };
      }
      last = { scene: sc, camera };
    },
    dispose() {
      dead = true;
      baked?.dispose(); baked = null;
      post.dispose();
      hball?.dispose();
      arena?.dispose();
      pitch.dispose();
      shadowOnly.dispose();
      root.remove(csInst);
      for (const c of contacts) fabric(c.p.body.material as any, false);
      csGeo.dispose(); csMat.dispose(); csTex.dispose();
      sky.geometry.dispose(); sky.material.dispose();
      scene.remove(root);
      scene.environment = prevEnv; scene.fog = prevFog; scene.background = prevBg;
    },
  };
  return api;
}
