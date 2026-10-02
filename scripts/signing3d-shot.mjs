// Stills of the live 3D signing scene at phone size (390x844), for checking
// by eye. No video.
//
//   node scripts/signing3d-shot.mjs <url> <outPrefix> <step> [step ...]
//
// Each step is one of:
//   line:N          tap through the words until line N (0-based) is showing
//   contract        tap through every line to the contract
//   sign            press TAP TO SIGN
//   hold:T          hold the current beat at T seconds and take a still
//   cam:x,y,z,lx,ly,lz[,fov]   a fixed test camera for the next stills (camoff: back to the scene's own)
// The page exposes window.__sign3d (signing3dScene.ts's handle), so a still
// is the same every run.
import { chromium } from "playwright";

const [url, prefix, ...steps] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
await page.goto(url, { waitUntil: "load", timeout: 180000 });
await page.waitForFunction(() => window.__sign3dReady, null, { timeout: 180000 });
// Hold the 3D still from the start (a software-drawn page is slow); the words
// still type, and each hold:T draws one frame.
await page.evaluate(() => window.__sign3d.debugHold(0));
let n = 0;
const tapLine = async () => {
  await page.evaluate(() => document.querySelector("[data-line]")?.click());
  await page.waitForTimeout(150);
};
for (const step of steps) {
  if (step.startsWith("line:")) {
    const want = Number(step.slice(5));
    for (let i = 0; i < 12; i++) {
      const cur = await page.evaluate(() => Number(document.querySelector("[data-line]")?.getAttribute("data-line") ?? -1));
      if (cur === want) break;
      await tapLine(); await tapLine();
    }
    await page.waitForTimeout(1500);
  } else if (step === "contract") {
    for (let i = 0; i < 30 && !(await page.$("[data-sign]")); i++) { await tapLine(); await page.waitForTimeout(200); }
    await page.waitForTimeout(300);
  } else if (step === "sign") {
    await page.evaluate(() => document.querySelector("[data-sign]")?.click());
    await page.waitForTimeout(200);
  } else if (step === "camoff") {
    await page.evaluate(() => window.__sign3d.debugCamera(null, null));
  } else if (step.startsWith("cam:")) {
    const v = step.slice(4).split(",").map(Number);
    await page.evaluate((v) => window.__sign3d.debugCamera([v[0], v[1], v[2]], [v[3], v[4], v[5]], v[6] || 40), v);
  } else if (step.startsWith("hold:")) {
    const t = Number(step.slice(5));
    await page.evaluate((t) => window.__sign3d.debugHold(t), t);
    await page.waitForTimeout(400);
    const out = `${prefix}-${String(n++).padStart(2, "0")}.png`;
    await page.screenshot({ path: out });
    console.log("still", out);
  } else if (step.startsWith("dumpface:")) {
    const url = await page.evaluate(() => window.__fitted?.canvas.toDataURL("image/png"));
    if (url) (await import("node:fs")).writeFileSync(step.slice(9), Buffer.from(url.split(",")[1], "base64"));
  } else if (step.startsWith("js:")) {
    console.log(await page.evaluate(step.slice(3)));
  }
}
for (const l of logs.filter((l) => !/CERT_AUTHORITY|DevTools|HMR|Fast Refresh/.test(l))) console.log(l);
await browser.close();
