/**
 * THE OLD UI'S STAR RATING — the 1.0-10.0 scale it was drawn for.
 *
 * The rules (lib/star/starPoints.ts) moved to a 1-100 rating on 1 Oct 2026,
 * with Star Points ×SP_SCALE. They are shared by both UIs, so the save is one
 * save. The frozen Old UI screens were written for 1.0-10.0 ("★ 2.9",
 * "+68 SP", gates at 2.9 / 3.9 …), so they read the rating through here.
 *
 * The mapping is exact, the same one starPoints.ts uses to convert an old
 * save (bestOf: 2.9 → 29): rating ÷ 10, Star Points ÷ SP_SCALE. Nothing is
 * worked out differently — only the numbers are put back in the old units.
 */
import * as SP from "@/lib/star/starPoints";
import type { CareerState, Fixture, MatchStats } from "@/lib/star/types";

export { LEGEND_TASKS, ledgerOf, withStars } from "@/lib/star/starPoints";

const toStars = (level: number) => level / 10;
const toSp = (sp: number) => Math.round(sp / SP.SP_SCALE);

const oldGate = (g: SP.StarGate): SP.StarGate => ({ ...g, cap: toStars(g.cap) });

export const STAR_GATES: SP.StarGate[] = SP.STAR_GATES.map(oldGate);

export function starStatus(career: CareerState): SP.StarStatus {
  const s = SP.starStatus(career);
  const p = s.points;
  return {
    ...s,
    stars: toStars(s.stars),
    ungated: toStars(s.ungated),
    total: toSp(s.total),
    spToNext: toSp(s.spToNext),
    points: { match: toSp(p.match), trophies: toSp(p.trophies), awards: toSp(p.awards), milestones: toSp(p.milestones), status: toSp(p.status) },
    gate: s.gate ? oldGate(s.gate) : null,
  };
}

export function starsNow(career: CareerState): number {
  return toStars(SP.starsNow(career));
}

/** The rating a save has banked, without working anything out (title screen). */
export function storedStars(career: Pick<CareerState, "stars" | "starBest">): number {
  return toStars(SP.starLevel(career));
}

export function matchStarPoints(career: CareerState, fixture: Fixture, stats: MatchStats): ReturnType<typeof SP.matchStarPoints> {
  const r = SP.matchStarPoints(career, fixture, stats);
  return { ...r, base: toSp(r.base), total: toSp(r.total) };
}
