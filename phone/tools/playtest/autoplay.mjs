/**
 * PLAY A WHOLE MATCH LIKE A PLAYER, in either app, and keep what happened.
 *
 *   node phone/tools/playtest/autoplay.mjs --app packed|next --tag m2 [--w 412 --h 915] [--mins 9] [--media <dir>] [--headed-touch]
 *
 * Loads the look-check career (../look/make-save.mts), presses PLAY, and then
 * every ~0.5 s looks at the screen and does what a player would:
 *   - "Get out there" / "Kick off" / "Continue" / "Tap to skip"-style buttons: press them
 *   - an aim view (STAMINA on screen, no strike screen): find the ball, drag back from it AWAY from the goal
 *   - the strike screen ("STRIKE IT"): tap the lower middle of the ball
 *   - a "tap"/"head"/"volley" prompt: tap the ball
 * It writes a still every second (<tag>-<app>-tNNN.png), a log of every new line of
 * text that appeared (<tag>-<app>-log.txt: captions, commentary, prompts), the page
 * errors, and a video (<tag>-<app>.webm). Nothing in the app is changed.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { serve } from "../look/serve.mjs";
import { WEB_OUT } from "../look/build-web.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHONE = path.resolve(HERE, "../..");
const REPO = path.resolve(PHONE, "..");
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = val("--app", "packed"), TAG = val("--tag", "auto");
const W = Number(val("--w", 412)), H = Number(val("--h", 915));
const MINS = Number(val("--mins", 9));
const MEDIA = path.resolve(val("--media", path.join(HERE, "out")));
const DIR = path.join(MEDIA, `${TAG}-${APP}`);
fs.mkdirSync(DIR, { recursive: true });

function packedDir() {
  const c = [path.join(REPO, "mobile/www")];
  for (let d = path.dirname(REPO); d !== path.dirname(d); d = path.dirname(d)) c.push(path.join(d, "mobile/www"));
  return c.find((d) => fs.existsSync(path.join(d, "index.html")));
}
const save = JSON.parse(execFileSync("npx", ["tsx", path.join(PHONE, "tools/look/make-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 }).trim().split("\n").pop());
const srv = await serve(APP === "packed" ? packedDir() : WEB_OUT);
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: path.join(DIR, "_v"), size: { width: W, height: H } } });
await ctx.addInitScript((kv) => {
  if (sessionStorage.getItem("pt-seeded")) return;
  localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  sessionStorage.setItem("pt-seeded", "1");
}, save[APP]);
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const log = [];
const t0 = Date.now();
const stamp = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
p.on("pageerror", (e) => log.push(`${stamp()} !! pageerror ${String(e.message).slice(0, 300)}`));
p.on("console", (m) => { if (m.type() === "error") log.push(`${stamp()} !! console ${m.text().slice(0, 300)}`); });

const touchDrag = async (x1, y1, x2, y2, steps = 14) => {
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x1, y1) });
  for (let i = 1; i <= steps; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps) }); await p.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
async function findBall() {
  const b64 = (await p.screenshot()).toString("base64");
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const light = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 140 && mx - mn < 40; };
    const seen = new Uint8Array(W * H); const out = [];
    for (let y = Math.floor(H * 0.14); y < H * 0.9; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x; if (seen[k] || !light(k * 4)) continue;
      const st = [k]; seen[k] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
      while (st.length) {
        const q = st.pop(); n++; const qx = q % W, qy = (q / W) | 0;
        x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = qx + dx, ny = qy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nk = ny * W + nx; if (!seen[nk] && light(nk * 4)) { seen[nk] = 1; st.push(nk); }
        }
      }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w >= 4 && h >= 4 && w <= 20 && h <= 20 && Math.abs(w - h) <= 3 && n >= 0.3 * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, n });
    }
    return out.sort((a, b) => b.n - a.n).slice(0, 8);
  }, b64);
}
const text = () => p.evaluate(() => document.body.innerText).catch(() => "");
async function press(re) {
  const l = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (await l.count()) {
    const ok = await l.click({ timeout: 6000 }).then(() => true, () => false);
    if (!ok) { const bb = await l.boundingBox().catch(() => null); if (bb) await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    return true;
  }
  const t = p.getByText(re).first();
  if (await t.count()) { await t.click({ timeout: 2000 }).catch(() => {}); return true; }
  return false;
}

await p.goto(srv.url + "/", { waitUntil: "load", timeout: 120000 });
await p.waitForTimeout(5000);
if (APP === "next") { await press(/^continue/i); await p.waitForTimeout(4500); }
for (let i = 0; i < 8 && !/KICK OFF|GET OUT THERE|SUBSTITUTES/i.test(await text()); i++) { await press(/^PLAY$/i); await p.waitForTimeout(1500); }
const tried = [];
let seenLines = new Set(), shotN = 0, lastShot = 0, lastAim = 0;
const end = Date.now() + MINS * 60000;
while (Date.now() < end) {
  const t = await text();
  if (!/STAMINA/i.test(t)) tried.length = 0;
  for (const line of t.split("\n").map((s) => s.trim()).filter(Boolean)) {
    if (!seenLines.has(line)) { seenLines.add(line); if (line.length > 2 && !/^\d+%?$/.test(line)) log.push(`${stamp()} ${line}`); }
  }
  if (Date.now() - lastShot > 1000) { lastShot = Date.now(); await p.screenshot({ path: path.join(DIR, `t${String(shotN++).padStart(3, "0")}.png`) }); }
  try {
    if (/(STRIKE|HEAD|VOLLEY) IT\?/i.test(t)) {
      if (/^\s*FULL TIME\s*$/m.test(t)) {
      log.push(`${stamp()} >> full time pressed`);
      await press(/^\s*FULL TIME\s*$/i); await p.waitForTimeout(3500);
      for (let k = 0; k < 6; k++) {
        await p.screenshot({ path: path.join(DIR, `post-${k}.png`) });
        log.push(`${stamp()} post-${k}: ${(await text()).split("\n").slice(0, 10).join(" | ")}`);
        if (!(await press(/^(continue|next|done|ok|got it)/i))) await p.touchscreen.tap(W / 2, H * 0.85);
        await p.waitForTimeout(2500);
      }
      break;
    }
    if (/TAP ANYWHERE/i.test(t)) { await p.touchscreen.tap(W / 2, H * 0.2); await p.waitForTimeout(250); continue; }
      const fy = APP === "packed" ? 0.84 : 0.93;
      log.push(`${stamp()} >> strike tap`);
      await p.touchscreen.tap(W / 2, H * fy); await p.waitForTimeout(400); continue;
    }
    if (/TAP ANYWHERE/i.test(t)) { await p.touchscreen.tap(W / 2, H * 0.2); await p.waitForTimeout(300); continue; }
    if (/GET OUT THERE/i.test(t)) { log.push(`${stamp()} >> get out there`); await press(/get out there/i); await p.waitForTimeout(800); continue; }
    if (/tap to skip/i.test(t)) { await press(/tap to skip/i); await p.waitForTimeout(600); continue; }
    if (/^(KICK OFF|SECOND HALF|CONTINUE|NEXT|BACK TO|DONE)/im.test(t) && /HALF[- ]TIME|FULL[- ]TIME|SECOND HALF|MAN OF THE MATCH|PLAYER RATINGS/i.test(t)) {
      const ok = (await press(/^(second half|kick off|continue|next|done)/i)); if (ok) { log.push(`${stamp()} >> pressed a continue`); await p.waitForTimeout(1500); continue; }
    }
    if (/STAMINA/i.test(t) && Date.now() - lastAim > 1500) {
      const cands = await findBall();
      const b = cands.find((c) => !tried.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < 6));
      if (!b) tried.length = 0;
      if (b) {
        tried.push(b); if (tried.length > 12) tried.shift();
        const gx = W / 2, gy = H * 0.12; const dx = gx - b.x, dy = gy - b.y, n = Math.hypot(dx, dy) || 1;
        const pull = 85;
        log.push(`${stamp()} >> aim from ${b.x.toFixed(0)},${b.y.toFixed(0)}`);
        await p.screenshot({ path: path.join(DIR, `aim-${String(shotN).padStart(3, "0")}-before.png`) });
        await touchDrag(b.x, b.y, b.x - (dx / n) * pull, b.y - (dy / n) * pull);
        lastAim = Date.now();
        await p.waitForTimeout(300);
        continue;
      }
    }
  } catch (e) { log.push(`${stamp()} xx ${String(e.message).slice(0, 120)}`); }
  await p.waitForTimeout(350);
}
fs.writeFileSync(path.join(DIR, "log.txt"), log.join("\n"));
const v = p.video();
await ctx.close();
if (v) fs.renameSync(await v.path(), path.join(MEDIA, `${TAG}-${APP}.webm`));
await browser.close(); srv.close();
console.log(`done: ${DIR} (${shotN} stills), log lines ${log.length}`);
