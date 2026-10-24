/**
 * HOW OFTEN each condition would happen if switched on (plannedDials), per
 * division, over 20 seasons of 38 home weeks for every club in it.
 *   npx tsx scripts/weather/howOften.mts
 */
import { plannedDials, buildConditions } from "../../lib/star/weatherLab";
import { pitchWord } from "../../lib/star/pitchQuality";
import * as C from "../../lib/star/clubs";

const DIVS: [string, readonly string[]][] = [
  ["Premier League", C.PREMIER_LEAGUE_CLUBS], ["Championship", C.CHAMPIONSHIP_CLUBS], ["League One", C.LEAGUE_ONE_CLUBS],
  ["League Two", C.LEAGUE_TWO_CLUBS], ["National League", C.NATIONAL_LEAGUE_CLUBS],
  ["National League North", C.NATIONAL_LEAGUE_NORTH_CLUBS], ["National League South", C.NATIONAL_LEAGUE_SOUTH_CLUBS],
  ["Step 3", [...C.STEP3_NORTH_CLUBS, ...C.STEP3_SOUTH_CLUBS]],
];
console.log("| Division | Clear | Windy | Rain | Heavy rain | Dry spell (any) | Dry on a poor/very poor pitch | Ball grabs at a crawl | Average wind on windy days |\n|---|---|---|---|---|---|---|---|---|");
for (const [name, clubs] of DIVS) {
  const n = { all: 0, clear: 0, wind: 0, rain: 0, heavy: 0, dry: 0, dryPoor: 0, grab: 0, windSum: 0 };
  clubs.forEach((club, ci) => {
    for (let season = 1; season <= 20; season++) for (let week = 1; week <= 38; week++) {
      const d = plannedDials(season + ci * 101, week, club);
      const c = buildConditions(d);
      n.all++; n[d.weather]++;
      if (d.weather === "wind") n.windSum += d.windSpeed;
      if (d.ground === "dry") { n.dry++; if (["poor", "very poor"].includes(pitchWord(d.pitch))) n.dryPoor++; }
      if (c.deadBelow) n.grab++;
    }
  });
  const p = (k: number) => `${(k / n.all * 100).toFixed(1)}%`;
  console.log(`| ${name} | ${p(n.clear)} | ${p(n.wind)} | ${p(n.rain)} | ${p(n.heavy)} | ${p(n.dry)} | ${p(n.dryPoor)} | ${p(n.grab)} | ${(n.windSum / Math.max(1, n.wind)).toFixed(1)} m/s |`);
}
