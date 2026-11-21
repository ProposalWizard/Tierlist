/**
 * HOW MANY PEOPLE A PLACE MAY RUN (world kit, phase 1). A phone draws at most
 * 4 moving people and 8 in all; a computer on High 10 and 20
 * (docs/research/world-3d-2026-11-20.md "Scale"). Each frame `planBudget`
 * says, per person, whether his body animates this frame, every 2nd or 4th
 * frame (far away), or is frozen (off screen, or over the cap). Pure.
 * The caps sit beside the quality tiers (three3d/quality.ts TIER_PROFILES).
 */
import type { Quality3d } from "../three3d/quality";

export interface NpcBudget {
  /** People walking or playing a clip at full rate. */
  moving: number;
  /** People in the place at all (a routine may not bring in more). */
  present: number;
  /** Beyond this (m) a person animates every 2nd frame; past twice it, every 4th. */
  farM: number;
}

export const NPC_BUDGET: Record<Quality3d, NpcBudget> = {
  low: { moving: 2, present: 6, farM: 7 },
  medium: { moving: 4, present: 8, farM: 9 },
  high: { moving: 10, present: 20, farM: 14 },
};

/** A phone never goes past the phone caps, whatever its tier says. */
export function npcBudget(tier: Quality3d, phone: boolean): NpcBudget {
  const b = NPC_BUDGET[tier];
  return phone ? { moving: Math.min(b.moving, NPC_BUDGET.medium.moving), present: Math.min(b.present, NPC_BUDGET.medium.present), farM: Math.min(b.farM, NPC_BUDGET.medium.farM) } : b;
}

export interface BudgetIn { id: string; dist: number; onScreen: boolean; moving: boolean }
export interface BudgetOut { id: string; every: 0 | 1 | 2 | 4 }

/**
 * Who animates this frame. Nearest first: on screen and moving people get the
 * moving slots; seated or standing people still animate (cheaply, far ones
 * every 2nd/4th frame); off screen is frozen (every = 0).
 */
export function planBudget(people: BudgetIn[], b: NpcBudget): BudgetOut[] {
  const order = people.map((p, i) => ({ p, i })).sort((x, y) => x.p.dist - y.p.dist);
  let moving = 0;
  const out: BudgetOut[] = people.map((p) => ({ id: p.id, every: 0 }));
  for (const { p, i } of order) {
    if (!p.onScreen) { out[i].every = 0; continue; }
    const far: 1 | 2 | 4 = p.dist > b.farM * 2 ? 4 : p.dist > b.farM ? 2 : 1;
    if (p.moving) {
      if (moving < b.moving) { moving++; out[i].every = far; } else out[i].every = 4;
    } else out[i].every = far === 1 ? 2 : 4;
  }
  return out;
}

/** Does a person with `every` animate on frame `n`? (`slot` spreads them over frames.) */
export const animatesOn = (every: number, n: number, slot: number) => every > 0 && (n + slot) % every === 0;
