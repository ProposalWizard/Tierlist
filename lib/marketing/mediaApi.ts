/**
 * lib/marketing/mediaApi.ts — what the Marketing upload, list, play and notes
 * routes do, with the storage and the sign-in passed in. The routes under
 * app/api/admin/marketing/{upload,media,notes} are thin wrappers; the tests
 * (tests/star/marketingStorage.mts) run these with fakes, never R2.
 */
import {
  CAPS, INBOX, isVideoKey, itemsFromList, ledgerKey, ledgerPrefix, notesKeyFor, ukDay, uploadUrl as signUpload,
  usedToday, videoKey, checkUpload, type ListedObject, type MediaItem, type R2Config,
} from "./r2";
import { applyOp, emptyNotes, parseNotes, type SuiteNotes } from "./suite";

/** Where videos are: the real bucket, this computer's docs/marketing/videos (dev only, read-only), or nowhere. */
export type StorageMode = "r2" | "local" | "off";

export interface Storage {
  mode: StorageMode;
  /** For "off": the settings that are missing (names only, never values). */
  missing?: string[];
  config?: R2Config;
  list(prefix: string): Promise<ListedObject[]>;
  head(key: string): Promise<{ size: number } | null>;
  getText(key: string): Promise<string | null>;
  putText(key: string, body: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Is this key one this storage can hold notes for? */
  isMediaKey(key: string): boolean;
}

/** Who is asking. null = not signed in. */
export type Caller = { id: string; name: string; admin: boolean } | null;
export type Reply = { status: number; body: Record<string, unknown> };

const NOT_CONNECTED = "Storage not connected here. Uploads work on the live site once the R2 settings are in Vercel.";

export function gate(caller: Caller): Reply | null {
  if (!caller) return { status: 401, body: { error: "Sign in first." } };
  if (!caller.admin) return { status: 403, body: { error: "Admins only." } };
  return null;
}

/** POST upload: check the caps, count it, hand out a 15-minute upload link. */
export async function askUpload(caller: Caller, body: unknown, store: Storage, now: Date, rand: string): Promise<Reply> {
  const denied = gate(caller);
  if (denied) return denied;
  if (store.mode !== "r2" || !store.config) return { status: 503, body: { error: NOT_CONNECTED, connected: false } };
  const day = ukDay(now);
  const used = usedToday((await store.list(ledgerPrefix(day, caller!.id))).map((o) => o.key));
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const check = checkUpload({ name: b.name, size: b.size, folder: b.folder }, used);
  if (!check.ok) return { status: check.status, body: { error: check.error, used, caps: capsOut() } };
  const key = videoKey(check.folder, check.name, now, rand);
  // Counted when the link is handed out, so a failed upload still counts (the safe way round).
  await store.putText(ledgerKey(day, caller!.id, now, check.size), "");
  return {
    status: 200,
    body: { key, url: signUpload(store.config, key, check.size, now), expiresAt: new Date(now.getTime() + CAPS.putSeconds * 1000).toISOString(), used: { files: used.files + 1, bytes: used.bytes + check.size }, caps: capsOut() },
  };
}

/** POST upload/done: the file arrived. Anything bigger than the cap is deleted at once. */
export async function uploadDone(caller: Caller, body: unknown, store: Storage): Promise<Reply> {
  const denied = gate(caller);
  if (denied) return denied;
  if (store.mode !== "r2") return { status: 503, body: { error: NOT_CONNECTED } };
  const key = (body as { key?: unknown } | null)?.key;
  if (!isVideoKey(key)) return { status: 400, body: { error: "That is not an upload." } };
  const h = await store.head(key);
  if (!h) return { status: 404, body: { error: "The file did not arrive. Try again." } };
  if (h.size > CAPS.maxFileBytes) { await store.remove(key); return { status: 413, body: { error: "Too big: removed." } }; }
  return { status: 200, body: { key, size: h.size } };
}

/** GET media: every upload (newest first), today's use and the caps. */
export async function listMedia(caller: Caller, store: Storage, now: Date): Promise<Reply> {
  const denied = gate(caller);
  if (denied) return denied;
  if (store.mode === "off") return { status: 200, body: { mode: "off", connected: false, missing: store.missing ?? [], message: NOT_CONNECTED, items: [], caps: capsOut() } };
  const items: MediaItem[] = store.mode === "local" ? localItems(await store.list("")) : itemsFromList(await store.list("videos/"));
  const used = store.mode === "r2" ? usedToday((await store.list(ledgerPrefix(ukDay(now), caller!.id))).map((o) => o.key)) : { files: 0, bytes: 0 };
  return { status: 200, body: { mode: store.mode, connected: store.mode === "r2", items, used, caps: capsOut(), message: store.mode === "local" ? "Storage not connected here. Showing the videos in docs/marketing/videos on this computer (development only)." : null } };
}

/** GET notes. */
export async function readNotes(caller: Caller, key: unknown, store: Storage): Promise<Reply> {
  const denied = gate(caller);
  if (denied) return denied;
  if (typeof key !== "string" || !store.isMediaKey(key)) return { status: 400, body: { error: "Which video?" } };
  if (store.mode === "off") return { status: 503, body: { error: NOT_CONNECTED } };
  return { status: 200, body: { notes: await loadNotes(store, key) } };
}

/** POST notes: one change (add / update / delete), applied to the current file. */
export async function changeNotes(caller: Caller, body: unknown, store: Storage, now: Date): Promise<Reply> {
  const denied = gate(caller);
  if (denied) return denied;
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof b.key !== "string" || !store.isMediaKey(b.key)) return { status: 400, body: { error: "Which video?" } };
  if (store.mode === "off") return { status: 503, body: { error: NOT_CONNECTED } };
  const cur = await loadNotes(store, b.key);
  const res = applyOp(cur, b.change, caller!.name, now);
  if (!res.ok) return { status: 400, body: { error: res.error, notes: cur } };
  await store.putText(notesKeyFor(b.key), JSON.stringify(res.notes, null, 1));
  return { status: 200, body: { notes: res.notes } };
}

async function loadNotes(store: Storage, key: string): Promise<SuiteNotes> {
  const raw = await store.getText(notesKeyFor(key));
  if (!raw) return emptyNotes(key);
  try { return parseNotes(JSON.parse(raw), key); } catch { return emptyNotes(key); }
}

const capsOut = () => ({ maxFileBytes: CAPS.maxFileBytes, dailyFiles: CAPS.dailyFiles, dailyBytes: CAPS.dailyBytes });

/* ── Local (development only): docs/marketing/videos, read-only ───────── */
export const LOCAL_PREFIX = "local/";
export const LOCAL_KEY_RE = /^local\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(mp4|webm|mov|m4v)$/;
function localItems(objects: ListedObject[]): MediaItem[] {
  return objects.filter((o) => LOCAL_KEY_RE.test(o.key)).map((o) => {
    const [, folder, name] = o.key.split("/");
    return { key: o.key, folder: folder || INBOX, name, kind: "video" as const, size: o.size, uploaded: o.modified, hasNotes: false };
  });
}
