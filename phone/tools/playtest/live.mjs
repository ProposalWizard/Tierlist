/**
 * THE LIVE PLAYTEST BENCH: both apps open in one Chromium, kept alive, driven
 * one command at a time (so a person or an agent can LOOK, then act, like a player).
 *
 *   node phone/tools/playtest/live.mjs [--port 7788] [--media <dir>]      # start (keeps running)
 *   node phone/tools/playtest/pt.mjs <cmd> [json args]                     # send a command
 *
 * Packed app = mobile/www (the reference). KIB Next = phone/tools/look/out/web
 * (node phone/tools/look/build-web.mjs). Read ../look/README.md first.
 *
 * Commands (POST /cmd {cmd, ...}):
 *   open {app:"packed"|"next", name, w, h, save:true|false, video:true}   a fresh page (touch on, dpr 1); every page error is kept
 *   close {name}                       closes it (and saves its video to <media>/<name>.webm)
 *   shot {name, file}                  screenshot to <media>/<file>.png
 *   text {name}                        the page's visible text
 *   tap {name, x, y, wait}             a touch tap (touchscreen.tap)
 *   click {name, re, wait}             a button/text matching re
 *   drag {name, x1,y1,x2,y2, steps, ms, hold, shots:[i...], file}   a touch drag (CDP touch events), optional stills mid-drag
 *   mdrag {...same}                    the same with the mouse
 *   eval {name, js}                    run js in the page (returns its value)
 *   ball {name, loose}                 where the ball is on the glass (the look check's finder)
 *   wait {name, ms}
 *   burst {name, n, every, file}       n screenshots every ms (a "flip book")
 *   errors {name}                      page errors so far
 *   list                                the open pages
 */
import { chromium } from "playwright";
import http from "node:http";
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
const PORT = Number(val("--port", 7788));
const MEDIA = path.resolve(val("--media", path.join(HERE, "out")));
fs.mkdirSync(MEDIA, { recursive: true });

function packedDir() {
  const c = [path.join(REPO, "mobile/www")];
  for (let d = path.dirname(REPO); d !== path.dirname(d); d = path.dirname(d)) c.push(path.join(d, "mobile/www"));
  return c.find((d) => fs.existsSync(path.join(d, "index.html")));
}
const save = JSON.parse(execFileSync("npx", ["tsx", path.join(PHONE, "tools/look/make-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 }).trim().split("\n").pop());
const servers = { packed: await serve(packedDir()), next: await serve(WEB_OUT) };
const browser = await chromium.launch({
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const pages = new Map(); // name → {ctx, page, app, errors, cdp}

async function findBall(p, loose = false) {
  const b64 = (await p.screenshot()).toString("base64");
  return p.evaluate(async ([b64, loose]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const light = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 140 && mx - mn < 40; };
    const seen = new Uint8Array(W * H); const out = [];
    for (let y = Math.floor(H * 0.12); y < H * 0.92; y++) for (let x = 0; x < W; x++) {
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
      if (w >= (loose ? 4 : 6) && h >= (loose ? 4 : 6) && w <= 24 && h <= 24 && Math.abs(w - h) <= (loose ? 3 : 2) && n >= (loose ? 0.25 : 0.35) * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w, h, n });
    }
    return out.sort((a, b) => b.n - a.n).slice(0, 5);
  }, [b64, loose]);
}

async function touchDrag(e, { x1, y1, x2, y2, steps = 14, ms = 18, hold = 0, shots = [], file = "drag" }) {
  const cdp = e.cdp;
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x1, y1) });
  const files = [];
  for (let i = 1; i <= steps; i++) {
    const x = x1 + ((x2 - x1) * i) / steps, y = y1 + ((y2 - y1) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x, y) });
    await e.page.waitForTimeout(ms);
    if (shots.includes(i)) { const f = path.join(MEDIA, `${file}-${i}.png`); await e.page.screenshot({ path: f }); files.push(f); }
  }
  if (hold) { await e.page.waitForTimeout(hold); const f = path.join(MEDIA, `${file}-hold.png`); await e.page.screenshot({ path: f }); files.push(f); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return files;
}
async function mouseDrag(e, { x1, y1, x2, y2, steps = 14, ms = 18, hold = 0, shots = [], file = "drag" }) {
  const p = e.page; const files = [];
  await p.mouse.move(x1, y1); await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps); await p.waitForTimeout(ms);
    if (shots.includes(i)) { const f = path.join(MEDIA, `${file}-${i}.png`); await p.screenshot({ path: f }); files.push(f); }
  }
  if (hold) { await p.waitForTimeout(hold); const f = path.join(MEDIA, `${file}-hold.png`); await p.screenshot({ path: f }); files.push(f); }
  await p.mouse.up();
  return files;
}

const H = {
  async open({ app, name, w = 412, h = 915, save: withSave = false, video = true, url = "/" }) {
    if (pages.has(name)) await H.close({ name });
    const ctx = await browser.newContext({
      viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      ...(video ? { recordVideo: { dir: path.join(MEDIA, "_video"), size: { width: w, height: h } } } : {}),
    });
    if (withSave) {
      await ctx.addInitScript((kv) => {
        if (sessionStorage.getItem("pt-seeded")) return;
        localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
        sessionStorage.setItem("pt-seeded", "1");
      }, save[app]);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (er) => errors.push({ t: Date.now(), m: `pageerror: ${String(er.message).slice(0, 300)}` }));
    page.on("console", (m) => { if (m.type() === "error") errors.push({ t: Date.now(), m: `console: ${m.text().slice(0, 300)}` }); });
    const cdp = await ctx.newCDPSession(page);
    pages.set(name, { ctx, page, app, errors, cdp });
    await page.goto(servers[app].url + url, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(4000);
    return { ok: true, url: servers[app].url };
  },
  async close({ name }) {
    const e = pages.get(name); if (!e) return { ok: false };
    const v = e.page.video();
    await e.ctx.close(); pages.delete(name);
    if (v) { const src = await v.path(); const dst = path.join(MEDIA, `${name}.webm`); fs.renameSync(src, dst); return { video: dst, errors: e.errors }; }
    return { errors: e.errors };
  },
  async shot({ name, file }) { const f = path.join(MEDIA, `${file || name}.png`); await pages.get(name).page.screenshot({ path: f }); return { file: f }; },
  async text({ name }) { return { text: await pages.get(name).page.evaluate(() => document.body.innerText) }; },
  async tap({ name, x, y, wait = 600 }) { const e = pages.get(name); await e.page.touchscreen.tap(x, y); await e.page.waitForTimeout(wait); return { ok: true }; },
  async mclick({ name, x, y, wait = 600 }) { const e = pages.get(name); await e.page.mouse.click(x, y); await e.page.waitForTimeout(wait); return { ok: true }; },
  async click({ name, re, wait = 1200, nth = 0 }) {
    const p = pages.get(name).page; const rx = new RegExp(re, "i");
    let l = p.locator("button:visible, [role=button]:visible").filter({ hasText: rx }).nth(nth);
    if (!(await l.count())) l = p.getByText(rx).nth(nth);
    const bb = await l.boundingBox({ timeout: 4000 });
    await l.click({ timeout: 5000 }); await p.waitForTimeout(wait); return { ok: true, at: bb };
  },
  async drag(a) { const files = await touchDrag(pages.get(a.name), a); await pages.get(a.name).page.waitForTimeout(a.after ?? 400); return { files }; },
  async mdrag(a) { const files = await mouseDrag(pages.get(a.name), a); await pages.get(a.name).page.waitForTimeout(a.after ?? 400); return { files }; },
  async eval({ name, js }) { return { v: await pages.get(name).page.evaluate(js) }; },
  /** After a tap at (x,y): how long until the page's words match `until` (ms), sampled every 50 ms. */
  async timeto({ name, x, y, until, max = 15000 }) {
    const p = pages.get(name).page;
    if (x != null) await p.touchscreen.tap(x, y);
    return { v: await p.evaluate(([re, max]) => new Promise((r) => {
      const t0 = performance.now(); const rx = new RegExp(re, "i");
      const iv = setInterval(() => { const s = document.body.innerText; if (rx.test(s)) { clearInterval(iv); r({ ms: Math.round(performance.now() - t0), hit: (s.match(rx) || [])[0] }); } }, 50);
      setTimeout(() => { clearInterval(iv); r("timeout"); }, max);
    }), [until, max]) };
  },
  async ball({ name, loose }) { return { balls: await findBall(pages.get(name).page, loose) }; },
  async wait({ name, ms }) { await pages.get(name).page.waitForTimeout(ms); return { ok: true }; },
  async burst({ name, n = 6, every = 250, file }) {
    const p = pages.get(name).page; const files = [];
    for (let i = 0; i < n; i++) { const f = path.join(MEDIA, `${file}-${String(i).padStart(2, "0")}.png`); await p.screenshot({ path: f }); files.push(f); await p.waitForTimeout(every); }
    return { files };
  },
  async errors({ name }) { return { errors: pages.get(name).errors }; },
  async list() { return { pages: [...pages.keys()] }; },
};

http.createServer(async (req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let out;
    try { const a = JSON.parse(body || "{}"); out = await H[a.cmd](a); }
    catch (er) { out = { error: String(er && er.message || er).split("\n").slice(0, 3).join(" | ") }; }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out));
  });
}).listen(PORT, "127.0.0.1", () => console.log(`live bench on ${PORT}; packed ${servers.packed.url} next ${servers.next.url}; media ${MEDIA}`));
