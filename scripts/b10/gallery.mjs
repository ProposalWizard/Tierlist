// B10: the Scenario Gallery offers Header and Volley again (to Simulate, and to draw).
//   node scripts/b10/gallery.mjs [--url=http://localhost:3041] [--out=docs/handoffs/2026-10-20-builds/b10]
import { phone } from "../film/rec.mjs";
const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3041");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b10");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { browser, page } = await phone({ deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL0}/star-gallery-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(8000);
await page.getByText("11-A-SIDE").first().click();
await wait(6000);
const text = await page.locator("body").innerText();
console.log("header on the page:", /header/i.test(text), "volley on the page:", /volley/i.test(text));
const chip = page.getByRole("button", { name: /^header/i }).first();
if (await chip.count()) { await chip.click(); await wait(4000); }
await page.screenshot({ path: `${OUT}/b10-gallery-header.jpg`, type: "jpeg", quality: 60 });
console.log("errors:", errors.length ? errors.slice(0, 3) : "none");
await browser.close();
