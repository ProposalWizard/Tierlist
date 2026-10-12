/**
 * FRIENDLIES — Mikey, 12 Oct 2026: "Friendlies will occur when teams are not
 * in any form of competition."
 *
 * On every matchday of every FIFA window, the nations with no competitive
 * match that day are paired off. Nine in ten play (some rest, as some always
 * do). A partner is drawn from the next few free nations of similar ranking,
 * three times as likely from the same confederation (most friendlies are
 * regional). FIFA importance 10. Russia, banned from competitions, plays
 * friendlies only.
 */
import { NATIONS, nationFor } from "./nations";
import { rngFor, shuffled } from "./engine";
import type { World } from "./world";
import { seasonWindows } from "./windows";
import { noon } from "./world";

const PLAY_SHARE = 0.9;
const LOOK = 8;

export function friendliesFor(w: World, date: number): void {
  // Run just before the day's matches, after every competition has added its own.
  w.at(date - 3_600_000, () => {
    const busy = w.busyOn(date);
    const rng = rngFor(`fr|${date}`);
    const free = NATIONS.map((n) => n.name).filter((n) => !busy.has(n) && rng() < PLAY_SHARE)
      .sort((a, b) => (w.points.get(b) ?? 0) - (w.points.get(a) ?? 0));
    const left = new Set(free);
    for (const a of free) {
      if (!left.has(a)) continue;
      left.delete(a);
      const cands = free.filter((x) => left.has(x)).slice(0, LOOK);
      if (!cands.length) break;
      const conf = nationFor(a)?.confederation;
      const weights = cands.map((c) => (nationFor(c)?.confederation === conf ? 3 : 1));
      let r = rng() * weights.reduce((s, x) => s + x, 0);
      let b = cands[0];
      for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) { b = cands[i]; break; } }
      left.delete(b);
      const [home, away] = rng() < 0.5 ? [a, b] : [b, a];
      w.add({
        id: `FR|${date}|${home}-${away}`, home, away, date, comp: "International Friendly",
        edition: `FR-${new Date(date).getUTCFullYear()}`, stage: "Friendly", importance: 10,
      });
    }
    void shuffled;
  });
}

/** Friendlies on every window matchday of club seasons first..last. */
export function scheduleFriendlies(w: World, firstSeasonYear: number, lastSeasonYear: number): void {
  for (let y = firstSeasonYear; y <= lastSeasonYear; y++) {
    for (const win of seasonWindows(y)) for (const d of win.matchdays) friendliesFor(w, noon(d));
  }
}
