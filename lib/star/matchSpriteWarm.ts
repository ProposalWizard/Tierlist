/**
 * COLOUR THE MATCH'S 3D PLAYERS BEFORE KICK OFF (speed fix 1, 20 Nov 2026).
 *
 * The speed audit (docs/research/speed-audit-2026-11-20.md, item 5) measured
 * KICK OFF as one 1.7 s freeze before the first match frame. Part of it: the
 * player sprite sheet coloured pixel by pixel into each side's shirt, shorts
 * and socks (lib/star/sprites.ts) in one go, on the first frame.
 *
 * Now the team sheet (MatchdayScreen) asks for the same four kits a few rows
 * at a time between frames while you read it (sprites.ts warmSpriteKits, the
 * same colouring the match already started at kick-off). Kick off then finds
 * them ready. Same kits as CanvasMatch picks (its kitsRef, ourKeeperKitRef
 * and its own warm call), so the same pictures: only done earlier.
 *
 * Club fixtures only. An international match dresses the nation (page.tsx
 * intlMatchCareer); the match colours those itself, as before.
 */
import type { CareerState, Fixture } from "./types";
import { kitsFor, keeperKit } from "./kits";
import { matchPlayersLook } from "./newLook";
import { warmSpriteKits, type SpriteKit } from "./sprites";

/** The four kits the match draws (yours, theirs, their keeper, your keeper), as sprite kits. Pure. */
export function matchSpriteKits(career: CareerState, fixture: Fixture): SpriteKit[] {
  const club = career.player.club;
  const k = fixture.home
    ? kitsFor(club, fixture.opponent, career.clubKits?.[club], career.clubKits?.[fixture.opponent])
    : kitsFor(fixture.opponent, club, career.clubKits?.[fixture.opponent], career.clubKits?.[club]);
  const homeSide = fixture.home !== false;
  const ours = homeSide ? k.home : k.away;
  const theirs = homeSide ? k.away : k.home;
  const ourKeeper = keeperKit(ours.shirt, k.keeper.shirt);
  const sk = (x: { shirt: string; trim: string }): SpriteKit => ({ shirt: x.shirt, shorts: x.trim, socks: x.shirt });
  return [sk(ours), sk(theirs), sk(k.keeper), sk(ourKeeper)];
}

/** Start colouring this fixture's kits in idle time. Safe to call more than once (each kit is coloured once). */
export function warmMatchSprites(career: CareerState, fixture: Fixture): () => void {
  if (typeof window === "undefined" || fixture.kind === "international") return () => {};
  let dead = false;
  const go = () => {
    if (dead) return;
    try {
      if (matchPlayersLook() !== "3d") return;
      warmSpriteKits(matchSpriteKits(career, fixture));
    } catch { /* coloured by the match itself, as before */ }
  };
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  // after the team sheet has painted, so its own first frame is never held up
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(go, { timeout: 600 });
    return () => { dead = true; w.cancelIdleCallback?.(h); };
  }
  const t = setTimeout(go, 200);
  return () => { dead = true; clearTimeout(t); };
}
