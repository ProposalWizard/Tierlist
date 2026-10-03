/**
 * MOVE MY SAVES — every save slot packed into one code, and back.
 *
 * Why it exists (Harry, 3 Oct 2026): on an iPhone, a game added to the Home
 * Screen gets its own storage, apart from Safari's. He opened the Home Screen
 * app and all three saves were "gone" — they were still in Safari, the app
 * just could not see them. Save 1 follows a signed-in account through the
 * cloud; saves 2 and 3 only do once star_career_slots.sql has run. This is
 * the way across that needs neither.
 *
 *   Copy:  packSaves(scope)       → "KIBSAVE1.z.<base64>" (or ".j." uncompressed)
 *   Paste: unpackSaves(code)      → every slot checked and loaded, or a plain reason
 *          applySaves(scope, pack, slots)
 *
 * The pasted code is UNTRUSTED. It is never run, only parsed as JSON; it is
 * size-capped before and after unzipping; and every save in it goes through
 * the same loader a normal save does (storage.ts loadCareerFromStoredForm:
 * version check, squads filled back in, every backfill). Anything that does
 * not load is refused with a plain message, not half-written.
 *
 * Compression is the browser's own gzip (CompressionStream — Safari 16.4+,
 * Chrome 80+, Node 18+). No package. A browser without it writes and reads
 * the plain form, which is about 4× bigger.
 */
import type { CareerState } from "./types";
import {
  MAX_SAVE_SLOTS, readStoredSlots, loadCareerFromStoredForm, sanitizeSavedPhase,
  summariseSave, writeMovedSave, loadActiveSlot, saveActiveSlot,
  type SavedPhase, type SaveSlotSummary,
} from "./storage";

const PREFIX = "KIBSAVE1";
const APP = "knowitball-star";
const KIND = "save-pack";
const PACK_VERSION = 1;

/**
 * The most text a pasted code may be. A browser keeps about 5 MB for the
 * whole site, so three real saves cannot honestly be bigger than this even
 * uncompressed and in base64. Anything larger is refused before it is read.
 */
export const MAX_CODE_CHARS = 12_000_000;
/** The most the code may unzip to — stops a tiny code inflating to gigabytes. */
export const MAX_JSON_BYTES = 9_000_000;

/** One slot inside a code, as stored on the device it came from. */
export interface PackedSlot {
  slot: number;
  career: unknown;
  phase?: SavedPhase;
}

export interface SavePack {
  app: typeof APP;
  kind: typeof KIND;
  v: number;
  /** When the code was made (ms). Shown, never trusted for anything. */
  made: number;
  /** Which save the player was on when they copied it. */
  activeSlot: number;
  slots: PackedSlot[];
}

/** A code that checked out: every slot loads, ready to write. */
export interface CheckedPack {
  activeSlot: number;
  made: number;
  slots: { slot: number; career: CareerState; phase: SavedPhase | null; summary: SaveSlotSummary }[];
}

export type UnpackResult = { ok: true; pack: CheckedPack } | { ok: false; reason: string };

// ── base64 / gzip, with no package ──────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function canCompress(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

async function readAll(stream: ReadableStream<Uint8Array>, cap: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return (await readAll(stream as ReadableStream<Uint8Array>, Number.MAX_SAFE_INTEGER))!;
}

/** Null when the data is not gzip, or unzips past `cap`. */
async function gunzip(bytes: Uint8Array, cap: number): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await readAll(stream as ReadableStream<Uint8Array>, cap);
  } catch {
    return null;
  }
}

// ── Copy ────────────────────────────────────────────────────────────────────

/** Every save of `accountScope` (with the save you're on) as one object. */
export function buildPack(accountScope: string, now = Date.now()): SavePack {
  return {
    app: APP,
    kind: KIND,
    v: PACK_VERSION,
    made: now,
    activeSlot: loadActiveSlot(accountScope),
    slots: readStoredSlots(accountScope),
  };
}

/** Turns a pack into the text code. Compressed when this browser can. */
export async function encodePack(pack: SavePack, opts: { compress?: boolean } = {}): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(pack));
  const compress = opts.compress ?? canCompress();
  if (compress) return `${PREFIX}.z.${bytesToBase64(await gzip(json))}`;
  return `${PREFIX}.j.${bytesToBase64(json)}`;
}

export async function packSaves(accountScope: string): Promise<{ code: string; slots: number }> {
  const pack = buildPack(accountScope);
  return { code: await encodePack(pack), slots: pack.slots.length };
}

// ── Paste ───────────────────────────────────────────────────────────────────

const NOT_A_CODE = "That isn't a save code. Copy it again from the other place with \"Copy save code\".";

/**
 * Reads a pasted code (or a loaded file) and checks every part of it. Never
 * throws; a bad code gives a reason a player can act on.
 */
export async function unpackSaves(input: string): Promise<UnpackResult> {
  if (typeof input !== "string") return { ok: false, reason: NOT_A_CODE };
  if (input.length > MAX_CODE_CHARS) return { ok: false, reason: "That code is too big to be a save code." };
  // Copying through notes or messages can add spaces and line breaks.
  const text = input.replace(/\s+/g, "");
  if (!text) return { ok: false, reason: "Paste a save code first." };
  const parts = text.split(".");
  if (parts.length !== 3 || !parts[0].startsWith("KIBSAVE")) return { ok: false, reason: NOT_A_CODE };
  if (parts[0] !== PREFIX) return { ok: false, reason: "That code is from a newer version of the game. Update the game, then try again." };
  const [, form, body] = parts;
  if (form !== "z" && form !== "j") return { ok: false, reason: NOT_A_CODE };
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(body)) return { ok: false, reason: "That code is broken — some of it is missing or changed. Copy it again." };
  const raw = base64ToBytes(body);
  if (!raw) return { ok: false, reason: "That code is broken — some of it is missing or changed. Copy it again." };

  let jsonBytes: Uint8Array | null;
  if (form === "z") {
    if (!canCompress()) return { ok: false, reason: "This browser can't open that code. Update the phone, or copy the code again with an older version." };
    jsonBytes = await gunzip(raw, MAX_JSON_BYTES);
    if (!jsonBytes) return { ok: false, reason: "That code is broken — some of it is missing or changed. Copy it again." };
  } else {
    if (raw.length > MAX_JSON_BYTES) return { ok: false, reason: "That code is too big to be a save code." };
    jsonBytes = raw;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(jsonBytes));
  } catch {
    return { ok: false, reason: "That code is broken — some of it is missing or changed. Copy it again." };
  }
  return checkPack(parsed);
}

/** Checks the shape and loads every save, exactly as the game would. */
export function checkPack(parsed: unknown): UnpackResult {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: NOT_A_CODE };
  const p = parsed as Partial<SavePack>;
  if (p.app !== APP || p.kind !== KIND) return { ok: false, reason: NOT_A_CODE };
  if (typeof p.v !== "number") return { ok: false, reason: NOT_A_CODE };
  if (p.v > PACK_VERSION) return { ok: false, reason: "That code is from a newer version of the game. Update the game, then try again." };
  if (p.v !== PACK_VERSION) return { ok: false, reason: NOT_A_CODE };
  if (!Array.isArray(p.slots)) return { ok: false, reason: NOT_A_CODE };
  if (p.slots.length === 0) return { ok: false, reason: "That code has no saves in it." };
  if (p.slots.length > MAX_SAVE_SLOTS) return { ok: false, reason: `That code has more than ${MAX_SAVE_SLOTS} saves in it.` };

  const seen = new Set<number>();
  const slots: CheckedPack["slots"] = [];
  for (const s of p.slots as unknown[]) {
    if (!s || typeof s !== "object") return { ok: false, reason: NOT_A_CODE };
    const { slot, career, phase } = s as PackedSlot;
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SAVE_SLOTS || seen.has(slot)) {
      return { ok: false, reason: "That code has a save in a slot that doesn't exist." };
    }
    seen.add(slot);
    const loaded = loadCareerFromStoredForm(career);
    if (!loaded) return { ok: false, reason: `Save ${slot} in that code won't open. Nothing was changed.` };
    slots.push({ slot, career: loaded, phase: sanitizeSavedPhase(phase), summary: summariseSave(slot, loaded) });
  }
  slots.sort((a, b) => a.slot - b.slot);
  const active = Number.isInteger(p.activeSlot) && seen.has(p.activeSlot as number) ? (p.activeSlot as number) : slots[0].slot;
  const made = typeof p.made === "number" && Number.isFinite(p.made) ? p.made : 0;
  return { ok: true, pack: { activeSlot: active, made, slots } };
}

/**
 * Writes the chosen slots of a checked pack into `accountScope`. Slots not
 * in the code (or not chosen) are left exactly as they were. Returns the save
 * to open next, and which slots this device would not take (full storage).
 */
export function applySaves(
  accountScope: string, pack: CheckedPack, only?: number[],
): { written: number[]; failed: number[]; openSlot: number } {
  const written: number[] = [];
  const failed: number[] = [];
  for (const s of pack.slots) {
    if (only && !only.includes(s.slot)) continue;
    if (writeMovedSave(accountScope, s.slot, s.career, s.phase)) written.push(s.slot);
    else failed.push(s.slot);
  }
  const openSlot = written.includes(pack.activeSlot) ? pack.activeSlot : (written[0] ?? loadActiveSlot(accountScope));
  if (written.length) saveActiveSlot(accountScope, openSlot);
  return { written, failed, openSlot };
}

/** "120 KB" / "1.4 MB" — the size shown beside the code. */
export function codeSizeLabel(chars: number): string {
  if (chars < 1024) return `${chars} bytes`;
  if (chars < 1024 * 1024) return `${Math.round(chars / 1024)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Above this, the clipboard on an iPhone gets unreliable (and pasting it into
 * a note is slow), so the file option is put first.
 */
export const BIG_CODE_CHARS = 1_500_000;
