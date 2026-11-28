/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A DRIVE CAR'S PARTS (driving phase 1-2, 28 Nov 2026): a cut-wheel car (tools/cars/cut_wheels.py,
 * public/star/drive3d/car-<id>.glb) split into its body (under a tilt group: roll, pitch) and its four
 * wheels (on the root: they stay on the road; the fronts steer). Used by the drive (./scene.ts) and the
 * arrival at the real compound (lib/star/world3d/testScene.ts, ./arrival.ts).
 */
/** Your car's parts: the body under a tilt group (roll, pitch), the wheels on the root (they stay on the road). */
export function rigCar(T: any, root: any, o: { creased?: (g: any, angle: number) => any; /** the car's own paint (sRGB 0..1, cars.ts): its baked light and shade evened out */ paint?: [number, number, number] } = {}) {
  const out = new T.Group();
  const tilt = new T.Group();
  out.add(tilt);
  const wheels: { node: any; front: boolean }[] = [];
  const kids = [...root.children];
  let body: any = null;
  for (const k of kids) {
    if (/^wheel_/.test(k.name)) { k.rotation.order = "YXZ"; out.add(k); wheels.push({ node: k, front: /^wheel_F/.test(k.name) }); }
    else { tilt.add(k); if (!body) body = k; }
  }
  // the body's shading from its own shape (BufferGeometryUtils.toCreasedNormals, 45°): the file's normals are packed
  // to 8 bits (scripts/perf3d/shrink-models.mjs) and read dented close up; the parked compound cars do the same
  // the paint first (its colours tell the body from the glass and the trim), then the lumps out of the paint, then the normals
  if (o.paint) { evenPaint(T, tilt, o.paint); relaxPaint(T, tilt, o.paint); }
  if (o.creased) tilt.traverse((m: any) => { if (m.isMesh && !m.userData.creased) { const g = o.creased!(m.geometry, Math.PI / 4); if (g && g !== m.geometry) { m.geometry = g; m.userData.creased = true; } } });
  const box = new T.Box3().setFromObject(tilt);
  // a wheel that came out of the cut with a bit of body on it (the light copies' front arches): the bit spins with
  // the wheel and leaves a hole. Every wheel keeps only the triangles round its hub (within 1.12 × its radius).
  if (wheels.length) {
    const rW = wheels.reduce((a, w) => a + w.node.position.y, 0) / wheels.length;
    for (const w of wheels) trimWheel(T, w.node, rW * 1.12);
    // and slivers of body left inside a wheel's own space (under the arch, below the hub): they hang below the sill
    clearArches(T, tilt, wheels.map((w) => w.node.position.clone()), rW);
  }
  const fz = wheels.filter((w) => w.front).map((w) => w.node.position.z), rz = wheels.filter((w) => !w.front).map((w) => w.node.position.z);
  const wheelbase = fz.length && rz.length ? Math.abs(fz.reduce((a, b) => a + b, 0) / fz.length - rz.reduce((a, b) => a + b, 0) / rz.length) : 2.6;
  const wheelR = wheels.length ? wheels.reduce((a, w) => a + w.node.position.y, 0) / wheels.length : 0.4;
  // arch liners: a dark half-drum over each wheel inside the arch, so a gap the wheel cut left in the body (the light
  // copies' front arches) shows a dark arch, never the sky through the car
  if (wheels.length) {
    const linerM = new T.MeshStandardMaterial({ color: "#0d0e10", roughness: 1, side: T.DoubleSide });
    for (const w of wheels) {
      const g = new T.CylinderGeometry(wheelR * 1.1, wheelR * 1.1, 0.26, 14, 1, true, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      const liner = new T.Mesh(g, linerM);
      liner.name = "arch-liner";
      liner.position.copy(w.node.position);
      // a little inboard of the tyre's outer face
      liner.position.x -= Math.sign(w.node.position.x || 1) * 0.05;
      tilt.add(liner);
    }
  }
  return { root: out, tilt, body: tilt, wheels, wheelbase, wheelR, width: box.max.x - box.min.x, length: box.max.z - box.min.z };
}


const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/**
 * The generated cars' pictures carry baked light and shade: on the paint it reads as dents and lumps close up. Where
 * the picture is the car's own paint colour, most of that is taken out (the paint's own colour, 30% of the picture's
 * light and dark kept), so the real lights and the smoothed normals shape the body instead. Glass, lamps, tyres,
 * trim and the plates keep their picture.
 */
function evenPaint(T: any, root: any, paint: [number, number, number]) {
  const f = new T.Vector3(lin(paint[0]), lin(paint[1]), lin(paint[2]));
  const fl = Math.max(1e-3, 0.2126 * f.x + 0.7152 * f.y + 0.0722 * f.z);
  root.traverse((m: any) => {
    if (!m.isMesh || !m.material?.map || m.material.name === "plate" || m.userData.evened) return;
    const mat = m.material.clone();
    mat.onBeforeCompile = (sh: any) => {
      sh.uniforms.uPaint = { value: f }; sh.uniforms.uPaintL = { value: fl };
      sh.fragmentShader = "uniform vec3 uPaint; uniform float uPaintL;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
  {
    vec3 cc = diffuseColor.rgb;
    float l = dot(cc, vec3(0.2126, 0.7152, 0.0722));
    float near = 1.0 - smoothstep(0.16, 0.45, distance(cc / max(l, 1e-3), uPaint / uPaintL));
    near *= smoothstep(0.02, 0.08, l / uPaintL) * (1.0 - smoothstep(1.6, 2.4, l / uPaintL));
    diffuseColor.rgb = mix(cc, uPaint * mix(1.0, l / uPaintL, 0.3), near);
  }`);
    };
    mat.customProgramCacheKey = () => `drive-even-${paint.join(",")}`;
    m.material = mat; m.userData.evened = true;
  });
}

/** The colour of a car's picture under each vertex (its uv), linear 0..1, or null when the picture can't be read. */
function vertexColoursFromMap(m: any): Float32Array | null {
  const img = m.material?.map?.image;
  const uv = m.geometry.attributes.uv;
  if (!img || !uv || typeof document === "undefined") return null;
  const W = Math.min(512, img.width || 512), H = Math.min(512, img.height || 512);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  if (!x) return null;
  try { x.drawImage(img, 0, 0, W, H); } catch { return null; }
  const px = x.getImageData(0, 0, W, H).data;
  const flip = m.material.map.flipY;
  const out = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i) % 1, v = uv.getY(i) % 1; if (u < 0) u += 1; if (v < 0) v += 1;
    const xx = Math.min(W - 1, Math.floor(u * W)), yy = Math.min(H - 1, Math.floor((flip ? 1 - v : v) * H));
    const k = (yy * W + xx) * 4;
    out[i * 3] = lin(px[k] / 255); out[i * 3 + 1] = lin(px[k + 1] / 255); out[i * 3 + 2] = lin(px[k + 2] / 255);
  }
  return out;
}

/**
 * The generated bodies are lumpy (the picture-to-3D model's surface): a few passes of Taubin smoothing (shrink-free)
 * over the PAINT only, welded across the seams, so the panels read smooth; the glass, lamps, grille, trim and the
 * edges where paint meets them stay where they are. Runs once per car on load (16k triangles: a few milliseconds).
 */
function relaxPaint(T: any, root: any, paint: [number, number, number], passes = 7) {
  const P = [lin(paint[0]), lin(paint[1]), lin(paint[2])];
  const pl = Math.max(1e-3, 0.2126 * P[0] + 0.7152 * P[1] + 0.0722 * P[2]);
  root.traverse((m: any) => {
    const g0 = m.isMesh && m.material?.map && m.material.name !== "plate" ? m.geometry : null;
    if (!g0 || m.userData.relaxed) return;
    const colA = vertexColoursFromMap(m);
    if (!colA) return;
    const g = g0.clone(); // shared with the cached file: never change that one
    const pos = g.attributes.position, n = pos.count;
    const col = { getX: (i: number) => colA[i * 3], getY: (i: number) => colA[i * 3 + 1], getZ: (i: number) => colA[i * 3 + 2] };
    // weld by position
    const key = new Map<string, number>(), wid = new Int32Array(n);
    const wp: number[] = [];
    const isPaint: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;
      let w = key.get(k);
      const r = col.getX(i), gg = col.getY(i), b = col.getZ(i), l = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      const paintish = l > 0.02 && Math.hypot(r / l - P[0] / pl, gg / l - P[1] / pl, b / l - P[2] / pl) < 0.2;
      if (w === undefined) { w = wp.length / 3; key.set(k, w); wp.push(x, y, z); isPaint.push(paintish); }
      else if (!paintish) isPaint[w] = false; // a seam with anything else on it stays put
      wid[i] = w;
    }
    const W = wp.length / 3;
    const nb: Set<number>[] = Array.from({ length: W }, () => new Set<number>());
    const idx: ArrayLike<number> = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) {
      const a = wid[idx[t]], b = wid[idx[t + 1]], c = wid[idx[t + 2]];
      nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
    }
    // a paint vertex next to a non-paint one is an edge (a lamp's rim, a window line): it stays too
    const free = isPaint.map((p, w) => p && Array.from(nb[w]).every((q) => isPaint[q]));
    let cur = Float32Array.from(wp);
    const step = (f: number) => {
      const nx = Float32Array.from(cur);
      for (let w = 0; w < W; w++) {
        if (!free[w] || !nb[w].size) continue;
        let sx = 0, sy = 0, sz = 0;
        nb[w].forEach((q) => { sx += cur[q * 3]; sy += cur[q * 3 + 1]; sz += cur[q * 3 + 2]; });
        const k = nb[w].size;
        nx[w * 3] += f * (sx / k - cur[w * 3]); nx[w * 3 + 1] += f * (sy / k - cur[w * 3 + 1]); nx[w * 3 + 2] += f * (sz / k - cur[w * 3 + 2]);
      }
      cur = nx;
    };
    for (let i = 0; i < passes; i++) { step(0.5); step(-0.53); }
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const w = wid[i]; out[i * 3] = cur[w * 3]; out[i * 3 + 1] = cur[w * 3 + 1]; out[i * 3 + 2] = cur[w * 3 + 2]; }
    g.setAttribute("position", new T.BufferAttribute(out, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    m.geometry = g; m.userData.relaxed = true;
  });
}

/** Keep only the wheel's own triangles: every corner within `r` of the hub's axle (the node's x axis, local metres). */
function trimWheel(T: any, node: any, r: number) {
  node.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(node.matrixWorld).invert();
  const v = new T.Vector3();
  node.traverse((m: any) => {
    if (!m.isMesh || m.userData.trimmed) return;
    const g = m.geometry, pos = g.attributes.position, n = pos.count;
    const toNode = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const ok = new Uint8Array(n);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(toNode); ok[i] = Math.hypot(v.y, v.z) <= r ? 1 : 0; }
    const idx: ArrayLike<number> = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
    const keep: number[] = [];
    let dropped = 0;
    for (let t = 0; t < idx.length; t += 3) {
      if (ok[idx[t]] && ok[idx[t + 1]] && ok[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]); else dropped++;
    }
    if (!dropped) return;
    const g2 = g.clone(); // shared with the cached file: never change that one
    g2.setIndex(keep);
    m.geometry = g2; m.userData.trimmed = true;
  });
}

/** Drop body triangles lying wholly under a wheel's arch (below the hub, the tyre's width, ±1.2 × r along) that reach
 *  down to the ground: the cut's leftovers there show as dark shards hanging under the sill. */
function clearArches(T: any, body: any, hubs: any[], r: number) {
  body.updateMatrixWorld(true);
  const v = new T.Vector3();
  body.traverse((m: any) => {
    if (!m.isMesh || m.name === "arch-liner" || m.userData.archCleared || m.material?.name === "arch_liner") return;
    const g = m.geometry, pos = g.attributes.position, n = pos.count;
    const inDrum = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      for (const h of hubs) if (Math.abs(v.x - h.x) < 0.3 && v.y < h.y && Math.abs(v.z - h.z) < r * 1.2) { inDrum[i] = v.y < 0.1 ? 2 : 1; break; }
    }
    const idx: ArrayLike<number> = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
    const keep: number[] = [];
    let dropped = 0;
    for (let t = 0; t < idx.length; t += 3) {
      // wholly under the arch, and reaching down to the ground (a dangling shard, never the sill or the bumper's edge)
      const a0 = inDrum[idx[t]], a1 = inDrum[idx[t + 1]], a2 = inDrum[idx[t + 2]];
      if (a0 && a1 && a2 && (a0 === 2 || a1 === 2 || a2 === 2)) dropped++; else keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    if (!dropped) return;
    const g2 = g.clone(); g2.setIndex(keep);
    m.geometry = g2; m.userData.archCleared = true;
  });
}
