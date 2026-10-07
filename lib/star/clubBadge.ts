/**
 * DRAWN CLUB BADGES — no letters (Harry, 6 Oct 2026: "the current ones with
 * letters suck"). Each club's shape and up to three colours come from Mikey's
 * club data (/admin/clubs: badgeStyle, badge1-3); a pattern and an emblem are
 * picked from the club's name, so the same club always gets the same badge.
 *
 * Plan (BADGES_PLAN.md). Step 2: a club whose data names something (its
 * nickname: Foxes, Gunners, Magpies) gets that symbol in place of the ball
 * or star — lib/star/badgeSymbols.ts. /admin/badges shows every badge and
 * lets you redo one (kept on that device: lib/star/badgeOverrides.ts).
 */
import { profileOf, COLOUR_WORDS } from "./data/clubProfiles";
import { kitsOf } from "./kits";
import { symbolFor, symbolSvg, type SymbolId } from "./badgeSymbols";

export type BadgeShape = "shield" | "round" | "crest" | "oval" | "hexagon" | "pentagon" | "star" | "heart" | "cross";
export type BadgePattern = "plain" | "stripes" | "halves" | "band" | "chevron" | "sash" | "quarters" | "hoops";
export type BadgeEmblem = "ball" | "star" | "none" | "symbol";

export interface BadgeDesign {
  shape: BadgeShape;
  colours: [string, string, string];
  pattern: BadgePattern;
  emblem: BadgeEmblem;
  /** Set when emblem is "symbol". */
  symbol?: SymbolId;
}

/**
 * A hand redo from /admin/badges. Any field left out keeps what the data
 * picks. A symbol set here replaces the emblem with that symbol.
 */
export interface BadgeOverride {
  pattern?: BadgePattern;
  emblem?: BadgeEmblem;
  symbol?: SymbolId;
}

/** Outline in a 100x100 box. */
export const SHAPE_PATH: Record<BadgeShape, string> = {
  shield: "M12 8H88V46C88 72 70 86 50 95C30 86 12 72 12 46Z",
  round: "M50 5A45 45 0 1 1 49.99 5Z",
  crest: "M10 14L30 5L50 13L70 5L90 14V48C90 73 71 87 50 95C29 87 10 73 10 48Z",
  oval: "M50 4C76 4 88 26 88 50C88 74 76 96 50 96C24 96 12 74 12 50C12 26 24 4 50 4Z",
  hexagon: "M50 4L90 27V73L50 96L10 73V27Z",
  pentagon: "M50 4L94 36L77 94H23L6 36Z",
  star: "M50 3L62 34L95 35L69 56L78 90L50 71L22 90L31 56L5 35L38 34Z",
  heart: "M50 92C20 70 5 52 5 33C5 17 17 7 30 7C40 7 46 13 50 20C54 13 60 7 70 7C83 7 95 17 95 33C95 52 80 70 50 92Z",
  cross: "M12 8H88V46C88 72 70 86 50 95C30 86 12 72 12 46Z",
};

const SHAPE_WORD: Record<string, BadgeShape> = {
  shield: "shield", round: "round", circle: "round", monogram: "round", crest: "crest", oval: "oval",
  hexagon: "hexagon", pentagon: "pentagon", star: "star", heart: "heart", cross: "cross",
};

/** Same small string hash the squads use (djb2-xor), so it never changes between visits. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

export const PATTERNS: BadgePattern[] = ["plain", "stripes", "halves", "band", "chevron", "sash", "quarters", "hoops"];

export function badgeDesign(club: string, override?: BadgeOverride): BadgeDesign {
  const p = profileOf(club);
  const words = (p?.badgeColours ?? []).map((w) => COLOUR_WORDS[w.toLowerCase()]).filter(Boolean) as string[];
  const kit = kitsOf(club).home;
  const c0 = words[0] ?? kit.shirt;
  const c1 = words[1] ?? (kit.trim !== c0 ? kit.trim : "#F2F4F7");
  const c2 = words[2] ?? c1;
  const shape = SHAPE_WORD[(p?.badgeStyle ?? "").toLowerCase()] ?? "shield";
  const h = hash(club);
  // A cross badge always shows its cross; small shapes keep it simple.
  const pattern: BadgePattern = shape === "cross" ? "quarters"
    : shape === "star" || shape === "heart" ? (h % 2 ? "plain" : "band")
    : PATTERNS[h % PATTERNS.length];
  const pick = symbolFor(club);
  // Not every badge needs a symbol (Harry, 7 Oct 2026): only clubs whose data
  // names one get it; the rest keep the ball or star.
  const emblem: BadgeEmblem = shape === "star" ? "none" : pick ? "symbol" : (h >> 4) % 3 === 0 ? "star" : "ball";
  const d: BadgeDesign = { shape, colours: [c0, c1, c2], pattern, emblem, symbol: pick?.symbol };
  if (override?.pattern) d.pattern = override.pattern;
  if (override?.emblem) d.emblem = override.emblem;
  if (override?.symbol) { d.emblem = "symbol"; d.symbol = override.symbol; }
  if (d.emblem === "symbol" && !d.symbol) d.emblem = "ball";
  return d;
}

/** Relative brightness (0-1) of a #RRGGBB colour. */
function lum(hexColour: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexColour);
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE = "#F2F4F7", BLACK = "#17181A";

/**
 * The symbol's colour and outline: the club's own second or third colour
 * when it stands out from the main one, else white or black. The outline is
 * the main colour, so the symbol reads as cut out of the badge.
 */
export function symbolColours(d: BadgeDesign): { ink: string; halo: string } {
  const [a, b, c] = d.colours;
  const ink = [b, c].find((x) => contrast(x, a) >= 2.4) ?? (contrast(WHITE, a) >= contrast(BLACK, a) ? WHITE : BLACK);
  const halo = contrast(ink, a) >= 2.4 ? a : contrast(ink, BLACK) >= contrast(ink, WHITE) ? BLACK : WHITE;
  return { ink, halo };
}

/** The pattern's shapes, drawn over the base colour and clipped to the outline. */
export function patternSvg(d: BadgeDesign): string {
  const [, b, c] = d.colours;
  switch (d.pattern) {
    case "stripes": return [20, 44, 68].map((x) => `<rect x="${x}" y="0" width="12" height="100" fill="${b}"/>`).join("");
    case "halves": return `<rect x="50" y="0" width="50" height="100" fill="${b}"/>`;
    case "band": return `<rect x="0" y="38" width="100" height="22" fill="${b}"/>`;
    case "chevron": return `<path d="M0 30L50 62L100 30V48L50 80L0 48Z" fill="${b}"/>`;
    case "sash": return `<path d="M0 18L18 0L100 82L82 100Z" fill="${b}"/>`;
    case "quarters": return `<rect x="50" y="0" width="50" height="50" fill="${b}"/><rect x="0" y="50" width="50" height="50" fill="${c}"/><rect x="44" y="0" width="12" height="100" fill="${b}"/><rect x="0" y="40" width="100" height="12" fill="${b}"/>`;
    case "hoops": return [22, 50, 78].map((y) => `<rect x="0" y="${y - 6}" width="100" height="12" fill="${b}"/>`).join("");
    default: return "";
  }
}

/** The emblem sits in a disc in the third colour, so it reads on any pattern. */
export function emblemSvg(d: BadgeDesign): string {
  if (d.emblem === "none") return "";
  const [a, b, c] = d.colours;
  const disc = c === a ? b : c;
  const ink = disc === a ? b : a;
  const cy = d.shape === "round" || d.shape === "oval" || d.shape === "hexagon" ? 50 : d.shape === "heart" ? 44 : 46;
  if (d.emblem === "symbol" && d.symbol) {
    const sc = symbolColours(d);
    const size = d.shape === "heart" ? 50 : d.shape === "pentagon" || d.shape === "hexagon" ? 56 : 60;
    return symbolSvg(d.symbol, 50, cy + 2, size, sc.ink, sc.halo);
  }
  const ring = `<circle cx="50" cy="${cy}" r="17" fill="${disc}" stroke="${ink}" stroke-width="3"/>`;
  if (d.emblem === "star") {
    return ring + `<path transform="translate(50 ${cy}) scale(0.22) translate(-50 -50)" d="${SHAPE_PATH.star}" fill="${ink}"/>`;
  }
  // A football: a pentagon and five stubs.
  const pent = [0, 1, 2, 3, 4].map((i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${(50 + 5.5 * Math.cos(t)).toFixed(1)} ${(cy + 5.5 * Math.sin(t)).toFixed(1)}`;
  });
  const stubs = [0, 1, 2, 3, 4].map((i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `<line x1="${(50 + 5.5 * Math.cos(t)).toFixed(1)}" y1="${(cy + 5.5 * Math.sin(t)).toFixed(1)}" x2="${(50 + 12 * Math.cos(t)).toFixed(1)}" y2="${(cy + 12 * Math.sin(t)).toFixed(1)}" stroke="#17181A" stroke-width="2.4"/>`;
  }).join("");
  return `<circle cx="50" cy="${cy}" r="17" fill="#F2F4F7" stroke="${ink}" stroke-width="3"/><path d="M${pent.join("L")}Z" fill="#17181A"/>` + stubs;
}

/** The whole badge as an SVG string (for the admin grid, exports, Higgsfield references). */
export function badgeSvg(club: string, id = "b", override?: BadgeOverride): string {
  const d = badgeDesign(club, override);
  const clip = `${id}-clip`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<defs><clipPath id="${clip}"><path d="${SHAPE_PATH[d.shape]}"/></clipPath></defs>`
    + `<g clip-path="url(#${clip})"><rect width="100" height="100" fill="${d.colours[0]}"/>${patternSvg(d)}</g>`
    + `<path d="${SHAPE_PATH[d.shape]}" fill="none" stroke="${d.colours[1] === d.colours[0] ? "#17181A" : d.colours[1]}" stroke-width="5" stroke-linejoin="round"/>`
    + `<path d="${SHAPE_PATH[d.shape]}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.2" stroke-linejoin="round"/>`
    + emblemSvg(d)
    + `</svg>`;
}
