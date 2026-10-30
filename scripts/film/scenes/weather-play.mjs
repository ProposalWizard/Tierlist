// The three match clips for the weather page (chat 4): wind-play, dry-pitch-play, rain-play.
//   node scripts/film/scenes/weather-play.mjs <port> <outDir> [wind|dry|rain ...]
// Each clip is two or three takes of the SAME strike (set through window.__starMatch.setBall,
// dev builds only), one per condition, so the only difference is the weather.
import * as rec from "../rec.mjs";
import { setDay, playIt, strikeAndSet, hideDevBadges, take } from "./weatherLib.mjs";
import { toWideChance } from "./weatherLib2.mjs";
import { finish } from "./weatherFinish.mjs";
import fs from "node:fs";
const [port = "3300", outDir = "docs/handoffs/2026-10-22-leo-tonight/chat4/film", ...which] = process.argv.slice(2);
const URL = `http://localhost:${port}/star-weather-dev`;
fs.mkdirSync(outDir + "/takes", { recursive: true });

// A long ball down the empty pitch in the third chance (the wind clip), from below the crowd in the box.
const LONG = { speed: 22, angle: 30, heading: Math.PI, from: { fx: 0.45, y: 19, z: 0.3 } };
// A lofted pass back into open grass in the third chance (39 x 78 m in view), from a fixed spot.
// All from 19 m out, so the halfway line (52.5 m) and centre circle are a fixed ruler in every take.
// Strengths picked (lib/star/weatherLab.ts flyBall, Old ball) so the clear-day ball stops inside the picture.
const LOFT = { speed: 15, angle: 40, heading: Math.PI, from: { fx: 0.5, y: 19, z: 0.3 } };   // clear ~43 m, worst dry ~33 m
const SKID = { speed: 13, angle: 6, heading: Math.PI, from: { fx: 0.5, y: 19, z: 0.3 } };    // clear ~23 m, rain ~44 m, heavy ~18 m

const CLIPS = {
  // Still air, then a 20 m/s gale left to right, then the same gale blowing up the screen (into the ball's face).
  wind: { takes: [[{ weather: "Clear" }, "wide"], [{ weather: "Windy", windDot: 2, windSpeed: 20 }, "wide"], [{ weather: "Windy", windDot: 0, windSpeed: 20 }, "wide"]], strike: LONG, hold: 5500 },
  // No wind in these (the page opens on a 10 m/s wind).
  dry: { takes: [[{ weather: "Clear" }, "wide"], [{ weather: "Clear", club: "Cleethorpes Town", dry: true }, "wide"]], strike: LOFT, hold: 7000 },
  rain: { takes: [[{ weather: "Clear" }, "wide"], [{ weather: "Rain", windSpeed: 0 }, "wide"], [{ weather: "Heavy rain", windSpeed: 0 }, "wide"]], strike: SKID, hold: 7000 },
};
const NAME = { wind: "wind-play", dry: "dry-pitch-play", rain: "rain-play" };

for (const key of which.length ? which : Object.keys(CLIPS)) {
  const c = CLIPS[key], outs = [];
  for (const [i, [day, chance]] of c.takes.entries()) {
    // A take that gets stuck between chances is filmed again from a fresh page (up to 6 tries).
    for (let attempt = 1; ; attempt++) {
      const { browser, page } = await rec.phone();
      try {
        await page.goto(URL, { waitUntil: "networkidle" });
        await hideDevBadges(page);
        await page.waitForTimeout(600);
        await setDay(page, day);
        await playIt(page);
        if (chance === "wide") await toWideChance(page);
        await page.locator("[data-playing]").scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        outs.push(await take(rec, page, `${outDir}/takes/${key}-${i}.mp4`, () => strikeAndSet(page, c.strike), c.hold));
        break;
      } catch (e) {
        if (attempt >= 6) throw e;
        console.log(`  ${key} take ${i}: ${String(e.message).split("\n")[0]} — again`);
      } finally {
        await browser.close();
      }
    }
  }
  const r = finish(outs, `${outDir}/${NAME[key]}.mp4`, { stillAt: 1.2 });
  console.log(NAME[key], r.seconds.toFixed(1) + " s", r.mb.toFixed(2) + " MB");
}
