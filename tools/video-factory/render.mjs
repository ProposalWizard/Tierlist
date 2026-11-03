// node render.mjs <workdir> <firstFrame> <lastFrame>  -> <workdir>/eframes/fNNNNN.jpg
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
for (let f = +a; f <= Math.min(+b, total - 1); f++) {
  const u = await p.evaluate((n) => window.draw(n), f);
  fs.writeFileSync(`${out}/f${String(f).padStart(5, "0")}.jpg`, Buffer.from(u.split(",")[1], "base64"));
}
const seen = await p.evaluate(() => window.errorsSeen);
if (errs.length || seen.length) console.log("errors", JSON.stringify(errs.concat(seen).slice(0, 5)));
await br.close();
