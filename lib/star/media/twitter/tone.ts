/**
 * WHAT A POST IS ABOUT, AND WHAT A REPLY MAY SAY UNDER IT
 * (Leo, 31 Oct 2026, round 4: "make the replies make sense lol why am i
 * seeing an appreciation post and the replies are like 'thats a violation'").
 *
 * The old reply pass picked its lines by WHO posted: every meme-type account
 * (the hype page, the quiz page and the TikTok pages are all "meme" accounts)
 * got the banter lines, so "he's HIM 😭" was answered with "violation" and
 * "the accuracy 😭". Now every post gets a tone from what it is about and who
 * wrote it, and every reply line lives under the tones it fits
 * (twitter/replies.ts). Works from the stored post alone, so the tests and
 * the audit script can read any saved feed the same way.
 *
 * Football Twitter only (switch part "footballTwitter").
 */
import type { StoredPost } from "../types";
import { isBadNews, isGoodNews } from "./personas";

export type Tone =
  | "goal"        // your goal
  | "skill"       // a moment that embarrassed somebody: a screamer, a chip, a meme page on your goal
  | "praise"      // about you, a good day that is not a goal: star man, form, an appreciation post
  | "award"       // an award or a vote you won
  | "milestone"   // debut, call-up, a round number
  | "badGame"     // about you, a bad day
  | "clubWin" | "clubLoss" | "draw"
  | "trophy"      // a trophy, a title, a final, Europe
  | "relegation"
  | "transfer" | "rumour" | "contract"
  | "managerOut" | "managerIn"
  | "farewell"    // a player retiring or leaving
  | "mock"        // a joke page or rival laughing at someone's bad day
  | "cope"        // a rival account on your good day
  | "meme"        // a joke post with nobody losing
  | "hotTake"
  | "poll"
  | "stats"
  | "scandal"
  | "player"      // a player's own post (yours or a team-mate's)
  | "snub"        // you missed out on an award
  | "kit"         // a kit leak
  | "ref"         // a referee / VAR moan
  | "quiz"        // a question for the replies ("rate his season", "build your XI")
  | "tickets"     // a ticket-price moan
  | "news";

export const TONES: Tone[] = [
  "goal", "skill", "praise", "award", "milestone", "badGame", "clubWin", "clubLoss", "draw", "trophy",
  "relegation", "transfer", "rumour", "contract", "managerOut", "managerIn", "farewell", "mock", "cope",
  "meme", "hotTake", "poll", "stats", "scandal", "player", "snub", "kit", "ref", "quiz", "tickets", "news",
];

const SKILL_IDS = new Set(["screamer", "chip", "special-goal", "scored-them-all", "five-goals", "four-goals"]);
const RUMOUR_WORDS = /\binterest\b|nothing agreed|monitoring|being looked at|considering|according to|reportedly|hearing\b|could\b|keeping an eye|the situation/i;
const AWARD_IDS = new Set(["award-won", "ballon-dor", "potm-won"]);
const DRAW_IDS = new Set(["draw", "goalless", "equaliser"]);
const TROPHY_IDS = new Set(["champions", "trophy", "title", "into-the-final", "qualified", "into-europe", "through", "european-night"]);
const FAREWELL_IDS = new Set(["legend-retires", "teammate-retires"]);
const MILESTONE_IDS = new Set(["debut", "club-debut", "first-call-up", "call-up", "international-cap", "appearance-milestone", "club-appearance-milestone", "hall-record"]);
const MOCKERS = new Set(["ratio", "rivalBanter", "meme", "commentBot", "sundayLeague", "nostalgia"]);
const RIVALS = new Set(["ratio", "rivalBanter"]);
const JOKERS = new Set(["meme", "commentBot", "sundayLeague", "matchday", "nostalgia"]);
const STATS = new Set(["xg", "facts", "rater", "priceBot", "history", "fantasy", "odds"]);

/** The tone of a post: what it is about, as the person reading it would take it. */
export function postTone(p: Pick<StoredPost, "eventId" | "tags" | "persona" | "author" | "aboutYou" | "graphic" | "text">): Tone {
  const e = { id: p.eventId, tags: p.tags };
  const bad = isBadNews(e as never), good = isGoodNews(e as never);
  const persona = p.persona ?? "";
  const arch = p.author.archetype;
  const you = !!p.aboutYou;
  if (p.graphic && (p.graphic.type === "poll" || p.graphic.type === "gotmPoll")) return "poll";
  if (p.eventId.startsWith("casino")) return "scandal";
  if (persona === "kitLeaks") return "kit";
  if (persona === "ticketMoan") return "tickets";
  // The quiz page asks the replies a question: they answer it.
  if (persona === "quiz" && !p.tags.includes("transfer") && !p.tags.includes("manager")) return "quiz";
  if (persona === "ref" || persona === "refWatch") return "ref";
  if (p.eventId === "ballon-dor-missed") return persona === "takes" || persona === "expro" ? "hotTake" : "snub";
  if (persona === "takes" || persona === "expro" || (persona === "ranter" && !bad)) return "hotTake";
  const mocker = MOCKERS.has(persona) || (!persona && (arch === "meme" || arch === "rivalFan"));
  if (bad && mocker) return "mock";
  if (good && (RIVALS.has(persona) || arch === "rivalFan")) return "cope";
  // A "deal done" post is transfer news; one that only says there is interest is a rumour.
  if (p.eventId === "transfer-done" || p.eventId === "unveiling" || p.eventId === "farewell") return persona === "itk" || persona === "rumourMill" || RUMOUR_WORDS.test(p.text) ? "rumour" : "transfer";
  if (FAREWELL_IDS.has(p.eventId)) return "farewell";
  if (p.tags.includes("contract") || p.eventId === "contract-signed") return RUMOUR_WORDS.test(p.text) && !/\bsign(s|ed)\b/i.test(p.text) ? "rumour" : "contract";
  if (p.eventId === "manager-in") return JOKERS.has(persona) || (!persona && arch === "meme") ? "meme" : "managerIn";
  if (p.tags.includes("manager")) return JOKERS.has(persona) || (!persona && arch === "meme") ? "meme" : "managerOut";
  if (p.tags.includes("rumour") || p.tags.includes("transfer")) return "rumour";
  if (p.eventId === "relegated") return "relegation";
  if (arch === "teammate") return bad ? "badGame" : "player";
  if (bad) return you ? "badGame" : "clubLoss";
  if (you && good && (JOKERS.has(persona) || (!persona && arch === "meme"))) return p.tags.includes("goal") ? "skill" : "meme";
  if (AWARD_IDS.has(p.eventId)) return you ? "award" : "news";
  if (TROPHY_IDS.has(p.eventId) || p.tags.includes("trophy")) return "trophy";
  // A numbers account (a price rise, a stat, the odds) gets numbers replies, not "violation".
  if (STATS.has(persona) || arch === "stats") return "stats";
  if (you && good && p.tags.includes("goal")) return SKILL_IDS.has(p.eventId) ? "skill" : "goal";
  if (MILESTONE_IDS.has(p.eventId) || p.tags.includes("milestone") || p.tags.includes("debut")) return you ? "milestone" : "news";
  if (you && good) return p.tags.includes("goal") ? (SKILL_IDS.has(p.eventId) ? "skill" : "goal") : "praise";
  if (JOKERS.has(persona) || (!persona && arch === "meme")) return "meme";
  if (DRAW_IDS.has(p.eventId)) return "draw";
  if (good) return "clubWin";
  if (you) return "praise";
  return "news";
}

/**
 * Which reply tones may sit under a post of each tone. A reply line is
 * filed under exactly one tone (replies.ts); this is the looser rule the
 * audit reads: a reply about the goal is fine under a skill post, a "W"
 * for a new deal is fine under the contract news, and so on.
 */
export const FITS: Record<Tone, Tone[]> = {
  goal: ["goal", "praise", "skill"],
  skill: ["skill", "goal", "praise"],
  praise: ["praise", "goal"],
  award: ["award", "praise"],
  milestone: ["milestone", "praise"],
  badGame: ["badGame"],
  clubWin: ["clubWin"],
  clubLoss: ["clubLoss"],
  draw: ["draw"],
  trophy: ["trophy", "clubWin"],
  relegation: ["relegation", "clubLoss"],
  transfer: ["transfer"],
  rumour: ["rumour", "transfer"],
  contract: ["contract"],
  managerOut: ["managerOut"],
  managerIn: ["managerIn"],
  farewell: ["farewell"],
  mock: ["mock", "meme"],
  cope: ["cope"],
  meme: ["meme"],
  hotTake: ["hotTake"],
  poll: ["poll"],
  stats: ["stats"],
  scandal: ["scandal"],
  player: ["player", "praise"],
  snub: ["snub"],
  kit: ["kit"],
  quiz: ["quiz"],
  tickets: ["tickets"],
  ref: ["ref"],
  news: ["news"],
};

/** Is a reply of tone `reply` all right under a post of tone `post`? */
export function replyFits(post: Tone, reply: string | undefined): boolean {
  return !!reply && (FITS[post] as string[]).includes(reply);
}
