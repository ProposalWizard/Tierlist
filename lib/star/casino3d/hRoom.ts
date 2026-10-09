/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D CASINO IN ITS NEW LOOK (Settings → Look → "Casino look: New"; Old
 * keeps the room exactly as it was). Harry, 9 Oct 2026, iPhone screenshots
 * scored the room about 3/10. The shop's golden-hour look H, brought here:
 *
 *   light      a warm key light from above with soft shadows (drawn once:
 *              nothing that casts moves), the chandeliers' warm fills, wall
 *              sconces with a wash, and a contact shadow under every stool
 *   chandeliers  two tiers of brass with candle bulbs (bright enough for the
 *              bloom), real crystal drops that catch the room's reflection,
 *              and a soft halo that fades out as the camera comes near (no
 *              more bulb filling the screen)
 *   walls      a woven red damask (its own normal map) above gold-railed
 *              wood panels with a grain relief; a coffered ceiling
 *   carpet     the casino pattern over a velvet pile (normal map)
 *   plants     a leafy plant in each pot (was one faceted ball)
 *   reflections  once built, the room is baked into the light the gold,
 *              glass and crystal reflect (one PMREM, no cost per frame)
 * Maps: public/star/casino3d/h (≈60 KB, tools/casino3d/h_room.py, Poly Haven
 * CC0) and the shop's planks-nrm.webp.
 */
import { haloFade } from "./camera";

export interface CasinoHParts {
  room: { x: number; z: number; h: number };
  floorM: any;
  paperM: any;
  panelMs: any[];
  tier: "low" | "medium" | "high";
  /** Where the chandeliers hang ([x, z]); the new look hangs them here. */
  chandeliers: [number, number][];
  /** The pots by the doors ([x, z, top y]). */
  plants: [number, number, number][];
  /** Every stool's floor spot (world [x, z]) for its contact shadow. */
  stools: [number, number][];
  blobTex: any;
}

export interface CasinoH {
  /** The chandeliers' centres (for the camera's keep-out). */
  lamps: [number, number, number][];
  /** Things that must not be merged (they change every frame). */
  keep: any[];
  /** Fade each halo by how near the camera is. */
  update(camera: any): void;
  bakeReflections(): void;
  dispose(): void;
}

/** Height of a chandelier's centre in the new look (the old ones hung at h − 1.05 at their drops). */
export const LAMP_Y = (h: number) => h - 0.85;

export async function dressCasinoH(T: any, scene: any, renderer: any, p: CasinoHParts): Promise<CasinoH> {
  const an = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const load = (url: string, srgb: boolean, rx: number, ry: number) => new Promise<any>((res) => {
    new T.TextureLoader().load(url, (t: any) => {
      t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = an;
      res(t);
    }, undefined, () => res(null));
  });
  const { room } = p;
  const [wallN, pileN, plankN] = await Promise.all([
    load("/star/casino3d/h/wall-nrm.webp", false, 1, 1), // the walls' uvs are in 1.1 m repeats (scene.ts)
    load("/star/casino3d/h/pile-nrm.webp", false, (room.x * 2) / 0.45, (room.z * 2) / 0.45),
    load("/star/shop3d/h/planks-nrm.webp", false, 5, 1),
  ]);
  const made: any[] = [];
  const add = (o: any) => { scene.add(o); made.push(o); return o; };
  const M = (c: string, o: any = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o });
  const brass = M("#c99a48", { roughness: 0.26, metalness: 0.9 });

  // ── surfaces ──
  if (pileN) { p.floorM.normalMap = pileN; p.floorM.normalScale = new T.Vector2(0.7, 0.7); p.floorM.roughness = 0.97; p.floorM.needsUpdate = true; }
  if (wallN) { p.paperM.normalMap = wallN; p.paperM.normalScale = new T.Vector2(1.1, 1.1); p.paperM.color.set("#7a1a2c"); p.paperM.roughness = 0.72; p.paperM.needsUpdate = true; }
  if (plankN) for (const pm of p.panelMs) { pm.normalMap = plankN; pm.normalScale = new T.Vector2(0.6, 0.6); pm.roughness = 0.42; pm.needsUpdate = true; }

  // ── ceiling: dark coffers with a warm glow in each bay ──
  const beamM = M("#2a1410", { roughness: 0.5 });
  const nx = 5, nz = 6;
  const beam = (w: number, d: number, x: number, z: number) => { const b = add(new T.Mesh(new T.BoxGeometry(w, 0.16, d), beamM)); b.position.set(x, room.h - 0.08, z); };
  for (let i = 1; i < nx; i++) beam(0.12, room.z * 2, -room.x + (i * room.x * 2) / nx, 0);
  for (let k = 1; k < nz; k++) beam(room.x * 2, 0.12, 0, -room.z + (k * room.z * 2) / nz);
  const bayM = new T.MeshBasicMaterial({ color: new T.Color("#ffb878").multiplyScalar(0.13), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const q = add(new T.Mesh(new T.PlaneGeometry((room.x * 2) / nx - 0.4, (room.z * 2) / nz - 0.4), bayM));
    q.rotation.x = Math.PI / 2;
    q.position.set(-room.x + ((i + 0.5) * room.x * 2) / nx, room.h - 0.02, -room.z + ((k + 0.5) * room.z * 2) / nz);
  }

  // ── the key light: warm, from high up, soft shadows (drawn once) ──
  const key = new T.DirectionalLight("#ffc890", 3.2);
  key.position.set(2.5, 11, 5);
  key.target.position.set(0, 0, -0.5);
  const shadows = p.tier !== "low" && renderer.shadowMap.enabled;
  if (shadows) {
    key.castShadow = true;
    const s = p.tier === "high" ? 2048 : 1024;
    key.shadow.mapSize.set(s, s);
    const c = key.shadow.camera;
    c.left = -room.x - 1; c.right = room.x + 1; c.top = room.z + 1; c.bottom = -room.z - 1; c.near = 2; c.far = 22;
    key.shadow.radius = 5; key.shadow.blurSamples = 12;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  }
  add(key); add(key.target);

  // ── contact shadows under every stool ──
  const contactM = new T.MeshBasicMaterial({ map: p.blobTex, transparent: true, depthWrite: false, opacity: 1, color: "#000000" });
  for (const [x, z] of p.stools) {
    const c = add(new T.Mesh(new T.PlaneGeometry(0.7, 0.7), contactM));
    c.rotation.x = -Math.PI / 2; c.position.set(x, 0.014, z); c.renderOrder = 1;
  }

  // ── chandeliers: brass tiers, candle bulbs, crystal drops, a halo ──
  const bulbM = new T.MeshStandardMaterial({ color: "#000000", emissive: "#ffd9a0", emissiveIntensity: 7 });
  const crystalM = new T.MeshStandardMaterial({ color: "#fff6ea", roughness: 0.04, metalness: 1, envMapIntensity: 2.2 });
  const dropG = new T.OctahedronGeometry(0.032, 0); dropG.scale(1, 1.9, 1);
  const beadG = new T.IcosahedronGeometry(0.018, 0);
  const halos: any[] = [];
  const haloTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,226,170,0.9)"); gr.addColorStop(0.18, "rgba(255,200,130,0.42)"); gr.addColorStop(0.5, "rgba(255,170,90,0.10)"); gr.addColorStop(1, "rgba(255,160,80,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const lamps: [number, number, number][] = [];
  const cy = LAMP_Y(room.h);
  for (const [x, z] of p.chandeliers) {
    const g = new T.Group(); g.position.set(x, cy, z); g.userData.noShadow = true;
    lamps.push([x, cy, z]);
    // the rod and the canopy
    const rod = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, room.h - cy, 8), brass); rod.position.y = (room.h - cy) / 2; g.add(rod);
    const can = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 0.06, 20), brass); can.position.y = room.h - cy - 0.03; g.add(can);
    // two tiers of arms, each arm a candle bulb in a cup
    for (const [r, y, n] of [[0.46, -0.05, 10], [0.26, 0.2, 6]] as [number, number, number][]) {
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.016, 8, 40), brass); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (r < 0.3 ? 0.3 : 0);
        const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
        const cup = new T.Mesh(new T.CylinderGeometry(0.035, 0.022, 0.04, 10), brass); cup.position.set(cx, y + 0.03, cz); g.add(cup);
        const bulb = new T.Mesh(new T.CylinderGeometry(0.012, 0.014, 0.07, 8), bulbM); bulb.position.set(cx, y + 0.085, cz); g.add(bulb);
        const tip = new T.Mesh(new T.SphereGeometry(0.016, 10, 8), bulbM); tip.scale.y = 1.7; tip.position.set(cx, y + 0.13, cz); g.add(tip);
        // a string of beads and a drop hanging under each arm
        for (let b = 1; b <= 3; b++) { const bd = new T.Mesh(beadG, crystalM); bd.position.set(cx, y - 0.04 - b * 0.04, cz); g.add(bd); }
        const dr = new T.Mesh(dropG, crystalM); dr.position.set(cx, y - 0.23, cz); g.add(dr);
      }
    }
    // swags of beads between the arms of the lower tier, and a big drop in the middle
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const sag = 0.07 * Math.abs(Math.sin(a * 5));
      const bd = new T.Mesh(beadG, crystalM); bd.position.set(Math.cos(a) * 0.4, -0.12 - sag, Math.sin(a) * 0.4); g.add(bd);
    }
    const big = new T.Mesh(new T.OctahedronGeometry(0.07, 0), crystalM); big.scale.y = 1.8; big.position.y = -0.36; g.add(big);
    g.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    add(g);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: "#ffffff", transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }));
    halo.scale.set(2.2, 2.2, 1); halo.position.set(x, cy - 0.02, z); halo.renderOrder = 3;
    add(halo); halos.push(halo);
  }

  // ── wall sconces with their wash ──
  const washT = (() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 40, 2, 32, 56, 60);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  })();
  const washM = new T.MeshBasicMaterial({ map: washT, color: new T.Color("#ffbf80").multiplyScalar(0.42), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const shadeM = M("#f4dcb8", { emissive: "#ffc27a", emissiveIntensity: 1.8, side: T.DoubleSide });
  const sconce = (x: number, z: number, ry: number) => {
    const g = new T.Group();
    const plate = new T.Mesh(new T.BoxGeometry(0.1, 0.24, 0.04), brass);
    const cup = new T.Mesh(new T.CylinderGeometry(0.1, 0.06, 0.15, 16, 1, true), shadeM); cup.position.set(0, 0.1, 0.1);
    g.add(plate, cup); g.position.set(x, 2.25, z); g.rotation.y = ry; g.userData.noShadow = true;
    add(g);
    const w = new T.Mesh(new T.PlaneGeometry(1.2, 1.6), washM); w.position.set(x, 2.4, z); w.rotation.y = ry; w.translateZ(0.035);
    add(w);
  };
  for (const z of [-2, 2]) { sconce(-room.x + 0.07, z, Math.PI / 2); sconce(room.x - 0.07, z, -Math.PI / 2); }
  for (const x of [-3.2, 1.9]) sconce(x, -room.z + 0.07, 0);
  if (p.tier !== "low") {
    for (const [x, z] of [[-4.5, 3.5], [4.5, -4.5]]) { const l = new T.PointLight("#ffbe85", 6, 8, 1.6); l.position.set(x, room.h - 0.6, z); add(l); }
  }

  // ── plants: a leafy plant in each pot ──
  const leafG = new T.SphereGeometry(1, 10, 6); leafG.scale(0.07, 0.012, 0.32); leafG.translate(0, 0, 0.3);
  const leafMs = ["#2f6b2e", "#3c7d34", "#275a27"].map((c) => M(c, { roughness: 0.55, side: T.DoubleSide }));
  const stemM = M("#4a3a22", { roughness: 0.8 });
  for (const [x, z, y0] of p.plants) {
    const g = new T.Group(); g.position.set(x, y0, z);
    const soil = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.02, 20), M("#2a1c12", { roughness: 1 })); soil.position.y = 0.005; g.add(soil);
    let s = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5453;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 * 3.1 + rnd() * 0.5;
      const h = 0.15 + rnd() * 0.75;
      const stem = new T.Mesh(new T.CylinderGeometry(0.006, 0.009, h, 5), stemM);
      stem.position.set(Math.cos(a) * 0.03, h / 2, Math.sin(a) * 0.03); g.add(stem);
      const leaf = new T.Mesh(leafG, leafMs[k % 3]);
      leaf.position.set(Math.cos(a) * 0.04, h, Math.sin(a) * 0.04);
      leaf.rotation.set(0, -a + Math.PI / 2, 0);
      leaf.rotateX(-0.15 - rnd() * 0.85); // the blade reaches up and out
      leaf.scale.setScalar(0.75 + rnd() * 0.5);
      g.add(leaf);
    }
    add(g);
  }

  return {
    lamps,
    keep: halos,
    update(camera: any) {
      for (const h of halos) {
        const d = camera.position.distanceTo(h.position);
        h.material.opacity = 0.75 * haloFade(d);
        h.visible = h.material.opacity > 0.01;
      }
    },
    bakeReflections() {
      try {
        const vis = halos.map((h) => h.visible);
        halos.forEach((h) => { h.visible = false; });
        const pm = new T.PMREMGenerator(renderer);
        const rt = pm.fromScene(scene, 0.03, 0.1, 40);
        pm.dispose();
        halos.forEach((h, i) => { h.visible = vis[i]; });
        scene.environment = rt.texture;
        scene.environmentIntensity = 0.6;
        made.push({ dispose: () => rt.dispose() });
      } catch (e) { console.error("casino reflections", e); }
    },
    dispose() { for (const o of made) { if (o.dispose) o.dispose(); else o.parent?.remove(o); } },
  };
}
