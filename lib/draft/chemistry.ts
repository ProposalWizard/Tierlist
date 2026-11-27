/**
 * lib/draft/chemistry.ts — FIFA-style chemistry for PL Draft (Leo, 27 Nov 2026:
 * "link between players thing like fifa chemistry was best idea").
 *
 * Starters next to each other on the pitch LINK:
 *   same club AND same season  3   (they really played together)
 *   same club, other season    2
 *   same nation                1
 * A player's chemistry = half his link points, at most 3, and only in a
 * position he can play (simulator fitness 0.85 or more). Team chemistry is
 * the eleven added up, at most 33.
 * Each chemistry point adds +1 to his overall and every stat for the season
 * (withChemistry), like FUT. Pure.
 */
import type { DraftPlayer } from "@/app/draft/page";
import { positionFitness } from "@/lib/seasonSimulator";
import { FORMATIONS, type Formation } from "@/components/draft/formations";

export const MAX_PLAYER_CHEM = 3;
export const MAX_TEAM_CHEM = 33;
/** Two spots link when they are this close on the pitch (percent of its size). */
export const LINK_DISTANCE = 33;

/** Which spots are next to each other in a formation (by position on the pitch). */
export function neighbours(f: Formation): number[][] {
  return f.slots.map((a, i) => f.slots
    .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
    .filter(({ j, d }) => j !== i && d <= LINK_DISTANCE)
    .map(({ j }) => j));
}

const season = (p: DraftPlayer) => (p.clubYear || "").split(" ").slice(1).join(" ");

export function linkStrength(a: DraftPlayer, b: DraftPlayer): number {
  if (a.club && a.club === b.club) return season(a) && season(a) === season(b) ? 3 : 2;
  if (a.nationality && a.nationality === b.nationality) return 1;
  return 0;
}

/** Each starter in his spot: slotIndex when known, else the first free spot with his label. */
export function placeStarters(players: readonly DraftPlayer[], f: Formation): (DraftPlayer | null)[] {
  const out: (DraftPlayer | null)[] = f.slots.map(() => null);
  const starters = players.filter((p) => !p.isSub);
  for (const p of starters) if (p.slotIndex !== undefined && p.slotIndex < out.length && !out[p.slotIndex]) out[p.slotIndex] = p;
  for (const p of starters) {
    if (out.includes(p)) continue;
    const i = f.slots.findIndex((s, k) => !out[k] && s.label === p.assignedPosition);
    if (i >= 0) out[i] = p;
  }
  return out;
}

export interface Chemistry { perSlot: number[]; team: number }

export function chemistry(players: readonly DraftPlayer[], formationName?: string): Chemistry {
  const f = FORMATIONS.find((x) => x.name === formationName) ?? FORMATIONS[0];
  const placed = placeStarters(players, f);
  const nb = neighbours(f);
  const perSlot = placed.map((p, i) => {
    if (!p) return 0;
    if (positionFitness({ ...p, assignedPosition: f.slots[i].label }) < 0.85) return 0;
    const pts = nb[i].reduce((s, j) => s + (placed[j] ? linkStrength(p, placed[j]!) : 0), 0);
    return Math.min(MAX_PLAYER_CHEM, Math.floor(pts / 2));
  });
  return { perSlot, team: perSlot.reduce((a, b) => a + b, 0) };
}

/** The squad as it plays the season: +1 overall and stats per chemistry point. Subs unchanged. */
export function withChemistry(players: readonly DraftPlayer[], formationName?: string): DraftPlayer[] {
  const f = FORMATIONS.find((x) => x.name === formationName) ?? FORMATIONS[0];
  const placed = placeStarters(players, f);
  const { perSlot } = chemistry(players, formationName);
  return players.map((p) => {
    const i = placed.indexOf(p);
    const c = i >= 0 ? perSlot[i] : 0;
    if (!c) return p;
    const bump = (v: unknown) => (typeof v === "number" ? Math.min(99, v + c) : v);
    const attrs = p.attrs ? (Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, bump(v)])) as unknown as typeof p.attrs) : p.attrs;
    return { ...p, overall: Math.min(99, p.overall + c), attrs };
  });
}

/** What a player would bring in a spot, for the pick screen: his own chemistry there. */
export function chemIfPlaced(players: readonly DraftPlayer[], candidate: DraftPlayer, slotIndex: number, formationName?: string): number {
  const trial = [...players.filter((p) => p.isSub || p.slotIndex !== slotIndex), { ...candidate, isSub: false, slotIndex }];
  return chemistry(trial, formationName).perSlot[slotIndex] ?? 0;
}
