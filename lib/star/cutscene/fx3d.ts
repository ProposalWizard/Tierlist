/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * EFFECTS — confetti, ticker tape, camera flashes, fireworks, sparks, smoke,
 * rain, dust, a sun flare. Every particle's place is a function of t and a
 * seed (no simulation), so a still at t is always the same still.
 */
import type { FxKind } from "./types";
import { glowTexture } from "../style3d/kit";
import { rng } from "./math";
import type { Quality3d } from "../three3d/quality";

export interface FxActive { fx: FxKind; t: number; local: number; w: number; around: [number, number, number]; amount: number; colors?: string[] }

export function createFx(T: any, root: any, tier: Quality3d, seed: number) {
  const low = tier === "low";
  const disp: any[] = [];
  const glow = glowTexture(T); disp.push(glow);
  const R = rng(seed);

  // confetti / ticker tape: instanced paper bits falling and tumbling
  const CN = low ? 120 : 420;
  const confGeo = new T.PlaneGeometry(0.06, 0.04); disp.push(confGeo);
  const confMat = new T.MeshBasicMaterial({ side: T.DoubleSide, fog: false }); disp.push(confMat);
  const conf = new T.InstancedMesh(confGeo, confMat, CN);
  conf.frustumCulled = false; conf.visible = false; root.add(conf);
  const cs = Array.from({ length: CN }, () => [R.next() * 2 - 1, R.next(), R.next() * 2 - 1, R.next() * 6.28, R.next() * 6.28, 0.6 + R.next() * 0.8]);
  let confColours = "";

  // flashes: little bright sprites popping in the crowd / round the photographers
  const FN = 24;
  const flashes = Array.from({ length: FN }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false, color: "#ffffff" })); s.visible = false; root.add(s); disp.push(s.material); return s; });
  const fl = Array.from({ length: FN }, () => [R.next() * 2 - 1, R.next(), R.next() * 2 - 1, R.next() * 5]);

  // fireworks: bursts of sprites
  const FW = low ? 3 : 6, FP = 36;
  const fwSprites: any[] = [];
  for (let i = 0; i < FW * FP; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.visible = false; root.add(s); fwSprites.push(s); disp.push(s.material); }
  const fwSeed = Array.from({ length: FW }, () => [R.next() * 2 - 1, R.next(), R.next() * 2 - 1, R.next() * 3, R.next()]);

  // smoke / dust: soft big sprites
  const SN = low ? 6 : 14;
  const smokes = Array.from({ length: SN }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: glow, depthWrite: false, transparent: true, color: "#d8cfc4" })); s.visible = false; root.add(s); disp.push(s.material); return s; });
  const sm = Array.from({ length: SN }, () => [R.next() * 2 - 1, R.next(), R.next() * 2 - 1, R.next() * 6]);

  // rain
  const RN = low ? 500 : 1500;
  const rainPos = new Float32Array(RN * 6);
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3)); disp.push(rainGeo);
  const rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: "#b9c9e6", transparent: true, opacity: 0.4, fog: false }));
  rain.frustumCulled = false; rain.visible = false; root.add(rain); disp.push(rain.material);
  const rs = Array.from({ length: RN }, () => [R.next() * 40 - 20, R.next() * 20, R.next() * 40 - 20]);

  // flare: a big soft glow in the sun's way
  const flare = new T.Sprite(new T.SpriteMaterial({ map: glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false, color: "#ffd9a0" }));
  flare.visible = false; root.add(flare); disp.push(flare.material);

  const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(1, 1, 1), p = new T.Vector3();

  return {
    /** Draw these effects at t. Returns how much the flashes light the scene (0..1). */
    update(list: FxActive[], camera: any, sunDir: [number, number, number]): { flash: number } {
      conf.visible = false; rain.visible = false; flare.visible = false;
      for (const s of flashes) s.visible = false;
      for (const s of fwSprites) s.visible = false;
      for (const s of smokes) s.visible = false;
      let flash = 0;
      for (const a of list) {
        const [ax, ay, az] = a.around;
        if (a.fx === "confetti" || a.fx === "ticker-tape" || a.fx === "streamers") {
          conf.visible = true;
          const cols = a.colors ?? ["#e63946", "#ffffff", "#f4c542", "#d62828"];
          const key = cols.join();
          if (key !== confColours) { for (let i = 0; i < CN; i++) conf.setColorAt(i, new T.Color(cols[i % cols.length])); conf.instanceColor.needsUpdate = true; confColours = key; }
          const n = Math.floor(CN * Math.min(1, a.amount) * a.w);
          const H = 7, W = a.fx === "ticker-tape" ? 9 : 5;
          for (let i = 0; i < CN; i++) {
            const c = cs[i];
            if (i >= n) { m4.makeScale(0, 0, 0); conf.setMatrixAt(i, m4); continue; }
            const fall = (a.local * 0.85 * c[5] + c[1] * H) % H;
            const y = ay + H - fall;
            p.set(ax + c[0] * W + Math.sin(a.local * 1.3 + c[3]) * 0.35, y, az + c[2] * W + Math.cos(a.local * 1.1 + c[4]) * 0.3);
            e.set(a.local * 3 * c[5] + c[3], a.local * 2 + c[4], 0); q.setFromEuler(e);
            sc.setScalar(a.fx === "ticker-tape" ? 1.6 : 1);
            m4.compose(p, q, sc); conf.setMatrixAt(i, m4);
          }
          sc.setScalar(1);
          conf.instanceMatrix.needsUpdate = true;
        } else if (a.fx === "camera-flashes") {
          // each flash pops for 0.09 s at its own times
          for (let i = 0; i < FN; i++) {
            const f = fl[i];
            const period = 0.9 + f[3] * 0.5;
            const ph = (a.local + f[3] * 1.7) % period;
            if (ph < 0.09 && R && a.w > 0.2) {
              const s = flashes[i];
              s.visible = true;
              s.position.set(ax + f[0] * 2.2, ay + 0.2 + f[1] * 1.2, az + f[2] * 0.6);
              const k = (1 - ph / 0.09) * 0.55 * a.amount;
              s.scale.set(k, k, 1);
              flash = Math.max(flash, (1 - ph / 0.09) * 0.35 * a.w * a.amount);
            }
          }
        } else if (a.fx === "fireworks") {
          for (let b = 0; b < FW; b++) {
            const f = fwSeed[b];
            const life = 1.6, ph = (a.local + f[3]) % 2.4;
            if (ph > life) continue;
            const k = ph / life;
            const cx = ax + f[0] * 30, cy = ay + 22 + f[1] * 10, cz = az + f[2] * 10 - 25;
            const col = new T.Color().setHSL(f[4], 0.9, 0.62);
            for (let j = 0; j < FP; j++) {
              const s = fwSprites[b * FP + j];
              const th = (j / FP) * Math.PI * 2, ph2 = ((j * 7) % FP) / FP * Math.PI - Math.PI / 2;
              const r = 6 * (1 - (1 - k) * (1 - k));
              s.visible = true;
              s.position.set(cx + Math.cos(th) * Math.cos(ph2) * r, cy + Math.sin(ph2) * r - k * k * 3, cz + Math.sin(th) * Math.cos(ph2) * r);
              s.material.color.copy(col); s.material.opacity = (1 - k) * a.w;
              s.scale.setScalar(0.9);
            }
          }
        } else if (a.fx === "smoke" || a.fx === "dust") {
          for (let i = 0; i < SN; i++) {
            const f = sm[i], s = smokes[i];
            s.visible = true;
            const rise = (a.local * 0.25 + f[3]) % 3;
            s.position.set(ax + f[0] * 4 + rise * 0.3, ay + f[1] * 1.5 + rise * 0.5, az + f[2] * 3);
            const k = (a.fx === "dust" ? 1.2 : 3) * (0.6 + rise * 0.3);
            s.scale.set(k, k, 1);
            s.material.color.set(a.fx === "dust" ? "#e8d2b0" : "#cfc6bc");
            s.material.opacity = 0.18 * a.w * a.amount * (1 - rise / 3);
          }
        } else if (a.fx === "rain") {
          rain.visible = true;
          const cx = camera.position.x, cz = camera.position.z;
          for (let i = 0; i < RN; i++) {
            const r = rs[i];
            const y = ((r[1] - a.local * 20) % 20 + 20) % 20;
            const x = cx + r[0], z = cz + r[2];
            rainPos.set([x, y, z, x + 0.1, y + 0.8, z + 0.04], i * 6);
          }
          rainGeo.attributes.position.needsUpdate = true;
        } else if (a.fx === "flare") {
          flare.visible = true;
          const d = new T.Vector3(...sunDir).normalize().multiplyScalar(60);
          flare.position.copy(camera.position).add(d);
          flare.scale.set(30 * a.amount, 30 * a.amount, 1);
          flare.material.opacity = 0.55 * a.w;
        } else if (a.fx === "sparks") {
          for (let i = 0; i < FN; i++) {
            const f = fl[i], s = flashes[i];
            const ph = (a.local * 1.5 + f[3]) % 1;
            s.visible = true;
            s.position.set(ax + f[0] * 0.6 * ph * 3, ay + f[1] * ph * 2 - ph * ph, az + f[2] * 0.6 * ph * 3);
            s.material.color.set(a.colors?.[0] ?? "#ffd27a");
            const k = 0.12 * (1 - ph) * a.w; s.scale.set(k, k, 1);
          }
        }
      }
      return { flash };
    },
    dispose() { for (const d of disp) d.dispose?.(); root.remove(conf, rain, flare, ...flashes, ...fwSprites, ...smokes); },
  };
}
