/**
 * FOOTBALL TWITTER: HOW IT BEHAVES (Leo, 31 Oct 2026, switch part "footballTwitter").
 *
 * Everything here runs only with the switch on (feed.ts checks
 * `footballTwitterOn()` before calling any of it). Seeded like the rest of
 * the feed: the same career makes the same posts, numbers and order.
 *
 *  - derivedFacts   the extra slots a persona line can use ({clubS}, {xgUs}…)
 *  - personaSpeak   the account's own typing habits (keeps line breaks)
 *  - engagement     views ≫ likes ≫ reposts ≫ quotes, scaled by followers,
 *                   importance and a viral roll that sometimes snowballs
 *  - replyThread    the top replies under the big posts (banter)
 *  - quotePosts     the journalist / hype page / ratio page quoting a post
 *  - rankFeed       the "For you" order: engagement, freshness, you, variety
 */
import type {
  Facts, FootballEvent, GraphicSpec, MediaAccount, PostReply, StoredPost, VoiceProfile,
} from "../types";
import type { CareerState } from "../../types";
import { initialsOf, pick, resolve, rngFor, shortClub } from "../grammar";
import { sortLeague } from "../../season";
import { personaById, isBadNews, isGoodNews } from "./personas";

// ── Slots ─────────────────────────────────────────────────────────────────

const FRACTIONS = ["1/5", "2/7", "1/3", "4/9", "1/2", "4/6", "4/5", "Evens", "6/5", "6/4", "7/4", "2/1", "5/2", "3/1", "4/1", "5/1", "7/1", "10/1", "16/1", "25/1"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Four poll shares that add up to 100, the first usually the biggest. */
function shares(rng: () => number, n: number): number[] {
  const raw = Array.from({ length: n }, (_, i) => (n - i) * (0.6 + rng()));
  const sum = raw.reduce((a, b) => a + b, 0);
  const out = raw.map(x => Math.floor((x / sum) * 100));
  out[0] += 100 - out.reduce((a, b) => a + b, 0);
  return out;
}

/**
 * The event's facts plus the slots only persona lines use. Nothing is added
 * that the event cannot back: no opponent, no {oppS}.
 */
export function derivedFacts(e: FootballEvent, a: MediaAccount, career: CareerState, rng: () => number): Facts {
  const f: Facts = { ...e.facts };
  const p = a.persona ? personaById(a.persona) : undefined;
  if (p?.catchphrases.length) f.catch = pick(p.catchphrases, rng);
  const s = (k: string) => (typeof f[k] === "string" && f[k] ? shortClub(String(f[k])) : undefined);
  const put = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== "") f[k] = v; };
  put("clubS", s("club"));
  put("oppS", s("opponent"));
  put("homeS", s("homeClub"));
  put("awayS", s("awayClub"));
  if (typeof f.us === "number" && typeof f.them === "number") {
    const xg = (g: number) => Math.max(0.1, g * (0.55 + rng() * 0.5) + rng() * 0.9);
    f.xgUs = xg(f.us).toFixed(2);
    f.xgThem = xg(f.them).toFixed(2);
  }
  if (typeof f.seasonTotal === "number" && f.seasonTotal > 0) f.xgSeason = (f.seasonTotal * (0.6 + rng() * 0.3)).toFixed(1);
  f.groundNo = 380 + Math.floor(rng() * 90);
  const was = 6 + Math.floor(rng() * 12);
  f.oddsWas = FRACTIONS[Math.min(FRACTIONS.length - 1, was)];
  f.oddsNow = FRACTIONS[Math.max(0, was - 3 - Math.floor(rng() * 4))];
  const club = typeof e.facts.club === "string" ? e.facts.club : undefined;
  if (club) {
    const at = sortLeague(career.league).findIndex(t => t.name === club);
    if (at >= 0) f.tablePos = ordinal(at + 1);
  }
  return f;
}

// ── Voice ─────────────────────────────────────────────────────────────────

const ENDS_IN_EMOJI = /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[☀-➿️⬀-⯿])\s*$/;

/** The account's own typing: lower case or not, its emoji now and then. Line breaks kept. */
const KEEP = new Set(["L", "W", "HIM", "FT", "HT", "GOAL", "xG", "VAR", "XI", "FPL", "OK", "GOAT", "MOTM", "POTM"]);

function lowerKeep(s: string): string {
  return s.split(/(\s+)/).map(w => (KEEP.has(w.replace(/[^A-Za-z]/g, "")) ? w : w.toLowerCase())).join("");
}

export function personaSpeak(text: string, voice: VoiceProfile, emoji: string[], rng: () => number): string {
  let out = text.split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // A lower-case account types ALL of it in lower case (that is the look),
  // except the words the timeline always shouts: L, W, HIM, FT, xG…
  if (rng() < voice.lowercase) out = lowerKeep(out);
  else out = out.charAt(0).toUpperCase() + out.slice(1);
  if (emoji.length && !ENDS_IN_EMOJI.test(out) && rng() < voice.emoji * 0.6) {
    const e = pick(emoji, rng);
    if (!out.includes(e)) out = `${out} ${e}`;
  }
  return out;
}

/** A poll card for a persona line: question and options resolved, shares made up. */
export function personaPoll(poll: { q: string; options: string[] }, facts: Facts, voice: VoiceProfile, rng: () => number, followers = 100_000): GraphicSpec | undefined {
  const question = resolve(poll.q, facts, voice, rng);
  const options = poll.options.map(o => resolve(o, facts, voice, rng));
  if (/[{}]/.test(question) || options.some(o => !o || /[{}]/.test(o)) || new Set(options).size < options.length) return undefined;
  // Votes: about half a per cent of followers vote (a big page gets tens of thousands).
  const total = Math.max(40, Math.round(followers * (0.003 + rng() * 0.006)));
  return { type: "poll", question, options, votes: shares(rng, options.length).map(p => Math.round((p / 100) * total)) };
}

// ── Engagement ────────────────────────────────────────────────────────────

function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HOT = new Set(["takes", "ranter", "ratio", "expro", "itk", "rivalBanter"]);
/** Pages whose replies are people laughing along, not arguing. */
const BANTER = new Set(["ratio", "meme", "rivalBanter"]);

/**
 * How a post does. Reach is a share of followers that shrinks as an account
 * grows (a small account's friends all see it; a huge one reaches a few per
 * cent), times how big the moment is, times a viral roll that is usually
 * about 1 and now and then snowballs to 10× or more. Then the ratios real
 * posts show: about 1–5% of viewers like, 5–25% of likers repost, a tenth to
 * a quarter of reposts are quotes. Hot takes get far more replies and
 * quotes than likes suggest (the "ratio").
 */
export function engagement(
  a: Pick<MediaAccount, "followers" | "archetype" | "persona">,
  importance: number,
  opts: { aboutYou?: boolean; video?: boolean },
  rng: () => number,
): StoredPost["metrics"] {
  const f = Math.max(50, a.followers);
  const reachRate = f > 5e6 ? 0.035 : f > 1e6 ? 0.055 : f > 2e5 ? 0.09 : f > 2e4 ? 0.16 : f > 2e3 ? 0.35 : 0.9;
  let viral = Math.exp(0.8 * gauss(rng));
  if (importance >= 80) viral *= 1.5;
  if (viral > 2.5 && rng() < 0.45) viral *= 2 + rng() * 4; // the snowball
  let views = f * reachRate * (0.3 + importance / 90) * viral;
  if (opts.aboutYou) views *= 1.5;
  if (opts.video) views *= 1.4;
  views = Math.round(Math.max(views, 40 + rng() * 600));

  const hot = !!a.persona && HOT.has(a.persona);
  const likeRate =
    a.archetype === "meme" || a.archetype === "fan" || a.archetype === "teammate" || a.archetype === "rivalFan" ? 0.03 + rng() * 0.03
    : a.archetype === "club" ? 0.025 + rng() * 0.02
    : a.archetype === "stats" ? 0.015 + rng() * 0.012
    : a.archetype === "pundit" ? 0.012 + rng() * 0.012
    : 0.008 + rng() * 0.01;
  const likes = Math.max(1, Math.round(views * likeRate));
  const repostRate = a.archetype === "insider" || a.archetype === "aggregator" ? 0.15 + rng() * 0.15 : 0.05 + rng() * 0.13;
  const reposts = Math.max(0, Math.round(likes * repostRate));
  const quotes = Math.max(0, Math.round(reposts * (0.08 + rng() * 0.17) * (hot ? 2.5 : 1)));
  const replyRate = (0.03 + rng() * 0.07) * (hot ? 2.5 + rng() * 3 : 1);
  const replies = Math.max(0, Math.round(likes * replyRate));
  return { likes, reposts, replies, views, quotes };
}

// ── Replies ───────────────────────────────────────────────────────────────

interface ReplyGuy { handle: string; name: string; tint: string; tint2: string; followers: number }

/** The reply guys: small invented accounts that only ever turn up in replies. */
const REPLY_GUYS: ReplyGuy[] = [
  { handle: "@SundayLeagueLegend", name: "Sunday League Legend", tint: "#16a34a", tint2: "#bbf7d0", followers: 3_100 },
  { handle: "@xG_is_a_myth", name: "xG is a myth", tint: "#0ea5e9", tint2: "#1e3a8a", followers: 1_900 },
  { handle: "@ballwatcher_99", name: "ballwatcher", tint: "#f59e0b", tint2: "#7c2d12", followers: 820 },
  { handle: "@terrace_poet", name: "the terrace poet", tint: "#a855f7", tint2: "#fbcfe8", followers: 4_400 },
  { handle: "@MumsTheGaffer", name: "Mum's The Gaffer", tint: "#ec4899", tint2: "#fde68a", followers: 2_600 },
  { handle: "@fpl_dreamer", name: "fpl dreamer", tint: "#22c55e", tint2: "#064e3b", followers: 1_200 },
  { handle: "@OneTouchTom", name: "Tom | one touch", tint: "#ef4444", tint2: "#fecaca", followers: 650 },
  { handle: "@TopBinsTara", name: "Tara | top bins", tint: "#14b8a6", tint2: "#ccfbf1", followers: 5_800 },
  { handle: "@moaning_since88", name: "moaning since 88", tint: "#64748b", tint2: "#e2e8f0", followers: 900 },
  { handle: "@HalfTimeOranges", name: "Half Time Oranges", tint: "#fb923c", tint2: "#fff7ed", followers: 2_200 },
  { handle: "@nutmeg_nadia", name: "Nadia 🧦", tint: "#6366f1", tint2: "#e0e7ff", followers: 3_700 },
  { handle: "@ProperFootballPaul", name: "Proper Football Paul", tint: "#78350f", tint2: "#fde68a", followers: 1_500 },
];

/** Reply lines by what the post is about. Slots as the persona lines. */
const REPLIES: Record<string, string[]> = {
  goodYou: [
    "{short} is HIM and i'm tired of pretending he isn't",
    "the way {short} just does this every week 😭",
    "{short} owners eating good tonight 🍽️",
    "who's telling {oppS} defenders they're still looking for him",
    "remember when people said {short} was a project 😂",
    "this is the {short} slander quote tweet graveyard 🪦",
    "sign him to a 10 year contract right now",
    "ball knowledge confirmed. been saying {short} since day one",
    "i need this as my wallpaper",
    "not even his best goal this season tbf",
    "{short} for the Ballon d'Or. i'm serious",
    "the first touch before it 🤌",
    "we don't deserve {short}",
    "{oppS} will be seeing that in their sleep",
    "my dad said he'd never make it. dad?",
    "how is this guy not starting for his country",
    "commentator lost his mind and so did i",
    "put some respect on his name",
    "every week. every single week",
    "he's the reason i renewed my season ticket",
    "the composure 😮‍💨",
    "{short} slander will not be tolerated on this app",
  ],
  badYou: [
    "{short} owes me points 😤",
    "one bad game and the timeline turns. relax",
    "he'll be back next week, always is",
    "{short} fraud watch was always a little early",
    "who's telling him? 😭",
    "this aged badly",
    "deleted? 👀",
    "the hate is wild, he's young",
    "rent free 😂",
    "bench him. just for a week",
    "everyone has off days, calm down",
    "this is why you don't hype players up",
    "he looked tired. play him less",
    "honestly the whole team was poor, not just him",
    "back to the drawing board",
  ],
  goodClub: [
    "{clubS} are BACK 🔥",
    "i said it in august and got laughed at",
    "the rest of the league should be scared",
    "and people wanted the manager out 😂",
    "this team is different this year",
    "great result but let's not get carried away",
    "proper performance that",
    "the midfield ran the game",
    "three points is three points",
    "we go again",
    "this is the team i fell in love with",
  ],
  badClub: [
    "{clubS} fans real quiet today 🤫",
    "not even surprised anymore",
    "the manager has to go. simple",
    "some of them should not be wearing the shirt",
    "hold this L 🫵",
    "this is the third time this season",
    "i want a refund on my season ticket",
    "fraud watch 🚨",
    "embarrassing. absolutely embarrassing",
    "where was the effort?",
    "same mistakes every week",
    "board need to wake up",
    "can't even be angry anymore, just tired",
  ],
  contract: [
    "best news i've had all week",
    "lock him up forever 🔒",
    "{short} staying. the agent can rest now",
    "release clause better be massive",
    "now win us something {short}",
    "W",
  ],
  manager: [
    "about time",
    "they've got this wrong. again",
    "board out next",
    "who's the replacement then?",
    "{clubS} going through managers like socks",
    "give the next one time this time please",
    "the dressing room won this one",
  ],
  transfer: [
    "here comes the 'what does this mean for {short}' thread",
    "fee is mad but he's worth it",
    "{to} fans about to be insufferable",
    "medical? he's 19 he's fine 😂",
    "good business for everyone involved",
    "source?",
    "the agent is getting a new car out of this 😂",
    "{from} fans in shambles",
    "the shirt sales are about to go mad",
  ],
  hotTake: [
    "ratio",
    "worst take i've read all week",
    "this is bait and i'm biting: no",
    "you watched the highlights didn't you",
    "agree but for different reasons",
    "deleted?",
    "who's telling him",
    "screenshot this, we're coming back to it in May",
  ],
  banter: [
    "😭😭😭",
    "not the {clubS} fans in the replies 💀",
    "violation",
    "the disrespect is crazy 😭",
    "admin woke up and chose violence",
    "LMAOOO",
    "bro is NOT stopping 😭",
    "i'm crying at the replies",
    "someone check on {clubS} fans",
    "this account has no chill",
    "the caption 💀",
    "they're not going to like this one",
  ],
  score: [
    "what a game",
    "{homeS} never make it easy",
    "the ref was the best player on the pitch",
    "great game for a neutral 🍿",
    "{awayS} fans where are you",
  ],
  generic: [
    "big if true",
    "the timeline is in shambles",
    "need more of this",
    "W",
    "this sport man",
    "football is back",
  ],
};

function replyMood(post: StoredPost, e: FootballEvent): keyof typeof REPLIES {
  if (post.persona && BANTER.has(post.persona)) return "banter";
  if (post.persona && HOT.has(post.persona)) return "hotTake";
  if (e.tags.includes("contract")) return "contract";
  if (e.tags.includes("manager")) return "manager";
  if (e.tags.includes("transfer")) return "transfer";
  const aboutYou = e.subject.kind === "you";
  if (aboutYou) return isBadNews(e) ? "badYou" : isGoodNews(e) ? "goodYou" : "generic";
  if (isBadNews(e)) return "badClub";
  if (isGoodNews(e)) return "goodClub";
  if (e.facts.homeClub) return "score";
  return "generic";
}

function filled(line: string, facts: Facts): boolean {
  for (const m of Array.from(line.matchAll(/\{([^}|]+)/g))) {
    const v = facts[m[1].trim()];
    if (v === undefined || v === null || v === "") return false;
  }
  return true;
}

/** Up to three replies under a post, liked in falling order. */
export function replyThread(post: StoredPost, e: FootballEvent, facts: Facts, voice: VoiceProfile, rng: () => number): PostReply[] {
  const mood = replyMood(post, e);
  const lines = REPLIES[mood].filter(l => filled(l, facts));
  const n = Math.min(lines.length, post.metrics.replies >= 40 ? 3 : post.metrics.replies >= 8 ? 2 : post.metrics.replies >= 1 ? 1 : 0);
  const out: PostReply[] = [];
  const usedLines = new Set<number>(), usedGuys = new Set<number>();
  let likes = Math.max(1, Math.round(post.metrics.likes * (0.04 + rng() * 0.12)));
  for (let i = 0; i < n; i++) {
    let li = Math.floor(rng() * lines.length), gi = Math.floor(rng() * REPLY_GUYS.length);
    for (let t = 0; t < 8 && usedLines.has(li); t++) li = Math.floor(rng() * lines.length);
    for (let t = 0; t < 8 && usedGuys.has(gi); t++) gi = Math.floor(rng() * REPLY_GUYS.length);
    if (usedLines.has(li) || usedGuys.has(gi)) break;
    usedLines.add(li); usedGuys.add(gi);
    const g = REPLY_GUYS[gi];
    let text = resolve(lines[li], facts, voice, rng).trim();
    if (rng() < 0.6) text = text.toLowerCase();
    out.push({ handle: g.handle, name: g.name, verified: rng() < 0.15, initials: initialsOf(g.name), tint: g.tint, tint2: g.tint2, glyph: "grin", text, likes });
    likes = Math.max(0, Math.round(likes * (0.25 + rng() * 0.4)));
  }
  return out;
}

// ── Quote posts ───────────────────────────────────────────────────────────

const QUOTES: Record<string, Record<string, string[]>> = {
  hype: { goodYou: ["{short} is HIM 😭", "this is the {short} appreciation post", "levels 🥶 {short} different breed"] },
  quiz: { goodYou: ["ball knowledge check: who called {short} first? 🧠👇", "be honest, did you know {short} before this season? 👇"] },
  edits: { goodYou: ["edit incoming 🎧", "this needs a slow-mo edit and i'm doing it"] },
  meme: { goodYou: ["{oppS} defenders after this: 🧍", "absolute cinema 🎬"], badClub: ["{clubS} fans opening the app today 🧍", "this is fine 🔥🐶"] },
  ratio: { badClub: ["imagine posting this after that 😭", "{clubS} admin really pressed send 💀", "ratio + {score} + the disrespect 😭"], badYou: ["'generational' 😭", "who's telling {short}? 💀"] },
  journalist: {
    goodYou: ["Worth saying: this is no fluke. The underlying work has been there for weeks.", "Told you in August."],
    badClub: ["For what it's worth, this has been coming. Nobody inside {clubS} is surprised.", "Understand this result has caused real concern at board level."],
    transfer: ["Understand this was agreed earlier than reported.", "Fair fee. Strong business for both clubs."],
  },
  takes: { goodYou: ["Unpopular opinion: still overrated.", "Calm down. One good game."], badClub: ["Unpopular opinion: they deserve this."] },
  rivalBanter: { badClub: ["😂😂😂😂", "same old {clubS} 🤡"], badYou: ["rent free 😂"] },
};

/**
 * One to three posts quoting the cycle's biggest posts: the hype or quiz
 * page quote-posts your goal (the play tile shows its video), the ratio page
 * and your rival's fans quote your club's bad day, the journalist adds a
 * line to the news.
 */
export function quotePosts(
  posts: { post: StoredPost; event: FootballEvent; facts: Facts }[],
  accounts: MediaAccount[],
  cycleId: string,
  yourClub: string,
): StoredPost[] {
  const rng = rngFor("quotes", cycleId);
  const byPersona = new Map(accounts.filter(a => a.persona).map(a => [a.persona!, a]));
  const out: StoredPost[] = [];
  const quoted = new Set<string>();
  const ranked = [...posts].sort((a, b) => (b.post.metrics.views ?? b.post.metrics.likes) - (a.post.metrics.views ?? a.post.metrics.likes));
  // Who quotes whom: the journalist quotes news, not banter; the edits page
  // quotes a video; the hype pages quote the club, the news or a video.
  const NEWSY = new Set(["club", "league", "competition", "insider", "aggregator", "broadsheet", "tabloid", "stats"]);
  const tryQuote = (who: string[], mood: string, test: (x: { post: StoredPost; event: FootballEvent }) => boolean, newsOnly = false) => {
    const target = ranked.find(x => !quoted.has(x.post.id) && !x.post.quote && test(x)
      && (!newsOnly || NEWSY.has(x.post.author.archetype)));
    if (!target) return;
    const authors = who.map(p => byPersona.get(p)).filter((a): a is MediaAccount => !!a && a.handle !== target.post.author.handle);
    if (!authors.length) return;
    const a = pick(authors, rng);
    const lines = (QUOTES[a.persona!]?.[mood] ?? []).filter(l => filled(l, target.facts));
    if (!lines.length) return;
    quoted.add(target.post.id);
    const p = personaById(a.persona!);
    const text = personaSpeak(resolve(pick(lines, rng), target.facts, a.voice, rng), a.voice, p?.emoji ?? [], rng);
    const g = target.post.graphic as { type?: string; clips?: unknown[]; synth?: unknown[] } | undefined;
    const video = !!g && (g.type === "goalVideo" || g.type === "thumbnail") && ((g.clips?.length ?? 0) + (g.synth?.length ?? 0)) > 0;
    const t = target.post.author;
    const importance = Math.min(95, 40 + Math.log10(1 + (target.post.metrics.views ?? 0)) * 8);
    out.push({
      id: `${cycleId}:quote:${a.id}:${out.length}`,
      at: target.post.at + 6 + Math.floor(rng() * 60),
      author: {
        handle: a.handle, name: a.name, archetype: a.archetype, platform: a.platform, verified: a.verified,
        initials: a.avatar.initials, tint: a.avatar.tint, tint2: a.avatar.tint2, glyph: a.avatar.glyph,
        ...(a.tick ? { tick: a.tick } : {}),
      },
      text,
      metrics: engagement(a, importance, { aboutYou: target.post.aboutYou }, rng),
      eventId: target.post.eventId,
      tags: target.post.tags,
      quote: {
        handle: t.handle, name: t.name, verified: t.verified, ...(t.tick ? { tick: t.tick } : {}),
        initials: t.initials, tint: t.tint, tint2: t.tint2, glyph: t.glyph,
        text: target.post.text, ...(video ? { video: true } : {}),
      },
      ...(target.post.aboutYou ? { aboutYou: true } : {}),
      persona: a.persona,
    });
  };
  const aboutYourClub = (e: FootballEvent) => e.facts.club === yourClub;
  const hasVid = (p: StoredPost) => { const g = p.graphic as { type?: string } | undefined; return g?.type === "goalVideo" || g?.type === "thumbnail"; };
  if (rng() < 0.7) tryQuote(["edits", "hype"], "goodYou", x => x.event.subject.kind === "you" && x.event.tags.includes("goal") && hasVid(x.post));
  tryQuote(["hype", "quiz", "meme"], "goodYou", x => x.event.subject.kind === "you" && isGoodNews(x.event) && x.event.tags.includes("goal"), true);
  if (rng() < 0.75) tryQuote(["ratio", "rivalBanter", "meme"], "badClub", x => aboutYourClub(x.event) && isBadNews(x.event) && x.event.subject.kind !== "you");
  if (rng() < 0.6) tryQuote(["ratio", "rivalBanter"], "badYou", x => x.event.subject.kind === "you" && isBadNews(x.event));
  if (rng() < 0.5) tryQuote(["journalist"], "transfer", x => x.event.tags.includes("transfer"), true);
  if (rng() < 0.4) tryQuote(["journalist", "takes"], "goodYou", x => x.event.subject.kind === "you" && isGoodNews(x.event), true);
  if (rng() < 0.4) tryQuote(["journalist"], "badClub", x => aboutYourClub(x.event) && isBadNews(x.event), true);
  return out;
}

// ── The "For you" order ───────────────────────────────────────────────────

/** Hours between two feed clocks (season×1e6 + week×1e4 + minutes). */
function hoursBetween(at: number, now: number): number {
  const wk = (x: number) => Math.floor(x / 1_000_000) * 52 + Math.floor((x % 1_000_000) / 10_000);
  const weeks = wk(now) - wk(at);
  return Math.max(0, weeks * 168 + ((now % 10_000) - (at % 10_000)) / 60);
}

const kindOf = (p: StoredPost) => p.persona ?? p.author.archetype;

/**
 * The ranked feed. Score = how much it was engaged with (on a log scale, so
 * a 2M-view post beats a 2K one without burying everything), boosted when it
 * is about you, divided by its age (half its pull after about half a day).
 * Then variety: never three in a row from the same kind of account.
 */
export function rankFeed(posts: StoredPost[], now: number): StoredPost[] {
  const score = (p: StoredPost) => {
    const m = p.metrics;
    const eng = Math.log(1 + m.likes) + 0.6 * Math.log(1 + m.reposts) + 0.35 * Math.log(1 + m.replies) + 0.3 * Math.log(1 + (m.quotes ?? 0));
    const boost = (p.aboutYou ? 1.6 : 1) * (p.scope === "club" ? 1.15 : 1) * (p.graphic ? 1.08 : 1) * (p.quote ? 1.05 : 1);
    return (eng + 1) * boost / Math.pow(1 + hoursBetween(p.at, now) / 12, 0.9);
  };
  const pool = posts.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || b.p.at - a.p.at);
  const out: StoredPost[] = [];
  while (pool.length) {
    const k1 = out.length ? kindOf(out[out.length - 1]) : null;
    const k2 = out.length > 1 ? kindOf(out[out.length - 2]) : null;
    let i = pool.findIndex(x => !(k1 && k1 === k2 && kindOf(x.p) === k1));
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0].p);
  }
  return out;
}
