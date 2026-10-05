/**
 * lib/star/godMode.ts — mark a career as a tester save once a cheat is used.
 *
 * Harry, 5 Oct 2026 (tester access): testers get the Settings → Developer
 * tools ("god mode"). Any save those tools have touched carries
 * `usedGodMode: true`, and Settings shows "Tester save", so a tester's
 * results are never mistaken for a real run.
 *
 * Both career pages (app/star-dev/page.tsx and the Old UI copy) wrap the
 * cheat handlers they pass to Settings with `withGodMode`. The cheat runs
 * first, then the mark is set with a functional update, so it lands on the
 * career the cheat just made.
 */

/** The same career with the tester mark on. Null stays null. */
export function markGodMode<T extends { usedGodMode?: boolean }>(career: T | null): T | null {
  if (!career || career.usedGodMode) return career;
  return { ...career, usedGodMode: true };
}

/** A cheat handler that also marks the save. */
export function withGodMode<A extends unknown[]>(handler: (...args: A) => void, mark: () => void): (...args: A) => void {
  return (...args: A) => {
    handler(...args);
    mark();
  };
}
