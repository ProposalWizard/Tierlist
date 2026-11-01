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
import { pick, resolve, rngFor, shortClub } from "../grammar";
import { sortLeague } from "../../season";
import { personaById, isBadNews, isGoodNews } from "./personas";
import { hasPlayableVideo, impliesVideo } from "./videoWords";
import { repliesFor } from "./replies";
import { postTone, type Tone } from "./tone";

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
  // v2 slots (templates/twitterMore.ts).
  if (typeof f.us === "number" && typeof f.them === "number" && f.us !== f.them && f.clubS && f.oppS) {
    f.winnerS = f.us > f.them ? f.clubS : f.oppS;
    f.loserS = f.us > f.them ? f.oppS : f.clubS;
  }
  const goals = typeof f.seasonTotal === "number" ? f.seasonTotal : 0;
  const price = Math.min(14, 5 + goals * 0.15 + rng() * 2);
  f.price = price.toFixed(1);
  f.priceNew = (price + 0.1).toFixed(1);
  f.priceDown = (price - 0.1).toFixed(1);
  f.ticket = `£${38 + Math.floor(rng() * 70)}`;
  f.refName = pick(REFEREES, rng);
  f.cards = (3 + rng() * 2.6).toFixed(1);
  f.yrs = 3 + Math.floor(rng() * 40);
  f.rate10 = pick(["8", "8.5", "9", "9.5", "10"], rng);
  f.pct = 55 + Math.floor(rng() * 45);
  f.transfersIn = `${20 + Math.floor(rng() * 400)}K`;
  return f;
}

/** Invented referees for the ref-watch page (no real official). */
const REFEREES = ["Gareth Pennock", "Simon Treadwell", "Mark Dalloway", "Lee Ashcombe", "Paul Wrenfield", "Darren Kibble", "Craig Haldane", "Neil Upshaw"];

/** A TikTok post's sound line, picked from its account's sounds. */
export function soundFor(personaId: string | undefined, rng: () => number): string | undefined {
  const p = personaId ? personaById(personaId) : undefined;
  return p?.sounds?.length ? pick(p.sounds, rng) : undefined;
}

/**
 * Poll shares that add up to exactly 100 (the old meme poll's "Who's to
 * blame?" showed 34% + 21% + 44% = 99%). Votes are made whole multiples of
 * one per cent of the total, so the card's rounded percentages are exact.
 */
export function evenPoll(votes: number[]): number[] {
  const total = votes.reduce((a, b) => a + b, 0);
  if (total <= 0 || votes.length < 2) return votes;
  const pct = votes.map(x => Math.floor((x / total) * 100));
  const rem = votes.map((x, i) => (x / total) * 100 - pct[i]);
  let left = 100 - pct.reduce((a, b) => a + b, 0);
  const order = rem.map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) pct[order[k][1]]++;
  const unit = Math.max(1, Math.round(total / 100));
  return pct.map(p => p * unit);
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
  const total = Math.max(100, Math.round(followers * (0.003 + rng() * 0.006)));
  return { type: "poll", question, options, votes: evenPoll(shares(rng, options.length).map(p => Math.round((p / 100) * total))) };
}

// ── Engagement ────────────────────────────────────────────────────────────

function gauss(rng: () => number): number {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HOT = new Set(["takes", "ranter", "ratio", "expro", "itk", "rivalBanter"]);

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

// The reply guys, the reply lines and how a thread is built now live in
// replies.ts / replyLines.ts / tone.ts (round 4: replies agree with what the
// post is about and with who is replying).

function filled(line: string, facts: Facts): boolean {
  for (const m of Array.from(line.matchAll(/\{([^}|]+)/g))) {
    const v = facts[m[1].trim()];
    if (v === undefined || v === null || v === "") return false;
  }
  return true;
}

/** The winning and losing side's short names, when the post is about a result. */
function sides(facts: Facts, e: FootballEvent): Facts {
  const f: Facts = { ...facts };
  const club = typeof f.club === "string" ? shortClub(f.club) : undefined;
  const opp = typeof f.opponent === "string" ? shortClub(f.opponent) : undefined;
  if (club) f.clubS ??= club;
  if (opp) f.oppS ??= opp;
  if (club && opp && typeof f.us === "number" && typeof f.them === "number" && f.us !== f.them) {
    f.winnerS = f.us > f.them ? club : opp;
    f.loserS = f.us > f.them ? opp : club;
  } else if (club && (isBadNews(e) || isGoodNews(e)) && !(typeof f.us === "number" && f.us === f.them)) {
    // No score (a career moment, a run): the club had the bad or the good day.
    if (isBadNews(e)) { f.loserS = club; if (opp) f.winnerS = opp; }
    else { f.winnerS = club; if (opp) f.loserS = opp; }
  } else {
    delete f.winnerS; delete f.loserS;
  }
  return f;
}

/** The replies under a post (replies.ts): by its tone, its sides and its platform. */
export function replyThread(
  post: StoredPost, _e: FootballEvent, facts: Facts, voice: VoiceProfile, rng: () => number,
  /** Lines already used under this cycle's other posts: never the same reply twice. */
  cycleUsed: Set<string> = new Set(),
  /** Lines used under any post in the last few weeks (feed.ts FT_REPEAT_WEEKS), kept out too. */
  recent: Set<string> = new Set(),
): PostReply[] {
  return repliesFor(post, facts, voice, rng, { cycleUsed, recent });
}

// ── Quote posts ───────────────────────────────────────────────────────────

const QUOTES: Record<string, Record<string, string[]>> = {
  hype: { goodYou: ["{short} is HIM 😭", "this is the {short} appreciation post", "levels 🥶 {short} different breed", "say it with me: {short} is HIM", "{short} doing {short} things again 👑", "the rest of the league is playing for second best young player 😮‍💨"] },
  quiz: { goodYou: ["ball knowledge check: who called {short} first? 🧠👇", "be honest, did you know {short} before this season? 👇", "rate {short}'s season so far out of 10 👇", "one word for {short} right now 👇"] },
  edits: { goodYouVideo: ["edit incoming 🎧", "this needs a slow-mo edit and i'm doing it", "saving this clip for the end-of-season edit 📈", "the edit writes itself 🥶"] },
  pov: { goodYouVideo: ["pov: you watched this live 😭", "pov: you're the defender in this video 🫨", "pov: this is on loop in your head all week 🔁"] },
  ranker: { goodYouVideo: ["rate this goal 1-10 👇", "top 3 of the season? rate it 👇", "where does this rank? 👇"] },
  commentBot: { goodYou: ["the replies under this are undefeated 💬", "top comment on this is going to be framed 💬"], badClub: ["the comment section under this is a war zone 💬", "{loserS} fans in the comments right now: 🫠"] },
  meme: { goodYou: ["{oppS} defenders after this: 🧍", "absolute cinema 🎬", "{short} woke up and chose violence"], badClub: ["{loserS} fans opening the app today 🧍", "this is fine 🔥🐶", "{loserS} fans reading this: 🫠"] },
  ratio: { badClub: ["imagine posting this after that 😭", "{loserS} admin really pressed send 💀", "ratio + the disrespect 😭", "{loserS} you have to log off 😭"], badYou: ["'generational' 😭", "who's telling {short}? 💀", "{short} stans are quiet today 🤫"] },
  journalist: {
    goodYou: ["Worth saying: this is no fluke. The underlying work has been there for weeks.", "Told you in August.", "The most important thing here is how calm he looks doing it."],
    badClub: ["For what it's worth, this has been coming. Nobody inside {clubS} is surprised.", "Understand this result has caused real concern at board level.", "This is the third warning sign this season. The board know it."],
    transfer: ["Understand this was agreed earlier than reported.", "Fair fee. Strong business for both clubs.", "The key detail is the add-ons. They are achievable."],
  },
  takes: { goodYou: ["Unpopular opinion: still overrated.", "Calm down. One good game.", "Hot take: the goal was the keeper's fault."], badClub: ["Unpopular opinion: they deserve this.", "Hot take: this is the real {loserS}."] },
  rivalBanter: { badClub: ["😂😂😂😂", "same old {loserS} 🤡", "framing this 😂"], badYou: ["rent free 😂", "where's the hype now 😂"] },
  tier2: { transfer: ["Correct. Agreement was reached this week. More to follow.", "Can confirm. Personal terms done some time ago."] },
  rumourMill: { transfer: ["🗞️ as we reported days ago (per reports) 👀", "🗞️ big if true. we said it first-ish 👀"] },
};

/**
 * What a quote line may quote (round 4: a quote agrees with the post it
 * quotes): by the quoted post's tone (tone.ts). Before, the "transfer"
 * lines also quoted a new contract ("Fair fee. Strong business for both
 * clubs.") because a contract is tagged "transfer" too.
 */
const QUOTE_TARGETS: Record<string, Tone[]> = {
  goodYouVideo: ["goal", "skill"],
  goodYou: ["goal", "skill", "praise", "award"],
  badClub: ["clubLoss", "mock", "relegation"],
  badYou: ["badGame", "mock"],
  transfer: ["transfer", "rumour"],
};

/**
 * One to three posts quoting the cycle's biggest posts: the hype or quiz
 * page quote-posts your goal (its video plays inside the quote),
 * the ratio page and your rival's fans quote your club's bad day, the
 * journalist adds a line to the news.
 */
export function quotePosts(
  posts: { post: StoredPost; event: FootballEvent; facts: Facts }[],
  accounts: MediaAccount[],
  cycleId: string,
  yourClub: string,
  /** Quote lines used lately (kept out); new ones are added to it. */
  recent: Set<string> = new Set(),
  /** Round 4: give each quote its own replies (reply lines used this cycle / lately). */
  replies?: { cycleUsed: Set<string>; recent: Set<string> },
): StoredPost[] {
  const rng = rngFor("quotes", cycleId);
  const byPersona = new Map(accounts.filter(a => a.persona).map(a => [a.persona!, a]));
  const out: StoredPost[] = [];
  const quoted = new Set<string>();
  const ranked = [...posts].sort((a, b) => (b.post.metrics.views ?? b.post.metrics.likes) - (a.post.metrics.views ?? a.post.metrics.likes));
  // Who quotes whom: the journalist quotes news, not banter; the edits page
  // quotes a video; the hype pages quote the club, the news or a video.
  const NEWSY = new Set(["club", "league", "competition", "insider", "aggregator", "broadsheet", "tabloid", "stats"]);
  const tryQuote = (who: string[], mood: string, test: (x: { post: StoredPost; event: FootballEvent; facts?: Facts }) => boolean, newsOnly = false) => {
    const target = ranked.find(x => !quoted.has(x.post.id) && !x.post.quote && test(x)
      && (!newsOnly || NEWSY.has(x.post.author.archetype))
      && (!replies || !QUOTE_TARGETS[mood] || QUOTE_TARGETS[mood].includes(postTone(x.post)))
      // A quote about you quotes a post that names you (not the week's scoreline).
      && (!replies || !mood.includes("You") || typeof x.facts?.short !== "string" || x.post.text.toLowerCase().includes(String(x.facts.short).toLowerCase())));
    if (!target) return;
    const authors = who.map(p => byPersona.get(p)).filter((a): a is MediaAccount => !!a && a.handle !== target.post.author.handle);
    if (!authors.length) return;
    const a = pick(authors, rng);
    const f = sides(target.facts, target.event);
    const video = hasPlayableVideo(target.post);
    // A quote that talks about a video only quotes a post that has one (and carries it).
    const lines = (QUOTES[a.persona!]?.[mood] ?? []).filter(l => filled(l, f) && !recent.has(`${a.persona}|${l}`) && (video || !impliesVideo(l))
      // A line about "the goal" only quotes a goal.
      && (!replies || !/\bgoal\b/i.test(l) || target.event.tags.includes("goal")));
    if (!lines.length) return;
    quoted.add(target.post.id);
    const p = personaById(a.persona!);
    const line = pick(lines, rng);
    recent.add(`${a.persona}|${line}`);
    const text = personaSpeak(resolve(line, f, a.voice, rng), a.voice, p?.emoji ?? [], rng);
    const t = target.post.author;
    const importance = Math.min(95, 40 + Math.log10(1 + (target.post.metrics.views ?? 0)) * 8);
    const made: StoredPost = {
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
        ...(video ? { graphic: target.post.graphic } : {}),
      },
      ...(target.post.aboutYou ? { aboutYou: true } : {}),
      persona: a.persona,
      // A TikTok page quoting a goal is a stitch: the video, its caption, its sound.
      ...(a.platform === "tiktok" && video ? { sound: soundFor(a.persona, rng) } : {}),
    };
    if (replies) {
      const thread = repliesFor(made, target.facts, a.voice, rngFor("quote-replies", made.id), replies);
      if (thread.length) made.thread = thread;
    }
    out.push(made);
  };
  const aboutYourClub = (e: FootballEvent) => e.facts.club === yourClub;
  if (rng() < 0.7) tryQuote(["edits", "pov", "ranker"], "goodYouVideo", x => x.event.subject.kind === "you" && x.event.tags.includes("goal") && hasPlayableVideo(x.post));
  tryQuote(["hype", "quiz", "meme", "commentBot"], "goodYou", x => x.event.subject.kind === "you" && isGoodNews(x.event) && x.event.tags.includes("goal"), true);
  if (rng() < 0.75) tryQuote(["ratio", "rivalBanter", "meme", "commentBot"], "badClub", x => aboutYourClub(x.event) && isBadNews(x.event) && x.event.subject.kind !== "you");
  if (rng() < 0.6) tryQuote(["ratio", "rivalBanter"], "badYou", x => x.event.subject.kind === "you" && isBadNews(x.event));
  if (rng() < 0.5) tryQuote(["journalist", "tier2", "rumourMill"], "transfer", x => x.event.tags.includes("transfer"), true);
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
 * is about you, divided by its age (about a fifth of its pull after a day,
 * a fortieth after a week), counted from the newest post.
 * Then variety: never three in a row from the same kind of account.
 */
export function rankFeed(posts: StoredPost[], now: number): StoredPost[] {
  // Age is counted from the newest post shown, not from the career clock:
  // the career has already moved on a week by the time the feed is read,
  // which made every post look old and let a week-old viral post win.
  // Per tab (your club's news, the rest of the league): the league's weekly
  // pass is stamped later than your match, and must not make it look old.
  const newestOf = (scope: string) => posts.reduce((m, p) => ((p.scope ?? "club") === scope ? Math.max(m, p.at) : m), 0);
  const refs: Record<string, number> = { club: newestOf("club") || now, league: newestOf("league") || now };
  const refFor = (p: StoredPost) => Math.min(now, refs[p.scope ?? "club"] ?? now);
  const score = (p: StoredPost) => {
    const m = p.metrics;
    const eng = Math.log(1 + m.likes) + 0.6 * Math.log(1 + m.reposts) + 0.35 * Math.log(1 + m.replies) + 0.3 * Math.log(1 + (m.quotes ?? 0));
    const boost = (p.aboutYou ? 1.6 : 1) * (p.scope === "club" ? 1.15 : 1) * (p.graphic ? 1.08 : 1) * (p.quote ? 1.05 : 1);
    return (eng + 1) * boost / Math.pow(1 + hoursBetween(p.at, refFor(p)) / 12, 1.4);
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
