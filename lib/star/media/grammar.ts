import { mulberry32 } from "../season";
import type { Facts, FactValue, VoiceProfile } from "./types";

/**
 * THE GRAMMAR
 *
 * Where the combinatorics come from, and the reason this is not a bag of
 * hardcoded posts.
 *
 * A template is a sentence with holes in it. The holes are not filled with
 * values — they are filled by drawing from a weighted pool, biased by the voice
 * of whoever is writing. So `{goals}` with `goals: 3` is "a hat-trick" in a
 * broadsheet and "a matchball" in a tabloid and "THREE" on a club account, from
 * one authored line. Four slots at four alternatives each turns ~1,200 authored
 * fragments into millions of distinct posts.
 *
 * Every draw is seeded. The same post regenerated is the same post — see the
 * determinism note in ARCHITECTURE.md §6.
 */

/** A stable 32-bit hash of a string, so a seed can be built out of names. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function rngFor(...parts: (string | number)[]): () => number {
  return mulberry32(hashSeed(parts.join("|")));
}

export function pick<T>(pool: readonly T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/** Weighted pick. Weights are read off a parallel array or a `weight` field. */
export function pickWeighted<T extends { weight?: number }>(pool: readonly T[], rng: () => number): T {
  const total = pool.reduce((s, p) => s + (p.weight ?? 1), 0);
  let r = rng() * total;
  for (const p of pool) {
    r -= p.weight ?? 1;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Register-aware phrase pools ─────────────────────────────────────────────
//
// Each pool is keyed by register, so the SAME slot in the SAME template reads
// differently depending on who is writing. This is the one mechanism that makes
// thirteen accounts sound like thirteen writers instead of one writer with
// thirteen names.

type Register = VoiceProfile["register"];
type Pool = Partial<Record<Register, readonly string[]>> & { any: readonly string[] };

function fromPool(p: Pool, reg: Register, rng: () => number): string {
  return pick(p[reg] ?? p.any, rng);
}

const GOAL_COUNT: Record<number, Pool> = {
  1: {
    any: ["a goal", "one", "the goal"],
    formal: ["a goal", "the only goal of his afternoon"],
    raw: ["a goal", "one"],
  },
  2: {
    any: ["a brace", "two", "a double"],
    formal: ["a brace", "two goals"],
    casual: ["a brace", "two", "a double"],
    raw: ["two", "a brace"],
  },
  3: {
    any: ["a hat-trick", "three", "the matchball"],
    formal: ["a hat-trick", "three goals"],
    casual: ["a hat-trick", "the matchball", "three"],
    raw: ["a HAT-TRICK", "three", "the matchball"],
  },
  4: { any: ["four", "four goals", "an unthinkable four"] },
  5: { any: ["five", "FIVE", "five goals in one afternoon"] },
};

const LATE: Pool = {
  any: ["at the death", "with a minute left", "deep into the second half", "right at the end"],
  formal: ["deep into stoppage time", "with the clock all but gone"],
  raw: ["AT THE DEATH", "with seconds left", "in the last minute"],
};

const WIN_VERB: Pool = {
  any: ["won it", "took it", "got the job done", "found a way"],
  formal: ["edged it", "prevailed", "saw it out"],
  casual: ["won it", "nicked it", "took all three"],
  raw: ["WON IT", "nicked it", "smashed them"],
};

const LOSS_VERB: Pool = {
  any: ["lost it", "came up short", "were beaten"],
  formal: ["were undone", "could not find an answer"],
  casual: ["lost it", "threw it away", "fell short"],
  raw: ["bottled it", "lost", "were awful"],
};

const BIG_WIN: Pool = {
  any: ["took them apart", "ran riot", "were ruthless"],
  formal: ["were utterly dominant", "swept them aside"],
  raw: ["DESTROYED them", "battered them", "ran riot"],
};

const BIG_LOSS: Pool = {
  any: ["were taken apart", "were run over", "had no answer"],
  formal: ["were comprehensively beaten", "were outclassed"],
  raw: ["got battered", "were embarrassing", "got destroyed"],
};

const GREAT_GOAL: Pool = {
  any: ["a wonderful finish", "a superb goal", "a brilliant strike"],
  formal: ["a finish of real quality", "an excellent strike"],
  casual: ["an unbelievable goal", "a worldie", "a special one"],
  raw: ["A WORLDIE", "an absolute rocket", "unreal"],
};

const HOW: Partial<Record<string, Pool>> = {
  long_range: { any: ["from distance", "from range", "from outside the box"], raw: ["FROM MILES OUT", "from range"] },
  volley: { any: ["on the volley", "first time", "without letting it drop"], raw: ["ON THE VOLLEY", "first time"] },
  header: { any: ["with his head", "with a header", "in the air"], formal: ["with a well-timed header"] },
  free_kick: { any: ["from a free kick", "over the wall", "from a set piece"], raw: ["FROM A FREE KICK", "over the wall"] },
  penalty: { any: ["from the spot", "from twelve yards", "with a penalty"] },
  one_on_one: { any: ["one on one", "through on goal", "clean through"] },
  tight_angle: { any: ["from an impossible angle", "off the near post", "from nothing"] },
  cutback: { any: ["from the cutback", "from a square ball"] },
  through_ball: { any: ["after being picked out", "on the shoulder", "in behind"] },
  byline_cross: { any: ["from the byline", "from a whipped cross"] },
  corner: { any: ["from the corner", "from a set piece"] },
  rebound: { any: ["from the rebound", "following it in", "on the follow-up"] },
  solo: { any: ["on his own", "after carrying it", "from nothing"] },
};

const RATING_WORD: Pool = {
  any: ["outstanding", "excellent", "very good", "unplayable"],
  formal: ["outstanding", "exceptional", "of the highest order"],
  raw: ["UNPLAYABLE", "different class", "unreal"],
};

const POOR_WORD: Pool = {
  any: ["quiet", "anonymous", "off the pace"],
  formal: ["subdued", "peripheral"],
  raw: ["hiding", "invisible", "shocking"],
};

// ── Slot resolution ─────────────────────────────────────────────────────────

/**
 * Turn `{slot}` and `{slot|filter}` into words.
 *
 * Filters are the small grammatical chores that would otherwise leak into every
 * template: `|caps` shouts it, `|short` gives a surname, `|ordinal` turns 3 into
 * "3rd". A template should read like a sentence, not like string handling.
 */
export function resolve(body: string, facts: Facts, voice: VoiceProfile, rng: () => number): string {
  return body.replace(/\{([^}]+)\}/g, (_, expr: string) => {
    const [key, ...filters] = expr.split("|");
    let out = slotValue(key.trim(), facts, voice, rng);
    for (const f of filters) out = applyFilter(out, f.trim(), rng);
    return out;
  });
}

function slotValue(key: string, facts: Facts, voice: VoiceProfile, rng: () => number): string {
  const reg = voice.register;
  const v = facts[key];

  switch (key) {
    case "goals": {
      const n = num(v);
      const pool = GOAL_COUNT[n];
      return pool ? fromPool(pool, reg, rng) : `${n} goals`;
    }
    case "late": return fromPool(LATE, reg, rng);
    case "winVerb": return fromPool(WIN_VERB, reg, rng);
    case "lossVerb": return fromPool(LOSS_VERB, reg, rng);
    case "bigWin": return fromPool(BIG_WIN, reg, rng);
    case "bigLoss": return fromPool(BIG_LOSS, reg, rng);
    case "greatGoal": return fromPool(GREAT_GOAL, reg, rng);
    case "ratingWord": return fromPool(RATING_WORD, reg, rng);
    case "poorWord": return fromPool(POOR_WORD, reg, rng);
    case "how": {
      const pool = HOW[String(v ?? "")];
      return pool ? fromPool(pool, reg, rng) : "";
    }
    default:
      if (v === undefined || v === null) return "";
      return String(v);
  }
}

function applyFilter(s: string, filter: string, rng: () => number): string {
  switch (filter) {
    case "caps": return s.toUpperCase();
    case "lower": return s.toLowerCase();
    case "title": return s.replace(/\b\w/g, c => c.toUpperCase());
    case "sentence": return s.charAt(0).toUpperCase() + s.slice(1);
    case "short": return surname(s);
    case "possessive": return s.endsWith("s") ? `${s}'` : `${s}'s`;
    case "ordinal": return ordinal(Number(s));
    case "plural": return Number(s) === 1 ? "" : "s";
    case "was": return Number(s) === 1 ? "was" : "were";
    case "abs": return String(Math.abs(Number(s)));
    case "nick": return nickname(s, rng);
    default: return s;
  }
}

export function surname(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}

export function initialsOf(name: string): string {
  const parts = name.replace(/^@/, "").split(/[\s_]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * A club's name at the width of a caption.
 *
 * Not the nickname below — this is what goes under a player on a graphic, where
 * "Wolverhampton Wanderers" is twenty-three characters in a box eighty pixels
 * wide, and a truncated club name reads as a rendering bug rather than as a
 * club. It is what a broadcaster puts on the same caption.
 *
 * Rules first, exceptions second, and only three exceptions. Dropping the
 * trailing "United" or "Hotspur" leaves Leeds, Newcastle, West Ham and
 * Tottenham correct on its own; it leaves Wolverhampton, and nobody calls them
 * that. Manchester is the other one — two clubs share the distinctive half, so
 * neither can lose it.
 */
const CLUB_SHORT_EXCEPTIONS: Record<string, string> = {
  "wolverhampton wanderers": "Wolves",
  "manchester united": "Man Utd",
  "manchester city": "Man City",
};

/** Words that identify no club on their own — every one is shared by several. */
const CLUB_SUFFIXES = new Set(["united", "city", "town", "rovers", "albion", "wanderers", "county", "hotspur"]);

export function shortClub(club: string): string {
  const trimmed = club.trim();
  const exception = CLUB_SHORT_EXCEPTIONS[trimmed.toLowerCase()];
  if (exception) return exception;

  // "Brighton & Hove Albion" is Brighton to everyone, including Brighton.
  let name = trimmed.split(/\s*&\s*/)[0];
  // "AFC Bournemouth", "Fulham FC" — the letters are the club's, not its name.
  name = name.replace(/^(AFC|FC)\s+/i, "").replace(/\s+(AFC|FC)$/i, "");

  const parts = name.split(/\s+/);
  if (parts.length > 1 && CLUB_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    const without = parts.slice(0, -1).join(" ");
    // "City" alone is not a club, but nor is anything shorter than a name.
    if (without.length >= 4) return without;
  }
  return name;
}

/**
 * A club nickname, invented from the name and stable for the career.
 *
 * Real supporters do not say "Manchester United have won" — they say "United"
 * or "the Reds". This is the cheap version and it is enough: shorten a two-word
 * name to its distinctive half, or reach for a colour the crowd would use.
 */
const COLOURS = ["the Reds", "the Blues", "the Whites", "the City", "the Town", "the Lads"];

export function nickname(club: string, rng: () => number): string {
  const parts = club.split(/\s+/);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1];
    if (!["FC", "United", "City", "Town", "Rovers", "Albion", "Wanderers", "County"].includes(tail)) {
      return tail;
    }
    if (["United", "City", "Town", "Rovers", "Albion", "Wanderers", "County"].includes(tail)) return tail;
  }
  return rng() < 0.5 ? club : pick(COLOURS, rng);
}

function num(v: FactValue | undefined): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

// ── Voice ───────────────────────────────────────────────────────────────────

const EMOJI_BY_TAG: Record<string, string[]> = {
  goal: ["⚽", "🎯", "🔥"],
  trophy: ["🏆", "🥇"],
  record: ["📈", "🔢"],
  drama: ["😱", "🤯", "🚨"],
  shame: ["😩", "💀", "🫠"],
  transfer: ["🚨", "✍️", "🔴"],
  award: ["🏅", "👏"],
  table: ["📊", "⬆️"],
  stat: ["🔢", "📊"],
};

/** Does this already end in an emoji? Then it does not need another one. */
// Deliberately not a unicode-property regex: the build targets ES5 and the
// `u` flag is not available there. Surrogate range plus the common symbol
// blocks covers every emoji this file can actually emit.
const ENDS_IN_EMOJI = /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE0F\u2B00-\u2BFF])\s*$/;

/**
 * Put the account's accent on a finished sentence.
 *
 * Deliberately applied AFTER the template, not inside it, so one authored line
 * can be spoken by a broadsheet and by a fan without either of them needing
 * their own copy of it. A raw voice drops the full stop and shouts; a formal one
 * never does either.
 */
export function speak(
  text: string,
  voice: VoiceProfile,
  tags: string[],
  rng: () => number,
  hashtag?: string,
): string {
  let out = text.trim().replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1");

  if (rng() < voice.lowercase) out = out.toLowerCase();
  if (voice.punctuation === "none") out = out.replace(/[.]$/, "");

  // An emoji is already punctuation. Adding "!" after one, or a second emoji
  // after the first, is what "onto the next one 💪! 📉" looked like.
  const decorated = ENDS_IN_EMOJI.test(out);
  if (!decorated && voice.exclaim > 0 && rng() < voice.exclaim) out = out.replace(/[.]?$/, "!");

  if (!decorated && voice.emoji > 0 && rng() < voice.emoji) {
    const bag = tags.flatMap(t => EMOJI_BY_TAG[t] ?? []);
    if (bag.length) out = `${out} ${pick(bag, rng)}`;
  }
  if (hashtag && voice.hashtags > 0 && rng() < voice.hashtags) out = `${out} ${hashtag}`;

  return out.trim();
}

/** How much engagement a post of this reach and importance gets. */
export function metricsFor(followers: number, importance: number, rng: () => number) {
  const base = Math.sqrt(followers) * (0.4 + importance / 100);
  const likes = Math.max(3, Math.round(base * (0.7 + rng() * 0.9)));
  return {
    likes,
    reposts: Math.max(0, Math.round(likes * (0.08 + rng() * 0.22))),
    replies: Math.max(0, Math.round(likes * (0.04 + rng() * 0.16))),
  };
}
