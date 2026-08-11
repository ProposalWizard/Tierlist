import type {
  FootballEvent, MatchDigest, MatchRecord, StoryMemory, StoryThread, Facts,
} from "./types";

/**
 * STORY MEMORY
 *
 * Streaks are easy: they are a counter you bump. "Six goals in his last three
 * matches" is not, because no single match contains that fact — it only exists
 * across three of them, and nothing in the game was keeping the string.
 *
 * A thread is the string. It opens on an event, gains heat every time something
 * reinforces it, cools when nothing does, and closes when it has gone cold. Its
 * accumulated facts are handed back to whoever is writing, so the stat account
 * can lead with a number that no detector ever detected.
 *
 * Threads also outlive a match, which is the difference between a rumour and a
 * saga: `transfer-linked:Milan` opened in January is still warm when the window
 * opens in June.
 */

const RECENT_MAX = 12;
const SAID_MAX = 40;
const HEAT_DECAY = 12;      // per week untouched
const HEAT_CLOSE = 20;      // below this it is over
const HEAT_MAX = 100;

export function emptyMemory(): StoryMemory {
  return {
    recent: [],
    streaks: {
      scoring: 0, assisting: 0, unbeaten: 0, winning: 0, losing: 0,
      cleanSheets: 0, drought: 0, scoringHome: 0,
    },
    threads: [],
    saidRecently: [],
    seen: {},
  };
}

/**
 * Roll the memory forward onto a finished match.
 *
 * Deliberately runs BEFORE detection, so a detector asking "how long is the
 * scoring run" gets the run INCLUDING today. The alternative reads better in the
 * code and worse in the feed: "he has scored in four straight" announced on the
 * fifth is the kind of off-by-one nobody reports as a bug and everybody notices.
 */
export function absorbMatch(memory: StoryMemory, r: MatchRecord): StoryMemory {
  const m: StoryMemory = {
    ...memory,
    recent: [digest(r), ...memory.recent].slice(0, RECENT_MAX),
    streaks: { ...memory.streaks },
    threads: memory.threads.map(t => ({ ...t, facts: { ...t.facts } })),
    seen: { ...memory.seen },
  };

  // International football is a different career. It does not break a club
  // scoring run and it does not extend a club unbeaten one.
  if (r.kind === "international") return m;

  const s = m.streaks;
  if (r.you.goals > 0) { s.scoring += 1; s.drought = 0; } else { s.scoring = 0; s.drought += 1; }
  s.assisting = r.you.assists > 0 ? s.assisting + 1 : 0;
  s.scoringHome = r.home && r.you.goals > 0 ? s.scoringHome + 1 : (r.home ? 0 : s.scoringHome);

  if (r.result === "win") { s.winning += 1; s.unbeaten += 1; s.losing = 0; }
  else if (r.result === "draw") { s.winning = 0; s.unbeaten += 1; s.losing = 0; }
  else { s.winning = 0; s.unbeaten = 0; s.losing += 1; }

  s.cleanSheets = r.score.them === 0 ? s.cleanSheets + 1 : 0;

  return m;
}

function digest(r: MatchRecord): MatchDigest {
  return {
    season: r.season,
    week: r.week,
    goals: r.you.goals,
    assists: r.you.assists,
    rating: r.you.rating,
    result: r.result,
    conceded: r.score.them,
    scored: r.score.us,
    opponent: r.opponent,
    competition: r.competition,
  };
}

/** Goals in the last N matches, from the digests. The "six in three" number. */
export function goalsInLast(memory: StoryMemory, n: number): number {
  return memory.recent.slice(0, n).reduce((sum, d) => sum + d.goals, 0);
}

export function assistsInLast(memory: StoryMemory, n: number): number {
  return memory.recent.slice(0, n).reduce((sum, d) => sum + d.assists, 0);
}

export function averageRating(memory: StoryMemory, n: number): number {
  const slice = memory.recent.slice(0, n);
  if (!slice.length) return 6.5;
  return slice.reduce((s, d) => s + d.rating, 0) / slice.length;
}

/**
 * How many times this has happened before.
 *
 * The single most important number in the engine for making a long career feel
 * different from a short one. A first hat-trick is news; a ninth is Tuesday, and
 * a media world that shouts equally about both is a media world nobody believes.
 */
export function timesSeen(memory: StoryMemory, eventId: string): number {
  return memory.seen[eventId] ?? 0;
}

// ── Threads ─────────────────────────────────────────────────────────────────

/**
 * Fold this cycle's events into the open stories.
 *
 * Every event carrying a `threadKey` either opens a thread or touches one.
 * Touching accumulates facts — that is where the arithmetic lives — and the
 * thread is then attached back onto the event so the narration stage can decide
 * whether to lead with the running story or with today.
 */
export function absorbEvents(
  memory: StoryMemory,
  events: FootballEvent[],
  at: { season: number; week: number },
): { memory: StoryMemory; events: FootballEvent[] } {
  const threads = memory.threads.map(t => ({ ...t, facts: { ...t.facts } }));
  const seen = { ...memory.seen };

  const out = events.map((e) => {
    seen[e.id] = (seen[e.id] ?? 0) + 1;
    if (!e.threadKey) return e;

    let t = threads.find(x => x.key === e.threadKey);
    if (!t) {
      t = { key: e.threadKey, opened: at, touched: at, heat: 0, facts: {} };
      threads.push(t);
    }
    t.touched = at;
    t.heat = Math.min(HEAT_MAX, t.heat + Math.max(14, Math.round(e.baseImportance * 0.45)));
    t.facts = accumulate(t.facts, e.facts);

    return { ...e, thread: { key: t.key, facts: { ...t.facts }, heat: t.heat } };
  });

  return { memory: { ...memory, threads, seen }, events: out };
}

/**
 * What a thread knows.
 *
 * The first version of this SUMMED goals across every event that touched the
 * thread and counted matches as touches. Over a season the form thread reached
 * "67 goals in 25 matches", because a hat-trick fires four detectors and every
 * one of them touched it. It was the right instinct and completely the wrong
 * mechanism.
 *
 * A thread does not do arithmetic. The run detectors already do it properly —
 * `red-hot` reads goalsInLast(memory, 3) and `scoring-run` reads the streak — so
 * a thread's job is only to carry the latest authoritative pair forward and to
 * remember that the story is still open. Facts are replaced, never added, and
 * only by events that actually carry them.
 *
 * A pair is authoritative when it comes with its own window: `matches` present
 * means the detector measured over a span, so `goals`/`assists` beside it mean
 * "in that span". Without it, a count is about today and belongs to today.
 */
function accumulate(into: Facts, from: Facts): Facts {
  const out: Facts = { ...into };
  const measured = typeof from.matches === "number" && from.matches > 1;
  for (const [k, v] of Object.entries(from)) {
    if (!measured && (k === "goals" || k === "assists" || k === "matches")) continue;
    out[k] = v;
  }
  return out;
}

/** A week has passed. Threads nobody has fed go cold and eventually close. */
export function coolThreads(memory: StoryMemory): StoryMemory {
  const threads = memory.threads
    .map(t => ({ ...t, heat: t.heat - HEAT_DECAY }))
    .filter(t => t.heat >= HEAT_CLOSE);
  return { ...memory, threads };
}

export function threadFor(memory: StoryMemory, key: string): StoryThread | undefined {
  return memory.threads.find(t => t.key === key);
}

/** The warmest open story, for the trending list and for the pundits. */
export function hottestThread(memory: StoryMemory): StoryThread | undefined {
  return [...memory.threads].sort((a, b) => b.heat - a.heat)[0];
}

// ── Anti-repetition ─────────────────────────────────────────────────────────

export function markSaid(memory: StoryMemory, templateIds: string[]): StoryMemory {
  return { ...memory, saidRecently: [...templateIds, ...memory.saidRecently].slice(0, SAID_MAX) };
}

export function saidLately(memory: StoryMemory, templateId: string): boolean {
  return memory.saidRecently.includes(templateId);
}
