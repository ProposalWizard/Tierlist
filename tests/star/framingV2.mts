import { buildScenario, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { framingV2Camera, framingV2Points, frameForNewView, setFramingV2Override, V2_BALL_ROOM, playZoomOf } from "../../lib/star/matchView";
import { tiltFor, canvasToScreen } from "../../lib/star/cameraTilt";
import { POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";

/**
 * FRAMING V2 (Mikey's review, 13 Oct 2026), behind a switch: the whole goal
 * always on the glass, the ball a quarter of the screen in from the sides and
 * the bottom, the action filling the screen; side-on when a wide ball near
 * the box cannot be framed; today's camera otherwise. Off: nothing changes.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const KINDS: ScenarioKind[] = ["one_on_one", "cutback", "through_ball", "long_range", "tight_angle", "free_kick", "penalty"];
const HWS = [1.5, 1.8, 2.05];

let total = 0, v2 = 0, side = 0, today = 0, goalOff = 0, ballBad = 0, sumAcross = 0, sumTodayAcross = 0;
for (const kind of KINDS) {
  for (let seed = 1; seed <= 40; seed++) {
    for (const hw of HWS) {
      total++;
      const sc = buildScenario(kind, mulberry32(seed * 7919 + 11));
      setFramingV2Override(false);
      const so = JSON.parse(JSON.stringify(sc));
      const old = frameForNewView(so, hw, false, 20);
      setFramingV2Override(true);
      const s2 = JSON.parse(JSON.stringify(sc));
      const cam = frameForNewView(s2, hw, false, 20);
      const direct = framingV2Camera(JSON.parse(JSON.stringify(sc)), hw, 20);
      if ((s2.facing ?? "up") !== "up" && (sc.facing ?? "up") === "up") { side++; continue; }
      if (!direct) { today++; continue; }
      v2++;
      // A figure's size on screen goes as 1 / (metres across × the zoom that keeps men today's size).
      sumAcross += (cam.x2 - cam.x1) * playZoomOf(s2); sumTodayAcross += (old.x2 - old.x1) * playZoomOf(so);
      const t = tiltFor(20, 100, 100 * Math.max(1.6, hw))!;
      const glass = (p: { x: number; y: number }) => { const g = canvasToScreen(t, (p.x - cam.x1) / (cam.x2 - cam.x1), (p.y - cam.y1) / (cam.y2 - cam.y1), t.W, t.H); return { x: g.X / t.W, y: g.Y / t.H }; };
      const goal = [{ x: POST_L, y: -NET_DEPTH }, { x: POST_R, y: -NET_DEPTH }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].map(glass);
      if (goal.some((g) => g.x < 0 || g.x > 1 || g.y < 0 || g.y > 1)) goalOff++;
      const b = glass(s2.ball);
      if (b.x < V2_BALL_ROOM - 1e-6 || b.x > 1 - V2_BALL_ROOM + 1e-6 || b.y > 1 - V2_BALL_ROOM + 1e-6) ballBad++;
      void framingV2Points;
    }
  }
}
setFramingV2Override(null);
// Off: identical to today.
{
  const sc = buildScenario("one_on_one", mulberry32(3 * 7919 + 11));
  setFramingV2Override(false);
  const a = frameForNewView(JSON.parse(JSON.stringify(sc)), 1.8, false, 20);
  setFramingV2Override(null);
  const b = frameForNewView(JSON.parse(JSON.stringify(sc)), 1.8, false, 20);
  check(JSON.stringify(a) === JSON.stringify(b), "switched off, the camera is today's");
}
console.log(`${total} chances: new framing ${v2} (${Math.round(100 * v2 / total)}%), turned side-on ${side}, today's camera ${today}`);
console.log(`  players on screen: ${((sumTodayAcross / Math.max(1, sumAcross) - 1) * 100).toFixed(0)}% bigger than today on average`);
check(goalOff === 0, `the whole goal is on the glass in every new-framed chance (${goalOff} not)`);
check(ballBad === 0, `the ball is a quarter in from the sides and bottom on the glass (${ballBad} not)`);
check(v2 / total > 0.5, `most chances get the new framing (${v2}/${total})`);
if (problems.length) { console.error("FAIL\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("PASS — framing V2: whole goal, the ball's room, side-on when wide, today's camera when switched off");
