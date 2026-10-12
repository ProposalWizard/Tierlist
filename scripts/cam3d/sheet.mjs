// One sheet per chance: the 2D view box | old 3D camera | new 3D camera (or any
// columns), at phone size. Usage:
//   node scripts/cam3d/sheet.mjs DIR OUTNAME.png name "Title" col1=raw/file.svg col2=raw/file.png ...
// Column labels are the part before "=".
import { chromium } from "playwright";
import fs from "node:fs";
const [dir, outName, name, title, ...cols] = process.argv.slice(2);
const cells = cols.map((c) => { const i = c.indexOf("="); return { label: c.slice(0, i), file: `${dir}/${c.slice(i + 1)}` }; }).filter((c) => fs.existsSync(c.file));
const src = (f) => `data:${f.endsWith(".svg") ? "image/svg+xml" : "image/png"};base64,${fs.readFileSync(f).toString("base64")}`;
const W = 372, H = 704;
const html = `<!doctype html><html><body style="margin:0;background:#0b1220;font:700 18px system-ui;color:#fff">
<div style="padding:12px 16px 4px;font-size:22px">${title}</div>
<div style="display:flex;gap:12px;padding:8px 16px 16px">${cells.map((c) => `<div><div style="padding:4px 0 6px;color:#fcd34d">${c.label}</div><img src="${src(c.file)}" style="width:${W}px;height:${H}px;display:block;border:2px solid #334155"></div>`).join("")}</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 16 + cells.length * (W + 16) + 16, height: H + 90 }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.screenshot({ path: `${dir}/${outName}`, fullPage: true });
await b.close();
console.log(`${dir}/${outName}`, name);
