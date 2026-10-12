// Where the game's served byline crosses put the ball (distance out from the goal line, distance
// wide of the goal's middle). Usage: npx tsx scripts/cam3d/bylineSpots.mts
import { servedChance } from "./served.mts";
const d: number[] = [], l: number[] = [];
for (let s = 1; s <= 300; s++) { const c = servedChance("byline_cross", s); if (c.sc.kind !== "byline_cross") continue; d.push(c.sc.ball.y); l.push(Math.abs(c.sc.ball.x - 34)); }
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))].toFixed(1); };
console.log(`${d.length} served byline crosses: out from the goal line min ${q(d, 0)} p50 ${q(d, 0.5)} p95 ${q(d, 0.95)} max ${q(d, 1)} m; wide of the middle min ${q(l, 0)} p50 ${q(l, 0.5)} max ${q(l, 1)} m`);
