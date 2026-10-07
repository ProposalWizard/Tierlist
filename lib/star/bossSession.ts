import { bossGain, BOSS_KICKS } from "./bossPenalties";

/**
 * EXTRA SESSION — one of the manager's three games (Harry, 6 Oct 2026;
 * MANAGER_PLAN.md). Four shots of Training's power drill while he watches,
 * on the real match engine. Each one is a level harder than the last.
 *
 * Goals are put on the penalties' own scale (BOSS_KICKS hits → bossGain):
 *   0 → −2 · 1 → +2 · 2 → +4 · 3 → +4 · 4 → +6.
 * Pure: the screen is components/star/relgames/BossExtraSession.tsx.
 */
export const SESSION_REPS = 4;
/** The power drill's training level for rep 0; each rep is one higher. */
export const SESSION_FIRST_LEVEL = 3;

export function sessionHits(goals: number): number {
  const g = Math.max(0, Math.min(SESSION_REPS, Math.round(goals)));
  return Math.round((g * BOSS_KICKS) / SESSION_REPS);
}

export function sessionGain(goals: number): number {
  return bossGain(sessionHits(goals));
}
