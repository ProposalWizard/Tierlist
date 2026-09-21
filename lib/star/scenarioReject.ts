/**
 * BINNED CHANCES — the ones not worth fixing.
 *
 * Asked for directly, looking at a bad one-on-one: "there should be a way to
 * just bin off a highlight and just say it's trash… I shouldn't have to fix
 * this. This should just never exist."
 *
 * ── Why this is not the same as a fault ──
 *
 * `scenarioRules.ts` catches what is WRONG — a defender goal-side, a
 * team-mate in your shot. The picture that prompted this broke none of those
 * and was still a poor chance: badly framed, bodies bunched, nothing
 * interesting to decide. No rule was going to catch that, and inventing one
 * to try would be the mistake this project has already made twice (a
 * plausible-looking rule that flagged 32.2% of pictures as broken when the
 * real figure was 0.64%).
 *
 * So a bin is not a rule. It is a person saying "not this one", recorded.
 *
 * ── What it is worth beyond skipping one picture ──
 *
 * Every binned chance remembers the authored drawing it was BUILT from. One
 * bin is noise; five bins against the same drawing is that drawing telling
 * you it produces bad chances, which is a thing you can act on — fix it or
 * delete it. `binsByBase` is what makes that visible.
 *
 * Kept in this browser. A bin is a judgement about a picture, not data the
 * game depends on, and getting it onto every device is not worth a table
 * until somebody asks.
 */

const KEY = "star-binned-chances-v1";

export interface BinnedChance {
  /** kind|seed|planId — the exact chance, so it is never served again. */
  key: string;
  kind: string;
  /** The authored drawing it was built from, when it came from one. */
  base: string | null;
  at: number;
}

export const binKey = (kind: string, seed: number, planId: string | null): string =>
  `${kind}|${seed}|${planId ?? ""}`;

type Store = Record<string, BinnedChance>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function write(all: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* a dev tool */ }
}

export function isBinned(kind: string, seed: number, planId: string | null): boolean {
  return !!read()[binKey(kind, seed, planId)];
}

export function binChance(kind: string, seed: number, planId: string | null, base: string | null): void {
  const all = read();
  const key = binKey(kind, seed, planId);
  all[key] = { key, kind, base, at: Date.now() };
  write(all);
}

export function unbinChance(kind: string, seed: number, planId: string | null): void {
  const all = read();
  delete all[binKey(kind, seed, planId)];
  write(all);
}

export function binnedList(): BinnedChance[] {
  return Object.values(read()).sort((a, b) => b.at - a.at);
}

export function binnedCount(kind?: string): number {
  const all = Object.values(read());
  return kind ? all.filter((b) => b.kind === kind).length : all.length;
}

/**
 * How many binned chances each authored drawing is responsible for, worst
 * first. A drawing near the top of this list is the one to go and look at.
 */
export function binsByBase(kind?: string): { base: string; bins: number }[] {
  const tally = new Map<string, number>();
  for (const b of Object.values(read())) {
    if (kind && b.kind !== kind) continue;
    if (!b.base) continue;
    tally.set(b.base, (tally.get(b.base) ?? 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([base, bins]) => ({ base, bins }))
    .sort((a, b) => b.bins - a.bins);
}
