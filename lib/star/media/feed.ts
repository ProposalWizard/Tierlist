import type { CareerState, Fixture, MatchStats } from "../types";
import type {
  CareerRecord, Facts, FootballEvent, MatchRecord, MediaAccount, MediaCycle,
  MediaState, StoredPost, StoryMemory, Trend,
} from "./types";
import { buildMatchRecord } from "./record";
import { detectCareer, detectMatch } from "./detect";
import { headlineEvent, scoreCareerEvents, scoreMatchEvents } from "./importance";
import { absorbEvents, absorbMatch, coolThreads, emptyMemory, markSaid } from "./memory";
import { buildRoster, selfAccount } from "./accounts";
import { selectPairings, type Pairing } from "./select";
import { chooseAngle } from "./narrate";
import { chooseTemplate } from "./templates";
import { buildGraphic } from "./graphics";
import { metricsFor, resolve, rngFor, speak, surname } from "./grammar";
import { clockAt, timeFor, visible, FEED_HORIZON, FIRST_WAVE } from "./schedule";
import { buildTrends } from "./trending";

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
  return { posts: [], memory: emptyMemory(), trends: [], lastCycleId: "", lastCycleClock: 0 };
}

export function mediaOf(career: CareerState): MediaState {
  return career.media ?? emptyMedia();
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
  if (state.lastCycleId === record.id) return state;

  // The run including today, then what the run makes true.
  const withMatch = absorbMatch(coolThreads(state.memory), record);
  const detected = detectMatch(record, withMatch);
  const scored = scoreMatchEvents(detected, record, withMatch);
  const { memory: withEvents, events } = absorbEvents(withMatch, scored, {
    season: record.season, week: record.week,
  });

  return commit(after, state, record, events, withEvents, record.id,
    clockAt(record.season, record.week, 0));
}

export function generateForCareer(career: CareerState, moment: CareerRecord["moment"], key: string): MediaState {
  const state = mediaOf(career);
  const id = `s${career.season}-w${career.week}-${key}`;
  if (state.lastCycleId === id) return state;

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
    context: { fame: career.fame, starRating: career.starRating, fansStanding: career.relationships.fans },
    moment,
  };

  const cooled = coolThreads(state.memory);
  const detected = detectCareer(record, cooled);
  const scored = scoreCareerEvents(detected, cooled, career.fame);
  const { memory, events } = absorbEvents(cooled, scored, { season: career.season, week: career.week });

  return commit(career, state, null, events, memory, id, clockAt(career.season, career.week, 0));
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
): MediaState {
  if (!events.length) return { ...state, memory, lastCycleId: cycleId, lastCycleClock: cycleClock };

  const accounts = [...buildRoster(career), selfAccount(career)];
  const pairings = selectPairings(events, accounts, cycleId, career.player.club);

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

  for (const p of pairings) {
    const made = render(p, career, record, memory, cycleId, usedThisCycle);
    if (!made) continue;
    if (recentText.has(made.post.text)) continue;
    recentText.add(made.post.text);
    usedThisCycle.add(made.templateId);
    posts.push(made.post);
    used.push(made.templateId);
  }

  const trends = buildTrends(events, posts, cycleId, career.fame);
  const all = [...state.posts, ...posts]
    .sort((a, b) => a.at - b.at)
    .slice(-POST_CAP);

  return {
    posts: all,
    memory: markSaid(memory, used),
    trends: trends.length ? trends : state.trends,
    lastCycleId: cycleId,
    lastCycleClock: cycleClock,
  };
}

function render(
  p: Pairing,
  career: CareerState,
  record: MatchRecord | null,
  memory: StoryMemory,
  cycleId: string,
  usedThisCycle: Set<string>,
): { post: StoredPost; templateId: string } | null {
  const { event, account } = p;
  const rng = rngFor("post", cycleId, event.id, account.id);
  const angle = chooseAngle(event, account, memory, cycleId);

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
  const text = speak(raw, account.voice, event.tags, rng, hashtag);

  const graphic = template.graphic
    ? buildGraphic(template.graphic, event, record, career, memory, rng)
    : undefined;

  const importance = event.importance ?? event.baseImportance;
  const season = record?.season ?? career.season;
  const week = record?.week ?? career.week;

  return {
    templateId: template.id,
    post: {
      id: `${cycleId}:${event.id}:${account.id}`,
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
      },
      text,
      graphic,
      metrics: metricsFor(account.followers, importance, rng),
      eventId: event.id,
      tags: event.tags,
    },
  };
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
    return { posts: visible(state.posts, now, now - FEED_HORIZON), trends: state.trends, now };
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
  const now = state.lastCycleClock + FIRST_WAVE;
  return { posts: visible(state.posts, now, state.lastCycleClock), trends: state.trends, now };
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
