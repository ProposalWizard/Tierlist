// node check_centre.mjs data.json t : renders one frame and measures, from the pixels, how far each number and name sits
// from the centre of its box (Mikey, 26 Nov 2026: "things are still not centred"). Prints the worst offsets in px.
import { chromium } from "playwright"; import fs from "node:fs"; import path from "node:path";
const [dataPath, tArg] = process.argv.slice(2); const D = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const br = await chromium.launch({ args: ["--allow-file-access-from-files"] }); const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + path.resolve(path.dirname(new URL(import.meta.url).pathname), "ranking.html")); await p.evaluate(async (d) => window.setup(d), D);
const res = await p.evaluate((t) => { window.draw(t); const g = document.getElementById("c").getContext("2d");
  const BX = 34, BY = 352, RH = D.rowH || 64, NW = 64, h = RH - 10; const out = [];
  const box = (x0, y0, w, hh, test) => { const d = g.getImageData(x0, y0, w, hh).data; let x1 = 1e9, x2 = -1, y1 = 1e9, y2 = -1;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (test(d[i], d[i + 1], d[i + 2])) { x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y); } }
    return x2 < 0 ? null : { dx: ((x1 + x2) / 2 - (w - 1) / 2), dy: ((y1 + y2) / 2 - (hh - 1) / 2), top: y1, bottom: hh - 1 - y2 }; };
  for (let r = 1; r <= 20; r++) { const y = BY + (r - 1) * RH;
    const n = box(BX + 4, y + 2, NW - 8, h - 4, (R, G, B) => R > 200 && G > 200 && B > 200); // white number in the dark end
    const nm = box(BX + NW + 110, y + 2, 300, h - 4, (R, G, B) => R < 90 && G < 80 && B < 60); // dark name on gold
    out.push({ r, num: n && { dx: +n.dx.toFixed(1), dy: +n.dy.toFixed(1) }, name: nm && { dy: +nm.dy.toFixed(1), top: nm.top, bottom: nm.bottom } }); }
  return out; }, Number(tArg));
for (const o of res) console.log(o.r, "number", JSON.stringify(o.num), "name", JSON.stringify(o.name));
await br.close();
