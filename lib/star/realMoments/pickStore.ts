/**
 * SAVED REAL-MOMENT PICKS — the shared layer on top of the committed file
 * (data/realmoments/picks.json). Same shape as trainingLevelStore.ts:
 *
 *  - the shared answer is the `star_real_moments_picks` table
 *    (/api/star/real-moment-picks: GET public, POST admin-only);
 *  - localStorage is a synchronous copy of it, refreshed once per page load
 *    (`ensureRealMomentPicks`);
 *  - a mark made while the table is missing, offline or refused stays on THIS
 *    device (and counts on this device), and the page says so.
 *
 * Every value read back goes through cleanPicks, so a broken row can never
 * break the game. Values: "use", "dont", or null (cleared back to automatic).
 */
import { isMomentId, setPicksOverlay, picksOverlay, type PickState, type PickValue } from "./picks";

const KEY = "star-real-moment-picks-v1";
const PENDING_KEY = "star-real-moment-picks-pending-v1";
export const PICKS_ENDPOINT = "/api/star/real-moment-picks";

type Layer = Record<string, PickValue | null>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* cache only */ }
}

/** Only valid ids; values "use" / "dont" / null (null = back to automatic). */
export function cleanLayer(raw: unknown): Layer {
  const out: Layer = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMomentId(id)) continue;
    if (v === "use" || v === "dont" || v === null) out[id] = v;
  }
  return out;
}

function pending(): Set<string> {
  const arr = readJson<unknown[]>(PENDING_KEY, []);
  return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
}

let loadedLocal = false;
function loadLocal() {
  if (loadedLocal || typeof window === "undefined") return;
  loadedLocal = true;
  setPicksOverlay(cleanLayer(readJson(KEY, {})));
}

export interface PicksSync {
  /** true: the shared table answered. */
  shared: boolean;
  /** The table has not been made yet (supabase/migrations/star_real_moments_picks.sql). */
  migrationMissing?: boolean;
  message?: string;
}

let fetched: Promise<PicksSync> | null = null;

/** This device's copy at once, the shared table once per page load. */
export function ensureRealMomentPicks(): Promise<PicksSync> {
  loadLocal();
  if (typeof window === "undefined") return Promise.resolve({ shared: false });
  if (!fetched) fetched = fetchSharedPicks();
  return fetched;
}

export async function fetchSharedPicks(): Promise<PicksSync> {
  loadLocal();
  try {
    const res = await fetch(PICKS_ENDPOINT, { cache: "no-store" });
    const body = await res.json().catch(() => null) as { picks?: unknown; migrationMissing?: boolean; message?: string; error?: string } | null;
    if (!res.ok || !body) return { shared: false, message: body?.error ?? `Couldn't read the saved marks (${res.status}).` };
    if (body.migrationMissing) return { shared: false, migrationMissing: true, message: body.message };
    // The server is the answer; only this device's unconfirmed marks survive on top.
    const server = cleanLayer(body.picks);
    const local = cleanLayer(readJson(KEY, {}));
    for (const id of Array.from(pending())) if (id in local) server[id] = local[id];
    writeJson(KEY, server);
    setPicksOverlay(server);
    return { shared: true };
  } catch {
    return { shared: false, message: "Couldn't reach the server — using this device's marks." };
  }
}

/** The saved layer as the game reads it. */
export function savedPicks(): Layer {
  loadLocal();
  return picksOverlay();
}
export const isPendingPick = (id: string) => pending().has(id);

function setLocal(id: string, v: PickValue | null, isPending: boolean) {
  const store = cleanLayer(readJson(KEY, {}));
  store[id] = v;
  writeJson(KEY, store);
  setPicksOverlay(store);
  const p = pending();
  if (isPending) p.add(id); else p.delete(id);
  writeJson(PENDING_KEY, Array.from(p));
}

export interface PickSaveResult { shared: boolean; migrationMissing?: boolean; message: string }

/** Mark one moment. Always lands on this device; says whether it reached everyone. */
export async function saveRealMomentPick(id: string, value: PickState): Promise<PickSaveResult> {
  if (!isMomentId(id)) return { shared: false, message: "That isn't a moment id." };
  const v: PickValue | null = value === "auto" ? null : value;
  setLocal(id, v, true);
  try {
    const res = await fetch(PICKS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, value }),
    });
    const body = await res.json().catch(() => null) as { error?: string; migrationMissing?: boolean } | null;
    if (res.ok) {
      setLocal(id, v, false);
      return { shared: true, message: "Saved for everyone: every game reads it now." };
    }
    return {
      shared: false,
      migrationMissing: body?.migrationMissing,
      message: `Saved on this device only. ${body?.error ?? `The server said ${res.status}.`}`,
    };
  } catch {
    return { shared: false, message: "Saved on this device only — couldn't reach the server." };
  }
}

export interface PicksCommitResult { ok: boolean; message: string; commitSha?: string }

/** Write marks into data/realmoments/picks.json on main (needs GITHUB_TOKEN). */
export async function commitRealMomentPicks(edits: { id: string; value: PickState }[]): Promise<PicksCommitResult> {
  try {
    const res = await fetch(`${PICKS_ENDPOINT}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: edits }),
    });
    const body = await res.json().catch(() => null) as { ok?: boolean; message?: string; error?: string; commitSha?: string } | null;
    if (res.ok && body?.ok) return { ok: true, message: body.message ?? "Committed.", commitSha: body.commitSha };
    return { ok: false, message: body?.error ?? `Nothing was committed (${res.status}).` };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Nothing was committed." };
  }
}
