/**
 * CREDITS — every outside source the game uses, with the exact credit it
 * asks for, in ONE list (Harry, 20 Oct 2026: credits "in Settings … short
 * settings are fine"; 21 Oct 2026, D8: "Settings + public /credits").
 *
 * Shown in two places, both reading this list:
 *  - Settings → More → Data credits (components/star/DataCredits.tsx);
 *  - the public page /credits (app/credits/page.tsx), linked from the site
 *    footer, so the credit travels with the game outside Settings too.
 * The Real moments pages also show the `moments` lines they use
 * (lib/star/realMoments REAL_CREDIT).
 *
 * The football-data lines (patterns, roles, moments) are data/opendata/
 * LICENCES.md's, word for word; that file quotes each licence. The other
 * lines (art, sound, fonts, facts) name the licence file that ships next to
 * the files (`licenceFile`).
 *
 * A new source is ONE entry here (+ its LICENCES.md section for football
 * data) and, for a data file the game reads, a row in DATA_FILE_CREDITS.
 * Checked by tests/star/dataCredits.mts: every data file the game reads names
 * a credit id that exists, every football line is in LICENCES.md, every
 * licence file exists.
 *
 * Not credited because it is not used: the licensed event data removed on
 * 19 Oct 2026, and every source under LICENCES.md "Checked and NOT used".
 */

export type CreditUse = "patterns" | "roles" | "moments" | "art" | "sound" | "fonts" | "facts";

export interface DataCredit {
  /** Short id, stable. */
  id: string;
  /** Who made it, as the credits name it. */
  source: string;
  /** The licence, short ("CC BY 4.0", "MIT", "CC0 1.0"). */
  licence: string;
  /** What the game uses it for (the group it is shown under). */
  use: CreditUse;
  /** The credit line, exactly as the source asks (football data: as LICENCES.md gives it). */
  line: string;
  /** The licence file in the repo for non-football sources (relative to the repo root). */
  licenceFile?: string;
  /** A short note shown under the line (where it is used, or a limit on its use). */
  note?: string;
}

export const DATA_CREDITS: readonly DataCredit[] = [
  // ── Football data: averages and counts ──
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
    note: "University-level matches: kept on file, not used for team shapes (Harry, 21 Oct 2026: pro data only).",
  },
  // ── Football data: player roles ──
  {
    id: "wyscout-roles", source: "Wyscout public dataset (PlayeRank)", licence: "CC BY 4.0", use: "roles",
    line: "Player roles from the Wyscout public dataset's PlayeRank file (Pappalardo et al., Scientific Data 2019; Pappalardo et al., ACM TIST 2019), CC BY 4.0. Changes made.",
  },
  // ── Football data: single real moments ──
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
  // ── Facts ──
  {
    id: "wikipedia-kits", source: "Wikipedia / Wikimedia Commons", licence: "CC BY-SA 4.0", use: "facts",
    line: "National team kit colours read from each team's Wikipedia kit box (Wikipedia / Wikimedia Commons, CC BY-SA 4.0). Colours and patterns only; no picture is shipped.",
    licenceFile: "scripts/nation-kits/README.md",
  },
  {
    id: "ballondor", source: "ballondor.com", licence: "facts only", use: "facts",
    line: "Ballon d'Or winners and rankings, 1956–2025: facts collected from ballondor.com.",
    licenceFile: "data/ballondor/README.md",
    note: "Kept for a future game mode; not used in a match.",
  },
  // ── 3D models, textures and motion ──
  {
    id: "kenney", source: "Kenney", licence: "CC0 1.0", use: "art",
    line: "Garden and home props from Kenney's Nature, Furniture, Fantasy Town 2 and Survival kits (kenney.nl), CC0 1.0.",
    licenceFile: "public/star/garden3d/LICENSE.txt",
  },
  {
    id: "quaternius", source: "Quaternius", licence: "CC0 1.0", use: "art",
    line: "Models and animations by @Quaternius (quaternius.com): Universal Base Characters, Universal Animation Library and the farm and animal packs, CC0 1.0.",
    licenceFile: "public/star/shop3d/LICENSE.txt",
  },
  {
    id: "makehuman", source: "MakeHuman", licence: "CC0 1.0", use: "art",
    line: "Human body, clothes and hair from MakeHuman (MPFB2 and the MakeHuman system assets), CC0 1.0.",
    licenceFile: "public/star/human3d/LICENSE.txt",
  },
  {
    id: "cmu-mocap", source: "CMU Graphics Lab Motion Capture Database", licence: "free for all uses", use: "art",
    line: "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.",
    licenceFile: "public/star/anims3d/LICENSE-mocap.txt",
  },
  {
    id: "polyhaven", source: "Poly Haven", licence: "CC0 1.0", use: "art",
    line: "Skies, light and fabric textures from Poly Haven (polyhaven.com), CC0 1.0.",
    licenceFile: "public/star/h3d/LICENSE.txt",
  },
  {
    id: "ambientcg", source: "ambientCG", licence: "CC0 1.0", use: "art",
    line: "Grass texture Grass004 from ambientCG (ambientcg.com), CC0 1.0.",
    licenceFile: "public/star/cutscene/LICENSE.txt",
  },
  // ── Sound ──
  {
    id: "kokoro", source: "Kokoro", licence: "Apache 2.0 / MIT", use: "sound",
    line: "Goal commentary voices made offline with Kokoro (github.com/hexgrad/kokoro, Apache 2.0) and kokoro-onnx (MIT).",
    licenceFile: "public/sfx/COMMENTARY-LICENSE.txt",
  },
  // ── Fonts ──
  {
    id: "font-oswald", source: "The Oswald Project Authors", licence: "SIL OFL 1.1", use: "fonts",
    line: "Oswald, © 2016 The Oswald Project Authors, SIL Open Font License 1.1.",
    licenceFile: "public/star/banners/LICENSE-Oswald.txt",
  },
  {
    id: "font-luckiest-guy", source: "Astigmatic", licence: "Apache 2.0", use: "fonts",
    line: "Luckiest Guy by Astigmatic, Apache License 2.0.",
    licenceFile: "public/star/banners/LICENSE-LuckiestGuy.txt",
  },
  {
    id: "font-cinzel", source: "Natanael Gama", licence: "SIL OFL 1.1", use: "fonts",
    line: "Cinzel by Natanael Gama, SIL Open Font License 1.1.",
    licenceFile: "app/layout.tsx",
  },
];

/** The groups, in the order Settings and /credits show them. */
export const CREDIT_GROUPS: readonly { use: CreditUse; title: string; note: string }[] = [
  { use: "patterns", title: "How real football plays", note: "Averages and counts only: no real match is replayed." },
  { use: "roles", title: "Player roles", note: "What each position does on the ball, as averages." },
  { use: "moments", title: "Real moments", note: "Single real shots and corners, with where everyone stood." },
  { use: "facts", title: "Facts", note: "Kit colours and award records." },
  { use: "art", title: "3D models, textures and motion", note: "Free packs; most ask for no credit, credited anyway." },
  { use: "sound", title: "Sound", note: "Commentary voices made on our own machine." },
  { use: "fonts", title: "Fonts", note: "" },
];

/**
 * Every data file the game (or a page of it) reads, and the credit ids it
 * needs. tests/star/dataCredits.mts fails if a file in data/opendata,
 * data/realmoments or data/ballondor is missing here, or names an id that
 * is not in DATA_CREDITS.
 */
export const DATA_FILE_CREDITS: Readonly<Record<string, readonly string[]>> = {
  "data/opendata/wyscout_attacks.json": ["wyscout-patterns"],
  "data/opendata/wyscout_chances.json": ["wyscout-patterns"],
  "data/opendata/wyscout_defending.json": ["wyscout-patterns"],
  "data/opendata/wyscout_match_flow.json": ["wyscout-patterns"],
  "data/opendata/wyscout_possession_starts.json": ["wyscout-patterns"],
  "data/opendata/wyscout_roles.json": ["wyscout-patterns"],
  "data/opendata/wyscout_set_pieces.json": ["wyscout-patterns"],
  "data/opendata/wyscout_transitions.json": ["wyscout-patterns"],
  "data/opendata/wyscout_shot_outcomes.json": ["wyscout-patterns", "wyscout-roles"],
  "data/opendata/idsse_tracking.json": ["dfl-patterns"],
  "data/opendata/skillcorner_tracking.json": ["skillcorner-patterns"],
  "data/opendata/skillcorner2020_tracking.json": ["skillcorner-patterns"],
  "data/opendata/skillcorner_phases.json": ["skillcorner-patterns"],
  "data/opendata/soccertrack_tracking.json": ["soccertrack-patterns"],
  "data/opendata/tracked_shot_shapes.json": ["dfl-patterns", "skillcorner-patterns"],
  "data/realmoments/tracked.json": ["dfl-moments", "skillcorner-moments", "soccertrack-moments"],
  "data/realmoments/tracks.json": ["dfl-moments", "skillcorner-moments", "soccertrack-moments"],
  "data/realmoments/picks.json": ["dfl-moments", "skillcorner-moments", "soccertrack-moments", "wyscout-moments"],
  "data/realmoments/wyscout_shots.json": ["wyscout-moments"],
  "data/realmoments/wyscout_goals.json": ["wyscout-moments"],
  "data/realmoments/wyscout_league_england.json": ["wyscout-moments"],
  "data/realmoments/wyscout_league_france.json": ["wyscout-moments"],
  "data/realmoments/wyscout_league_germany.json": ["wyscout-moments"],
  "data/realmoments/wyscout_league_italy.json": ["wyscout-moments"],
  "data/realmoments/wyscout_league_spain.json": ["wyscout-moments"],
  "data/ballondor/rankings.json": ["ballondor"],
  "data/ballondor/players.json": ["ballondor"],
  "data/ballondor/year_notes.json": ["ballondor"],
  "lib/star/fhr/patterns.json": ["wyscout-patterns", "dfl-patterns", "skillcorner-patterns"],
  "lib/star/data/sources/nation_kits_2026-10.json": ["wikipedia-kits"],
};

/** One line by id (throws on a typo, so a page can never show a blank credit). */
export function creditLine(id: string): string {
  const c = DATA_CREDITS.find((d) => d.id === id);
  if (!c) throw new Error(`no data credit "${id}"`);
  return c.line;
}

/** Where the licences are explained, for the Settings note. */
export const CREDITS_LINK = "https://creativecommons.org/licenses/by/4.0/";
