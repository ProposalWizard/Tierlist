/**
 * YOUR AWARDS IN WORDS (Mikey, 22 Oct 2026): "Season 1 · February", never
 * "S1 wk 36", and the league it was won in: "National League Player of the
 * Month · February", "National League Golden Boot · 43 goals".
 */
import type { CareerState } from "./types";
import { divisionOf, leagueNameFor, type CareerDivision } from "./calendar";
import { MONTH_NAMES, monthOf } from "./potm";

type Award = NonNullable<CareerState["awards"]>[number];

/** The division an award was won in: stamped on it, else that season's row, else today's. */
function divisionFor(career: CareerState, a: Award): CareerDivision {
  return a.division
    ?? career.seasonHistory?.find((h) => h.season === a.season)?.division
    ?? divisionOf(career);
}

/** "February": the month of a monthly award, read off the real calendar. */
export function awardMonth(career: CareerState, a: Award): string | null {
  if (!a.week) return null;
  return MONTH_NAMES[monthOf(a.week, career.player.startYear, a.season, divisionFor(career, a))] ?? null;
}

/** "Season 1 · February", or "Season 1" for an award with no week. */
export function awardWhen(career: CareerState, a: Award): string {
  const m = awardMonth(career, a);
  return m ? `Season ${a.season} · ${m}` : `Season ${a.season}`;
}

/** One award as a title and its line: the league's name first, then the month or the numbers. */
export function awardLine(career: CareerState, a: Award): { title: string; sub: string } {
  const league = a.kind === "Ballon d'Or" ? "" : `${leagueNameFor(divisionFor(career, a))} `;
  const m = awardMonth(career, a);
  // A monthly award's detail starts with its month ("February — 4 goals"): drop it, the month leads.
  const detail = a.detail.replace(/^[A-Z][a-z]+ — /, "");
  return { title: `${league}${a.kind}`, sub: [m, detail].filter(Boolean).join(" · ") };
}

/** Every award you won in one season, oldest first. */
export function awardsInSeason(career: CareerState, season: number): { title: string; sub: string }[] {
  return (career.awards ?? []).filter((a) => a.season === season).map((a) => awardLine(career, a));
}
