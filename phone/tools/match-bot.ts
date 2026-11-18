// A deterministic player for headless runs: the same touches after the same number of frames, every time.
// tools/match-parity.ts plays the website's call order with the SAME player (botAim / botWait / botContactWait).
import type { MatchDriver } from "../src/match/driver";
import { POST_L, POST_R, CX } from "@/lib/star/pitch";
import { VIEW_ASPECT, type Viewport } from "@/lib/star/canvasEngine";

/** A flat (untilted) screen pull for the bot: metres over the classic 5:8 height of this camera's width. */
export function flatPullFor(vp: Viewport, facing: string) {
  return (drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const across = facing === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
    return Math.hypot(drag.x - ball.x, drag.y - ball.y) / (across / VIEW_ASPECT);
  };
}
/** Frames the bot looks at a chance (after any build-up) before it drags. */
export const botWait = (seed: number, chance: number) => 20 + ((seed * 7 + chance * 13) % 40);
/** Frames the strike screen is up before the bot taps the ball. */
export const botContactWait = (seed: number, chance: number) => 4 + ((seed + chance) % 6);
/** Where the bot hits the ball on the strike screen. */
export const botContact = (chance: number) => ({ cx: ((chance % 3) - 1) * 0.2, cy: 0.15 });
/** The bot's drag: from the ball, away from the far corner, by a share of the screen. */
export function botAim(ball: { x: number; y: number }, vp: Viewport, facing: string, seed: number, chance: number) {
  const tx = ((seed + chance) % 2 === 0) ? POST_R - 0.7 : POST_L + 0.7;
  const goalSide = ball.y > 2 ? { x: tx - ball.x, y: 0 - ball.y } : { x: CX - ball.x, y: -1 };
  const L = Math.hypot(goalSide.x, goalSide.y) || 1;
  const across = facing === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
  const k = (0.06 + ((seed + chance * 3) % 5) * 0.012) * across / VIEW_ASPECT;
  return { x: ball.x - goalSide.x / L * k, y: ball.y - goalSide.y / L * k };
}

export interface BotRun { ticks: number; chances: number; kinds: Record<string, number>; trace: string[] }

/** Play `d` to full time. `seed` varies the bot's aim and timing from chance to chance. */
export function playWithBot(d: MatchDriver, seed: number, maxTicks = 3_000_000): BotRun {
  const kinds: Record<string, number> = {};
  const trace: string[] = [];
  let chances = 0, aimTicks = 0, contactTicks = 0, n = 0;
  let lastPhase = "";
  d.start();
  for (; n < maxTicks && !d.done; n++) {
    if (d.pause) { d.continuePause(); continue; }
    // A new chance: the screen has just gone to aim (or a dribble run) from anything else.
    if ((d.phase === "aim" || d.phase === "tdDribble") && lastPhase !== d.phase && lastPhase !== "aim") {
      chances++; aimTicks = 0;
      const k = d.phase === "tdDribble" ? "dribble" : d.sc.kind;
      kinds[k] = (kinds[k] ?? 0) + 1;
    }
    if (d.phase === "contact" && lastPhase !== "contact") contactTicks = 0;
    if (d.phase !== lastPhase) trace.push(`${d.phase}:${d.matchMinute}:${d.outcome ?? ""}:${d.rngDrawn}`);
    lastPhase = d.phase;
    if (d.phase === "tdDribble" && d.tdReady) d.tdTap({ x: 0, y: 0 });
    if (d.phase === "aim" && !d.lead) {
      aimTicks++;
      if (aimTicks === botWait(seed, chances)) {
        const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
        d.pointerDown({ x: b.x, y: b.y }, 99, 0);
        d.pointerMove(botAim(b, d.viewport, d.facing, seed, chances), pull);
        d.pointerUp(pull);
      }
    }
    if (d.phase === "contact" && lastPhase === "contact" && !d.contactLocked) {
      contactTicks++;
      if (contactTicks === botContactWait(seed, chances)) { const c = botContact(chances); d.tapContact(c.cx, c.cy); }
    }
    d.tick();
  }
  return { ticks: n, chances, kinds, trace };
}
