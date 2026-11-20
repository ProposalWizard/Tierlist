/**
 * THE ARC BOOK — Events v2's named stories (docs/plans/living-world-events-v2-2026-11-20.md,
 * part 2c). One JSON file per arc in book/arcs/, so two writers never touch the same file.
 * Phase 1 has one: "A hundred balls in the dark" (the kit man). Data only; arcs.ts plays it.
 */
import type { ArcBeat, LifeArc } from "./types";
import hundredBalls from "./book/arcs/hundred-balls.json";

export const ARCS: LifeArc[] = [hundredBalls as unknown as LifeArc];

const BY_ID = new Map(ARCS.map((a) => [a.id, a]));
export const arcById = (id: string): LifeArc | undefined => BY_ID.get(id);
export const beatOf = (arc: LifeArc, id: string): ArcBeat | undefined => arc.beats.find((b) => b.id === id);
/** The beats on the main line, for "Beat 3 of 7". */
export const mainCount = (arc: LifeArc): number => Math.max(0, ...arc.beats.map((b) => b.n ?? 0));
