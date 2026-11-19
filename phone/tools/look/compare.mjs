/**
 * THE LOOK CHECK: the packed app and KIB Next side by side, screen by screen.
 *
 *   node phone/tools/look/compare.mjs [--build] [--only home,shop] [--packed <dir>] [--out <dir>]
 *
 * Opens the PACKED app (mobile/www: the website's own screens) and KIB Next
 * (phone/, built for a browser by build-web.mjs) in Chromium at the same phone
 * size (390×844, deviceScaleFactor 1), with the same career save loaded into both
 * (make-save.mts), walks each to the same screen, screenshots it, and writes:
 *   out/shots/<screen>-packed.png, out/shots/<screen>-next.png   the raw screenshots
 *   out/sheets/<nn>-<screen>.png                                   packed | KIB Next, labelled
 *   out/contact.png                                                every pair on one sheet
 *   out/report.json                                                per screen: found or not, page errors
 * Read README.md in this folder first.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
import { buildWeb, WEB_OUT } from "./build-web.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHONE = path.resolve(HERE, "../..");
const REPO = path.resolve(PHONE, "..");
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(val("--out", path.join(HERE, "out")));
const ONLY = (val("--only", "") || "").split(",").filter(Boolean);

/** The packed app's built files: --packed, else <repo>/mobile/www, else the first mobile/www above the repo (a worktree). */
function packedDir() {
  const c = [val("--packed", ""), path.join(REPO, "mobile/www")];
  for (let d = path.dirname(REPO); d !== path.dirname(d); d = path.dirname(d)) c.push(path.join(d, "mobile/www"));
  const hit = c.filter(Boolean).find((d) => fs.existsSync(path.join(d, "index.html")));
  if (!hit) throw new Error("No packed app found (mobile/www). Build it (mobile/README.md) or pass --packed <dir>.");
  return hit;
}

// ── the career both apps load (make-save.mts) ───────────────────────────────
function makeSave() {
  const json = execFileSync("npx", ["tsx", path.join(HERE, "make-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 });
  return JSON.parse(json.trim().split("\n").pop());
}

// ── helpers used inside a scene ─────────────────────────────────────────────
const wait = (p, ms) => p.waitForTimeout(ms);
async function click(p, re, timeout = 6000) {
  if (!re.flags.includes("i")) re = new RegExp(re.source, re.flags + "i"); // CSS upper-cases some labels
  let l = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await l.count())) l = p.getByText(re).first();
  await l.click({ timeout });
  await wait(p, 1400);
}
async function tap(p, x, y, ms = 1400) { await p.mouse.click(x, y); await wait(p, ms); }
async function fill(p, i, v) { await p.locator("input:visible").nth(i).fill(v); await wait(p, 300); }
async function drag(p, x1, y1, x2, y2) {
  await p.mouse.move(x1, y1); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(x1 + ((x2 - x1) * i) / 12, y1 + ((y2 - y1) * i) / 12); await wait(p, 16); }
  await p.mouse.up(); await wait(p, 1000);
}
/** Where the ball is on screen: a small round light-grey blob (the matches move it anywhere). */
async function findBall(p, loose = false) {
  const b64 = (await p.screenshot()).toString("base64");
  const r = await p.evaluate(async ([b64, loose]) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const light = (i) => { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); return mn > 140 && mx - mn < 40; };
    const seen = new Uint8Array(W * H); const out = [];
    for (let y = Math.floor(H * 0.12); y < H * 0.95; y++) for (let x = 0; x < W; x++) {
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
      if (w >= (loose ? 5 : 6) && h >= (loose ? 5 : 6) && w <= 20 && h <= 20 && Math.abs(w - h) <= (loose ? 3 : 2) && n >= (loose ? 0.25 : 0.35) * w * h) out.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, n });
    }
    return out.sort((a, b) => b.n - a.n)[0] ?? null;
  }, [b64, loose]);
  return r;
}
/** Pull back from the ball (the trial's free kick): the run-up, then the strike screen. */
async function pullBack(p) {
  let b = null;
  for (let i = 0; i < 6 && !b; i++) { b = await findBall(p, i >= 3); if (!b) await wait(p, 500); }
  if (!b) throw new Error("ball not found");
  await drag(p, b.x, b.y, b.x, b.y + 110);
}
/** From the aim view to the strike screen (tries the pull again if the kick did not start), its how-to closed. */
async function toStrike(p) {
  const text = () => p.evaluate(() => document.body.innerText);
  for (let i = 0; i < 3 && !/STRIKE IT/i.test(await text()); i++) {
    await pullBack(p);
    if (/TAP ANYWHERE/i.test(await text())) await tap(p, 195, 300, 1300);
    else await wait(p, 1300);
  }
  if (!/STRIKE IT/i.test(await text())) throw new Error("strike screen not reached");
  if (/TAP ANYWHERE/i.test(await text())) await tap(p, 195, 150, 250);
}
/** After "Get out there": wait for the build-up, tap its "tap to skip", and stop on your chance. */
async function skipBuildUp(p) {
  for (let t = 0; t < 40; t++) {
    if (/tap to skip/i.test(await p.evaluate(() => document.body.innerText))) {
      await p.getByText(/tap to skip/i).first().click({ timeout: 3000 }).catch(() => p.mouse.click(195, 400));
      await wait(p, 2200); // the camera settles on your chance
      return;
    }
    await wait(p, 250);
  }
}
/** KIB Next: open a screen by name on top of the tabs (src/nav.web.tsx). */
async function kib(p, screen, params) {
  await p.evaluate(([s, pr]) => { const n = window.__kibNav; n.home(); if (s !== "tabs") n.go(s, pr ?? undefined); }, [screen, params ?? null]);
  await wait(p, 2200);
}
/** KIB Next with a save: Continue on the title (loads the squads, as on the phone). */
async function kibContinue(p) { await click(p, /^continue$/i); await wait(p, 4500); }

// ── the screens ─────────────────────────────────────────────────────────────
// save: true = the shared career; "transfer" = the same career at the summer window.
// packed / next: walk that app to the screen (null: the app has no such screen).
const SCENES = [
  { id: "title", title: "Title (main menu)", save: false,
    packed: async (p) => { await click(p, /Main menu/i); },
    next: async () => {} },
  { id: "new-career-1", title: "New career: your details", save: false,
    packed: async () => {},
    next: async (p) => { await click(p, /new game/i); } },
  { id: "new-career-2", title: "New career: your style", save: false,
    packed: async (p) => { await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); },
    next: async (p) => { await click(p, /new game/i); await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); } },
  { id: "new-career-photo", title: "New career: your photo", save: false,
    packed: async (p) => { await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); await click(p, /^RIGHT$/); await click(p, /Continue/i); },
    next: async (p) => { await click(p, /new game/i); await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); await click(p, /^Right$/); await click(p, /Continue/i); } },
  { id: "trial-howto", title: "Trial: first free kick (how to play)", save: false,
    packed: async (p) => { await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); await click(p, /^RIGHT$/); await click(p, /Continue/i); await click(p, /Start Career/i); await wait(p, 3000); },
    next: async (p) => { await click(p, /new game/i); await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); await click(p, /^Right$/); await click(p, /Continue/i); await click(p, /Start Career/i); await wait(p, 3000); } },
  { id: "trial-aim", title: "Trial: free kick, ready to aim", save: false,
    packed: async (p) => { await scene("trial-howto").packed(p); await tap(p, 195, 300); },
    next: async (p) => { await scene("trial-howto").next(p); await tap(p, 195, 300); } },
  { id: "strike", title: "Strike screen (where do you strike it?)", save: false,
    packed: async (p) => { await scene("trial-aim").packed(p); await toStrike(p); },
    next: async (p) => { await scene("trial-aim").next(p); await toStrike(p); } },
  { id: "home", title: "Home", save: true,
    packed: async () => {},
    next: async (p) => { await kibContinue(p); } },
  { id: "stats", title: "Stats", save: true,
    packed: async (p) => { await drag(p, 60, 450, 360, 460); },
    next: async (p) => { await kibContinue(p); await kib(p, "career-stats"); } },
  { id: "league", title: "League table", save: true,
    packed: async (p) => { await click(p, /^League$/); },
    next: async (p) => { await kibContinue(p); await click(p, /^League$/); } },
  { id: "phone", title: "Phone", save: true,
    packed: async (p) => { await click(p, /^Phone/); },
    next: async (p) => { await kibContinue(p); await kib(p, "phone"); } },
  { id: "shop", title: "Shop", save: true,
    packed: async (p) => { await click(p, /^shop/i); },
    next: async (p) => { await kibContinue(p); await kib(p, "shop"); } },
  { id: "star-pass", title: "Star Pass", save: true,
    packed: async (p) => { await p.locator("[data-tour=rating]").first().click(); await wait(p, 2200); },
    next: async (p) => { await kibContinue(p); await kib(p, "star-pass"); } },
  { id: "transfers", title: "Transfer window (summer)", save: "transfer",
    packed: async () => {},
    next: async (p) => { await kibContinue(p); await kib(p, "transfers"); } },
  { id: "pre-match", title: "Before the match (Play pressed)", save: true,
    packed: async (p) => { await click(p, /^PLAY$/); await wait(p, 200); },
    // KIB Next kicks off by itself after 3.8 s, as the website; under load that can come before the shot, so Substitutes is tapped twice (it stops the timer; the drawer opens and shuts).
    next: async (p) => { await kibContinue(p); await p.getByText(/^PLAY$/i).first().click(); const s = p.getByText(/^SUBSTITUTES$/i).first(); await s.click(); await s.click(); await wait(p, 1800); } },
  { id: "match-feed", title: "Match: the feed (on the bench)", save: true,
    packed: async (p) => { await click(p, /^PLAY$/); await wait(p, 4000); },
    next: async (p) => { await kibContinue(p); await p.getByText(/^PLAY$/i).first().click(); await p.getByText(/^KICK OFF$/i).first().click({ timeout: 4000 }).catch(() => {}); await wait(p, 4000); } }, // the line-up kicks off by itself too
  { id: "match-pitch", title: "Match: the pitch (your chance)", save: true,
    packed: async (p) => { await scene("match-feed").packed(p); await click(p, /get out there/i); await skipBuildUp(p); },
    next: async (p) => { await scene("match-feed").next(p); await click(p, /get out there/i); await skipBuildUp(p); } },
  { id: "post-match", title: "Post-match (match simmed)", save: true,
    packed: async (p) => { await click(p, /^PLAY$/); await wait(p, 200); await p.locator('[aria-label="Sim this match"]').first().click(); await wait(p, 5000); },
    next: async (p) => { await kibContinue(p); await p.getByText(/^PLAY$/i).first().click(); await p.getByText("⏩").first().click(); await wait(p, 5000); } },
  // ── round 2 (career screens) ──
  { id: "training", title: "Training", save: true,
    packed: async (p) => { await click(p, /^Training/); },
    next: async (p) => { await kibContinue(p); await kib(p, "career-training"); } },
  { id: "settings", title: "Settings", save: true,
    packed: async (p) => { await p.locator('[aria-label="Settings"]').first().click(); await wait(p, 1800); },
    next: async (p) => { await kibContinue(p); await kib(p, "career-settings"); } },
  // KIB Next only (the packed app needs a long career to reach these): the look in the kit, to check by eye.
  ...[
    ["contract", "Contract renewal", "career-contract-renewal"],
    ["season-awards", "Season awards", "career-season-awards"],
    ["golden-ball", "Golden Ball night", "career-golden-ball"],
    ["callup", "International call-up", "career-callup"],
    ["offers", "Trial: offers", "career-offers"],
    ["manager-talk", "Trial: manager talk", "career-manager-talk"],
    ["signed", "Trial: signed", "career-signed"],
    ["youth", "Youth team", "career-youth"],
    ["free-agent", "Free agent", "career-free-agent"],
    ["loan", "Loan brief", "career-loan-brief"],
    ["hall-of-fame", "Hall of Fame", "hall-of-fame"],
    ["retirement", "Retirement", "career-retirement"],
    ["final-season", "Final season", "career-final-season"],
  ].map(([id, title, screen]) => ({ id, title: `${title} (KIB Next only)`, save: true, packed: null,
    next: async (p) => { await kibContinue(p); await kib(p, screen); } })),
];

const scene = (id) => SCENES.find((s) => s.id === id);

// ── run ─────────────────────────────────────────────────────────────────────
async function shoot(browser, app, url, scene, save) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = [];
  if (scene.save) {
    const kv = { ...save[app] };
    if (scene.save === "transfer" && app === "packed") kv["star-career-phase-v1::anon"] = JSON.stringify({ phase: "season-transfer" });
    await ctx.addInitScript((kv) => {
      if (sessionStorage.getItem("look-seeded")) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      sessionStorage.setItem("look-seeded", "1");
    }, kv);
  }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  const file = path.join(OUT, "shots", `${scene.id}-${app}.png`);
  let ok = true, note = "";
  try {
    await p.goto(url + "/", { waitUntil: "load", timeout: 120000 });
    await wait(p, 5000);
    await scene[app](p);
    await wait(p, 700);
  } catch (e) { ok = false; note = String(e.message || e).split("\n")[0]; }
  await p.screenshot({ path: file });
  await ctx.close();
  return { ok, note, errors: [...new Set(errors)].slice(0, 8), file };
}

async function sheet(browser, scene, a, b, file) {
  const img = (f) => (f && fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString("base64")}` : "");
  const col = (label, r) => `<div class="c"><div class="l">${label}${r && !r.ok ? ` <span class="w">(did not reach: ${r.note.replace(/</g, "&lt;").slice(0, 90)})</span>` : ""}</div>${r ? `<img src="${img(r.file)}">` : `<div class="none">no such screen in this app</div>`}</div>`;
  const html = `<html><body style="margin:0;background:#222;font:600 15px system-ui,sans-serif;color:#fff">
    <style>.h{padding:10px 14px;font-size:18px}.row{display:flex;gap:12px;padding:0 12px 12px}.c{width:390px}.l{height:26px;color:#ccc}.w{color:#f87171;font-size:11px}img{display:block;width:390px;height:844px}.none{width:390px;height:844px;display:grid;place-items:center;background:#333;color:#999}</style>
    <div class="h">${scene.title}</div><div class="row">${col("PACKED APP (website screens)", a)}${col("KIB NEXT (phone-built, in a browser)", b)}</div></body></html>`;
  const p = await browser.newPage({ viewport: { width: 816, height: 920 } });
  await p.setContent(html); await p.waitForTimeout(150);
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
}

async function contact(browser, rows, file) {
  const img = (f) => (f && fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString("base64")}` : "");
  const cells = rows.map(({ scene, a, b }) => `<div class="s"><div class="t">${scene.title}</div><div class="p">${
    [a, b].map((r) => (r ? `<img src="${img(r.file)}">` : `<div class="n">none</div>`)).join("")}</div></div>`).join("");
  const html = `<html><body style="margin:0;background:#1a1a1a;color:#fff;font:600 13px system-ui,sans-serif">
    <style>.g{display:grid;grid-template-columns:repeat(4,402px);gap:10px;padding:10px}.t{height:20px;overflow:hidden;white-space:nowrap}.p{display:flex;gap:4px}img,.n{width:195px;height:422px;display:block}.n{background:#333;display:grid;place-items:center;color:#888}</style>
    <div style="padding:10px 10px 0;font-size:16px">Left of each pair: packed app. Right: KIB Next.</div><div class="g">${cells}</div></body></html>`;
  const p = await browser.newPage({ viewport: { width: 1660, height: 900 } });
  await p.setContent(html); await p.waitForTimeout(300);
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
}

const main = async () => {
  for (const d of ["shots", "sheets"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  if (argv.includes("--build") || !fs.existsSync(path.join(WEB_OUT, "index.html"))) buildWeb();
  const save = makeSave();
  const packed = await serve(packedDir());
  const next = await serve(WEB_OUT);
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });
  const rows = [];
  const report = {};
  let n = 0;
  for (const scene of SCENES) {
    n++;
    if (ONLY.length && !ONLY.includes(scene.id)) continue;
    const a = scene.packed ? await shoot(browser, "packed", packed.url, scene, save) : null;
    const b = scene.next ? await shoot(browser, "next", next.url, scene, save) : null;
    const file = path.join(OUT, "sheets", `${String(n).padStart(2, "0")}-${scene.id}.png`);
    await sheet(browser, scene, a, b, file);
    rows.push({ scene, a, b });
    report[scene.id] = { title: scene.title, sheet: file, packed: a && { reached: a.ok, note: a.note, errors: a.errors }, next: b && { reached: b.ok, note: b.note, errors: b.errors } };
    const s = (r) => (!r ? "none" : r.ok ? "ok" : `FAILED (${r.note.slice(0, 60)})`);
    console.log(`${scene.id.padEnd(17)} packed ${s(a).padEnd(10)} next ${s(b)}`);
  }
  if (!ONLY.length) await contact(browser, rows, path.join(OUT, "contact.png"));
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); packed.close(); next.close();
  console.log(`\nsheets: ${path.join(OUT, "sheets")}\ncontact sheet: ${path.join(OUT, "contact.png")}`);
};
await main();
