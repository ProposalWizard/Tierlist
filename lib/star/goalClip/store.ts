/**
 * WHERE GOAL RECORDINGS ARE KEPT — on this device, in the browser's own
 * database (IndexedDB), never in the career save.
 *
 * A recording is about 15 KB. The career save is synced to the cloud every
 * few seconds and is already large; a season of goals in it would make every
 * one of those syncs heavier. So the save keeps only each goal's clip id (on
 * its GoalEvent) and the recordings live here. On a different device a post
 * whose recording is not here shows its picture without a video — it never
 * pretends to be one.
 *
 * Kept: the newest KEEP_CLIPS recordings, plus any you have saved as a replay.
 * Everything also sits in memory for the session, so a clip recorded a moment
 * ago plays straight away even before the database write lands.
 */
import { trackFromStored, trackToStored, type GoalTrack } from "./track";

const DB = "star-goal-clips";
const STORE = "clips";
/** How many recordings this device keeps. */
export const KEEP_CLIPS = 80;

const memory = new Map<string, GoalTrack>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: "id" });
          st.createIndex("createdAt", "createdAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function done(tx: IDBTransaction): Promise<boolean> {
  return new Promise((res) => {
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
    tx.onabort = () => res(false);
  });
}

/** Keep a recording (memory now, the database a moment later). */
export async function putClip(track: GoalTrack): Promise<void> {
  memory.set(track.meta.id, track);
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: track.meta.id, createdAt: track.meta.createdAt, track: trackToStored(track) });
    await done(tx);
  } catch { /* a full or blocked database: the clip stays in memory for now */ }
  finally { db.close(); }
}

export async function getClip(id: string): Promise<GoalTrack | null> {
  const hit = memory.get(id);
  if (hit) return hit;
  const db = await open();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    const row = await new Promise<{ track?: unknown } | undefined>((res) => {
      req.onsuccess = () => res(req.result as { track?: unknown } | undefined);
      req.onerror = () => res(undefined);
    });
    const track = row ? trackFromStored(row.track) : null;
    if (track) memory.set(id, track);
    return track;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** The recordings for these ids that this device has, in the order asked. */
export async function getClips(ids: string[]): Promise<GoalTrack[]> {
  const out: GoalTrack[] = [];
  for (const id of ids) {
    const t = await getClip(id);
    if (t) out.push(t);
  }
  return out;
}

/** Forget all but the newest `keep`, never one in `protect`. */
export async function pruneClips(protect: Set<string> = new Set(), keep = KEEP_CLIPS): Promise<number> {
  const db = await open();
  if (!db) return 0;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const req = st.index("createdAt").getAllKeys();
    const keys = await new Promise<IDBValidKey[]>((res) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => res([]);
    });
    // Oldest first (the index is in createdAt order).
    const drop = keys.slice(0, Math.max(0, keys.length - keep)).filter(k => !protect.has(String(k)));
    for (const k of drop) { st.delete(k); memory.delete(String(k)); }
    await done(tx);
    return drop.length;
  } catch {
    return 0;
  } finally {
    db.close();
  }
}

/** What a recording is, without its frames — for a list. */
export interface ClipListing {
  id: string;
  createdAt: string;
  scorer: string;
  minuteLabel: string;
  home: string;
  away: string;
  how?: string;
}

/** Every recording on this device, newest first. */
export async function listClips(): Promise<ClipListing[]> {
  const fromMemory = (): ClipListing[] => Array.from(memory.values()).map(t => ({
    id: t.meta.id, createdAt: t.meta.createdAt, scorer: t.meta.scorer, minuteLabel: t.meta.minuteLabel,
    home: t.meta.home, away: t.meta.away, how: t.meta.how,
  }));
  const db = await open();
  if (!db) return fromMemory().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<{ id: string; createdAt: string; track?: { meta?: ClipListing & { scorer: string } } }[]>((res) => {
      req.onsuccess = () => res(req.result as never);
      req.onerror = () => res([]);
    });
    const seen = new Map<string, ClipListing>();
    for (const r of rows) {
      const m = r.track?.meta;
      if (!m) continue;
      seen.set(r.id, { id: r.id, createdAt: r.createdAt, scorer: m.scorer, minuteLabel: m.minuteLabel, home: m.home, away: m.away, how: m.how });
    }
    for (const l of fromMemory()) if (!seen.has(l.id)) seen.set(l.id, l);
    return Array.from(seen.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return fromMemory();
  } finally {
    db.close();
  }
}
