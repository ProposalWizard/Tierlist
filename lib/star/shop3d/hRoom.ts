/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D SHOP IN LOOK H (Settings → Look → "3D look: H"; Old keeps today's shop
 * exactly). Harry, 9 Oct 2026: "the room is dark and bare … warm practical
 * lights, shelving or displays with depth, a textured floor, ceiling detail and
 * some reflections."
 *
 *   floor     real herringbone parquet with its normal map, half-gloss
 *   walls     real dark wood planks on the panelling, warm plaster above
 *   ceiling   a coffered grid of beams with a warm cove in each bay
 *   lights    brass pendants over the counter, wall sconces, two warm fill
 *             lights (no shadows: cheap)
 *   displays  two lit wall units of shelves: boxed boots, folded shirts, balls
 *   reflections  once the room is built, the room itself is baked into the
 *             light the shiny things reflect (one PMREM, no per-frame cost)
 *
 * Maps: public/star/shop3d/h (≈180 KB, tools/shop3d/h_room.py, Poly Haven CC0).
 */
export interface ShopRoom { x: number; z: number; h: number }

export async function dressShopH(T: any, scene: any, renderer: any, room: ShopRoom, parts: { floor: any; wallM: any; panelM: any; tier: string }) {
  const an = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const load = (f: string, srgb: boolean, rx: number, ry: number) => new Promise<any>((res) => {
    new T.TextureLoader().load(`/star/shop3d/h/${f}`, (t: any) => {
      t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = an;
      res(t);
    }, undefined, () => res(null));
  });
  const [pq, pqN, pl, plN] = await Promise.all([
    load("parquet.webp", true, room.x * 2 / 2.2, room.z * 2 / 2.2), load("parquet-nrm.webp", false, room.x * 2 / 2.2, room.z * 2 / 2.2),
    load("planks.webp", true, 4, 1), load("planks-nrm.webp", false, 4, 1),
  ]);
  const made: any[] = [];
  const add = (o: any) => { scene.add(o); made.push(o); return o; };
  const M = (c: string, o: any = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o });
  const glow = (c: string, i = 2) => new T.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, cast = false) => {
    const me = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); me.receiveShadow = true; me.castShadow = cast;
    return add(me);
  };

  // ── floor and walls ──
  if (pq) {
    const fm = parts.floor.material;
    fm.map = pq; fm.normalMap = pqN; fm.normalScale = new T.Vector2(0.8, 0.8);
    fm.color.set("#b48a66"); fm.roughness = 0.36; fm.metalness = 0; fm.envMapIntensity = 1.3; fm.needsUpdate = true;
  }
  if (pl) { parts.panelM.map = pl; parts.panelM.normalMap = plN; parts.panelM.color.set("#a77e5c"); parts.panelM.roughness = 0.5; parts.panelM.needsUpdate = true; }
  parts.wallM.color.set("#5a4334"); parts.wallM.roughness = 0.88; parts.wallM.needsUpdate = true;

  // ── ceiling: coffers ──
  const beamM = M("#3a2a1f", { roughness: 0.55 });
  const nx = 4, nz = 5;
  for (let i = 1; i < nx; i++) box(0.1, 0.13, room.z * 2, beamM, -room.x + (i * room.x * 2) / nx, room.h - 0.1, 0);
  for (let k = 1; k < nz; k++) box(room.x * 2, 0.13, 0.1, beamM, 0, room.h - 0.1, -room.z + (k * room.z * 2) / nz);
  // a soft warm glow in each bay (painted light, costs nothing)
  const bayM = new T.MeshBasicMaterial({ color: new T.Color("#ffcf96").multiplyScalar(0.16), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const p = new T.Mesh(new T.PlaneGeometry((room.x * 2) / nx - 0.4, (room.z * 2) / nz - 0.4), bayM);
    p.rotation.x = Math.PI / 2;
    p.position.set(-room.x + ((i + 0.5) * room.x * 2) / nx, room.h - 0.05, -room.z + ((k + 0.5) * room.z * 2) / nz);
    add(p);
  }

  // ── practical lights: pendants over the counter, sconces on the walls ──
  const brass = M("#c79a4b", { roughness: 0.3, metalness: 0.85 });
  const bulb = glow("#ffd59a", 4);
  for (const x of [-2.4, 0, 2.4]) {
    box(0.015, 0.9, 0.015, brass, x, room.h - 0.45, -6.0);
    const shade = add(new T.Mesh(new T.ConeGeometry(0.26, 0.3, 24, 1, true), brass));
    shade.position.set(x, room.h - 1.0, -6.0); (shade.material as any).side = T.DoubleSide;
    const b = add(new T.Mesh(new T.SphereGeometry(0.075, 16, 10), bulb));
    b.position.set(x, room.h - 1.1, -6.0);
  }
  const sconce = (x: number, z: number, ry: number) => {
    const g = new T.Group();
    const plate = new T.Mesh(new T.BoxGeometry(0.12, 0.28, 0.04), brass);
    const cup = new T.Mesh(new T.CylinderGeometry(0.1, 0.06, 0.16, 16, 1, true), M("#f6e3c4", { emissive: "#ffc98a", emissiveIntensity: 1.6, side: T.DoubleSide }));
    cup.position.set(0, 0.12, 0.1);
    g.add(plate, cup);
    g.position.set(x, 2.3, z); g.rotation.y = ry;
    add(g);
    // its wash on the wall
    const wash = new T.Mesh(new T.PlaneGeometry(1.3, 1.6), new T.MeshBasicMaterial({ map: washTex(T), color: new T.Color("#ffc78a").multiplyScalar(0.38), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    wash.position.set(x, 2.4, z); wash.rotation.y = ry; wash.translateZ(0.03);
    add(wash);
  };
  for (const z of [-5.2, 3.6, 6.6]) sconce(-room.x + 0.06, z, Math.PI / 2);
  for (const z of [-5.2, 6.6]) sconce(room.x - 0.06, z, -Math.PI / 2);
  for (const x of [-4.4, 4.4]) sconce(x, -room.z + 0.06, 0);
  // two warm fills (no shadows) so the room isn't a cave between the spot pools
  if (parts.tier !== "low") {
    for (const [x, z] of [[-2, 4], [1.5, -4.5]]) { const l = new T.PointLight("#ffc98f", 9, 9, 1.6); l.position.set(x, room.h - 0.6, z); add(l); }
  }

  // ── wall units: shelves with depth, lit from under each shelf ──
  const unit = (x: number, z0: number, z1: number, face: number) => {
    const len = z1 - z0, zc = (z0 + z1) / 2, d = 0.48;
    const cx = x + face * d / 2;
    const wood = M("#4b3424", { roughness: 0.45, map: pl ?? null });
    box(d, 2.6, 0.06, wood, cx, 1.3, z0); box(d, 2.6, 0.06, wood, cx, 1.3, z1);
    box(0.04, 2.6, len, M("#21170f", { roughness: 0.8 }), x + face * 0.02, 1.3, zc);
    const items: [number, number][] = [];
    for (const y of [0.15, 0.75, 1.35, 1.95, 2.55]) {
      box(d, 0.05, len, wood, cx, y, zc, true);
      if (y < 2.5) {
        // a warm LED strip under the shelf above, and its pool on the shelf below
        box(0.02, 0.012, len - 0.1, glow("#ffd3a0", 3), x + face * (d - 0.06), y + 0.57, zc);
        items.push([y, zc]);
      }
    }
    const colours = ["#e8e2d6", "#1f2937", "#b91c1c", "#1d4ed8", "#f59e0b", "#15803d", "#f8fafc"];
    let c = 0;
    for (const [y, zc2] of items) {
      const n = Math.max(2, Math.floor(len / 0.42));
      for (let k = 0; k < n; k++) {
        const zz = zc2 - len / 2 + 0.28 + k * ((len - 0.56) / Math.max(1, n - 1));
        const row = Math.floor(y / 0.6);
        if (row % 3 === 0) { // boot boxes
          box(0.32, 0.14, 0.22, M(colours[c++ % colours.length], { roughness: 0.6 }), cx + face * 0.02, y + 0.1, zz, true);
          box(0.33, 0.04, 0.23, M("#111111", { roughness: 0.5 }), cx + face * 0.02, y + 0.19, zz);
        } else if (row % 3 === 1) { // folded shirts, a little stack
          const col = colours[(c++ + 2) % colours.length];
          for (let s = 0; s < 3; s++) box(0.3, 0.05, 0.3, M(col, { roughness: 0.85 }), cx + face * 0.02, y + 0.05 + s * 0.055, zz + (s - 1) * 0.01, true);
        } else { // footballs on little stands
          const ball = add(new T.Mesh(new T.SphereGeometry(0.11, 20, 14), M("#f4f4f2", { roughness: 0.35 })));
          ball.position.set(cx + face * 0.02, y + 0.16, zz); ball.castShadow = true;
          box(0.12, 0.04, 0.12, brass, cx + face * 0.02, y + 0.045, zz);
        }
      }
    }
  };
  unit(-room.x + 0.06, 3.3, 5.3, 1);
  unit(room.x - 0.06, -7.6, -5.0, -1);

  return {
    /** Once everything is in: bake the room into the light that shiny things reflect. */
    bakeReflections() {
      try {
        const pm = new T.PMREMGenerator(renderer);
        const rt = pm.fromScene(scene, 0.03, 0.1, 40);
        pm.dispose();
        scene.environment = rt.texture;
        scene.environmentIntensity = 0.55;
        made.push({ dispose: () => rt.dispose() });
      } catch (e) { console.error("shop reflections", e); }
    },
    dispose() { for (const o of made) { if (o.dispose) o.dispose(); else o.parent?.remove(o); } },
  };
}

let washT: any = null;
function washTex(T: any) {
  if (washT) return washT;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 40, 2, 32, 56, 60);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  washT = new T.CanvasTexture(c); washT.colorSpace = T.SRGBColorSpace;
  return washT;
}
