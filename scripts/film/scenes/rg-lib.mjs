// Real Goals / shootout filming helpers (chat 5, 23 Oct 2026). Built on rec.mjs.
//   const f = await film(name); ... f.keep() ... f.cut() ... await f.done();
// Records the whole phone screen; only the parts between keep() and cut() go in
// the clip (dead loading time is cut out). Output: <OUT>/<name>.mp4 (390 wide,
// H.264) + <name>.jpg (the still at f.still()).
import { phone, startRec, shot } from "../rec.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.FILM_BASE ?? "http://localhost:3300";
export const OUT = process.env.FILM_OUT ?? path.resolve("docs/handoffs/2026-10-22-leo-tonight/chat5/film");
const FF = process.env.FFMPEG ?? "ffmpeg";

export async function film(name, { cpu = 1, touch = true } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const { browser, page } = await phone(touch ? {} : { hasTouch: false, isMobile: false });
  page.setDefaultTimeout(60000);
  if (cpu > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu }); }
  // Kept frames only: whatever arrives between cut() and keep() is thrown away
  // as it comes (a long wait never fills memory or slows the encode).
  let rec = null;
  const segs = [];
  let seg = null;
  const nowS = () => Date.now() / 1000;
  const close = () => { if (seg) { seg.frames = rec.frames.splice(0); seg.end = nowS(); segs.push(seg); seg = null; } };
  return {
    page,
    async start() { rec = await startRec(page); rec.frames.length = 0; },
    keep() { if (!seg) { rec.frames.length = 0; seg = { start: nowS() }; } },
    cut() { close(); },
    /** Now, for dropSince (a try that may be thrown away). */
    mark() { return nowS(); },
    /** Throw away everything since the mark (a missed try), and stop keeping. */
    dropSince(t) { if (seg) { const keepN = rec.frames.findIndex((f) => f.t >= t); seg.frames = keepN < 0 ? rec.frames.splice(0) : rec.frames.splice(0, keepN); rec.frames.length = 0; seg.end = t; segs.push(seg); seg = null; } },
    async still() { await shot(page, path.join(OUT, `${name}.jpg`)); },
    async done() {
      await page.waitForTimeout(800);
      close();
      await rec.cdp.send("Page.stopScreencast").catch(() => {});
      await browser.close();
      const dir = fs.mkdtempSync(path.join(OUT, `.${name}-`));
      const lines = [];
      let n = 0, len = 0;
      for (const sg of segs) {
        sg.frames.forEach((f, i) => {
          const pth = path.join(dir, `f${String(n++).padStart(5, "0")}.jpg`);
          fs.writeFileSync(pth, Buffer.from(f.data, "base64"));
          const next = i + 1 < sg.frames.length ? sg.frames[i + 1].t : sg.end;
          const d = Math.max(0.001, Math.min(next - f.t, 5));
          len += d;
          lines.push(`file '${pth}'`, `duration ${d.toFixed(4)}`);
        });
      }
      if (!n) throw new Error("no frames kept");
      lines.push(lines[lines.length - 2]);
      fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
      const out = path.join(OUT, `${name}.mp4`);
      const r = spawnSync(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
        "-vf", "fps=30,scale=390:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-movflags", "+faststart", "-an", out]);
      fs.rmSync(dir, { recursive: true, force: true });
      if (r.status !== 0) throw new Error(r.stderr.toString());
      console.log(`${name}: ${len.toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
    },
  };
}

/** A slow, visible finger swipe (scrolls the page by dy). */
export async function swipe(page, dy, ms = 900) {
  const steps = Math.max(10, Math.round(ms / 30));
  for (let i = 1; i <= steps; i++) { await page.evaluate((d) => window.scrollBy(0, d), dy / steps); await page.waitForTimeout(ms / steps); }
}

/** Tap an element (scrolled into view) with the finger dot. */
export async function tap(page, sel) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

/** The match ball on screen (white blob search on a screenshot), CSS px. */
export async function findBall(page) {
  const buf = await page.screenshot();
  return page.evaluate(async (b64) => {
    const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + b64; });
    const sc = im.width / innerWidth;
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const cv = document.querySelector("canvas").getBoundingClientRect();
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, seen = new Uint8Array(W * H), out = [];
    // Not the commentary box and tip at the bottom of the pitch (white text).
    const y0c = Math.max(0, Math.floor(cv.top * sc)), y1c = Math.min(H, Math.floor(Math.min(cv.bottom, innerHeight) * sc));
    // Skip the commentary box and the tip (white words over the pitch).
    const boxes = [...document.querySelectorAll("div")].filter((e) => { const t = e.textContent ?? ""; return (t.startsWith("LIVE COMMENTARY") || t.startsWith("💡")) && t.length < 400; }).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 140);
    const inBox = (x, y) => boxes.some((r) => x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4);
    const w = (x, y) => { const i = (y * W + x) * 4; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 150 && mx - mn < 28; };
    // Grass just beside the blob (the commentary words sit on a dark box, not on grass).
    const green = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const i = (y * W + x) * 4; return d[i + 1] > 90 && d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 30; };
    const onGrass = (x0, x1, ya, yb) => { const m = Math.round((ya + yb) / 2), g = Math.round(4 * sc); return [green(x0 - g, m), green(x1 + g, m), green(Math.round((x0 + x1) / 2), ya - g), green(Math.round((x0 + x1) / 2), yb + g)].filter(Boolean).length >= 2; };
    for (let y = y0c; y < y1c; y++) for (let x = 0; x < W; x++) {
      if (seen[y * W + x] || !w(x, y)) continue;
      const st = [[x, y]]; seen[y * W + x] = 1; let n = 0, x0 = x, x1 = x, ya = y, yb = y;
      while (st.length) { const [a, b] = st.pop(); n++; x0 = Math.min(x0, a); x1 = Math.max(x1, a); ya = Math.min(ya, b); yb = Math.max(yb, b);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = a + dx, v = b + dy; if (u < 0 || v < y0c || u >= W || v >= y1c || seen[v * W + u] || !w(u, v)) continue; seen[v * W + u] = 1; st.push([u, v]); } }
      const bw = (x1 - x0 + 1) / sc, bh = (yb - ya + 1) / sc;
      if (bw >= 3 && bw <= 11 && bh >= 3 && bh <= 11 && n / ((x1 - x0 + 1) * (yb - ya + 1)) > 0.4 && !inBox((x0 + x1) / 2 / sc, (ya + yb) / 2 / sc) && onGrass(x0, x1, ya, yb)) out.push([(x0 + x1) / 2 / sc, (ya + yb) / 2 / sc]);
    }
    return out;
  }, buf.toString("base64"));
}

/**
 * Pull back from the ball (dx across, pull down, CSS px), then tap the contact
 * ball at `lift` (0 = its middle, + = below it: more lift). True when struck.
 */
export async function strike(page, dx, pull, lift = 0.1) {
  const contact = 'div.cursor-pointer[style*="aspect-ratio"]';
  // The ball sits nearest the middle of the pitch across; try it first.
  const mid = (await page.evaluate(() => innerWidth)) / 2;
  const cands = (await findBall(page)).sort((a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
  for (const [x, y] of cands) {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 14; i++) { await page.mouse.move(x - (dx * i) / 14, y + (pull * i) / 14); await page.waitForTimeout(20); }
    await page.mouse.up(); await page.waitForTimeout(800);
    if (await page.locator(contact).count()) {
      const bb = await page.locator(contact).first().boundingBox(); const r = bb.width / 2;
      await page.waitForTimeout(400);
      await page.mouse.click(bb.x + r, bb.y + r * (1 + lift));
      return true;
    }
  }
  return false;
}
