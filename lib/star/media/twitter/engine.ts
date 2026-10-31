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
import { hasPlayableVideo, impliesVideo } from "./videoWords";

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

/**
 * Reply lines by what the post is about. Slots as the persona lines, plus
 * {loserS}/{winnerS} (worked out here, so a banter reply always laughs at
 * the side that lost: Leo saw "someone check on Arsenal fans" under a meme
 * about Arsenal WINNING). "…Video" moods are only used under a post that
 * shows a playable video (Leo's rule: no words about a video you can't watch).
 */
const REPLIES: Record<string, string[]> = {
  goodYou: [
    "{short} is HIM and i'm tired of pretending he isn't",
    "the way {short} just does this every week 😭",
    "{short} owners eating good tonight 🍽️",
    "remember when people said {short} was a project 😂",
    "this is the {short} slander graveyard 🪦",
    "sign him to a 10 year contract right now",
    "ball knowledge confirmed. been saying {short} since day one",
    "{short} for the Ballon d'Or. i'm serious",
    "we don't deserve {short}",
    "{oppS} will be seeing him in their sleep",
    "my dad said he'd never make it. dad?",
    "how is this guy not starting for his country",
    "put some respect on his name",
    "every week. every single week",
    "he's the reason i renewed my season ticket",
    "{short} slander will not be tolerated on this app",
    "the composure at his age is not normal",
    "18 years old. EIGHTEEN 😭",
    "his agent's phone must be melting",
    "tell me a better young player. i'll wait",
    "name a more reliable player. you can't",
    "not even surprised anymore, he's just that guy",
    "{short} szn never ends",
    "proper footballer. no notes",
    "the {clubS} academy should be getting a statue",
    "he plays like he's been doing this for 15 years",
    "mark my words: captain within two seasons",
  ],
  goodYouVideo: [
    "the first touch before it 🤌",
    "commentator lost his mind and so did i",
    "i've watched this 40 times",
    "the keeper didn't even move 😭",
    "turn the sound up for this one",
    "that angle makes it even better",
    "the slow-mo at the end 😮‍💨",
    "who's editing these, they deserve a raise",
    "on loop. every day. forever",
    "the defender's face 😭😭",
    "the way the net moved 🤌",
    "i need this as my phone background",
    "{oppS} fans are not watching this one 😂",
    "rate it 10 and move on",
    "not even his best one this season tbf",
    "goal of the season. don't argue",
    "watch his head before he shoots. scanning 🧠",
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
    "the service to him was awful tbf",
    "18 years old and people want him perfect every week",
    "even Messi had bad games lads",
    "touch was off all day, it happens",
    "he'll score two next week and you'll all be back",
    "manager needs to protect him more",
    "not his day. move on",
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
    "{oppS} were never in it",
    "the subs changed it",
    "i'm not getting excited. (i'm very excited)",
    "{clubS} are building something here",
    "the away fans were brilliant again",
    "if we keep this up we're going up the table quick",
    "best we've played all season",
    "the manager deserves credit for that",
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
    "the defending was a joke",
    "no plan b. never is",
    "we miss our best players and fall apart",
    "january can't come soon enough",
    "{oppS} wanted it more. simple",
    "the set pieces are killing us",
    "honestly just glad it's over",
  ],
  contract: [
    "best news i've had all week",
    "lock him up forever 🔒",
    "{short} staying. the agent can rest now",
    "release clause better be massive",
    "now win us something {short}",
    "W",
    "loyalty. love to see it",
    "the rest of the league in shambles",
    "deserves every penny",
    "best piece of business all year",
  ],
  manager: [
    "about time",
    "they've got this wrong. again",
    "board out next",
    "who's the replacement then?",
    "{clubS} going through managers like socks",
    "give the next one time this time please",
    "the dressing room won this one",
    "never liked the appointment from day one",
    "sad way for it to end tbf",
    "the players should be looking at themselves",
  ],
  managerIn: [
    "give him time. please",
    "decent appointment this",
    "not who i wanted but let's see",
    "first job: sort the defence out",
    "welcome to the madhouse, gaffer",
    "let's give him a fair go",
    "interesting one. could work",
    "he'll need a january window",
  ],
  transfer: [
    "fee is mad but he's worth it",
    "{to} fans about to be insufferable",
    "good business for everyone involved",
    "source?",
    "the agent is getting a new car out of this 😂",
    "{from} fans in shambles",
    "the shirt sales are about to go mad",
    "{to} have got a player",
    "sad to see him go tbh",
    "what a signing",
  ],
  hotTake: [
    "ratio",
    "worst take i've read all week",
    "this is bait and i'm biting: no",
    "you watched one game didn't you",
    "agree but for different reasons",
    "deleted?",
    "who's telling him",
    "screenshot this, we're coming back to it in May",
    "the confidence of a man who's never been right",
    "bait. reported. blocked",
    "you're not even wrong, just annoying",
    "say it again, i dare you",
  ],
  banter: [
    "😭😭😭",
    "not the {loserS} fans in the replies 💀",
    "violation",
    "the disrespect is crazy 😭",
    "admin woke up and chose violence",
    "LMAOOO",
    "bro is NOT stopping 😭",
    "i'm crying at the replies",
    "someone check on {loserS} fans",
    "this account has no chill",
    "the caption 💀",
    "{loserS} fans are not going to like this one",
    "{winnerS} fans tagging every {loserS} fan they know 😂",
    "screenshotted and sent to the group chat",
    "the accuracy 😭",
    "i felt this one",
    "{loserS} fans pretending they didn't see this",
    "brutal. accurate. brutal",
  ],
  score: [
    "what a game",
    "{homeS} never make it easy",
    "great game for a neutral 🍿",
    "{awayS} fans where are you",
    "didn't see that coming",
    "the league is mad this year",
    "fair result tbh",
    "that's a big three points",
  ],
  generic: [
    "big if true",
    "the timeline is in shambles",
    "need more of this",
    "W",
    "this sport man",
    "football is back",
    "can't wait for the weekend",
    "following for more of this",
    "you love to see it",
    "absolute scenes",
  ],
};

function replyMood(post: StoredPost, e: FootballEvent, video: boolean): keyof typeof REPLIES {
  // Meme pages and rival fans are laughing at somebody: their replies laugh along.
  if ((post.persona && BANTER.has(post.persona)) || post.author.archetype === "meme" || post.author.archetype === "rivalFan") return "banter";
  if (post.persona && HOT.has(post.persona)) return "hotTake";
  if (e.tags.includes("contract")) return "contract";
  if (e.id === "manager-in") return "managerIn";
  if (e.tags.includes("manager")) return "manager";
  if (e.tags.includes("transfer")) return "transfer";
  const aboutYou = e.subject.kind === "you";
  if (aboutYou) return isBadNews(e) ? "badYou" : isGoodNews(e) ? (video ? "goodYouVideo" : "goodYou") : "generic";
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

/** Up to three replies under a post, liked in falling order. */
export function replyThread(
  post: StoredPost, e: FootballEvent, facts: Facts, voice: VoiceProfile, rng: () => number,
  /** Lines already used under this cycle's other posts: never the same reply twice. */
  cycleUsed: Set<string> = new Set(),
  /** Lines used under any post in the last few weeks (feed.ts FT_REPEAT_WEEKS), kept out too. */
  recent: Set<string> = new Set(),
): PostReply[] {
  const video = hasPlayableVideo(post);
  const mood = replyMood(post, e, video);
  const f = sides(facts, e);
  const lines = REPLIES[mood].filter(l => filled(l, f) && !cycleUsed.has(l) && !recent.has(l) && (video || !impliesVideo(l)));
  const n = Math.min(lines.length, post.metrics.replies >= 40 ? 3 : post.metrics.replies >= 8 ? 2 : post.metrics.replies >= 1 ? 1 : 0);
  const out: PostReply[] = [];
  const usedLines = new Set<number>(), usedGuys = new Set<number>();
  let likes = Math.max(1, Math.round(post.metrics.likes * (0.04 + rng() * 0.12)));
  for (let i = 0; i < n; i++) {
    let li = Math.floor(rng() * lines.length), gi = Math.floor(rng() * REPLY_GUYS.length);
    for (let t = 0; t < 8 && usedLines.has(li); t++) li = Math.floor(rng() * lines.length);
    for (let t = 0; t < 8 && usedGuys.has(gi); t++) gi = Math.floor(rng() * REPLY_GUYS.length);
    if (usedLines.has(li) || usedGuys.has(gi)) break;
    usedLines.add(li); usedGuys.add(gi); cycleUsed.add(lines[li]);
    const g = REPLY_GUYS[gi];
    let text = resolve(lines[li], f, voice, rng).trim();
    if (rng() < 0.6) text = text.toLowerCase();
    out.push({ handle: g.handle, name: g.name, verified: rng() < 0.15, initials: initialsOf(g.name), tint: g.tint, tint2: g.tint2, glyph: "grin", text, likes });
    likes = Math.max(0, Math.round(likes * (0.25 + rng() * 0.4)));
  }
  return out;
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
    const f = sides(target.facts, target.event);
    const video = hasPlayableVideo(target.post);
    // A quote that talks about a video only quotes a post that has one (and carries it).
    const lines = (QUOTES[a.persona!]?.[mood] ?? []).filter(l => filled(l, f) && !recent.has(`${a.persona}|${l}`) && (video || !impliesVideo(l)));
    if (!lines.length) return;
    quoted.add(target.post.id);
    const p = personaById(a.persona!);
    const line = pick(lines, rng);
    recent.add(`${a.persona}|${line}`);
    const text = personaSpeak(resolve(line, f, a.voice, rng), a.voice, p?.emoji ?? [], rng);
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
        ...(video ? { graphic: target.post.graphic } : {}),
      },
      ...(target.post.aboutYou ? { aboutYou: true } : {}),
      persona: a.persona,
      // A TikTok page quoting a goal is a stitch: the video, its caption, its sound.
      ...(a.platform === "tiktok" && video ? { sound: soundFor(a.persona, rng) } : {}),
    });
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
