import type { CareerState } from "../types";
import { primaryRivalOf } from "../rivalries";
import { sortLeague } from "../season";
import type { Archetype, AvatarGlyph, MediaAccount, Platform, Tag, VoiceProfile } from "./types";
import { kitsOf } from "../kits";
import { hashSeed, initialsOf, rngFor, surname } from "./grammar";

/**
 * THE ROSTER
 *
 * Generated from the league you are actually in, not hardcoded. A career at
 * Arsenal has a different media world from one at Leeds — different club
 * accounts, different fans, a different rival enjoying your bad afternoons — and
 * the whole thing regenerates when you transfer, which is exactly right: your
 * new club's supporters have never heard of you, and your old club's rival has
 * lost interest in you overnight.
 *
 * ~40 accounts. The national cast is fixed because national newspapers are; the
 * local cast is yours.
 */

const VOICES: Record<Archetype, VoiceProfile> = {
  club:        { register: "neutral", lowercase: 0, caps: 0.55, emoji: 0.8, hashtags: 0.7, length: "short", punctuation: "clean", exclaim: 0.4, firstPerson: false },
  league:      { register: "formal", lowercase: 0,  caps: 0.2,  emoji: 0.5, hashtags: 0.2, length: "short", punctuation: "clean", exclaim: 0.05, firstPerson: false },
  competition: { register: "formal", lowercase: 0,  caps: 0.3,  emoji: 0.6, hashtags: 0.4, length: "short", punctuation: "clean", exclaim: 0.15, firstPerson: false },
  broadsheet:  { register: "formal", lowercase: 0,  caps: 0.02, emoji: 0.05, hashtags: 0,  length: "long",  punctuation: "clean", exclaim: 0,    firstPerson: false },
  tabloid:     { register: "raw", lowercase: 0,     caps: 0.8,  emoji: 0.2, hashtags: 0.1, length: "short", punctuation: "clean", exclaim: 0.5,  firstPerson: false },
  insider:     { register: "neutral", lowercase: 0, caps: 0.35, emoji: 0.85, hashtags: 0.1, length: "medium", punctuation: "clean", exclaim: 0.05, firstPerson: false },
  stats:       { register: "neutral", lowercase: 0, caps: 0.05, emoji: 0.4, hashtags: 0.05, length: "short", punctuation: "clean", exclaim: 0,   firstPerson: false },
  aggregator:  { register: "casual", lowercase: 0,  caps: 0.4,  emoji: 0.7, hashtags: 0.3, length: "short", punctuation: "clean", exclaim: 0.2,  firstPerson: false },
  pundit:      { register: "casual", lowercase: 0,  caps: 0.1,  emoji: 0.1, hashtags: 0,   length: "long",  punctuation: "clean", exclaim: 0.1,  firstPerson: true },
  fan:         { register: "raw", lowercase: 0.75,     caps: 0.25, emoji: 0.55, hashtags: 0.15, length: "short", punctuation: "none", exclaim: 0.35, firstPerson: true },
  rivalFan:    { register: "raw", lowercase: 0.85,     caps: 0.15, emoji: 0.35, hashtags: 0.05, length: "short", punctuation: "none", exclaim: 0.15, firstPerson: true },
  teammate:    { register: "casual", lowercase: 0.15,  caps: 0.2,  emoji: 0.9, hashtags: 0.35, length: "short", punctuation: "loose", exclaim: 0.3,  firstPerson: true },
  meme:        { register: "casual", lowercase: 0.6,  caps: 0.3,  emoji: 0.6, hashtags: 0.1, length: "short", punctuation: "loose", exclaim: 0.15, firstPerson: false },
};

/**
 * What each kind of account is actually interested in.
 *
 * This is the selection stage's whole input, and it is where the personalities
 * really live — a stat page that ignores drama and a tabloid that ignores
 * statistics behave differently before either of them has written a word.
 */
const INTERESTS: Record<Archetype, Partial<Record<Tag, number>>> = {
  club:        { goal: 1, assist: 0.8, trophy: 1, table: 0.9, cup: 1, europe: 1, debut: 0.9, transfer: 0.9, contract: 0.9, award: 1, milestone: 0.9, international: 0.6, title: 1 },
  league:      { goal: 0.7, table: 1, title: 1, relegation: 1, record: 0.9, milestone: 0.7, stat: 0.8, trophy: 1 },
  competition: { cup: 1, europe: 1, trophy: 1, drama: 0.6, goal: 0.5 },
  broadsheet:  { table: 0.9, title: 1, relegation: 1, drama: 0.8, manager: 1, opinion: 0.9, cup: 0.8, transfer: 0.8, europe: 0.9, goal: 0.5, form: 0.6 },
  tabloid:     { drama: 1, shame: 1, goal: 0.9, derby: 1, manager: 1, transfer: 1, rumour: 1, title: 0.8, relegation: 0.9, opinion: 0.7 },
  insider:     { transfer: 1, rumour: 1, contract: 1, manager: 0.9, international: 0.5 },
  stats:       { stat: 1, record: 1, streak: 1, milestone: 1, goal: 0.8, assist: 0.9, keeper: 0.8, form: 0.7, table: 0.6 },
  aggregator:  { goal: 0.9, drama: 0.9, derby: 0.8, trophy: 0.8, shame: 0.6, cup: 0.6 },
  pundit:      { opinion: 1, form: 0.9, manager: 0.9, drama: 0.7, shame: 0.8, title: 0.8, award: 0.7, table: 0.5 },
  fan:         { goal: 1, drama: 1, derby: 1, shame: 0.9, table: 0.8, trophy: 1, form: 0.8, manager: 0.7, transfer: 0.8, debut: 0.7, milestone: 0.7 },
  rivalFan:    { shame: 1, drama: 0.9, derby: 1, relegation: 0.9, opinion: 0.5, table: 0.5, title: 0.6 },
  teammate:    { goal: 0.9, trophy: 1, debut: 0.9, milestone: 0.8, award: 0.9, table: 0.5 },
  meme:        { drama: 0.9, shame: 1, derby: 0.8, goal: 0.6, opinion: 0.6, manager: 0.7 },
};

/**
 * Eighteen hues rather than ten, because ten meant two same-archetype
 * accounts drawing the same colour was common rather than rare — reported as
 * two accounts sharing "the exact same... image, but all that's changed is
 * the background colour very slightly". A bigger palette is half the fix; the
 * other half is `used`, below, which refuses to hand out a combination twice
 * in the same roster regardless of how big the palette is.
 */
const TINTS = [
  "#dc2626", "#ea580c", "#d97706", "#ca8a04", "#65a30d",
  "#16a34a", "#059669", "#0d9488", "#0891b2", "#0284c7",
  "#2563eb", "#4f46e5", "#7c3aed", "#9333ea", "#c026d3",
  "#db2777", "#e11d48", "#78350f",
];

interface Seed {
  handle: string;
  name: string;
  archetype: Archetype;
  platform?: Platform;
  verified?: boolean;
  followers: number;
  /** Set on a club's own account, so its badge is drawn in that club's kit. */
  club?: string;
}

/** The national press. Fixed, because national newspapers are. */
const NATIONAL: Seed[] = [
  { handle: "@TheDailyPost", name: "The Daily Post", archetype: "broadsheet", platform: "news", verified: true, followers: 2_400_000 },
  { handle: "@ChronicleSport", name: "Chronicle Sport", archetype: "broadsheet", platform: "news", verified: true, followers: 1_600_000 },
  { handle: "@TheStarBack", name: "The Star — Back Page", archetype: "tabloid", platform: "news", verified: true, followers: 3_100_000 },
  { handle: "@MatchdayMirror", name: "Matchday Mirror", archetype: "tabloid", platform: "news", verified: true, followers: 2_200_000 },
  { handle: "@RomanoWatch", name: "Fabio Marchetti", archetype: "insider", verified: true, followers: 4_800_000 },
  { handle: "@DealsheetFC", name: "Dealsheet", archetype: "insider", verified: true, followers: 890_000 },
  { handle: "@OptaLeague", name: "Numbers FC", archetype: "stats", verified: true, followers: 1_900_000 },
  { handle: "@SquawkaStyle", name: "The Data Room", archetype: "stats", verified: false, followers: 620_000 },
  { handle: "@FootballDaily_", name: "Football Daily", archetype: "aggregator", verified: true, followers: 5_200_000 },
  { handle: "@GaryOnTheBox", name: "Gary Wilkes", archetype: "pundit", verified: true, followers: 1_400_000 },
  { handle: "@RoyKeanTakes", name: "Ronan Keane", archetype: "pundit", verified: true, followers: 980_000 },
  { handle: "@TerraceMemes", name: "Terrace Memes", archetype: "meme", verified: false, followers: 1_100_000 },
];

const FAN_HANDLES = [
  "terrace_tom", "northbank_nia", "ninetyminutes", "matchday_mo", "stand_side",
  "awaydays_al", "programme_pat", "halfway_line", "boxtobox_bea", "endofseason_ed",
];

const FAN_NAMES = [
  "Tom", "Nia", "Ninety Minutes", "Mo", "Standside", "Al", "Pat", "Halfway", "Bea", "Ed",
];

/**
 * What each kind of account draws instead of its initials.
 *
 * A trophy for the people who hand them out, a microphone for the man paid to
 * have opinions, a scarf for somebody in the stand. Nothing here is a picture
 * file — see AvatarGlyph and components/star/media/PostCard.
 *
 * A POOL rather than one glyph per archetype, because an archetype is rarely
 * one account: three competition accounts, five of your own supporters, four
 * team-mates. One glyph each meant every fan in the feed carried the same
 * scarf and every stats page the same chart — the only thing telling them
 * apart was a colour drawn from a ten-value palette, which collided often
 * enough to be exactly what got reported. `avatarFor` below draws from
 * whichever pool the account's archetype has.
 *
 * `club` is deliberately `["crest"]`, which KEEPS the lettering: a club badge
 * is lettering, and the thing that makes it theirs is the colours, which come
 * from the real kit below — no pool needed, because twenty clubs already have
 * twenty different kits.
 */
const GLYPHS: Record<Archetype, AvatarGlyph[]> = {
  club: ["crest"],
  league: ["trophy"],
  competition: ["cup", "trophy", "ball"],
  broadsheet: ["newspaper", "quote"],
  tabloid: ["megaphone", "flag"],
  insider: ["scoop", "quote"],
  stats: ["chart", "grid"],
  aggregator: ["play"],
  pundit: ["mic", "quote"],
  fan: ["scarf", "flag", "drum", "ball"],
  rivalFan: ["scarf", "flag", "drum"],
  teammate: ["shirt", "boot"],
  meme: ["grin"],
};

// ── Colour ───────────────────────────────────────────────────────────────
//
// A disc needs two stops, and "the same hue, one shade darker" is only one
// of the ways a gradient can look good — it is also the ONLY way this used
// to look, on every single account, which is why two of them a shade apart
// read as "the exact same thing". `hueRotate`/`towardWhite`/`shade` give
// `gradientPartner` three genuinely different pairings to draw from: a
// punchier two-tone next to the wheel, a pale fade toward white (the "white
// to pink" look asked for), and the original darker-same-hue for when that
// is the right call.

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, "0")}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3) * 255, hue2rgb(h) * 255, hue2rgb(h - 1 / 3) * 255];
}

/** A second tint for the disc's gradient — a shade darker along the same hue. */
function shade(hex: string, by: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * by, g * by, b * by);
}
/** …or a pale fade toward white, along the same hue. */
function towardWhite(hex: string, by: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * by, g + (255 - g) * by, b + (255 - b) * by);
}
/** …or a genuinely different hue, next to this one on the wheel. */
function hueRotate(hex: string, degrees: number): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return rgbToHex(...hslToRgb(h + degrees, s, l));
}

function gradientPartner(tint: string, rng: () => number): string {
  const roll = rng();
  if (roll < 0.4) return shade(tint, 0.5 + rng() * 0.2);
  if (roll < 0.75) return towardWhite(tint, 0.45 + rng() * 0.3);
  return hueRotate(tint, (rng() < 0.5 ? -1 : 1) * (24 + rng() * 40));
}

/**
 * One (glyph, tint) pairing this roster hasn't handed out yet.
 *
 * A handful of draws almost always land somewhere free — ~40 accounts against
 * pools this size leave hundreds of combinations — so the loop is a safety
 * margin, not the mechanism; `used` is. Exhausting it genuinely can't happen
 * at this roster size, but the loop still terminates on its own rather than
 * trusting that, and hands back whatever it last drew if it somehow did.
 */
function pickUnused(pool: AvatarGlyph[], rng: () => number, used: Set<string>): { glyph: AvatarGlyph; tintIndex: number } {
  let glyph: AvatarGlyph = pool[0], tintIndex = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    glyph = pool[Math.floor(rng() * pool.length)];
    tintIndex = Math.floor(rng() * TINTS.length);
    const key = `${glyph}|${tintIndex}`;
    if (!used.has(key)) { used.add(key); return { glyph, tintIndex }; }
  }
  return { glyph, tintIndex };
}

function avatarFor(s: Seed, rng: () => number, used: Set<string>): MediaAccount["avatar"] {
  const pool = GLYPHS[s.archetype];
  // A club wears its own kit, always — twenty real strips are already twenty
  // different avatars, so it never needs to compete for a free slot.
  const kit = s.club ? kitsOf(s.club).home : null;
  if (kit) {
    return {
      initials: initialsOf(s.name),
      tint: kit.shirt,
      tint2: kit.trim,
      glyph: pool[Math.floor(rng() * pool.length)],
    };
  }
  const { glyph, tintIndex } = pickUnused(pool, rng, used);
  const tint = TINTS[tintIndex];
  return {
    initials: initialsOf(s.name),
    tint,
    tint2: gradientPartner(tint, rng),
    glyph,
  };
}

function account(s: Seed, rngSeed: string, used: Set<string>): MediaAccount {
  const rng = rngFor("acct", rngSeed, s.handle);
  return {
    id: s.handle,
    handle: s.handle,
    name: s.name,
    archetype: s.archetype,
    platform: s.platform ?? "x",
    verified: s.verified ?? false,
    followers: s.followers,
    avatar: avatarFor(s, rng, used),
    voice: VOICES[s.archetype],
    interests: INTERESTS[s.archetype],
  };
}

function clubHandle(club: string): string {
  return "@" + club.replace(/[^A-Za-z]/g, "");
}

/**
 * Build the world.
 *
 * Deterministic from the club list, the season and who you play for, so it is
 * the same roster every time you open the feed and a different one after a
 * transfer.
 */
export function buildRoster(career: CareerState): MediaAccount[] {
  const clubs = career.league.map(t => t.name);
  const me = career.player.club;
  const rival = primaryRivalOf(me);
  const leader = sortLeague(career.league)[0]?.name;
  const seedKey = `${me}|${clubs.length}|${career.season}`;
  const out: MediaAccount[] = [];
  // One dedup set for the whole roster: a club's real kit never touches it
  // (see avatarFor), so it only ever has to keep the ~20 non-club accounts
  // below apart from each other.
  const used = new Set<string>();

  // Every club in the division gets an account. Theirs post about their own
  // results; yours posts about you.
  for (const c of career.league) {
    const strength = c.strength;
    out.push({
      ...account({
        handle: clubHandle(c.name),
        name: `${c.name} FC`,
        archetype: "club",
        verified: true,
        followers: Math.round(200_000 + (strength / 100) * 8_000_000),
        club: c.name,
      }, seedKey, used),
      allegiance: { club: c.name, polarity: 1 },
    });
  }

  out.push(account({
    handle: "@PremierLeague", name: "The League", archetype: "league",
    verified: true, followers: 12_000_000,
  }, seedKey, used));

  for (const comp of ["FA Cup", "Champions League", "Europa League"]) {
    out.push(account({
      handle: "@" + comp.replace(/\s+/g, ""), name: comp, archetype: "competition",
      verified: true, followers: comp === "Champions League" ? 9_000_000 : 1_400_000,
    }, seedKey, used));
  }

  for (const s of NATIONAL) out.push(account(s, seedKey, used));

  // Your supporters.
  const rng = rngFor("fans", seedKey);
  for (let i = 0; i < 5; i++) {
    const h = FAN_HANDLES[(hashSeed(me) + i * 7) % FAN_HANDLES.length];
    out.push({
      ...account({
        handle: `@${h}`, name: FAN_NAMES[(hashSeed(me) + i * 7) % FAN_NAMES.length],
        archetype: "fan", followers: 200 + Math.floor(rng() * 9_000),
      }, seedKey + i, used),
      allegiance: { club: me, polarity: 1 },
    });
  }

  // Theirs. The derby rival is permanent; the league leader rotates as the
  // table does, which is how the feed knows who is currently enjoying itself.
  const hostile = [rival, leader].filter((c): c is string => !!c && c !== me);
  for (const c of Array.from(new Set(hostile))) {
    out.push({
      ...account({
        handle: `@${c.replace(/[^A-Za-z]/g, "").slice(0, 10).toLowerCase()}_til_i_die`,
        name: `${c} 'til I die`,
        archetype: "rivalFan",
        followers: 1_500 + Math.floor(rng() * 20_000),
      }, seedKey + c, used),
      allegiance: { club: c, polarity: -1 },
    });
  }

  // Your own team-mates, from the actual squad.
  const mates = (career.squad ?? []).filter(p => ["ST", "CAM", "LW", "RW", "CM", "GK"].includes(p.position)).slice(0, 4);
  for (const p of mates) {
    out.push({
      ...account({
        handle: `@${p.shortName.replace(/[^A-Za-z]/g, "").toLowerCase()}_official`,
        name: p.name,
        archetype: "teammate",
        platform: "instagram",
        verified: true,
        followers: 50_000 + Math.floor(rng() * 900_000),
      }, seedKey + p.id, used),
      allegiance: { club: me, polarity: 1 },
    });
  }

  return out;
}

/** Your own account. Handled separately because it is you, and it posts last. */
export function selfAccount(career: CareerState): MediaAccount {
  const name = `${career.player.firstName} ${career.player.lastName}`;
  const rng = rngFor("self", name);
  return {
    id: "@self",
    handle: `@${career.player.firstName[0]?.toLowerCase() ?? "x"}${surname(name).toLowerCase().replace(/[^a-z]/g, "")}${career.squadNumber ?? ""}`,
    name,
    archetype: "teammate",
    platform: "instagram",
    verified: career.fame > 40,
    followers: Math.round(5_000 + career.fame * 24_000 + career.starRating * 180_000),
    avatar: {
      initials: initialsOf(name),
      tint: kitsOf(career.player.club).home.shirt,
      tint2: kitsOf(career.player.club).home.trim,
      glyph: "shirt",
    },
    voice: { ...VOICES.teammate, firstPerson: true },
    interests: { goal: 1, assist: 0.9, trophy: 1, milestone: 1, award: 1, debut: 1, table: 0.5, transfer: 1 },
    allegiance: { club: career.player.club, polarity: 1 },
  };
}
