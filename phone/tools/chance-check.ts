// Plays chances through the phone's driver and counts outcomes (aimed at the far corner).
import { newChance, kick, step } from "../src/match/chance";
import { POST_L, POST_R } from "@/lib/star/pitch";
const kinds = ["one_on_one", "through_ball", "cutback", "long_range", "tight_angle"] as const;
for (const k of kinds) {
  const tally: Record<string, number> = {};
  for (let seed = 1; seed <= 200; seed++) {
    const s = { power: 60, technique: 60, vision: 60 };
    const ch = newChance(k, seed * 31, s);
    const b = ch.sc.ball;
    const tx = b.x < (POST_L + POST_R) / 2 ? POST_R - 0.6 : POST_L + 0.6;
    kick(ch, { x: tx - b.x, y: 0 - b.y }, 0.8, { cx: 0, cy: -0.1 }, s);
    let o = null; while (!o) o = step(ch);
    tally[o] = (tally[o] || 0) + 1;
  }
  console.log(k.padEnd(14), JSON.stringify(tally));
}
