/**
 * DATA CREDITS — every credit line the free football data asks for, in one
 * list (Harry, 20 Oct 2026: credits "in Settings … short settings are fine").
 *
 * The lines are data/opendata/LICENCES.md's, word for word; that file says
 * where each comes from and quotes its licence. Settings → More → Data credits
 * shows this list (components/star/DataCredits.tsx), and the Real moments
 * pages show the `real` lines they use (lib/star/realMoments REAL_CREDIT).
 *
 * A new source is ONE entry here plus its section in LICENCES.md.
 * tests/star/realMoments.mts checks every line is in LICENCES.md.
 */

export interface DataCredit {
  /** Short id, stable. */
  id: string;
  /** Who made the data, as Settings names it. */
  source: string;
  /** The licence, short ("CC BY 4.0", "MIT"). */
  licence: string;
  /** What the game uses it for: "patterns" (averages and counts) or "moments" (single real moments). */
  use: "patterns" | "moments";
  /** The credit line, exactly as LICENCES.md gives it. */
  line: string;
}

export const DATA_CREDITS: readonly DataCredit[] = [
  {
    id: "wyscout-patterns", source: "Wyscout public dataset", licence: "CC BY 4.0", use: "patterns",
    line: "Match event patterns derived from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.",
  },
  {
    id: "dfl-patterns", source: "Deutsche Fußball Liga (DFL) / IDSSE", licence: "CC BY 4.0", use: "patterns",
    line: "Tracking patterns derived from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.",
  },
  {
    id: "skillcorner-patterns", source: "SkillCorner Open Data", licence: "MIT", use: "patterns",
    line: "Tracking and phase-of-play patterns derived from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).",
  },
  {
    id: "soccertrack-patterns", source: "SoccerTrack v2", licence: "CC BY 4.0", use: "patterns",
    line: "Tracking patterns derived from SoccerTrack v2 (Scott et al., arXiv 2025), CC BY 4.0. Changes made.",
  },
  {
    id: "wyscout-moments", source: "Wyscout public dataset", licence: "CC BY 4.0", use: "moments",
    line: "Real shots and goals from the Wyscout public dataset (Pappalardo et al., Scientific Data 2019), CC BY 4.0. Changes made.",
  },
  {
    id: "dfl-moments", source: "Deutsche Fußball Liga (DFL) / IDSSE", licence: "CC BY 4.0", use: "moments",
    line: "Real player positions from data of the Deutsche Fußball Liga (DFL), published by Bassek et al., Scientific Data 2025, CC BY 4.0. Changes made.",
  },
  {
    id: "skillcorner-moments", source: "SkillCorner Open Data", licence: "MIT", use: "moments",
    line: "Real player positions from SkillCorner Open Data (MIT licence, © 2020 SkillCorner).",
  },
  {
    id: "soccertrack-moments", source: "SoccerTrack v2", licence: "CC BY 4.0", use: "moments",
    line: "Real player positions from SoccerTrack v2 (Scott et al., arXiv 2025), CC BY 4.0. Changes made.",
  },
];

/** One line by id (throws on a typo, so a page can never show a blank credit). */
export function creditLine(id: string): string {
  const c = DATA_CREDITS.find((d) => d.id === id);
  if (!c) throw new Error(`no data credit "${id}"`);
  return c.line;
}

/** Where the licences are explained, for the Settings note. */
export const CREDITS_LINK = "https://creativecommons.org/licenses/by/4.0/";
