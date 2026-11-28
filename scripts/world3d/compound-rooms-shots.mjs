#!/usr/bin/env node
// scripts/world3d/compound-rooms-shots.mjs — STILLS OF THE COMPOUND'S RECEPTION AND CANTEEN (lib/star/world3d/roomsPlace.ts),
// on a 390×844 phone at 1×, cookie banner and chat badge hidden. Each door → inside → back out; the reception desk and
// the receptionist's line; the canteen wide, at the counter with the lunch card, sat with a team-mate; and the club gym
// measured the same way (the rooms' budget is the gym's frame: roomsPlan.ts GYM_FRAME).
//
//   node scripts/world3d/compound-rooms-shots.mjs --out DIR [--base http://localhost:3115] [--q medium] [--only canteen,gym]
// Prints one line per still: its draws and triangles, and at the end the ROOMS_MEASURED lines to paste.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "compound-rooms-shots"));
const base = opt("base", "http://localhost:3115");
const q = opt("q", "medium");
const only = opt("only", null)?.split(",");
const want = (n) => !only || only.some((o) => n.includes(o));
fs.mkdirSync(outDir, { recursive: true });
const HIDE = ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}";

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { errors.push(e.message); console.error("pageerror", e.message); });
page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); console.error("console", m.text().slice(0, 300)); } });
const measured = [];
const ready = async () => { await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 }); await page.addStyleTag({ content: HIDE }); };
const waitPlace = async (pl) => { await page.waitForFunction((p) => window.__world3d?.debug?.().place === p, pl, { timeout: 300000 }); await page.addStyleTag({ content: HIDE }); };
const shot = async (name, room) => {
  const s = await page.evaluate(() => window.__world3d?.stats?.() ?? null);
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), quality: 86 });
  console.log(name, s ? `${s.calls} draws, ${Math.round(s.triangles / 1000)}k triangles, ${s.tier}` : "");
  if (room && s) measured.push({ room, view: name, draws: s.calls, triangles: s.triangles });
};
const dbg = () => page.evaluate(() => window.__world3d.debug());
const tapId = (id) => page.evaluate((i) => window.__world3d.tapId(i), id);
const act = (a) => page.evaluate((x) => window.__world3d.act(x), a);
const idle = async (ms) => page.waitForTimeout(ms);
const untilStill = async (ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const d = await dbg(); if (d.you.state !== "walk" && d.you.state !== "turn" && d.you.state !== "enter") return d; await idle(400); } return dbg(); };

try {
  if (want("gym")) {
    // the club gym, its arrival view through the compound's door: the rooms' yardstick
    await page.goto(`${base}/star-world3d-dev?place=gym&bare=1&clean=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready(); await idle(4000);
    await shot("gym-0-walk-in", "gym");
    await page.evaluate(() => window.__world3d.teleport(0.6, 2.6, Math.PI)); await idle(1800);
    await shot("gym-0-middle", "gym");
  }
  if (want("urn")) {
    // the canteen down the leagues (the lunch card's "tea urn"): no chef, the urn and the sandwiches, strip lights
    for (const hall of ["urn", "canteen"]) {
      await page.goto(`${base}/star-world3d-dev?place=canteen&hall=${hall}&bare=1&clean=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      await ready(); await idle(4000);
      await page.evaluate(() => window.__world3dCam([5.6, 2.8, 4.2], [-1.5, 0.6, -2.0])); await idle(1500);
      await shot(`canteen-hall-${hall}-wide`, "canteen");
      await page.evaluate(() => window.__world3dCam([0.4, 1.7, -0.6], [0.4, 1.0, -3.4])); await idle(1500);
      await shot(`canteen-hall-${hall}-counter`, "canteen");
    }
  }
  for (const room of ["reception", "canteen"]) {
    if (!want(room)) continue;
    const door = room === "reception" ? 0 : 11;
    // 1. at the compound, at that door
    await page.goto(`${base}/star-world3d-dev?place=compound&bare=1&clean=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready(); await idle(3000);
    await page.evaluate((x) => window.__world3d.teleport(x - 0.6, 14.6, Math.PI * 0.95), door); await idle(1500);
    await tapId(`door-${room}`); await untilStill(); await idle(600);
    await shot(`${room}-1-door`);
    // 2. through it: the fade, the room fades in a step inside
    await act("use");
    await waitPlace(room); await idle(5000);
    await shot(`${room}-2-inside`, room);
    if (room === "reception") {
      // 3. the desk and the receptionist's line
      await tapId("staff-reception"); await untilStill(); await idle(1500);
      await shot("reception-3-desk-line", room);
      await act("close");
      // 4. wide: from the door's corner over the whole room (the crest wall, the cabinet, the sofa, the screen)
      await page.evaluate(() => window.__world3d.teleport(-2.2, 0.4, Math.PI)); await idle(800);
      await page.evaluate(() => window.__world3dCam([4.7, 2.6, 4.1], [-1.5, 1.4, -3.5])); await idle(1500);
      await shot("reception-4-wide", room);
      await page.evaluate(() => window.__world3dCam([-4.6, 2.4, 3.9], [3.5, 1.1, -0.6])); await idle(1500);
      await shot("reception-5-wide-east", room);
      await page.evaluate(() => window.__world3dCam(null));
      // 6. the trophy cabinet
      await tapId("cabinet"); await untilStill(); await idle(1500);
      await shot("reception-6-cabinet", room);
      await act("close");
      // 7. sat on the sofa, the fixture screen in front
      await tapId("sofa"); await untilStill(); await idle(800); await act("use"); await idle(4500);
      await shot("reception-7-sofa", room);
      { const d = await dbg(); console.log("seats", JSON.stringify(d.seats)); }
      await act("leave"); await idle(2500);
    } else {
      // 3. wide: the counter, the chef, the team-mates eating
      await page.evaluate(() => window.__world3d.teleport(-0.6, -1.5, Math.PI)); await idle(800);
      await page.evaluate(() => window.__world3dCam([1.2, 2.7, 4.2], [-3.0, 0.6, -1.4])); await idle(1500);
      await shot("canteen-3-wide", room);
      await page.evaluate(() => window.__world3dCam([-1.0, 2.7, 4.2], [3.6, 0.6, -1.4])); await idle(1500);
      await shot("canteen-4-wide-west", room);
      await page.evaluate(() => window.__world3dCam(null));
      // 5. at the counter: the lunch card's plates (wait till lunch first: the card's own button)
      await tapId("counter"); await untilStill(); await idle(1500);
      await shot("canteen-5-counter-card", room);
      const wait = await page.$("[data-lunch-card] button:has-text('Wait till')");
      if (wait) { await wait.click(); await idle(600); }
      await shot("canteen-6-counter-lunch-open", room);
      const plate = await page.$("[data-plate=protein]");
      if (plate) { await plate.click(); await idle(800); }
      await shot("canteen-7-ate", room);
      await page.click("[data-lunch-close]"); await idle(800);
      // 8. sit with a team-mate: his table options
      await tapId("mate-0"); await untilStill(); await idle(800); await act("use"); await idle(5000);
      await shot("canteen-8-sat-with-mate", room);
      const ch = await page.$("[data-lunch-table] button:has-text('Chat')");
      if (ch) { await ch.click(); await idle(800); }
      await shot("canteen-9-chat", room);
      const d = await dbg();
      console.log("seats", JSON.stringify(d.seats), "minGap", d.minGap);
      await page.click("[data-lunch-close]"); await idle(3500);
    }
    // back: the pill, out of the same door onto the forecourt
    const back = await page.$("[data-world3d-back]");
    if (back) { await back.click(); await waitPlace("compound"); await idle(5000); await shot(`${room}-9-back-out`); }
    const d = await dbg();
    console.log(room, "back at", JSON.stringify({ x: d.you.x, z: d.you.z }));
  }
} finally {
  console.log("\nROOMS_MEASURED:");
  for (const m of measured) console.log(`  { room: "${m.room}", view: "${m.view}", draws: ${m.draws}, triangles: ${m.triangles} },`);
  console.log(errors.length ? `${errors.length} page errors` : "0 page errors");
  await browser.close();
}
