// THE NUMBER PLATES (driving phase 1, 28 Nov 2026): one picture, UK style — the front plate (white)
// on the top half, the rear (yellow) on the bottom half, the same invented registration on both.
// cut_wheels.py lays a plate quad over each car's blanked plate (tools/models3d/deplate.mjs) with it.
//
//   GLTOOLS=<dir with sharp> node tools/cars/make_plate.mjs [TEXT]   → tools/cars/plate.png
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const sharp = require("sharp");
const text = process.argv[2] ?? "KB26 GLB";
const W = 1024, H = 440; // two plates of 1024 x 220 (520 x 111 mm is 4.7 : 1)
const plate = (y, fill) => `
  <rect x="6" y="${y + 6}" width="${W - 12}" height="208" rx="18" fill="${fill}" stroke="#1a1a1a" stroke-width="5"/>
  <rect x="22" y="${y + 22}" width="64" height="176" rx="6" fill="#1f4fb3"/>
  <text x="54" y="${y + 172}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="34" fill="#fff" text-anchor="middle">UK</text>
  <text x="${W / 2 + 36}" y="${y + 160}" font-family="DejaVu Sans Mono, DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="150" letter-spacing="6" fill="#111" text-anchor="middle">${text}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${plate(0, "#f4f4ef")}${plate(220, "#f6c90e")}</svg>`;
const out = new URL("./plate.png", import.meta.url).pathname;
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("wrote", out);
