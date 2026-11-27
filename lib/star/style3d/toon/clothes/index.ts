/**
 * CLOTHES AS CLOTH on a Style A person (Harry, 20 Nov 2026: "The kits look not like fabric but painted on with
 * blobs"; the research and the proof pictures: docs/research/clothes-and-necks-2026-11-20.md).
 *
 *   dressCloth(T, p, kind)   after dressPerson3d: reads the colours dressPerson3d already set (kit, pattern, crest,
 *                            number, suit colours) from the body's own uniforms, so every caller's data (club kits,
 *                            nationKits.ts, people presets) drives the cloth with no new inputs.
 *
 * Kinds: "kit" (shirt with crew collar, shorts, socks; contrast sleeves as their own piece), "tracksuit" (training
 * jacket with stand collar and zip, track trousers, shoes), "press" (shirt with folded collar, trousers, lanyard,
 * shoes), "suit" (shirt + collar + tie, coat with lapels, trousers, shoes).
 *
 * The geometry is built ONCE per head file + proportions + kind (build.ts, a few tens of ms) and shared; each person
 * gets his own small material (colour slots). A dressed person is 4 draws: body, body ink, cloth, cloth ink.
 * A body the builder cannot dress (not Style A, or a file without the rest-pose joints) keeps the painted clothes,
 * and the reason goes to the console once (CLOTH_FALLBACKS).
 */
import type * as THREE from "three";
import type { Person3D } from "../../../people3d";
import { people3dOutline } from "../../../people3d";
import { buildClothes, rigOf, type GarmentSpec, type Built } from "./build";
import { OUTFITS, type ClothKind } from "./outfits";

export type { ClothKind } from "./outfits";
export { homeSetCloth, offPitchWear, type OffPitchWear } from "./casual";
type Three = typeof import("three");

/** Colours that replace an outfit's own (sRGB hex): off-pitch clothes at home (`./casual.ts`), your saved home set. */
export interface ClothColours { top?: string; trim?: string; inner?: string; trousers?: string; shoes?: string }
/** The house and garden's white balance for cloth (ClothOpts.whiteBalance). */
export const HOME_WB = 0.6;
export interface ClothOpts {
  colours?: ClothColours;
  /** 0..1: how much of a lamp's colour the cloth leaves out (a camera's white balance). A warm room turned a grey
   *  hoodie khaki and white trainers beige; the house and garden use 0.6. 0 (cut scenes): the light as it is. */
  whiteBalance?: number;
}

const CACHE = new Map<string, Built & { names: string[] }>();
/** Who kept the painted clothes, and why (read by tests and the bench). */
export const CLOTH_FALLBACKS: { who: string; why: string }[] = [];
/** Build timings, ms (first build of each head + kind). */
export const CLOTH_BUILD_MS: Record<string, number> = {};

const MAX = 6;
/** Beyond this distance (metres) the cloth's ink line is not drawn (the far-player cheaper version). */
export const CLOTH_INK_FAR = 7;

export function dressCloth(T: Three, p: Person3D, kind: ClothKind, who = "", opts: ClothOpts = {}): boolean {
  const fail = (why: string) => { if (CLOTH_FALLBACKS.length < 200) CLOTH_FALLBACKS.push({ who, why }); console.info(`[clothes] ${who || "person"} keeps painted clothes: ${why}`); return false; };
  // ?cloth=0 on any 3D page: the painted clothes, to compare (frame cost, before / after pictures)
  try { if (typeof location !== "undefined" && new URLSearchParams(location.search).get("cloth") === "0") return false; } catch { /* no page */ }
  if (!p.toon || !p.body.material || !(p.body.material as THREE.Material & { userData: { toon?: boolean } }).userData.toon) return fail("not a Style A body");
  const j = p.meta.joints;
  for (const n of ["neck", "Hips", "LeftArm", "LeftForeArm", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg"]) if (!j[n]) return fail(`no rest joint ${n}`);
  if ((p.body as THREE.SkinnedMesh & { userData: { cloth?: boolean } }).userData.cloth) return true;
  const u = p.u as Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const pat = u.uPattern?.value?.x ?? 0;
  const near = (a?: THREE.Color, b?: THREE.Color) => !!a && !!b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.05;
  const variant = kind === "kit" && Math.round(pat) === 4 ? "kit-sleeves" : kind === "gym" && Math.round(pat) === 4 ? "gym-sleeves" : kind === "suit" && (!u.uSuit?.value || near(u.uSuitTie?.value, u.uSuitShirt?.value)) ? "suit-open" : kind;
  const key = `${p.meta.file ?? p.toonHead}|${p.prop ?? "a"}|${p.body.geometry.getAttribute("position").count}|${variant}`;
  let built = CACHE.get(key);
  if (!built) {
    const t0 = performance.now();
    const specs: GarmentSpec[] = OUTFITS[kind].garments(p.meta, variant);
    try { built = { ...buildClothes(T, p.body, rigOf(T, p.body, j as Record<string, [number, number, number]>), specs), names: specs.map((g) => g.name) }; }
    catch (e) { return fail(`build failed: ${String(e)}`); }
    OUTFITS[kind].body?.(built.body, p.meta);
    CLOTH_BUILD_MS[key] = Math.round(performance.now() - t0);
    CACHE.set(key, built);
  }
  const slots = OUTFITS[kind].slots(u, variant, T.Color, p.meta);
  if (opts.colours) recolour(T, slots, built.names, kind, opts.colours);
  const mat = clothMaterial(T, slots, decalsFor(T, kind, u, p.meta, slots), opts.whiteBalance ?? 0);
  const cloth = new T.SkinnedMesh(built.cloth, mat);
  cloth.name = "Cloth"; cloth.frustumCulled = false; cloth.castShadow = p.body.castShadow;
  const ink = new T.SkinnedMesh(built.ink, people3dOutline(T, 0.0055 * 1.3));
  ink.name = "ClothInk"; ink.frustumCulled = false; ink.visible = p.outline.visible;
  p.body.parent!.add(cloth); p.body.parent!.add(ink);
  // far away the cloth's ink line is dropped (a draw and the cloth's triangles again; at that size the body's own
  // outline and the colour edge carry the shape). Decided while drawing, so it applies from the next frame.
  const inkOn = ink.visible, wp = new T.Vector3();
  const prevBR = cloth.onBeforeRender.bind(cloth);
  cloth.onBeforeRender = (r, sc, cam, g, m, gr) => { prevBR(r, sc, cam, g, m, gr); cloth.getWorldPosition(wp); ink.visible = inkOn && wp.distanceTo(cam.position) < CLOTH_INK_FAR; };
  cloth.bind(p.body.skeleton, p.body.bindMatrix); ink.bind(p.body.skeleton, p.body.bindMatrix);
  p.body.geometry = built.body; p.outline.geometry = built.body;
  (p.body as THREE.SkinnedMesh & { userData: { cloth?: boolean } }).userData.cloth = true;
  // the body's painted clothes are switched off: what is left of them is skin of his own even tone (never another
  // tone under a hem), boots stay boots under a kit, and the painted crest, number and name go
  const skin = u.uSkinTone?.value as THREE.Vector3 | undefined;
  const sk = skin ? new T.Color(skin.x, skin.y, skin.z) : new T.Color(0.5, 0.35, 0.25);
  for (const n of ["uShirt", "uShorts", "uSocks", "uTrim"]) if (u[n]) u[n].value = sk.clone();
  for (const n of ["uBadgeOn", "uNumOn", "uNameOn", "uSuit"]) if (u[n]) u[n].value = 0;
  if (u.uFrontNum) u.uFrontNum.value.w = 0;
  if (u.uPattern) u.uPattern.value.x = 0;
  if (u.uSleeve) u.uSleeve.value.w = 0;
  if (u.uSnood) u.uSnood.value.w = 0;
  const bm = p.body.material as THREE.Material;
  const bare = kind === "gym";
  const prev = bm.onBeforeCompile.bind(bm), prevKey = bm.customProgramCacheKey.bind(bm);
  bm.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    // bare calves (the gym's ankle socks): the old long sock's painted top edge, a ring under the knee, is skin too
    const calf = bare ? "if (r.y > uLines.z + 0.012 && r.y < uLines.y + 0.03 && abs(r.x) < 0.3) { c = uSkinAvg; diffuseColor.rgb = c; skin = 1.0; kit = 0.0; }\n  " : "";
    sh.fragmentShader = sh.fragmentShader.replace("float tnCollar = 0.0", "if (r.y > uLines.z + 0.012 && kit > 0.02) { c = mix(c, uSkinAvg, kit); diffuseColor.rgb = c; skin = min(1.0, skin + kit); kit = 0.0; }\n  " + calf + "float tnCollar = 0.0");
  };
  bm.customProgramCacheKey = () => `${prevKey()}-cloth${bare ? "-calf" : ""}`;
  bm.needsUpdate = true;
  return true;
}

/** An outfit's slots in other colours, by garment: the top (the outer piece), the suit's shirt under it, trousers,
 *  shoes. Hems and trims follow the new colour (a shade under it) unless a trim is given. */
function recolour(T: Three, slots: ClothSlot[], names: string[], kind: ClothKind, c: ClothColours) {
  const C = (h: string) => new T.Color(h);
  names.forEach((n, i) => {
    const s = slots[i];
    if (!s) return;
    const role = n === "trousers" ? "trousers" : n === "shoes" ? "shoes" : kind === "suit" && n === "shirt" ? "inner" : ["shorts", "socks", "sleeves"].includes(n) ? null : "top";
    const hexOf = role ? c[role as keyof ClothColours] : undefined;
    if (!hexOf) return;
    s.color = C(hexOf);
    if (role === "top") s.trim = c.trim ? C(c.trim) : C(hexOf).multiplyScalar(0.82);
    else if (role === "trousers") s.trim = C(hexOf).multiplyScalar(0.78);
    else if (role === "inner") s.trim = C(hexOf).multiplyScalar(0.86);
    if (s.trim2 && role === "inner") s.trim2 = C(hexOf);
  });
}

/** One garment slot's look (colours linear). */
export interface ClothSlot { color: THREE.Color; trim: THREE.Color; trim2?: THREE.Color; fabric: "poly" | "wool" | "cotton"; bands?: [number, number, number, number]; pattern?: { kind: 1 | 2; color: THREE.Color; width: number; centre: number } }
interface Decal { tex: THREE.Texture; slot: number; at: [number, number]; size: [number, number]; back?: boolean }

const CREST_CACHE = new Map<string, THREE.Texture>();
/** No browser (a test under node): a see-through 1x1 picture in place of any drawn decal, so dressing still works. */
const noCanvas = () => typeof document === "undefined";
let BLANK: THREE.Texture | null = null;
function blank(T: Three): THREE.Texture { if (!BLANK) { BLANK = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); BLANK.needsUpdate = true; } return BLANK; }
function crestOf(T: Three, a: THREE.Color, b: THREE.Color): THREE.Texture {
  if (noCanvas()) return blank(T);
  const key = `${a.getHexString()}${b.getHexString()}`;
  let t = CREST_CACHE.get(key);
  if (t) return t;
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const css = (k: THREE.Color) => `#${k.clone().convertLinearToSRGB().getHexString()}`;
  x.beginPath(); x.moveTo(14, 10); x.lineTo(114, 10); x.lineTo(114, 60); x.quadraticCurveTo(114, 100, 64, 120); x.quadraticCurveTo(14, 100, 14, 60); x.closePath();
  x.fillStyle = css(b); x.fill(); x.lineWidth = 8; x.strokeStyle = css(a); x.stroke();
  x.beginPath(); x.moveTo(40, 30); x.lineTo(88, 30); x.moveTo(40, 52); x.lineTo(88, 52); x.lineWidth = 8; x.stroke();
  t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  CREST_CACHE.set(key, t);
  return t;
}
let LANYARD: THREE.Texture | null = null;
function lanyard(T: Three): THREE.Texture {
  if (noCanvas()) return blank(T);
  if (LANYARD) return LANYARD;
  const c = document.createElement("canvas"); c.width = 256; c.height = 384;
  const x = c.getContext("2d")!;
  x.strokeStyle = "#1d3f8f"; x.lineWidth = 13; x.lineCap = "round";
  x.beginPath(); x.moveTo(20, 0); x.lineTo(118, 215); x.moveTo(236, 0); x.lineTo(138, 215); x.stroke();
  x.fillStyle = "#fafafa"; x.fillRect(73, 210, 110, 150); x.strokeStyle = "#9aa3ad"; x.lineWidth = 3; x.strokeRect(73, 210, 110, 150);
  x.fillStyle = "#1d3f8f"; x.fillRect(73, 210, 110, 40);
  x.fillStyle = "#fff"; x.font = "bold 27px Arial, sans-serif"; x.textAlign = "center"; x.fillText("PRESS", 128, 240);
  x.fillStyle = "#c9ced6"; x.fillRect(88, 265, 40, 50); x.fillStyle = "#6b7280"; x.fillRect(135, 272, 35, 7); x.fillRect(135, 287, 35, 7);
  LANYARD = new T.CanvasTexture(c); LANYARD.colorSpace = T.SRGBColorSpace; LANYARD.anisotropy = 4;
  return LANYARD;
}
const ZIP = new Map<string, THREE.Texture>();
function zip(T: Three, col: THREE.Color): THREE.Texture {
  if (noCanvas()) return blank(T);
  const k = col.getHexString(); let t = ZIP.get(k); if (t) return t;
  const c = document.createElement("canvas"); c.width = 32; c.height = 512;
  const x = c.getContext("2d")!; x.fillStyle = `#${col.clone().convertLinearToSRGB().getHexString()}`; x.fillRect(13, 0, 6, 512); x.fillRect(9, 6, 14, 30);
  t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; ZIP.set(k, t); return t;
}

/** A detail drawn in metres on the front (or back) of a garment, sharp at any size; cached by key. */
const DETAIL = new Map<string, THREE.Texture>();
function detail(T: Three, key: string, w: number, h: number, draw: (x: CanvasRenderingContext2D, X: (m: number) => number, Y: (m: number) => number, px: number) => void): THREE.Texture {
  if (noCanvas()) return blank(T);
  let t = DETAIL.get(key); if (t) return t;
  const px = 1024 / Math.max(w, h);
  const c = document.createElement("canvas"); c.width = Math.ceil(w * px); c.height = Math.ceil(h * px);
  const x = c.getContext("2d")!;
  draw(x, (m) => (m + w / 2) * px, (m) => (h / 2 - m) * px, px);
  t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; DETAIL.set(key, t); return t;
}
const hex = (c: THREE.Color, k = 1) => `#${c.clone().multiplyScalar(k).convertLinearToSRGB().getHexString()}`;

function decalsFor(T: Three, kind: ClothKind, u: Record<string, { value: any }>, meta: Person3D["meta"], slots: ClothSlot[]): Decal[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const sh = meta.joints.LeftArm, chestY = sh[1] - 0.09, hipsY = meta.joints.Hips[1];
  const collarY = (meta.kit as { collarY?: number }).collarY ?? meta.joints.neck[1] - 0.03, hem = hipsY - 0.025;
  const out: Decal[] = [];
  const crest = u.uBadgeOn?.value === 2 && u.uBadge?.value ? (u.uBadge.value as THREE.Texture) : crestOf(T, (u.uShirt?.value as THREE.Color) ?? new T.Color(0.5, 0, 0), (u.uTrim?.value as THREE.Color) ?? new T.Color(1, 1, 1));
  const dark = (i: number, k = 0.55) => hex(slots[i]?.color ?? new T.Color(0.1, 0.1, 0.1), k);
  // a button placket down the centre: a seam line and buttons (shirts, polos)
  const placket = (i: number, top: number, bottom: number, n: number) => {
    const h = top - bottom;
    return { tex: detail(T, `placket-${dark(i)}-${n}-${h.toFixed(3)}`, 0.04, h, (x, X, Y, px) => {
      x.strokeStyle = dark(i, 0.72); x.lineWidth = 0.002 * px; x.beginPath(); x.moveTo(X(-0.008), Y(h / 2)); x.lineTo(X(-0.008), Y(-h / 2)); x.moveTo(X(0.008), Y(h / 2)); x.lineTo(X(0.008), Y(-h / 2)); x.stroke();
      x.fillStyle = dark(i, 0.6); for (let k = 0; k < n; k++) { x.beginPath(); x.arc(X(0), Y(h / 2 - 0.02 - (k * (h - 0.03)) / Math.max(1, n - 1)), 0.0035 * px, 0, Math.PI * 2); x.fill(); }
    }), slot: i, at: [0, (top + bottom) / 2] as [number, number], size: [0.04, h] as [number, number] };
  };
  if (kind === "kit" || kind === "gym") {
    out.push({ tex: crest, slot: 0, at: [0.085, chestY], size: [0.075, 0.075] });
    if (u.uNumOn?.value && u.uNum?.value) out.push({ tex: u.uNum.value, slot: 0, at: [0, chestY - 0.04], size: [0.24, 0.24], back: true });
    // the gym's trainers: a tongue and crossed laces down the instep of each (the shoes are the last slot)
    if (kind === "gym") {
      const si = slots.length - 1, fx = Math.abs(meta.joints.LeftFoot?.[0] ?? 0.1), top = meta.kit.bootY + 0.004;
      const tongue = dark(si, 0.78), lace = slots[si] && slots[si].color.r + slots[si].color.g + slots[si].color.b > 1.8 ? "#8d9096" : "#f2f1ec";
      const lh = 0.055, lw = 0.042;
      const laces = detail(T, `laces-${tongue}-${lace}`, lw, lh, (x, X, Y, px) => {
        x.fillStyle = tongue; x.beginPath(); x.roundRect(X(-lw * 0.32), Y(lh / 2), lw * 0.64 * px, lh * px, 0.006 * px); x.fill();
        x.strokeStyle = lace; x.lineWidth = 0.0035 * px; x.lineCap = "round";
        for (let k = 0; k < 4; k++) { const y = lh / 2 - 0.009 - k * 0.012; x.beginPath(); x.moveTo(X(-lw * 0.3), Y(y)); x.lineTo(X(lw * 0.3), Y(y - 0.006)); x.moveTo(X(lw * 0.3), Y(y)); x.lineTo(X(-lw * 0.3), Y(y - 0.006)); x.stroke(); }
      });
      for (const sx of [-1, 1]) out.push({ tex: laces, slot: si, at: [sx * fx, top - lh / 2 - 0.004], size: [lw, lh] });
    }
  } else if (kind === "fan") {
    out.push({ tex: crest, slot: 0, at: [0.085, chestY], size: [0.075, 0.075] });
  } else if (kind === "tracksuit") {
    out.push({ tex: crest, slot: 0, at: [0.085, chestY], size: [0.065, 0.065] });
    out.push({ tex: zip(T, (u.uTrim?.value as THREE.Color) ?? new T.Color(1, 1, 1)), slot: 0, at: [0, (collarY + hem) / 2], size: [0.03, collarY - hem] });
  } else if (kind === "press") {
    out.push({ tex: lanyard(T), slot: 0, at: [0, chestY - 0.035], size: [0.17, 0.26] });
    out.push(placket(0, collarY - 0.03, hipsY + 0.03, 6));
  } else if (kind === "shirt") {
    out.push(placket(0, collarY - 0.03, hipsY + 0.03, 6));
  } else if (kind === "polo") {
    out.push({ tex: crest, slot: 0, at: [0.085, chestY], size: [0.06, 0.06] });
    out.push(placket(0, collarY - 0.02, collarY - 0.13, 3));
  } else if (kind === "suit") {
    // the coat's fronts: the closing line below the V, two buttons, two pocket flaps, a breast pocket
    const top = collarY - 0.25, bot = hipsY - 0.13, h = top - bot;
    out.push({ tex: detail(T, `coat-${dark(1)}-${h.toFixed(3)}`, 0.46, h, (x, X, Y, px) => {
      x.strokeStyle = dark(1, 2.2); x.lineWidth = 0.003 * px;
      x.beginPath(); x.moveTo(X(0.004), Y(h / 2)); x.lineTo(X(0.004), Y(-h / 2)); x.stroke();
      x.fillStyle = dark(1, 0.4); for (const yy of [h / 2 - 0.05, h / 2 - 0.12]) { x.beginPath(); x.arc(X(0.012), Y(yy), 0.006 * px, 0, Math.PI * 2); x.fill(); }
      x.lineWidth = 0.0025 * px; x.strokeStyle = dark(1, 0.55);
      for (const sx of [-1, 1]) x.strokeRect(X(sx * 0.13 - 0.05), Y(-h / 2 + 0.07), 0.1 * px, 0.022 * px);
      x.strokeRect(X(0.085), Y(h / 2 + 0.06), 0.07 * px, 0.012 * px);
    }), slot: 1, at: [0, (top + bot) / 2], size: [0.46, h] });
  } else if (kind === "hoodie") {
    // a kangaroo pocket on the belly and two drawstrings from the neck
    const top = collarY - 0.01, bot = hipsY - 0.03, h = top - bot;
    out.push({ tex: detail(T, `hoodie-${dark(0)}-${h.toFixed(3)}`, 0.36, h, (x, X, Y, px) => {
      x.strokeStyle = dark(0, 0.62); x.lineWidth = 0.003 * px;
      x.beginPath(); x.moveTo(X(-0.11), Y(-h / 2 + 0.02)); x.lineTo(X(-0.08), Y(-h / 2 + 0.15)); x.lineTo(X(0.08), Y(-h / 2 + 0.15)); x.lineTo(X(0.11), Y(-h / 2 + 0.02)); x.stroke();
      x.strokeStyle = "#e9e6df"; x.lineWidth = 0.004 * px; x.lineCap = "round";
      for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(X(sx * 0.03), Y(h / 2)); x.lineTo(X(sx * 0.035), Y(h / 2 - 0.13)); x.stroke(); }
    }), slot: 0, at: [0, (top + bot) / 2], size: [0.36, h] });
  }
  return out;
}

/** The cloth's material: toon bands per fabric, a sheen, crisp trim bands, stripes/hoops, collars, a tie, decals. */
export function clothMaterial(T: Three, slots: ClothSlot[], decals: Decal[], whiteBalance = 0): THREE.Material {
  const gm = new T.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, T.RedFormat);
  gm.minFilter = gm.magFilter = T.NearestFilter; gm.needsUpdate = true;
  const m = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: gm, side: T.DoubleSide });
  const pad = <X>(a: X[], f: () => X) => Array.from({ length: MAX }, (_, i) => a[i] ?? f());
  const D = pad(decals.slice(0, 4), () => null as Decal | null);
  const blank = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  const un = {
    uCol: { value: pad(slots.map((s) => s.color), () => new T.Color()) },
    uTrim: { value: pad(slots.map((s) => s.trim), () => new T.Color()) },
    uTrim2: { value: pad(slots.map((s) => s.trim2 ?? s.trim), () => new T.Color()) },
    uFab: { value: pad(slots.map((s) => (s.fabric === "poly" ? 0 : s.fabric === "wool" ? 1 : 2)), () => 2) },
    uBands: { value: pad(slots.map((s) => new T.Vector4(...(s.bands ?? [0, 0, 0, 0]))), () => new T.Vector4()) },
    uPat: { value: pad(slots.map((s) => new T.Vector4(s.pattern?.kind ?? 0, s.pattern?.width ?? 0.05, s.pattern?.centre ?? 0, 0)), () => new T.Vector4()) },
    uPatC: { value: pad(slots.map((s) => s.pattern?.color ?? s.color), () => new T.Color()) },
    uD0: { value: D[0]?.tex ?? blank }, uD1: { value: D[1]?.tex ?? blank }, uD2: { value: D[2]?.tex ?? blank }, uD3: { value: D[3]?.tex ?? blank },
    uDB: { value: D.slice(0, 4).map((d) => new T.Vector4(d?.at[0] ?? 0, d?.at[1] ?? 0, d?.size[0] ?? 0, d?.size[1] ?? 0)) },
    uDS: { value: D.slice(0, 4).map((d) => new T.Vector2(d ? d.slot : -1, d?.back ? -1 : 1)) },
    uWB: { value: whiteBalance },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, un);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aRest; attribute vec4 aBand; attribute float aLip; attribute float aGarment; varying vec3 vRest; varying vec4 vBand; varying float vLip; varying float vGar; varying vec3 vNrmV;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest; vBand = aBand; vLip = aLip; vGar = aGarment;")
      .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\nvNrmV = normalize(transformedNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <lights_toon_pars_fragment>", (T.ShaderChunk as Record<string, string>).lights_toon_pars_fragment
        .replace("* directLight.color;", "* tnWB(directLight.color);")
        .replace("reflectedLight.indirectDiffuse += irradiance *", "reflectedLight.indirectDiffuse += tnWB(irradiance) *"))
      .replace("#include <common>", `#include <common>
uniform float uWB;
vec3 tnWB(vec3 c) { return mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uWB); }
varying vec3 vRest; varying vec4 vBand; varying float vLip; varying float vGar; varying vec3 vNrmV;
uniform vec3 uCol[${MAX}], uTrim[${MAX}], uTrim2[${MAX}], uPatC[${MAX}]; uniform float uFab[${MAX}]; uniform vec4 uBands[${MAX}], uPat[${MAX}];
uniform sampler2D uD0, uD1, uD2, uD3; uniform vec4 uDB[4]; uniform vec2 uDS[4];
vec4 tnDecal(sampler2D t, vec4 b, vec2 s, int g) {
  if (b.z <= 0.0 || int(s.x + 0.5) != g) return vec4(0.0);
  vec2 q = (vRest.xy - b.xy) / b.zw + 0.5;
  if (s.y < 0.0) q.x = 1.0 - q.x;
  if (any(lessThan(q, vec2(0.0))) || any(greaterThan(q, vec2(1.0))) || vRest.z * s.y < 0.0) return vec4(0.0);
  return texture2D(t, q);
}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
int g = int(vGar + 0.5);
float tnFab = uFab[g];
{
  vec3 c = uCol[g];
  vec4 bands = uBands[g], pat = uPat[g];
  float aaw = 0.0015;
  float collar = step(0.25, vBand.x);
  float bn = bands.x > 0.0 ? smoothstep(-bands.x - aaw, -bands.x + aaw, vBand.x) : 0.0;
  float bs = bands.y > 0.0 ? smoothstep(-bands.y - aaw, -bands.y + aaw, vBand.y) : 0.0;
  float bh = bands.z > 0.0 ? smoothstep(-bands.z - aaw, -bands.z + aaw, vBand.z) : 0.0;
  float bl = bands.w > 0.0 ? smoothstep(-bands.w - aaw, -bands.w + aaw, vBand.w) : 0.0;
  if (pat.x > 0.5) {
    float u = (pat.x < 1.5 ? vRest.x : vRest.y - pat.z) / (2.0 * pat.y) + (pat.x < 1.5 ? 0.25 : 0.0);
    float w = fwidth(u) * 0.75 + 1e-4;
    c = mix(c, uPatC[g], smoothstep(0.25 - w, 0.25 + w, abs(fract(u) - 0.5)));
  }
  c = mix(c, uTrim[g], max(max(max(bn, bs), max(bh, bl)), collar));
  c = mix(c, uTrim2[g], step(0.25, vBand.w));
  if (tnFab > 0.5 && tnFab < 1.5) {
    float rows = vRest.y * 260.0, cols = (vRest.x + vRest.z) * 220.0;
    float k = abs(fract(cols + abs(fract(rows) - 0.5)) - 0.5);
    c *= 1.0 - 0.035 * smoothstep(0.15, 0.35, k) * (1.0 - smoothstep(0.25, 0.6, fwidth(rows) + fwidth(cols)));
  }
  c *= mix(1.0, 0.62, smoothstep(0.6, 1.0, vLip));
  vec4 d0 = tnDecal(uD0, uDB[0], uDS[0], g); c = mix(c, d0.rgb, d0.a);
  vec4 d1 = tnDecal(uD1, uDB[1], uDS[1], g); c = mix(c, d1.rgb, d1.a);
  vec4 d2 = tnDecal(uD2, uDB[2], uDS[2], g); c = mix(c, d2.rgb, d2.a);
  vec4 d3 = tnDecal(uD3, uDB[3], uDS[3], g); c = mix(c, d3.rgb, d3.a);
  diffuseColor.rgb = c;
}`)
      .replace("#include <opaque_fragment>", `{
  vec3 V = normalize(vViewPosition);
  float fr = 1.0 - abs(dot(normalize(vNrmV), V));
  float sheen = tnFab < 0.5 ? smoothstep(0.62, 0.78, fr) * 0.22 : tnFab < 1.5 ? smoothstep(0.35, 1.0, fr) * 0.12 : smoothstep(0.7, 0.9, fr) * 0.06;
  outgoingLight += diffuseColor.rgb * sheen + vec3(sheen * 0.25);
}
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "toon-cloth-v3";
  return m;
}
