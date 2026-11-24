// Opens the 3D signing and the manager's office in KIB Next's web build (phone/tools/look/out/web, made by build-web.mjs) in
// headless Chromium and takes stills with REAL touches (Chromium's touch events, as a finger).
//
//   node phone/tools/look/signing-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed] [--only trial,transfer,office,dugout,captain,fail]
//
// trial     the first contract (career-signed): the words, a real tap on the picture and on the words for each line, TAP TO SIGN, the
//           pen, SIGNED, the handshake, WELCOME TO, Continue (the flow moves on), and Skip.
// transfer  a move (transfer-signing): the same, no shirt number yet, the manager of the new club, the full position name.
// office    Relationships -> Boss -> Office talk: the 3D office above the questions; the camera goes to you when you pick a reply.
// dugout    "In the dugout": the new manager's news in his office, Continue clears it.
// captain   The armband, in his office, Continue clears the flag.
// fail      The crash guard has the 3D off: the drawn signing and the plain cards take over (never a blank or a crash).
// Same screens, host and scene as the phone; only the GL comes from a <canvas> (expo-gl's web view). Software GL: read speed as
// relative; the scene's own clock only moves 0.1 s a frame, so the signing is played out with the scene's debugStep.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "signing-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
const ONLY = arg("--only", "trial,transfer,office,dugout,captain,fail").split(",");
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require(require.resolve("playwright", { paths: [REPO] }));
const chrome = (() => {
  for (const r of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean)) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) { const f = path.join(r, d, sub); if (fs.existsSync(f)) return f; }
  }
  return undefined;
})();

const save0 = JSON.parse(execFileSync("npx", ["tsx", path.join(HERE, "make-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 }).trim().split("\n").pop()).next;
const key = "knowitball-career\\career-v2";
/** The seeded career, with a manager, full energy and whatever a scenario needs. */
const seed = (patch = {}, extraKv = {}) => {
  const c = JSON.parse(save0[key]);
  c.energy = 100;
  c.manager = c.manager ?? { name: "Oscar Bianchi" };
  Object.assign(c, patch);
  return { ...save0, [key]: JSON.stringify(c), ...extraKv };
};

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log("   FAIL " + m); } };

async function scenario(name, W, H, kv, body) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.addInitScript((o) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(o.kv)) localStorage.setItem(k, v);
    if (o.speed) localStorage.setItem("knowitball-career\\prefs-v1", JSON.stringify({ show3dSpeed: true }));
    sessionStorage.setItem("seeded", "1");
  }, { kv, speed: SPEED });
  await ctx.route(/\/star\//, (route) => {
    const u = new URL(route.request().url());
    const rel = decodeURIComponent(u.pathname).replace(/^\/star\//, "");
    const f = path.join(REPO, "phone/assets/3d", rel.replace(/\.json$/, ".bin"));
    return fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f) }) : route.continue();
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  p.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(server.url, "")}`); });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const tapAt = async (x, y) => { await touch("touchStart", [[x, y]]); await p.waitForTimeout(60); await touch("touchEnd", []); };
  const shot = (n) => p.screenshot({ path: path.join(OUT, `${name}-${n}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  const shown = (re) => p.getByText(re).first().isVisible().catch(() => false);
  const careerNow = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  const bigCanvases = () => p.evaluate(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 150 && c.getBoundingClientRect().height > 150).length);
  const box = async (re) => { const b = await p.getByText(re).first().boundingBox().catch(() => null); return b; };
  console.log(`\n== ${name}  ${W}x${H} css at ${DPR}x`);
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) { await shot("title"); console.log("   no Continue button:", errors.slice(0, 5)); throw e; }
  await p.waitForTimeout(4500);
  // the big canvases on Home with nothing else open (the Home player, the pitch): what is left after a 3D screen must be no more than this
  const base = await bigCanvases();
  console.log(`   big canvases on Home before anything opens: ${base}`);
  try { await body({ p, W, H, touch, tapAt, shot, shown, careerNow, bigCanvases, box, errors, base }); } catch (e) { ok(false, `${name}: ${String(e).slice(0, 400)}`); await shot("error").catch(() => {}); }
  const bad = errors.filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels|KHR_parallel|HALF_FLOAT|favicon|deprecat|shadow\*|pointerEvents/i.test(l));
  if (bad.length) console.log("   messages:", Array.from(new Set(bad)).slice(0, 8));
  await ctx.close();
}

const waitFor = (p, fn, ms = 280000) => p.waitForFunction(fn, null, { timeout: ms });

/** The signing, from the first word to Continue (the website's own flow). */
async function playSigning({ p, W, H, tapAt, shot, shown, careerNow, bigCanvases, box, base }, o) {
  const t0 = Date.now();
  try { await waitFor(p, () => window.__sign3d); } catch { ok(false, "the 3D signing did not start"); await shot("failed"); return; }
  console.log(`   3D signing up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.waitForTimeout(2500);
  // (the words type out; software GL keeps the page busy, so give them time)
  try { await p.waitForFunction(() => /Sit down, son/.test(document.body.innerText), null, { timeout: 90000 }); } catch { /* checked below */ }
  ok(await shown(/Sit down, son/), "his first line is not on screen");
  ok(await shown(/MANAGER/), "no speaker name");
  ok(await bigCanvases() >= 1, "no 3D canvas on screen");
  const title = await p.evaluate(() => document.body.innerText);
  ok(new RegExp(`signing for ${o.club}`, "i").test(title), `the title does not say Signing for ${o.club}`);
  await shot("1-talk");
  // Software GL keeps the page busy for about a second a frame, so a tap's press and its release (stamped when the browser makes them)
  // would be further apart than any finger's: the scene's own loop is frozen (debugStep draws one frame and stops it) around the taps.
  const freeze = () => p.evaluate(() => window.__sign3d.debugStep(0.1, 1));
  const settle = (n) => p.evaluate((n) => window.__sign3d.debugStep(0.1, n), n);
  await freeze();
  // line 1 -> the whole line (a tap on the words), then the next line (a tap on the picture: the words are not there)
  await tapAt(W / 2, H - 90); await p.waitForTimeout(500);
  for (let i = 0; i < 3 && (await p.evaluate(() => window.__sign3d.debugInfo().mode)) !== "reply"; i++) {
    await tapAt(W / 2, H * 0.28);
    try { await p.waitForFunction(() => window.__sign3d.debugInfo().mode === "reply", null, { timeout: 12000 }); } catch { /* tap again */ }
  }
  ok(await p.evaluate(() => window.__sign3d.debugInfo().mode) === "reply", "a tap on the picture did not move to his reply shot");
  await settle(14); await p.waitForTimeout(900);
  await shot("2-reply");
  // the rest of the lines: tap, tap, ...
  for (let i = 0; i < 8; i++) {
    if (await shown(/TAP TO SIGN/)) break;
    const line = await p.evaluate(() => document.body.innerText.match(/(\d)\/5 · tap/)?.[1]);
    await tapAt(W / 2, H - 90); await p.waitForTimeout(700);
    await tapAt(W / 2, H * 0.28);
    try { await p.waitForFunction((l) => !document.body.innerText.includes(`${l}/5 · tap`) , line, { timeout: 15000 }); } catch { /* next round */ }
    await settle(2);
  }
  const reached = await shown(/TAP TO SIGN/);
  ok(reached, "the lines never reached TAP TO SIGN");
  if (!reached) { await shot("stuck"); return; }
  const wantTerms = o.terms ? await p.evaluate(() => document.body.innerText) : "";
  await settle(16); await p.waitForTimeout(900);
  await shot("3-contract");
  const b = await box(/^TAP TO SIGN$/);
  await tapAt(b.x + b.width / 2, b.y + b.height / 2);
  await p.waitForTimeout(800);
  ok(!(await shown(/TAP TO SIGN/)), "TAP TO SIGN stayed after it was pressed");
  // play the signing out on the scene's own clock (software GL draws a frame or two a second)
  await p.evaluate(() => window.__sign3d.debugStep(0.1, 24));
  await p.waitForTimeout(900);
  await shot("4-pen");
  await p.evaluate(() => window.__sign3d.debugStep(0.1, 16));
  await p.waitForTimeout(900);
  ok(await shown(/^SIGNED$/), "no SIGNED stamp");
  await shot("5-stamp");
  await p.evaluate(() => window.__sign3d.debugStep(0.1, 20));
  await p.waitForTimeout(1400);
  await shot("6-handshake");
  await p.evaluate(() => window.__sign3d.debugStep(0.1, 12));
  await p.waitForTimeout(1500);
  ok(await shown(/WELCOME TO/), "no WELCOME TO");
  ok(await shown(new RegExp(o.club, "i")), "the club's name is not on the last screen");
  await shot("7-done");
  if (o.press) {
    const cb = await box(/^Continue$/);
    await tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await p.waitForTimeout(4000);
    const now = await p.evaluate(() => window.__kibNav.stack.at(-1).name);
    console.log(`   Continue -> ${now}`);
    ok(now !== o.screen, `Continue did not leave the signing (still ${now})`);
    await p.waitForTimeout(2500);
    // the scene is let go with its screen (Walk3D tells the screen the controller is gone)
    ok(await p.evaluate(() => window.__sign3d == null), "the 3D signing's scene was not let go when the screen closed");
  }
  void wantTerms; void careerNow;
}

for (const [W, H] of SIZES) {
  if (ONLY.includes("trial")) await scenario("trial", W, H, seed(), async (c) => {
    await c.p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("career-signed"); });
    await playSigning(c, { club: "Arsenal", screen: "career-signed", press: true });
  });
  if (ONLY.includes("transfer")) await scenario("transfer", W, H, seed(), async (c) => {
    const offer = { club: "Chelsea", strength: 80, wage: 9000, goalBonus: 300, assistBonus: 150, seasons: 4, signingFee: 5000, clauses: {}, position: 3, pitch: "We want you." };
    await c.p.evaluate((offer) => { const n = window.__kibNav; n.home(); n.go("transfer-signing", { offer }); }, offer);
    await playSigning(c, { club: "Chelsea", screen: "transfer-signing", press: false });
    // the contract's terms are drawn on the paper inside the picture: read from the scene
    const info = await c.p.evaluate(() => window.__sign3d.debugInfo());
    console.log(`   scene: club ${info.club}, kit ${info.contractKit}`);
    ok(info.club === "Chelsea", "the contract is not for the new club");
  });
  if (ONLY.includes("office")) await scenario("office", W, H, seed(), async (c) => {
    const { p, W, H, tapAt, shot, shown, bigCanvases, box } = c;
    await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("career-relationship-game", { kind: "boss" }); });
    await p.waitForTimeout(2500);
    ok(await shown(/How do you spend them/), "the Boss page is not there");
    const row = await box(/^OFFICE TALK$/);
    ok(!!row, "no Office talk row");
    await tapAt(row.x + 40, row.y + 8);
    const t0 = Date.now();
    try { await waitFor(p, () => window.__office3d); } catch { ok(false, "the 3D office did not start"); await shot("failed"); return; }
    console.log(`   3D office up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await p.waitForTimeout(3000);
    ok(await shown(/QUESTION 1 \/ 3/), "no question line under the office");
    ok(await bigCanvases() >= 1, "no 3D canvas on the page");
    await p.evaluate(() => window.__office3d.debugStep(0.1, 12));
    await p.waitForTimeout(900);
    await shot("1-he-talks");
    ok(await p.evaluate(() => window.__office3d.debugInfo().mode) === "talk", "the office is not on his shot at the start");
    // pick the first reply with a real tap: the camera goes to you
    const rep = await p.evaluate(() => Array.from(document.querySelectorAll("[data-testid], div")).length);
    void rep;
    const first = p.locator("div").filter({ hasText: /^.{8,}$/ }).locator("xpath=.").first();
    void first;
    const bb = await p.evaluate(() => {
      // the blue reply buttons are the pressables under his line
      const els = Array.from(document.querySelectorAll("div")).filter((d) => getComputedStyle(d).borderColor.includes("147, 197, 253") && d.getBoundingClientRect().height > 30);
      const r = els[0]?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    });
    ok(!!bb, "no reply buttons");
    if (bb) {
      await tapAt(bb.x + bb.w / 2, bb.y + bb.h / 2);
      await p.waitForTimeout(500);
      ok(await p.evaluate(() => window.__office3d.currentShot()) === "reply", "picking a reply did not turn the camera to you");
      await p.evaluate(() => window.__office3d.debugStep(0.1, 12));
      await p.waitForTimeout(900);
      await shot("2-you-reply");
      await p.waitForTimeout(2200);
      ok(await p.evaluate(() => window.__office3d.currentShot()) === "talk", "the camera did not come back to him for the next question");
    }
    await shot("3-next");
    // Back leaves no GL canvas
    await p.evaluate(() => { const n = window.__kibNav; n.home(); });
    await p.waitForTimeout(3500);
    ok(await p.evaluate(() => window.__office3d == null), "the 3D office was not let go when the screen closed");
  });
  if (ONLY.includes("dugout")) await scenario("dugout", W, H, seed({ managerNews: "Oscar Bianchi has been sacked. Mikel Arteta takes over the dugout." }), async (c) => {
    const { p, shot, shown, tapAt, box, bigCanvases } = c;
    try { await waitFor(p, () => window.__office3d, 200000); } catch { ok(false, "the 3D office did not start on Home"); await shot("failed"); return; }
    await p.waitForTimeout(3500);
    ok(await shown(/IN THE DUGOUT/), "no In the dugout title");
    ok(await bigCanvases() >= 1, "no 3D canvas");
    await p.evaluate(() => window.__office3d.debugStep(0.1, 12));
    await p.waitForTimeout(900);
    await shot("1-dugout");
    const cb = await box(/^CONTINUE/);
    await tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await p.waitForTimeout(1500);
    const cn = await c.careerNow();
    ok(!cn.managerNews, "Continue did not clear the news");
    await shot("2-home");
  });
  if (ONLY.includes("captain")) await scenario("captain", W, H, seed({ captain: true, captainMomentPending: true }), async (c) => {
    const { p, shot, shown, tapAt, box, bigCanvases } = c;
    try { await waitFor(p, () => window.__office3d, 200000); } catch { ok(false, "the 3D office did not start for the armband"); await shot("failed"); return; }
    await p.waitForTimeout(3500);
    ok(await shown(/THE ARMBAND/), "no The armband title");
    ok(await bigCanvases() >= 1, "no 3D canvas");
    await p.evaluate(() => window.__office3d.debugStep(0.1, 12));
    await p.waitForTimeout(900);
    await shot("1-armband");
    const cb = await box(/^CONTINUE/);
    await tapAt(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await p.waitForTimeout(1500);
    const cn = await c.careerNow();
    ok(!cn.captainMomentPending, "Continue did not clear the flag");
    await shot("2-home");
  });
  if (ONLY.includes("fail")) await scenario("fail", W, H, seed({}, { "knowitball-safety\\off:3d": "1", "knowitball-safety\\wait:3d": "99" }), async (c) => {
    const { p, shot, shown, tapAt, box, bigCanvases } = c;
    // the crash guard has the 3D off (phone/src/safety.ts): the drawn signing and the plain talk, never a blank or a crash
    await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("career-signed"); });
    await p.waitForTimeout(4500);
    ok(await shown(/TAP TO SIGN/), "the drawn signing is not there with the 3D off");
    ok(await shown(/SIGN HERE/), "the drawn contract is not there");
    ok(await p.evaluate(() => !window.__sign3d), "the 3D signing started although the guard has it off");
    await shot("1-drawn-signing");
    await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("career-relationship-game", { kind: "boss" }); });
    await p.waitForTimeout(2500);
    const row = await box(/^OFFICE TALK$/);
    await tapAt(row.x + 40, row.y + 8);
    await p.waitForTimeout(3000);
    ok(await shown(/QUESTION 1 \/ 3/), "the plain office talk is not there with the 3D off");
    ok(await p.evaluate(() => !window.__office3d), "the 3D office started although the guard has it off");
    await shot("2-plain-talk");
  });
}
await browser.close();
await server.close?.();
console.log(failed ? `\n${failed} problem(s)` : "\nall good");
console.log(`pictures: ${OUT}/<scenario>-<spot>-<size>.jpg`);
process.exit(failed ? 1 : 0);
