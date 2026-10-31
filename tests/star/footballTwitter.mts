/**
 * FOOTBALL TWITTER (Leo's switch part "footballTwitter", lib/star/media/twitter/).
 *
 * 1. Switch off: the feed is byte for byte what it was before this change
 *    (the fingerprints below were taken from the code before it existed).
 * 2. Switch on: 30+ invented accounts, no real names, no holes in any line,
 *    believable numbers, haters after bad days, hype after good ones,
 *    replies and quotes, and a ranked feed with variety. Seeded: the same
 *    career makes the same feed twice.
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { seededRun, richRun, fingerprint } from "../../scripts/football-twitter/run.mts";
import { buildRoster } from "../../lib/star/media/accounts";
import { feedFor, mediaOf } from "../../lib/star/media/feed";
import { allTemplates } from "../../lib/star/media/templates";
import { TWITTER_TEMPLATES } from "../../lib/star/media/templates/twitter";
import { PERSONAS } from "../../lib/star/media/twitter/personas";
import { engagement, rankFeed } from "../../lib/star/media/twitter/engine";
import { rngFor } from "../../lib/star/media/grammar";
import type { StoredPost } from "../../lib/star/media/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. Off = exactly as before ─────────────────────────────────────────────
setMediaUpdate({ footballTwitter: false });
// Taken from the code at 0288435b (before Football Twitter), same seeds.
check(fingerprint(seededRun(14, 4242)) === "345a560373b63a7844f6352d87c45f5b9690dc8f6dd0a2fc11844b31300f3fa1", "switch off: 14-match feed differs from before");
check(fingerprint(seededRun(30, 99)) === "75e7e747b2c77e028a567d4df1b845dd2425349b33d27da5cfe9aa89073f9176", "switch off: 30-match feed differs from before");
const offCareer = seededRun(4, 7);
check(!buildRoster(offCareer).some(a => a.persona || a.tick), "switch off: a persona account or tick in the cast");
check(!allTemplates().some(t => t.persona), "switch off: persona lines in the template list");
check(!mediaOf(offCareer).posts.some(p => p.thread || p.quote || p.metrics.views !== undefined || p.author.tick), "switch off: a post has Football Twitter fields");

// ── 2. On ──────────────────────────────────────────────────────────────────
setMediaUpdate({ footballTwitter: true });
const c = richRun(14, 4242);
const roster = buildRoster(c);
const personas = roster.filter(a => a.persona && a.archetype !== "club");
check(personas.length >= 30, `at least 30 invented accounts (${personas.length})`);
check(PERSONAS.length >= 30, `at least 30 personas defined (${PERSONAS.length})`);
check(new Set(roster.map(a => a.handle)).size === roster.length, "two accounts share a handle");
check(roster.filter(a => a.archetype === "club").every(a => a.tick === "gold"), "a club account without a gold tick");
check(TWITTER_TEMPLATES.length >= 250, `a big phrase bank (${TWITTER_TEMPLATES.length} lines)`);
check(new Set(TWITTER_TEMPLATES.map(t => t.id)).size === TWITTER_TEMPLATES.length, "two persona lines share an id");
for (const p of PERSONAS) check(TWITTER_TEMPLATES.some(t => t.persona === p.id), `persona ${p.id} has no lines`);

// No real people, outlets or brands (or near-misses of them).
const BANNED = /romano|fabri[sz]io|fabeizio|goldbridge|sky ?sports|live ?score|hater ?central|the ?athletic|opta|squawka|keane|lineker|here we go|aftv|bbc|espn|talksport/i;
const all = mediaOf(c).posts;
const words = (p: StoredPost) => [p.text, p.author.name, p.author.handle, p.quote?.text ?? "", p.quote?.handle ?? "", ...(p.thread ?? []).flatMap(r => [r.text, r.handle, r.name])].join(" \n ");
const banned = all.filter(p => BANNED.test(words(p)));
check(banned.length === 0, `a real name in the feed: ${banned[0] ? words(banned[0]).match(BANNED)?.[0] + " in: " + words(banned[0]).replace(/\s+/g, " ").slice(0, 300) : ""}`);
check(!roster.some(a => BANNED.test(`${a.name} ${a.handle}`)), "a real name in the cast");
check(!TWITTER_TEMPLATES.some(t => BANNED.test(t.body)), "a real name in a persona line");

// No holes.
const holey = all.filter(p => /\{|\}|undefined|NaN|\[object/.test(words(p)) || / {2,}/.test(p.text) || !p.text.trim());
check(holey.length === 0, `a broken line: ${holey[0] ? words(holey[0]).slice(0, 120) : ""}`);

// Determinism.
check(fingerprint(richRun(14, 4242)) === fingerprint(c), "switch on: the same career makes a different feed");

// Who posted.
const posted = new Set(all.map(p => p.persona).filter(Boolean));
check(posted.size >= 15, `at least 15 kinds of invented account posted (${posted.size})`);
check(all.some(p => p.thread?.length), "no post has replies");
check(all.some(p => p.quote), "no quote-posts");
check(all.some(p => p.quote?.video), "no quote of a goal video");
check(all.some(p => p.persona && p.graphic?.type === "poll"), "no persona poll");
const polls = all.filter(p => p.graphic?.type === "poll" && p.persona).map(p => p.graphic as { votes: number[] });
check(polls.every(g => g.votes.every(v => v >= 0) && g.votes.reduce((a, b) => a + b, 0) >= 40), "a persona poll with no votes");

// Numbers: views ≫ likes ≫ reposts ≥ quotes on every new post.
const ft = all.filter(p => p.metrics.views !== undefined);
check(ft.length > 50, `posts carry views (${ft.length})`);
const badRatio = ft.filter(p => !(p.metrics.views! > p.metrics.likes && p.metrics.likes >= p.metrics.reposts && p.metrics.reposts >= (p.metrics.quotes ?? 0)));
check(badRatio.length === 0, `a post with impossible numbers (${badRatio.length}): ${JSON.stringify(badRatio[0]?.metrics)}`);
// Reach grows with followers (median of 200 rolls each).
const med = (followers: number) => {
  const xs = Array.from({ length: 200 }, (_, i) => engagement({ followers, archetype: "aggregator" }, 60, {}, rngFor("t", followers, i)).views!).sort((a, b) => a - b);
  return xs[100];
};
check(med(5_000) < med(200_000) && med(200_000) < med(5_000_000), `views grow with followers (${med(5_000)}, ${med(200_000)}, ${med(5_000_000)})`);
// Snowballs exist but are rare: some post does 5× its median.
const rolls = Array.from({ length: 400 }, (_, i) => engagement({ followers: 300_000, archetype: "meme" }, 50, {}, rngFor("v", i)).views!).sort((a, b) => a - b);
check(rolls[399] > rolls[200] * 5 && rolls[300] < rolls[200] * 3, "virality: no snowballs, or too many");

// Haters pile on after bad days; hype pages after good ones.
const BAD = new Set(["loss", "hammered", "collapse", "embarrassed", "losing-run", "derby-loss", "lost-top", "into-the-drop", "relegated", "anonymous", "poor-showing", "hooked", "drought", "cheeky-miss", "out-of-form", "upset"]);
const hater = all.filter(p => p.persona === "ratio" || p.persona === "rivalBanter");
const haterBad = hater.filter(p => BAD.has(p.eventId)).length;
check(hater.length > 0 && haterBad / hater.length >= 0.8, `haters post mostly about bad days (${haterBad}/${hater.length})`);
const hype = all.filter(p => p.persona === "hype" || p.persona === "kidFan");
const hypeBad = hype.filter(p => BAD.has(p.eventId) && p.eventId !== "upset").length;
check(hype.length > 0 && hypeBad <= hype.length * 0.1, `hype pages post mostly about good days (${hypeBad} bad of ${hype.length})`);

// The ranked feed: never five in a row from one kind of account, and your
// own news reaches the first screenful.
const shown = feedFor(c, "settled").posts;
const kind = (p: StoredPost) => p.persona ?? p.author.archetype;
let run = 1, worst = 1;
for (let i = 1; i < shown.length; i++) { run = kind(shown[i]) === kind(shown[i - 1]) ? run + 1 : 1; worst = Math.max(worst, run); }
check(worst < 5, `five or more in a row from one kind of account (${worst})`);
check(shown.slice(0, 12).some(p => p.aboutYou), "nothing about you in the first 12 posts");
// Ranking is recency-aware: a fresh small post beats a week-old big one.
const mk = (at: number, likes: number): StoredPost => ({
  id: String(at), at, author: { handle: "@a", name: "a", archetype: "fan", platform: "x", verified: false, initials: "A", tint: "#000" },
  text: "x", metrics: { likes, reposts: likes / 10, replies: likes / 20 }, eventId: "win", tags: [],
});
const now = 1_050_100;
const ranked = rankFeed([mk(1_040_100, 50_000), mk(1_050_000, 2_000)], now);
check(ranked[0].at === 1_050_000, "a week-old post outranks a fresh one");

if (problems.length) {
  console.error(`FOOTBALL TWITTER: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`football twitter ok: ${personas.length} invented accounts, ${TWITTER_TEMPLATES.length} lines, ${posted.size} posted, ${ft.length} posts with views`);
