#!/usr/bin/env node
/**
 * The barber's stills at phone size (390 × 844, device scale 1), for checking by eye:
 *   node scripts/barber3d/shots.mjs OUTDIR [skin=deep] [head=h1] [hair type=coily] [style ...]
 * Street door → walking in → in the chair with the style list (a few styles tried on, the chair turning) → the
 * cut → the mirror → walking out → back on the street at the barber's door. Needs a dev server
 * (BASE=http://localhost:3112). Chrome with SwiftShader WebGL. The cookie banner and chat badge are hidden.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [out = ".", skin = "deep", head = "h1", texture = "coily", ...styles0] = process.argv.slice(2);
const styles = styles0.length ? styles0 : ["afro", "highTop", "locsLong", "waves"];
const BASE = process.env.BASE ?? "http://localhost:3112";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = [];
p.on("pageerror", (e) => errs.push(`PAGEERR ${e.message.slice(0, 200)}`));
p.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const hide = async () => p.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" }).catch(() => {});
const shot = async (name) => { await hide(); await p.waitForTimeout(400); const f = path.join(out, `${name}.png`); await p.screenshot({ path: f }); console.log(f); };
const wait = (ms) => p.waitForTimeout(ms);

// 1. the street, at the barber's door (its card)
await p.goto(`${BASE}/star-street-dev?bare=1&arrive=barber&walkers=2&skin=${skin}&head=${head}`, { timeout: 240000 });
await p.waitForSelector("[data-street3d=ready]", { timeout: 240000 });
await wait(2500);
await p.evaluate(() => { const c = window.__street3d; c?.place(-5.2, 8, -Math.PI / 2); });
await wait(1800);
await shot("01-street-barber-door");
// look at the shop front from the pavement opposite-ish
await p.evaluate(() => { window.__street3d?.debugCamera([1.6, 2.2, 13.2], [-7.4, 2.0, 7.6]); });
await wait(1200);
await shot("02-street-barber-front");
await p.evaluate(() => { window.__street3d?.debugCamera(null); });
// 2. through the door (the card's button)
const btn = await p.$("[data-street-card=barber] button");
if (btn) await btn.click(); else await p.evaluate(() => window.__street3d?.walkTo(-8.0, 8));
await p.waitForSelector("[data-barber3d=ready]", { timeout: 240000 });
await wait(1200);
await shot("03-inside-walking-in");
await p.waitForSelector("[data-barber-state=seated]", { timeout: 60000 });
await wait(1500);
await shot("04-in-the-chair-picker");
// 3. styles on your head, the chair turning (your hair type first)
await p.click(`[data-barber-texture=${texture}]`).catch(() => console.log("no texture", texture));
await wait(800);
let i = 0;
for (const s of styles) {
  const el = await p.$(`[data-barber-style=${s}]`);
  if (!el) { console.log("no style", s); continue; }
  await el.click();
  await wait(2600);
  await shot(`05-style-${++i}-${s}`);
}
// 4. pay and the cut
await p.click("[data-barber-beard='1']").catch(() => {});
await wait(1500);
await p.click("[data-barber-pay]");
await wait(1700);
await shot("06-the-cut");
await p.waitForSelector("[data-barber-done]", { timeout: 30000 });
await wait(1500);
await shot("07-in-the-mirror");
// 5. leave: stand, walk out, back on the street
await p.click("[data-barber-leave]");
await wait(2200);
await shot("08-walking-out");
await p.waitForSelector("[data-street3d=ready]", { timeout: 240000 });
await wait(2500);
await shot("09-back-on-the-street");
const stats = await p.evaluate(() => window.__street3d?.where?.());
console.log("street after:", JSON.stringify(stats));
console.log(errs.length ? `errors:\n  ${errs.join("\n  ")}` : "no page errors");
await b.close();
