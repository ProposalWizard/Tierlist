// node render.mjs <workdir> <firstFrame> <lastFrame>   -> <workdir>/eframes/fNNNNN.jpg
// node render.mjs <workdir> --frames 12,90,300          -> just those frames (contact sheets)
import { chromium } from "playwright";
import fs from "fs";
const [dir, a, b] = process.argv.slice(2);
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const br = await chromium.launch({ executablePath: exe, args: ["--allow-file-access-from-files"] });
const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
await p.goto("file://" + dir + "/edit.html"); await p.evaluate(() => window.ready);
const total = await p.evaluate(() => window.TOTAL);
const out = dir + "/eframes"; fs.mkdirSync(out, { recursive: true });
const list = a === "--frames" ? b.split(",").map(Number) : Array.from({ length: Math.max(0, Math.min(+b, total - 1) - +a + 1) }, (_, i) => +a + i);
for (const f of list) {
  const u = await p.evaluate((n) => window.draw(n), f);
  fs.writeFileSync(`${out}/f${String(f).padStart(5, "0")}.jpg`, Buffer.from(u.split(",")[1], "base64"));
}
const seen = await p.evaluate(() => window.errorsSeen);
if (errs.length || seen.length) console.log("errors", JSON.stringify(errs.concat(seen).slice(0, 5)));
await br.close();
