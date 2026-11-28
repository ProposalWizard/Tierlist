/**
 * THE GYM'S MINI-GAMES, MEASURED (gym phase 2): each new game played by the bot thumb at 30 and 120
 * frames a second (a good thumb) and at 60 (a poor one), with how long it lasted, its grade and its
 * words. Run: npx tsx scripts/gym/tune.mts
 */
import { GYM2_KINDS, start2, step2, result2, botHold2 } from "../../lib/star/gym/games2";

for (const k of GYM2_KINDS) {
  const row: string[] = [];
  for (const [fps, skill] of [[30, 1], [120, 1], [60, 0]] as const) {
    let s = start2(k, 1, 3); let n = 0;
    while (!s.done && n++ < 100000) s = step2(s, 1 / fps, botHold2(s, skill));
    const r = result2(s);
    row.push(`${fps} fps, ${skill ? "good" : "poor"}: ${s.t.toFixed(1)} s, grade ${r.quality}${r.failed ? " FAILED" : ""} "${r.headline}"`);
  }
  const fixed = (fps: number) => { let s = start2(k, 1, 3); for (let i = 0; i < fps * 45 && !s.done; i++) s = step2(s, 1 / fps, Math.floor(s.t * 2.5) % 3 !== 0); return result2(s).quality; };
  console.log(`${k}\n  ${row.join("\n  ")}\n  fixed thumb: ${fixed(30)} at 30 fps, ${fixed(120)} at 120 fps`);
}
