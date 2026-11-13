/**
 * lib/recordings/store.ts — where Admin → Videos recordings live (Harry,
 * 12 Nov 2026: "make it link to R2 as well as Drive so everyone can use it";
 * and no breakdown videos piling up as wasted storage).
 *
 * The recording goes to Cloudflare R2 first (no Google needed), Drive is the
 * second copy. The bucket is the one source of truth: no table, no index.
 *
 *   recordings/<who>/<YYYY-MM-DD>-<what>-<length>-<4 letters>.<ext>   the video
 *   recordings/<who>/<same>.keep    empty: "Keep" is on, never auto-deleted
 *   recordings/<who>/<same>.read    empty: a Claude chat has picked it up
 *
 * Who, what, the length and the day are all in the key, so the list on the
 * Videos page is one bucket listing. Recordings are deleted 30 days after
 * they arrive unless kept (/api/cron/recordings).
 *
 * The link for Claude is a page on the site with a per-recording token:
 *   /api/dev-recordings/watch?k=<who>/<file>&t=<token>
 * It answers with a redirect to a fresh one-hour signed R2 link, so it works
 * for as long as the recording exists and scripts/screen-video/fetch.py can
 * download it with no sign-in. The token is an HMAC of the key (the R2 secret
 * is only ever the HMAC's key: never returned or logged).
 *
 * PURE: no network, no clock (every function takes `now`). Tests:
 * tests/star/recordingStore.mts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { CAPS, r2Url, safeName, ukDay, type ListedObject, type R2Config } from "@/lib/marketing/r2";
import { lengthLabel } from "@/lib/recording";

export const RECORDINGS_PREFIX = "recordings/";
export const RECORDING_PEOPLE = ["Harry", "Mikey", "Leo"] as const;
export type RecordingPerson = (typeof RECORDING_PEOPLE)[number];
/** Video endings a recording can have, and what a play link answers with. */
export const RECORDING_TYPES: Record<string, string> = { webm: "video/webm", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime" };

/** Days a recording stays before it is deleted by itself. */
export const RETAIN_DAYS = 30;
export const KEEP_SUFFIX = ".keep";
export const READ_SUFFIX = ".read";

export const RECORDING_CAPS = {
  maxFileBytes: CAPS.maxFileBytes,
  /** Per person, per UK day. */
  dailyFiles: 40,
  dailyBytes: 5 * 1024 * 1024 * 1024,
  /** How long a play or download link works. */
  getSeconds: 60 * 60,
} as const;

const LEN = String.raw`(?:\d{1,3}h\d{2}m\d{2}s|\d{1,2}m\d{2}s|\d{1,2}s)`;
export const RECORDING_KEY_RE = new RegExp(
  String.raw`^recordings/(harry|mikey|leo)/(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)-(${LEN})-([a-z0-9]{4})\.(webm|mp4|m4v|mov)$`);

export const personOf = (name: unknown): RecordingPerson | null =>
  RECORDING_PEOPLE.find((p) => p.toLowerCase() === String(name ?? "").trim().toLowerCase()) ?? null;

/** "4m12s" → 252. */
export function secondsOf(label: string): number {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(\d+)s$/.exec(label);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]) : 0;
}

/** recordings/harry/2026-11-12-keeper-dive-feels-slow-4m12s-a1b2.webm */
export function recordingKey(o: { who: RecordingPerson; about: string; seconds: number; ext: string; now: Date; rand: string }): string {
  const ext = RECORDING_TYPES[o.ext.toLowerCase()] ? o.ext.toLowerCase() : "webm";
  const slug = safeName(o.about.replace(/\./g, " ").trim() || "screen recording").slice(0, 48).replace(/-+$/, "") || "screen-recording";
  const secs = Math.min(Math.max(0, Math.round(o.seconds)), 999 * 3600);
  const r = (o.rand.toLowerCase().replace(/[^a-z0-9]/g, "") + "0000").slice(0, 4);
  return `${RECORDINGS_PREFIX}${o.who.toLowerCase()}/${ukDay(o.now)}-${slug}-${lengthLabel(secs)}-${r}.${ext}`;
}

export interface RecordingParts { who: RecordingPerson; day: string; about: string; seconds: number; ext: string }
export function parseRecordingKey(key: unknown): RecordingParts | null {
  if (typeof key !== "string" || key.length > 200 || key.includes("..")) return null;
  const m = RECORDING_KEY_RE.exec(key);
  if (!m) return null;
  return { who: personOf(m[1])!, day: m[2], about: m[3].replace(/-/g, " "), seconds: secondsOf(m[4]), ext: m[6] };
}
export const isRecordingKey = (key: unknown): key is string => parseRecordingKey(key) !== null;
export const keepKeyFor = (key: string) => `${key}${KEEP_SUFFIX}`;
export const readKeyFor = (key: string) => `${key}${READ_SUFFIX}`;

/** "2026-11-12 · Harry · keeper dive feels slow (4m12s)": the same shape as the Drive file name. */
export const recordingTitle = (p: RecordingParts) => `${p.day} · ${p.who} · ${p.about} (${lengthLabel(p.seconds)})`;

/* ── The link for Claude ─────────────────────────────────────────────── */

/** The per-recording token: 32 hex characters, from the key and the storage secret. */
export function linkToken(secret: string, key: string): string {
  return createHmac("sha256", secret).update(`kib-recording-link:v1:${key}`, "utf8").digest("hex").slice(0, 32);
}
export function tokenOk(secret: string, key: string, token: unknown): boolean {
  if (typeof token !== "string" || !/^[a-f0-9]{32}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(linkToken(secret, key)));
}
/** The path on the site (no origin). `k` is the key without "recordings/". */
export const watchPath = (key: string, token: string) =>
  `/api/dev-recordings/watch?k=${encodeURIComponent(key.slice(RECORDINGS_PREFIX.length)).replace(/%2F/g, "/")}&t=${token}`;
export const watchLink = (origin: string, cfg: R2Config, key: string) => `${origin.replace(/\/+$/, "")}${watchPath(key, linkToken(cfg.secret, key))}`;
/** The key a watch link's `k` names, or null. */
export function keyFromWatch(k: unknown): string | null {
  const key = `${RECORDINGS_PREFIX}${typeof k === "string" ? k : ""}`;
  return isRecordingKey(key) ? key : null;
}
/** True for a link this site made (fetch.py and the hook treat it as a recording). */
export const isWatchLink = (link: string) => /^https:\/\/[a-z0-9.-]+\/api\/dev-recordings\/watch\?k=[a-z]+\/[A-Za-z0-9._-]+&t=[a-f0-9]{32}$/.test(link);

/** A signed R2 link that plays or downloads one recording. */
export function recordingGetUrl(cfg: R2Config, key: string, now: Date, seconds: number = RECORDING_CAPS.getSeconds): string {
  const p = parseRecordingKey(key);
  const file = key.split("/").pop() ?? "recording";
  return r2Url(cfg, "GET", key, now, seconds, { query: {
    "response-content-type": RECORDING_TYPES[p?.ext ?? ""] ?? "application/octet-stream",
    "response-content-disposition": `inline; filename="${file}"`,
  } });
}

/* ── The list, and what gets deleted ─────────────────────────────────── */

export interface RecordingItem extends RecordingParts {
  key: string;
  title: string;
  size: number;
  /** When it reached storage (ISO). */
  uploaded: string;
  keep: boolean;
  /** Whole days until it is deleted; null when kept. */
  daysLeft: number | null;
}

const DAY_MS = 864e5;
/** When a recording arrived: the bucket's own time, else noon on the day in its name. */
function arrivedMs(o: ListedObject, p: RecordingParts): number {
  const t = Date.parse(o.modified);
  return Number.isFinite(t) ? t : Date.parse(`${p.day}T12:00:00Z`);
}

/** A listing of recordings/ → the recordings, newest first. */
export function recordingsFromList(objects: ListedObject[], now: Date): RecordingItem[] {
  const keys = new Set(objects.map((o) => o.key));
  const out: RecordingItem[] = [];
  for (const o of objects) {
    const p = parseRecordingKey(o.key);
    if (!p) continue;
    const at = arrivedMs(o, p);
    const keep = keys.has(keepKeyFor(o.key));
    out.push({ ...p, key: o.key, title: recordingTitle(p), size: o.size, uploaded: new Date(at).toISOString(), keep,
      daysLeft: keep ? null : Math.max(0, Math.ceil((at + RETAIN_DAYS * DAY_MS - now.getTime()) / DAY_MS)) });
  }
  return out.sort((a, b) => (a.uploaded < b.uploaded ? 1 : a.uploaded > b.uploaded ? -1 : a.key < b.key ? 1 : -1));
}

/**
 * What the nightly clean-up deletes: every recording older than 30 days that
 * is not kept (with its .read mark), and any mark whose recording is gone.
 * Only ever a key inside recordings/ that this file knows the shape of.
 */
export function cleanupPlan(objects: ListedObject[], now: Date): string[] {
  const keys = new Set(objects.map((o) => o.key));
  const remove = new Set<string>();
  for (const o of objects) {
    const p = parseRecordingKey(o.key);
    if (p) {
      if (keys.has(keepKeyFor(o.key))) continue;
      if (now.getTime() - arrivedMs(o, p) <= RETAIN_DAYS * DAY_MS) continue;
      remove.add(o.key);
      if (keys.has(readKeyFor(o.key))) remove.add(readKeyFor(o.key));
      continue;
    }
    for (const suffix of [KEEP_SUFFIX, READ_SUFFIX]) {
      if (!o.key.endsWith(suffix)) continue;
      const base = o.key.slice(0, -suffix.length);
      if (isRecordingKey(base) && !keys.has(base)) remove.add(o.key);
    }
  }
  return Array.from(remove).filter((k) => k.startsWith(RECORDINGS_PREFIX) && !k.includes("..")).sort();
}

/** A person's recordings no Claude chat has picked up yet (last 3 days, oldest first, at most 5). */
export function unreadFor(objects: ListedObject[], who: RecordingPerson, now: Date): RecordingItem[] {
  const keys = new Set(objects.map((o) => o.key));
  return recordingsFromList(objects, now)
    .filter((r) => r.who === who && !keys.has(readKeyFor(r.key)) && now.getTime() - Date.parse(r.uploaded) <= 3 * DAY_MS)
    .reverse().slice(0, 5);
}

/* ── The checks before an upload link is handed out ──────────────────── */
export type RecordingAsk = { who?: unknown; about?: unknown; seconds?: unknown; ext?: unknown; size?: unknown };
export type RecordingCheck =
  | { ok: true; who: RecordingPerson; about: string; seconds: number; ext: string; size: number }
  | { ok: false; status: 400 | 413 | 415 | 429; error: string };

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);

/** `today` = that person's recordings already stored with today's (UK) date. */
export function checkRecording(ask: RecordingAsk, today: { files: number; bytes: number }): RecordingCheck {
  const who = personOf(ask.who);
  if (!who) return { ok: false, status: 400, error: "Pick who is recording: Harry, Mikey or Leo." };
  const ext = String(ask.ext ?? "").toLowerCase();
  if (!RECORDING_TYPES[ext]) return { ok: false, status: 415, error: "Only video files (webm, mp4, mov) can be saved." };
  const size = typeof ask.size === "number" && Number.isFinite(ask.size) ? Math.floor(ask.size) : -1;
  if (size <= 0) return { ok: false, status: 400, error: "The recording is empty." };
  if (size > RECORDING_CAPS.maxFileBytes) return { ok: false, status: 413, error: `Too big: ${mb(size)}. One recording can be ${mb(RECORDING_CAPS.maxFileBytes)} at most. Download it instead.` };
  if (today.files >= RECORDING_CAPS.dailyFiles) return { ok: false, status: 429, error: `${who} has saved ${RECORDING_CAPS.dailyFiles} recordings today, the daily limit. It resets at midnight (UK time).` };
  if (today.bytes + size > RECORDING_CAPS.dailyBytes) return { ok: false, status: 429, error: `That would pass today's limit of ${mb(RECORDING_CAPS.dailyBytes)}. It resets at midnight (UK time).` };
  const seconds = typeof ask.seconds === "number" && Number.isFinite(ask.seconds) ? Math.max(0, ask.seconds) : 0;
  return { ok: true, who, about: String(ask.about ?? "").slice(0, 60), seconds, ext, size };
}

/** That person's use today, from a listing of their folder. */
export function usedOn(objects: ListedObject[], day: string): { files: number; bytes: number } {
  let files = 0, bytes = 0;
  for (const o of objects) {
    if (parseRecordingKey(o.key)?.day !== day) continue;
    files++; bytes += o.size;
  }
  return { files, bytes };
}

/** What the Videos page gets for one recording (the token only, never the secret). */
export interface RecordingRow extends RecordingItem { link: string }
export const rowsFor = (items: RecordingItem[], cfg: R2Config, origin: string): RecordingRow[] =>
  items.map((it) => ({ ...it, link: watchLink(origin, cfg, it.key) }));
