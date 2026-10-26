// Open the season-reel test page, play a reel, pull out the mixed soundtrack
// (and its crowd / music stems), then press Save video and keep the file.
// node .measure/grab.mjs <baseUrl> <goals> <outDir> [save]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [base = "http://localhost:3500", goalsArg = "20", outDir = ".measure/out", doSave = "save"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

function wav(chs, rate) {
  const n = chs[0].length, c = chs.length;
  const buf = Buffer.alloc(44 + n * c * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * c * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(c, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * c * 4, 28); buf.writeUInt16LE(c * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * c * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) { buf.writeFloatLE(chs[k][i], o); o += 4; }
  return buf;
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`${base}/star-season-reel-dev`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: goalsArg, exact: true }).click();
await page.getByRole("button", { name: "Every goal" }).click();
await page.getByRole("button", { name: /Play the reel/ }).click();
await page.waitForSelector('[data-reel-sound="ready"]', { timeout: 120000 });
const t0 = Date.now();

const pull = async (expr) => page.evaluate(async (expr) => {
  const r = window.__seasonReel;
  const b = expr === "mix" ? r.audio() : await r.stem(expr);
  if (!b) return null;
  const chs = [];
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c);
    const u8 = new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
    let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    chs.push(btoa(s));
  }
  return { rate: b.sampleRate, chs };
}, expr);
const toF = (b64) => { const b = Buffer.from(b64, "base64"); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
for (const k of ["mix", "crowd", "music"]) {
  const r = await pull(k);
  if (!r) { console.log(k, "null"); continue; }
  writeFileSync(`${outDir}/${k}.wav`, wav(r.chs.map(toF), r.rate));
  console.log(k, "written", r.rate);
}
const segs = await page.evaluate(() => ({ duration: window.__seasonReel.duration, segs: window.__seasonReel.segs, plan: window.__seasonReel.plan ? window.__seasonReel.plan() : null }));
writeFileSync(`${outDir}/segs.json`, JSON.stringify(segs, null, 1));
console.log("duration", segs.duration);

if (doSave === "save") {
  const dl = page.waitForEvent("download", { timeout: 600000 });
  await page.click("[data-reel-save]");
  // If the phone no longer counts it as the tap: one more press.
  const ready = page.waitForSelector('[data-reel-save="ready"]', { timeout: 600000 }).then(() => page.click("[data-reel-save]")).catch(() => {});
  const d = await dl;
  const name = d.suggestedFilename();
  await d.saveAs(`${outDir}/${name}`);
  console.log("saved", name, ((Date.now() - t0) / 1000).toFixed(0), "s");
  void ready;
}
await browser.close();
