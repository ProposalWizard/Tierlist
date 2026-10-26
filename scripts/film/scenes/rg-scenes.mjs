// Real Goals + shootout keeper clips (chat 5, 23 Oct 2026). Needs a built server
// (`next start`, NEXT_PUBLIC_STAR_OFFLINE_DEV=1) on FILM_BASE (default :3300).
//   node scripts/film/scenes/rg-scenes.mjs rg-home rg-paths rg-banger-play rg-daily rg-fixer shootout-keeper
import { readFileSync } from "node:fs";
import { film, swipe, tap, strike, BASE } from "./rg-lib.mjs";

/** The easy, certain banger: Son v Burnley, struck from straight in front of where it went in (low). */
const SURE = "bg-sergiroberto-psg-2017";

/**
 * Strike until it goes in: a few pulls round the real line on the same chance
 * (↺ Again serves it again). Only the scoring try stays in the clip; the
 * misses are cut. Returns the result text.
 */
async function scoreIt(p, f) {
  const tries = [[0, 120, 0.35], [10, 120, 0.35], [-10, 120, 0.35], [0, 120, 0.7], [18, 120, 0.35], [-18, 120, 0.35], [5, 120, 0.05], [-5, 120, 0.05], [10, 120, 0.7], [-10, 120, 0.7], [25, 120, 0.35], [-25, 120, 0.35]];
  for (let i = 0; i < tries.length; i++) {
    if (i > 0) {
      await p.getByText("↺ Again").click();
      await p.waitForTimeout(2500);
      await p.evaluate(() => { const c = document.querySelector("[data-playing] canvas"); if (c) window.scrollBy(0, c.getBoundingClientRect().top - 60); });
      await p.waitForTimeout(500);
      f.keep();
      await p.waitForTimeout(400);
    }
    const m = f.mark();
    if (!(await strike(p, ...tries[i]))) { f.dropSince(m); continue; }
    await p.waitForSelector("[data-result]", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(300);
    const text = (await p.locator("[data-result]").innerText().catch(() => "")) ?? "";
    if (/Goal!/i.test(text)) {
      await p.evaluate(() => document.querySelector("[data-result]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      await p.waitForTimeout(1500);
      return { tries: i + 1, text };
    }
    f.dropSince(m);
    console.log(`  try ${i + 1} ${tries[i]}:`, text.replace(/\s+/g, " ").match(/You:[^↺]*/)?.[0]);
  }
  throw new Error("never scored");
}

const scenes = {
  async "rg-home"() {
    const f = await film("rg-home", { cpu: 6 });
    const p = f.page;
    await p.goto("about:blank");
    await f.start(); f.keep();
    await p.goto(`${BASE}/star-real-goals-dev`, { waitUntil: "commit" });
    await p.waitForSelector("[data-path-tile]");
    await p.waitForTimeout(1600);
    await f.still();
    await swipe(p, 330, 1400); await p.waitForTimeout(700);
    await swipe(p, 420, 1600); await p.waitForTimeout(1200);
    await swipe(p, -750, 1400); await p.waitForTimeout(600);
    await f.done();
  },

  async "rg-paths"() {
    const f = await film("rg-paths");
    const p = f.page;
    await p.goto(`${BASE}/star-real-goals-dev`); await p.waitForSelector("[data-path-tile]"); await p.waitForTimeout(800);
    await f.start(); f.keep(); await p.waitForTimeout(600);
    for (const id of ["pl", "worldies", "bangers"]) {
      await tap(p, `[data-path-tile="${id}"]`);
      f.cut();
      await p.waitForSelector(`[data-path="${id}"] [data-level]`, { timeout: 90000 });
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
      f.keep();
      await p.waitForTimeout(900);
      if (id === "bangers") await f.still();
      await swipe(p, 520, 1300); await p.waitForTimeout(400);
      // Slide the first stage's row along, as a thumb would.
      await p.evaluate(() => document.querySelector(".rg-row")?.scrollBy({ left: 340, behavior: "smooth" })); await p.waitForTimeout(900);
      await swipe(p, 600, 1300); await p.waitForTimeout(500);
      await swipe(p, -1400, 900);
      await tap(p, "[data-back-paths]"); await p.waitForTimeout(700);
    }
    await f.done();
  },

  async "rg-banger-play"() {
    const f = await film("rg-banger-play");
    const p = f.page;
    await p.goto(`${BASE}/star-real-goals-dev?play=${SURE}`);
    await p.waitForSelector(`[data-playing="${SURE}"] canvas`, { timeout: 90000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    await f.start(); f.keep();
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const c = document.querySelector("[data-playing] canvas"); if (c) window.scrollBy({ top: c.getBoundingClientRect().top - 60, behavior: "smooth" }); });
    // The real move plays, then the shot is yours.
    await p.waitForFunction(() => /Your turn/.test(document.querySelector("[data-caption]")?.textContent ?? ""), null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(900);
    const r = await scoreIt(p, f);
    console.log("tries", r.tries, r.text.replace(/\s+/g, " ").slice(0, 90));
    await f.still();
    await p.waitForTimeout(1500);
    await f.done();
  },

  async "rg-daily"() {
    // Today's daily goal is whatever the date gives; for a certain goal the
    // clock is set to the day Son v Burnley is the daily goal (append-only list).
    const f = await film("rg-daily");
    const p = f.page;
    const src = readFileSync("lib/star/realGoalDaily.ts", "utf8");
    const DAILY_START = src.match(/DAILY_START = "([\d-]+)"/)[1];
    const DAILY_LIST = [...src.slice(src.indexOf("DAILY_LIST: string[] = [")).matchAll(/"((?:bg-|wy)[^"]+)"/g)].map((m) => m[1]);
    const idx = DAILY_LIST.indexOf(SURE);
    if (idx >= 0) {
      const target = Date.parse(`${DAILY_START}T12:00:00Z`) + idx * 86400000;
      await p.addInitScript((t) => { const off = t - Date.now(); const real = Date.now.bind(Date); Date.now = () => real() + off; }, target);
    }
    await p.goto(`${BASE}/star-real-goals-dev`); await p.waitForSelector("[data-play-daily]"); await p.waitForTimeout(600);
    await f.start(); f.keep(); await p.waitForTimeout(1300);
    await tap(p, "[data-play-daily]");
    f.cut();
    await p.waitForSelector("[data-playing] canvas", { timeout: 90000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    f.keep(); await p.waitForTimeout(900);
    await p.evaluate(() => { const c = document.querySelector("[data-playing] canvas"); if (c) window.scrollBy({ top: c.getBoundingClientRect().top - 60, behavior: "smooth" }); });
    // Skip the build-up wait in the clip.
    f.cut();
    await p.waitForFunction(() => /Your turn/.test(document.querySelector("[data-caption]")?.textContent ?? ""), null, { timeout: 40000 }).catch(() => {});
    f.keep(); await p.waitForTimeout(600);
    await scoreIt(p, f);
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: "✕" }).first().click();
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await p.waitForSelector("[data-daily] .rg-ddone", { timeout: 10000 });
    await p.locator("[data-daily]").scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
    await f.still();
    await p.waitForTimeout(1200);
    console.log((await p.locator("[data-daily]").innerText()).replace(/\s+/g, " "));
    await f.done();
  },

  async "rg-fixer"() {
    const f = await film("rg-fixer");
    const p = f.page;
    await p.goto(`${BASE}/star-real-goals-dev?fix=1`);
    await p.waitForSelector("[data-banger-fixer] svg", { timeout: 90000 });
    await p.selectOption("[data-fix-pick]", "bg-adam-chelsea-2015");
    await p.locator("[data-banger-fixer]").scrollIntoViewIfNeeded();
    await p.evaluate(() => { const e = document.querySelector("[data-fix-pick]"); window.scrollBy(0, e.getBoundingClientRect().top - 20); });
    await p.waitForTimeout(500);
    await f.start(); f.keep(); await p.waitForTimeout(900);
    // Drag the shot spot (⚽) a little, then the end spot on the goal mouth.
    const ball = p.locator(".rg-fixpitch g circle").last();
    await ball.scrollIntoViewIfNeeded();
    let b = await ball.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
    for (let i = 1; i <= 20; i++) { await p.mouse.move(b.x + b.width / 2 + i * 2, b.y + b.height / 2 - i * 3); await p.waitForTimeout(40); }
    await p.mouse.up(); await p.waitForTimeout(800);
    await f.still();
    await swipe(p, 260, 800);
    const mouth = p.locator("[data-banger-fixer] svg").nth(1);
    b = await mouth.boundingBox();
    await p.mouse.move(b.x + b.width * 0.42, b.y + b.height * 0.3); await p.mouse.down();
    for (let i = 1; i <= 16; i++) { await p.mouse.move(b.x + b.width * (0.42 - i * 0.012), b.y + b.height * (0.3 + i * 0.012)); await p.waitForTimeout(40); }
    await p.mouse.up(); await p.waitForTimeout(900);
    await tap(p, ".rg-fixbtns .rg-dplay");
    f.cut();
    await p.waitForSelector("[data-playing] canvas", { timeout: 60000 });
    await p.evaluate(() => window.scrollTo(0, 0));
    f.keep(); await p.waitForTimeout(2500);
    await f.done();
  },

  async "shootout-keeper"() {
    const f = await film("shootout-keeper", { touch: false }); // the penalty drag needs a mouse, not touch emulation
    const p = f.page;
    await p.goto(`${BASE}/star-shootout-dev`);
    await p.waitForSelector("canvas", { timeout: 90000 }); await p.waitForTimeout(2500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await f.start(); f.keep(); await p.waitForTimeout(1200);
    let kicks = 0, guard = 0;
    while (kicks < 4 && guard++ < 14) {
      await p.waitForFunction(() => /Another shootout|Next: You/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
      const again = p.getByText("Another shootout");
      if (await again.count()) { await again.click(); f.cut(); await p.waitForSelector("canvas"); await p.waitForTimeout(2500); f.keep(); }
      // Wait until it is your kick (the strip says "Next: You").
      f.cut();
      await p.waitForFunction(() => (/Next: You/.test(document.body.innerText) && !!document.querySelector("canvas")) || /Another shootout/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
      if (await p.getByText("Another shootout").count()) continue;
      await p.evaluate(() => { const c = document.querySelector("canvas"); if (c) window.scrollBy(0, c.getBoundingClientRect().top - 40); });
      f.keep();
      await p.waitForTimeout(500);
      if (!(await strike(p, -70, 115, 0.1))) { console.log("no strike, retry"); continue; }
      await p.waitForTimeout(2000);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await p.waitForTimeout(1100);
      // Count from the page's own list of your kicks.
      kicks = await p.evaluate(() => (document.body.innerText.match(/\d+ [←→↑] (Left|Right|Middle)/g) ?? []).length);
      if (kicks === 4) await f.still();
      console.log(`kick ${kicks}:`, (await p.locator("body").innerText()).replace(/\s+/g, " ").match(/(\d of your \d kicks[^R]*|\d kick →[^R]*)Reading you \d+%/)?.[0]);
    }
    await p.waitForTimeout(800);
    await f.done();
  },
};

for (const name of process.argv.slice(2)) {
  try { await scenes[name](); } catch (e) { console.log(`${name} FAILED: ${String(e).slice(0, 200)}`); }
}
