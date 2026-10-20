/**
 * WHERE HEADSHOTS ARE KEPT — on this device only (B15, 20 Oct 2026).
 *
 * Each face is made once per device: memory for this visit (a ready-to-show
 * picture address), and the browser's own database (IndexedDB) for the next
 * visit, keyed by headshotKey (version + his id + his look). A picture is
 * about 10–20 KB; the newest KEEP_HEADSHOTS are kept (a few MB at most).
 * Never in the career save (it syncs to the cloud every few seconds).
 *
 * No database (a private window, an old phone): memory only, the face is
 * made again on the next visit. Nothing breaks.
 */

const DB = "star-headshots";
const STORE = "shots";
/** How many pictures this device keeps. */
export const KEEP_HEADSHOTS = 400;

/** key → a picture address (object URL) for this visit. */
const memory = new Map<string, string>();

/** The picture for this key, if it is already in memory (no waiting). */
export function headshotFromMemory(key: string): string | null {
  return memory.get(key) ?? null;
}

/** Which kept pictures go when there are too many: the oldest first. Pure (tested). */
export function headshotsToDrop(rows: readonly { k: string; at: number }[], keep = KEEP_HEADSHOTS): string[] {
  if (rows.length <= keep) return [];
  return [...rows].sort((a, b) => a.at - b.at).slice(0, rows.length - keep).map((r) => r.k);
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const st = db.createObjectStore(STORE, { keyPath: "k" });
          st.createIndex("at", "at");
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

function remember(key: string, blob: Blob): string {
  const had = memory.get(key);
  if (had) return had;
  const url = URL.createObjectURL(blob);
  memory.set(key, url);
  return url;
}

/** The kept picture for this key (memory, then the database), or null. */
export async function getHeadshot(key: string): Promise<string | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  const db = await open();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    const row = await new Promise<{ blob?: Blob } | undefined>((res) => {
      req.onsuccess = () => res(req.result as { blob?: Blob } | undefined);
      req.onerror = () => res(undefined);
    });
    return row?.blob instanceof Blob ? remember(key, row.blob) : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Keep a picture (memory now, the database a moment later). Returns its address. */
export async function putHeadshot(key: string, blob: Blob): Promise<string> {
  const url = remember(key, blob);
  const db = await open();
  if (!db) return url;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    st.put({ k: key, at: Date.now(), blob });
    // too many: the oldest go (read the keys and times only; the deletes are
    // sent from the cursor's own last callback, while the transaction is open)
    const all = st.index("at").openKeyCursor();
    const rows: { k: string; at: number }[] = [];
    all.onsuccess = () => {
      const c = all.result;
      if (!c) { for (const k of headshotsToDrop(rows)) st.delete(k); return; }
      rows.push({ k: String(c.primaryKey), at: Number(c.key) });
      c.continue();
    };
    await done(tx);
  } catch { /* a full or blocked database: the picture stays in memory for this visit */ }
  finally { db.close(); }
  return url;
}

/** Forget every kept picture on this device (the bench page's "Make again"). */
export async function clearHeadshots(): Promise<void> {
  memory.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* gone */ } });
  memory.clear();
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await done(tx);
  } catch { /* nothing kept */ }
  finally { db.close(); }
}
