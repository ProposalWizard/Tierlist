/**
 * THE ARC BOOK — Events v2's named stories (docs/plans/living-world-events-v2-2026-11-20.md,
 * part 2c). One JSON file per arc in book/arcs/, so two writers never touch the same file.
 * The kit man's "A hundred balls in the dark" first, then the story batch (book/arcs/index.ts lists
 * every file). Data only; arcs.ts plays it.
 *
 *  - ARCS: the stories that can play (the director, the test page, the soak).
 *  - WAITING_ARCS: stories whose game mode is not built yet (`needsActivity`). Checked by
 *    tests/star/lifeArcs.mts, never started, so no story ever fakes its game with a dice roll.
 */
import type { ArcBeat, LifeArc } from "./types";
import hundredBalls from "./book/arcs/hundred-balls.json";
import { STORY_ARCS } from "./book/arcs/index";

export const ALL_ARCS: LifeArc[] = [hundredBalls as unknown as LifeArc, ...STORY_ARCS];
export const ARCS: LifeArc[] = ALL_ARCS.filter((a) => !a.needsActivity);
export const WAITING_ARCS: LifeArc[] = ALL_ARCS.filter((a) => !!a.needsActivity);

const BY_ID = new Map(ARCS.map((a) => [a.id, a]));
export const arcById = (id: string): LifeArc | undefined => BY_ID.get(id);
export const beatOf = (arc: LifeArc, id: string): ArcBeat | undefined => arc.beats.find((b) => b.id === id);
/** The beats on the main line, for "Beat 3 of 7". */
export const mainCount = (arc: LifeArc): number => Math.max(0, ...arc.beats.map((b) => b.n ?? 0));
