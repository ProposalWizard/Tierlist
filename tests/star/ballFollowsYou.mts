import { buildScenario, SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { frameFromScenario } from "../../lib/star/scenarioFrame";
import { applyOverride, applyOverrideToScenario, ballFollowsYou } from "../../lib/star/scenarioEdit";

/**
 * In an 11-a-side chance the ball is at your feet. The editor never lets it be
 * placed on its own: drag yourself and it comes with you, at the builder's
 * own offset, and a stored ball position is ignored.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

for (const kind of SCENARIO_KINDS) {
  for (let seed = 1; seed <= 20; seed++) {
    const sc = buildScenario(kind, mulberry32(seed));
    const frame = frameFromScenario(sc);
    check(ballFollowsYou(frame), `${kind}: an 11-a-side frame carries the ball with you`);
    const you = frame.items.find((it) => it.side === "you")!;
    const off = { x: you.at.x - frame.ball.x, y: you.at.y - frame.ball.y };

    const moved = applyOverride(frame, { items: { [you.id]: { x: you.at.x + 5, y: you.at.y - 3 } }, ball: { x: 1, y: 1 } });
    const youNow = moved.items.find((it) => it.side === "you")!;
    check(near(youNow.at.x - moved.ball.x, off.x) && near(youNow.at.y - moved.ball.y, off.y),
      `${kind} seed ${seed}: the ball keeps its place at your feet when you are dragged`);

    const still = applyOverride(frame, { items: {}, ball: { x: 1, y: 1 } });
    check(near(still.ball.x, frame.ball.x) && near(still.ball.y, frame.ball.y),
      `${kind} seed ${seed}: a stored ball position on its own is ignored`);

    const live = buildScenario(kind, mulberry32(seed));
    applyOverrideToScenario(live, { items: { [you.id]: { x: you.at.x + 5, y: you.at.y - 3 } }, ball: { x: 1, y: 1 } });
    check(near(live.player.x - live.ball.x, off.x) && near(live.player.y - live.ball.y, off.y),
      `${kind} seed ${seed}: the saved scenario keeps the ball at your feet too`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of [...new Set(problems)].slice(0, 20)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — in the 11-a-side editor the ball rides at your feet, at the game's own offset");
