// Drift probe: opens a screen, finds the CanvasMatch behind each canvas (React fiber), and prints
// canvas size + the props the engine was given.
// Usage: node probe.mjs <path> <w>x<h> [click regex ...]   (dev server on BASE, default :3050)
import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
const [path, size, ...clicks] = process.argv.slice(2);
const [W, H] = size.split("x").map(Number);
const BASE = process.env.BASE || "http://localhost:3050";
const opts = { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"], viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 600, isMobile: W < 600 };
// PROFILE keeps localStorage between runs (a career made once at /star-dev).
const browser = process.env.PROFILE ? null : await chromium.launch(opts);
const ctx = browser ? await browser.newContext(opts) : await chromium.launchPersistentContext(process.env.PROFILE, opts);
const b = browser || ctx;
const pg = ctx.pages()[0] || await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
for (let i = 0; i < 8; i++) { // the dev server is shared with other builders; wait it out
  try { await pg.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 }); break; } catch (e) { if (i === 7) throw e; await pg.waitForTimeout(15000); }
}
await pg.waitForTimeout(Number(process.env.WAIT || 6000));
if (process.env.NEWCAREER) {
  const inputs = pg.locator("input");
  if (await inputs.count()) {
    await inputs.first().fill("Test"); await inputs.nth(1).fill("Striker");
    for (const re of [/Next|Continue/i, /Next|Continue/i, /Arsenal/i, /Start Career/i, /Start|Begin|Continue/i]) { try { await pg.locator("button:visible").filter({ hasText: re }).first().click({ timeout: 6000 }); } catch {} await pg.waitForTimeout(1800); }
    await pg.waitForTimeout(3000);
  }
}
for (const c of clicks) {
  const txt = c.startsWith("~");
  const re = new RegExp(txt ? c.slice(1) : c.startsWith("@") ? "x" : c, "i");
  const btn = c.startsWith("@") ? pg.locator(c.slice(1)).first() : txt ? pg.getByText(re).first() : pg.locator("button:visible").filter({ hasText: re }).first();
  try { await btn.click({ timeout: 8000 }); } catch { console.log("noclick:", c); }
  await pg.waitForTimeout(Number(process.env.STEP || 5000));
}
console.error("evaluating"); const out = await pg.evaluate(() => {
  const KEYS = ["dragReferenceHeightPx","skills","keeperStrength","forceKeeperStrength","oppStrength","position","pressure","conditions","fatigueResetEvery","neverHooked","bare","scene","canCurve","canExtraTouch","seed","penaltyRunup","freeKickRunup","teamRelationship","startMinute","setPieceSkill","penaltyRead","dribbleOnly"];
  const res = [];
  const live = (f) => { if (!f.alternate) return f; return { ...f, memoizedProps: { ...f.alternate.memoizedProps, ...Object.fromEntries(Object.entries(f.memoizedProps).filter(([, v]) => v !== undefined)) } }; };
  for (const cv of document.querySelectorAll("canvas")) {
    const r = cv.getBoundingClientRect();
    if (r.width < 100) continue;
    const key = Object.keys(cv).find((k) => k.startsWith("__reactFiber$"));
    let f = key ? cv[key] : null; let props = null; let rootBox = null;
    while (f) { const t = f.type; const n = t && (t.displayName || t.name); if (n === "CanvasMatch") { f = live(f); props = f.memoizedProps; let c = f.child; while (c && typeof c.type !== "string") c = c.child; if (c && c.stateNode && c.stateNode.getBoundingClientRect) { const q = c.stateNode.getBoundingClientRect(); rootBox = `${Math.round(q.width)}x${Math.round(q.height)}`; } break; } f = f.return; }
    const pr = cv.parentElement.getBoundingClientRect();
    // is the match's left/right edge cut off by an ancestor that clips?
    let clip = null; { const rr = cv.parentElement.getBoundingClientRect(); for (let a = cv.parentElement.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.overflowX === "visible") continue; const q = a.getBoundingClientRect(); if (q.left > rr.left + 1 || q.right < rr.right - 1) { clip = `${a.className.toString().slice(0, 30)} ${Math.round(q.width)}`; break; } } }
    const o = { box: `${Math.round(pr.width)}x${Math.round(pr.height)}`, canvas: `${Math.round(r.width)}x${Math.round(r.height)}`, boxTop: Math.round(pr.y), root: rootBox, clip, hscroll: document.documentElement.scrollWidth > innerWidth, engine: !!props };
    if (props) {
      o.career = props.career ? { club: props.career.player?.club, sq: (props.career.squad || []).length, ls: Object.keys(props.career.leagueSquads || {}).length } : null;
      for (const k of KEYS) if (k in props && props[k] !== undefined) { const v = props[k]; o[k] = typeof v === "function" ? "fn" : (typeof v === "object" && v ? JSON.stringify(v).slice(0, 90) : v); }
    }
    res.push(o);
  }
  return { vw: innerWidth, vh: innerHeight, canvases: res, text: document.body.innerText.slice(0, 160).replace(/\n/g, " | ") };
});
if (process.env.BTNS) console.log("BUTTONS:", (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 30).join(" | "));
console.log(JSON.stringify({ path, size, ...out, errs: [...new Set(errs)].slice(0, 3) }));
if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT });
await b.close();
