/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H's STADIUM — a modern two-tier bowl round a 105 × 68 pitch, built in
 * code (no model to download):
 *
 *   - four stands, two tiers behind each goal and along each side, closed by
 *     corner sections; concrete steps, aisles every 14 m, a padded front wall
 *     and glass rails
 *   - the crowd: row after row of a real cheering crowd photo, every person
 *     tinted in the home or away colours (or left in a jacket), bobbing on
 *     their own beat and jumping on a goal
 *   - LED boards round the pitch and a ribbon board between the tiers (our own
 *     invented brands only), scrolling
 *   - roofs of ribbed metal on a deep white truss, with a row of floodlights
 *     under the leading edge (lit at night, with soft light shafts), and four
 *     corner masts
 *   - dugouts and a tunnel on the west side, corner flags that wave
 *   - goals with a real mesh net that bulges where the ball hits it
 *
 * Coordinates as the pitch: X across, Y up, Z out from the near goal line.
 */
import type { Quality3d } from "../../three3d/quality";
import { PITCH_LEN as L, PITCH_HALF_W as W } from "./pitch";
import { mergeStaticByMaterial } from "../../three3d/perf";

const GOAL_W = 7.32, GOAL_H = 2.44, NET_D = 2.0;

function rand(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export interface ArenaColours { home: string; home2: string; away: string }

export interface Arena {
  group: any;
  /** Crowd excitement 0..1 (a goal: 1, falling back by itself). */
  cheer(v: number): void;
  setNight(on: boolean): void;
  setColours(c: ArenaColours): void;
  update(dt: number, ball?: { x: number; y: number; z: number; vx: number; vy: number; vz: number }): void;
  dispose(): void;
}

interface Tier { z0: number; y0: number; rows: number; depth: number; rise: number }

const CROWD_HEAD = /* glsl */ `
attribute float aTeam;
attribute float aShade;
varying float vTeam;
varying float vShade;`;
const CROWD_FRAG_HEAD = /* glsl */ `
varying float vTeam;
varying float vShade;
uniform float uTime, uBob, uCheer, uLit;
uniform vec3 uHome, uHome2, uAway;
float ch(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }`;
const CROWD_MAP = /* glsl */ `
{
  vec2 cuv = vMapUv;
  float pc = floor(cuv.x * 22.0);
  float pr = floor(cuv.y * 5.0);
  float hs = ch(vec2(pc, pr) + vec2(vTeam * 13.0, 0.0));
  float beat = uTime * (4.5 + 3.5 * hs) + hs * 6.283;
  float hop = sin(beat) * (0.25 + 0.75 * hs);
  float jump = max(0.0, sin(uTime * 9.0 + hs * 6.283)) * uCheer;
  cuv.y -= (hop * uBob * 0.006 + jump * 0.03);
  vec4 tc = texture2D(map, cuv);
  float mx = max(tc.r, max(tc.g, tc.b)), mn = min(tc.r, min(tc.g, tc.b));
  float sat = (mx - mn) / max(mx, 1e-3);
  float lum = dot(tc.rgb, vec3(0.3333));
  float cloth = (1.0 - smoothstep(0.14, 0.32, sat)) * smoothstep(0.03, 0.2, lum);
  vec3 kit = vTeam > 0.5 ? uAway : (hs < 0.58 ? uHome : uHome2);
  float wears = hs < 0.8 ? 1.0 : 0.0;
  tc.rgb = mix(tc.rgb, kit * (0.2 + lum * 2.4), cloth * wears * 0.92);
  diffuseColor *= vec4(tc.rgb * vShade * uLit, 1.0);
}`;

function netCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff"; g.lineWidth = 7;
  g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
  return c;
}

function roofCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8bec6"; g.fillRect(0, 0, 64, 256);
  for (let x = 0; x < 64; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, "#8e959e"); gr.addColorStop(0.45, "#d4d9df"); gr.addColorStop(1, "#9aa1aa");
    g.fillStyle = gr; g.fillRect(x, 0, 8, 256);
  }
  const r = rand(4);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,50,40,${0.04 + r() * 0.06})`; g.fillRect(r() * 64, r() * 256, 2 + r() * 10, 20 + r() * 60); }
  return c;
}

function concreteCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a8d92"; g.fillRect(0, 0, 128, 128);
  const r = rand(9);
  for (let i = 0; i < 900; i++) { const v = 110 + Math.floor(r() * 60); g.fillStyle = `rgba(${v},${v},${v + 4},0.25)`; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  return c;
}

export function buildArena(T: any, tier: Quality3d, maps: { crowd: any; led: any }, o: { colours?: ArenaColours; skip?: ("N" | "S" | "W" | "E")[]; merge?: (gs: any[], useGroups?: boolean) => any } = {}): Arena {
  const G = new T.Group();
  G.name = "h-arena";
  const disp: any[] = [];
  const keep = <X>(x: X) => { disp.push(x); return x; };
  const skip = new Set(o.skip ?? []);
  const hi = tier !== "low";
  const r = rand(17);
  const colours: ArenaColours = o.colours ?? { home: "#c8102e", home2: "#f2f2f2", away: "#1d4ed8" };

  const canvasTex = (c: HTMLCanvasElement, srgb = true) => {
    const t = keep(new T.CanvasTexture(c));
    t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const concreteMap = canvasTex(concreteCanvas());
  concreteMap.repeat.set(0.25, 0.25);
  const concrete = keep(new T.MeshStandardMaterial({ color: "#9a9ea4", map: concreteMap, roughness: 0.92 }));
  const darkConcrete = keep(new T.MeshStandardMaterial({ color: "#3a3d43", roughness: 0.9 }));
  const steel = keep(new T.MeshStandardMaterial({ color: "#e9edf1", roughness: 0.38, metalness: 0.6 }));
  const roofMap = canvasTex(roofCanvas());
  const roofMat = keep(new T.MeshStandardMaterial({ color: "#ffffff", map: roofMap, roughness: 0.42, metalness: 0.55 }));
  const glass = keep(new T.MeshStandardMaterial({ color: "#bcd6e6", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }));
  const padding = keep(new T.MeshStandardMaterial({ color: "#3b4a5e", roughness: 0.7 }));
  const lampOff = new T.Color("#dfe4ea"), lampOn = new T.Color(14, 14, 12.5);
  const lampMat = keep(new T.MeshBasicMaterial({ color: lampOff.clone(), toneMapped: true }));

  // ── the crowd material ──
  const cu: Record<string, { value: any }> = {
    uTime: { value: 0 }, uBob: { value: 1 }, uCheer: { value: 0 }, uLit: { value: 1 },
    uHome: { value: new T.Color(colours.home) }, uHome2: { value: new T.Color(colours.home2) }, uAway: { value: new T.Color(colours.away) },
  };
  const crowdMat = keep(new T.MeshStandardMaterial({ map: maps.crowd, roughness: 0.95, side: T.FrontSide }));
  crowdMat.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, cu);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${CROWD_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTeam = aTeam; vShade = aShade;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${CROWD_FRAG_HEAD}`)
      .replace("#include <map_fragment>", CROWD_MAP);
  };
  crowdMat.customProgramCacheKey = () => "h-crowd-v1";

  // ── LED boards ──
  const ledMats: any[] = [];
  // One LED material per scroll speed (9 Oct 2026, lag): each board used to be a
  // six-material box (six draws) with its own texture copy. Now the box is plain
  // dark concrete (merged with the rest) and the screen is a plane whose UVs
  // carry the board's length, sharing its speed's material: a handful of draws in all.
  const ledBySpeed = new Map<number, any>();
  const ledMatFor = (speed: number) => {
    let m = ledBySpeed.get(speed);
    if (!m) {
      const t = keep(maps.led.clone());
      t.wrapS = T.RepeatWrapping; t.needsUpdate = true;
      m = keep(new T.MeshBasicMaterial({ map: t, color: new T.Color(1.05, 1.05, 1.05) }));
      m.userData.speed = speed;
      ledMats.push(m);
      ledBySpeed.set(speed, m);
    }
    return m;
  };
  const ledBoard = (len: number, h: number, scrollSpeed: number) => {
    const box = new T.Mesh(keep(new T.BoxGeometry(len, h, 0.18)), darkConcrete);
    const sg = keep(new T.PlaneGeometry(len, h));
    const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 13));
    sg.translate(0, 0, 0.091);
    const screen = new T.Mesh(sg, ledMatFor(scrollSpeed));
    box.add(screen);
    return box;
  };
  const boardRing = () => {
    const add = (len: number, x: number, z: number, ry: number, sp: number) => {
      const b = ledBoard(len, 1.0, sp);
      b.position.set(x, 0.5, z); b.rotation.y = ry;
      b.castShadow = hi;
      G.add(b);
    };
    add(86, 0, -3.6, 0, 0.012); add(86, 0, L + 3.6, Math.PI, 0.012);
    add(L + 4, -W - 4.0, L / 2, Math.PI / 2, 0.009); add(L + 4, W + 4.0, L / 2, -Math.PI / 2, 0.009);
  };
  boardRing();

  // ── a stand: tiers, crowd, ribbon board, roof, truss, lamps ──
  const lampPos: { x: number; y: number; z: number; tx: number; tz: number }[] = [];
  const crowdP: number[] = [], crowdUV: number[] = [], crowdTeam: number[] = [], crowdShade: number[] = [], crowdIdx: number[] = [];
  const pushQuad = (a: any, b: any, c: any, d: any, u0: number, u1: number, v0: number, v1: number, team: number, shade: number) => {
    const base = crowdP.length / 3;
    crowdP.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    crowdUV.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let i = 0; i < 4; i++) { crowdTeam.push(team); crowdShade.push(shade); }
    crowdIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const tmpM = new T.Matrix4();
  const trussBars: any[] = [];

  /** A stand in its own frame: x along it, z away from the pitch (front at z = 0), y up. */
  const stand = (len: number, tiers: Tier[], place: { x: number; z: number; ry: number }, opts: { team?: (x: number) => number; roof?: boolean; ribbon?: boolean; tunnelAt?: number }) => {
    const S = new T.Group();
    S.position.set(place.x, 0, place.z); S.rotation.y = place.ry;
    // front wall with padding
    const wall = new T.Mesh(keep(new T.BoxGeometry(len, 1.1, 0.4)), padding);
    wall.position.set(0, 0.55, -0.2); wall.castShadow = hi; wall.receiveShadow = true; S.add(wall);
    let topY = 0, backZ = 0;
    tiers.forEach((t, ti) => {
      const shape = new T.Shape();
      shape.moveTo(t.z0, t.y0 - (ti ? 2.6 : t.y0));
      shape.lineTo(t.z0, t.y0);
      for (let i = 0; i < t.rows; i++) {
        shape.lineTo(t.z0 + i * t.depth, t.y0 + (i + 1) * t.rise);
        shape.lineTo(t.z0 + (i + 1) * t.depth, t.y0 + (i + 1) * t.rise);
      }
      const zEnd = t.z0 + t.rows * t.depth, yEnd = t.y0 + t.rows * t.rise;
      shape.lineTo(zEnd, t.y0 - (ti ? 2.6 : t.y0));
      shape.lineTo(t.z0, t.y0 - (ti ? 2.6 : t.y0));
      const geo = keep(new T.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1 }));
      geo.translate(0, 0, -len / 2);
      geo.rotateY(-Math.PI / 2);
      const m = new T.Mesh(geo, concrete);
      m.castShadow = hi; m.receiveShadow = true;
      S.add(m);
      // glass rail on the tier's front
      const rail = new T.Mesh(keep(new T.BoxGeometry(len, 1.0, 0.04)), glass);
      rail.position.set(0, t.y0 + 0.5 + (ti ? 0 : 0.7), t.z0 - 0.05); S.add(rail);
      // crowd, row by row, with aisles every 14 m (and a gap for the tunnel)
      const aisle = 1.3, block = 14;
      for (let i = 0; i < t.rows; i++) {
        const zf = t.z0 + i * t.depth + t.depth * 0.55;
        const y0 = t.y0 + (i + 1) * t.rise - 0.04, y1 = y0 + 1.2;
        const v0 = 0.02 + r() * 0.72, v1 = v0 + 0.21;
        // the upper rows under the overhang and roof sit in shade
        const shade = 0.82 + 0.18 * (1 - i / t.rows) * (ti === 0 && tiers.length > 1 ? 0.7 : 1);
        for (let x = -len / 2 + 0.6; x < len / 2 - 0.6; x += block) {
          const xa = x, xb = Math.min(len / 2 - 0.6, x + block - aisle);
          if (opts.tunnelAt !== undefined && ti === 0 && i < 6 && Math.abs((xa + xb) / 2 - opts.tunnelAt) < 6) continue;
          if (xb - xa < 1) continue;
          const team = opts.team ? opts.team((xa + xb) / 2) : 0;
          const uo = r() * 4;
          const p = (x: number, y: number) => new T.Vector3(x, y, zf);
          // facing the pitch (−z): wind so the front face looks at −z
          pushQuad(p(xb, y0), p(xa, y0), p(xa, y1), p(xb, y1), uo + xb / 15, uo + xa / 15, v0, v1, team, shade);
        }
      }
      // place this stand's crowd into world space later (S matrix): record S
      topY = yEnd; backZ = zEnd;
      // ribbon board on the upper tier's front
      if (ti === 1 && opts.ribbon) {
        const rb = ledBoard(len, 1.3, -0.006);
        rb.position.set(0, t.y0 - 1.0, t.z0 - 0.15); rb.rotation.y = Math.PI;
        S.add(rb);
      }
    });
    // back wall
    const bw = new T.Mesh(keep(new T.BoxGeometry(len, topY + 6, 0.5)), darkConcrete);
    bw.position.set(0, (topY + 6) / 2, backZ + 0.3); bw.castShadow = hi; S.add(bw);
    if (opts.roof !== false) {
      const front = 3.5, roofY = topY + 6.5;
      const depth = backZ + 1 - front;
      const roof = new T.Mesh(keep(new T.BoxGeometry(len + 1, 0.45, depth)), roofMat);
      roof.material = roofMat;
      roofMap.repeat.set(len / 8, depth / 32);
      roof.position.set(0, roofY, front + depth / 2);
      roof.rotation.x = -0.06;
      roof.castShadow = hi; roof.receiveShadow = true;
      S.add(roof);
      // the truss along the leading edge: top and bottom chords, diagonals
      const tH = 2.6, ty = roofY + 0.1 - front * Math.sin(0.06);
      const chord = (y: number, z: number) => { const c = new T.Mesh(keep(new T.BoxGeometry(len + 1, 0.22, 0.22)), steel); c.position.set(0, y, z); S.add(c); };
      chord(ty, front); chord(ty - tH, front + 0.8); chord(ty - tH, front - 0.6);
      for (let x = -len / 2; x <= len / 2 + 1e-6; x += 3) {
        const diag = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
          const a = new T.Vector3(x0, y0, z0), b = new T.Vector3(x1, y1, z1);
          trussBars.push({ a, b, s: S });
        };
        diag(x, ty, front, x + 1.5, ty - tH, front + 0.8);
        diag(x + 1.5, ty - tH, front + 0.8, x + 3, ty, front);
        diag(x, ty, front, x + 1.5, ty - tH, front - 0.6);
        // a lamp every 6 m under the leading edge
        if (Math.round((x + len / 2) / 3) % 2 === 0) lampPos.push({ x, y: ty - tH - 0.35, z: front, tx: x * 0.6, tz: -18, s: S } as any);
      }
      // columns at the back
      for (let x = -len / 2; x <= len / 2 + 1e-6; x += len / 4) {
        const c = new T.Mesh(keep(new T.BoxGeometry(0.6, roofY, 0.6)), darkConcrete);
        c.position.set(x, roofY / 2, backZ + 1); S.add(c);
      }
    }
    // tunnel: a dark mouth in the front wall with a white canopy
    if (opts.tunnelAt !== undefined) {
      const mouth = new T.Mesh(keep(new T.BoxGeometry(4.2, 2.8, 3)), keep(new T.MeshStandardMaterial({ color: "#0b0d10", roughness: 1 })));
      mouth.position.set(opts.tunnelAt, 1.4, 1.2); S.add(mouth);
      const canopy = new T.Mesh(keep(new T.CylinderGeometry(2.4, 2.4, 6, 18, 1, true, 0, Math.PI)), keep(new T.MeshStandardMaterial({ color: "#f4f5f7", roughness: 0.6, side: T.DoubleSide })));
      canopy.rotation.z = Math.PI / 2; canopy.rotation.y = Math.PI / 2;
      canopy.position.set(opts.tunnelAt, 0.4, -3); canopy.castShadow = hi; S.add(canopy);
    }
    G.add(S);
    return S;
  };

  // Behind each goal: two tiers. Along the sides: two tiers. The camera's end (S) is lower.
  const two: Tier[] = [{ z0: 0.4, y0: 1.1, rows: 20, depth: 0.82, rise: 0.4 }, { z0: 14.5, y0: 12.2, rows: 17, depth: 0.86, rise: 0.56 }];
  const gapEnd = 4.9, gapSide = 6.0;
  const stands: { S: any; first: number; last: number }[] = [];
  const mark = () => crowdP.length / 3;
  let f = mark();
  if (!skip.has("N")) { const S = stand(2 * W + 2 * gapSide, two, { x: 0, z: -gapEnd, ry: Math.PI }, { ribbon: true }); stands.push({ S, first: f, last: mark() }); f = mark(); }
  if (!skip.has("S")) { const S = stand(2 * W + 2 * gapSide, two, { x: 0, z: L + gapEnd, ry: 0 }, { ribbon: true, team: () => 1 }); stands.push({ S, first: f, last: mark() }); f = mark(); }
  if (!skip.has("W")) { const S = stand(L + 2 * gapEnd, two, { x: -W - gapSide, z: L / 2, ry: -Math.PI / 2 }, { ribbon: true, tunnelAt: 0 }); stands.push({ S, first: f, last: mark() }); f = mark(); }
  if (!skip.has("E")) { const S = stand(L + 2 * gapEnd, two, { x: W + gapSide, z: L / 2, ry: Math.PI / 2 }, { ribbon: true, team: (x) => (x > L / 2 - 14 ? 1 : 0) }); stands.push({ S, first: f, last: mark() }); f = mark(); }
  // corners: one tier, turned 45°, closing the bowl
  const one: Tier[] = [{ z0: 0.4, y0: 1.4, rows: 22, depth: 0.82, rise: 0.44 }];
  for (const [cx, cz, ry] of [[-W - gapSide, -gapEnd, -Math.PI * 0.75], [W + gapSide, -gapEnd, Math.PI * 0.75], [-W - gapSide, L + gapEnd, -Math.PI * 0.25], [W + gapSide, L + gapEnd, Math.PI * 0.25]] as const) {
    const S = stand(18, one, { x: cx + Math.sin(ry) * 4, z: cz + Math.cos(ry) * 4, ry }, { roof: false, team: () => (cz > L / 2 ? 1 : 0) });
    stands.push({ S, first: f, last: mark() }); f = mark();
  }

  // the crowd: every stand's quads into world space, one mesh
  G.updateMatrixWorld(true);
  const v = new T.Vector3();
  for (const s of stands) {
    for (let i = s.first; i < s.last; i++) {
      v.set(crowdP[i * 3], crowdP[i * 3 + 1], crowdP[i * 3 + 2]).applyMatrix4(s.S.matrixWorld);
      crowdP[i * 3] = v.x; crowdP[i * 3 + 1] = v.y; crowdP[i * 3 + 2] = v.z;
    }
  }
  const cg = keep(new T.BufferGeometry());
  cg.setAttribute("position", new T.Float32BufferAttribute(crowdP, 3));
  cg.setAttribute("uv", new T.Float32BufferAttribute(crowdUV, 2));
  cg.setAttribute("aTeam", new T.Float32BufferAttribute(crowdTeam, 1));
  cg.setAttribute("aShade", new T.Float32BufferAttribute(crowdShade, 1));
  cg.setIndex(crowdIdx);
  cg.computeVertexNormals();
  const crowd = new T.Mesh(cg, crowdMat);
  crowd.receiveShadow = true;
  crowd.name = "h-crowd";
  G.add(crowd);

  // the trusses, one instanced draw
  if (trussBars.length) {
    const bar = keep(new T.CylinderGeometry(0.07, 0.07, 1, 5));
    bar.translate(0, 0.5, 0);
    const im = new T.InstancedMesh(bar, steel, trussBars.length);
    const up = new T.Vector3(0, 1, 0), q = new T.Quaternion(), sc = new T.Vector3();
    trussBars.forEach((b, i) => {
      const a = b.a.clone().applyMatrix4(b.s.matrixWorld), c = b.b.clone().applyMatrix4(b.s.matrixWorld);
      const d = c.clone().sub(a);
      q.setFromUnitVectors(up, d.clone().normalize());
      sc.set(1, d.length(), 1);
      tmpM.compose(a, q, sc);
      im.setMatrixAt(i, tmpM);
    });
    im.castShadow = hi;
    G.add(im);
  }

  // roof lamps (one instanced draw) and their light shafts (night)
  const lampGeo = keep(new T.BoxGeometry(1.5, 0.5, 0.9));
  const lamps = new T.InstancedMesh(lampGeo, lampMat, Math.max(1, lampPos.length));
  const shaftGeo = keep(new T.ConeGeometry(1, 1, 18, 1, true));
  shaftGeo.translate(0, -0.5, 0);
  const shaftTex = (() => {
    const c = document.createElement("canvas"); c.width = 4; c.height = 64;
    const g = c.getContext("2d")!; const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const shaftMat = keep(new T.MeshBasicMaterial({ map: shaftTex, color: "#cfdcff", transparent: true, opacity: 0.04, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  const shafts = new T.InstancedMesh(shaftGeo, shaftMat, Math.max(1, lampPos.length));
  {
    const q = new T.Quaternion(), sc = new T.Vector3(1, 1, 1), p = new T.Vector3(), t = new T.Vector3(), dn = new T.Vector3(0, -1, 0);
    lampPos.forEach((lp: any, i) => {
      p.set(lp.x, lp.y, lp.z).applyMatrix4(lp.s.matrixWorld);
      t.set(lp.x * 0.7, 0, lp.z - 26).applyMatrix4(lp.s.matrixWorld);
      t.y = 0;
      const d = t.clone().sub(p);
      q.setFromUnitVectors(new T.Vector3(0, 0, 1), d.clone().setY(0).normalize());
      tmpM.compose(p, q, sc);
      lamps.setMatrixAt(i, tmpM);
      // the shaft: a long thin cone from the lamp towards the pitch
      const len = d.length() * 0.6;
      // the cone's tip is at the lamp and it opens down its own −y: aim −y along d
      q.setFromUnitVectors(dn, d.clone().normalize());
      sc.set(4.5, len, 4.5);
      tmpM.compose(p, q, sc);
      shafts.setMatrixAt(i, tmpM);
      sc.set(1, 1, 1);
    });
  }
  lamps.count = shafts.count = lampPos.length;
  // night: a soft glare round every lamp (one draw of points), what the eye and a TV camera see
  const glareTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(235,242,255,0.85)"); gr.addColorStop(0.4, "rgba(200,220,255,0.18)"); gr.addColorStop(1, "rgba(200,220,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = keep(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const gp: number[] = [];
  {
    const p = new T.Vector3();
    for (const lp of lampPos as any[]) { p.set(lp.x, lp.y - 0.3, lp.z - 0.4).applyMatrix4(lp.s.matrixWorld); gp.push(p.x, p.y, p.z); }
  }
  const glareGeo = keep(new T.BufferGeometry());
  glareGeo.setAttribute("position", new T.Float32BufferAttribute(gp, 3));
  const glare = new T.Points(glareGeo, keep(new T.PointsMaterial({ map: glareTex, size: 7, sizeAttenuation: true, color: new T.Color(3, 3, 3), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })));
  glare.visible = false; glare.renderOrder = 5;
  G.add(glare);
  shafts.visible = false;
  shafts.renderOrder = 4;
  G.add(lamps, shafts);

  // corner masts (seen from the training pitch and the drills)
  const mastLamps: any[] = [];
  for (const [x, z] of [[-W - 24, -20], [W + 24, -20], [-W - 24, L + 20], [W + 24, L + 20]]) {
    const h = 44;
    const mast = new T.Mesh(keep(new T.CylinderGeometry(0.45, 0.9, h, 8)), steel);
    mast.position.set(x, h / 2, z); mast.castShadow = false; G.add(mast);
    const head = new T.Group();
    head.add(new T.Mesh(keep(new T.BoxGeometry(8, 4.8, 0.5)), darkConcrete));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const l = new T.Mesh(keep(new T.BoxGeometry(1.3, 1.2, 0.2)), lampMat);
      l.position.set(-2.9 + i * 1.45, -1.4 + j * 1.4, 0.35); head.add(l);
    }
    head.position.set(x, h + 2, z); head.lookAt(0, 0, L / 2);
    G.add(head);
    mastLamps.push(head);
  }

  // dugouts on the west touchline, either side of halfway
  const perspex = keep(new T.MeshStandardMaterial({ color: "#d8e6ef", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }));
  const seatMat = keep(new T.MeshStandardMaterial({ color: colours.home, roughness: 0.5 }));
  for (const dz of [-9, 9]) {
    const g = new T.Group();
    const shell = new T.Mesh(keep(new T.CylinderGeometry(1.4, 1.4, 7, 16, 1, true, 0, Math.PI)), perspex);
    shell.rotation.z = Math.PI / 2; shell.position.y = 0.2; g.add(shell);
    const back = new T.Mesh(keep(new T.BoxGeometry(7, 1.6, 0.12)), darkConcrete); back.position.set(0, 0.8, 0.0); back.rotation.y = 0; g.add(back);
    const seats = new T.Mesh(keep(new T.BoxGeometry(6.6, 0.5, 0.6)), seatMat); seats.position.set(0, 0.45, -0.35); g.add(seats);
    g.rotation.y = Math.PI / 2;
    g.position.set(-W - 2.6, 0, L / 2 + dz);
    G.add(g);
  }

  // ── goals with a real net ──
  const postMat = keep(new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.28, metalness: 0.05 }));
  const netTex = canvasTex(netCanvas());
  const netMat = keep(new T.MeshStandardMaterial({ map: netTex, color: "#ffffff", roughness: 0.8, alphaTest: 0.02, side: T.DoubleSide, transparent: true, depthWrite: false }));
  netMat.alphaMap = netTex;
  type Net = { geo: any; base: Float32Array; hit: { x: number; y: number; amp: number; v: number } ; end: number };
  const nets: Net[] = [];
  for (const end of [0, 1]) {
    const g = new T.Group();
    const R = 0.06, HW = GOAL_W / 2;
    for (const sx of [-1, 1]) {
      const post = new T.Mesh(keep(new T.CylinderGeometry(R, R, GOAL_H + R, 16)), postMat);
      post.position.set(sx * HW, (GOAL_H + R) / 2, 0); post.castShadow = true; g.add(post);
      // back stanchion
      const st = new T.Mesh(keep(new T.CylinderGeometry(0.025, 0.025, GOAL_H * 0.9, 6)), postMat);
      st.position.set(sx * HW, GOAL_H * 0.45, -NET_D); g.add(st);
      const sb = new T.Mesh(keep(new T.CylinderGeometry(0.025, 0.025, NET_D, 6)), postMat);
      sb.rotation.x = Math.PI / 2; sb.position.set(sx * HW, GOAL_H * 0.9, -NET_D / 2); g.add(sb);
    }
    const bar = new T.Mesh(keep(new T.CylinderGeometry(R, R, GOAL_W + 2 * R, 16)), postMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, GOAL_H, 0); bar.castShadow = true; g.add(bar);
    // the net: back (subdivided, it bulges), roof and two sides
    const back = keep(new T.PlaneGeometry(GOAL_W, GOAL_H * 0.9, 28, 10));
    back.translate(0, GOAL_H * 0.45, -NET_D);
    const nb = new T.Mesh(back, netMat); g.add(nb);
    const uvs = back.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * GOAL_W / 0.14, uvs.getY(i) * GOAL_H * 0.9 / 0.14);
    const top = keep(new T.PlaneGeometry(GOAL_W, NET_D));
    const tu = top.attributes.uv; for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) * GOAL_W / 0.14, tu.getY(i) * NET_D / 0.14);
    top.rotateX(-Math.PI / 2 + Math.atan2(GOAL_H * 0.1, NET_D)); top.translate(0, GOAL_H * 0.95, -NET_D / 2);
    g.add(new T.Mesh(top, netMat));
    for (const sx of [-1, 1]) {
      const sg = keep(new T.BufferGeometry());
      const pts = [sx * HW, 0, 0, sx * HW, GOAL_H, 0, sx * HW, GOAL_H * 0.9, -NET_D, sx * HW, 0, -NET_D];
      sg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      sg.setAttribute("uv", new T.Float32BufferAttribute([0, 0, 0, GOAL_H / 0.14, NET_D / 0.14, GOAL_H * 0.9 / 0.14, NET_D / 0.14, 0], 2));
      sg.setIndex([0, 1, 2, 0, 2, 3]); sg.computeVertexNormals();
      g.add(new T.Mesh(sg, netMat));
    }
    if (end) { g.rotation.y = Math.PI; g.position.z = L; }
    G.add(g);
    nets.push({ geo: back, base: Float32Array.from(back.attributes.position.array), hit: { x: 0, y: 1, amp: 0, v: 0 }, end });
  }
  netTex.repeat.set(1, 1);

  // ── corner flags ──
  const flagMat = keep(new T.MeshStandardMaterial({ color: "#f5d90a", roughness: 0.7, side: T.DoubleSide }));
  const poleMat = keep(new T.MeshStandardMaterial({ color: "#f5f5f0", roughness: 0.4 }));
  const flags: { geo: any; base: Float32Array; ph: number }[] = [];
  for (const z of [0, L]) for (const sx of [-1, 1]) {
    const pole = new T.Mesh(keep(new T.CylinderGeometry(0.02, 0.02, 1.5, 6)), poleMat);
    pole.position.set(sx * W, 0.75, z); pole.castShadow = true; G.add(pole);
    const fg = keep(new T.PlaneGeometry(0.45, 0.32, 6, 2)); fg.translate(0.225, 0, 0);
    const flag = new T.Mesh(fg, flagMat); flag.position.set(sx * W, 1.33, z); flag.castShadow = true; G.add(flag);
    flags.push({ geo: fg, base: Float32Array.from(fg.attributes.position.array), ph: r() * 6 });
  }

  // One draw per material for everything that never moves (9 Oct 2026, lag): the
  // stands, roofs, walls, dugouts, posts and boards were ~190 separate draws a
  // frame (measured on the real game 3D). The nets and corner flags move, and
  // see-through things keep their own draw so they still sort.
  if (o.merge) {
    const moving = new Set<any>([...nets.map((n) => n.geo), ...flags.map((f) => f.geo)]);
    mergeStaticByMaterial(T, o.merge, G, { filter: (m: any) => !moving.has(m.geometry) && !m.material?.transparent });
    G.traverse((x: any) => { if (typeof x.name === "string" && x.name.startsWith("merged:")) keep(x.geometry); });
  }

  let time = 0, cheer = 0, night = false;
  const arena: Arena = {
    group: G,
    cheer(v) { cheer = Math.max(cheer, v); },
    setNight(on) {
      night = on;
      lampMat.color.copy(on ? lampOn : lampOff);
      shafts.visible = on && hi;
      glare.visible = on;
      // at night the stands sit darker than the floodlit pitch
      cu.uLit.value = on ? 0.62 : 1;
      for (const m of ledMats) m.color.setScalar(on ? 1.5 : 1.05);
    },
    setColours(c) {
      cu.uHome.value.set(c.home); cu.uHome2.value.set(c.home2); cu.uAway.value.set(c.away);
      seatMat.color.set(c.home);
    },
    update(dt, ball) {
      time += dt;
      cheer = Math.max(0, cheer - dt * 0.18);
      cu.uTime.value = time; cu.uCheer.value = cheer; cu.uBob.value = 1 + cheer * 3;
      for (const m of ledMats) { m.map.offset.x = (m.map.offset.x + dt * m.userData.speed) % 1; }
      // flags flutter
      for (const fl of flags) {
        const pa = fl.geo.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const bx = fl.base[i * 3], by = fl.base[i * 3 + 1];
          pa.setZ(i, Math.sin(time * 6 + bx * 14 + fl.ph) * 0.06 * (bx / 0.45));
          pa.setY(i, by - (bx / 0.45) * 0.03);
        }
        pa.needsUpdate = true;
      }
      // the nets: a ball inside the goal pushes the back net out where it hits
      for (const n of nets) {
        if (ball) {
          const zl = n.end ? L - ball.y : ball.y; // metres in front of this goal line (negative = in the net)
          const inGoal = zl < -0.2 && zl > -NET_D - 0.6 && Math.abs(ball.x) < GOAL_W / 2 + 0.2 && ball.z < GOAL_H;
          const speed = Math.hypot(ball.vx, ball.vy);
          if (inGoal && zl < -NET_D + 0.5 && speed > 1.5) {
            const hx = n.end ? -ball.x : ball.x;
            n.hit.x = hx; n.hit.y = Math.max(0.2, ball.z);
            n.hit.v = Math.max(n.hit.v, Math.min(0.9, speed * 0.05));
          }
        }
        // spring: velocity into amplitude, then back
        n.hit.amp += n.hit.v * dt * 6;
        n.hit.v -= (n.hit.amp * 16 + n.hit.v * 3) * dt;
        if (Math.abs(n.hit.amp) < 1e-4 && Math.abs(n.hit.v) < 1e-4) continue;
        const pa = n.geo.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const bx = n.base[i * 3], by = n.base[i * 3 + 1], bz = n.base[i * 3 + 2];
          const d2 = (bx - n.hit.x) ** 2 + (by - n.hit.y) ** 2;
          const edge = Math.min(1, (GOAL_W / 2 - Math.abs(bx)) / 0.8) * Math.min(1, by / 0.4) * Math.min(1, (GOAL_H * 0.9 - by) / 0.4);
          pa.setZ(i, bz - n.hit.amp * Math.exp(-d2 / 1.1) * Math.max(0, edge));
        }
        pa.needsUpdate = true;
      }
      void night;
    },
    dispose() {
      G.traverse((ob: any) => { if (ob.isInstancedMesh) ob.dispose?.(); });
      for (const d of disp) d.dispose?.();
    },
  };
  return arena;
}
