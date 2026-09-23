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
/**
 * Ids saved on THIS device that the server has not yet confirmed.
 *
 * The one thing a mirror must not throw away: a save made offline, or one the
 * server refused. Everything else in the cache is just a copy of the server
 * and is replaced by it on every sync — which is what lets a delete made on
 * one device finally reach every other device.
 */
const PENDING_KEY = "star-scenarios-pending-v1";

function readPending(): Set<string> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writePending(ids: Set<string>): void {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(Array.from(ids))); } catch { /* cache only */ }
}
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
 * Pull every shared scenario down and make this browser's cache a MIRROR of
 * the server — plus any save made here that the server never confirmed.
 *
 * It used to MERGE: the server's copy won where both existed, but anything
 * the server did not have was "left exactly as it was here, never deleted".
 * That was right once — the first sync after the table was created would
 * otherwise have wiped the only copy of every scenario — and it had a cost
 * nobody saw: a delete only ever cleared the device that made it. Deleted on
 * one laptop, a scenario lived on in every other browser that had ever seen
 * it, kept showing as Saved there, and the next Commit all from that browser
 * wrote it straight back into the code. Asked for directly: "for anything
 * that's deleted or anything that's solo to one person's browser... make it
 * the same across everyone's browser."
 *
 * The first-sync danger is still covered, just precisely instead of by never
 * deleting: a failed fetch, and a server that says its table does not exist
 * yet, both leave the cache exactly as it was. And a save that never reached
 * the server is kept — it is the one thing here that is not a copy of
 * anything (see PENDING_KEY).
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
  if (data.migrationMissing === true) {
    // No table yet means nothing to mirror — never mistake it for "empty".
    return { ok: true, migrationMissing: true, message: data.message, scenarios: listScenarios() };
  }
  const local = read();
  const pending = readPending();
  const next: Store = { ...incoming };
  for (const id of Array.from(pending)) {
    const mine = local[id];
    const theirs = incoming[id];
    // Keep a local save the server never confirmed — unless the server has
    // since caught up with it (same edit or newer), in which case it is not
    // pending any more.
    if (mine && (!theirs || (mine.updatedAt ?? 0) > (theirs.updatedAt ?? 0))) next[id] = mine;
    else pending.delete(id);
  }
  write(next);
  writePending(pending);
  return {
    ok: true,
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
  // Pending until the server says otherwise — see PENDING_KEY.
  const pending = readPending();
  pending.add(stamped.id);
  writePending(pending);

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
  const confirmed = readPending();
  confirmed.delete(stamped.id);
  writePending(confirmed);
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
  const pending = readPending();
  pending.delete(id);
  writePending(pending);
  return { ok: true };
}
