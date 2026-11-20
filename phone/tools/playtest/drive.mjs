/**
 * PLAYTEST DRIVER: both apps open side by side, steered one step at a time.
 *
 *   node phone/tools/playtest/drive.mjs [--port 7777] [--w 412 --h 915] [--fresh]
 *   then:  node phone/tools/playtest/cmd.mjs '<js>'       (runs in this process; `P` packed page, `N` KIB Next page)
 *
 * Starts the packed app (mobile/www) and KIB Next's web build (phone/tools/look/out/web,
 * made by ../look/build-web.mjs) on local servers, opens each in its own Chromium page at
 * phone size with touch on, and keeps them open. Each command is a bit of JS run with
 * helpers in scope (see HELPERS below) and returns what it returns. Page errors and
 * console errors are kept per app (`errs()`).
 * --fresh: empty storage (a brand-new game). Otherwise storage is kept between commands.
 */
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "../look/serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = Number(val("--port", 7777));
let W = Number(val("--w", 412)), H = Number(val("--h", 915));
const SHOTS = val("--shots", process.env.PT_SHOTS || "/tmp/playtest");
fs.mkdirSync(SHOTS, { recursive: true });

function packedDir() {
  const c = [path.join(REPO, "mobile/www")];
  for (let d = path.dirname(REPO); d !== path.dirname(d); d = path.dirname(d)) c.push(path.join(d, "mobile/www"));
  return c.find((d) => fs.existsSync(path.join(d, "index.html")));
}

const packedSrv = await serve(packedDir());
const nextSrv = await serve(path.join(HERE, "../look/out/web"));
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const errors = { packed: [], next: [] };
const pages = {};
async function open(app, url) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors[app].push(`${new Date().toISOString().slice(11, 19)} pageerror: ${e.message.slice(0, 300)}`));
  p.on("console", (m) => { if (m.type() === "error") errors[app].push(`${new Date().toISOString().slice(11, 19)} console: ${m.text().slice(0, 300)}`); });
  await p.goto(url + "/", { waitUntil: "load", timeout: 120000 });
  pages[app] = p;
  return p;
}
await Promise.all([open("packed", packedSrv.url), open("next", nextSrv.url)]);

// ── helpers available to commands ──
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const H_ = {
  wait,
  async click(p, re, o = {}) {
    if (typeof re === "string") re = new RegExp(re, "i");
    if (!re.flags.includes("i")) re = new RegExp(re.source, re.flags + "i");
    let l = p.locator("button:visible, [role=button]:visible").filter({ hasText: re });
    if (!(await l.count())) l = p.getByText(re);
    l = o.last ? l.last() : l.nth(o.nth ?? 0);
    await l.click({ timeout: o.timeout ?? 5000 });
    await wait(o.ms ?? 1200);
    return "clicked";
  },
  async tap(p, x, y, ms = 1000) { await p.touchscreen.tap(x, y); await wait(ms); return "tapped"; },
  async mclick(p, x, y, ms = 1000) { await p.mouse.click(x, y); await wait(ms); return "clicked"; },
  async drag(p, x1, y1, x2, y2, steps = 12) {
    await p.mouse.move(x1, y1); await p.mouse.down();
    for (let i = 1; i <= steps; i++) { await p.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps); await wait(16); }
    await p.mouse.up(); await wait(1000); return "dragged";
  },
  async text(p, n = 1500) { return (await p.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, "\n").slice(0, n); },
  /** Visible clickable things with their boxes. */
  async buttons(p) {
    return p.evaluate(() => {
      const out = [];
      const els = document.querySelectorAll("button, [role=button], a, [tabindex='0'], input, select");
      for (const e of els) {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
        const t = (e.innerText || e.getAttribute("aria-label") || e.value || e.placeholder || "").replace(/\s+/g, " ").trim().slice(0, 40);
        out.push(`${t || "?"} @${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out.join("\n");
    });
  },
  /** Elements wider than the screen or text cut off (scrollWidth > clientWidth). */
  async overflow(p) {
    return p.evaluate(() => {
      const out = []; const vw = innerWidth;
      for (const e of document.querySelectorAll("body *")) {
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const own = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        if (own && (r.right > vw + 1 || r.left < -1) && r.bottom > 0 && r.top < innerHeight) out.push(`offscreen-x: "${e.textContent.trim().slice(0, 40)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
        if (own && e.scrollWidth > e.clientWidth + 2 && (cs.overflow === "hidden" || cs.textOverflow === "ellipsis")) out.push(`clipped: "${e.textContent.trim().slice(0, 40)}"`);
      }
      return [...new Set(out)].slice(0, 30).join("\n");
    });
  },
  async shot(name, which = "both") {
    const out = [];
    for (const app of which === "both" ? ["packed", "next"] : [which]) {
      const f = path.join(SHOTS, `${name}-${app}.png`);
      await pages[app].screenshot({ path: f }); out.push(f);
    }
    return out.join("\n");
  },
  async full(name, app) { const f = path.join(SHOTS, `${name}-${app}-full.png`); await pages[app].screenshot({ path: f, fullPage: true }); return f; },
  async size(w, h) { W = w; H = h; for (const p of Object.values(pages)) await p.setViewportSize({ width: w, height: h }); await wait(800); return `${w}x${h}`; },
  errs(clear = true) { const e = JSON.stringify(errors, null, 1); if (clear) { errors.packed.length = 0; errors.next.length = 0; } return e; },
  async reload(app, kv) {
    const p = pages[app];
    if (kv !== undefined) await p.evaluate((kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv || {})) localStorage.setItem(k, v); }, kv);
    await p.reload({ waitUntil: "load" }); await wait(3000); return "reloaded";
  },
  async storage(app) { return pages[app].evaluate(() => Object.keys(localStorage).map((k) => `${k} (${localStorage.getItem(k).length})`).join("\n")); },
  async pull(p, dx = 0, dy = 110, loose = false) {
    const { findBall } = await import("./ball.mjs");
    let b = null;
    for (let i = 0; i < 6 && !b; i++) { b = await findBall(p, loose || i >= 3); if (!b) await wait(500); }
    if (!b) return "ball not found";
    await H_.drag(p, b.x, b.y, b.x + dx, b.y + dy); return `pulled from ${b.x},${b.y}`;
  },
  urls: { packed: packedSrv.url, next: nextSrv.url },
  SHOTS, fs, path,
};
if (argv.includes("--fresh")) for (const app of ["packed", "next"]) await H_.reload(app, {});

const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  let out;
  try {
    const fn = new AsyncFn(...Object.keys(H_), "P", "N", body);
    const r = await fn(...Object.values(H_), pages.packed, pages.next);
    out = typeof r === "string" ? r : JSON.stringify(r, null, 1);
  } catch (e) { out = "ERROR: " + String(e.message || e).split("\n").slice(0, 3).join(" | "); }
  res.end(String(out ?? ""));
  if (body.trim() === "process.exit()") process.exit(0);
}).listen(PORT, "127.0.0.1", () => console.log(`playtest driver on ${PORT}; packed ${packedSrv.url} next ${nextSrv.url}`));
