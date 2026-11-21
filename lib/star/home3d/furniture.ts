/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE HOUSE FURNITURE — real pieces from the Kenney Furniture Kit (CC0), packed into one file
 * (public/star/home3d/furniture.glb, tools/home3d/make_furniture.py). Each piece is one object,
 * named by its kit name (bedDouble, kitchenFridge, shower, lampRoundFloor, rugRounded …), in
 * real metres, centred on x/z, feet at y = 0, its FRONT to -z (as the kit draws them).
 *
 * A room places a piece with put(name, x, z, facing): `facing` is the way its front looks
 * (0 = +z, towards where you came in; π/2 = +x), as smartObject.ts's yaw. A tint recolours
 * its materials by name (the kit's "carpet" is the fabric, "wood", "metal", "carpetWhite" the
 * sheets...). The pieces share geometry and materials (a tint is made once), so the room's
 * freezeStatic joins them into a few still draws. The footprint comes back for the walls of
 * the walk (`solid`).
 */
import type { Box2 } from "./roomBuild";

export interface PutOpts {
  /** Lift off the floor (on a counter, a shelf). */
  y?: number;
  /** Material name → colour. "*" = every material. */
  tint?: Record<string, string>;
  /** Push its footprint into the room's solids (default true for anything taller than 0.1 m). */
  solid?: boolean;
  /** Grow (or shrink) the footprint pushed (m). */
  pad?: number;
  /** Scale (1 = the kit's real size). Used for rugs and plants only (never a seat, bed or person-sized thing). */
  s?: number;
  /** A light piece's shade glows (the kit's lampshades: carpetWhite / "lamp"). */
  glow?: string;
  cast?: boolean;
}

export interface Furnisher {
  has: (name: string) => boolean;
  /** The piece's size [w, h, d] (m), unturned. */
  size: (name: string) => [number, number, number] | null;
  put: (name: string, x: number, z: number, facing?: number, o?: PutOpts) => Box2 | null;
}

/** Furniture placer for one room. `src` is the loaded furniture file's scene (null: nothing is placed). */
export function furnisher(THREE: any, parent: any, src: any | null, solids: Box2[], envTex: any, defaults: Record<string, string> = {}, contact?: (b: Box2) => void): Furnisher {
  const by = new Map<string, any>();
  for (const o of src?.children ?? []) by.set(o.name, o);
  const sizes = new Map<string, [number, number, number]>();
  const tints = new Map<string, any>();
  const sizeOf = (name: string): [number, number, number] | null => {
    if (sizes.has(name)) return sizes.get(name)!;
    const o = by.get(name);
    if (!o) return null;
    const b = new THREE.Box3().setFromObject(o);
    const s: [number, number, number] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    sizes.set(name, s);
    return s;
  };
  // one plain material per kit colour (the file's are physical, with ior/specular: heavier shaders, and one per piece)
  const matFor = (m: any, o: PutOpts): any => {
    const base = String(m.name ?? "").replace(/\.\d+$/, "");
    const want = o.tint?.[base] ?? o.tint?.["*"] ?? defaults[base];
    const glow = o.glow && /white|lamp|light/i.test(base) && !/metal/i.test(base) ? o.glow : null;
    const colour = want ?? "#" + m.color.getHexString();
    const key = `${base}|${colour}|${glow ?? ""}`;
    let t = tints.get(key);
    if (!t) {
      const glass = /glass/i.test(base), metal = /metal/i.test(base);
      t = new THREE.MeshStandardMaterial({
        color: colour, roughness: glass ? 0.05 : metal ? 0.35 : /carpet|plant/i.test(base) ? 0.95 : 0.6, metalness: metal ? 0.35 : 0,
        transparent: glass, opacity: glass ? 0.3 : 1, depthWrite: !glass, envMap: envTex, envMapIntensity: metal || glass ? 1 : 0.5,
      });
      if (glow) { t.emissive = new THREE.Color(glow); t.emissiveIntensity = 0.55; }
      tints.set(key, t);
    }
    return t;
  };
  return {
    has: (n) => by.has(n),
    size: sizeOf,
    put: (name, x, z, facing = 0, o = {}) => {
      const srcO = by.get(name);
      if (!srcO) return null;
      const c = srcO.clone(true);
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0);
      c.traverse((m: any) => {
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map((x: any) => matFor(x, o)) : matFor(m.material, o);
        m.castShadow = o.cast ?? true;
        m.receiveShadow = true;
      });
      const holder = new THREE.Group();
      holder.name = `f-${name}`;
      holder.add(c);
      const s = o.s ?? 1;
      holder.scale.setScalar(s);
      // the kit's front is -z: turned so it looks along `facing`
      holder.rotation.y = facing + Math.PI;
      holder.position.set(x, o.y ?? 0, z);
      // straight into the room, so freezeStatic (which joins per parent) joins it with everything of its material
      holder.updateMatrixWorld(true);
      const meshes: any[] = [];
      holder.traverse((m: any) => { if (m.isMesh) meshes.push(m); });
      for (const m of meshes) {
        m.matrix.copy(m.matrixWorld);
        m.matrix.decompose(m.position, m.quaternion, m.scale);
        m.parent?.remove(m);
        parent.add(m);
      }
      const sz = sizeOf(name)!;
      const w = sz[0] * s, d = sz[2] * s;
      const ca = Math.abs(Math.cos(facing)), sa = Math.abs(Math.sin(facing));
      const hx = (w * ca + d * sa) / 2 + (o.pad ?? 0), hz = (w * sa + d * ca) / 2 + (o.pad ?? 0);
      const box: Box2 = [x - hx, x + hx, z - hz, z + hz];
      if (o.solid ?? sz[1] * s > 0.1) solids.push(box);
      // its contact shade on the floor (baked-AO stand-in: furniture sits ON the floor, 0 ms)
      if (!o.y && sz[1] * s > 0.25) contact?.(box);
      return box;
    },
  };
}
