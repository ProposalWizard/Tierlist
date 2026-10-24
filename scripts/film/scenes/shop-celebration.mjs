/**
 * FILM: buying and equipping a celebration in the Store (Leo, chat 1, 23 Oct 2026).
 *
 *   node scripts/film/scenes/shop-celebration.mjs <port> <seed.json> <outDir> [itemName]
 *
 * Opens on the seed save with ★ topped up and the shop open, Home → Shop → … → Store,
 * opens the item (default "Roar", the day's pick at the top), buys it with ★ and
 * equips it. Writes <outDir>/shop.webm + shop.json (moments, seconds into the recording).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [PORT, SEED, OUT, ITEM = "Roar"] = process.argv.slice(2);
const KEY = "star-career-v2::anon";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const vidDir = path.join(OUT, "vid-shop");
fs.rmSync(vidDir, { recursive: true, force: true });
fs.rmSync(path.join(OUT, "prof-shop"), { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(path.join(OUT, "prof-shop"), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  recordVideo: { dir: vidDir, size: { width: 390, height: 844 } },
});
const T0 = Date.now();
const at = () => (Date.now() - T0) / 1000;
const log = (...a) => console.log(at().toFixed(1), ...a);
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message));
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await pg.addInitScript(([seed, key]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key));
  c.money = Math.max(c.money || 0, 5_000_000);
  // A new career keeps the shop shut until a drill or three games: open it for the clip
  if (c.unlocks) c.unlocks = { ...c.unlocks, open: [...new Set([...(c.unlocks.open || []), "shop", "store"])] };
  c.ownedAccessories = (c.ownedAccessories || []).filter((id) => !id.startsWith("celeb-"));
  c.equippedAccessories = Object.fromEntries(Object.entries(c.equippedAccessories || {}).filter(([s]) => s !== "celebration"));
  localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
}, [seed, KEY]);
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(7000);
const tap = async (re, label) => {
  for (let i = 0; i < 12; i++) {
    const b = pg.locator("button:visible, a:visible, [role=button]:visible").filter({ hasText: re }).first();
    if (await b.count()) { await b.click({ timeout: 3000 }).catch(() => {}); log("tap", label); return true; }
    await wait(500);
  }
  log("MISSING", label); await pg.screenshot({ path: path.join(OUT, `shop-missing-${label}.jpg`), type: "jpeg", quality: 60 });
  return false;
};
const marks = {};
// The topped-up ★ unlocks an achievement or two: close those pop-ups first
for (let i = 0; i < 4; i++) {
  const c = pg.locator("button:visible").filter({ hasText: /^close$/i }).first();
  if (!(await c.count())) break;
  await c.click().catch(() => {}); await wait(900);
}
marks.home = at();
await tap(/^Shop$|🛍️ *Shop|Shop/i, "shop"); await wait(2500);
// The shop's first-visit pointer tips: tap through them
for (let i = 0; i < 6; i++) {
  const g = pg.getByText(/^got it$/i).first();
  if (!(await g.isVisible().catch(() => false))) break;
  await g.click({ timeout: 2000 }).catch(() => {}); await wait(700);
}
await pg.locator("[data-shop-more]").first().click().catch(() => log("no more button")); await wait(1200);
await pg.locator('[data-shop-link="store"]').first().click().catch(() => log("no store link")); log("tap store"); await wait(3500);
marks.store = at();
// The celebrations: scroll the item into view and open it
const card = pg.getByText(ITEM, { exact: true }).first();
await card.scrollIntoViewIfNeeded().catch(() => {});
await wait(1200);
marks.card = at();
await card.click({ timeout: 5000 }).catch(() => log("no card"));
await wait(2200);
marks.sheet = at();
// the sheet's gold ★ button (the last ★ button on the page, over the cards)
await pg.locator("button:visible").filter({ hasText: /★/ }).last().click({ timeout: 4000 }).catch(() => log("no buy")); log("buy"); await wait(2200);
marks.bought = at();
await tap(/Use after my goals|^Wear$/i, "equip"); await wait(2500);
marks.end = at();
marks.errors = errors;
fs.writeFileSync(path.join(OUT, "shop.json"), JSON.stringify(marks, null, 1));
await pg.screenshot({ path: path.join(OUT, "shop-end.jpg"), type: "jpeg", quality: 60 });
await ctx.close();
const vids = fs.readdirSync(vidDir).map((f) => path.join(vidDir, f)).sort((a, z) => fs.statSync(z).size - fs.statSync(a).size);
fs.renameSync(vids[0], path.join(OUT, "shop.webm"));
log(JSON.stringify(marks));
