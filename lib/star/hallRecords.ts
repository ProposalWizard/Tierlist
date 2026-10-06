/**
 * YOUR LEGEND LIVES ON — your retired careers' bests, as records to chase.
 *
 * Leo, 6 Oct 2026 (the plans page, "Your records live on"): every later
 * career on your account shows your best-ever numbers as records to beat.
 *   - The Records page gets a "Hall of Fame records" group: "Most goals in a
 *     season: 51, Jamie Calloway, 2037/38".
 *   - As you get close, a line on Home: "3 goals off Calloway's record".
 *   - Beat one: a moment on screen and news posts, and the record shows you,
 *     with "was: Calloway, 51".
 *
 * Pure. Everything is read from the Hall of Fame (hallOfFame.ts): the slim
 * copy of a retired career keeps every number needed. Own careers only — one
 * Hall per account — until careers can be shared online.
 */
import type { CareerState } from "./types";
import type { HallEntry } from "./hallOfFame";

const longSeason = (startYear: number, season: number): string => {
  const y = startYear + season - 1;
  return `${y}/${String(y + 1).slice(2)}`;
};

export type HallRecordScope = "season" | "match" | "career";

export interface HallRecordDef {
  id: string;
  icon: string;
  /** "Most goals in a season". */
  label: string;
  /** "goals" — and the word for one ("goal"). */
  unit: string;
  unitOne: string;
  scope: HallRecordScope;
  /** A career's best, and the season it came in when that is known. */
  best: (c: CareerState) => { value: number; season?: number } | null;
  /**
   * What a career still being played is chasing right now. A season record
   * is chased with THIS season's number (an earlier season is over); absent
   * for a record that can't be "close" between matches (the most in one game).
   */
  now?: (c: CareerState) => number;
}

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export const HALL_RECORDS: HallRecordDef[] = [
  {
    id: "goals-season", icon: "📈", label: "Most goals in a season", unit: "goals", unitOne: "goal", scope: "season",
    best: c => {
      const b = c.careerBests?.mostGoalsSeason;
      if (b && b.goals > 0) return { value: b.goals, season: b.season };
      const rows = c.seasonArchive ?? [];
      const top = [...rows].sort((a, b2) => b2.goals - a.goals)[0];
      return top && top.goals > 0 ? { value: top.goals, season: top.season } : null;
    },
    now: c => n(c.seasonStats?.goals),
  },
  {
    id: "assists-season", icon: "🅰️", label: "Most assists in a season", unit: "assists", unitOne: "assist", scope: "season",
    best: c => {
      const b = c.careerBests?.mostAssistsSeason;
      if (b && b.assists > 0) return { value: b.assists, season: b.season };
      const rows = c.seasonArchive ?? [];
      const top = [...rows].sort((a, b2) => b2.assists - a.assists)[0];
      return top && top.assists > 0 ? { value: top.assists, season: top.season } : null;
    },
    now: c => n(c.seasonStats?.assists),
  },
  {
    id: "goals-match", icon: "⚽", label: "Most goals in a game", unit: "goals", unitOne: "goal", scope: "match",
    best: c => {
      const b = c.careerBests?.mostGoalsMatch;
      return b && b.goals > 0 ? { value: b.goals, season: b.season } : null;
    },
  },
  {
    id: "goals-career", icon: "🥅", label: "Most career goals", unit: "goals", unitOne: "goal", scope: "career",
    best: c => (n(c.careerStats?.goals) > 0 ? { value: n(c.careerStats.goals) } : null),
    now: c => n(c.careerStats?.goals),
  },
  {
    id: "assists-career", icon: "🎯", label: "Most career assists", unit: "assists", unitOne: "assist", scope: "career",
    best: c => (n(c.careerStats?.assists) > 0 ? { value: n(c.careerStats.assists) } : null),
    now: c => n(c.careerStats?.assists),
  },
  {
    id: "apps-career", icon: "👕", label: "Most appearances", unit: "appearances", unitOne: "appearance", scope: "career",
    best: c => (n(c.careerStats?.appearances) > 0 ? { value: n(c.careerStats.appearances) } : null),
    now: c => n(c.careerStats?.appearances),
  },
  {
    id: "trophies", icon: "🏆", label: "Most trophies", unit: "trophies", unitOne: "trophy", scope: "career",
    best: c => ((c.trophies?.length ?? 0) > 0 ? { value: c.trophies.length } : null),
    now: c => c.trophies?.length ?? 0,
  },
  {
    id: "ballon-dors", icon: "🏅", label: "Most Ballons d'Or", unit: "Ballons d'Or", unitOne: "Ballon d'Or", scope: "career",
    best: c => (n(c.ballonDorWins) > 0 ? { value: n(c.ballonDorWins) } : null),
    now: c => n(c.ballonDorWins),
  },
  {
    id: "furthest-goal", icon: "🚀", label: "Furthest goal", unit: "m", unitOne: "m", scope: "match",
    best: c => {
      const b = c.careerBests?.furthestGoal;
      return b && b.metres > 0 ? { value: Math.round(b.metres), season: b.season } : null;
    },
  },
];

/** One career's mark on a record. */
export interface HallMark {
  entryId: string;
  name: string;
  value: number;
  season?: number;
  /** "2037/38" when the season is known. */
  seasonLabel?: string;
}

export interface HallRecord {
  def: HallRecordDef;
  /** The best of every career in the Hall. */
  holder: HallMark;
  /** Who held it before, in the order the careers went in (oldest first). */
  history: HallMark[];
}

const markOf = (def: HallRecordDef, e: HallEntry): HallMark | null => {
  let b: { value: number; season?: number } | null = null;
  try { b = def.best(e.career); } catch { b = null; }
  if (!b || !(b.value > 0)) return null;
  const startYear = e.career.player?.startYear ?? e.card.firstYear;
  return {
    entryId: e.id,
    name: e.card.name,
    value: b.value,
    ...(b.season ? { season: b.season, seasonLabel: longSeason(startYear, b.season) } : {}),
  };
};

/**
 * Every record the Hall holds. A record goes to the first career that set
 * it: a later career only takes it by beating it, never by equalling it, and
 * the one it took it from goes in the record's history.
 */
export function hallRecordBook(entries: HallEntry[]): HallRecord[] {
  const oldestFirst = [...entries].sort((a, b) => a.addedAt - b.addedAt);
  const out: HallRecord[] = [];
  for (const def of HALL_RECORDS) {
    let holder: HallMark | null = null;
    const history: HallMark[] = [];
    for (const e of oldestFirst) {
      const m = markOf(def, e);
      if (!m) continue;
      if (!holder || m.value > holder.value) {
        if (holder) history.push(holder);
        holder = m;
      }
    }
    if (holder) out.push({ def, holder, history });
  }
  return out;
}

export interface HallChase {
  record: HallRecord;
  /** This career's best so far (every season, every game). */
  you: number;
  /** Beaten: strictly more than the holder. */
  beaten: boolean;
  /** What is being chased right now (this season's number for a season record). */
  now: number;
}

/** This career against every Hall record. */
export function hallChases(career: CareerState, book: HallRecord[]): HallChase[] {
  return book.map(record => {
    let you = 0;
    try { you = record.def.best(career)?.value ?? 0; } catch { you = 0; }
    let now = you;
    try { if (record.def.now) now = record.def.now(career); } catch { now = you; }
    return { record, you, beaten: you > record.holder.value, now };
  });
}

/** "Calloway" from "Jamie Calloway". */
export function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

/**
 * The one line for Home, or null: the closest record still to beat that is
 * within reach. "3 goals off Calloway's record". A season record counts this
 * season only; a record for one game is never "close".
 */
export function hallChaseLine(career: CareerState, book: HallRecord[]): { text: string; recordId: string } | null {
  let best: { text: string; recordId: string; ratio: number } | null = null;
  for (const c of hallChases(career, book)) {
    const { def, holder } = c.record;
    if (c.beaten || !def.now || def.scope === "match") continue;
    const gap = holder.value - c.now;
    if (gap < 0) continue;
    const reach = def.scope === "season"
      ? Math.max(2, Math.round(holder.value * 0.2))
      : Math.max(2, Math.round(holder.value * 0.1));
    if (gap > reach || (def.scope === "season" && c.now <= 0)) continue;
    const who = surnameOf(holder.name);
    const text = gap === 0
      ? `Level with ${who}'s record — one more beats it`
      : `${gap} ${gap === 1 ? def.unitOne : def.unit} off ${who}'s record`;
    const ratio = gap / Math.max(1, holder.value);
    if (!best || ratio < best.ratio) best = { text, recordId: def.id, ratio };
  }
  return best ? { text: best.text, recordId: best.recordId } : null;
}

/** Records this career has beaten and not yet celebrated (see CareerState.hallRecordsBroken). */
export function freshHallRecords(career: CareerState, book: HallRecord[]): HallChase[] {
  const done = new Set(career.hallRecordsBroken ?? []);
  return hallChases(career, book).filter(c => c.beaten && !done.has(c.record.def.id));
}

/** "52 goals" / "1 Ballon d'Or" / "64 m". */
export function amount(def: HallRecordDef, value: number): string {
  if (def.unit === "m") return `${value} m`;
  return `${value} ${value === 1 ? def.unitOne : def.unit}`;
}
