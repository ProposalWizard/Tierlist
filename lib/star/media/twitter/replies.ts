/**
 * REPLIES THAT MAKE SENSE (Leo, 31 Oct 2026, round 4, switch part
 * "footballTwitter").
 *
 * Under a post: up to three replies, each from somebody with a side (a fan
 * of the club the post is about, a rival, a neutral), each line filed under
 * the post's tone (tone.ts, replyLines.ts). Now and then a rival's reply
 * starts an argument: a fan answers it, the rival answers back, a neutral
 * wades in. A TikTok post gets a comment section instead: a top comment with
 * the most likes (sometimes liked by the creator) and "replying to @…".
 *
 * Every reply carries its tone and side, so tests/star/footballTwitterReplies.mts
 * can check it against its post. Seeded like the rest of the feed.
 */
import type { Facts, PostReply, StoredPost, VoiceProfile } from "../types";
import { initialsOf, resolve, shortClub } from "../grammar";
import { primaryRivalOf } from "../../rivalries";
import { postTone, type Tone } from "./tone";
import { REPLY_BANK, COMEBACK, RETORT, NEUTRAL_JOIN, TIKTOK_AGREE } from "./replyLines";
import { hasPlayableVideo, impliesVideo } from "./videoWords";

export type Side = "fan" | "rival" | "neutral";

interface Guy { handle: string; name: string; tint: string; tint2: string }

/** Neutrals: small invented accounts that only ever turn up in replies. */
const NEUTRALS: Guy[] = [
  { handle: "@SundayLeagueLegend", name: "Sunday League Legend", tint: "#16a34a", tint2: "#bbf7d0" },
  { handle: "@xG_is_a_myth", name: "xG is a myth", tint: "#0ea5e9", tint2: "#1e3a8a" },
  { handle: "@ballwatcher_99", name: "ballwatcher", tint: "#f59e0b", tint2: "#7c2d12" },
  { handle: "@terrace_poet", name: "the terrace poet", tint: "#a855f7", tint2: "#fbcfe8" },
  { handle: "@MumsTheGaffer", name: "Mum's The Gaffer", tint: "#ec4899", tint2: "#fde68a" },
  { handle: "@fpl_dreamer", name: "fpl dreamer", tint: "#22c55e", tint2: "#064e3b" },
  { handle: "@OneTouchTom", name: "Tom | one touch", tint: "#ef4444", tint2: "#fecaca" },
  { handle: "@TopBinsTara", name: "Tara | top bins", tint: "#14b8a6", tint2: "#ccfbf1" },
  { handle: "@moaning_since88", name: "moaning since 88", tint: "#64748b", tint2: "#e2e8f0" },
  { handle: "@HalfTimeOranges", name: "Half Time Oranges", tint: "#fb923c", tint2: "#fff7ed" },
  { handle: "@nutmeg_nadia", name: "Nadia 🧦", tint: "#6366f1", tint2: "#e0e7ff" },
  { handle: "@ProperFootballPaul", name: "Proper Football Paul", tint: "#78350f", tint2: "#fde68a" },
  { handle: "@groundhop_gemma", name: "Gemma 🏟️", tint: "#0d9488", tint2: "#99f6e4" },
  { handle: "@PieAtHalfTime", name: "pie at half time", tint: "#a16207", tint2: "#fef08a" },
  { handle: "@neutral_ned", name: "Ned (no club)", tint: "#475569", tint2: "#cbd5e1" },
  { handle: "@FootyNerdFi", name: "Fi 🤓", tint: "#7c3aed", tint2: "#ddd6fe" },
];

/** First names for the fans (invented accounts; common first names only). */
const FIRSTS = ["Kieran", "Jordan", "Callum", "Liam", "Mo", "Dan", "Ellie", "Sophie", "Josh", "Ryan", "Aaron", "Jess", "Connor", "Priya", "Tash", "Leon", "Sam", "Reece", "Amir", "Chloe", "Jake", "Nathan", "Kayla", "Owen", "Zak", "Megan", "Harv", "Rhys"];
const TINTS = [["#dc2626", "#fecaca"], ["#2563eb", "#bfdbfe"], ["#16a34a", "#bbf7d0"], ["#7c3aed", "#ddd6fe"], ["#ea580c", "#fed7aa"], ["#0891b2", "#a5f3fc"], ["#be123c", "#fecdd3"], ["#1e293b", "#94a3b8"], ["#ca8a04", "#fef08a"]];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A supporter of `club`, invented from a seed: "Kieran | Spurs", @kieran_spurs07. */
function fanOf(club: string, rng: () => number, tiktok: boolean): Guy {
  const first = FIRSTS[Math.floor(rng() * FIRSTS.length)];
  const tag = shortClub(club).toLowerCase().replace(/[^a-z]/g, "");
  const n = String(Math.floor(rng() * 99) + 1).padStart(2, "0");
  const forms = tiktok
    ? [`@${first.toLowerCase()}.${tag}`, `@${tag}.${first.toLowerCase()}${n}`, `@${first.toLowerCase()}_${tag}fan`]
    : [`@${first}_${tag}${n}`, `@${tag}${first}`, `@${first}${shortClub(club).replace(/[^A-Za-z]/g, "")}FC`, `@${first.toLowerCase()}_${tag}_tilidie`];
  const handle = forms[Math.floor(rng() * forms.length)];
  const [tint, tint2] = TINTS[hash(club) % TINTS.length];
  return { handle, name: tiktok ? handle.slice(1) : `${first} | ${shortClub(club)}`, tint, tint2 };
}

const GOOD_DAY = new Set<Tone>(["goal", "skill", "praise", "award", "milestone", "clubWin", "trophy", "transfer", "contract", "cope", "player", "managerIn"]);
const BAD_DAY = new Set<Tone>(["badGame", "clubLoss", "relegation", "mock", "draw", "managerOut", "snub", "scandal"]);
/** Tones where {short} (your player) may be named even if the post's subject is a club. */
const NAMES_YOU = new Set<Tone>(["transfer", "rumour", "contract"]);
const CAPS_WORD = /\b[A-Z]{2,}\b|\bW\b|\bL\b/;

function filled(line: string, facts: Facts): boolean {
  for (const m of Array.from(line.matchAll(/\{([^}|]+)/g))) {
    const v = facts[m[1].trim()];
    if (v === undefined || v === null || v === "") return false;
  }
  return true;
}

/** Who the post's two sides are, and the slots the lines read. */
export function replyFacts(post: StoredPost, tone: Tone, facts: Facts): { f: Facts; mine: string | undefined; other: string | undefined } {
  const f: Facts = { ...facts };
  const str = (k: string) => (typeof facts[k] === "string" && facts[k] ? String(facts[k]) : undefined);
  const move = tone === "transfer" || tone === "rumour";
  let mine = move ? str("to") ?? str("club") : str("club");
  let other = move ? str("from") : undefined;
  const result = typeof facts.us === "number" && typeof facts.them === "number";
  if (!move) other = tone === "cope" ? (mine ? primaryRivalOf(mine) ?? undefined : undefined)
    : result && str("opponent") ? str("opponent") : (mine ? primaryRivalOf(mine) ?? str("opponent") : undefined);
  // A rival fan account's post: the rival side is that account's own club.
  if (!move && mine && post.persona === "rivalBanter") other = primaryRivalOf(mine) ?? other;
  if (other && mine && other === mine) other = undefined;
  if (move && !str("from") && mine) other = primaryRivalOf(mine) ?? undefined;
  for (const k of ["clubS", "rivS", "oppS", "winnerS", "loserS", "toS", "fromS", "optA", "optB", "mineS"]) delete f[k];
  if (mine) f.clubS = shortClub(mine);
  if (other) f.rivS = shortClub(other);
  if (str("to")) f.toS = shortClub(str("to")!);
  if (str("from")) f.fromS = shortClub(str("from")!);
  // Who won and lost: a score when there is one, else the day the club had.
  if (mine && result && str("opponent") && facts.us !== facts.them) {
    const won = (facts.us as number) > (facts.them as number);
    f.winnerS = shortClub(won ? mine : str("opponent")!);
    f.loserS = shortClub(won ? str("opponent")! : mine);
  } else if (mine && BAD_DAY.has(tone) && tone !== "draw") {
    f.loserS = shortClub(mine);
    if (other) f.winnerS = shortClub(other);
  } else if (mine && GOOD_DAY.has(tone)) {
    f.winnerS = shortClub(mine);
    if (other) f.loserS = shortClub(other);
  }
  const g = post.graphic;
  // Poll answers read mid-sentence ("going the manager", not "going The manager").
  const opt = (o: string) => o.charAt(0).toLowerCase() + o.slice(1);
  if (g && g.type === "poll" && g.options.length >= 2) { f.optA = opt(g.options[0]); f.optB = opt(g.options[1]); }
  if (!post.aboutYou && !NAMES_YOU.has(tone)) { delete f.short; delete f.player; }
  return { f, mine, other };
}

function styled(text: string, rng: () => number): string {
  // People type lower case more often than not, unless they are shouting.
  return !CAPS_WORD.test(text) && rng() < 0.45 ? text.toLowerCase() : text;
}

export interface ReplyOptions {
  /** Lines already used under this cycle's other posts: never the same reply twice. */
  cycleUsed?: Set<string>;
  /** Lines used under any post in the last few weeks (feed.ts FT_REPEAT_WEEKS). */
  recent?: Set<string>;
}

/**
 * The replies under one post: its tone, its sides, its platform. `facts`
 * are the facts the post was written from (the quoted post's for a quote).
 */
export function repliesFor(post: StoredPost, facts: Facts, voice: VoiceProfile, rng: () => number, opts: ReplyOptions = {}): PostReply[] {
  const cycleUsed = opts.cycleUsed ?? new Set<string>();
  const recent = opts.recent ?? new Set<string>();
  const tone = postTone(post);
  const bank = REPLY_BANK[tone];
  const video = hasPlayableVideo(post);
  const tiktok = post.author.platform === "tiktok";
  const { f, mine, other } = replyFacts(post, tone, facts);
  const used = new Set<string>();
  // A quiz page's question: rate it, count it, pick one, or one word.
  const quiz = tone !== "quiz" ? undefined
    : /\bone word\b|fill in|____/i.test(post.text) ? "word"
    : /rate|out of 10|\/10/i.test(post.text) ? "rate"
    : /how many|guess|total/i.test(post.text) ? "count"
    : "pick";
  const quizFits = (l: string) => { const m = /^(rate|count|pick|word):/.exec(l); return !m || m[1] === quiz; };
  // "the derby" only when the two sides really are derby rivals.
  const derby = !!mine && !!other && primaryRivalOf(mine) === other;
  const ok = (l: string) => filled(l, f) && !used.has(l) && !cycleUsed.has(l) && !recent.has(l) && (video || !impliesVideo(l)) && (derby || !/derby/i.test(l)) && (!quiz || quizFits(l));
  const take = (pool: string[]): string | undefined => {
    const lines = pool.filter(ok);
    if (!lines.length) return undefined;
    const l = lines[Math.floor(rng() * lines.length)];
    used.add(l); cycleUsed.add(l);
    return l;
  };
  const r = post.metrics.replies;
  const top = tiktok ? (r >= 40 ? 4 : r >= 8 ? 3 : r >= 1 ? 1 : 0) : (r >= 40 ? 3 : r >= 8 ? 2 : r >= 1 ? 1 : 0);
  if (!top) return [];

  const [wf, wr, wn] = bank.weights ?? [0.45, 0.25, 0.3];
  const handles = new Set<string>([post.author.handle]);
  const guyFor = (side: Side): Guy | undefined => {
    for (let t = 0; t < 6; t++) {
      const g = side === "neutral" ? NEUTRALS[Math.floor(rng() * NEUTRALS.length)]
        : fanOf(side === "fan" ? mine! : other!, rng, tiktok);
      if (!handles.has(g.handle)) { handles.add(g.handle); return g; }
    }
    return undefined;
  };
  const out: PostReply[] = [];
  let likes = Math.max(1, Math.round(post.metrics.likes * (tiktok ? 0.06 + rng() * 0.14 : 0.04 + rng() * 0.12)));
  const push = (g: Guy, side: Side, line: string, extra: Partial<PostReply> = {}, likeShare = 1) => {
    const text = styled(resolve(line.replace(/^(rate|count|pick|word):/, ""), { ...f, mineS: side === "rival" ? f.rivS ?? "" : f.clubS ?? "" }, voice, rng).trim(), rng);
    out.push({
      handle: g.handle, name: g.name, verified: rng() < 0.12, initials: initialsOf(g.name.replace(/^@/, "")),
      tint: g.tint, tint2: g.tint2, glyph: "grin", text, likes: Math.max(0, Math.round(likes * likeShare)),
      tone, side, ...extra,
    });
  };

  let rivals = 0, argued = false;
  for (let i = 0; i < top; i++) {
    const roll = rng() * (wf + wr + wn);
    let side: Side = roll < wf ? "fan" : roll < wf + wr ? "rival" : "neutral";
    if (side === "fan" && !mine) side = "neutral";
    if (side === "rival" && (!other || rivals >= 1)) side = mine ? "fan" : "neutral";
    // The comment section: video talk, stitches, "who's here after…".
    const tik = tiktok && video && bank.tiktok?.length && rng() < 0.45 ? take(bank.tiktok) : undefined;
    const vid = !tik && video && bank.video?.length && rng() < 0.4 ? take(bank.video) : undefined;
    const line = tik ?? vid ?? take(bank[side]) ?? take(bank.neutral);
    if (!line) break;
    // A comment about the video is anybody's; a rival only starts an argument with a rival's line.
    if ((tik || vid) ? side === "rival" : !bank[side].includes(line)) side = "neutral";
    const g = guyFor(side);
    if (!g) break;
    if (side === "rival") rivals++;
    push(g, side, line, tiktok && i === 0 && rng() < 0.35 ? { creatorLiked: true } : {});
    likes = Math.max(0, Math.round(likes * (0.3 + rng() * 0.4)));

    // A rival's reply sometimes starts an argument, two or three deep.
    if (side === "rival" && !argued && mine && (GOOD_DAY.has(tone) || BAD_DAY.has(tone)) && rng() < 0.6) {
      argued = true;
      const rivalHandle = g.handle;
      const back = take(GOOD_DAY.has(tone) ? COMEBACK.good : COMEBACK.bad);
      const fan = back ? guyFor("fan") : undefined;
      if (back && fan) {
        push(fan, "fan", back, { to: rivalHandle }, 0.6);
        const again = rng() < 0.55 ? take(RETORT) : undefined;
        if (again) {
          const rg: Guy = { handle: rivalHandle, name: out[out.length - 2].name, tint: out[out.length - 2].tint, tint2: out[out.length - 2].tint2 ?? "" };
          push(rg, "rival", again, { to: fan.handle }, 0.35);
        }
        const join = rng() < 0.3 ? take(NEUTRAL_JOIN) : undefined;
        const ng = join ? guyFor("neutral") : undefined;
        if (join && ng) push(ng, "neutral", join, { to: fan.handle }, 0.5);
      }
    }
  }
  // TikTok: someone replying to the top comment.
  if (tiktok && out.length >= 2 && !out.some(x => x.to) && rng() < 0.5) {
    const first = out[0];
    const side: Side = first.side === "rival" ? "fan" : "neutral";
    const line = side === "fan" ? take(GOOD_DAY.has(tone) ? COMEBACK.good : COMEBACK.bad) : take(TIKTOK_AGREE);
    const g = line ? guyFor(side === "fan" && !mine ? "neutral" : side) : undefined;
    if (line && g) out.splice(1, 0, { ...emptyReply(), handle: g.handle, name: g.name, initials: initialsOf(g.name.replace(/^@/, "")), tint: g.tint, tint2: g.tint2, glyph: "grin", text: styled(resolve(line, { ...f, mineS: f.clubS ?? "" }, voice, rng).trim(), rng), likes: Math.round(first.likes * (0.05 + rng() * 0.15)), tone, side, to: first.handle });
  }
  return out;
}

function emptyReply(): PostReply {
  return { handle: "", name: "", verified: false, initials: "", tint: "#000", text: "", likes: 0 };
}
