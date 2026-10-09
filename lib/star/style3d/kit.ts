/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE STYLE KIT — puts one of styles.ts's looks on a three.js scene, live:
 * the painted sky dome, the sun and fill lights (shadows per the phone's 3D
 * quality), haze, rain, the material family for anything built with `mat()`,
 * the people's outline, and the post pass (post.ts). `apply()` again switches
 * style without reloading anything.
 */
import type { Quality3d } from "../three3d/quality";
import { TIER_PROFILES } from "../three3d/quality";
import type { Person3D } from "../people3d";
import type { StyleDef } from "./styles";
import { makeStylePost } from "./post";

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const SKY_FRAG = /* glsl */ `
uniform vec3 top, mid, horizon, ground, sunCol, cloudCol, sunDir;
uniform float sunSize, sunGlow, clouds, stars, flash;
varying vec3 vDir;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h < 0.0 ? mix(horizon, ground, smoothstep(0.0, 0.25, -h))
    : (h < 0.25 ? mix(horizon, mid, smoothstep(0.0, 0.25, h)) : mix(mid, top, smoothstep(0.25, 0.85, h)));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 48.0) * 0.6) * sunGlow;
  if (sunSize > 0.0) c = mix(c, sunCol * 6.0, smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, sd));
  if (clouds > 0.0 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.18) * 1.4;
    float n = fbm(uv * vec2(0.6, 1.6) + 3.0);
    float k = smoothstep(0.55, 0.78, n) * clouds * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.55, 0.9, h));
    vec3 cc = mix(cloudCol, sunCol, pow(sd, 3.0) * 0.6);
    c = mix(c, cc, k);
  }
  if (stars > 0.0 && h > 0.1) { vec2 g = floor(d.xz / (h + 0.3) * 160.0); float s = step(0.996, h21(g)); c += vec3(s) * stars; }
  c += vec3(0.55, 0.5, 1.0) * flash * (0.4 + 0.6 * smoothstep(0.0, 0.6, h));
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Cel bands on a people3d body (Anime): its own shader, then the lit colour
 * snapped to three bands by brightness, keeping the hue. Wraps the body's
 * own onBeforeCompile once; `on` flips it with a define.
 */
function celShade(m: any, on: boolean) {
  if (!m.userData.celWrapped) {
    const inner = m.onBeforeCompile;
    const innerKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh: any, r: any) => {
      inner?.(sh, r);
      if (!m.userData.cel) return;
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float celL = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
float celQ = celL < 0.06 ? 0.035 : celL < 0.32 ? 0.16 : 0.62 + 0.25 * smoothstep(0.9, 1.6, celL);
outgoingLight *= mix(1.0, celQ / max(celL, 0.001), 0.85);
#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-cel${m.userData.cel ? 1 : 0}`;
    m.userData.celWrapped = true;
  }
  if (!!m.userData.cel !== on) { m.userData.cel = on; m.needsUpdate = true; }
}

/** A soft round glow (sparks round the ball, an aura). */
export function glowTexture(T: any, inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,0.45)") {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(0.3, mid); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** A glow card that never writes depth (additive). */
export function glowSprite(T: any, map: any) {
  const s = new T.Sprite(new T.SpriteMaterial({ map, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.renderOrder = 5;
  return s;
}

export interface StyleKit {
  readonly def: StyleDef;
  readonly tier: Quality3d;
  apply(def: StyleDef): void;
  /** A material in the style's family (toon bands, lambert, PBR). */
  mat(color: string, o?: { map?: any; emissive?: string; emissiveIntensity?: number; side?: any; rough?: number; metal?: number; transparent?: boolean; opacity?: number; alphaTest?: number }): any;
  /** Keep the sun's shadows and the rain round this point; the sky round the camera. */
  update(dt: number, camera: any, focus: { x: number; y: number; z: number }): void;
  render(scene: any, camera: any): void;
  stylePeople(people: Person3D[]): void;
  /** The goal's energy burst / speed lines, 0..1 (styles with `burst`). */
  setBurst(v: number): void;
  /** An impact frame (Anime), 0..1. */
  setImpact(v: number): void;
  /** Off while another look (H, style3d/real) dresses the scene: its sky and lights hide. */
  setActive(on: boolean): void;
  dispose(): void;
}

export function createStyleKit(T: any, renderer: any, scene: any, tier: Quality3d, first: StyleDef): StyleKit {
  const prof = TIER_PROFILES[tier];
  const root = new T.Group();
  root.name = "style-kit";
  scene.add(root);
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  // ── sky ──
  const su: Record<string, { value: any }> = {
    top: { value: new T.Color() }, mid: { value: new T.Color() }, horizon: { value: new T.Color() }, ground: { value: new T.Color() },
    sunCol: { value: new T.Color() }, cloudCol: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) },
    sunSize: { value: 0 }, sunGlow: { value: 0 }, clouds: { value: 0 }, stars: { value: 0 }, flash: { value: 0 },
  };
  const sky = new T.Mesh(new T.SphereGeometry(240, 32, 16), new T.ShaderMaterial({ uniforms: su, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: T.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);

  // ── lights ──
  const hemi = new T.HemisphereLight("#ffffff", "#444444", 1);
  const sun = new T.DirectionalLight("#ffffff", 2);
  root.add(hemi, sun, sun.target);
  if (prof.shadows) {
    sun.castShadow = true;
    const s = prof.shadowScale >= 1 ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 260 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
  }
  const floods = [new T.DirectionalLight("#cfe0ff", 0), new T.DirectionalLight("#cfe0ff", 0)];
  for (const f of floods) root.add(f, f.target);
  // two coloured side lights that fall off (Strikers: orange one side, teal the other)
  const sides = [new T.PointLight("#ff8a3a", 0, 55, 1.2), new T.PointLight("#36d0d8", 0, 55, 1.2)];
  for (const l of sides) root.add(l);
  const rim = new T.DirectionalLight("#ffffff", 0);
  root.add(rim, rim.target);
  let flashT = 0, nextFlash = 3, flash = 0, burst = 0, impact = 0;

  // ── rain ──
  const RAIN = tier === "low" ? 500 : 1400;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSeed = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) { rainSeed[i * 3] = Math.random() * 70 - 35; rainSeed[i * 3 + 1] = Math.random() * 40; rainSeed[i * 3 + 2] = Math.random() * 70 - 35; }
  const rainGeo = new T.BufferGeometry();
  rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3));
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: "#b9c9e6", transparent: true, opacity: 0.45, fog: false }));
  rain.frustumCulled = false;
  root.add(rain);
  let rainT = 0;

  const grads = new Map<number, any>();
  const gradient = (n: number) => {
    let g = grads.get(n);
    if (!g) {
      const data = new Uint8Array(n * 4);
      for (let i = 0; i < n; i++) { const v = Math.round(60 + (195 * i) / Math.max(1, n - 1)); data.set([v, v, v, 255], i * 4); }
      g = new T.DataTexture(data, n, 1);
      g.minFilter = g.magFilter = T.NearestFilter;
      g.needsUpdate = true;
      grads.set(n, g);
    }
    return g;
  };

  const post = makeStylePost(T, renderer);
  const full = tier !== "low";
  let def = first;

  const kit: StyleKit = {
    get def() { return def; },
    tier,
    apply(d) {
      def = d;
      const s = d.sky;
      su.top.value.set(s.top); su.mid.value.set(s.mid); su.horizon.value.set(s.horizon); su.ground.value.set(s.ground);
      su.sunCol.value.set(s.sun); su.cloudCol.value.set(s.cloud);
      su.sunDir.value.set(...d.sunDir).normalize();
      su.sunSize.value = s.sunSize; su.sunGlow.value = s.sunGlow; su.clouds.value = s.clouds; su.stars.value = s.stars;
      hemi.color.set(d.hemi.sky); hemi.groundColor.set(d.hemi.ground); hemi.intensity = d.hemi.intensity;
      sun.color.set(d.sun.color); sun.intensity = d.sun.intensity;
      scene.fog = new T.Fog(d.fog.color, d.fog.near, d.fog.far);
      scene.background = null;
      for (const f of floods) { f.intensity = d.floodOn && !d.floodColors ? 1.1 : d.floodOn ? 0.35 : 0; f.color.set(d.floodColor ?? "#cfe0ff"); }
      sides.forEach((l, i) => { l.intensity = d.floodColors ? 450 : 0; l.color.set(d.floodColors?.[i] ?? "#ffffff"); });
      rim.color.set(d.rim?.color ?? "#ffffff"); rim.intensity = d.rim?.intensity ?? 0;
      flash = 0; su.flash.value = 0;
      rain.visible = d.rain;
    },
    mat(color, o = {}) {
      const base: any = { color, map: o.map ?? null, side: o.side ?? T.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1, alphaTest: o.alphaTest ?? 0 };
      if (o.emissive) { base.emissive = new T.Color(o.emissive); base.emissiveIntensity = o.emissiveIntensity ?? 1; }
      if (def.mat === "toon") return new T.MeshToonMaterial({ ...base, gradientMap: gradient(def.toonSteps) });
      if (def.mat === "lambert") return new T.MeshLambertMaterial(base);
      return new T.MeshStandardMaterial({ ...base, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0 });
    },
    update(dt, camera, focus) {
      sky.position.copy(camera.position);
      const dir = new T.Vector3(...def.sunDir).normalize();
      // the shadow box follows the action in 4 m steps (no swimming shadows)
      const fx = Math.round(focus.x / 4) * 4, fz = Math.round(focus.z / 4) * 4;
      sun.target.position.set(fx, 0, fz);
      sun.position.set(fx + dir.x * 120, Math.max(8, dir.y * 120), fz + dir.z * 120);
      floods[0].position.set(fx - 60, 70, fz + 50); floods[0].target.position.set(fx, 0, fz);
      floods[1].position.set(fx + 60, 70, fz - 50); floods[1].target.position.set(fx, 0, fz);
      sides[0].position.set(fx - 26, 9, fz - 4); sides[1].position.set(fx + 26, 9, fz - 4);
      // rim: from behind what the camera looks at, low
      const cx = camera.position.x - fx, cz = camera.position.z - fz, cl = Math.hypot(cx, cz) || 1;
      rim.position.set(fx - (cx / cl) * 60, 18, fz - (cz / cl) * 60); rim.target.position.set(fx, 1, fz);
      if (def.lightning) {
        flashT += dt;
        if (flashT > nextFlash) { flashT = 0; nextFlash = 2.5 + Math.random() * 4; flash = 1; }
        flash = Math.max(0, flash - dt * 3.5);
        su.flash.value = flash * (0.6 + 0.4 * Math.sin(flashT * 60));
      }
      if (rain.visible) {
        rainT += dt;
        for (let i = 0; i < RAIN; i++) {
          const y = ((rainSeed[i * 3 + 1] - rainT * 22) % 40 + 40) % 40;
          const x = focus.x + rainSeed[i * 3], z = focus.z + rainSeed[i * 3 + 2];
          rainPos.set([x, y, z, x + 0.12, y + 0.9, z + 0.05], i * 6);
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    },
    render(sc, camera) { post.render(sc, camera, def.post, full, burst, def.burst ?? "#ffffff", impact); },
    setBurst(v) { burst = v; },
    setImpact(v) { impact = v; },
    setActive(on) { root.visible = on; },
    stylePeople(people) {
      for (const p of people) {
        p.outline.visible = def.personOutline && prof.outlines;
        (p.outline.material as any).color?.set(def.outlineColor);
        const m = p.body.material as any;
        celShade(m, !!def.celPeople);
        m.roughness = def.glossy ? 0.32 : def.mat === "pbr" ? 0.62 : 0.8;
        m.metalness = 0;
        const s = def.chunky ?? 1;
        p.root.userData.chunky = s;
      }
    },
    dispose() {
      post.dispose();
      grads.forEach((g) => g.dispose());
      scene.remove(root);
      sky.geometry.dispose(); sky.material.dispose(); rainGeo.dispose(); rain.material.dispose();
    },
  };
  kit.apply(first);
  return kit;
}
