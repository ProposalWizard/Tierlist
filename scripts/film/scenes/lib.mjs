import zlib from "node:zlib";
// Shared helpers for the chat7 bug-fix clips. Production build at :3300, signed-out play.
import { phone, startRec, stopRec, shot } from "../rec.mjs";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
export { startRec, stopRec, shot };
export const URL = process.env.GAME_URL || "http://localhost:3300/star-dev";
export const OUT = "/home/user/Tierlist/docs/handoffs/2026-10-22-leo-tonight/chat7/film";
// Saved games (whole localStorage dumps, gzipped) that open straight on a
// screen: 33-bdor = Ballon d'Or night, 36-window = summer window list.
export const DUMPS = `${import.meta.dirname}/seeds`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Open a phone; block hosts that hang in the sandbox. `dump` = a localStorage dump to seed ONCE (first load only).
export async function open(dump) {
  const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (!process.env.PW_CHROMIUM && fs.existsSync(exe)) process.env.PW_CHROMIUM = exe;
  const { browser, context, page } = await phone();
  await context.route(/supabase\.co|flagcdn|googletagmanager|posthog|sentry/i, (r) => r.abort());
  if (dump) {
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${DUMPS}/${dump}.json.gz`)).toString("utf8"));
    await context.addInitScript((d) => {
      try {
        if (sessionStorage.getItem("__seeded")) return;
        sessionStorage.setItem("__seeded", "1");
        for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
      } catch {}
    }, data);
  }
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await settle(page);
  return { browser, context, page };
}
export async function settle(page) {
  for (let i = 0; i < 40; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (t.length > 20 && !/Loading career|Compiling/i.test(t)) break;
    await sleep(500);
  }
  await sleep(1500);
}
export const text = (page) => page.locator("body").innerText().catch(() => "");
export async function click(page, re, ms = 5000) {
  const b = page.locator("button:visible, a:visible, [role=button]:visible").filter({ hasText: new RegExp(re, "i") }).first();
  try {
    await b.waitFor({ state: "visible", timeout: ms });
    try { await b.click({ timeout: 3000 }); } catch { await b.evaluate((e) => e.click()); }
    await sleep(900);
    return true;
  } catch { return false; }
}
export async function clickText(page, re, ms = 4000) { // divs like NEXT / LATER
  const l = page.getByText(new RegExp(re, "i")).last();
  try { await l.waitFor({ state: "visible", timeout: ms }); await l.click({ timeout: 3000 }); await sleep(900); return true; } catch { return false; }
}
export async function banner(page, msg) { // DOM caption, shown just before an action
  await page.evaluate((m) => {
    const d = document.createElement("div");
    d.textContent = m;
    d.style.cssText = "position:fixed;left:0;right:0;top:56px;z-index:2147483646;text-align:center;font:800 30px system-ui;color:#fff;background:rgba(220,30,30,.92);padding:14px;letter-spacing:.5px";
    document.body.appendChild(d);
  }, msg);
}
export async function dismissPopups(page) { for (let i = 0; i < 4; i++) { if (!(await clickText(page, "^(LATER|SKIP|NO THANKS|GOT IT)$", 600))) break; } }
// Speed up / trim: segments = [[start,end,speed],...] in source seconds; out 390 px wide.
export function finish(src, out, segs, { crf = 28, jpgAt = null } = {}) {
  const parts = segs.map(([a, b, s], i) => `[0:v]trim=${a}:${b},setpts=(PTS-STARTPTS)/${s}[v${i}]`);
  const fc = parts.join(";") + ";" + segs.map((_, i) => `[v${i}]`).join("") + `concat=n=${segs.length}:v=1:a=0,fps=30,scale=390:-2:flags=lanczos,format=yuv420p[o]`;
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex", fc, "-map", "[o]", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-movflags", "+faststart", "-an", out]);
  if (r.status !== 0) throw new Error(r.stderr.toString());
  if (jpgAt != null) spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(jpgAt), "-i", out, "-frames:v", "1", "-q:v", "3", out.replace(/\.mp4$/, ".jpg")]);
}

// Fast new career to Home: setup, dev sim trial, scout, signing. Not filmed.
export async function newCareerToHome(page, say = () => {}) {
  await page.locator("input:visible").nth(0).fill("Sam"); await page.locator("input:visible").nth(1).fill("Saver");
  await click(page, "^Continue"); await click(page, "^Continue"); await click(page, "Start Career"); await sleep(2500);
  await page.locator("button:visible", { hasText: /DEV: SKIP/i }).first().evaluate((e) => e.click()); await sleep(800);
  await page.locator("button, div, a").filter({ hasText: /^\s*Sim whole trial\s*$/i }).last().evaluate((e) => e.click()); await sleep(3000);
  for (let i = 0; i < 40; i++) {
    const t = await text(page);
    if (/TAP TO CONTINUE/i.test(t)) { await clickText(page, "TAP TO CONTINUE", 1500); await sleep(1200); continue; }
    if (/MY HOME/i.test(t) && !/SIGNING FOR|SCOUT HAS SPOTTED/i.test(t)) break;
    if (/SIGNING FOR/i.test(t)) { await page.locator("button:visible", { hasText: /^\s*skip\s*$/i }).first().evaluate((e) => e.click()).catch(() => {}); await sleep(2500); continue; }
    if (!(await click(page, "TAP TO|^(Continue|Sign|Accept|Take it)", 1500))) await sleep(1500);
    say(i);
  }
}
