/**
 * THE BARBER AND YOUR HAIR (Harry, 19 Nov 2026, RUL-UI-013: "ur hair and potentially facial hair grows
 * over a szn naturally and then when in ur bathroom u can style it and u can also go to a barbers").
 * Plan: docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md section 2 (B1 to B3, with the plan's suggested answers
 * to its three questions as the defaults).
 *
 * Pure: no React, no three.js. Test: tests/star/barber.mts.
 *
 *  - Your hair and your beard GROW by the season's own week counter (no timer runs while you are away):
 *    the beard a step about every 2 weeks (0 clean, 1 stubble, 2 heavy stubble, 3 beard), the hair a
 *    step about every 6 weeks (the style grows into the next-longer style of the same hair type:
 *    `GROWS_INTO`). After 3 steps it stops.
 *  - The barber (on the shopping street): any style that suits YOUR hair type (RUL-3D-010: locs, afro,
 *    twists, braids, high-top, waves and cornrows only on coily hair; slick back, tied back, man bun and
 *    mullet only on straight or wavy). Priced off your weekly wage, like the energy cans: a cut about 2%
 *    of a week's wage, a big change (locs, twists, braids, cornrows put in) about 5%. 45 clock minutes,
 *    a big change 90.
 *  - The mirror at home (free, 10 clock minutes): only shorter or tidier, never a new style.
 *  - What a cut does, small and capped (the plan's answer B3): mood +1, once per gap between matches;
 *    fans +1 when the next match is a big one (a final, a semi-final, a derby), at most once a month.
 *    Nothing on the pitch. Left 10 weeks or more: `untidy` (a line in a story some day, never a penalty).
 *
 * THE SAVE: `career.hair`, one short string (about 15 bytes):
 *     "<style>.<hair type>.<beard at last shave>.<week of last cut>.<week of last shave>"
 *   and, only once a cut has given its small effects, ".g<gap>" (the gap its mood was given in) and
 *   ".f<week>" (the week its fans point was given), e.g. "afro.k.0.161.161" or "crew.s.1.161.163.g3004".
 * An old save has none of it: it reads as your own haircut and the beard your head is modelled with,
 * exactly how it looked before, with no growth until the field is written (`withHairStarted`, the
 * first time the career loads with this code).
 */
import type { CareerState } from "./types";
import type { ToonHead } from "./style3d/toon/bodies";
import { TOON_HAIR_BASE, type HairTexture, type ToonHair } from "./style3d/toon/hairStyles";
import { WAGE_FLOOR } from "./economy";
import { formatMoney, MONEY_SIGN } from "./money";
import { gapKey, nextMatchInfo } from "./life/clock";
import { applyThing } from "./life/houseActs";

// ── The dials (one line each) ─────────────────────────────────────────────

/** Weeks for the beard to grow a step, and the hair. */
export const BEARD_WEEKS = 2;
export const HAIR_WEEKS = 6;
/** The most steps either grows from its last cut or shave. */
export const MAX_GROWTH = 3;
/** A cut's price, as a share of a week's wage; a big change. */
export const CUT_WAGE_SHARE = 0.02;
export const BIG_WAGE_SHARE = 0.05;
/** Clock minutes. */
export const CUT_MINS = 45;
export const BIG_MINS = 90;
export const MIRROR_MINS = 10;
/** Fans +1 for a fresh cut before a big match: at most once in this many weeks (a month). */
export const FANS_EVERY_WEEKS = 4;
/** Weeks without a cut before someone notices (a line, never a penalty). */
export const UNTIDY_WEEKS = 10;
/** Weeks in a season, for one week counter across seasons (a season's week counter starts again at 1). */
export const SEASON_WEEKS = 52;

// ── The styles ────────────────────────────────────────────────────────────

/**
 * A style you can wear. `mesh`: one of the modelled hairstyles (style3d/toon/hairStyles.ts), worn on the
 * close-cut skull. `own`: your own head's haircut (Settings → Your look), as you have always looked.
 * The rest are cuts on the close-cut skull itself: the buzz as modelled, a skin fade, a shaved head,
 * waves or cornrows (painted on the scalp, people3d.ts hairCut).
 */
export type HairStyleId = "own" | "buzz" | "fade" | "bald" | "waves" | "cornrows"
  | "crew" | "slickBack" | "ponytail" | "manBun" | "mullet" | "curlyTop"
  | "afro" | "highTop" | "twists" | "locsShort" | "locsLong" | "locsBun" | "braids";

export interface StyleInfo {
  label: string;
  /** The hair types it is worn in (RUL-3D-010). */
  textures: readonly HairTexture[];
  /** A big change: costs more and takes longer (locs, twists, braids, cornrows put in). */
  big?: boolean;
  /** The modelled hairstyle it is (none: a cut on the skull, or your own). */
  mesh?: ToonHair;
  /** The scalp: 0 as modelled (the buzz), 0.7 a skin fade, 1 shaved; pattern 1 waves, 2 cornrows. */
  scalp?: number;
  pattern?: number;
  /** One short line for the list. */
  line: string;
}

const ALL: readonly HairTexture[] = ["straight", "wavy", "curly", "coily"];
export const STYLES: Record<HairStyleId, StyleInfo> = {
  own: { label: "Your usual", textures: ALL, line: "The cut you came in with" },
  buzz: { label: "Buzz cut", textures: ALL, line: "Clippers all over" },
  fade: { label: "Skin fade", textures: ALL, scalp: 0.7, line: "Down to the skin" },
  bald: { label: "Shaved head", textures: ALL, scalp: 1, line: "All of it off" },
  waves: { label: "Waves", textures: ["coily"], pattern: 1, line: "360 waves, brushed in" },
  cornrows: { label: "Cornrows", textures: ["coily"], pattern: 2, big: true, line: "Braided back, tight" },
  crew: { label: "Crew cut", textures: ["straight", "wavy", "curly"], mesh: "crew", line: "Short on top, neat" },
  slickBack: { label: "Slick back", textures: ["straight", "wavy"], mesh: "slickBack", line: "Combed back, a bit of shine" },
  ponytail: { label: "Tied back", textures: ["straight", "wavy"], mesh: "ponytail", line: "Long, tied at the back" },
  manBun: { label: "Man bun", textures: ["straight", "wavy"], mesh: "manBun", line: "Up in a knot" },
  mullet: { label: "Mullet", textures: ["straight", "wavy"], mesh: "mullet", line: "Short front, long back" },
  curlyTop: { label: "Curly top", textures: ["curly", "coily"], mesh: "curlyTop", line: "Curls on top, short sides" },
  afro: { label: "Short afro", textures: ["coily"], mesh: "afro", line: "Shaped and rounded" },
  highTop: { label: "High-top", textures: ["coily"], mesh: "highTop", line: "Tall and flat on top" },
  twists: { label: "Twists", textures: ["coily"], mesh: "twists", big: true, line: "Two-strand twists" },
  locsShort: { label: "Short locs", textures: ["coily"], mesh: "locsShort", big: true, line: "Locs started" },
  locsLong: { label: "Shoulder locs", textures: ["coily"], mesh: "locsLong", big: true, line: "Locs to the shoulder" },
  locsBun: { label: "Locs tied up", textures: ["coily"], mesh: "locsBun", big: true, line: "Locs up on top" },
  braids: { label: "Braids", textures: ["coily"], mesh: "braids", big: true, line: "Box braids" },
};
export const STYLE_IDS = Object.keys(STYLES) as HairStyleId[];

/**
 * What a style grows into after HAIR_WEEKS, by hair type (the next-longer modelled style of the same
 * texture; the plan's B4: "swapping to the next-longer style of the same hair type"). Absent: it stays.
 */
export function growsInto(s: HairStyleId, t: HairTexture): HairStyleId | null {
  const coily = t === "coily", straightish = t === "straight" || t === "wavy";
  switch (s) {
    case "bald": return "fade";
    case "fade": return "buzz";
    case "buzz": return coily ? "afro" : t === "curly" ? "curlyTop" : "crew";
    case "waves": return "afro";
    case "crew": return straightish ? "slickBack" : "curlyTop";
    case "slickBack": return "ponytail";
    case "highTop": return "afro";
    case "twists": return "locsShort";
    case "locsShort": return "locsLong";
    default: return null;
  }
}

/** Does this style suit this hair type (RUL-3D-010)? */
export const styleSuits = (s: HairStyleId, t: HairTexture) => STYLES[s].textures.includes(t);
/** The barber's list for your hair type, in the list's order. */
export function stylesFor(t: HairTexture): HairStyleId[] {
  return STYLE_IDS.filter((s) => styleSuits(s, t));
}

export const TEXTURES: readonly HairTexture[] = ["straight", "wavy", "curly", "coily"];
export const TEXTURE_LABEL: Record<HairTexture, string> = { straight: "Straight", wavy: "Wavy", curly: "Curly", coily: "Coily" };
const TEX_CODE: Record<HairTexture, string> = { straight: "s", wavy: "w", curly: "c", coily: "k" };
const CODE_TEX: Record<string, HairTexture> = { s: "straight", w: "wavy", c: "curly", k: "coily" };

export const BEARD_LABEL = ["Clean shaven", "Stubble", "Heavy stubble", "Beard"] as const;
export const HAIR_STEP_LABEL = ["Fresh", "Growing", "Grown out", "Overgrown"] as const;

// ── The head your style is worn on ────────────────────────────────────────

/** Heads with a beard modelled in (people/presets.ts HEAD_BEARD, the kit heads). */
export const BEARD_HEADS: readonly ToonHead[] = ["h3", "h6", "h7", "h8", "h9"];
/**
 * The close-cut skull a style other than your own is worn on: the modelled hair fits only the Buzz &
 * beard skull and its re-shaped heads (hairStyles.ts TOON_HAIR_BASE). Your own head when it is one of
 * them; else the re-shaped head nearest your own face's shape (Curls and Bun the round face, Quiff the
 * long face, Fringe the broad jaw, Crop & beard the buzz head).
 */
export function closeCutHeadFor(head: ToonHead): ToonHead {
  if (TOON_HAIR_BASE[head] === "h3") return head;
  const near: Partial<Record<ToonHead, ToonHead>> = { h1: "h9", h4: "h9", h2: "h8", h5: "h7", h6: "h3" };
  return near[head] ?? "h3";
}

/** Your hair type when nothing is saved: from your skin (and the Curls head is curly); you can change it in the chair. */
export function defaultTexture(p: { skinTone?: string; head3d?: string }, head: ToonHead): HairTexture {
  const dark = ["brown", "deep", "dark"].includes(String(p.skinTone));
  const mid = ["tan", "olive"].includes(String(p.skinTone));
  return dark ? "coily" : head === "h1" ? "curly" : mid ? "wavy" : "straight";
}

// ── The save ──────────────────────────────────────────────────────────────

export interface HairState {
  style: HairStyleId;
  texture: HairTexture;
  /** The beard step right after the last shave or trim (0..3). */
  beard0: number;
  /** Week of the last cut and of the last shave (absWeek); null = no growth yet (an old save, not started). */
  cutWeek: number | null;
  shaveWeek: number | null;
  /** The gap a cut last gave its mood in, the week a cut last gave its fans point. */
  moodGap?: number;
  fansWeek?: number;
}

/** One week counter across seasons. */
export function absWeek(c: Pick<CareerState, "season" | "week">): number {
  return Math.max(0, ((c.season ?? 1) - 1) * SEASON_WEEKS + (c.week ?? 1));
}

/** The beard your head is modelled with (an old save's beard). */
const headBeard = (head: ToonHead) => (BEARD_HEADS.includes(head) ? 3 : 0);

/** Read the save (absent or broken: your own look, as before, not growing). */
export function hairState(c: Pick<CareerState, "hair" | "player">, head: ToonHead): HairState {
  const fallback: HairState = { style: "own", texture: defaultTexture(c.player ?? {}, head), beard0: headBeard(head), cutWeek: null, shaveWeek: null };
  const s = c.hair;
  if (typeof s !== "string" || !s) return fallback;
  const [style, t, b, cw, sw, ...rest] = s.split(".");
  if (!(style in STYLES) || !CODE_TEX[t]) return fallback;
  const num = (x: string | undefined) => (x !== undefined && x !== "" && Number.isFinite(Number(x)) ? Math.round(Number(x)) : null);
  const out: HairState = {
    style: style as HairStyleId, texture: CODE_TEX[t],
    beard0: Math.max(0, Math.min(3, num(b) ?? 0)),
    cutWeek: num(cw), shaveWeek: num(sw),
  };
  // a style the save names that does not suit its hair type (hand-edited): your own
  if (!styleSuits(out.style, out.texture)) out.style = "own";
  for (const r of rest) {
    if (r[0] === "g" && num(r.slice(1)) !== null) out.moodGap = num(r.slice(1))!;
    if (r[0] === "f" && num(r.slice(1)) !== null) out.fansWeek = num(r.slice(1))!;
  }
  return out;
}

/** Write the save (the short string). */
export function packHair(h: HairState): string {
  let s = `${h.style}.${TEX_CODE[h.texture]}.${h.beard0}.${h.cutWeek ?? ""}.${h.shaveWeek ?? ""}`;
  if (h.moodGap !== undefined) s += `.g${h.moodGap}`;
  if (h.fansWeek !== undefined) s += `.f${h.fansWeek}`;
  return s;
}

/**
 * Start the growth on a career that has no hair saved (an old save, or a new career): your look as it
 * is now, growing from this week. Same object back when there is something saved already.
 */
export function withHairStarted<C extends CareerState>(c: C, head: ToonHead): C {
  if (typeof c.hair === "string" && c.hair) return c;
  const h = hairState(c, head);
  const w = absWeek(c);
  return { ...c, hair: packHair({ ...h, cutWeek: w, shaveWeek: w }) };
}

// ── What you look like now ────────────────────────────────────────────────

export interface HairNow {
  /** The style shown now (after growing). */
  style: HairStyleId;
  /** The style you had cut (or grew from). */
  cut: HairStyleId;
  texture: HairTexture;
  /** Hair steps grown since the cut (0..3), and the beard step now (0..3). */
  hairStep: number;
  beard: number;
  /** Weeks since the last cut (0 when not growing). */
  weeks: number;
  /** Ten weeks or more since a cut. */
  untidy: boolean;
}

/** How a style looks after `steps` steps of growth. */
export function grown(style: HairStyleId, t: HairTexture, steps: number): HairStyleId {
  let s = style;
  for (let i = 0; i < steps; i++) { const n = growsInto(s, t); if (!n) break; s = n; }
  return s;
}

/** Your hair and beard this week. */
export function hairNow(c: Pick<CareerState, "hair" | "player" | "season" | "week">, head: ToonHead): HairNow {
  const h = hairState(c, head);
  const w = absWeek(c);
  const weeks = h.cutWeek === null ? 0 : Math.max(0, w - h.cutWeek);
  const bw = h.shaveWeek === null ? 0 : Math.max(0, w - h.shaveWeek);
  const hairStep = Math.min(MAX_GROWTH, Math.floor(weeks / HAIR_WEEKS));
  const beard = Math.min(3, h.beard0 + Math.min(MAX_GROWTH, Math.floor(bw / BEARD_WEEKS)));
  return { style: grown(h.style, h.texture, hairStep), cut: h.style, texture: h.texture, hairStep, beard, weeks, untidy: weeks >= UNTIDY_WEEKS };
}

/**
 * What the 3D draws for this look (pure, read by style3d/toon/bodies.ts setToonYou and people3d.ts):
 * the head file, the modelled hairstyle (or none) and the haircut on the scalp and the beard.
 */
export interface HairLook3d {
  head: ToonHead;
  mesh?: ToonHair;
  cut: { scalp: number; beard: number; stubble: number; pattern: number };
}
export function hairLook3d(style: HairStyleId, beard: number, yourHead: ToonHead): HairLook3d {
  const info = STYLES[style];
  const head = style === "own" ? yourHead : closeCutHeadFor(yourHead);
  const modelled = BEARD_HEADS.includes(head);
  // the beard steps: the modelled beard is the top step; under it the beard is painted out and stubble painted on
  const b = Math.max(0, Math.min(3, Math.round(beard)));
  let beardOff = 1, stubble = 0;
  if (modelled) { if (b >= 3) beardOff = 0; else stubble = [0, 0.55, 0.95][b]; }
  else { beardOff = 0; stubble = [0, 0.5, 0.85, 1][b]; }
  return { head, mesh: info.mesh, cut: { scalp: info.scalp ?? 0, beard: beardOff, stubble, pattern: info.pattern ?? 0 } };
}

/** The 3D look for a career this week. */
export function yourHairLook3d(c: Pick<CareerState, "hair" | "player" | "season" | "week">, yourHead: ToonHead): HairLook3d {
  const n = hairNow(c, yourHead);
  return hairLook3d(n.style, n.beard, yourHead);
}

/** A key that changes only when the look changes (the page re-sets your 3D player on it). */
export function hairLookKey(l: HairLook3d): string {
  return `${l.head}|${l.mesh ?? ""}|${l.cut.scalp}|${l.cut.beard}|${l.cut.stubble}|${l.cut.pattern}`;
}

// ── The barber ────────────────────────────────────────────────────────────

/** The price of a style at the barber (your weekly wage, the energy cans' way: shopData.ts kibCanPrice). */
export function cutPrice(style: HairStyleId, weeklyWage: number): number {
  const wage = Math.max(WAGE_FLOOR, weeklyWage || 0);
  return Math.max(1, Math.round(wage * (STYLES[style].big ? BIG_WAGE_SHARE : CUT_WAGE_SHARE)));
}
export const priceText = (n: number) => `${MONEY_SIGN}${formatMoney(n)}`;
export const cutMins = (style: HairStyleId) => (STYLES[style].big ? BIG_MINS : CUT_MINS);

/** Is the next match a big one (a final, a semi-final, a derby)? */
export function bigMatchNext(c: CareerState): boolean {
  const f = nextMatchInfo(c)?.f;
  if (!f) return false;
  return !!f.derby || /final/i.test(f.round ?? "");
}

export interface CutResult {
  ok: boolean;
  career: CareerState;
  /** What happened, in one line ("Short afro. Mood +1"), or why not. */
  text: string;
  price: number;
  mood: number;
  fans: number;
}

/**
 * Sit in the barber's chair: the style (and the beard he leaves you with: 0..3, or "keep" for as it is),
 * paid from your money, the clock moved on, and the cut's small effects within their caps.
 */
export function barberCut(c: CareerState, style: HairStyleId, beard: number | "keep", yourHead: ToonHead, texture?: HairTexture): CutResult {
  const h = hairState(c, yourHead);
  const t = texture ?? h.texture;
  const price = cutPrice(style, c.contract?.wage ?? 0);
  if (!styleSuits(style, t)) return { ok: false, career: c, text: `${STYLES[style].label} is not one for your hair.`, price, mood: 0, fans: 0 };
  if ((c.money ?? 0) < price) return { ok: false, career: c, text: `Not enough money: ${priceText(price)}.`, price, mood: 0, fans: 0 };
  const w = absWeek(c);
  const now = hairNow(c, yourHead);
  const newBeard = beard === "keep" ? now.beard : Math.max(0, Math.min(3, Math.round(beard)));
  // mood +1 once per gap between matches (and within the house's day cap: life/houseActs.ts)
  const gap = gapKey(c);
  const moodWanted = h.moodGap === gap ? 0 : 1;
  const big = !!STYLES[style].big;
  const act = applyThing({ ...c, money: (c.money ?? 0) - price }, big ? "barberBig" : "barber", { mood: moodWanted, text: STYLES[style].label + "." });
  let next = act.career;
  // fans +1 before a big match, at most once a month
  let fans = 0;
  if (bigMatchNext(c) && (h.fansWeek === undefined || w - h.fansWeek >= FANS_EVERY_WEEKS)) {
    fans = 1;
    next = { ...next, relationships: { ...next.relationships, fans: Math.min(100, (next.relationships?.fans ?? 0) + 1) } };
  }
  const saved: HairState = {
    style, texture: t, beard0: newBeard, cutWeek: w, shaveWeek: beard === "keep" ? (h.shaveWeek ?? w) : w,
    moodGap: act.mood > 0 ? gap : h.moodGap, fansWeek: fans ? w : h.fansWeek,
  };
  // "keep" the beard: it carries on growing from where it was (its own shave week and step)
  if (beard === "keep") saved.beard0 = h.beard0;
  next = { ...next, hair: packHair(saved) };
  const words = [act.text.replace(/\s*$/, ""), fans ? "Fans +1" : ""].filter(Boolean).join(" · ");
  return { ok: true, career: next, text: words, price, mood: act.mood, fans };
}

// ── The mirror at home (B5: built here, the rules; free, shorter or tidier only) ──

export type MirrorAct = "shave" | "trimBeard" | "tidy";
export interface MirrorOption { act: MirrorAct; label: string; ok: boolean; why?: string }

/** What the mirror can do this week (it can never give you a new style). */
export function mirrorOptions(c: CareerState, yourHead: ToonHead): MirrorOption[] {
  const n = hairNow(c, yourHead);
  return [
    { act: "shave", label: "Shave", ok: n.beard > 0, why: n.beard > 0 ? undefined : "Already clean shaven" },
    { act: "trimBeard", label: "Trim beard", ok: n.beard > 1, why: n.beard > 1 ? undefined : "Nothing to trim" },
    { act: "tidy", label: "Tidy hair", ok: n.hairStep > 0 || n.weeks > 0, why: n.hairStep > 0 || n.weeks > 0 ? undefined : "Fresh from the barber" },
  ];
}

/** Use the mirror: free, 10 clock minutes. Tidy takes the hair back to the style as it was cut. */
export function useMirror(c: CareerState, act: MirrorAct, yourHead: ToonHead): CutResult {
  const opt = mirrorOptions(c, yourHead).find((o) => o.act === act)!;
  if (!opt.ok) return { ok: false, career: c, text: opt.why ?? "Nothing to do.", price: 0, mood: 0, fans: 0 };
  const h = hairState(c, yourHead);
  const n = hairNow(c, yourHead);
  const w = absWeek(c);
  const run = applyThing(c, "mirrorHair", { text: act === "shave" ? "Clean shaven." : act === "trimBeard" ? "Beard trimmed." : "Hair tidied." });
  const s: HairState = { ...h, cutWeek: h.cutWeek ?? w, shaveWeek: h.shaveWeek ?? w };
  if (act === "shave") { s.beard0 = 0; s.shaveWeek = w; }
  if (act === "trimBeard") { s.beard0 = n.beard - 1; s.shaveWeek = w; }
  if (act === "tidy") s.cutWeek = w;
  return { ok: true, career: { ...run.career, hair: packHair(s) }, text: run.text, price: 0, mood: 0, fans: 0 };
}

// ── The barber's words (invented: no real people, no real shops) ────────

export const BARBER_NAME = "Rico";
export const BARBER_SHOP = "BARBER";
/** One line from the chair while he works, picked by the week (the plan's barber stories come later). */
export function barberLine(c: Pick<CareerState, "season" | "week">, untidy: boolean): string {
  if (untidy) return "Been a while, eh? Let's sort this out.";
  const lines = [
    "Big game coming up? You'll look the part.",
    "Half the lads in your team sit in this chair.",
    "Keep still. Nearly there.",
    "Clean lines. That's what we do.",
    "You'll be on the telly looking like that.",
  ];
  return lines[absWeek(c) % lines.length];
}
