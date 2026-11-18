// Renders frames of the Who would win? template (called by build.py).
//   node render.mjs <work dir> <first frame> <last frame> [frame list json]
// <work dir>/match.resolved.json and <work dir>/timeline.json are injected as window.MATCH and window.TL.
// Frames go to <work dir>/frames/f00000.jpg (720x1280; build.py scales to 1080x1920).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const { chromium } = await import(path.join(ROOT, "node_modules/playwright/index.mjs"));
const [work, a, b, listFile] = process.argv.slice(2);
const match = fs.readFileSync(path.join(work, "match.resolved.json"), "utf8");
const tl = fs.readFileSync(path.join(work, "timeline.json"), "utf8");
const exe = process.env.PW_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const br = await chromium.launch({ executablePath: exe, args: ["--allow-file-access-from-files"] });
const p = await br.newPage({ viewport: { width: 720, height: 1280 } });
const errs = []; p.on("pageerror", e => errs.push(String(e))); p.on("console", m => { if (m.type() === "warning" || m.type() === "error") errs.push(m.text()); });
await p.addInitScript(`window.MATCH = ${match}; window.TL = ${tl};`);
await p.goto("file://" + path.join(HERE, "template/edit.html")); await p.evaluate(() => window.ready);
const total = await p.evaluate(() => window.TOTAL);
const out = path.join(work, "frames"); fs.mkdirSync(out, { recursive: true });
const list = listFile ? JSON.parse(fs.readFileSync(listFile, "utf8")) : [];
if (!listFile) for (let f = Number(a); f <= Math.min(Number(b), total - 1); f++) list.push(f);
for (const f of list) {
  const u = await p.evaluate(n => window.draw(n), f);
  fs.writeFileSync(`${out}/f${String(f).padStart(5, "0")}.jpg`, Buffer.from(u.split(",")[1], "base64"));
}
console.log(`frames ${list.length} (${a}-${b}) of ${total}`, errs.length ? "errors " + JSON.stringify(errs.slice(0, 5)) : "");
await br.close();
if (errs.some(e => !e.includes("missing image"))) process.exit(2);
