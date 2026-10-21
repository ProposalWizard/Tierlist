/**
 * THE VISION CURVE — how often the modelled good player (tests/star/visionBot.ts)
 * passes each of the 30 Vision levels, on the level's own three pictures,
 * with every kick played by the real engine.
 *
 *   npx tsx scripts/vision/curve.mts            every level, 200 goes a picture
 *   npx tsx scripts/vision/curve.mts 1 10 30    just those levels
 *
 * Columns: first try (the level's first picture), any try (mean of its three
 * pictures), the level within three tries, and why the misses missed.
 */
import { readFileSync } from "node:fs";
import { levelConfig, levelSeedOf } from "../../lib/star/trainingLevelData";
import { TRAINING_LEVELS } from "../../lib/star/trainingLevels";
import { setVisionMoments, setVisionChecks, visionLevelPictures, visionAsk } from "../../lib/star/visionRound";
import { botTry, GOOD_PLAYER } from "../../tests/star/visionBot";
import { mulberry32 } from "../../lib/star/season";

setVisionMoments(JSON.parse(readFileSync("lib/star/data/visionMoments.json", "utf8")));
setVisionChecks(JSON.parse(readFileSync("lib/star/data/visionChecks.json", "utf8")));
const only = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= TRAINING_LEVELS);
const levels = only.length ? only : Array.from({ length: TRAINING_LEVELS }, (_, i) => i + 1);
const GOES = 200;

export function levelRates(n: number, goes = GOES) {
  const cfg = levelConfig("vision", n, {});
  const seed = levelSeedOf("vision", n, cfg);
  // The pictures a player climbing from level 1 meets at this level.
  const pics = visionLevelPictures(n, (k) => {
    const c = levelConfig("vision", k, {});
    return { ask: visionAsk(c), seed: levelSeedOf("vision", k, c) };
  }, 3);
  const why: Record<string, number> = {};
  const rates = pics.map((p, t) => {
    const r = mulberry32((seed * 31 + t * 977) >>> 0);
    let ok = 0;
    for (let g = 0; g < goes; g++) {
      const v = botTry(p, cfg, GOOD_PLAYER, r, (seed + t * 7919 + g * 104729) >>> 0).verdict;
      if (v.ok) ok++;
      else why[v.result] = (why[v.result] ?? 0) + 1;
    }
    return ok / goes;
  });
  const level = 1 - rates.reduce((a, p) => a * (1 - p), 1);
  return { cfg, pics, rates, first: rates[0], any: rates.reduce((a, b) => a + b, 0) / rates.length, level, why };
}

for (const n of levels) {
  const r = levelRates(n);
  const misses = Object.entries(r.why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ");
  console.log(
    `L${String(n).padStart(2)} ${r.cfg.kick ? "kick" : "tap "} ${r.cfg.window.toFixed(2)}s ${r.cfg.options}m ${r.cfg.traps}t ${r.cfg.margin.toFixed(2)}${r.cfg.offside ? " off" : "    "}`
    + ` | first ${(r.first * 100).toFixed(0).padStart(3)}%  any ${(r.any * 100).toFixed(0).padStart(3)}%  level ${(r.level * 100).toFixed(0).padStart(3)}%`
    + ` | pics ${r.pics.map((p) => `${p.options.length}/${p.traps}/${p.margin.toFixed(2)}${p.options.some((o) => o.trap === "offside") ? "o" : ""}`).join(" ")}`
    + (misses ? ` | ${misses}` : ""),
  );
}
