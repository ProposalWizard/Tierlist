/**
 * ARE WE IN THE TEST AREA? (Harry, 12 Oct 2026: the shot spread "cone
 * drawings: out of the game, kept in the test area only".)
 *
 * EnginePlay (every Play Area / gallery / highlights mount of the real match)
 * enters the test area while it is on screen; the career match never mounts
 * EnginePlay, so it is never in it. A module value, not a prop, so the one
 * engine stays one engine (no new test-only dial for the guard).
 */
let depth = 0;

/** Enter the test area until the returned function is called. */
export function enterTestArea(): () => void {
  depth++;
  let left = false;
  return () => { if (!left) { left = true; depth = Math.max(0, depth - 1); } };
}

/** True while a test screen holds the real match. */
export function inTestArea(): boolean {
  return depth > 0;
}
