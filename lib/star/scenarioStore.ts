import type { MatchScenario } from "./scenarios";

/**
 * SAVED SCENARIOS — LOCAL TO THIS BROWSER, ON PURPOSE.
 *
 * This is a draft tool for trying out how hard building one scenario
 * actually is, not the real feature yet — see scenarios.ts's own header.
 * Nothing here needs to be shared across devices or synced to a database
 * the way lineups eventually were (lineupStore.ts), so it stays the simple
 * localStorage-only shape that file started as, before that migration.
 */

const KEY = "star-scenarios-v1";

type Store = Record<string, MatchScenario>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(all: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // A full or blocked localStorage loses the draft and nothing else.
  }
}

export function listScenarios(): MatchScenario[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadScenario(id: string): MatchScenario | null {
  return read()[id] ?? null;
}

export function saveScenario(scenario: MatchScenario): void {
  const all = read();
  all[scenario.id] = { ...scenario, updatedAt: Date.now() };
  write(all);
}

export function deleteScenario(id: string): void {
  const all = read();
  delete all[id];
  write(all);
}
