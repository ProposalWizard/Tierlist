import { normaliseScenarioCamera } from "./scenarios";
import type { MatchScenario } from "./scenarios";

/**
 * SAVED SCENARIOS.
 *
 * ── One shared answer, not one per browser ──
 *
 * These used to live ONLY here — localStorage, one browser, invisible to
 * every other device and every other person. This file's own header said so
 * and pointed at `lineupStore.ts`'s Supabase upgrade as the step to take
 * once these stopped being throwaway drafts. That step is taken: every
 * scenario is now also a row in Supabase's `star_scenarios` table (see
 * app/api/star/scenarios/route.ts and supabase/migrations/star_scenarios.sql),
 * which is the real, shared answer everyone reads.
 *
 * localStorage stays in front of it as a SYNCHRONOUS read cache, exactly as
 * in lineupStore.ts: `listScenarios`/`loadScenario` still return an answer
 * with no `await` to spare (the editor lists saved scenarios during its own
 * first render), and the cache is kept full by `fetchSharedScenarios()`,
 * fired at load. Every existing export keeps its old signature and its old
 * local-only behaviour, so nothing that already called them broke; the new
 * `*Shared` functions are what actually reach the server.
 *
 * ── Local-first, but never dishonest about it ──
 *
 * `saveScenarioShared` writes the local cache EITHER WAY — a draft must not
 * be lost because the network was down or you were not signed in as admin —
 * but it reports exactly which of the two happened, so the builder can say
 * "saved on this device only, and why" rather than a bare "Saved". It is
 * never the caller's job to guess.
 */

const KEY = "star-scenarios-v1";
const ENDPOINT = "/api/star/scenarios";

type Store = Record<string, MatchScenario>;

/** As far as a reader actually relies on. A scenario can arrive from three
 *  places that each go wrong in their own way (this browser's storage, the
 *  server, a hand-edited file), so it is checked once here instead of at
 *  every reader. */
function isMatchScenario(s: unknown): s is MatchScenario {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  const sc = s as Record<string, unknown>;
  if (typeof sc.id !== "string" || !sc.id) return false;
  if (typeof sc.name !== "string") return false;
  if (typeof sc.kind !== "string" || !sc.kind) return false;
  const cam = sc.camera as Record<string, unknown> | undefined;
  if (!cam
    || !Number.isFinite(cam.centerX as number) || !Number.isFinite(cam.centerY as number)
    || !Number.isFinite(cam.viewHeight as number) || typeof cam.facing !== "string") return false;
  const ball = sc.ball as Record<string, unknown> | undefined;
  if (!ball || !Number.isFinite(ball.x as number) || !Number.isFinite(ball.y as number)) return false;
  if (!Array.isArray(sc.players)) return false;
  return sc.players.every((p) => {
    if (!p || typeof p !== "object") return false;
    const pl = p as Record<string, unknown>;
    return typeof pl.id === "string" && typeof pl.side === "string"
      && Number.isFinite(pl.x as number) && Number.isFinite(pl.y as number);
  });
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Store = {};
    for (const [id, s] of Object.entries(parsed)) {
      if (isMatchScenario(s)) out[id] = normaliseScenarioCamera(s);
    }
    return out;
  } catch {
    return {};
  }
}

function write(all: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // A full or blocked localStorage loses the cache and nothing else — the
    // server still has whatever was actually saved.
  }
}

// ── The synchronous reads the editor already uses ─────────────────────────

export function listScenarios(): MatchScenario[] {
  return Object.values(read()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadScenario(id: string): MatchScenario | null {
  return read()[id] ?? null;
}

/** Write to the LOCAL cache only. `saveScenarioShared` is what makes a
 *  scenario permanent for everyone; this stays exported, and unchanged, so
 *  nothing that only wants a local draft had to change. */
export function saveScenario(scenario: MatchScenario): void {
  const all = read();
  all[scenario.id] = { ...scenario, updatedAt: Date.now() };
  write(all);
}

/** Drop from the LOCAL cache only. See `deleteScenarioShared`. */
export function deleteScenario(id: string): void {
  const all = read();
  delete all[id];
  write(all);
}

// ── The shared table ──────────────────────────────────────────────────────

export interface SyncResult {
  ok: boolean;
  /** True when the server said the table doesn't exist yet — a real, named
   *  state the builder banners, not a failure to hide. */
  migrationMissing?: boolean;
  message?: string;
}

/**
 * Pull every shared scenario down and MERGE it into the local cache — the
 * server's copy of an id wins where both exist, but an id the server does
 * not have (yet) is left exactly as it was here, never deleted.
 *
 * Merge rather than replace, for the reason lineupStore.ts's own
 * `fetchSharedLineups` had to be changed to: run right after the table is
 * first created, with nothing in it, a REPLACE would wipe the one and only
 * copy of every scenario — which had been sitting safely in localStorage
 * the whole time — on every device, before any of it was ever pushed up. A
 * sync must never be able to make things WORSE than not syncing at all.
 *
 * Because a merge cannot express a removal, `deleteScenarioShared` clears
 * the local copy itself.
 *
 * Fire this at load, fire-and-forget, the same way the career's own squad
 * fetches are — the synchronous reads above keep working either way.
 */
export async function fetchSharedScenarios(): Promise<SyncResult & { scenarios?: MatchScenario[] }> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { cache: "no-store" });
  } catch {
    return { ok: false, message: "Couldn't reach the server — showing this browser's own scenarios." };
  }
  let data: { scenarios?: unknown; migrationMissing?: boolean; message?: string; error?: string };
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: `Server returned something unreadable (${res.status}).` };
  }
  if (!res.ok) {
    return { ok: false, message: data?.error ?? `Couldn't load shared scenarios (${res.status}).` };
  }

  const incoming: Store = {};
  if (data.scenarios && typeof data.scenarios === "object" && !Array.isArray(data.scenarios)) {
    for (const [id, s] of Object.entries(data.scenarios as Record<string, unknown>)) {
      if (isMatchScenario(s)) incoming[id] = normaliseScenarioCamera(s);
    }
  }
  write({ ...read(), ...incoming });
  return {
    ok: true,
    migrationMissing: data.migrationMissing === true,
    message: data.message,
    scenarios: listScenarios(),
  };
}

/**
 * Save a scenario for everyone. The server checks admin access itself, so a
 * non-admin gets a real reason back here rather than a save that silently
 * only ever affected their own browser.
 *
 * The local cache is written EITHER WAY (a draft is never thrown away
 * because a request failed) — but `ok` is true only when the server
 * confirmed it, so the builder can state plainly which of the two happened.
 */
export async function saveScenarioShared(scenario: MatchScenario): Promise<SyncResult> {
  const stamped: MatchScenario = { ...scenario, updatedAt: Date.now() };
  saveScenario(stamped);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: stamped }),
    });
  } catch {
    return { ok: false, message: "Network error — saved on this device only." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; migrationMissing?: boolean };
    return {
      ok: false,
      migrationMissing: body.migrationMissing === true,
      message: body.error ?? `Server refused the save (${res.status}).`,
    };
  }
  return { ok: true };
}

/**
 * Remove a scenario everywhere. Clears the local copy too — a merge-based
 * fetch can't express a removal, so without that the deleted scenario would
 * come straight back from this browser's own cache on the next load.
 *
 * The local copy is only dropped once the server confirmed the delete, so a
 * refused delete leaves the scenario exactly where it was rather than
 * disappearing from this device while still existing for everyone else.
 */
export async function deleteScenarioShared(id: string): Promise<SyncResult> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    return { ok: false, message: "Network error — nothing was deleted." };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; migrationMissing?: boolean };
    return {
      ok: false,
      migrationMissing: body.migrationMissing === true,
      message: body.error ?? `Server refused the delete (${res.status}).`,
    };
  }
  deleteScenario(id);
  return { ok: true };
}
