#!/usr/bin/env node
/**
 * Writes lib/star/assets3dManifest.ts: the list of every 3D / Blender asset
 * the site ships, sorted into folders by kind, for the 3D Test Area's asset
 * store (/star-3d-area-dev). Run it after adding or removing a render:
 *
 *   node scripts/assets3d-manifest.mjs
 *
 * tests/star/assets3d.mts fails when the list no longer matches the disk, so
 * a forgotten re-run is caught by the suite rather than by Harry.
 */
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** What goes in each folder: a public/ directory and a file-name test. */
export const FOLDERS = [
  { id: "icons", title: "Top-bar icons", kind: "image", dir: "icons3d", test: (f) => f.endsWith(".png"), made: "tools/blender-shop/scripts/icons3d.py", note: "Sit above the top bars as a 3D overlay. 256 px, transparent." },
  { id: "signing", title: "Signing scene (live 3D)", kind: "model", dir: "star/signing3d", test: (f) => f.endsWith(".glb"), made: "tools/signing3d/build_assets.py", note: "Loaded by three.js in the live signing scene: the rigged body with four hair styles, its sitting / standing clips, and the Star Pass aviators. CC0 Quaternius (LICENSE.txt in the same folder)." },
  { id: "backdrops", title: "Generated backdrops", kind: "image", dir: "star/signing3d", test: (f) => f.startsWith("room-"), made: "Image generator (not Blender)", note: "Generated pictures used as a style and light reference, or behind a scene." },
  { id: "boots", title: "Shop: boots", kind: "image", dir: "shop", test: (f) => f.startsWith("boot-"), made: "tools/blender-shop/scripts/boot.py", note: "7 boots × 5 levels." },
  { id: "cars", title: "Shop: cars and bikes", kind: "image", dir: "shop", test: (f) => /^(car-|suv-|classic-|bike-)/.test(f), made: "tools/blender-shop/scripts/{car,cars,bikes}.py", note: "" },
  { id: "homes", title: "Shop: homes", kind: "image", dir: "shop", test: (f) => /^(flat-|penthouse-|house-|estate-|stable-)/.test(f), made: "tools/blender-shop/scripts/{house,homes_a,homes_b,homes_c}.py", note: "" },
  { id: "holiday", title: "Shop: holiday", kind: "image", dir: "shop", test: (f) => /^(jet-|villa-|island-)/.test(f), made: "tools/blender-shop/scripts/{jets,homes_c}.py", note: "" },
  { id: "drip", title: "Shop: drip", kind: "image", dir: "shop", test: (f) => /^(suit-|silver-|gold-|rolex-|diamond-|art-)/.test(f), made: "tools/blender-shop/scripts/drip.py", note: "" },
  { id: "gadgets", title: "Shop: gadgets", kind: "image", dir: "shop", test: (f) => /^(phone-|console-|headphones-|music-|tablet-|smartwatch-|tv-|gaming-pc-)/.test(f), made: "tools/blender-shop/scripts/gadgets.py", note: "" },
  { id: "store", title: "Store: coins, boosts, accessories", kind: "image", dir: "shop/store", test: (f) => f.endsWith(".webp"), made: "tools/blender-shop/scripts/store.py", note: "" },
  { id: "footballer", title: "Blender footballer: stills", kind: "image", dir: "star/blender", test: (f) => /\.(jpg|webp)$/.test(f), deep: true, made: "tools/blender-footballer/scripts", note: "Each pose is a layer pack (base, light, kit masks, crest, number) the browser recolours into any club." },
  { id: "clips", title: "Blender footballer: clips", kind: "video", dir: "star/blender/clips", test: (f) => f.endsWith(".mp4"), made: "tools/blender-footballer/scripts", note: "Rendered in Chelsea's kit; a .webm copy and a .jpg poster sit next to each." },
  { id: "match", title: "Match view proposal", kind: "image", dir: "star/area3d", test: (f) => f.startsWith("match-"), made: "tools/blender-signing/match_look.py", note: "Blender players seen from the 2D match's own camera, and a before/after still. A proposal (Harry P2-74)." },
  { id: "onebody", title: "The one body: player and manager with fingers", kind: "model", dir: "star/onebody", test: (f) => f.endsWith(".glb"), made: "scripts/people3d/build_onebody.py (from star/people3d)", note: "The same people with an ordinary waist and 15 finger bones a hand, for every 3D scene (Settings → Look → 3D people: New). 16-bit positions, ~0.5 MB each (packed by scripts/perf3d/shrink-models.mjs). Clips: star/people3d/anims.glb." },
  { id: "people3d", title: "3D people: player and manager (live in the browser)", kind: "model", dir: "star/people3d", test: (f) => f.endsWith(".glb"), made: "scripts/people3d/build_people3d.py (from the approved Higgsfield characters)", note: "The new 3D signing's and the 3D shop's people: the player (short / buzz / long hair, plain white kit recoloured live) and the manager, plus every clip. ~0.5 MB each (packed by scripts/perf3d/shrink-models.mjs)." },
  { id: "models", title: "3D models (live in the browser)", kind: "model", dir: "star/shop3d", test: (f) => f.endsWith(".glb"), made: "tools/shop3d/build_assets.py", note: "Loaded by three.js on the 3D Shop page. CC0 Quaternius body (LICENSE.txt in the same folder)." },
  { id: "shopitems", title: "3D shop: boots and cars (live in the browser)", kind: "model", dir: "star/shop3d/items", test: (f) => f.endsWith(".glb"), made: "tools/shop3d/export_items.py (from tools/blender-shop/scripts/{boot,car,cars}.py)", note: "The shop's own Blender boots (level 3) and cars, cut down for a phone and Draco-compressed. Shown on plinths and the turntable in the 3D shop." },
];

function walk(dir, deep) {
  const abs = join(ROOT, "public", dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const name of readdirSync(abs).sort()) {
    const p = join(abs, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (deep) for (const sub of walk(`${dir}/${name}`, true)) out.push(sub);
    } else out.push({ path: `/${dir}/${name}`, name, bytes: st.size });
  }
  return out;
}

/** Layer packs: show only base.webp per pose (the other layers are masks). */
function keep(folder, file) {
  if (folder.id === "footballer") {
    if (file.path.includes("/clips/")) return false;
    if (file.path.includes("/layers/")) return file.name === "base.webp";
  }
  return folder.test(file.name);
}

export function buildManifest() {
  return FOLDERS.map((f) => ({
    id: f.id,
    title: f.title,
    kind: f.kind,
    made: f.made,
    note: f.note,
    files: walk(f.dir, !!f.deep).filter((file) => keep(f, file)).map(({ path, bytes }) => ({ path, bytes })),
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = buildManifest();
  const body =
    "// GENERATED by scripts/assets3d-manifest.mjs — do not edit by hand. Re-run it after adding a render.\n" +
    "export type Asset3dKind = \"image\" | \"video\" | \"model\";\n" +
    "export interface Asset3dFile { path: string; bytes: number }\n" +
    "export interface Asset3dFolder { id: string; title: string; kind: Asset3dKind; made: string; note: string; files: Asset3dFile[] }\n" +
    `export const ASSETS_3D: Asset3dFolder[] = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(join(ROOT, "lib/star/assets3dManifest.ts"), body);
  console.log(`assets3d: ${data.reduce((n, f) => n + f.files.length, 0)} files in ${data.length} folders`);
}
