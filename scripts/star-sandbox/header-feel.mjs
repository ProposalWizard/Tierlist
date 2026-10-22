/**
 * scripts/star-sandbox/header-feel.mjs — play one Head & Volley header level
 * on /star-training-dev at phone size (390 x 844) with Match feel: New, and
 * save stills: the aim, the strike screen (with the jump line), the contact
 * moment (freeze + punch) and the result. Headers piece 5, 22 Oct 2026.
 *
 *   node scripts/star-sandbox/header-feel.mjs --url http://localhost:3103 --level 29 --out DIR
 *
 * Reports console errors, whether /sfx/match-header.mp3 was fetched, and the
 * pitch box on the glass (window.__starMatch.frame().box).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL = val("--url", "http://localhost:3103");
const LEVEL = Number(val("--level", "29"));
const OUT = val("--out", "/tmp/header-feel"); mkdirSync(OUT, { recursive: true });
const TAG = val("--tag", `L${LEVEL}`);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const pg = await ctx.newPage();
const errors = [], sfx = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { if (m.type() === "error" && !/sentry|posthog|status of (404|400)|favicon/i.test(m.text())) errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
pg.on("request", (r) => { if (/\/sfx\//.test(r.url())) sfx.push(r.url().replace(/^.*\/sfx\//, "")); });
const snap = (n) => pg.screenshot({ path: `${OUT}/${TAG}-${n}.png` });

await pg.goto(`${URL}/star-training-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(() => { localStorage.setItem("star-match-feel", "new"); });
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.getByRole("tab", { name: /Aerial/ }).click();
const tile = pg.locator(`button.tr-tile[data-level="${LEVEL}"]`);
await tile.click(); await pg.waitForTimeout(300); await tile.click();
await pg.waitForTimeout(2500);
// Any intro: press its start button.
for (const re of [/^Start/i, /Let's go/i, /^Go/i, /Play/i]) {
  const b = pg.locator("button:visible").filter({ hasText: re }).first();
  if (await b.count()) { try { await b.click({ timeout: 1500 }); await pg.waitForTimeout(1200); } catch {} }
  if (await pg.evaluate(() => !!window.__starMatch)) break;
}
await pg.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim", null, { timeout: 60000 });
await pg.waitForTimeout(1200);
const fr = await pg.evaluate(() => { const f = window.__starMatch.frame(); return { kind: f.kind, box: f.box, airZ: f.sc.airZ, ball: window.__starMatch.ball(), goal: window.__starMatch.goal() }; });
console.log("chance:", fr.kind, "airZ", fr.airZ, "box", JSON.stringify(fr.box));
await snap("1-aim");
// Pull back from the ball, away from the goal.
const { ball, goal } = fr;
const dx = ball.x - goal.x, dy = ball.y - goal.y, L = Math.hypot(dx, dy) || 1;
await pg.mouse.move(ball.x, ball.y); await pg.mouse.down();
for (let i = 1; i <= 14; i++) { await pg.mouse.move(ball.x + (dx / L) * 90 * i / 14, ball.y + (dy / L) * 90 * i / 14); await pg.waitForTimeout(16); }
await pg.mouse.up();
await pg.waitForTimeout(700);
const jumpLine = await pg.locator("[data-header-jump]").first().textContent().catch(() => null);
console.log("strike screen jump line:", jumpLine);
await snap("2-strike-screen");
const b = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
const bb = await b.boundingBox();
if (!bb) { console.log("no contact ball"); } else {
  const r = bb.width / 2;
  await pg.mouse.click(bb.x + r, bb.y + r - 0.35 * r);
  await pg.waitForTimeout(150); await snap("3-read");
  // The strike lands ~420 ms after the tap (the read shows), then the beat + freeze.
  await pg.waitForFunction(() => window.__starMatch.phase() !== "contact", null, { timeout: 5000 }).catch(() => {});
  for (const [ms, n] of [[0, "4-contact-0ms"], [60, "5-contact-60ms"], [140, "6-contact-200ms"], [400, "7-flight"]]) { await pg.waitForTimeout(ms); await snap(n); const st = await pg.evaluate(() => window.__starMatch.ballState()); if (st) console.log(`  ${n}: ball x ${st.pos.x.toFixed(1)} y ${st.pos.y.toFixed(1)} z ${st.z.toFixed(2)} vel ${st.vel.x.toFixed(1)},${st.vel.y.toFixed(1)} vz ${st.vz.toFixed(1)} last ${JSON.stringify((st.actionLog ?? []).slice(-1)[0]?.kind ?? null)}`); }
  await pg.waitForTimeout(2500); await snap("8-result");
}
console.log("sfx fetched:", [...new Set(sfx)].join(", ") || "(none)");
console.log("errors:", errors.length ? [...new Set(errors)].slice(0, 6).join("\n") : "(none)");
await browser.close();
