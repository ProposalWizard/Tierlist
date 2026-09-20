import { mulberry32 } from "./season";

/**
 * A PLAYSTYLE — how a side sets up out of possession.
 *
 * The measured research (see scratchpad/research-managers-playstyles.md and the
 * StatsBomb-360 files) is blunt about one thing: a manager's identity sets the
 * BASELINE and the CEILING, but the number a side actually shows on the day
 * slides within that band by the strength gap to the opponent. So a playstyle
 * here is a set of biases applied ON TOP of a measured, ball-conditioned block
 * depth — not an absolute line height. The strength-gap slide is applied
 * separately, in formationShape.ts, exactly as the research says it should be.
 *
 * Line heights in the literature are whole-pitch season averages (high press
 * ~48-52 m from own goal, low block ~35-38 m season-average, 22-28 m in a
 * specific match against strong opposition; PL average ~44 m). Those don't map
 * straight onto a scenario frame, which is always ball-conditioned near the
 * defending goal. What DOES transfer is the RELATIVE spread — roughly a 10-13 m
 * season-average gap between the highest and deepest PL sides — so `lineBias`
 * below is a metres-relative-to-baseline figure whose high-press-to-low-block
 * spread (9 m) sits just inside that measured band.
 */
export type Playstyle = "high-press" | "possession" | "mid-block" | "low-block" | "counter";

export interface PlaystyleProfile {
  id: Playstyle;
  /** How it reads in a scout report. */
  name: string;
  /**
   * Metres the settled back line sits relative to the measured (SB360 Table 1)
   * baseline. Positive = higher up the pitch (further from own goal, i.e. a
   * LARGER y in scenario coords, closer to the ball); negative = deeper, nearer
   * their own goal. See PlaystyleProfile's file header for why this is relative,
   * not absolute.
   */
  lineBias: number;
  /**
   * Back line to first screening line, metres. The research band for an
   * organised block is 20-35 m (tight ~20-25 for a low block / press, looser
   * ~30-35 for a settled possession side). Used to place a screening man ahead
   * of the back line when the scenario has more defenders than the back line
   * holds.
   */
  compactness: number;
  /** 0..1 — how far the keeper strays off his line with a high line (Table 5). */
  keeperSweep: number;
  /** 0..1 — press intensity, for the scout report ("press them, or sit off"). */
  pressing: number;
  /** They spring a counter — the scout report tells you to hold runners back. */
  counters: boolean;
  /** One plain-English line for the scout report. */
  blurb: string;
}

export const PLAYSTYLES: Record<Playstyle, PlaystyleProfile> = {
  "high-press": {
    id: "high-press", name: "High press",
    lineBias: 4, compactness: 26, keeperSweep: 1.0, pressing: 0.95, counters: false,
    blurb: "press high and squeeze the pitch — beat the press and there's space in behind",
  },
  "possession": {
    id: "possession", name: "Possession",
    lineBias: 3, compactness: 32, keeperSweep: 0.85, pressing: 0.8, counters: false,
    blurb: "keep the ball and hold a high line — you'll need to be patient and hit the space they leave",
  },
  "mid-block": {
    id: "mid-block", name: "Mid-block",
    lineBias: 0, compactness: 28, keeperSweep: 0.5, pressing: 0.45, counters: false,
    blurb: "sit in two banks around halfway and stay compact — chances come from stretching them wide",
  },
  "low-block": {
    id: "low-block", name: "Low block",
    lineBias: -5, compactness: 22, keeperSweep: 0.2, pressing: 0.15, counters: true,
    blurb: "sit deep and defend the box — little space centrally, so work the channels and shoot from range",
  },
  "counter": {
    id: "counter", name: "Counter-attack",
    lineBias: -3, compactness: 25, keeperSweep: 0.35, pressing: 0.3, counters: true,
    blurb: "sit off and break fast — hold men back or they'll punish the turnover",
  },
};

/**
 * The four managers the brief names, mapped to the style they are famous for.
 * Klopp's gegenpress, Guardiola's high possession line, Mourinho's low block,
 * Ferguson's width-first 4-4-2 mid-block. Keyed on a normalised surname so
 * "Jürgen Klopp"/"klopp" both resolve.
 */
export const MANAGER_PLAYSTYLES: Record<string, Playstyle> = {
  klopp: "high-press",
  guardiola: "possession",
  pep: "possession",
  mourinho: "low-block",
  ferguson: "mid-block",
};

export function playstyleForManager(manager: string | undefined | null): PlaystyleProfile | null {
  if (!manager) return null;
  const key = manager.toLowerCase();
  for (const surname of Object.keys(MANAGER_PLAYSTYLES)) {
    if (key.includes(surname)) return PLAYSTYLES[MANAGER_PLAYSTYLES[surname]];
  }
  return null;
}

/**
 * A club's own settled identity — deterministic, so Everton set up the same way
 * in every career and every season of one, exactly like formationForClub.
 *
 * The pool leans toward the mid-block (the modern PL default, per the research's
 * ~44 m league-average line) with the two extremes rarer. This is only the
 * BASELINE — the strength gap to you slides it on the day (formationShape.ts),
 * which is the whole point of the research's "identity sets the band, the gap
 * picks the number within it" finding.
 */
const STYLE_POOL: Playstyle[] = [
  "high-press", "possession", "mid-block", "mid-block", "low-block", "counter",
];

export function playstyleForClub(club: string): PlaystyleProfile {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) {
    h ^= club.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = mulberry32((h >>> 0) ^ 0x9e3779b9);
  rng(); rng();
  return PLAYSTYLES[STYLE_POOL[Math.floor(rng() * STYLE_POOL.length)]];
}
