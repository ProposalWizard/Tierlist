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
 * A small named-colour palette, and a `k(shirt, trim)` builder — used only
 * to build LOWER_LEAGUE_KITS below (League One/Two/National League), where
 * colours were given by NAME ("Blue, white hoops" etc.) for ~70 clubs
 * rather than as hex, and typing 140 hand-picked hex values by eye would be
 * slower and more error-prone than naming each colour once here.
 */
const NAMED: Record<string, string> = {
  red: "#D71920", blue: "#0057B8", navy: "#001F5B", lightblue: "#6CABDD",
  white: "#F2F4F7", offwhite: "#F2F0E6", black: "#17181A",
  yellow: "#FBF000", amber: "#F2A900", gold: "#FDB913", orange: "#F78F1E",
  claret: "#6C1D45", green: "#159C56", maroon: "#7A263A",
};
const k = (shirt: keyof typeof NAMED, trim: keyof typeof NAMED): Kit =>
  ({ shirt: NAMED[shirt], trim: NAMED[trim] });
const kits = (home: Kit, away: Kit): ClubKits => ({ home, away });

/** League One, League Two, and the National League — see clubs.ts's own
 *  note on these three tiers. Kept as its own record and spread into
 *  CLUB_KITS below, rather than inline, purely so this block reads as one
 *  clearly-scoped addition rather than 70 more lines mixed into the
 *  hand-tuned Premier League/Championship section above it. */
const LOWER_LEAGUE_KITS: Record<string, ClubKits> = {
  // League One (the five real overlap clubs — Huddersfield/Leicester/
  // Luton/Reading FC/Wigan — already have entries above and are not
  // repeated here).
  "AFC Wimbledon": kits(k("blue", "white"), k("yellow", "blue")),
  "Barnsley": kits(k("red", "white"), k("white", "blue")),
  "Blackpool": kits(k("orange", "white"), k("white", "orange")),
  "Bradford City": kits(k("claret", "amber"), k("white", "claret")),
  "Bromley": kits(k("red", "black"), k("white", "black")),
  "Burton Albion": kits(k("black", "yellow"), k("white", "black")),
  "Cambridge United": kits(k("amber", "black"), k("black", "amber")),
  "Doncaster Rovers": kits(k("red", "white"), k("white", "red")),
  "Leyton Orient": kits(k("red", "white"), k("white", "red")),
  "Mansfield Town": kits(k("yellow", "blue"), k("blue", "yellow")),
  "Milton Keynes Dons": kits(k("white", "red"), k("red", "black")),
  "Notts County": kits(k("black", "white"), k("white", "black")),
  "Oxford United": kits(k("yellow", "blue"), k("blue", "yellow")),
  "Peterborough United": kits(k("blue", "white"), k("white", "blue")),
  "Plymouth Argyle": kits(k("green", "black"), k("white", "green")),
  "Sheffield Wednesday": kits(k("blue", "white"), k("black", "blue")),
  "Stevenage": kits(k("red", "white"), k("white", "red")),
  "Stockport County": kits(k("blue", "white"), k("white", "blue")),
  "Wycombe Wanderers": kits(k("blue", "white"), k("yellow", "navy")),

  // League Two
  "Accrington Stanley": kits(k("red", "white"), k("white", "red")),
  "Barnet": kits(k("orange", "black"), k("white", "orange")),
  "Bristol Rovers": kits(k("blue", "white"), k("white", "blue")),
  "Cheltenham Town": kits(k("red", "white"), k("white", "red")),
  "Chesterfield": kits(k("blue", "white"), k("white", "blue")),
  "Colchester United": kits(k("blue", "white"), k("yellow", "blue")),
  "Crawley Town": kits(k("red", "white"), k("white", "red")),
  "Crewe Alexandra": kits(k("red", "white"), k("white", "red")),
  "Exeter City": kits(k("red", "black"), k("white", "red")),
  "Fleetwood Town": kits(k("red", "white"), k("white", "red")),
  "Gillingham": kits(k("blue", "white"), k("white", "blue")),
  "Grimsby Town": kits(k("black", "white"), k("white", "black")),
  "Newport County": kits(k("amber", "black"), k("white", "amber")),
  "Northampton Town": kits(k("claret", "white"), k("white", "claret")),
  "Oldham Athletic": kits(k("blue", "white"), k("white", "blue")),
  "Port Vale": kits(k("black", "white"), k("white", "black")),
  "Rochdale": kits(k("blue", "black"), k("white", "blue")),
  "Rotherham United": kits(k("red", "white"), k("white", "red")),
  "Salford City": kits(k("red", "white"), k("white", "red")),
  "Shrewsbury Town": kits(k("navy", "lightblue"), k("amber", "navy")),
  "Swindon Town": kits(k("red", "white"), k("white", "red")),
  "Tranmere Rovers": kits(k("white", "blue"), k("black", "white")),
  "Walsall": kits(k("red", "white"), k("white", "red")),
  "York City": kits(k("red", "white"), k("white", "red")),

  // National League
  "AFC Fylde": kits(k("red", "blue"), k("blue", "white")),
  "Aldershot Town": kits(k("red", "blue"), k("white", "red")),
  "Altrincham": kits(k("red", "white"), k("white", "red")),
  "Barrow": kits(k("blue", "white"), k("white", "blue")),
  "Boreham Wood": kits(k("black", "white"), k("white", "black")),
  "Boston United": kits(k("yellow", "black"), k("white", "yellow")),
  "Carlisle United": kits(k("blue", "white"), k("white", "blue")),
  "Eastleigh": kits(k("blue", "white"), k("white", "blue")),
  "FC Halifax Town": kits(k("blue", "white"), k("yellow", "blue")),
  "Forest Green Rovers": kits(k("green", "black"), k("white", "green")),
  "Gateshead": kits(k("red", "black"), k("white", "red")),
  "Harrogate Town": kits(k("black", "yellow"), k("white", "black")),
  "Hartlepool United": kits(k("blue", "white"), k("yellow", "blue")),
  "Hornchurch": kits(k("red", "blue"), k("white", "red")),
  "Kidderminster Harriers": kits(k("red", "white"), k("black", "yellow")),
  "Scunthorpe United": kits(k("red", "white"), k("blue", "white")),
  "Solihull Moors": kits(k("black", "yellow"), k("yellow", "black")),
  "Southend United": kits(k("blue", "white"), k("white", "blue")),
  "Sutton United": kits(k("amber", "maroon"), k("white", "amber")),
  "Tamworth": kits(k("red", "white"), k("offwhite", "maroon")),
  "Wealdstone": kits(k("blue", "white"), k("white", "blue")),
  "Woking": kits(k("red", "white"), k("yellow", "navy")),
  "Worthing": kits(k("red", "blue"), k("blue", "red")),
  "Yeovil Town": kits(k("green", "white"), k("white", "green")),

  // National League pool — real clubs waiting to come up, given kits too
  "Chorley": kits(k("black", "white"), k("yellow", "black")),
  "Scarborough Athletic": kits(k("red", "white"), k("white", "red")),
  "Dorking Wanderers": kits(k("red", "blue"), k("black", "yellow")),
  "Torquay United": kits(k("yellow", "navy"), k("blue", "yellow")),
};

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
  // The three most recently promoted into the twenty — real colours, same
  // as the other seventeen, not the placeholder every one of them fell back
  // to before (see the Championship/pool block further down for the fuller
  // version of this same gap).
  "Hull City":                { home: { shirt: "#F2A900", trim: "#111111" }, away: { shirt: "#FFFFFF", trim: "#F2A900" } },
  "Ipswich Town":             { home: { shirt: "#0044A9", trim: "#FFFFFF" }, away: { shirt: "#E8D8B8", trim: "#C8102E" } },
  "Coventry City":            { home: { shirt: "#6CACE4", trim: "#041E42" }, away: { shirt: "#F2F0E6", trim: "#FF6B5A" } },
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

  // ── Everyone else this career can actually play against ──
  //
  // Reported directly: a club with no entry above falls back to the same
  // flat NEUTRAL green for every one of them, so a Championship (or
  // promotion-pool) season showed a wall of identical badges with one real
  // club's colour standing out — not a bug in that one club, a gap in every
  // OTHER one. Real shirt/trim, the same way the twenty above are.
  "Queens Park Rangers":      { home: { shirt: "#0057B8", trim: "#F2C94C" }, away: { shirt: "#B8A9D9", trim: "#0057B8" } },
  "Millwall FC":              { home: { shirt: "#001F5B", trim: "#D4AF37" }, away: { shirt: "#FFFFFF", trim: "#001F5B" } },
  "Bolton Wanderers":         { home: { shirt: "#FFFFFF", trim: "#001F3F" }, away: { shirt: "#7A263A", trim: "#D4AF37" } },
  "Watford":                  { home: { shirt: "#FBF000", trim: "#111111" }, away: { shirt: "#D71920", trim: "#FBF000" } },
  "Middlesbrough":            { home: { shirt: "#E31B23", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#E31B23" } },
  "Charlton Athletic":        { home: { shirt: "#D71920", trim: "#FFFFFF" }, away: { shirt: "#111111", trim: "#D71920" } },
  "Swansea City":             { home: { shirt: "#FFFFFF", trim: "#B87333" }, away: { shirt: "#111111", trim: "#B87333" } },
  // The away shirt given for this club was black with a navy trim — too
  // close to the navy home shirt to tell apart (and the trim invisible on
  // it besides). Kept the navy trim exactly as given; softened the shirt
  // from black to grey, which clears both problems and is still a real,
  // plausible change strip for a navy club.
  "West Bromwich Albion":     { home: { shirt: "#122F67", trim: "#FFFFFF" }, away: { shirt: "#9CA3AF", trim: "#122F67" } },
  "Blackburn Rovers":         { home: { shirt: "#009FE3", trim: "#FFFFFF" }, away: { shirt: "#111111", trim: "#FFFFFF" } },
  "Cardiff City":             { home: { shirt: "#0070B8", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#0070B8" } },
  "Wrexham":                  { home: { shirt: "#E31B23", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#E31B23" } },
  "Birmingham City":          { home: { shirt: "#0057B8", trim: "#FFFFFF" }, away: { shirt: "#FFD500", trim: "#0057B8" } },
  "Sheffield United":         { home: { shirt: "#EE2737", trim: "#111111" }, away: { shirt: "#111111", trim: "#EE2737" } },
  "Lincoln City":             { home: { shirt: "#E30613", trim: "#111111" }, away: { shirt: "#111111", trim: "#F5D547" } },
  "Preston North End":        { home: { shirt: "#FFFFFF", trim: "#001F5B" }, away: { shirt: "#0057B8", trim: "#F2C500" } },
  "Norwich City":             { home: { shirt: "#FFF200", trim: "#00A650" }, away: { shirt: "#111111", trim: "#FFF200" } },
  "Stoke City":               { home: { shirt: "#E03A3E", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#E03A3E" } },
  "Derby County":             { home: { shirt: "#FFFFFF", trim: "#111111" }, away: { shirt: "#111111", trim: "#FFFFFF" } },
  "Portsmouth":               { home: { shirt: "#001F5B", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#001F5B" } },
  // Given as a silver shirt with a mid-grey trim — too close in lightness
  // for the trim to actually read against the shirt. Kept the silver
  // shirt exactly as given; darkened the trim to a real navy-charcoal.
  "Bristol City":             { home: { shirt: "#E30613", trim: "#FFFFFF" }, away: { shirt: "#C9CDD1", trim: "#1F2937" } },
  "Southampton":              { home: { shirt: "#D71920", trim: "#111111" }, away: { shirt: "#6FA8DC", trim: "#E8A9C2" } },
  "Luton Town":               { home: { shirt: "#F78F1E", trim: "#002D62" }, away: { shirt: "#002D62", trim: "#F78F1E" } },
  "Huddersfield Town":        { home: { shirt: "#0044A3", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#0044A3" } },
  "Leicester City":           { home: { shirt: "#003090", trim: "#FDBE11" }, away: { shirt: "#FFFFFF", trim: "#003090" } },
  "Reading FC":               { home: { shirt: "#004494", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#004494" } },
  "Wigan Athletic":           { home: { shirt: "#1B458F", trim: "#FFFFFF" }, away: { shirt: "#FFFFFF", trim: "#1B458F" } },

  // ── League One / League Two / National League ──
  //
  // Given directly as named colours ("Blue, yellow, white" etc.), not hex —
  // built from a small named-colour palette (NAMED below) rather than
  // eyeballing 70-odd hex pairs by hand, the same idea as this file's own
  // NEUTRAL/KEEPER_OPTIONS swatches. Real crest colours per club, so a
  // fourth English tier reads as distinct clubs rather than a wall of the
  // same six or seven generic shirts.
  ...LOWER_LEAGUE_KITS,
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

/** `override`, when given, is a real design a club's owner has actually
 *  put in place via the Boardroom's kit vote (clubPowers.ts) — checked
 *  before the real-world default, exactly the same way a club's own
 *  facilities/prestige overrides already win over a generic fallback
 *  elsewhere in this game. */
export function kitsOf(club: string, override?: ClubKits): ClubKits {
  return override ?? CLUB_KITS[club] ?? BY_LOOSE[normalise(club)] ?? NEUTRAL;
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

/**
 * Would these two whole KITS be hard to tell apart — shirt and shorts?
 *
 * The shorts are drawn in the trim colour. Two different shirts are not
 * enough on their own: Man United (red shirt, white shorts) against
 * Bournemouth's change strip (white shirt, red shorts) are the same two
 * colours swapped, and on a small figure both teams read as red-and-white.
 * Harry, 24 Sep 2026, asked whether the check should look at the whole kit:
 * "yes". So a kit clashes when the shirts clash, OR when each side's shirt
 * clashes with the other side's shorts (the same colours, swapped).
 */
export function kitClashes(a: Kit, b: Kit): boolean {
  if (clashes(a.shirt, b.shirt)) return true;
  return clashes(a.shirt, b.trim) && clashes(a.trim, b.shirt);
}

/**
 * The away side's options, in order, when its own kits clash.
 *
 * Real sides swap shorts before they reach for a third strip, so before the
 * last resort the away side keeps one of its own shirts and changes only the
 * shorts. Last of all: whatever the home side is NOT, near-white or near-black.
 */
function awayFallback(home: Kit, away: ClubKits): Kit {
  // Plain shorts colours a change strip could plausibly use: black, white,
  // grey, then navy, royal and green for the few cases none of those escape.
  const plain = ["#17181A", "#F2F4F7", "#6B7280", "#001F5B", "#0057B8", "#159C56"];
  const tries: Kit[] = [];
  for (const t of [away.away.shirt, away.away.trim, ...plain]) tries.push({ shirt: away.home.shirt, trim: t });
  for (const t of [away.home.shirt, away.home.trim, ...plain]) tries.push({ shirt: away.away.shirt, trim: t });
  const dark = hexToHsl(home.shirt).l < 0.5;
  const last = dark ? ["#F2F4F7", "#17181A"] : ["#17181A", "#F2F4F7"];
  for (const shirt of last) for (const t of [away.away.trim, away.home.trim, away.home.shirt, ...plain]) tries.push({ shirt, trim: t });
  for (const kit of tries) {
    if (!clashes(kit.shirt, kit.trim) && !kitClashes(home, kit)) return kit;
  }
  return { shirt: last[0], trim: away.away.trim };
}

export interface MatchKits { home: Kit; away: Kit; keeper: Kit }

/**
 * Who wears what.
 *
 * The home side wears its home shirt — always, that is what home means. The
 * away side wears its own home shirt too, and changes only if the two would be
 * hard to tell apart — shirt against shirt, or the same two colours swapped
 * between shirts and shorts (`kitClashes`). If its change strip clashes as well (sky blue at Chelsea,
 * where royal, navy and sky are all the same colour), it goes to whichever of
 * near-white or near-black the home side is not.
 */
export function kitsFor(
  homeClub: string, awayClub: string, homeOverride?: ClubKits, awayOverride?: ClubKits,
): MatchKits {
  const home = kitsOf(homeClub, homeOverride).home;
  const away = kitsOf(awayClub, awayOverride);
  const chosen = !kitClashes(home, away.home) ? away.home
    : !kitClashes(home, away.away) ? away.away
    : awayFallback(home, away);
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
