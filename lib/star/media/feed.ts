import { fameOf } from "../fame";
import type { CareerState, Fixture, LeagueResult, MatchStats } from "../types";
import type {
  Archetype, CareerRecord, Facts, FootballEvent, MatchRecord, MediaAccount, MediaCycle,
  MediaState, StoredPost, StoryMemory, Trend,
} from "./types";
import { buildMatchRecord } from "./record";
import { detectCareer, detectMatch } from "./detect";
import { detectLeagueWeek } from "./detect/league";
import { detectWonderkidHype } from "./detect/wonderkids";
import { regenEvent, retirementEvent } from "./detect/retirements";
import { promisingRegens } from "../retirementNews";
import { mulberry32 } from "../season";
import { divisionOf, leagueNameFor } from "../calendar";
import { getTuning } from "../tuningStore";
import { formatMoney } from "../money";
import { headlineEvent, scoreCareerEvents, scoreMatchEvents } from "./importance";
import { absorbEvents, absorbMatch, coolThreads, emptyMemory, markSaid } from "./memory";
import { buildRoster, selfAccount, nationalTeamAccount } from "./accounts";
import { selectPairings, type FtContext, type Pairing } from "./select";
import { chooseAngle } from "./narrate";
import { chooseTemplate } from "./templates";
import { buildGraphic, matchReel, standInsFor, yourGoalsVideo } from "./graphics";
import type { SynthGoal } from "../goalClip/synth";
import { metricsFor, resolve, rngFor, speak, surname } from "./grammar";
import { clockAt, timeFor, visible, FEED_HORIZON, FIRST_WAVE } from "./schedule";
import { buildTrends } from "./trending";
import { goalOfMonthAfterMatch } from "./goalOfMonth";
import { footballTwitterOn, goalOfMonthOn, yourGoalVideoOn } from "./updateFlags";
import { choosePersonaTemplate } from "./templates";
import { derivedFacts, engagement, evenPoll, personaPoll, personaSpeak, quotePosts, rankFeed, replyThread, soundFor } from "./twitter/engine";
import { breaksVideoRule, graphicPlays, impliesVideo } from "./twitter/videoWords";
import { primaryRivalOf } from "../rivalries";
import { sortLeague } from "../season";
import { personaById } from "./twitter/personas";
import { studioCap, studioEvents, studioPosts, studioRoster, studioShown, studioTrends, studioVolume } from "./studio";
export { voteGoalOfMonth, applyGoalOfMonthBoost } from "./goalOfMonth";

/**
 * THE FAÇADE
 *
 * Two functions. `generateCycle` runs the pipeline once, at full time or at a
 * career moment; `feedFor` reads what has been generated and shows whatever the
 * virtual clock has reached. Nothing outside this module imports anything else
 * from it, and nothing inside it reaches back out into the career except here.
 *
 * The order of the stages is load-bearing and documented in ARCHITECTURE.md §12.
 * The one that is easy to get wrong: memory absorbs the MATCH before detection
 * runs, so a detector asking "how long is the scoring run" gets the run
 * including today — and it absorbs the EVENTS after detection, because that is
 * when the threads have something to be fed.
 */

const POST_CAP = 150;

export function emptyMedia(): MediaState {
  return { posts: [], memory: emptyMemory(), trends: [], lastCycleId: "", lastCycleClock: 0, seenCycleIds: [] };
}

export function mediaOf(career: CareerState): MediaState {
  return career.media ?? emptyMedia();
}

/** Like a post, or unlike it if you already had. Nothing else changes. */
export function toggleLike(career: CareerState, postId: string): CareerState {
  if (!career.media) return career;
  const posts = career.media.posts.map(p => (p.id === postId ? { ...p, liked: !p.liked } : p));
  return { ...career, media: { ...career.media, posts } };
}

/** The real replay guard — see `MediaState.seenCycleIds`'s own header on why
 *  `lastCycleId`/`lastLeagueCycleId` alone aren't enough. */
function alreadySeen(state: MediaState, id: string): boolean {
  return (state.seenCycleIds ?? []).includes(id);
}

// Generous relative to POST_CAP (150) — a cycle that produced zero posts
// (nothing scored high enough) still needs its id remembered so IT doesn't
// replay either, so this can't just be "one entry per surviving post."
const SEEN_CAP = 400;

function withSeen(state: MediaState, id: string): string[] {
  return [...(state.seenCycleIds ?? []), id].slice(-SEEN_CAP);
}

// ── Generation ──────────────────────────────────────────────────────────────

export function generateForMatch(
  before: CareerState,
  after: CareerState,
  fixture: Fixture,
  stats: MatchStats,
): MediaState {
  const state = mediaOf(before);
  const record = buildMatchRecord(before, after, fixture, stats);

  // A replayed season must not post twice. The career has already shipped one
  // double-crediting bug from exactly this; it does not need a second.
  if (state.lastCycleId === record.id || alreadySeen(state, record.id)) return state;

  // The run including today, then what the run makes true.
  const withMatch = absorbMatch(coolThreads(state.memory), record);
  const detected = detectMatch(record, withMatch);
  const scored = scoreMatchEvents(detected, record, withMatch);
  const { memory: withEvents, events } = absorbEvents(withMatch, scored, {
    season: record.season, week: record.week,
  });

  const clock = clockAt(record.season, record.week, 0);
  const committed = commit(after, state, record, events, withEvents, record.id, clock);
  // Goal of the Month: close last week's poll, open a finished month's.
  return goalOfMonthOn() ? goalOfMonthAfterMatch(committed, before, after, fixture, stats, record, clock) : committed;
}

export function generateForCareer(career: CareerState, moment: CareerRecord["moment"], key: string): MediaState {
  const state = mediaOf(career);
  const id = `s${career.season}-w${career.week}-${key}`;
  if (state.lastCycleId === id || alreadySeen(state, id)) return state;

  const record: CareerRecord = {
    id,
    season: career.season,
    week: career.week,
    club: career.player.club,
    you: {
      name: `${career.player.firstName} ${career.player.lastName}`,
      shortName: career.player.lastName,
      position: career.player.position,
      squadNumber: career.squadNumber ?? 0,
    },
    context: { fame: fameOf(career), starRating: career.starRating, fansStanding: career.relationships.fans },
    moment,
  };

  const cooled = coolThreads(state.memory);
  const detected = detectCareer(record, cooled);
  const scored = scoreCareerEvents(detected, cooled, fameOf(career));
  const { memory, events } = absorbEvents(cooled, scored, { season: career.season, week: career.week });

  return commit(career, state, null, events, memory, id, clockAt(career.season, career.week, 0));
}

/** Caps worth their own post: the landmarks a national side marks. */
export const CAP_MILESTONES = [10, 25, 50, 75, 100, 125, 150];

/**
 * AN INTERNATIONAL, IN THE FEED.
 *
 * An England game used to go through `generateForMatch`, which is built
 * around your club: Arsenal's account posted "HIGHLIGHTS | France 2-2
 * Arsenal", a pundit said Arsenal "got exactly what they deserved", and the
 * club's losing run set off manager talk. This makes the international's own
 * events — the result, your cap (first, ordinary, landmark) and your goal
 * (first or not) — and lets only the nation's account, the neutral press,
 * the stats pages, a few fans and you post them. Club accounts, rival fans
 * and the club's storylines are never in the cast.
 *
 * `before`/`after` are the real career either side of the match
 * (creditMatchResult has already added the cap and any goals to `after`).
 */
export function generateForInternational(
  before: CareerState,
  after: CareerState,
  fixture: Fixture,
  stats: MatchStats,
  nation: string,
  nationKit: { shirt: string; trim: string },
  nationStrength = 75,
): MediaState {
  const state = mediaOf(before);
  // Your side is the nation for this record (its name on every post and
  // video), on a two-team table so nothing reads the club's league.
  const table = (name: string, strength: number) => ({
    name, strength, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  });
  const league = [table(nation, nationStrength), table(fixture.opponent, fixture.opponentStrength ?? 70)];
  const stand = (c: CareerState): CareerState => ({ ...c, player: { ...c.player, club: nation }, league });
  const record = buildMatchRecord(stand(before), stand(after), fixture, stats);
  if (state.lastCycleId === record.id || alreadySeen(state, record.id)) return state;

  const us = stats.homeScore, them = stats.awayScore;
  const home = fixture.home ? nation : fixture.opponent, away = fixture.home ? fixture.opponent : nation;
  const hs = fixture.home ? us : them, as = fixture.home ? them : us;
  const pens = stats.shootout ? ` (${stats.shootout.home}-${stats.shootout.away} pens)` : stats.wentToExtraTime ? " (aet)" : "";
  const name = `${after.player.firstName} ${after.player.lastName}`;
  const competition = fixture.round ? `${fixture.competition} ${fixture.round.replace(/ · Match \d/, "")}` : (fixture.competition ?? "International");
  const shared: Facts = {
    club: nation, nation, opponent: fixture.opponent, competition,
    scoreline: `${home} ${hs}-${as} ${away}${pens}`,
    player: name, short: after.player.lastName, season: after.season, week: fixture.week,
  };
  const won = us > them || (us === them && !!stats.shootout && (fixture.home ? stats.shootout.home > stats.shootout.away : stats.shootout.away > stats.shootout.home));
  const result = won ? "win" : us === them && !stats.shootout ? "draw" : "loss";
  const caps = after.caps ?? 0;
  const goalsBefore = before.internationalGoals ?? 0;
  const intlGoals = after.internationalGoals ?? goalsBefore;
  const you = { kind: "you" as const, name };
  const events: FootballEvent[] = [
    { id: `intl-${result}`, subject: { kind: "club", name: nation }, baseImportance: 56, tags: ["international", "stat", "opinion"],
      facts: { ...shared, result }, window: "instant" },
  ];
  // The summer tournament won (tournament.ts sets yourExit on the final).
  if (fixture.round === "Final" && after.tournament?.season === after.season && after.tournament.yourExit === "Winners") {
    events.push({ id: "intl-trophy", subject: { kind: "club", name: nation }, baseImportance: 100, tags: ["international", "trophy"],
      facts: { ...shared, tournament: fixture.competition ?? "tournament" }, window: "instant" });
  }
  if (caps === 1) {
    events.push({ id: "intl-debut", subject: you, baseImportance: 74, tags: ["international", "debut", "milestone"], facts: { ...shared, caps }, window: "hour" });
  } else if (CAP_MILESTONES.includes(caps)) {
    events.push({ id: "intl-cap-milestone", subject: you, baseImportance: 70, tags: ["international", "milestone", "stat"], facts: { ...shared, caps }, window: "hour" });
  } else if (caps > 1) {
    events.push({ id: "intl-cap", subject: you, baseImportance: 30, tags: ["international", "stat"], facts: { ...shared, caps }, window: "hour" });
  }
  if (stats.goals > 0) {
    events.push({ id: goalsBefore === 0 ? "intl-first-goal" : "intl-goal", subject: you, baseImportance: goalsBefore === 0 ? 80 : 64,
      tags: ["international", "goal", "stat"], facts: { ...shared, intlGoals }, window: "instant" });
  }

  const cooled = coolThreads(state.memory);
  const scored = scoreCareerEvents(events, cooled, fameOf(after));
  const { memory, events: absorbed } = absorbEvents(cooled, scored, { season: after.season, week: fixture.week });
  // The cast: the nation, the neutral press, stats, aggregators, pundits, the
  // chant-catcher and supporters — and you, speaking for your country.
  const world = [...buildRoster(after), selfAccount(after)]
    .filter(a => !a.allegiance || a.archetype === "fan" || a.id === "@self")
    .filter(a => a.archetype !== "league" && a.archetype !== "competition" && a.archetype !== "insider")
    .map(a => (a.allegiance ? { ...a, allegiance: { club: nation, polarity: 1 as const } } : a));
  const cast = [nationalTeamAccount(nation, nationKit, nationStrength), ...world];
  return commit({ ...after, player: { ...after.player, club: nation } }, state, record, absorbed, memory, record.id,
    clockAt(record.season, record.week, 0), "club", undefined, undefined, cast);
}

/**
 * The squad is named and you are in it: a career moment with its own cast
 * (your club, its fans, the press, you) and its own lines
 * (templates/international.ts) — "first-call-up" the first time, "call-up"
 * after. `callUps` counts this one.
 */
export function generateForCallUp(career: CareerState, nation: string, callUps: number, month: string, key: string): MediaState {
  const state = mediaOf(career);
  const id = `s${career.season}-w${career.week}-${key}`;
  if (state.lastCycleId === id || alreadySeen(state, id)) return state;
  const name = `${career.player.firstName} ${career.player.lastName}`;
  const event: FootballEvent = {
    id: callUps <= 1 ? "first-call-up" : "call-up",
    subject: { kind: "you", name },
    baseImportance: callUps <= 1 ? 82 : 40,
    tags: ["international", "award"],
    facts: { player: name, short: career.player.lastName, club: career.player.club, nation, month, season: career.season, week: career.week },
    window: "instant",
  };
  const cooled = coolThreads(state.memory);
  const scored = scoreCareerEvents([event], cooled, fameOf(career));
  const { memory, events } = absorbEvents(cooled, scored, { season: career.season, week: career.week });
  // No insiders: with two of them, the second fell back to the generic
  // "Keeping an eye on the situation at {club}" (seen in the real game).
  const allowed = new Set<Archetype>(["club", "stats", "fan", "tabloid", "aggregator", "teammate"]);
  return commit(career, state, null, events, memory, id, clockAt(career.season, career.week, 0), "club", allowed);
}

/**
 * A boardroom sale — a player sold out of a club YOU OWN, not one you play
 * for — is a real transfer just like any other, requested directly, 14 Sep
 * 2026: "these are transfers just like any other... there should be news
 * for them." `detectCareer`'s own TRANSFER detector is keyed entirely to
 * `CareerRecord.you` (the human player's own move — see career.ts), so it
 * can't answer for a third party moving between two OTHER clubs; this
 * builds the same shape of event directly instead of routing through it.
 *
 * Deliberately only the two GENERIC events (farewell/unveiling — both club
 * accounts, and their own fans reacting to them) — no "transfer-done"
 * insider/fan post, which `detect/career.ts`'s own version keys to
 * `subject.kind: "you"` (a fan's relationship with a player joining or
 * leaving THEIR OWN club specifically). A boardroom sale of someone else's
 * squad player is real transfer news, but it isn't about you personally the
 * way your own move is — the two selling/buying club accounts and their
 * fans are exactly who would actually post about it.
 */
export function generateForBoardroomSale(
  career: CareerState, sellingClub: string, buyerClub: string, playerName: string, fee: number, key: string,
): MediaState {
  const state = mediaOf(career);
  const id = `s${career.season}-w${career.week}-${key}`;
  if (state.lastCycleId === id || alreadySeen(state, id)) return state;

  const sellerFacts: Facts = {
    player: playerName, short: surname(playerName), from: sellingClub, to: buyerClub,
    feeText: `£${formatMoney(fee)}`, club: sellingClub, season: career.season, week: career.week,
  };
  const buyerFacts: Facts = { ...sellerFacts, club: buyerClub };

  const events: FootballEvent[] = [
    { id: "farewell", subject: { kind: "club", name: sellingClub }, baseImportance: 62, tags: ["transfer"], facts: sellerFacts, window: "hour" },
    { id: "unveiling", subject: { kind: "club", name: buyerClub }, baseImportance: 74, tags: ["transfer"], facts: buyerFacts, window: "hour" },
  ];

  const cooled = coolThreads(state.memory);
  const scored = scoreCareerEvents(events, cooled, fameOf(career));
  const { memory, events: absorbed } = absorbEvents(cooled, scored, { season: career.season, week: career.week });

  return commit(career, state, null, absorbed, memory, id, clockAt(career.season, career.week, 0));
}

/**
 * The rest of the division, the same week.
 *
 * `weekResults` is this week's slice of `career.results` — every fixture
 * `playLeagueWeek` (season.ts) simulated, YOURS included; the caller
 * (app/star-dev/page.tsx) filters it down to everyone else's before handing
 * it over, since your own match already went through `generateForMatch`.
 * No memory/thread absorption here — see detect/league.ts's own header on
 * why this stays a narrow, independent pass rather than a second storyline
 * engine — so the career's existing memory is threaded through untouched.
 */
export function generateForLeagueWeek(
  career: CareerState,
  weekResults: LeagueResult[],
  /** The division's own name; absent means the division this career plays in
   *  (it used to be "Premier League" for every division). */
  competitionName?: string,
): MediaState {
  const competition = competitionName ?? leagueNameFor(divisionOf(career));
  const state = mediaOf(career);
  // The week these RESULTS are for — not `career.week`, which has already
  // advanced past it by the time this runs (crediting your own match moves
  // the career on to next week before this is ever called). Every entry in
  // `weekResults` is the same week already (the caller filters it that way),
  // so the first is as good as any.
  const week = weekResults[0]?.week ?? career.week;
  const id = `s${career.season}-w${week}-leagueweek`;
  if (state.lastLeagueCycleId === id || alreadySeen(state, id)) return state;

  const events = detectLeagueWeek(weekResults, career.player.club, week, competition, career.season);
  // The kids everyone is talking about — see detect/wonderkids.ts's own
  // header for why this is scoped to the rest of the world (leagueSquads/
  // externalSquads) rather than your own squad, and why it's at most one
  // pick a week. Seeded independently of `detectLeagueWeek`'s own (fully
  // deterministic, no rng at all) results pass, off the same
  // (season, week) a replay of this exact cycle would reproduce.
  const wonderkidRng = mulberry32(career.season * 52631 + week * 977);
  const wonderkidPool = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])];
  events.push(...detectWonderkidHype(wonderkidPool, week, career.season, wonderkidRng, getTuning("wonderkids.mediaChance")));
  return commit(career, state, null, events, state.memory, id, clockAt(career.season, week, 0), "league");
}

/**
 * RETIREMENTS AND REGENS AT THE ROLLOVER.
 *
 * `career` is the career straight after advanceSeason: `lastRetirements`
 * holds the retirements worth a post (lib/star/retirementNews.ts) and the
 * squads hold this rollover's regens. One cycle per player, so each one gets
 * his own handful of posts and lines are not used up by the man before him.
 * Each cycle id carries the player's id, so a replayed rollover never posts
 * twice (the same `seenCycleIds` guard every cycle uses).
 *
 * Your own team-mates are club news; everyone else goes to the wider tab.
 * Only accounts that have their own lines for these events may post, and a
 * league account only speaks for a club in its own division.
 */
export function generateForRollover(career: CareerState): MediaState {
  let media = mediaOf(career);
  const finished = career.season - 1;
  const own = career.player.club;
  const division = new Set(career.league.map(t => t.name));
  const allowed = (club: string): Set<Archetype> => new Set<Archetype>(
    division.has(club)
      ? ["club", "league", "stats", "fan", "teammate", "tabloid", "insider"]
      : ["club", "stats", "fan", "teammate", "tabloid", "insider"],
  );
  const run = (event: FootballEvent, key: string, scope: "club" | "league", maxPosts: number) => {
    const state = media;
    const id = `s${career.season}-w${career.week}-${key}`;
    if (state.lastCycleId === id || alreadySeen(state, id)) return;
    const cooled = coolThreads(state.memory);
    const scored = scoreCareerEvents([event], cooled, fameOf(career));
    media = commit({ ...career, media: state }, state, null, scored, cooled, id,
      clockAt(career.season, career.week, 0), scope, allowed(String(event.facts.club ?? own)), maxPosts);
  };
  // A few posts each: a team-mate 4, a famous name 3, a boy to watch 2.
  for (const n of career.lastRetirements ?? []) {
    run(retirementEvent(n, finished), `retire-${n.id}`, n.own ? "club" : "league", n.own ? 4 : 3);
  }
  for (const n of promisingRegens(career, own, finished)) {
    run(regenEvent(n, finished), `regen-${n.id}`, n.own ? "club" : "league", 2);
  }
  return media;
}

/**
 * SOCIAL STUDIO (/admin/social): the posts these events WOULD make, through
 * the same cast, selection, narration and templates as a real cycle. Nothing
 * is saved and the game never calls it; the studio adds the posts it keeps.
 */
export function previewCycle(
  career: CareerState,
  events: FootballEvent[],
  record: MatchRecord | null,
  cycleId: string,
  scope: "club" | "league" = "club",
  onlyArchetypes?: Set<Archetype>,
  maxPosts?: number,
): { posts: StoredPost[]; trends: Trend[] } {
  const state = mediaOf(career);
  // Only the last few posts: enough for "not the same sentence as last week",
  // never so many that the cap trims the new ones.
  const slim: MediaState = { ...state, posts: state.posts.slice(-24) };
  const clock = clockAt(record?.season ?? career.season, record?.week ?? career.week, 0);
  const out = commit(career, slim, record, events, state.memory, cycleId, clock, scope, onlyArchetypes, maxPosts);
  return { posts: out.posts.filter(p => p.id.startsWith(`${cycleId}:`)), trends: out.trends };
}

/**
 * Turn scored events into posts and fold them into the saved state.
 *
 * Shared by both entry points on purpose: a transfer and a hat-trick go through
 * the same selection, the same narration and the same templates. Two engines
 * would be two sets of bugs.
 */
function commit(
  career: CareerState,
  state: MediaState,
  record: MatchRecord | null,
  events: FootballEvent[],
  memory: StoryMemory,
  cycleId: string,
  cycleClock: number,
  scope: "club" | "league" = "club",
  /** Only these kinds of account may post (the rollover's own events). */
  onlyArchetypes?: Set<Archetype>,
  /** At most this many posts from this cycle (the rollover keeps each player to a few). */
  maxPosts?: number,
  /** The accounts that may post, instead of the club world (an international's own cast). */
  accountsOverride?: MediaAccount[],
): MediaState {
  // Social Studio (studio.ts): every one of these hands back what it was
  // given when the save has no studio settings.
  const st = state.studio;
  const cap = studioCap(st, POST_CAP);
  events = studioEvents(events, st);
  const world = () => studioRoster(accountsOverride ?? [...buildRoster(career), selfAccount(career)], st);
  // The league-wide weekly pass runs its OWN replay guard
  // (`lastLeagueCycleId`) rather than the match/career one below — it is
  // always called the same week as (and right after) a `generateForMatch`
  // that already claimed `lastCycleId`/`lastCycleClock` for itself, and
  // those two fields drive the "moment" walk-out-of-the-stadium screen,
  // which is about YOUR match specifically. Overwriting them here would
  // silently break that screen's own timing every single week.
  const matchCycle = scope === "club" && record ? { lastMatchCycleId: cycleId, lastMatchCycleClock: cycleClock } : {};
  if (!events.length) {
    const seenCycleIds = withSeen(state, cycleId);
    if (scope === "league") return { ...state, memory, lastLeagueCycleId: cycleId, seenCycleIds };
    // Nothing to say about it, but a match with goals still gets its videos.
    let extra = record ? studioPosts(highlightPosts(career, record, world(), cycleId, cycleClock), st) : [];
    capVideos(extra, cycleId);
    if (footballTwitterOn()) extra = extra.filter(p => !breaksVideoRule(p));
    const posts = extra.length ? [...state.posts, ...extra].sort((a, b) => a.at - b.at).slice(-cap) : state.posts;
    return { ...state, posts, memory, lastCycleId: cycleId, lastCycleClock: cycleClock, seenCycleIds, ...matchCycle };
  }

  const accounts = world()
    .filter(a => !onlyArchetypes || onlyArchetypes.has(a.archetype));
  const pairings = selectPairings(events, accounts, cycleId, career.player.club, studioVolume(st),
    footballTwitterOn() ? ftContext(career, freshSaid(memory.ftSaid, ftWeek(cycleClock))) : undefined)
    .slice(0, maxPosts ?? Number.POSITIVE_INFINITY);

  const posts: StoredPost[] = [];
  const used: string[] = [];
  const usedThisCycle = new Set<string>();
  // ── …and not the same sentence as last week either ──
  //
  // Suppressing a TEMPLATE per cycle stops two accounts saying the same thing
  // at the same moment. It does not stop the same template with the same facts
  // producing a byte-identical post a fortnight later, which is what a scoreless
  // draw against a mid-table side does — and reading two identical lines a
  // couple of scrolls apart is the same tell as reading them side by side.
  const recentText = new Set(state.posts.slice(-24).map(p => p.text));
  // ── One of each kind of post per match (Mikey, 26 Oct 2026) ──
  // "Who is to blame?" came twice, each with its own poll. A post with a
  // graphic (a poll, a card, a table) is one per kind per cycle, and one poll
  // in all; plain fan text may repeat its kind (love, anger) as long as the
  // words differ, which recentText already keeps.
  const graphicKinds = new Set<string>();
  let polls = 0;
  // Football Twitter: what each post was about, for its replies and quotes.
  const ft = footballTwitterOn();
  const ftMade: { post: StoredPost; event: FootballEvent; facts: Facts; voice: MediaAccount["voice"] }[] = [];
  // Football Twitter v2: lines used lately across the whole career, and one
  // TikTok / clips page video per cycle (the rest write a line with no video).
  const ftNow = ftWeek(cycleClock);
  const ftSaid: Record<string, number> = ft ? freshSaid(memory.ftSaid, ftNow) : {};
  let ftVideos = 0;

  // Indexed rather than `.entries()` — this project's TypeScript target does
  // not down-level iterate an array iterator.
  for (let slot = 0; slot < pairings.length; slot++) {
    const p = pairings[slot];
    const made = ft
      ? renderFt(p, career, record, memory, cycleId, usedThisCycle, slot, ftSaid, ftVideos >= FT_VIDEOS_PER_CYCLE)
      : render(p, career, record, memory, cycleId, usedThisCycle, slot);
    if (!made) continue;
    if (ft && made.post.persona && graphicPlays(made.post.graphic)) ftVideos++;
    if (recentText.has(made.post.text)) continue;
    let gType = (made.post.graphic as { type?: string } | undefined)?.type;
    // Football Twitter: a second video of the same goal keeps its words, not its video.
    if (ft && gType === "goalVideo" && made.post.persona && graphicKinds.has(`goalVideo|${made.post.eventId ?? ""}`)) {
      continue; // v2: a video post without its video is not posted at all (Leo's rule)
    }
    if (gType) {
      const isPoll = gType === "poll" || gType === "gotmPoll";
      if (isPoll && polls >= 1) continue;
      const key = isPoll ? "poll" : `${gType}|${made.post.eventId ?? ""}`;
      if (graphicKinds.has(key)) continue;
      graphicKinds.add(key);
      if (isPoll) polls++;
    }
    recentText.add(made.post.text);
    usedThisCycle.add(made.templateId);
    posts.push(...studioPosts([{ ...made.post, scope }], st));
    used.push(made.templateId);
    if (ft) ftSaid[`${p.account.id}|${made.templateId}`] = ftNow;
    if (ft) ftMade.push({ post: posts[posts.length - 1], event: p.event, facts: made.facts, voice: p.account.voice });
  }

  if (scope === "club" && record) posts.push(...studioPosts(highlightPosts(career, record, accounts, cycleId, cycleClock), st));
  // Football Twitter: a TikTok / clips page's own video is not one of the match's 1-2 (it is the post).
  capVideos(posts, cycleId, ft ? (q => !!q.persona) : undefined);
  if (ft) {
    footballTwitterPass(posts, ftMade, accounts, cycleId, career.player.club, scope, ftSaid, ftNow);
    ftTidy(posts);
  }

  const trends = buildTrends(events, posts, cycleId, fameOf(career));
  const all = [...state.posts, ...posts]
    .sort((a, b) => a.at - b.at)
    .slice(-cap);

  return {
    posts: all,
    memory: ft ? { ...markSaid(memory, used), ftSaid } : markSaid(memory, used),
    trends: trends.length ? trends : state.trends,
    seenCycleIds: withSeen(state, cycleId),
    // Kept through the league's and the career's own cycles; set by a match.
    lastMatchCycleId: state.lastMatchCycleId,
    lastMatchCycleClock: state.lastMatchCycleClock,
    // Goal of the Month's own state rides through every cycle untouched.
    ...(state.gotm ? { gotm: state.gotm } : {}),
    // …and so do the Social Studio's settings.
    ...(state.studio ? { studio: state.studio } : {}),
    ...(scope === "league"
      ? { lastCycleId: state.lastCycleId, lastCycleClock: state.lastCycleClock, lastLeagueCycleId: cycleId }
      : { lastCycleId: cycleId, lastCycleClock: cycleClock, lastLeagueCycleId: state.lastLeagueCycleId, ...matchCycle }),
  };
}

/** Most video posts one match makes (Mikey, 13 Oct 2026: "there should be
 *  less videos … it's fine to just have text"). Each match picks 1 or 2 at
 *  random (Leo, 16 Oct 2026): the highlights always, then your goals' video
 *  (or, without it, one picked at random) about half the time. The rest keep
 *  their words, no video. Other matches' goal videos (the England tab) are
 *  their own batch, and never show on the post-match screen (feedFor). */
export const MAX_VIDEOS_PER_MATCH = 2;

const hasVideo = (p: StoredPost) => {
  const g = p.graphic as { type?: string; clips?: unknown[]; synth?: unknown[] } | undefined;
  return !!g && (g.type === "goalVideo" || (g.type === "thumbnail" && ((g.clips?.length ?? 0) + (g.synth?.length ?? 0)) > 0));
};

function capVideos(posts: StoredPost[], cycleId: string, exempt?: (p: StoredPost) => boolean): void {
  const vids = posts.filter(p => hasVideo(p) && !exempt?.(p));
  if (!vids.length) return;
  const rng = rngFor("videos", cycleId);
  // 1 or 2, at random (Leo, 16 Oct 2026: "we wanted to make it random"):
  // the match's highlights always, a second video about half the time.
  let max = rng() < 0.5 ? 1 : MAX_VIDEOS_PER_MATCH;
  // Leo's 24 Oct update (updateFlags.ts): your goals' post always keeps its
  // video next to the highlights ("I don't EVER wanna wait … for MY GOALS").
  if (yourGoalVideoOn() && vids.some(p => p.eventId === "your-highlights") && vids.some(p => p.eventId === "match-highlights")) max = Math.max(max, 2);
  if (vids.length <= max) return;
  // The match's highlights and your goals' video stay (Leo, 8 Oct: every
  // match ALWAYS has them); anything else is the random one.
  const keep = new Set<StoredPost>([
    ...vids.filter(p => p.eventId === "match-highlights").slice(0, 1),
    ...vids.filter(p => p.eventId === "your-highlights").slice(0, 1),
  ]);
  const rest = vids.filter(p => !keep.has(p));
  for (const p of Array.from(keep).reverse()) if (keep.size > max) keep.delete(p);
  while (keep.size < max && rest.length) keep.add(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  for (let i = 0; i < posts.length; i++) {
    if (hasVideo(posts[i]) && !keep.has(posts[i]) && !exempt?.(posts[i])) posts[i] = { ...posts[i], graphic: undefined };
  }
}

/**
 * EVERY MATCH GETS ITS HIGHLIGHTS (Leo, 8 Oct 2026: "make sure after every
 * game there is ALWAYS at MINIMUM the highlights of the game (all the goals)
 * as well as some videos of your highlights and goals").
 *
 * Whatever the templates chose, two video posts are added straight after the
 * whistle: the match's highlights (every goal, both sides — recordings where
 * the goal was seen, made ones where it was not) from the competition's or
 * the club's account, and your goals and assists from your club. Both are
 * `priority`, so the phone makes them before any other match's videos.
 */
function highlightPosts(
  career: CareerState, r: MatchRecord, accounts: MediaAccount[], cycleId: string, cycleClock: number,
): StoredPost[] {
  const out: StoredPost[] = [];
  const clubAcc = accounts.find(a => a.archetype === "club" && a.allegiance?.club === r.club);
  const compAcc = accounts.find(a => a.archetype === "competition" && a.name === r.competition)
    // The league account is named after its division (accounts.ts), so a
    // League Two match finds the League Two account and never the Premier
    // League's.
    ?? accounts.find(a => a.archetype === "league" && a.name === r.competition);
  const home = r.home ? r.club : r.opponent, away = r.home ? r.opponent : r.club;
  const hs = r.home ? r.score.us : r.score.them, as = r.home ? r.score.them : r.score.us;
  const post = (acc: MediaAccount, key: string, minutes: number, text: string, title: string, reel: { clips: string[]; synth: SynthGoal[] }): StoredPost => {
    const rng = rngFor("post", cycleId, key, acc.id);
    return {
      id: `${cycleId}:${key}:${acc.id}`,
      at: cycleClock + minutes,
      author: {
        handle: acc.handle, name: acc.name, archetype: acc.archetype, platform: acc.platform, verified: acc.verified,
        initials: acc.avatar.initials, tint: acc.avatar.tint, tint2: acc.avatar.tint2, glyph: acc.avatar.glyph,
      },
      text,
      graphic: { type: "goalVideo", title, clips: reel.clips, ...(reel.synth.length ? { synth: reel.synth } : {}), priority: true,
        // Football Twitter: a made goal stands in for any recording this phone lacks.
        ...(footballTwitterOn() && reel.clips.length && standInsFor(r, reel.clips).length ? { standIn: standInsFor(r, reel.clips) } : {}) },
      metrics: metricsFor(acc.followers, 80, rng),
      ...(footballTwitterOn() ? {
        metrics: engagement(acc, 80, { aboutYou: key === "your-highlights", video: true }, rngFor("eng", cycleId, key, acc.id)),
        ...(key === "your-highlights" ? { aboutYou: true } : {}),
        ...(acc.tick ? { author: {
          handle: acc.handle, name: acc.name, archetype: acc.archetype, platform: acc.platform, verified: acc.verified,
          initials: acc.avatar.initials, tint: acc.avatar.tint, tint2: acc.avatar.tint2, glyph: acc.avatar.glyph, tick: acc.tick,
        } } : {}),
      } : {}),
      eventId: key,
      tags: ["goal"],
      scope: "club",
    };
  };

  // The match: every goal.
  if (hs + as > 0) {
    const all = matchReel(r, "all");
    const acc = compAcc ?? clubAcc;
    if (acc && (all.clips.length + all.synth.length) > 0) {
      out.push(post(acc, "match-highlights", 3, `HIGHLIGHTS | ${home} ${hs}-${as} ${away} · ${r.round ?? (r.kind === "international" ? r.competition : `Week ${r.week}`)}`, "HIGHLIGHTS", all));
    }
  }
  // Yours: your goals and the ones you set up.
  const yours = matchReel(r, "yours", r.you.name);
  if (clubAcc && (yours.clips.length + yours.synth.length) > 0) {
    const g = r.goals.filter(x => x.isUser).length;
    const a = r.goals.filter(x => !x.isUser && x.assist === r.you.name).length;
    const what = [g ? `${g} goal${g > 1 ? "s" : ""}` : "", a ? `${a} assist${a > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
    out.push(post(clubAcc, "your-highlights", 5, `${r.you.shortName} v ${r.opponent}: ${what} 🎥 (${r.round ?? (r.kind === "international" ? r.competition : `Week ${r.week}`)})`, `${r.you.shortName.toUpperCase()} | ${what.toUpperCase()}`, yours));
  }
  return out;
}

type Made = { post: StoredPost; templateId: string; facts: Facts; wantsVideo?: boolean };

// ── Football Twitter v2 (switch part "footballTwitter") ─────────────────────

/** A line is not used again by the same account for this many weeks (memory.ftSaid). */
export const FT_REPEAT_WEEKS = 6;
/** TikTok / clips pages' own videos per cycle (on top of the match's highlights). */
export const FT_VIDEOS_PER_CYCLE = 1;

/** The career week of a feed clock (season×64 + week). */
function ftWeek(clock: number): number {
  // ×64, not ×52: a season's calendar runs past week 52 (cup weeks), and its
  // last weeks must not read as the next season's first.
  return Math.floor(clock / 1_000_000) * 64 + Math.floor((clock % 1_000_000) / 10_000);
}

/** Lines used in the last FT_REPEAT_WEEKS weeks (older ones forgotten, so the save stays small). */
function freshSaid(said: Record<string, number> | undefined, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  // Cycles are not always stamped in order (the league's week, a career moment), so
  // "lately" is counted back from the newest week seen, not from this cycle.
  const top = Math.max(now, ...Object.values(said ?? {}));
  for (const [k, w] of Object.entries(said ?? {})) if (top - w < FT_REPEAT_WEEKS) out[k] = w;
  return out;
}

/** Who the feed should care about beyond your club: your rival and the top of the table. */
function ftContext(career: CareerState, said: Record<string, number>): FtContext {
  const leaders = sortLeague(career.league).slice(0, 3).map(t => t.name);
  const recent: Record<string, number> = {};
  for (const k of Object.keys(said)) {
    const at = k.indexOf("|");
    if (at > 0 && !k.startsWith("reply|") && !k.startsWith("quote|")) recent[k.slice(0, at)] = (recent[k.slice(0, at)] ?? 0) + 1;
  }
  return { rival: primaryRivalOf(career.player.club) ?? undefined, leaders, recent };
}

/**
 * Old lines that read wrong with Football Twitter on (Leo's list):
 *  - the tabloid/pundit/insider/meme manager lines all say he was SACKED
 *    ("AXED!"), so they never run for a manager arriving;
 *  - "im actually shaking. what a player" after a 4.9 rating.
 */
const SACKED_ONLY = new Set(["tb-manager", "in-manager", "pu-manager", "bs-manager", "meme-manager"]);
const PRAISE_NEEDS_RATING = new Set(["fan-goal-2"]);
function ftBlocked(templateId: string, e: FootballEvent): boolean {
  if (SACKED_ONLY.has(templateId) && e.id === "manager-in") return true;
  if (PRAISE_NEEDS_RATING.has(templateId)) {
    const r = Number(e.facts.rating);
    if (Number.isFinite(r) && r < 6.5) return true;
  }
  return false;
}

/**
 * Render with Football Twitter's rules: never a line this account used in
 * the last FT_REPEAT_WEEKS weeks, never a blocked line, and never a post
 * that talks about a video (or was written to carry one) without a playable
 * video. A rejected line is set aside and the next best one tried.
 */
function renderFt(
  p: Pairing, career: CareerState, record: MatchRecord | null, memory: StoryMemory, cycleId: string,
  usedThisCycle: Set<string>, slot: number, said: Record<string, number>, noMoreVideos: boolean,
): Made | null {
  const avoid = new Set(usedThisCycle);
  const prefix = `${p.account.id}|`;
  for (const k of Object.keys(said)) if (k.startsWith(prefix)) avoid.add(k.slice(prefix.length));
  for (let tries = 0; tries < 8; tries++) {
    const made = render(p, career, record, memory, cycleId, avoid, slot);
    if (!made) return null;
    const plays = graphicPlays(made.post.graphic);
    const bad = ftBlocked(made.templateId, p.event)
      || (made.wantsVideo && !plays)
      || (!plays && impliesVideo(made.post.text))
      || (noMoreVideos && plays && !!made.post.persona);
    if (!bad) {
      const g = made.post.graphic;
      if (g && g.type === "poll") made.post = { ...made.post, graphic: { ...g, votes: evenPoll(g.votes) } };
      // Every recorded goal gets a made stand-in (a phone without the recording still plays it).
      if (g && g.type === "goalVideo" && g.clips.length && !g.standIn && record) {
        const standIn = standInsFor(record, g.clips);
        if (standIn.length) made.post = { ...made.post, graphic: { ...g, standIn } };
      }
      return made;
    }
    if (avoid.has(made.templateId)) return null;
    avoid.add(made.templateId);
  }
  return null;
}

/** After a cycle: anything that still talks about a video it does not show goes. */
function ftTidy(posts: StoredPost[]): void {
  for (let i = posts.length - 1; i >= 0; i--) {
    const p = posts[i];
    if (breaksVideoRule(p)) {
      // A reply that mentions the video under a post that lost it: drop the reply, keep the post.
      const thread = p.thread?.filter(r => !impliesVideo(r.text));
      const fixed = { ...p, ...(thread ? { thread } : {}) };
      if (breaksVideoRule(fixed)) posts.splice(i, 1);
      else posts[i] = fixed;
    }
  }
}

function render(
  p: Pairing,
  career: CareerState,
  record: MatchRecord | null,
  memory: StoryMemory,
  cycleId: string,
  usedThisCycle: Set<string>,
  /** Where this post sits in the cycle. Used ONLY to keep the post's own key
   *  unique — see the id below. Deliberately not fed to `rngFor`, which would
   *  reshuffle every generated post in the game. */
  slot: number,
): Made | null {
  const { event, account } = p;
  const rng = rngFor("post", cycleId, event.id, account.id);
  const angle = chooseAngle(event, account, memory, cycleId);

  // Football Twitter: an invented account writes its own lines (twitter/).
  if (footballTwitterOn() && account.persona) {
    const prng = rngFor("persona", cycleId, event.id, account.id);
    if (account.personaShare === undefined || prng() < account.personaShare) {
      const own = renderPersona(p, career, record, memory, cycleId, usedThisCycle, slot, prng);
      if (own || account.personaShare === undefined) return own;
    }
  }

  const template = chooseTemplate(event, account.archetype, angle.frame, memory, rng, angle.useThread, usedThisCycle);
  if (!template) return null;

  const wantThread = angle.useThread && !!template.threadBody;
  const body = wantThread ? template.threadBody! : template.body;

  // Thread facts are flattened onto the fact bag so a template can write
  // `{thread.goals}` without the grammar needing to know what a thread is.
  const facts: Facts = { ...event.facts };
  if (event.thread) {
    for (const [k, v] of Object.entries(event.thread.facts)) facts[`thread.${k}`] = v;
  }

  const raw = resolve(body, facts, account.voice, rng);
  if (!raw.trim() || /\{|\}/.test(raw)) return null;   // an unresolved slot is a hole; drop it

  const hashtag = template.hashtag ? `#${String(facts.club ?? career.player.club).replace(/[^A-Za-z]/g, "")}` : undefined;
  const spoken = speak(raw, account.voice, event.tags, rng, hashtag);
  // Football Twitter: one old insider line borrowed a real reporter's catchphrase.
  const text = footballTwitterOn() ? spoken.replace(/\bHere we go\.?/g, "Deal done ✅") : spoken;

  const graphic = template.graphic
    ? buildGraphic(template.graphic, event, record, career, memory, rng)
    : undefined;

  const importance = event.importance ?? event.baseImportance;
  const season = record?.season ?? career.season;
  const week = record?.week ?? career.week;

  return {
    templateId: template.id,
    facts,
    wantsVideo: template.graphic === "goalVideo" || template.graphic === "thumbnail",
    post: {
      // ── Why the slot is in the key ──
      //
      // An event's id is its KIND ("win", "brace", "late-winner"), not its
      // subject — which is right, because that is what a template matches on.
      // But it means two different clubs winning in the same week produce two
      // events with the same id, and if the same account posts about both, two
      // posts with the same key. React then warns that "non-unique keys may
      // cause children to be duplicated and/or omitted", which is a real risk
      // of a post vanishing from the feed, not just console noise.
      //
      // Found by playtest, in the console, on the first visit to the phone:
      // `s1-w1-leagueweek:late-w…` collided the week the England tab started
      // reporting other clubs' matches — before that, every event in a cycle
      // was about your club and the clash could not arise.
      //
      // The slot is appended rather than the club being folded into the event
      // id, because the id is load-bearing for template matching, and rather
      // than being fed into `rngFor`, because that seeds every post's wording
      // and changing it would rewrite all of them.
      id: `${cycleId}:${event.id}:${account.id}:${slot}`,
      at: timeFor(season, week, event.window, rng()),
      author: {
        handle: account.handle,
        name: account.name,
        archetype: account.archetype,
        platform: account.platform,
        verified: account.verified,
        initials: account.avatar.initials,
        tint: account.avatar.tint,
        tint2: account.avatar.tint2,
        glyph: account.avatar.glyph,
        ...(footballTwitterOn() && account.tick ? { tick: account.tick } : {}),
      },
      text,
      graphic,
      metrics: metricsFor(account.followers, importance, rng),
      eventId: event.id,
      tags: event.tags,
      // Football Twitter: its numbers, tick and who it is about.
      ...(footballTwitterOn() ? ftFields(account, event, importance, !!graphic && graphic.type === "goalVideo", rngFor("eng", cycleId, event.id, account.id, slot)) : {}),
    },
  };
}

/** Football Twitter: views and quotes, the tick colour, and whether it is about you. */
function ftFields(account: MediaAccount, event: FootballEvent, importance: number, video: boolean, rng: () => number): Partial<StoredPost> {
  const aboutYou = event.subject.kind === "you";
  return {
    metrics: engagement(account, importance, { aboutYou, video }, rng),
    ...(aboutYou ? { aboutYou: true } : {}),
    ...(account.persona ? { persona: account.persona } : {}),
  };
}

/**
 * A Football Twitter account's own post (templates/twitter.ts): its own
 * line, its own typing, a poll of its own when the line has one.
 */
function renderPersona(
  p: Pairing, career: CareerState, record: MatchRecord | null, memory: StoryMemory, cycleId: string,
  usedThisCycle: Set<string>, slot: number, prng: () => number,
): Made | null {
  const { event, account } = p;
  const facts = derivedFacts(event, account, career, prng);
  const withFacts: FootballEvent = { ...event, facts };
  const template = choosePersonaTemplate(withFacts, account.persona!, memory, prng, usedThisCycle);
  if (!template) return null;
  const raw = resolve(template.body, facts, account.voice, prng);
  if (!raw.trim() || /\{|\}/.test(raw)) return null;
  const persona = personaById(account.persona!);
  const text = personaSpeak(raw, account.voice, persona?.emoji ?? [], prng);
  const youName = `${career.player.firstName} ${career.player.lastName}`;
  const graphic = template.graphic === "poll" && template.poll
    ? personaPoll(template.poll, facts, account.voice, prng, account.followers)
    // v2: a TikTok / clips page's video of YOUR goal: recorded where seen, made where not.
    : template.graphic === "goalVideo" && event.subject.kind === "you" && record
      ? yourGoalsVideo(record, youName, `${record.you.shortName.toUpperCase()} | ${account.name.toUpperCase()}`)
    : template.graphic ? buildGraphic(template.graphic, event, record, career, memory, prng) : undefined;
  const sound = account.platform === "tiktok" && graphicPlays(graphic) ? soundFor(account.persona, prng) : undefined;
  // A TikTok video carries its caption: the post's own first line as the hook,
  // the account's catchphrase as the reaction (both burnt into the edit).
  if (sound && graphic && graphic.type === "goalVideo") {
    const hook = raw.split("\n")[0].replace(/#[A-Za-z0-9_]+/g, "").replace(/\s+/g, " ").trim();
    const reaction = typeof facts.catch === "string" && facts.catch !== hook ? facts.catch : undefined;
    if (hook) graphic.captions = reaction ? [hook, reaction] : [hook];
  }
  const importance = event.importance ?? event.baseImportance;
  const season = record?.season ?? career.season;
  const week = record?.week ?? career.week;
  return {
    templateId: template.id,
    facts,
    wantsVideo: template.graphic === "goalVideo",
    post: {
      id: `${cycleId}:${event.id}:${account.id}:${slot}`,
      at: timeFor(season, week, event.window, prng()),
      author: {
        handle: account.handle, name: account.name, archetype: account.archetype, platform: account.platform,
        verified: account.verified, initials: account.avatar.initials, tint: account.avatar.tint,
        tint2: account.avatar.tint2, glyph: account.avatar.glyph,
        ...(account.tick ? { tick: account.tick } : {}),
      },
      text,
      graphic,
      metrics: { likes: 0, reposts: 0, replies: 0 },
      eventId: event.id,
      tags: event.tags,
      ...ftFields(account, event, importance, !!graphic && graphic.type === "goalVideo", rngFor("eng", cycleId, event.id, account.id, slot)),
      ...(sound ? { sound } : {}),
    },
  };
}

/**
 * Football Twitter, after a cycle's posts are made: replies under the big
 * ones, then a few quote-posts of them. Changes `posts` in place.
 */
function footballTwitterPass(
  posts: StoredPost[],
  made: { post: StoredPost; event: FootballEvent; facts: Facts; voice: MediaAccount["voice"] }[],
  accounts: MediaAccount[],
  cycleId: string,
  yourClub: string,
  scope: "club" | "league",
  /** Lines used lately (feed.ts ftSaid), read and added to. */
  said: Record<string, number>,
  now: number,
): void {
  const byId = new Map(made.map(m => [m.post.id, m]));
  const recentReplies = new Set(Object.keys(said).filter(k => k.startsWith("reply|")).map(k => k.slice(6)));
  const recentQuotes = new Set(Object.keys(said).filter(k => k.startsWith("quote|")).map(k => k.slice(6)));
  // Replies: the three most-liked posts of the cycle, and about half of the posts about you.
  const top = new Set([...posts].sort((a, b) => b.metrics.likes - a.metrics.likes).slice(0, 3).map(p => p.id));
  const usedReplies = new Set<string>();
  for (let i = 0; i < posts.length; i++) {
    const m = byId.get(posts[i].id);
    if (!m || !(top.has(posts[i].id) || (posts[i].aboutYou && rngFor("thread", posts[i].id)() < 0.5))) continue;
    const thread = replyThread(posts[i], m.event, m.facts, m.voice, rngFor("replies", posts[i].id), usedReplies, recentReplies);
    if (thread.length) posts[i] = { ...posts[i], thread };
  }
  const quotable = made.map(m => ({ ...m, post: posts.find(p => p.id === m.post.id) ?? m.post }));
  // Your goals' video (highlightPosts) can be quoted too, as your goal.
  const goal = made.find(m => m.event.subject.kind === "you" && m.event.tags.includes("goal"));
  const yours = posts.find(p => p.eventId === "your-highlights" && p.graphic);
  if (goal && yours) quotable.push({ ...goal, post: yours });
  const before = new Set(recentQuotes);
  // Quotes get their own replies too (round 4), from the same "not twice" lists.
  for (const q of quotePosts(quotable, accounts, cycleId, yourClub, recentQuotes, { cycleUsed: usedReplies, recent: recentReplies })) posts.push({ ...q, scope });
  usedReplies.forEach(l => { said[`reply|${l}`] = now; });
  recentQuotes.forEach(l => { if (!before.has(l)) said[`quote|${l}`] = now; });
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * What the player can see.
 *
 * The reveal is driven by NAVIGATION rather than by a timer, which is the only
 * honest way to do it in a game with no clock: walking out of the ground shows
 * you the immediate reaction, and going to the feed later in the week shows you
 * the rest — the write-ups, the back pages, Monday's awards. Same generated
 * cycle, two moments.
 *
 * "instant" and "hour" are measured from the CYCLE's clock, not the career's,
 * because crediting a match advances the week before any of this is shown.
 *
 * ── Both ends, not just one ──
 *
 * Every stage has a floor as well as a ceiling now. Straight out of the ground
 * you get THIS match and nothing else; the Feed keeps about a month. The
 * post-match screen used to be bounded only above, so its early `now` hid the
 * waves that had not landed yet and hid nothing at all of the four matches
 * before it — every one of which is timestamped earlier and therefore passed.
 * Four games in, the reaction to the game you had just played was at the bottom
 * of the pile.
 */
export function feedFor(
  career: CareerState,
  stage: "moment" | "settled" = "settled",
): { posts: StoredPost[]; trends: Trend[]; now: number } {
  const state = mediaOf(career);
  if (stage === "settled") {
    const now = clockAt(career.season, career.week, 9_999);
    // A post pinned in the Social Studio stays in the Feed however old it is.
    const old = state.posts.some(p => p.pinned)
      ? state.posts.filter(p => p.pinned && p.at < now - FEED_HORIZON) : [];
    const seen = visible(state.posts, now, now - FEED_HORIZON);
    // Football Twitter: the ranked "For you" order (twitter/engine.ts rankFeed).
    const shown = pinHighlights(footballTwitterOn() ? rankFeed(seen, now) : seen, state.lastMatchCycleId ?? state.lastCycleId);
    return { posts: studioShown(old.length ? [...shown, ...old] : shown, state.studio), trends: studioTrends(state.trends, state.studio), now };
  }
  // ── The first wave is the hour after, not the quarter of an hour ──
  //
  // It used to be the `instant` window alone. That was only ever safe because
  // the screen was showing a month of history behind it: a cycle whose events
  // all land in `hour` — a quiet win, a clean sheet, a run ticking over — puts
  // nothing at all in the first fifteen minutes, and the page would have been
  // blank. Walking out of the ground covers the hour after it; the write-ups,
  // the back pages and Monday's awards still wait for the Feed, which is where
  // the staging was always doing its work.
  // Your match stays on this screen even when a career post (Player of the
  // Month) was made after it, a week on: show from the match to that post.
  const match = state.lastMatchCycleClock;
  const since = match !== undefined && match <= state.lastCycleClock && state.lastCycleClock - match <= WEEK_SPAN
    ? match : state.lastCycleClock;
  const now = state.lastCycleClock + FIRST_WAVE;
  const shown = visible(state.posts, now, since)
    .filter(p => p.at >= state.lastCycleClock || p.at <= since + FIRST_WAVE)
    // Other matches' goal videos stay on the England tab of the Feed, never on
    // the post-match screen (Leo, 16 Oct 2026): this screen is your match's.
    .map(p => (p.scope === "league" && hasVideo(p) ? { ...p, graphic: undefined } : p))
    // Football Twitter: …and a post whose words were about that video is not shown here at all.
    .filter(p => !footballTwitterOn() || !breaksVideoRule(p));
  return { posts: studioShown(pinHighlights(footballTwitterOn() ? rankFeed(shown, now) : shown, state.lastMatchCycleId ?? state.lastCycleId), state.studio), trends: studioTrends(state.trends, state.studio), now };
}

/**
 * YOUR MATCH'S VIDEOS GO ON TOP (Leo, 8 Oct 2026: "I want to finish my match
 * and instantly see my loaded highlights of the game and my highlights, and
 * THEN see other matches"). The latest match's HIGHLIGHTS post and your-goals
 * post are pinned above everything else, in that order. They were dated three
 * minutes after the whistle, so newest-first put them 12th to 29th of 16–32
 * posts: below the fold, and so made last.
 */
/** One week of the feed clock (clockAt). */
const WEEK_SPAN = clockAt(1, 2, 0) - clockAt(1, 1, 0);

export function pinHighlights(posts: StoredPost[], cycleId: string): StoredPost[] {
  if (!cycleId) return posts;
  const rank = (p: StoredPost) =>
    !p.id.startsWith(`${cycleId}:`) ? 2 : p.eventId === "match-highlights" ? 0 : p.eventId === "your-highlights" ? 1 : 2;
  const top = posts.filter(p => rank(p) < 2).sort((a, b) => rank(a) - rank(b));
  if (!top.length) return posts;
  // Near the top, not AT the top (Mikey, 13 Oct 2026: "it should be kind of
  // random … no guarantee that there's a specific line … at the top"): each
  // goes somewhere in the first screenful (one of the first five places),
  // the same place every time you open this feed.
  // Mikey, 26 Oct 2026: still "consistently" first or second. Each now goes
  // in a random place from the 3rd to the 6th (still the first screenful,
  // Leo's rule), never the top two unless the feed is that short.
  const out = posts.filter(p => rank(p) === 2);
  const rng = rngFor("pin", cycleId);
  const lo = Math.min(2, out.length), hi = Math.max(lo, Math.min(5, out.length + top.length - 1));
  const placed: { p: StoredPost; at: number }[] = [];
  for (const p of top) {
    let at = lo + Math.floor(rng() * (hi - lo + 1));
    for (let t = 0; t < 6 && placed.some((x) => x.at === at); t++) at = lo + Math.floor(rng() * (hi - lo + 1));
    placed.push({ p, at });
  }
  // Lowest place first, so a later one never pushes an earlier one down.
  for (const { p, at } of placed.sort((a, b) => a.at - b.at)) out.splice(Math.min(out.length, at), 0, p);
  return out;
}

/**
 * Whether the last cycle produced anything worth interrupting the player for.
 *
 * Asked of exactly the slice the screen will show. It used to ask a broader
 * question — "did this cycle produce any post at all" — which includes the
 * write-ups and the back pages that do not land until later in the week. That
 * was harmless while the screen fell back to a month of history; with the
 * history correctly gone it would have opened on an empty page.
 */
export function hasFreshMedia(career: CareerState): boolean {
  const state = mediaOf(career);
  if (!state.lastCycleClock) return false;
  return feedFor(career, "moment").posts.length > 0;
}

/** How many posts have arrived since the player last opened the feed. */
export function unreadCount(career: CareerState, lastSeen: number): number {
  return mediaOf(career).posts.filter(p => p.at > lastSeen).length;
}

export { surname };
