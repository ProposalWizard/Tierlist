/**
 * THE INTERNATIONAL WORLD — every national team's matches, played out in date
 * order from the start of the game (August 2026) to the end of the season
 * you are in.
 *
 * Mikey, 12 Oct 2026: build every competition and its qualifying, simulate
 * all of it, keep full detail for your own country and "the winner and the
 * runner-up" (the final) for the rest.
 *
 * How it stays small in the save: nothing here is stored. The world is
 * REPLAYED from three small things the save keeps (see `WorldInputs`):
 *   - each season's player-strength adjustment per nation (the real players
 *     the save knew at that season's start — strength.ts), so a nation with
 *     a full squad of real players plays to it;
 *   - your own national-team results (the matches you played in the engine);
 *   - the seed of your career.
 * Every other result comes from a seed made from the match's id, so a replay
 * always gives the same results.
 *
 * FIFA ranking points move after every match with FIFA's own formula
 * (Wikipedia, "FIFA Men's World Ranking", read 12 Oct 2026):
 *   P = P_before + I × (W − We),  We = 1 / (10^(−Δ/600) + 1)
 *   W: win 1, shoot-out win 0.75, draw or shoot-out loss 0.5, loss 0
 *   I: friendly 10, Nations League group 15, Nations League play-offs and
 *      finals 25, qualifiers 25, continental finals 35 (40 from the
 *      quarter-finals), World Cup 50 (60 from the quarter-finals)
 *   A knockout loss at a final tournament never costs points.
 * Strength for a match = the ranking strength of the points at that moment
 * (nations.ts) + that season's player adjustment.
 *
 * Pure: no React, no storage.
 */
import { NATIONS, rankingStrength, nationFor } from "./nations";
import {
  type Match, type Score, type Rng, type LevelRule, rngFor, ninety, extraTime, shootout,
  played, winnerOf, loserOf,
} from "./engine";

export const WORLD_START = Date.UTC(2026, 7, 1);
const DAY = 86_400_000;
const REVERT = 0.15;

export type CompKind =
  | "World Cup" | "World Cup Qualifier" | "World Cup Play-Off"
  | "European Championship" | "Euro Qualifier" | "Nations League"
  | "Copa América" | "Africa Cup of Nations" | "AFCON Qualifier"
  | "Asian Cup" | "Asian Cup Qualifier" | "Gold Cup" | "Gold Cup Qualifier"
  | "CONCACAF Nations League" | "OFC Nations Cup" | "International Friendly";

export interface WorldMatch extends Match {
  date: number;
  comp: CompKind;
  /** The edition, e.g. "EURO-2028", "WCQ-UEFA-2030", "NL-2026". */
  edition: string;
  /** "Group B · Matchday 2", "Quarter-Final · Leg 1", "Final". */
  stage: string;
  /** FIFA ranking importance (I). */
  importance: number;
  /** A knockout match at a final tournament (a loss costs no points). */
  finalsKnockout?: boolean;
  /** What a level knockout match goes to (absent: a draw stands). */
  level?: LevelRule;
  /** The second leg of a two-legged tie: the first leg's id. */
  firstLeg?: string;
  /** Host nation playing at home in its own tournament. */
  hostHome?: boolean;
  /** Group letter/name for a group-stage match ("A", "B1", "Path 2"). */
  group?: string;
}

export interface Final {
  edition: string;
  comp: CompKind;
  /** Year it was played. */
  year: number;
  winner: string;
  runnerUp: string;
  hs: number;
  as: number;
  pens?: Score;
  et?: boolean;
  home: string;
}

/** What the save gives the world to replay from. */
export interface WorldInputs {
  /** Season → nation → player adjustment (strength points). Absent: 0. */
  xi: Record<number, Record<string, number>>;
  /** Your results, by match id: your side's view is already folded in. */
  played: Record<string, { hs: number; as: number; pens?: Score; et?: boolean }>;
  /** The game's first season's start year (2026 for 2026/27). */
  firstYear: number;
}

/** Club season (August–July) a date falls in, as the game's season number. */
export function seasonOfDate(t: number, firstYear: number): number {
  const d = new Date(t);
  const y = d.getUTCFullYear() - (d.getUTCMonth() < 7 ? 1 : 0);
  return y - firstYear + 1;
}

type Event = { at: number; seq: number; run: () => void };

export class World {
  readonly inputs: WorldInputs;
  readonly points = new Map<string, number>();
  readonly matches: WorldMatch[] = [];
  readonly byId = new Map<string, WorldMatch>();
  readonly byEdition = new Map<string, WorldMatch[]>();
  readonly finals: Final[] = [];
  /** Facts competitions leave for later ones (who qualified, NL leagues…). */
  readonly facts = new Map<string, unknown>();
  /** Nations with a match on a date (noon timestamp), for friendlies. */
  private onDate = new Map<number, Set<string>>();
  private events: Event[] = [];
  private seq = 0;
  /**
   * Matches the replay must not play yet: your nation's, while the squad for
   * them has not been named (career.ts sets it). `run` stops in front of the
   * first one, so the world never decides a match you might be picked for.
   */
  hold?: (m: WorldMatch) => boolean;
  /** Unplayed matches, sorted by date (then order added). */
  private queue: WorldMatch[] = [];
  private clock = WORLD_START;

  /**
   * The rating results are played from. FIFA's own points (above) never drop
   * after a knockout loss at a final tournament, so over twenty years they
   * only climb for whoever reaches knockouts often (measured: Canada +555,
   * Nigeria +550 by 2046, both as strong as Spain). Playing strength uses the
   * same formula without that exception (every match gives what it takes),
   * and drifts 15% back towards the July 2026 ranking every summer, so the
   * football world stays recognisable while still having eras; the real
   * players the save knows move it on top (see `strength`).
   */
  readonly rating = new Map<string, number>();
  private readonly base = new Map<string, number>();

  constructor(inputs: WorldInputs) {
    this.inputs = inputs;
    for (const n of NATIONS) {
      this.points.set(n.name, n.points);
      this.rating.set(n.name, n.points);
      this.base.set(n.name, n.points);
    }
    for (let y = 2027; y <= 2060; y++) {
      this.at(Date.UTC(y, 6, 25), () => {
        for (const [n, r] of Array.from(this.rating.entries())) {
          this.rating.set(n, r + REVERT * ((this.base.get(n) ?? r) - r));
        }
      });
    }
  }

  /** Now, inside the replay. */
  get now(): number { return this.clock; }

  /** Run `fn` at `at` (before that day's matches). */
  at(at: number, fn: () => void): void {
    this.events.push({ at, seq: this.seq++, run: fn });
  }

  add(m: WorldMatch): WorldMatch {
    if (this.byId.has(m.id)) return this.byId.get(m.id)!;
    this.matches.push(m);
    const day = this.onDate.get(m.date) ?? new Set<string>();
    day.add(m.home); day.add(m.away);
    this.onDate.set(m.date, day);
    // Binary insert into the queue (stable: after equal dates).
    let lo = 0, hi = this.queue.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.queue[mid].date <= m.date) lo = mid + 1; else hi = mid; }
    this.queue.splice(lo, 0, m);
    this.byId.set(m.id, m);
    const list = this.byEdition.get(m.edition) ?? [];
    list.push(m);
    this.byEdition.set(m.edition, list);
    return m;
  }

  busyOn(date: number): Set<string> {
    return this.onDate.get(date) ?? new Set<string>();
  }

  edition(id: string): WorldMatch[] {
    return this.byEdition.get(id) ?? [];
  }

  /** Strength of a nation on a date: ranking points + the season's players. */
  strength(nation: string, t: number = this.clock): number {
    const pts = this.rating.get(nation) ?? 1192;
    const season = seasonOfDate(t, this.inputs.firstYear);
    const xi = this.inputs.xi[season]?.[nation] ?? this.latestXi(nation, season);
    return Math.max(35, Math.min(95, rankingStrength(pts) + xi));
  }

  private latestXi(nation: string, season: number): number {
    for (let s = season - 1; s >= 1; s--) {
      const v = this.inputs.xi[s]?.[nation];
      if (v !== undefined) return v;
    }
    return 0;
  }

  /** FIFA ranking order right now (best first). */
  ranking(): string[] {
    return Array.from(this.points.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }

  rankOf = (nation: string): number => {
    const pts = this.points.get(nation);
    if (pts === undefined) return 999;
    let r = 1;
    for (const v of Array.from(this.points.values())) if (v > pts) r++;
    return r;
  };

  /** Run everything up to (and including) `until`. */
  run(until: number): void {
    this.events.sort((a, b) => a.at - b.at || a.seq - b.seq);
    let sorted = true;
    for (let guard = 0; guard < 5_000_000; guard++) {
      if (!sorted) { this.events.sort((a, b) => a.at - b.at || a.seq - b.seq); sorted = true; }
      const nextEvent = this.events[0];
      const pending = this.queue[0];
      const evAt = nextEvent ? nextEvent.at : Infinity;
      const mAt = pending ? pending.date : Infinity;
      if (!nextEvent && !pending) break;
      if (!(Math.min(evAt, mAt) <= until)) break;
      if (pending && this.hold?.(pending) && evAt > mAt) break;
      if (evAt <= mAt) {
        this.events.shift();
        this.clock = Math.max(this.clock, evAt);
        const before = this.events.length;
        nextEvent!.run();
        if (this.events.length !== before) sorted = false;
      } else {
        this.queue.shift();
        this.clock = Math.max(this.clock, mAt);
        if (!played(pending!)) this.play(pending!);
      }
    }
    this.clock = Math.max(this.clock, until);
  }

  private play(m: WorldMatch): void {
    const rng: Rng = rngFor(`m|${m.id}`);
    const t = m.date;
    const hS = this.strength(m.home, t), aS = this.strength(m.away, t);
    const neutral = !!m.neutral && !m.hostHome;
    const yours = this.inputs.played[m.id];
    let r: { hs: number; as: number; et?: boolean; pens?: Score };
    if (yours) {
      r = { ...yours };
      // A knockout your result left level with no shoot-out (a match you
      // missed, simulated by the club calendar): settle it on penalties.
      if (!r.pens) {
        const f = m.firstLeg ? this.byId.get(m.firstLeg) : null;
        const level = m.firstLeg ? !!f && played(f) && f.hs! + r.as === f.as! + r.hs : !!m.level && r.hs === r.as;
        if (level) r.pens = shootout(hS, aS, rng);
      }
    } else {
      r = ninety(hS, aS, neutral, rng);
      if (m.firstLeg) {
        const f = this.byId.get(m.firstLeg);
        if (f && played(f)) {
          const aggA = f.hs! + r.as, aggB = f.as! + r.hs; // first leg's home vs away
          if (aggA === aggB) {
            const e = extraTime(hS, aS, neutral, rng);
            r = { hs: r.hs + e.hs, as: r.as + e.as, et: true };
            if (f.hs! + r.as === f.as! + r.hs) r.pens = shootout(hS, aS, rng);
          }
        }
      } else if (m.level && r.hs === r.as) {
        if (m.level === "et-pens") {
          const e = extraTime(hS, aS, neutral, rng);
          r = { hs: r.hs + e.hs, as: r.as + e.as, et: true };
        }
        if (r.hs === r.as) r.pens = shootout(hS, aS, rng);
      }
    }
    Object.assign(m, r);
    this.rank(m, hS, aS);
  }

  /** FIFA's formula, both teams at once. */
  private rank(m: WorldMatch, _hS: number, _aS: number): void {
    const ph = this.points.get(m.home), pa = this.points.get(m.away);
    if (ph === undefined || pa === undefined) return;
    let wh: number, wa: number;
    if (m.hs! > m.as!) { wh = 1; wa = 0; }
    else if (m.hs! < m.as!) { wh = 0; wa = 1; }
    else if (m.pens && !m.firstLeg) { wh = m.pens.hs > m.pens.as ? 0.75 : 0.5; wa = m.pens.hs > m.pens.as ? 0.5 : 0.75; }
    else { wh = 0.5; wa = 0.5; }
    // A two-legged second leg counts as an ordinary match (the shoot-out is
    // disregarded), which is what the branch above does by ignoring pens.
    const weH = 1 / (Math.pow(10, -(ph - pa) / 600) + 1);
    const dh = m.importance * (wh - weH), da = m.importance * (wa - (1 - weH));
    this.points.set(m.home, ph + Math.max(dh, m.finalsKnockout ? 0 : dh));
    this.points.set(m.away, pa + Math.max(da, m.finalsKnockout ? 0 : da));
    // Playing rating: the same formula on its own numbers, no exception.
    const rh = this.rating.get(m.home)!, ra = this.rating.get(m.away)!;
    const reH = 1 / (Math.pow(10, -(rh - ra) / 600) + 1);
    this.rating.set(m.home, rh + m.importance * (wh - reH));
    this.rating.set(m.away, ra + m.importance * (wa - (1 - reH)));
  }

  /** Record a final for the "Who won" list. */
  final(edition: string, comp: CompKind, m: WorldMatch): void {
    const w = winnerOf(m), l = loserOf(m);
    if (!w || !l) return;
    this.finals.push({
      edition, comp, year: new Date(m.date).getUTCFullYear(), winner: w, runnerUp: l,
      hs: m.hs!, as: m.as!, pens: m.pens, et: m.et, home: m.home,
    });
  }
}

// ── Helpers competitions share ──────────────────────────────────────────────

export const noon = (d: Date | number) => {
  const t = typeof d === "number" ? d : d.getTime();
  return Math.floor(t / DAY) * DAY + 12 * 3_600_000;
};

export const dayAfter = (t: number, n = 1) => Math.floor(t / DAY) * DAY + n * DAY;

export function isNation(name: string): boolean {
  return !!nationFor(name);
}
