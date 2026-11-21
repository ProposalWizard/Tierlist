/**
 * AUTO-PLAY ONE OPEN BENCH PAGE until a screen you want to look at (playtest round 2, 21 Nov 2026).
 * Runs inside live.mjs through its `run` command, so the page stays open afterwards:
 *
 *   pt.mjs run '{"name":"packed","js":"return (await import(\"file:///…/auto.mjs\")).auto(page, e, MEDIA, {secs:120, stop:\"HALF TIME\", tag:\"cs-p\"})"}'
 *
 * Every ~0.35 s it reads the page's words and does what a player would:
 *   strike screen (STRIKE/HEAD/VOLLEY IT?) → tap the ball; aim view (STAMINA, a ball found) → drag back 85 px
 *   from the ball, away from the top goal; "Tap to start" → tap; GET OUT THERE / SECOND HALF / EXTRA TIME /
 *   PENALTIES / CONTINUE buttons → press, unless `stop` (a regex) matches the words first: then it returns.
 * Returns {stopped, secs, log}: every new line of words with the second it appeared. A still every `every` ms
 * (default 1000) to MEDIA/<tag>-tNNN.jpg when `stills` is true.
 */
import path from "node:path";
import fs from "node:fs";

const BALL_AT = { packed: [0.449, 0.842], next: [0.5, 0.88], dev: [0.449, 0.842] };

export async function findBall(page) {
  const b64 = (await page.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
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
      if (w >= 4 && h >= 4 && w <= 16 && h <= 16 && Math.abs(w - h) <= 3 && n >= 0.35 * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, n });
    }
    out.sort((a, b) => b.n - a.n);
    // Fallback (the packed app's wide views draw the ball 3-4 px, often touching a line): your man's
    // yellow star, then the white pixels near his feet that are not part of a long straight line.
    if (!out.length) {
      // the star is PALE yellow (241,254,172); the keeper's shirt is a deep yellow (blue < 90)
      const yel = (i) => d[i] > 170 && d[i + 1] > 190 && d[i + 2] > 90 && d[i + 1] - d[i + 2] > 45;
      const seenY = new Uint8Array(W * H); const stars = [];
      for (let y = Math.floor(H * 0.12); y < H * 0.9; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x; if (seenY[k] || !yel(k * 4)) continue;
        const q = [k]; seenY[k] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
        while (q.length) { const c = q.pop(); n++; const cx = c % W, cy = (c / W) | 0; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const nk = ny * W + nx; if (!seenY[nk] && yel(nk * 4)) { seenY[nk] = 1; q.push(nk); } } }
        if (x1 - x0 <= 9 && y1 - y0 <= 8 && n >= 2) stars.push({ x: (x0 + x1) / 2, y: y1 });
      }
      const wh = (xx, yy) => { const i = (yy * W + xx) * 4; return Math.min(d[i], d[i + 1], d[i + 2]) > 165; };
      const run = (xx, yy) => { let h = 0, v = 0; for (let k = -6; k <= 6; k++) { if (wh(xx + k, yy)) h++; if (wh(xx, yy + k)) v++; } return h > 9 || v > 9; };
      for (const st of stars) {
        let sx = 0, sy = 0, m = 0;
        for (let yy = Math.round(st.y) + 4; yy < Math.min(H - 7, st.y + 45); yy++) for (let xx = Math.max(7, Math.round(st.x) - 30); xx < Math.min(W - 7, st.x + 30); xx++) if (wh(xx, yy) && !run(xx, yy)) { sx += xx; sy += yy; m++; }
        out.push(m >= 3 ? { x: sx / m, y: sy / m, n: m, star: 1 } : { x: st.x, y: st.y + 22, n: 0, star: 1 });
      }
    }
    return out.slice(0, 6);
  }, b64);
}

async function press(page, re) {
  const l = page.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (await l.count()) { await l.click({ timeout: 4000 }).catch(() => {}); return true; }
  const t = page.getByText(re).first();
  if (await t.count()) { await t.click({ timeout: 2000 }).catch(() => {}); return true; }
  return false;
}

async function drag(e, x1, y1, x2, y2) {
  const pt = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await e.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x1, y1) });
  for (let i = 1; i <= 14; i++) { await e.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x1 + ((x2 - x1) * i) / 14, y1 + ((y2 - y1) * i) / 14) }); await e.page.waitForTimeout(18); }
  await e.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

export async function auto(page, e, MEDIA, o = {}) {
  let r;
  try { r = await autoRun(page, e, MEDIA, o); } catch (er) { r = { stopped: "ERROR " + String(er && er.message || er).slice(0, 200), secs: 0, log: [] }; }
  if (o.out) fs.writeFileSync(o.out, JSON.stringify(r));
  return r;
}
async function autoRun(page, e, MEDIA, o) {
  const secs = o.secs ?? 120, stop = o.stop ? new RegExp(o.stop, "im") : null, tag = o.tag ?? "auto";
  const vp = page.viewportSize(); const W = vp.width, H = vp.height;
  const t0 = Date.now(); const st = () => ((Date.now() - t0) / 1000).toFixed(1);
  const log = []; const seen = new Set(); let lastAim = 0, lastShot = 0, n = 0, tried = [];
  const pressRe = o.press ? new RegExp(o.press, "i") : /^(get out there|second half|extra time|penalties|kick off|full time|continue|play on)/i;
  // KIB draws the strike screen title on the canvas: there only "POWER" is words on the page.
  while (Date.now() - t0 < secs * 1000) {
    const t = await page.evaluate(() => document.body.innerText).catch(() => "");
    for (const line of t.split("\n").map((s) => s.trim()).filter(Boolean)) if (!seen.has(line)) { seen.add(line); if (line.length > 2 && !/^\d+%?'?$/.test(line)) log.push(`${st()} ${line}`); }
    if (o.stills && Date.now() - lastShot > (o.every ?? 1000)) { lastShot = Date.now(); await page.screenshot({ path: path.join(MEDIA, `${tag}-t${String(n++).padStart(3, "0")}.jpg`), type: "jpeg", quality: 70 }); }
    if (stop && stop.test(t)) return { stopped: (t.match(stop) || [])[0], secs: st(), log };
    if (/(STRIKE|HEAD|VOLLEY) IT\?/i.test(t) || (/^POWER$/m.test(t) && !/STAMINA/.test(t))) { const [fx, fy] = BALL_AT[e.app] || BALL_AT.packed; await page.touchscreen.tap(W * fx, H * fy); log.push(`${st()} >> strike tap`); await page.waitForTimeout(500); continue; }
    if (/tap to start|push to start|TAP ANYWHERE/i.test(t)) { await page.touchscreen.tap(W / 2, H * 0.45); log.push(`${st()} >> tap start`); await page.waitForTimeout(400); continue; }
    const btn = page.locator("button:visible, [role=button]:visible").filter({ hasText: pressRe }).first();
    if (await btn.count()) { const s = (await btn.innerText().catch(() => "")).replace(/\s+/g, " "); await btn.click({ timeout: 4000 }).catch(() => {}); log.push(`${st()} >> press ${s}`); await page.waitForTimeout(800); continue; }
    if (/STAMINA/i.test(t) && Date.now() - lastAim > 1500) {
      const c = (await findBall(page)).find((b) => !tried.some((q) => Math.hypot(q.x - b.x, q.y - b.y) < 6));
      if (!c) tried = [];
      else {
        tried.push(c); if (tried.length > 10) tried.shift();
        const gx = W / 2, gy = H * 0.12, dx = gx - c.x, dy = gy - c.y, L = Math.hypot(dx, dy) || 1;
        await drag(e, c.x, c.y, c.x - (dx / L) * 85, c.y - (dy / L) * 85).catch(() => e.cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }).catch(() => {}));
        log.push(`${st()} >> aim from ${c.x.toFixed(0)},${c.y.toFixed(0)}`); lastAim = Date.now();
        await page.waitForTimeout(300); continue;
      }
    }
    await page.waitForTimeout(350);
  }
  return { stopped: null, secs: st(), log };
}
