/**
 * KITS.
 *
 * Everybody used to play in the same two colours: you in green, your team-mates
 * in blue, the opposition in red, whoever was actually playing. A career at
 * Manchester City spent fifteen seasons in blue against a red team every single
 * week, and `career.kitPrimary` — which exists — was hardcoded to red for every
 * club in the game and read by nothing.
 *
 * Now the home side wears its own shirt, the away side wears its own shirt, and
 * the away side changes only when the two would be hard to tell apart. Which is
 * the actual rule: Arsenal v Brighton is red against blue and nobody changes;
 * Arsenal v Liverpool is red against red, so Liverpool change.
 *
 * ── On the away kits ──
 *
 * Home colours are club identity and do not move. Away kits are redesigned every
 * season and are a marketing decision, so these are not a claim about what any
 * side actually wore in 2025/26 — they are a change strip chosen to contrast
 * with that club's own home shirt and to read as that club. That is what the
 * game needs, and unlike a real kit it will not be wrong next August.
 */

export interface Kit {
  /** The shirt. */
  shirt: string;
  /** Trim — sleeves, collar, the darker edge the figure is drawn with. */
  trim: string;
}

export interface ClubKits { home: Kit; away: Kit }

/**
 * The twenty, keyed by the names the database uses.
 *
 * `Fulham FC` and `Wolverhampton Wanderers` are spelled the way SoFIFA spells
 * them, because that is what arrives in `career.league`. `kitsOf` also falls
 * back on a loose match so a career built from a differently-spelled list still
 * finds its colours.
 */
export const CLUB_KITS: Record<string, ClubKits> = {
  "Arsenal":                  { home: { shirt: "#EF0107", trim: "#FFFFFF" }, away: { shirt: "#F2D65C", trim: "#0B3B72" } },
  "Aston Villa":              { home: { shirt: "#670E36", trim: "#95BFE5" }, away: { shirt: "#F2F4F7", trim: "#670E36" } },
  "AFC Bournemouth":          { home: { shirt: "#DA291C", trim: "#111111" }, away: { shirt: "#F2F4F7", trim: "#DA291C" } },
  "Brentford":                { home: { shirt: "#E30613", trim: "#FFFFFF" }, away: { shirt: "#17181A", trim: "#E30613" } },
  "Brighton & Hove Albion":   { home: { shirt: "#0057B8", trim: "#FFFFFF" }, away: { shirt: "#F5E14C", trim: "#0057B8" } },
  "Burnley":                  { home: { shirt: "#6C1D45", trim: "#99D6EA" }, away: { shirt: "#99D6EA", trim: "#6C1D45" } },
  "Chelsea":                  { home: { shirt: "#034694", trim: "#FFFFFF" }, away: { shirt: "#F5E14C", trim: "#034694" } },
  "Crystal Palace":           { home: { shirt: "#1B458F", trim: "#C4122E" }, away: { shirt: "#F2F4F7", trim: "#1B458F" } },
  "Everton":                  { home: { shirt: "#003399", trim: "#FFFFFF" }, away: { shirt: "#EAB308", trim: "#003399" } },
  "Fulham FC":                { home: { shirt: "#FFFFFF", trim: "#111111" }, away: { shirt: "#17181A", trim: "#CC0000" } },
  "Leeds United":             { home: { shirt: "#FFFFFF", trim: "#1D428A" }, away: { shirt: "#1D428A", trim: "#FFCD00" } },
  "Liverpool":                { home: { shirt: "#C8102E", trim: "#FFFFFF" }, away: { shirt: "#F2F4F7", trim: "#C8102E" } },
  "Manchester City":          { home: { shirt: "#6CABDD", trim: "#1C2C5B" }, away: { shirt: "#F2F4F7", trim: "#1C2C5B" } },
  "Manchester United":        { home: { shirt: "#DA291C", trim: "#FFFFFF" }, away: { shirt: "#17181A", trim: "#DA291C" } },
  "Newcastle United":         { home: { shirt: "#241F20", trim: "#FFFFFF" }, away: { shirt: "#F2F4F7", trim: "#241F20" } },
  "Nottingham Forest":        { home: { shirt: "#DD0000", trim: "#FFFFFF" }, away: { shirt: "#F2F4F7", trim: "#DD0000" } },
  "Sunderland":               { home: { shirt: "#EB172B", trim: "#FFFFFF" }, away: { shirt: "#17181A", trim: "#EB172B" } },
  "Tottenham Hotspur":        { home: { shirt: "#FFFFFF", trim: "#132257" }, away: { shirt: "#132257", trim: "#FFFFFF" } },
  "West Ham United":          { home: { shirt: "#7A263A", trim: "#1BB1E7" }, away: { shirt: "#F2F4F7", trim: "#7A263A" } },
  "Wolverhampton Wanderers":  { home: { shirt: "#FDB913", trim: "#231F20" }, away: { shirt: "#17181A", trim: "#FDB913" } },
};

/** A club nobody has colours for. Neutral, and it never clashes with much. */
const NEUTRAL: ClubKits = {
  home: { shirt: "#2F6F4E", trim: "#F2F4F7" },
  away: { shirt: "#F2F4F7", trim: "#2F6F4E" },
};

/** Loose enough to survive "Wolves", "Spurs" and "Man City". */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

const BY_LOOSE: Record<string, ClubKits> = (() => {
  const out: Record<string, ClubKits> = {};
  for (const [k, v] of Object.entries(CLUB_KITS)) out[normalise(k)] = v;
  // The short names people and older club lists actually use.
  const alias: Record<string, string> = {
    wolves: "Wolverhampton Wanderers", wolverhampton: "Wolverhampton Wanderers",
    spurs: "Tottenham Hotspur", tottenham: "Tottenham Hotspur",
    manutd: "Manchester United", manunited: "Manchester United",
    mancity: "Manchester City", city: "Manchester City",
    fulham: "Fulham FC", bournemouth: "AFC Bournemouth",
    brighton: "Brighton & Hove Albion", palace: "Crystal Palace",
    newcastle: "Newcastle United", forest: "Nottingham Forest",
    nottmforest: "Nottingham Forest", leeds: "Leeds United",
    westham: "West Ham United", villa: "Aston Villa",
  };
  for (const [a, real] of Object.entries(alias)) out[a] = CLUB_KITS[real];
  return out;
})();

export function kitsOf(club: string): ClubKits {
  return CLUB_KITS[club] ?? BY_LOOSE[normalise(club)] ?? NEUTRAL;
}

// ── Telling two shirts apart ────────────────────────────────────────────────

interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * How much colour is in it at all — max minus min channel, 0..1.
 *
 * NOT HSL saturation, and the difference bit. Saturation is chroma divided by
 * how close the colour is to the middle grey, so it blows up at the extremes: an
 * off-white of #F2F4F7 has a hundredth of a channel between its blue and its
 * red, and HSL calls it 24% saturated pale blue. The clash test believed it, and
 * decided Manchester City's white change shirt was too close to their sky blue
 * home one. Chroma says 0.02 and means it.
 */
function chroma(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Would these two shirts be hard to tell apart on a pitch?
 *
 * Three cases, and they are genuinely different questions:
 *
 *  - Two near-neutrals — white against white, black against navy — have no hue
 *    to separate them, so only lightness can, and it has to do a lot of work.
 *  - A neutral against a colour separates easily UNLESS they are also the same
 *    brightness, which is when a white shirt disappears into a pale one.
 *  - Two colours are fine at more than about 35 degrees of hue apart. Inside
 *    that they are the same colour family — red and claret, sky and royal — and
 *    only a real difference in brightness saves them. 35 rather than 45 because
 *    hue moves fast through the warm end: red sits at 1 and gold at 43, and
 *    Wolves have never once changed at the Emirates.
 */
export function clashes(a: string, b: string): boolean {
  const A = hexToHsl(a), B = hexToHsl(b);
  const aFlat = chroma(a) < 0.1, bFlat = chroma(b) < 0.1;
  if (aFlat && bFlat) return Math.abs(A.l - B.l) < 0.35;
  if (aFlat !== bFlat) return Math.abs(A.l - B.l) < 0.2;
  if (hueGap(A.h, B.h) > 35) return false;
  return Math.abs(A.l - B.l) < 0.4;
}

/** Nothing else worked: whatever the home side is NOT. */
function emergency(homeShirt: string, trim: string): Kit {
  const dark = hexToHsl(homeShirt).l < 0.5;
  return dark ? { shirt: "#F2F4F7", trim } : { shirt: "#17181A", trim };
}

export interface MatchKits { home: Kit; away: Kit; keeper: Kit }

/**
 * Who wears what.
 *
 * The home side wears its home shirt — always, that is what home means. The
 * away side wears its own home shirt too, and changes only if the two would be
 * hard to tell apart. If its change strip clashes as well (sky blue at Chelsea,
 * where royal, navy and sky are all the same colour), it goes to whichever of
 * near-white or near-black the home side is not.
 */
export function kitsFor(homeClub: string, awayClub: string): MatchKits {
  const home = kitsOf(homeClub).home;
  const away = kitsOf(awayClub);
  const chosen = !clashes(home.shirt, away.home.shirt) ? away.home
    : !clashes(home.shirt, away.away.shirt) ? away.away
    : emergency(home.shirt, away.away.trim);
  return { home, away: chosen, keeper: keeperKit(home.shirt, chosen.shirt) };
}

/**
 * The goalkeeper wears what neither of them is wearing.
 *
 * He used to be gold always, which is fine until Wolves turn up in gold — and
 * the keeper on screen is always the OPPOSITION keeper, so that is one team in
 * two shades of the same colour.
 */
const KEEPER_OPTIONS: Kit[] = [
  { shirt: "#FBBF24", trim: "#92400E" },   // gold
  { shirt: "#84CC16", trim: "#3F6212" },   // lime
  { shirt: "#E879F9", trim: "#86198F" },   // magenta
  { shirt: "#2DD4BF", trim: "#115E59" },   // teal
  { shirt: "#1F2937", trim: "#9CA3AF" },   // charcoal
];

export function keeperKit(homeShirt: string, awayShirt: string): Kit {
  for (const k of KEEPER_OPTIONS) {
    if (!clashes(homeShirt, k.shirt) && !clashes(awayShirt, k.shirt)) return k;
  }
  return KEEPER_OPTIONS[KEEPER_OPTIONS.length - 1];
}

/**
 * Ink that can be read against a shirt.
 *
 * The YOU label sits over the figure, and it was always white. That was safe
 * while your side was always emerald; it is not safe at Fulham, Spurs or Leeds,
 * where the shirt is white and the one marker telling you which of eleven men
 * you are would have disappeared into it.
 */
export function labelInk(shirt: string): string {
  return hexToHsl(shirt).l > 0.62 ? "#111827" : "#FFFFFF";
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * A club's own colour, readable set directly as TEXT on the dark stadium
 * panels (the versus screen's header, match graphics) rather than on a
 * shirt-shaped swatch behind it.
 *
 * `labelInk` solves the opposite problem — ink ON a shirt-coloured
 * background — and is no help here: Newcastle's shirt IS the near-black
 * that already reads as white-on-black, so using the shirt colour as the
 * text itself, directly on a near-black panel, made the label essentially
 * invisible ("dark grey on a black background"). A shirt with real colour
 * in it just gets lifted to a lightness that reads, hue kept, so it still
 * feels like that club's own line (Chelsea's blue, Villa's claret) rather
 * than a generic label. A dark, near-neutral shirt has no real hue worth
 * lifting — Newcastle's black-with-a-rounding-error is not "this club's
 * pink" — so it falls back to the trim instead, which is usually the
 * club's actual second colour (Newcastle's white, exactly what their real
 * change kit already is), and only to plain light grey if even that is too
 * dark to read.
 */
export function kitLabelOnDark(shirt: string, trim: string): string {
  const hsl = hexToHsl(shirt);
  if (hsl.l >= 0.5) return shirt;
  if (chroma(shirt) >= 0.12) {
    return hslToHex({ h: hsl.h, s: Math.max(hsl.s, 0.45), l: 0.6 });
  }
  const trimHsl = hexToHsl(trim);
  return trimHsl.l >= 0.5 ? trim : "#E5E7EB";
}
