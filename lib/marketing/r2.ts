/**
 * lib/marketing/r2.ts — video storage for the Marketing tab (Harry, 22 Oct
 * 2026; docs/plans/2026-10-21-marketing-production.md, pieces 4 and 5).
 *
 * Videos live in Cloudflare R2 (bucket R2_BUCKET, private), never in the code
 * and never through the site: the site host refuses a body over 4.5 MB, so the
 * browser uploads straight to R2 with a short-lived signed link the server
 * hands out. Plays work the same way (a signed GET link, admins only).
 *
 * The bucket is the one source of truth. No database, no index file:
 *   videos/<folder>/<stamp>-<name>.<ext>          an upload (folder = a board card id, or "inbox")
 *   videos/<folder>/<stamp>-<name>.<ext>.suite.json  the editing suite's notes and edits (+ optional helper files)
 *   ledger/<YYYY-MM-DD>/<who>/<stamp>-<bytes>      one empty object per upload link handed out (the daily cap)
 *
 * PURE: no fs, no network, no clock (every function takes `now`). The signing
 * is AWS Signature Version 4 (R2 speaks the S3 language), written out here so
 * the site needs no new package; it is checked against AWS's own published
 * example in tests/star/marketingStorage.mts. The secret is only ever an input
 * to an HMAC: never returned, logged or put in a message.
 */
import { createHash, createHmac } from "node:crypto";

/* ── The caps (Harry asked about cost risks) ─────────────────────────── */
export const CAPS = {
  /** One file, at most. A full-size phone recording is 50 to 500 MB. */
  maxFileBytes: 500 * 1024 * 1024,
  /** Per admin, per UK day. */
  dailyFiles: 30,
  dailyBytes: 5 * 1024 * 1024 * 1024,
  /** How long an upload link works. */
  putSeconds: 15 * 60,
  /** How long a play link works (a long cut can still be scrubbed to the end). */
  getSeconds: 60 * 60,
} as const;

/** Video and picture types only, by file ending. The MIME is what a play link answers with. */
export const MEDIA_TYPES: Record<string, { mime: string; kind: "video" | "image" }> = {
  mp4: { mime: "video/mp4", kind: "video" },
  m4v: { mime: "video/mp4", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
};

export const extOf = (name: string): string => (/\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1] ?? "").toLowerCase();
export const mediaOf = (name: string) => MEDIA_TYPES[extOf(name)] ?? null;

/* ── Config from the environment ─────────────────────────────────────── */
export interface R2Config { accountId: string; accessKeyId: string; secret: string; bucket: string }

/** The four Vercel settings. Missing any = storage is not connected here (the page says so). */
export function r2ConfigFrom(env: Record<string, string | undefined>): { config: R2Config | null; missing: string[] } {
  const pick = (k: string) => env[k]?.trim() || "";
  const v = { R2_ACCOUNT_ID: pick("R2_ACCOUNT_ID"), R2_ACCESS_KEY_ID: pick("R2_ACCESS_KEY_ID"), R2_SECRET_ACCESS_KEY: pick("R2_SECRET_ACCESS_KEY"), R2_BUCKET: pick("R2_BUCKET") };
  const missing = Object.entries(v).filter(([, x]) => !x).map(([k]) => k);
  if (missing.length) return { config: null, missing };
  if (!/^[a-f0-9]{32}$/i.test(v.R2_ACCOUNT_ID) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(v.R2_BUCKET)) return { config: null, missing: ["R2_ACCOUNT_ID or R2_BUCKET looks wrong"] };
  return { config: { accountId: v.R2_ACCOUNT_ID, accessKeyId: v.R2_ACCESS_KEY_ID, secret: v.R2_SECRET_ACCESS_KEY, bucket: v.R2_BUCKET }, missing: [] };
}

/* ── Keys ────────────────────────────────────────────────────────────── */
export const INBOX = "inbox";
/** Same rule as a board card id (lib/marketing/board.ts). */
export const FOLDER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
/** The editing suite's file beside a video (lib/studio/store.ts). Its presence = the video has notes. */
export const NOTES_SUFFIX = ".suite.json";
/** An upload's key. Never a notes file, never climbing out of videos/. */
export const VIDEO_KEY_RE = /^videos\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}\/[0-9]{8}-[0-9]{6}-[a-z0-9]{4}-[a-z0-9-]{1,60}\.[a-z0-9]{1,5}$/;
export const isVideoKey = (k: unknown): k is string => typeof k === "string" && VIDEO_KEY_RE.test(k) && !k.includes("..") && !!mediaOf(k);

/** A file name made safe for a key: lower case, letters, numbers and dashes. */
export function safeName(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return base || "upload";
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** 20261022-093000 (UTC). */
export const stampOf = (now: Date) => `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;

export function videoKey(folder: string, name: string, now: Date, rand: string): string {
  const f = FOLDER_RE.test(folder) ? folder : INBOX;
  const r = (rand.toLowerCase().replace(/[^a-z0-9]/g, "") + "0000").slice(0, 4);
  return `videos/${f}/${stampOf(now)}-${r}-${safeName(name)}.${extOf(name)}`;
}
export const notesKeyFor = (videoKey: string) => `${videoKey}${NOTES_SUFFIX}`;

/** The UK day an upload counts against (the cap resets at midnight UK time). */
export function ukDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
/** Who an upload counts against: a short, safe form of the account id (never an email). */
export const whoKey = (userId: string) => (userId.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "unknown");
export const ledgerPrefix = (day: string, who: string) => `ledger/${day}/${whoKey(who)}/`;
export const ledgerKey = (day: string, who: string, now: Date, bytes: number) => `${ledgerPrefix(day, who)}${stampOf(now)}-${Math.max(0, Math.floor(bytes))}`;

/** Today's use, read from the ledger keys (each ends in the bytes it allowed). */
export function usedToday(keys: string[]): { files: number; bytes: number } {
  let files = 0, bytes = 0;
  for (const k of keys) {
    const m = /-(\d+)$/.exec(k);
    if (!m) continue;
    files++;
    bytes += Number(m[1]);
  }
  return { files, bytes };
}

/* ── The checks before an upload link is handed out ──────────────────── */
export type UploadAsk = { name: unknown; size: unknown; folder?: unknown };
export type UploadCheck =
  | { ok: true; name: string; size: number; folder: string; kind: "video" | "image" }
  | { ok: false; status: 400 | 413 | 415 | 429; error: string };

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);

export function checkUpload(ask: UploadAsk, used: { files: number; bytes: number }): UploadCheck {
  const name = typeof ask.name === "string" ? ask.name.trim().slice(0, 200) : "";
  const size = typeof ask.size === "number" && Number.isFinite(ask.size) ? Math.floor(ask.size) : -1;
  const folder = ask.folder == null || ask.folder === "" ? INBOX : ask.folder;
  if (!name) return { ok: false, status: 400, error: "The file has no name." };
  if (typeof folder !== "string" || !FOLDER_RE.test(folder)) return { ok: false, status: 400, error: "That video card id is not valid." };
  const media = mediaOf(name);
  if (!media) return { ok: false, status: 415, error: "Only videos (mp4, mov, webm) and pictures (jpg, png, webp, gif) can go in." };
  if (size <= 0) return { ok: false, status: 400, error: "The file is empty." };
  if (size > CAPS.maxFileBytes) return { ok: false, status: 413, error: `Too big: ${mb(size)}. One file can be ${mb(CAPS.maxFileBytes)} at most.` };
  if (used.files >= CAPS.dailyFiles) return { ok: false, status: 429, error: `You have uploaded ${CAPS.dailyFiles} files today, the daily limit. It resets at midnight (UK time).` };
  if (used.bytes + size > CAPS.dailyBytes) return { ok: false, status: 429, error: `That would pass today's limit of ${mb(CAPS.dailyBytes)} (used ${mb(used.bytes)}). It resets at midnight (UK time).` };
  return { ok: true, name, size, folder, kind: media.kind };
}

/* ── AWS Signature Version 4, query-string form (a "presigned" link) ─── */
const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();
/** RFC 3986 encoding, as SigV4 wants it. `/` kept in paths. */
export const uriEncode = (s: string, keepSlash = false) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(keepSlash ? /%2F/g : /$^/, "/");

export interface PresignInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  host: string;
  /** Already-safe path, starting with "/". */
  path: string;
  accessKeyId: string;
  secret: string;
  region: string;
  now: Date;
  expires: number;
  /** Extra query (e.g. list-type, response-content-type). */
  query?: Record<string, string>;
  /** Headers the request must send exactly (names lower case). Host is always signed. */
  headers?: Record<string, string>;
  service?: string;
}

const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function presign(i: PresignInput): string {
  const service = i.service ?? "s3";
  const date = amzDate(i.now);
  const day = date.slice(0, 8);
  const scope = `${day}/${i.region}/${service}/aws4_request`;
  const headers: Record<string, string> = { host: i.host, ...(i.headers ?? {}) };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const signedHeaders = names.join(";");
  const q: Record<string, string> = {
    ...(i.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${i.accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(Math.max(1, Math.min(604800, Math.floor(i.expires)))),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonQuery = Object.keys(q).sort().map((k) => `${uriEncode(k)}=${uriEncode(q[k])}`).join("&");
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim().replace(/\s+/g, " ");
  const canonHeaders = names.map((n) => `${n}:${lower[n]}\n`).join("");
  const canonical = [i.method, i.path, canonQuery, canonHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", date, scope, sha256hex(canonical)].join("\n");
  const kDate = hmac(`AWS4${i.secret}`, day);
  const kSigning = hmac(hmac(hmac(kDate, i.region), service), "aws4_request");
  const sig = createHmac("sha256", kSigning).update(toSign, "utf8").digest("hex");
  return `https://${i.host}${i.path}?${canonQuery}&X-Amz-Signature=${sig}`;
}

/** A signed link for one object (or the bucket itself when key is ""). R2's region is always "auto". */
export function r2Url(cfg: R2Config, method: PresignInput["method"], key: string, now: Date, expires: number,
  extra: { query?: Record<string, string>; headers?: Record<string, string> } = {}): string {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}${key ? `/${uriEncode(key, true)}` : ""}`;
  return presign({ method, host, path, accessKeyId: cfg.accessKeyId, secret: cfg.secret, region: "auto", now, expires, ...extra });
}

/** The upload link: it only accepts a body of exactly the size asked for (content-length is signed). */
export const uploadUrl = (cfg: R2Config, key: string, size: number, now: Date) =>
  r2Url(cfg, "PUT", key, now, CAPS.putSeconds, { headers: { "content-length": String(size) } });

/** The play link: answers with the right type so the browser plays it, and names the file for a download. */
export function playUrl(cfg: R2Config, key: string, now: Date): string {
  const media = mediaOf(key);
  const file = key.split("/").pop() ?? "video";
  return r2Url(cfg, "GET", key, now, CAPS.getSeconds, { query: {
    "response-content-type": media?.mime ?? "application/octet-stream",
    "response-content-disposition": `inline; filename="${file.replace(/[^A-Za-z0-9._-]/g, "")}"`,
  } });
}

/* ── Reading a bucket listing (ListObjectsV2 XML) ────────────────────── */
export interface ListedObject { key: string; size: number; modified: string }
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
export function parseList(xml: string): { objects: ListedObject[]; next: string | null } {
  const objects: ListedObject[] = [];
  for (const m of Array.from(xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g))) {
    const body = m[1];
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(body)?.[1];
    if (!key) continue;
    objects.push({ key: unxml(key), size: Number(/<Size>(\d+)<\/Size>/.exec(body)?.[1] ?? 0), modified: /<LastModified>([^<]+)<\/LastModified>/.exec(body)?.[1] ?? "" });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = truncated ? unxml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || null : null;
  return { objects, next };
}

/* ── What the Uploads page and the suite list ────────────────────────── */
export interface MediaItem {
  key: string;
  folder: string;
  /** The file name as uploaded (made safe), without the stamp. */
  name: string;
  kind: "video" | "image";
  size: number;
  uploaded: string;
  hasNotes: boolean;
}

/** Turn a listing of videos/ into the items, newest first. Notes files mark their video; anything else is ignored. */
export function itemsFromList(objects: ListedObject[]): MediaItem[] {
  const notes = new Set(objects.filter((o) => o.key.endsWith(NOTES_SUFFIX)).map((o) => o.key.slice(0, -NOTES_SUFFIX.length)));
  const out: MediaItem[] = [];
  for (const o of objects) {
    if (!isVideoKey(o.key)) continue;
    const [, folder, file] = o.key.split("/");
    const media = mediaOf(file)!;
    out.push({ key: o.key, folder, name: file.replace(/^[0-9]{8}-[0-9]{6}-[a-z0-9]{4}-/, ""), kind: media.kind, size: o.size, uploaded: o.modified, hasNotes: notes.has(o.key) });
  }
  return out.sort((a, b) => (a.key < b.key ? 1 : -1)).sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || ""));
}
