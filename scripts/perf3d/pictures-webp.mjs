// The big PNGs the game shows, as WebP beside them (speed job B, 9 Oct 2026).
// Each is sized to at most ~2x its largest on-screen size, quality 90 (painted
// art, photos, renders) or lossless (flat art). The PNGs stay on disk (old
// saves and pages may still name them); the code names the .webp.
//   npm i --prefix /some/dir sharp@0.33.5
//   KIB_TOOLS=/some/dir node scripts/perf3d/pictures-webp.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");
const tools = process.env.KIB_TOOLS;
if (!tools) { console.error("set KIB_TOOLS (see the header)"); process.exit(1); }
const sharp = (await import(pathToFileURL(path.join(path.resolve(tools), "node_modules/sharp/lib/index.js")).href)).default;

/** [png, webp, longest side in px (null = keep), quality ("lossless" or 1-100), where it shows] */
export const PICTURES = [
  ["ball.png", "ball.webp", 256, 90, "Draft setup's Start button, 64 px"],
  ["star/ball.png", "star/ball.webp", null, 90, "the match ball (canvases, contact screen, title)"],
  ["star/contract.png", "star/contract.webp", null, 90, "trial reward contract (painted paper, text over it)"],
  ["star/fa-youth-cup-newspaper.png", "star/fa-youth-cup-newspaper.webp", null, 90, "trial newspaper front page"],
  ["star/stadium-domestic.png", "star/stadium-domestic.webp", 1200, 90, "matchday header photo (phone width)"],
  ["star/stadium-europe.png", "star/stadium-europe.webp", null, 90, "matchday header photo, Europe"],
  ["star/scout/red-frame.png", "star/scout/red-frame.webp", null, 90, "scout card frame"],
  ["star/scout/blue-frame.png", "star/scout/blue-frame.webp", null, 90, "scout card frame"],
  ["star/scout/gold-frame.png", "star/scout/gold-frame.webp", null, 90, "scout card frame"],
  ["star/kib-basic.png", "star/kib-basic.webp", null, 90, "KIB can"],
  ["star/kib-premium.png", "star/kib-premium.webp", null, 90, "KIB can"],
  ["star/kib-elite.png", "star/kib-elite.webp", null, 90, "KIB can"],
  ["f3d83465-95e8-48a7-b770-8bedcd65e0c1-Photoroom.png", "records/most-points.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Klopp and Pep.png", "records/most-wins.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Erling Haaland.png", "records/golden-boot.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Bruno Fernandes.png", "records/most-assists.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Petr Cech.png", "records/golden-glove.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Arsenal Invincibles.png", "records/unbeaten.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["Jose Mourinho.png", "records/least-conceded.webp", 320, 90, "Draft records row picture, 74 px wide"],
  ["United 9-0.png", "records/biggest-win.webp", 320, 90, "Draft records row picture, 74 px wide"],
];

let a = 0, b = 0;
for (const [src, dst, max, q, where] of PICTURES) {
  const s = path.join(root, "public", src), d = path.join(root, "public", dst);
  if (!fs.existsSync(s)) { console.log(`missing ${src}`); continue; }
  fs.mkdirSync(path.dirname(d), { recursive: true });
  let img = sharp(s);
  const m = await img.metadata();
  if (max && Math.max(m.width, m.height) > max) img = img.resize({ width: m.width >= m.height ? max : undefined, height: m.height > m.width ? max : undefined });
  await img.webp(q === "lossless" ? { lossless: true } : { quality: q, alphaQuality: 95, effort: 6 }).toFile(d);
  const sa = fs.statSync(s).size, sb = fs.statSync(d).size; a += sa; b += sb;
  console.log(`${src} ${m.width}x${m.height} ${(sa / 1024) | 0} KB → ${dst} ${(sb / 1024) | 0} KB  (${where})`);
}
console.log(`total ${(a / 1048576).toFixed(2)} MB → ${(b / 1048576).toFixed(2)} MB`);
