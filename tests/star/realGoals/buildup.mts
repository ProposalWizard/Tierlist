/**
 * Real Goals: how close the replayed build-up's ball is to the real ball.
 * For every goal with a lead-in: each real action of the move (where the ball
 * was, how long before the shot) against where the replay has the ball that
 * long before its own end. Before = the Real shots page's lead-in (last 2-3
 * passes, squeezed into 12 s, carries guessed); after = the Real Goals one.
 * Run: npx tsx tests/star/realGoals/buildup.mts
 */
import { loadGoals } from "./harness.mts";
import { leadinBallKeys } from "../../../lib/star/realMoments";
import { moveWindow, realBallKeys, realTouches, replayError, scenarioForGoal } from "../../../lib/star/realGoals";

export function measureBuildup() {
  let nb = 0, sb = 0, sa = 0, touches = 0, oldCover = 0, newCover = 0, worse = 0;
  for (const g of loadGoals()) {
    const lead = g.shot.lead;
    if (!lead || !lead.passes.length) continue;
    const win = moveWindow(g);
    if (!win.length) continue;
    const end = scenarioForGoal(g, false).ball;
    const t = realTouches(win);
    const before = replayError(leadinBallKeys(g.shot, lead, end), t);
    const after = replayError(realBallKeys(g, win, end), t);
    if (Number.isNaN(before) || Number.isNaN(after)) continue;
    nb++; sb += before; sa += after; touches += t.length;
    if (after > before + 0.01) worse++;
    oldCover += lead.passes.length; newCover += win.length;
  }
  return { goals: nb, before: sb / nb, after: sa / nb, touches, oldActions: oldCover / nb, newActions: newCover / nb, worse };
}

if (process.argv[1]?.endsWith("buildup.mts")) {
  const r = measureBuildup();
  console.log(`${r.goals} goals, ${r.touches} real touches: replayed ball off the real ball by ${r.before.toFixed(2)} m before -> ${r.after.toFixed(2)} m after (average per goal)`);
  console.log(`actions replayed per goal: ${r.oldActions.toFixed(1)} passes before -> ${r.newActions.toFixed(1)} passes and carries after; worse on ${r.worse} goals`);
}
