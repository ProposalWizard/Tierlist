// A deterministic player for headless runs: the same touches at the same ticks every time.
import type { MatchDriver } from "../src/match/driver";
import { POST_L, POST_R, CX } from "@/lib/star/pitch";
import { VIEW_ASPECT } from "@/lib/star/canvasEngine";

/** A flat (untilted) screen pull for the bot: metres over the classic 5:8 height of this camera's width. */
export function flatPull(d: MatchDriver) {
  return (drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const vp = d.viewport;
    const across = d.facing === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
    const refM = across / VIEW_ASPECT;
    return Math.hypot(drag.x - ball.x, drag.y - ball.y) / refM;
  };
}

export interface BotRun { ticks: number; chances: number; kinds: Record<string, number>; trace: string[] }

/** Play `d` to full time. `seed` varies the bot's aim and timing from chance to chance. */
export function playWithBot(d: MatchDriver, seed: number, maxTicks = 2_000_000): BotRun {
  const kinds: Record<string, number> = {};
  const trace: string[] = [];
  let chances = 0, aimTicks = 0, n = 0;
  let lastPhase = "";
  d.start();
  for (; n < maxTicks && !d.done; n++) {
    if (d.pause) { d.continuePause(); continue; }
    if (d.phase !== lastPhase) {
      if (d.phase === "aim" || d.phase === "tdDribble") { chances++; kinds[d.sc.kind] = (kinds[d.sc.kind] ?? 0) + 1; aimTicks = 0; }
      trace.push(`${n}:${d.phase}:${d.matchMinute}:${d.phase === "aim" ? d.sc.kind : ""}:${d.outcome ?? ""}:${d.rngDrawn}`);
      lastPhase = d.phase;
    }
    if (d.phase === "tdDribble" && d.tdReady) d.tdTap({ x: 0, y: 0 });
    if (d.phase === "aim" && !d.lead) {
      aimTicks++;
      const wait = 20 + ((seed * 7 + chances * 13) % 40);
      if (aimTicks === wait) {
        const b = d.sc.ball;
        const pull = flatPull(d);
        const tx = ((seed + chances) % 2 === 0) ? POST_R - 0.7 : POST_L + 0.7;
        const goalSide = b.y > 2 ? { x: tx - b.x, y: 0 - b.y } : { x: CX - b.x, y: -1 };
        const L = Math.hypot(goalSide.x, goalSide.y) || 1;
        const vp = d.viewport, across = d.facing === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
        const k = (0.06 + ((seed + chances * 3) % 5) * 0.012) * across / VIEW_ASPECT;
        d.pointerDown({ x: b.x, y: b.y }, 99, 0);
        d.pointerMove({ x: b.x - goalSide.x / L * k, y: b.y - goalSide.y / L * k }, pull);
        d.pointerUp(pull);
      }
    }
    if (d.phase === "contact") {
      if (!d.contactLocked && n % 7 === 0) d.tapContact(((chances % 3) - 1) * 0.2, 0.15);
    }
    d.tick();
  }
  return { ticks: n, chances, kinds, trace };
}
