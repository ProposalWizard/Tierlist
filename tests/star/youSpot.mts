import { buildScenario, SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { clearYouSpot, coversBallOrArrow, type SpotInput } from "../../lib/star/youSpot";
import { hasRunup } from "../../lib/star/penaltyRunup";

/**
 * YOUR MAN ON EVERY CHANCE, NEVER OVER THE BALL OR THE ARROW (Mikey, 20 Oct 2026).
 *
 * The picture uses the match's straight view: pitch metres → pixels through
 * the chance's own viewport on a 390 × 620 phone canvas, with the figure and
 * ball sized the way CanvasMatch sizes them at normal zoom (R = unit × 1.15 ×
 * 0.8 × 0.8, ball = unit × 0.5 × 0.56). The match passes its live sizes.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const W = 390, H = 620;
const rows: string[] = [];

for (const kind of SCENARIO_KINDS) {
  if (hasRunup(kind)) continue; // penalties and free kicks keep their run-up spot
  let before = 0, after = 0, moved = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const sc = buildScenario(kind, mulberry32(i * 97 + 5), 70, 50, 60);
    const vp = sc.viewport;
    const toPx = (x: number, y: number) => ({ px: ((x - vp.x1) / (vp.x2 - vp.x1)) * W, py: ((y - vp.y1) / (vp.y2 - vp.y1)) * H });
    const unit = W / (vp.x2 - vp.x1);
    for (const foot of [1, -1]) {
      const s: SpotInput = { ball: sc.ball, player: { ...sc.player }, foot, toPx, R: unit * 1.15 * 0.8 * 0.8, ballR: Math.max(3, unit * 0.5 * 0.56), arrowM: (vp.y2 - vp.y1) * 0.132 * 1.05 };
      n++;
      if (coversBallOrArrow(s.player, s)) before++;
      const spot = clearYouSpot(s);
      if (coversBallOrArrow(spot, s)) after++;
      const d = Math.hypot(spot.x - s.player.x, spot.y - s.player.y);
      moved = Math.max(moved, d);
      check(Math.hypot(spot.x - sc.ball.x, spot.y - sc.ball.y) < 3.5, `${kind}: he stays within 3.5 m of the ball`);
    }
  }
  rows.push(`${kind.padEnd(14)} covered before ${(100 * before / n).toFixed(0).padStart(3)}%  after ${(100 * after / n).toFixed(0).padStart(3)}%  biggest move ${moved.toFixed(1)} m`);
  check(after / n <= 0.01, `${kind}: covers the ball or arrow after the rule ${(100 * after / n).toFixed(1)}%`);
}
console.log(rows.join("\n"));
if (problems.length) { console.log("FAIL youSpot"); for (const x of [...new Set(problems)].slice(0, 12)) console.log("  ✗ " + x); process.exit(1); }
console.log("PASS youSpot");
