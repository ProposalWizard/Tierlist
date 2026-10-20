import {
  setTrainingOverlay, trainingOverlay, levelId, parseLevelId, sanitizeLevel,
  type TrainingSkill, type AnyLevel,
} from "./trainingLevelData";

/**
 * SAVED TRAINING LEVELS — the shared layer on top of the committed file
 * (lib/star/data/trainingLevels.json). Same shape as scenarioStore.ts:
 *
 *  - the shared answer is the `star_training_levels` table
 *    (/api/star/training-levels, GET public, POST/DELETE admin-only);
 *  - localStorage is a synchronous copy of it, so a drill has its numbers on
 *    its first render, refreshed once per page load (`ensureTrainingLevels`);
 *  - a save made while the table is missing, offline or refused stays on
 *    THIS device (and plays on this device), and says so.
 *
 * Every row read back goes through sanitizeLevel, so a broken row can never
 * break a drill.
 */

const KEY = "star-training-levels-v1";
const PENDING_KEY = "star-training-levels-pending-v1";
const ENDPOINT = "/api/star/training-levels";

type Store = Record<string, unknown>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* cache only */ }
}

function cleanStore(raw: unknown): Store {
  const out: Store = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    const p = parseLevelId(id);
    if (p) out[id] = sanitizeLevel(p.skill, p.level, row);
  }
  return out;
}

function pending(): Set<string> {
  const arr = readJson<unknown[]>(PENDING_KEY, []);
  return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
}

/** Load this device's copy into the game (cheap; safe to call often). */
let loadedLocal = false;
function loadLocal() {
  if (loadedLocal || typeof window === "undefined") return;
  loadedLocal = true;
  setTrainingOverlay(cleanStore(readJson(KEY, {})));
}

export interface TrainingSync {
  /** true: the shared table answered. */
  shared: boolean;
  /** The table has not been created yet (star_training_levels.sql). */
  migrationMissing?: boolean;
  message?: string;
}

let fetched: Promise<TrainingSync> | null = null;

/**
 * Make sure the game has the saved levels: this device's copy at once, the
 * shared table once per page load. Called by the drills and the editor; no
 * page has to remember to.
 */
export function ensureTrainingLevels(): Promise<TrainingSync> {
  loadLocal();
  if (typeof window === "undefined") return Promise.resolve({ shared: false });
  if (!fetched) fetched = fetchSharedTrainingLevels();
  return fetched;
}

export async function fetchSharedTrainingLevels(): Promise<TrainingSync> {
  loadLocal();
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    const body = await res.json().catch(() => null) as
      { levels?: unknown; migrationMissing?: boolean; message?: string; error?: string } | null;
    if (!res.ok || !body) return { shared: false, message: body?.error ?? `Couldn't read the saved levels (${res.status}).` };
    if (body.migrationMissing) return { shared: false, migrationMissing: true, message: body.message };
    // The server is the answer; only this device's unconfirmed saves survive on top.
    const server = cleanStore(body.levels);
    const local = cleanStore(readJson(KEY, {}));
    const keep = pending();
    for (const id of Array.from(keep)) if (local[id]) server[id] = local[id];
    writeJson(KEY, server);
    setTrainingOverlay(server);
    return { shared: true };
  } catch {
    return { shared: false, message: "Couldn't reach the server — showing this device's copy." };
  }
}

/** Saved edits by levelId, as the game reads them. */
export function savedLevels(): Store {
  loadLocal();
  return trainingOverlay();
}
export function isPendingLevel(skill: TrainingSkill, level: number): boolean {
  return pending().has(levelId(skill, level));
}

function setLocal(id: string, row: unknown | null, isPending: boolean) {
  const store = cleanStore(readJson(KEY, {}));
  if (row === null) delete store[id]; else store[id] = row;
  writeJson(KEY, store);
  setTrainingOverlay(store);
  const p = pending();
  if (isPending) p.add(id); else p.delete(id);
  writeJson(PENDING_KEY, Array.from(p));
}

export interface SaveResult {
  /** Reached the shared table (every device). */
  shared: boolean;
  migrationMissing?: boolean;
  message: string;
}

/** Save one level. Always lands on this device; says whether it reached everyone. */
export async function saveTrainingLevel(skill: TrainingSkill, level: number, config: AnyLevel): Promise<SaveResult> {
  const id = levelId(skill, level);
  const row = sanitizeLevel(skill, level, config);
  setLocal(id, row, true);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill, level, config: row }),
    });
    const body = await res.json().catch(() => null) as { error?: string; migrationMissing?: boolean } | null;
    if (res.ok) {
      setLocal(id, row, false);
      return { shared: true, message: `Saved for everyone — level ${level} plays like this in every career now.` };
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

/** Remove a level's saved edit, so it plays as the committed file has it. */
export async function resetTrainingLevel(skill: TrainingSkill, level: number): Promise<SaveResult> {
  const id = levelId(skill, level);
  setLocal(id, null, false);
  try {
    const res = await fetch(`${ENDPOINT}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await res.json().catch(() => null) as { error?: string; migrationMissing?: boolean } | null;
    if (res.ok) return { shared: true, message: `Level ${level} is back to the committed numbers for everyone.` };
    return { shared: false, migrationMissing: body?.migrationMissing, message: `Cleared on this device only. ${body?.error ?? ""}`.trim() };
  } catch {
    return { shared: false, message: "Cleared on this device only — couldn't reach the server." };
  }
}

export interface CommitResult { ok: boolean; message: string; commitSha?: string }

/** Write levels into lib/star/data/trainingLevels.json on main (needs GITHUB_TOKEN). */
export async function commitTrainingLevels(edits: { skill: TrainingSkill; level: number; config: AnyLevel }[]): Promise<CommitResult> {
  try {
    const res = await fetch(`${ENDPOINT}/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levels: edits.map(e => ({ ...e, config: sanitizeLevel(e.skill, e.level, e.config) })) }),
    });
    const body = await res.json().catch(() => null) as { ok?: boolean; message?: string; error?: string; commitSha?: string } | null;
    if (res.ok && body?.ok) return { ok: true, message: body.message ?? "Committed.", commitSha: body.commitSha };
    return { ok: false, message: body?.error ?? `Nothing was committed (${res.status}).` };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Nothing was committed." };
  }
}
