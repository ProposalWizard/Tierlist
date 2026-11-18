/**
 * WHAT THE FLOW REMEMBERS BETWEEN SCREENS (not part of the career save).
 *
 * The website keeps these in React state on page.tsx (lastMatchStats,
 * playedFixture, lastStarChange, newsQueue, wonBallonDor, contractOfferReason,
 * the "already shown" sets). The phone keeps them here, saved on the phone so
 * a closed app comes back to the same post-match screen or the same step of
 * the season's end.
 */
import { useSyncExternalStore } from "react";
import type { Fixture, MatchStats } from "@/lib/star/types";
import type { BreakingNews } from "@/lib/star/breakingNews";
import type { MonthAward } from "@/lib/star/potm";
import { loadJson, saveJson } from "./save";

/** Everything the post-match screen shows (page.tsx's set* calls in handleMatchComplete). */
export interface MatchReport {
  stats: MatchStats;
  fixture: Fixture;
  /** Star rating before and after (lastStarChange). */
  starFrom: number;
  starTo: number;
  /** lastMatchStar: this match's points and the way to the next level. */
  star: { sp: number; base: number; mult: number; toNext: number; fromNext: number; gate?: string; total: number; extra: { label: string; sp: number; n?: number }[]; held?: number; carried?: number };
  /** lastRelChange */
  rel: { before: Rel; after: Rel };
  bootsWornOut: boolean;
  /** Achievement ids this match unlocked (lastMatchAch). */
  achievements: string[];
  /** Energy the rest days give back before the next match (energyBack). */
  energyBack: number | null;
  /** The knockout line (career.knockoutMessage) at full time. */
  knockout: string | null;
  /** Competition label when not a league game. */
  competition: string | null;
}
export interface Rel { boss: number; team: number; fans: number }

export interface Session {
  report: MatchReport | null;
  /** Breaking news cards waiting on Home (newsQueue). */
  news: BreakingNews[];
  /** Player of the Month you won, held until dismissed (potmWin). */
  potmWin: MonthAward | null;
  /** The Golden Ball verdict, carried to the rollover (wonBallonDor). */
  wonBallonDor: boolean;
  /** Why the club came to you with a contract (contractOfferReason). */
  contractReason: "form" | "star" | null;
  /** Knockout round-ups already shown (koShown). */
  koShown: string[];
  /** Play-off round-up already shown (roundupShown). */
  roundupShown: string | null;
  /** Drill picked on the Training screen (trainingSkill / trainingLevel). */
  training: { skill: string; level: number | null } | null;
}

const EMPTY: Session = { report: null, news: [], potmWin: null, wonBallonDor: false, contractReason: null, koShown: [], roundupShown: null, training: null };
const KEY = "career-flow-v1";

let current: Session = { ...EMPTY, ...(loadJson<Session>(KEY) ?? {}) };
const subs = new Set<() => void>();

export function getSession(): Session { return current; }
export function setSession(patch: Partial<Session> | ((s: Session) => Partial<Session>)) {
  const p = typeof patch === "function" ? patch(current) : patch;
  current = { ...current, ...p };
  saveJson(KEY, current);
  subs.forEach((f) => f());
}
export function resetSession() { setSession({ ...EMPTY }); }
export function useSession(): Session {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
}
