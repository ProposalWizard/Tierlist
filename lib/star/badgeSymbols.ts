/**
 * BADGE SYMBOLS — the drawing in the middle of a club's badge (BADGES_PLAN.md
 * step 2). Harry, 7 Oct 2026: "Not every single badge needs a symbol, and use
 * the data, not Mikey." So nobody ticks these off by hand: a club gets a
 * symbol only when its own club data says so — mostly its nickname
 * (Foxes → fox, Gunners → cannon, Magpies → magpie). A club whose data says
 * nothing clear keeps the plain ball or star.
 *
 * Every drawing is a generic, flat shape made for this game (a few path
 * operations each, readable at 24 px). None copies a real club's crest.
 *
 * Pure: no React.
 */
import { profileOf } from "./data/clubProfiles";

export type SymbolId =
  | "lion" | "eagle" | "magpie" | "canary" | "robin" | "seagull" | "swan" | "bird" | "raven" | "owl"
  | "cockerel" | "fox" | "wolf" | "bee" | "ram" | "tree" | "tower" | "ship" | "anchor" | "fish"
  | "crown" | "cross" | "halo" | "rose" | "lily" | "tulip" | "hammers" | "cannon" | "swords"
  | "pickaxe" | "dog" | "stag" | "bull" | "tiger" | "cat" | "trident" | "star" | "snake" | "train"
  | "hat" | "chair" | "cherry" | "shamrock";

/**
 * One piece of a drawing, in a 100x100 box.
 * role: "ink" = the symbol's colour (gets the outline that makes it read on
 * any pattern); "cut" = a hole showing the outline colour (eyes, stripes);
 * "red" = a fixed red (a robin's breast); "pale" = the outline colour with an
 * ink edge (a bee's wings).
 * line: when set, the path is a stroked line this wide instead of a fill.
 */
interface Piece { d: string; role?: "ink" | "cut" | "red" | "pale"; line?: number; transform?: string }

/** A circle as a path, so every piece is one shape type. */
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
/** A spiky ring (a lion's mane): n points between two radii. */
const spikes = (cx: number, cy: number, rOut: number, rIn: number, n: number) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const t = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
};

const STAR_PATH = "M50 3L62 34L95 35L69 56L78 90L50 71L22 90L31 56L5 35L38 34Z";

const HAMMER: Piece[] = [
  { d: "M46 34H54V92H46Z" },
  { d: "M30 14H70V34H30Z" },
];
const SWORD: Piece[] = [
  { d: "M46 14L50 4L54 14V64H46Z" },
  { d: "M32 64H68V71H32Z" },
  { d: "M46 71H54V86H46Z" },
  { d: circle(50, 90, 5) },
];
const PICK: Piece[] = [
  { d: "M45 22H55V94H45Z" },
  { d: "M6 36Q50 0 94 36Q50 18 6 36Z" },
];
const turned = (pieces: Piece[], deg: number): Piece[] =>
  pieces.map((p) => ({ ...p, transform: `rotate(${deg} 50 55)` }));

/** The drawings. Keep each to a handful of shapes. */
export const SYMBOL_ART: Record<SymbolId, Piece[]> = {
  lion: [
    { d: spikes(50, 50, 44, 32, 14) },
    { d: circle(50, 52, 24), role: "cut" },
    { d: circle(41, 46, 3.5) },
    { d: circle(59, 46, 3.5) },
    { d: "M44 56H56L50 64Z" },
    { d: "M50 64V70M44 72Q50 76 56 72", line: 3 },
  ],
  eagle: [
    { d: circle(50, 22, 9) },
    { d: "M58 18L70 23L58 27Z" },
    { d: "M41 30H59L57 64L50 72L43 64Z" },
    { d: "M44 66L50 90L56 66Z" },
    { d: "M44 34L6 22L14 36L4 44L16 50L8 60L43 56Z" },
    { d: "M56 34L94 22L86 36L96 44L84 50L92 60L57 56Z" },
  ],
  magpie: [
    { d: "M22 56C22 40 40 32 58 36L64 46C60 62 40 70 22 56Z" },
    { d: circle(66, 34, 11) },
    { d: "M75 30L90 34L75 38Z" },
    { d: "M28 56L6 84L16 88L38 62Z" },
    { d: "M44 64L42 84M54 64L56 84", line: 4 },
    { d: ellipse(46, 54, 11, 5), role: "cut" },
    { d: circle(69, 31, 2.5), role: "cut" },
  ],
  canary: [
    { d: ellipse(48, 58, 24, 19) },
    { d: circle(68, 36, 14) },
    { d: "M80 32L94 38L80 43Z" },
    { d: "M28 58L8 68L13 76L32 68Z" },
    { d: "M42 76L40 90M54 76L56 90", line: 4 },
    { d: circle(71, 33, 3), role: "cut" },
  ],
  robin: [
    { d: ellipse(48, 58, 24, 19) },
    { d: circle(68, 36, 14) },
    { d: "M80 34L92 38L80 41Z" },
    { d: "M28 54L10 44L12 54L28 64Z" },
    { d: "M42 76L40 90M54 76L56 90", line: 4 },
    { d: "M58 44C72 44 74 62 62 70C56 62 54 52 58 44Z", role: "red" },
    { d: circle(70, 32, 3), role: "cut" },
  ],
  seagull: [
    { d: "M6 44Q28 22 50 50Q72 22 94 44Q72 36 50 64Q28 36 6 44Z" },
  ],
  swan: [
    { d: "M10 58C16 86 74 90 92 62C82 70 70 68 62 58Z" },
    { d: "M62 60C52 44 50 28 58 20C64 14 74 18 72 26", line: 8 },
    { d: "M70 20L84 26L72 30Z" },
  ],
  bird: [
    { d: "M50 34L88 20L66 46L78 50L58 56L66 86L52 66L50 70L48 66L34 86L42 56L22 50L34 46L12 20Z" },
    { d: circle(50, 32, 8) },
  ],
  raven: [
    { d: "M18 62C20 44 44 36 62 42L70 50C62 66 38 74 18 62Z" },
    { d: circle(70, 38, 12) },
    { d: "M78 32L96 42L78 46Z" },
    { d: "M24 62L6 76L12 82L32 70Z" },
    { d: "M42 70L40 88M54 70L56 88", line: 4 },
    { d: circle(73, 35, 2.5), role: "cut" },
  ],
  owl: [
    { d: "M24 40Q24 88 50 90Q76 88 76 40L82 14L64 28Q50 24 36 28L18 14Z" },
    { d: circle(39, 46, 10), role: "cut" },
    { d: circle(61, 46, 10), role: "cut" },
    { d: circle(39, 46, 4.5) },
    { d: circle(61, 46, 4.5) },
    { d: "M45 58H55L50 67Z", role: "cut" },
  ],
  cockerel: [
    { d: ellipse(52, 62, 22, 17) },
    { d: "M56 52L62 28Q64 18 72 18Q82 20 80 30L74 50Z" },
    { d: "M64 19L66 8L71 15L75 6L78 15L83 11L80 22Z" },
    { d: "M80 24L92 28L80 32Z" },
    { d: "M40 60C22 52 12 32 22 10C28 28 36 40 48 50Z" },
    { d: "M36 66C18 64 6 50 6 34C16 48 28 56 42 58Z" },
    { d: "M46 76L44 92M58 76L60 92", line: 5 },
    { d: circle(73, 26, 2.5), role: "cut" },
  ],
  fox: [
    { d: "M50 88L30 60L22 14L42 36Q50 33 58 36L78 14L70 60Z" },
    { d: "M50 88L38 66Q50 72 62 66Z", role: "cut" },
    { d: "M36 48L46 50L40 54Z", role: "cut" },
    { d: "M64 48L54 50L60 54Z", role: "cut" },
  ],
  wolf: [
    { d: "M50 90L36 76L18 70L24 52L18 10L40 30Q50 27 60 30L82 10L76 52L82 70L64 76Z" },
    { d: "M34 46L46 50L36 54Z", role: "cut" },
    { d: "M66 46L54 50L64 54Z", role: "cut" },
    { d: "M44 74H56L50 82Z", role: "cut" },
  ],
  bee: [
    { d: ellipse(30, 42, 17, 10), role: "pale", transform: "rotate(-25 30 42)" },
    { d: ellipse(70, 42, 17, 10), role: "pale", transform: "rotate(25 70 42)" },
    { d: ellipse(50, 60, 16, 26) },
    { d: circle(50, 28, 11) },
    { d: "M44 84L50 96L56 84Z" },
    { d: "M34 52H66V58H34ZM34 66H66V72H34Z", role: "cut" },
    { d: "M45 20L38 8M55 20L62 8", line: 3.5 },
  ],
  ram: [
    { d: "M40 28H60L64 70Q50 88 36 70Z" },
    { d: "M42 34C26 20 8 34 14 50C20 64 36 58 32 46", line: 8 },
    { d: "M58 34C74 20 92 34 86 50C80 64 64 58 68 46", line: 8 },
    { d: circle(44, 46, 3), role: "cut" },
    { d: circle(56, 46, 3), role: "cut" },
  ],
  tree: [
    { d: circle(50, 30, 22) },
    { d: circle(30, 46, 17) },
    { d: circle(70, 46, 17) },
    { d: circle(50, 50, 16) },
    { d: "M44 56H56L60 86H40Z" },
    { d: "M30 88H70V92H30Z" },
  ],
  tower: [
    { d: "M36 88V44L50 6L64 44V88Z" },
    { d: "M28 82H72V92H28Z" },
    { d: "M46 52Q50 44 54 52V66H46Z", role: "cut" },
    { d: "M47 26H53V36H47Z", role: "cut" },
  ],
  ship: [
    { d: "M10 62H90L76 84H24Z" },
    { d: "M50 62V10", line: 4 },
    { d: "M54 14V56H84Z" },
    { d: "M46 22V56H20Z" },
    { d: "M50 8L64 12L50 16Z" },
  ],
  anchor: [
    { d: circle(50, 16, 8), line: 6 },
    { d: "M50 24V86", line: 9 },
    { d: "M32 34H68", line: 8 },
    { d: "M16 56C18 80 38 88 50 88C62 88 82 80 84 56", line: 8 },
    { d: "M6 62L16 46L26 62Z" },
    { d: "M74 62L84 46L94 62Z" },
  ],
  fish: [
    { d: "M8 50C26 24 64 24 78 50C64 76 26 76 8 50Z" },
    { d: "M74 50L94 30L90 50L94 70Z" },
    { d: circle(26, 46, 4.5), role: "cut" },
    { d: "M40 36Q46 50 40 64", role: "cut", line: 3 },
  ],
  crown: [
    { d: "M16 74L10 32L32 52L50 22L68 52L90 32L84 74Z" },
    { d: "M14 76H86V88H14Z" },
    { d: circle(10, 28, 6) },
    { d: circle(50, 18, 6) },
    { d: circle(90, 28, 6) },
    { d: circle(50, 62, 5), role: "cut" },
  ],
  cross: [
    { d: "M42 8H58V36H88V54H58V92H42V54H12V36H42Z" },
  ],
  halo: [
    { d: ellipse(50, 20, 22, 7), line: 6 },
    { d: circle(50, 46, 14) },
    { d: "M20 92Q22 64 50 64Q78 64 80 92Z" },
  ],
  rose: [
    { d: circle(50, 30, 16) },
    { d: circle(69, 44, 16) },
    { d: circle(62, 67, 16) },
    { d: circle(38, 67, 16) },
    { d: circle(31, 44, 16) },
    { d: circle(50, 51, 13), role: "cut" },
    { d: circle(50, 51, 6) },
  ],
  lily: [
    { d: "M50 6C64 22 64 44 55 60H45C36 44 36 22 50 6Z" },
    { d: "M44 58C26 60 10 48 12 32C14 22 26 20 30 30C22 34 24 46 42 50Z" },
    { d: "M56 58C74 60 90 48 88 32C86 22 74 20 70 30C78 34 76 46 58 50Z" },
    { d: "M28 58H72V68H28Z" },
    { d: "M45 68L40 90L50 82L60 90L55 68Z" },
  ],
  tulip: [
    { d: "M28 26L40 40L50 20L60 40L72 26Q76 66 50 68Q24 66 28 26Z" },
    { d: "M50 68V94", line: 6 },
    { d: "M50 88Q30 84 26 62Q44 66 50 82Z" },
  ],
  hammers: [...turned(HAMMER, -35), ...turned(HAMMER, 35)],
  cannon: [
    { d: "M12 58L80 32L86 46L18 72Z" },
    { d: "M78 28L90 24L96 44L84 48Z" },
    { d: circle(42, 68, 18) },
    { d: circle(42, 68, 10), role: "cut" },
    { d: circle(42, 68, 4) },
    { d: circle(76, 84, 6) },
    { d: circle(89, 84, 6) },
  ],
  swords: [...turned(SWORD, -38), ...turned(SWORD, 38)],
  pickaxe: turned(PICK, 30),
  dog: [
    { d: "M32 30Q50 20 68 30L72 66Q50 88 28 66Z" },
    { d: "M34 28L14 32L18 64L30 56Z" },
    { d: "M66 28L86 32L82 64L70 56Z" },
    { d: ellipse(50, 68, 13, 10), role: "cut" },
    { d: ellipse(50, 63, 6, 4) },
    { d: circle(41, 46, 3.5), role: "cut" },
    { d: circle(59, 46, 3.5), role: "cut" },
  ],
  stag: [
    { d: "M41 44H59L57 76Q50 88 43 76Z" },
    { d: "M42 46L26 40L38 56Z" },
    { d: "M58 46L74 40L62 56Z" },
    { d: "M44 44L30 10M36 28L20 22M33 20L42 8", line: 5 },
    { d: "M56 44L70 10M64 28L80 22M67 20L58 8", line: 5 },
    { d: circle(46, 56, 2.5), role: "cut" },
    { d: circle(54, 56, 2.5), role: "cut" },
  ],
  bull: [
    { d: "M30 32H70L66 70Q50 88 34 70Z" },
    { d: "M32 36C16 34 8 22 12 8C18 20 28 24 40 26Z" },
    { d: "M68 36C84 34 92 22 88 8C82 20 72 24 60 26Z" },
    { d: "M30 38L16 46L32 50Z" },
    { d: "M70 38L84 46L68 50Z" },
    { d: circle(41, 48, 3.5), role: "cut" },
    { d: circle(59, 48, 3.5), role: "cut" },
    { d: circle(44, 70, 3), role: "cut" },
    { d: circle(56, 70, 3), role: "cut" },
  ],
  tiger: [
    { d: circle(27, 30, 10) },
    { d: circle(73, 30, 10) },
    { d: circle(50, 56, 30) },
    { d: "M44 28L47 42L50 28ZM52 28L53 40L56 30Z", role: "cut" },
    { d: "M20 52L34 56L20 60ZM80 52L66 56L80 60Z", role: "cut" },
    { d: "M36 48L46 50L38 54Z", role: "cut" },
    { d: "M64 48L54 50L62 54Z", role: "cut" },
    { d: "M44 64H56L50 70Z", role: "cut" },
  ],
  cat: [
    { d: "M30 90Q22 60 38 46L34 18L46 30Q50 28 54 30L66 18L62 46Q78 60 70 90Z" },
    { d: "M70 86Q92 86 86 60", line: 7 },
    { d: "M40 38L47 40L41 43Z", role: "cut" },
    { d: "M60 38L53 40L59 43Z", role: "cut" },
  ],
  trident: [
    { d: "M50 40V94", line: 7 },
    { d: "M28 18V40Q50 54 72 40V18", line: 7 },
    { d: "M50 14V48", line: 7 },
    { d: "M20 22L28 6L36 22Z" },
    { d: "M42 16L50 0L58 16Z" },
    { d: "M64 22L72 6L80 22Z" },
  ],
  star: [{ d: STAR_PATH }],
  snake: [
    { d: "M70 20C30 16 28 46 50 50C72 54 74 84 28 84", line: 11 },
    { d: circle(74, 20, 10) },
    { d: "M84 20L94 16M84 20L94 24", line: 2.5 },
    { d: circle(76, 17, 2.5), role: "cut" },
  ],
  train: [
    { d: "M18 42H64V66H18Z" },
    { d: "M60 26H86V66H60Z" },
    { d: "M24 24H36L34 42H26Z" },
    { d: "M8 66L18 52V66Z" },
    { d: circle(30, 72, 9) },
    { d: circle(52, 72, 9) },
    { d: circle(74, 72, 9) },
    { d: "M66 32H80V44H66Z", role: "cut" },
  ],
  hat: [
    { d: "M30 16H70L67 70H33Z" },
    { d: "M10 70Q50 62 90 70V80Q50 72 10 80Z" },
    { d: "M32 56H68V64H32Z", role: "cut" },
  ],
  chair: [
    { d: "M26 6H36V92H26Z" },
    { d: "M26 50H76V60H26Z" },
    { d: "M66 60H76V92H66Z" },
    { d: "M36 14H48V22H36ZM36 30H48V38H36Z" },
  ],
  cherry: [
    { d: "M34 56Q40 28 56 12M66 58Q60 32 56 12", line: 4 },
    { d: "M56 12Q76 2 88 16Q72 24 56 12Z" },
    { d: circle(32, 70, 17) },
    { d: circle(68, 72, 17) },
    { d: circle(26, 64, 4), role: "cut" },
    { d: circle(62, 66, 4), role: "cut" },
  ],
  shamrock: [
    { d: circle(50, 28, 16) },
    { d: circle(30, 52, 16) },
    { d: circle(70, 52, 16) },
    { d: circle(50, 46, 12) },
    { d: "M50 58Q52 80 62 94", line: 6 },
  ],
};

export const SYMBOL_IDS = Object.keys(SYMBOL_ART) as SymbolId[];

/**
 * THE RULE TABLE — a word in the club's data, and the symbol it means.
 * Checked against each nickname in the order they're given (the first one
 * that matches wins), so "The Villans; The Lions" is a lion and "The Royals;
 * Stronghold of Lions" is a crown. Foreign nicknames carry their English
 * meaning in brackets in the data, so "Aslanlar (The Lions)" is a lion too.
 * Words that could mean several things are left out on purpose.
 */
export const SYMBOL_WORDS: { re: RegExp; symbol: SymbolId }[] = [
  { re: /\blions?\b|\bleões\b|\bløverne\b/, symbol: "lion" },
  { re: /\beagles?\b|\badler\b|\báguias\b|\baquil/, symbol: "eagle" },
  { re: /\bmagpies?\b/, symbol: "magpie" },
  { re: /\bcanar(y|ies)\b|\blinnets?\b/, symbol: "canary" },
  { re: /\brobins?\b/, symbol: "robin" },
  { re: /\bseagulls?\b|\bgulls?\b/, symbol: "seagull" },
  { re: /\bswans?\b/, symbol: "swan" },
  { re: /\bbluebirds?\b|\bthrostles?\b/, symbol: "bird" },
  { re: /\bravens?\b|\brooks?\b/, symbol: "raven" },
  { re: /\bowls?\b/, symbol: "owl" },
  { re: /\bbantams?\b|\bcockerels?\b|\broosters?\b/, symbol: "cockerel" },
  { re: /\bfox(es)?\b/, symbol: "fox" },
  { re: /\bwol(f|ves)\b|\blupi\b/, symbol: "wolf" },
  { re: /\bbees?\b|\bhornets?\b/, symbol: "bee" },
  { re: /\brams?\b/, symbol: "ram" },
  { re: /\btrees?\b|^forest$/, symbol: "tree" },
  { re: /\bspire|\bminster/, symbol: "tower" },
  { re: /\bpilgrims?\b|\bpirates?\b|\bsubmarin/, symbol: "ship" },
  { re: /\bmariners?\b|\bseasiders?\b|\bseadogs?\b/, symbol: "anchor" },
  { re: /\bfisherm[ae]n\b|\bcods?\b|\bshrimp|\bmackerel\b/, symbol: "fish" },
  { re: /\broyals?\b|\bposh\b/, symbol: "crown" },
  { re: /\barchbishops?\b|\bcardinals?\b/, symbol: "cross" },
  { re: /\bsaints?\b|\bangels?\b/, symbol: "halo" },
  { re: /\btudors?\b|\broses?\b/, symbol: "rose" },
  { re: /\blil+ywhites?\b/, symbol: "lily" },
  { re: /\btulips?\b/, symbol: "tulip" },
  { re: /\bhammers\b|\birons?\b/, symbol: "hammers" },
  { re: /\bgunners\b|\bgenerals\b/, symbol: "cannon" },
  { re: /\bblades\b|\blegionaries\b|\bwarriors\b|\bconquerors\b/, symbol: "swords" },
  { re: /\bminers\b|\bpitmen\b|\btinners\b/, symbol: "pickaxe" },
  { re: /\bterriers?\b|\bmastiffs?\b/, symbol: "dog" },
  { re: /\bstags?\b|\bbucks\b/, symbol: "stag" },
  { re: /\bbulls?\b/, symbol: "bull" },
  { re: /\btigers?\b/, symbol: "tiger" },
  { re: /\bcats?\b/, symbol: "cat" },
  { re: /\bdevils?\b|\bdiavolo\b/, symbol: "trident" },
  { re: /\bstar of\b/, symbol: "star" },
  { re: /\bsnake\b/, symbol: "snake" },
  { re: /\brailway(man|men)\b|\blocomotive\b/, symbol: "train" },
  { re: /\bhatters\b/, symbol: "hat" },
  { re: /\bchairboys\b/, symbol: "chair" },
  { re: /\bcherr(y|ies)\b/, symbol: "cherry" },
  { re: /\bcelts\b/, symbol: "shamrock" },
];

/** Words in the club's own name (used only when no nickname matched). */
export const NAME_WORDS: { re: RegExp; symbol: SymbolId }[] = [
  { re: /\bforest\b/, symbol: "tree" },
  { re: /\bwolverhampton\b/, symbol: "wolf" },
  { re: /\bshamrock\b/, symbol: "shamrock" },
];

/**
 * Hand fixes for the odd club the rules get wrong. null = no symbol, even
 * though a word matched. Keep this short: the rules above do the work.
 */
export const SYMBOL_OVERRIDES: Record<string, { symbol: SymbolId | null; why: string }> = {
  // "Iron Sparta" is a saying about the team, not a trade like West Ham's or Scunthorpe's.
  "Sparta Praha": { symbol: null, why: "\"Iron Sparta\" means tough, not ironworks" },
};

export interface SymbolPick { symbol: SymbolId; why: string }

/** The symbol a club's data supports, and why — or null (keeps the ball/star). */
export function symbolFor(club: string): SymbolPick | null {
  const o = SYMBOL_OVERRIDES[club];
  if (o) return o.symbol ? { symbol: o.symbol, why: `set by hand: ${o.why}` } : null;
  const nick = profileOf(club)?.nickname;
  if (nick) {
    for (const part of nick.split(";").map((s) => s.trim()).filter(Boolean)) {
      const lower = part.toLowerCase();
      for (const w of SYMBOL_WORDS) if (w.re.test(lower)) return { symbol: w.symbol, why: `nickname: ${part}` };
    }
  }
  const name = club.toLowerCase();
  for (const w of NAME_WORDS) if (w.re.test(name)) return { symbol: w.symbol, why: `club name: ${club}` };
  return null;
}

/**
 * The symbol as SVG, centred on (cx, cy) and `size` units across, in `ink`,
 * with an outline in `halo` so it reads on any stripe or colour behind it.
 */
export function symbolSvg(id: SymbolId, cx: number, cy: number, size: number, ink: string, halo: string): string {
  const pieces = SYMBOL_ART[id];
  const s = size / 100;
  const HALO = 11; // outline width in the drawing's own units
  const attrs = (p: Piece) => (p.transform ? ` transform="${p.transform}"` : "");
  const outline = pieces.filter((p) => (p.role ?? "ink") !== "cut").map((p) =>
    `<path d="${p.d}"${attrs(p)} fill="${p.line ? "none" : halo}" stroke="${halo}" stroke-width="${(p.line ?? 0) + HALO}" stroke-linejoin="round" stroke-linecap="round"/>`,
  ).join("");
  const body = pieces.map((p) => {
    const colour = p.role === "cut" ? halo : p.role === "red" ? "#D71920" : ink;
    if (p.role === "pale") return `<path d="${p.d}"${attrs(p)} fill="${halo}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
    return p.line
      ? `<path d="${p.d}"${attrs(p)} fill="none" stroke="${colour}" stroke-width="${p.line}" stroke-linejoin="round" stroke-linecap="round"/>`
      : `<path d="${p.d}"${attrs(p)} fill="${colour}"/>`;
  }).join("");
  return `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-50 -50)">${outline}${body}</g>`;
}
