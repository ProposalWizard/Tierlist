// Stills for the 3D Scene Editor, step 3 part 1 (Signing + Office live; director free camera + map).
// node scripts/scene-editor-step3a.mjs <outDir>   (dev server on :3047; never calls the real database)
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.argv[2] ?? "/tmp/se3a";
const BASE = process.env.BASE ?? "http://localhost:3047";
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(vp, place) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const posts = [];
  await page.route("**/api/star/cutscene-edits**", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: { edits: {}, migrationMissing: true } });
    posts.push(r.request().postDataJSON());
    return r.fulfill({ status: 503, json: { error: "fake", migrationMissing: true } });
  });
  page.on("pageerror", (e) => log("  PAGE ERROR", e.message));
  await page.goto(`${BASE}/star-scene-editor-dev?place=${place}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => window.__editorReady === true, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  return { ctx, page, posts };
}
const view = (page, name) => page.locator(".se-view").screenshot({ path: `${OUT}/${name}.png` });
const full = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
async function aboveFold(page, sels) {
  const vh = page.viewportSize().height;
  const r = {};
  for (const s of sels) {
    const b = await page.locator(s).first().boundingBox();
    r[s] = b ? Math.round(b.y + b.height) <= vh ? `ok (bottom ${Math.round(b.y + b.height)} ≤ ${vh})` : `BELOW (bottom ${Math.round(b.y + b.height)} > ${vh})` : "missing";
  }
  return r;
}
const KEYS = ["[data-play]", "[data-save-shared]", ".se-place", ".se-view"];
async function setRange(page, sel, v) {
  await page.locator(sel).first().evaluate((el, val) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);
}

for (const place of ["signing", "office"]) {
  log(`== ${place} (1440x900)`);
  const { ctx, page, posts } = await open({ width: 1440, height: 900 }, place);
  await full(page, `${place}-pc`);
  log("  above fold:", JSON.stringify(await aboveFold(page, KEYS)));
  await view(page, `${place}-0-talk`);
  // pick another shot
  const other = place === "signing" ? "contract" : "reply";
  await page.click(`[data-shot="${other}"]`);
  await page.waitForTimeout(2500);
  log("  shot now:", await page.locator("[data-shotname]").innerText());
  await view(page, `${place}-1-shot-${other}`);
  // lens on that shot
  await setRange(page, "[data-lens]", 80);
  await page.waitForTimeout(1500);
  await view(page, `${place}-2-lens80`);
  log("  pos fields:", await page.locator('[data-vec="pos"] input').evaluateAll((els) => els.map((e) => e.value)));
  // move the camera (type a number)
  await page.locator('[data-vec="pos"] input').first().fill("1.2");
  await page.waitForTimeout(1500);
  await view(page, `${place}-3-posx`);
  // light: strength, angle, colour, exposure
  await setRange(page, "[data-keylight]", 3);
  await setRange(page, "[data-keyangle]", 120);
  await page.locator("[data-keycolor]").first().evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, "#3b82f6"); el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(1500);
  await view(page, `${place}-4-light`);
  await setRange(page, "[data-exposure]", 0.5);
  await page.waitForTimeout(1500);
  await view(page, `${place}-5-exposure`);
  if (place === "signing") {
    await page.click('[data-shot="sign"]');
    await page.waitForTimeout(3000);
    await view(page, `${place}-6-sign`);
    await page.click('[data-shot="shake"]');
    await page.waitForTimeout(3000);
    log("  shot now:", await page.locator("[data-shotname]").innerText());
    await view(page, `${place}-7-shake`);
  }
  await page.click("[data-save-shared]");
  await page.waitForTimeout(800);
  log("  save msg:", await page.locator("[data-savemsg]").innerText());
  log("  POST scriptId:", posts.map((p) => p.scriptId).join(","), "keys:", posts.map((p) => Object.keys(p.edits).join("/")).join(","));
  log("  local:", (await page.evaluate((k) => localStorage.getItem(k), `star-scene-editor:${place}`))?.slice(0, 200));
  await full(page, `${place}-pc-edited`);
  await ctx.close();

  log(`== ${place} (phone 390x844)`);
  const ph = await open({ width: 390, height: 844 }, place);
  await full(ph.page, `${place}-phone`);
  log("  above fold:", JSON.stringify(await aboveFold(ph.page, KEYS)));
  await ph.ctx.close();
}

log("== director free camera + map (1440x900)");
{
  const { ctx, page } = await open({ width: 1440, height: 900 }, "director");
  log("  above fold:", JSON.stringify(await aboveFold(page, KEYS)));
  await view(page, "director-0");
  const box = await page.locator(".se-canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4 + 160, box.y + box.height * 0.5 + 40, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  log("  free:", await page.locator("[data-free]").first().innerText());
  await view(page, "director-1-free");
  await full(page, "director-pc");
  await ctx.close();
  const ph = await open({ width: 390, height: 844 }, "director");
  log("  phone above fold:", JSON.stringify(await aboveFold(ph.page, KEYS)));
  await full(ph.page, "director-phone");
  await ph.ctx.close();
}
await browser.close();
