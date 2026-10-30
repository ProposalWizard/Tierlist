import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, feedFor, mediaOf } from "../../lib/star/media/feed";
import { mulberry32 } from "../../lib/star/season";
import {
  studioActive, studioRoster, studioShown, studioTrends, studioEvents, studioPosts, studioCap,
} from "../../lib/star/media/studio";
import {
  fillTokens, nudgePost, matchIdea, momentIdea, defaultMatchForm, defaultMoment, parseMedia, exportMedia,
  withStudio, openGotmPoll, authorOf, accountRows, filterPosts, duplicatePosts, deletePosts, updatePosts,
  postFromTemplate, templateCatalogue, eventKinds, defaultGraphic, GRAPHIC_KINDS, newCustomAccount, lastMatchForm,
} from "../../lib/star/media/studioTools";
import { buildRoster } from "../../lib/star/media/accounts";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { MediaStudio, StoredPost } from "../../lib/star/media/types";

/**
 * THE SOCIAL STUDIO (/admin/social, Leo 30 Oct 2026).
 *
 * The one promise that matters most: a save nobody has opened the studio for
 * makes and shows exactly the same feed as before. Then: every setting the
 * studio writes actually changes what the game makes and shows, and the
 * page's own tools (tokens, reorder, ideas, polls, files) do what they say.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];
const player: StarPlayer = {
  firstName: "Test", lastName: "Striker", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
};

/** Plays `n` matches from `c`, every one through the real media pass. */
function play(start: CareerState, n: number, seed = 100): CareerState {
  let c = start;
  for (let m = 0; m < n; m++) {
    const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const rng = mulberry32(seed + m);
    const k = 1 + Math.floor(rng() * 4);
    const events: GoalEvent[] = [];
    for (let i = 0; i < k; i++) {
      const mine = rng() < 0.6;
      events.push({ minute: 5 + i * 20 + Math.floor(rng() * 15), scorer: mine ? "Test Striker" : "Danny Reeves", isUserGoal: mine, how: "one_on_one", distance: 10 + Math.floor(rng() * 15) });
    }
    const goals = events.filter(e => e.isUserGoal).length;
    const stats: MatchStats = {
      chances: 4, goals, assists: 0, passes: 25, rating: 7.4, starMan: goals >= 2,
      bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2,
      homeScore: k, awayScore: Math.floor(rng() * 2), goalEvents: events, minutes: 90,
    };
    const before = c;
    const { career: after } = creditMatchResult(c, fixture, stats);
    after.media = generateForMatch(before, after, fixture, stats);
    const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== player.club && r.away !== player.club);
    if (rest.length) after.media = generateForLeagueWeek({ ...after }, rest);
    c = after;
  }
  return c;
}

const withSt = (c: CareerState, st: MediaStudio): CareerState => ({ ...c, media: { ...mediaOf(c), studio: st } });
const strip = (c: CareerState) => { const m = mediaOf(c); return JSON.stringify({ posts: m.posts, trends: m.trends, memory: m.memory }); };

// ── 1. Nothing set = exactly as before ──────────────────────────────────────
const fresh = makeInitialCareer(player, CLUBS);
const plain = play(fresh, 10);
const emptyStudio = play(withSt(fresh, {}), 10);
check(strip(plain) === strip(emptyStudio), "an empty studio changes the feed the game makes");
check(!("studio" in mediaOf(plain)), "a plain save grows a studio field");
check(!studioActive(undefined) && !studioActive({}), "studioActive is true with nothing set");
const roster = buildRoster(plain);
check(studioRoster(roster, undefined) === roster && studioRoster(roster, {}) === roster, "studioRoster copies the cast with nothing set");
const posts = mediaOf(plain).posts;
check(studioShown(posts, undefined) === posts, "studioShown copies the posts with nothing set");
check(studioTrends(mediaOf(plain).trends, undefined) === mediaOf(plain).trends, "studioTrends copies with nothing set");
check(studioPosts(posts, {}) === posts && studioEvents([], {}).length === 0, "studioPosts/studioEvents change nothing with nothing set");
check(studioCap(undefined, 150) === 150 && studioCap({ postCap: 3 }, 150) === 150 && studioCap({ postCap: 60 }, 150) === 60, "studioCap");
const feedPlain = JSON.stringify(feedFor(plain));
check(feedPlain === JSON.stringify(feedFor(withSt(plain, {}))), "feedFor differs with an empty studio");
console.log(`nothing set: 10 matches, ${posts.length} posts, byte-identical with and without an empty studio`);

// ── 2. Account changes show on old posts and are used for new ones ─────────
const clubHandle = "@Arsenal";
const renamed = withSt(plain, { accountOverrides: { [clubHandle]: { name: "The Gunners HQ", handle: "@GunnersHQ", tint: "#ff0000", glyph: "ball", followers: 99_000_000 } } });
const shownRenamed = feedFor(renamed).posts.filter(p => p.author.handle === "@GunnersHQ");
check(shownRenamed.length > 0 && shownRenamed.every(p => p.author.name === "The Gunners HQ" && p.author.tint === "#ff0000"), "renamed account not shown on old posts");
check(mediaOf(renamed).posts.every(p => p.author.handle !== "@GunnersHQ"), "showing a renamed account rewrote the save");
const later = play(renamed, 3, 900);
const newOnes = mediaOf(later).posts.filter(p => !posts.some(q => q.id === p.id));
check(newOnes.some(p => p.author.handle === "@GunnersHQ" && p.author.name === "The Gunners HQ"), "new posts don't use the renamed account");
check(!newOnes.some(p => p.author.handle === clubHandle), "new posts still use the old club handle");
check(mediaOf(later).studio?.accountOverrides?.[clubHandle]?.name === "The Gunners HQ", "studio settings lost across matches");
console.log(`account change: ${shownRenamed.length} old posts restyled, ${newOnes.filter(p => p.author.handle === "@GunnersHQ").length} new posts by the renamed account`);

// ── 3. Weights, kinds of post, pictures, cap, custom accounts ───────────────
const noFans = play(withSt(plain, { archetypeWeights: { fan: 0, rivalFan: 0 } }), 4, 300);
const fanNew = mediaOf(noFans).posts.filter(p => !posts.some(q => q.id === p.id) && (p.author.archetype === "fan" || p.author.archetype === "rivalFan") && p.author.handle !== "@GroundNoise");
check(fanNew.length === 0, `fans weighted 0 still posted (${fanNew.length})`);
const fansBase = mediaOf(play(plain, 4, 300)).posts.filter(p => !posts.some(q => q.id === p.id) && p.author.archetype === "fan").length;
console.log(`fans weight 0: ${fanNew.length} fan posts in 4 matches (game alone: ${fansBase})`);

const noHighlights = play(withSt(plain, { disabledEvents: ["match-highlights"], disabledGraphics: ["poll", "scoreline"] }), 4, 300);
const nh = mediaOf(noHighlights).posts.filter(p => !posts.some(q => q.id === p.id));
check(nh.length > 0, "turning things off left no posts");
check(!nh.some(p => p.eventId === "match-highlights"), "a turned-off kind of post was still made");
check(!nh.some(p => p.graphic?.type === "poll" || p.graphic?.type === "scoreline"), "a turned-off picture was still attached");

const custom = newCustomAccount("Leo's Stats Den", "stats", "@LeoStats");
custom.weight = 50; custom.followers = 2_000_000;
const withCustom = play(withSt(plain, { customAccounts: [custom] }), 4, 300);
const byCustom = mediaOf(withCustom).posts.filter(p => p.author.handle === "@LeoStats");
check(byCustom.length > 0, "a new account with a big weight never posted");
console.log(`new account @LeoStats (weight 50): ${byCustom.length} posts in 4 matches`);

const loud = play(withSt(plain, { volume: 2 }), 2, 300);
const quiet = play(withSt(plain, { volume: 0.4 }), 2, 300);
const added = (c: CareerState) => mediaOf(c).posts.filter(p => !posts.some(q => q.id === p.id)).length;
check(added(loud) > added(quiet), `volume 2 (${added(loud)}) not more than volume 0.4 (${added(quiet)})`);
console.log(`volume: 2 matches made ${added(quiet)} posts at ×0.4, ${added(loud)} at ×2`);

const capped = play(withSt(plain, { postCap: 60 }), 2, 300);
check(mediaOf(capped).posts.length <= 60, `post cap 60 kept ${mediaOf(capped).posts.length}`);

// ── 4. Hidden and pinned ────────────────────────────────────────────────────
const shown0 = feedFor(plain).posts;
const victim = shown0[0], oldest = mediaOf(plain).posts[0];
const flagged = { ...plain, media: updatePosts(updatePosts(mediaOf(plain), [victim.id], { hidden: true }), [oldest.id], { pinned: true }) };
const shown1 = feedFor(flagged).posts;
check(!shown1.some(p => p.id === victim.id), "a hidden post is shown");
check(shown1[0]?.id === oldest.id, "a pinned post (even an old one) is not first");
check(mediaOf(flagged).posts.some(p => p.id === victim.id), "hiding deleted the post");

// ── 5. The page's tools ─────────────────────────────────────────────────────
check(fillTokens("{you} ({short}) of {club}, {season}", plain) === `Test Striker (Striker) of Arsenal, ${plain.season}`, "tokens");
const m = mediaOf(plain);
const newestFirst = [...m.posts].sort((a, b) => b.at - a.at);
const second = newestFirst[1];
const nudged = [...nudgePost(m, second.id, "up").posts].sort((a, b) => b.at - a.at);
check(nudged[0].id === second.id, "nudge up does not move a post above its neighbour");
const dup = duplicatePosts(m, [second.id]);
check(dup.posts.length === m.posts.length + 1 && dup.posts.some(p => p.id !== second.id && p.text === second.text && p.studio), "duplicate");
check(deletePosts(m, [second.id]).posts.length === m.posts.length - 1, "delete");
check(filterPosts(m.posts, { handle: "@Arsenal" }).every(p => p.author.handle === "@Arsenal"), "filter by account");
check(filterPosts(m.posts, { video: true }).every(p => !!p.graphic), "filter by video");

const hat = matchIdea(plain, { ...defaultMatchForm(plain), us: 3, them: 0, yourGoals: 3, lastGoalMinute: 88 }, "t1");
check(hat.events.some(e => e.id === "hat-trick"), `a made-up hat-trick fired no hat-trick event (${hat.events.map(e => e.id).join(",")})`);
check(hat.posts.length >= 5, `a made-up hat-trick made only ${hat.posts.length} posts`);
check(hat.posts.some(p => p.graphic?.type === "goalVideo"), "a made-up match has no highlights video");
check(mediaOf(plain).posts.length === posts.length, "an idea preview changed the save");
console.log(`made-up hat-trick: ${hat.events.length} events, ${hat.posts.length} posts (${hat.posts.filter(p => p.graphic).length} with pictures)`);

const sack = momentIdea(plain, defaultMoment(plain, "manager-out"), "t2");
check(sack.events.some(e => e.id === "manager-sacked") && sack.posts.length > 0, "a made-up sacking made no posts");
const move = momentIdea(plain, defaultMoment(plain, "transfer"), "t3");
check(move.posts.length > 0, "a made-up transfer made no posts");
console.log(`made-up sacking: ${sack.posts.length} posts; made-up transfer: ${move.posts.length} posts`);

const cat = templateCatalogue();
check(cat.length > 300 && eventKinds().includes("hat-trick"), "template catalogue");
const acc = buildRoster(plain).find(a => a.archetype === "tabloid")!;
const tpl = cat.find(t => t.id === "tb-manager")!;
const tp = postFromTemplate(tpl.id, acc, { manager: "Big Sam" }, 1, "x1");
check(!!tp && /BIG SAM/.test(tp.text), `template post: ${tp?.text}`);
for (const g of GRAPHIC_KINDS) check(defaultGraphic(g.type, plain).type === g.type, `default graphic ${g.type}`);
check(accountRows(plain).length >= 30, "account list");
check(!!lastMatchForm(plain), "last match form");

// Goal of the Month on demand: opened now, closed by the game after the next match.
const entries = defaultGraphic("gotmPoll", plain);
const pollEntries = entries.type === "gotmPoll" && entries.entries.length >= 2 ? entries.entries
  : [{ scorer: "Test Striker", scorerShort: "Striker", club: "Arsenal", isYou: true, detail: "a", quality: 80 },
     { scorer: "Other Guy", scorerShort: "Guy", club: "Chelsea", isYou: false, detail: "b", quality: 70 }];
const league = buildRoster(plain).find(a => a.archetype === "league")!;
const opened = { ...plain, media: openGotmPoll(plain, pollEntries, authorOf(league), "Vote now", "October") };
check(feedFor(opened).posts.some(p => p.graphic?.type === "gotmPoll"), "studio poll not in the feed");
const afterNext = play(opened, 1, 777);
const closed = mediaOf(afterNext).posts.find(p => p.graphic?.type === "gotmPoll" && p.id.startsWith("gotm-studio"));
check(!!closed && closed.graphic?.type === "gotmPoll" && !!closed.graphic.closed, "the game did not close the studio's poll after the next match");
check(mediaOf(afterNext).posts.some(p => p.id.startsWith("gotm-studio") && p.eventId === "gotm-winner"), "no winner post for the studio's poll");

// Files.
const back = parseMedia(exportMedia(renamed));
check(!!back && back.posts.length === mediaOf(renamed).posts.length && back.studio?.accountOverrides?.[clubHandle]?.name === "The Gunners HQ", "media file round trip");
check(parseMedia("{\"posts\": 3}") === null && parseMedia("nope") === null, "a bad file is accepted");
const cleared = withStudio(mediaOf(renamed), st => ({ ...st, accountOverrides: {} }));
check(!("studio" in cleared), "an emptied studio stays on the save");

if (problems.length) {
  console.error("socialStudio FAILED:\n  - " + [...new Set(problems)].join("\n  - "));
  process.exit(1);
}
console.log("socialStudio: all checks passed");
