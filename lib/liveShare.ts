/**
 * lib/liveShare.ts — "Live share (test)" on the admin Videos page (Harry,
 * 20 Oct 2026: "what if it was a live share screen? That gives some sort of
 * link, where then Claude can be given that link, see what you're seeing in
 * real time, and hear what you're saying").
 *
 * A Claude chat cannot watch a video stream. It can read pictures and text it
 * fetches. So a live share is near-real-time: once a second the browser
 * sends a small picture of the screen (only when it changed) and the lines of
 * what the person said, into public storage under live/<code>/. A Claude chat
 * runs scripts/live-watch.mts <code>, which prints each new line, a short
 * "what changed" line per batch of pictures, and saves the newest picture to
 * a file it can look at. Replies come back in the chat, asked for or not.
 *
 * Pure parts only here (tested in tests/star/liveShare.mts): the code, the
 * file names, what to prune, the transcript, "did the picture change". The
 * browser side is lib/liveShareBrowser.ts; the server side is
 * app/api/admin/live-share and lib/liveShareStore.ts.
 */

/** Same letters as legend share codes: no I, O, 0 or 1 to misread. */
export const LIVE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LIVE_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * A picture every this many ms, when the screen changed. Harry, 20 Oct 2026:
 * "if it could do one picture a second … worth having as a test".
 */
export const FRAME_EVERY_MS = 1000;
/** Pictures are this wide (or the screen's own width, if smaller). */
export const FRAME_WIDTH = 720;
/** Pictures kept in storage (about 5 minutes at one a second); older ones are deleted as new ones come. */
export const KEEP_FRAMES = 300;
/** A share ends by itself after 30 minutes. */
export const MAX_LIVE_MS = 30 * 60 * 1000;
/** Without a new picture, the page still says "still here" this often. */
export const HEARTBEAT_MS = 15000;
/** Transcript lines kept. */
export const KEEP_LINES = 300;
/** Storage folder (bucket tierlist-images). */
export const LIVE_FOLDER = "live";

export function newLiveCode(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += LIVE_ALPHABET[Math.floor(rand() * LIVE_ALPHABET.length) % LIVE_ALPHABET.length];
  return s;
}

/**
 * A code from whatever was pasted: "K7Q2XM", "k7q2xm", "K7Q 2XM" or the
 * whole link ".../admin/videos/live/K7Q2XM". Null when there is none.
 */
export function parseLiveCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const fromLink = text.match(/\/live\/([A-Za-z0-9]{6})(?:[/?#\s]|$)/);
  const raw = (fromLink ? fromLink[1] : text).replace(/[\s-]/g, "").toUpperCase();
  return LIVE_CODE.test(raw) ? raw : null;
}

export const liveLink = (code: string, origin = "https://knowitball.co.uk") => `${origin.replace(/\/$/, "")}/admin/videos/live/${code}`;

/** The one line to paste into a Claude chat. */
export const claudeLineFor = (code: string) =>
  `Live share ${code}: run \`npx tsx scripts/live-watch.mts ${code}\` in the background and keep watching its output. Look at the newest picture when I say something or the screen changes, and answer me here, without waiting to be asked when you spot something.`;

/** Frame 7 → "f000007.jpg" (sorts in order). */
export function frameName(n: number): string {
  return `f${String(Math.max(0, Math.floor(n))).padStart(6, "0")}.jpg`;
}
export function frameNumber(name: string): number | null {
  const m = name.match(/^f(\d{6})\.jpg$/);
  return m ? Number(m[1]) : null;
}

/**
 * After frame `n` is saved, the frames to delete so only `keep` remain.
 * Normally one name (n - keep). `lastPruned` lets a page that missed a few
 * (a failed send) catch up, at most 20 at a time.
 */
export function framesToPrune(n: number, keep = KEEP_FRAMES, lastPruned = n - keep - 1): string[] {
  const upTo = n - keep;
  if (upTo < 1) return [];
  const from = Math.max(1, lastPruned + 1, upTo - 19);
  const out: string[] = [];
  for (let i = from; i <= upTo; i++) out.push(frameName(i));
  return out;
}

/** Folder paths inside the bucket. */
export const livePath = (code: string, file: string) => `${LIVE_FOLDER}/${code}/${file}`;

export type LineBy = "voice" | "typed";
export interface LiveLine {
  /** 1, 2, 3 … never reused, so a watcher knows which lines are new. */
  n: number;
  /** ms since the share started. */
  at: number;
  text: string;
  by: LineBy;
}

/**
 * Adds one line. Empty text, or the same words said again within 4 s (speech
 * recognition sometimes repeats a phrase), is ignored. Keeps the last `max`.
 */
export function addLine(lines: LiveLine[], text: string, at: number, by: LineBy, max = KEEP_LINES): LiveLine[] {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!t) return lines;
  const last = lines[lines.length - 1];
  if (last && last.text.toLowerCase() === t.toLowerCase() && at - last.at < 4000) return lines;
  const next = [...lines, { n: (last?.n ?? 0) + 1, at: Math.max(0, Math.round(at)), text: t, by }];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Lines the watcher hasn't printed yet. */
export function linesAfter(lines: LiveLine[], seen: number): LiveLine[] {
  return lines.filter((l) => l.n > seen);
}

/** "0:07", "12:40". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The thumbnail compared each second: 64 × 36, red/green/blue (3 bytes a pixel). */
export const THUMB_W = 64, THUMB_H = 36, THUMB_CHANNELS = 3;

/**
 * Did the picture change? `a` and `b` are the same tiny thumbnail. Changed
 * when any value moved more than `step` (0–255), or there is no earlier
 * picture. Each thumbnail pixel is about 20 × 20 real pixels, so a number
 * ticking over or a button lighting up counts; a fade of a few levels does not.
 */
export function pictureChanged(a: ArrayLike<number> | null, b: ArrayLike<number>, step = 10): boolean {
  if (!a || a.length !== b.length || b.length === 0) return true;
  for (let i = 0; i < b.length; i++) if (Math.abs(a[i] - b[i]) > step) return true;
  return false;
}

/**
 * How much of the screen changed between two thumbnails: the share of pixels
 * where any colour moved by more than `step` (0–255). 0 = identical, 1 =
 * every pixel. No earlier picture counts as all of it. Colour, not grey: a
 * green screen and a blue one can be the same grey.
 */
export function changeShare(a: ArrayLike<number> | null, b: ArrayLike<number>, step = 24, channels = THUMB_CHANNELS): number {
  if (!a || a.length !== b.length || b.length === 0) return 1;
  const px = Math.floor(b.length / channels);
  let moved = 0;
  for (let p = 0; p < px; p++) {
    for (let c = 0; c < channels; c++) {
      const i = p * channels + c;
      if (Math.abs(a[i] - b[i]) > step) { moved++; break; }
    }
  }
  return px ? moved / px : 0;
}

export type ChangeKind = "new screen" | "part changed" | "small change";
export function changeKind(share: number): ChangeKind {
  return share >= 0.5 ? "new screen" : share >= 0.12 ? "part changed" : "small change";
}

/** One picture in state.json's short list: its number, when, and how much changed. */
export interface FrameNote { n: number; at: number; change: number }
/** Notes kept in state.json (a watcher polling every 2–3 s sees each one). */
export const KEEP_NOTES = 12;

/**
 * One line for a batch of new pictures, for a Claude chat that comments by
 * itself: "3 pictures [0:41–0:43]: new screen (82% changed)". The biggest
 * change in the batch decides the words.
 */
export function describeBatch(notes: FrameNote[], startedAt: number): string {
  if (!notes.length) return "";
  const big = Math.max(...notes.map((x) => x.change));
  const from = clock(notes[0].at - startedAt), to = clock(notes[notes.length - 1].at - startedAt);
  const when = from === to ? `[${from}]` : `[${from}–${to}]`;
  const count = notes.length === 1 ? "1 picture" : `${notes.length} pictures`;
  return `${count} ${when}: ${changeKind(big)} (${Math.round(big * 100)}% changed)`;
}

/** What state.json holds. Times are ms since 1970. */
export interface LiveState {
  code: string;
  who: string;
  startedAt: number;
  /** When it ends by itself. */
  endsAt: number;
  /** Set when Stop was pressed (or sharing ended). */
  stoppedAt: number | null;
  /** The newest picture number (0 = none yet). */
  lastFrame: number;
  /** When that picture was on the screen (the sharer's clock). */
  lastFrameAt: number;
  /** Lowest frame number still kept. */
  firstFrame: number;
  /** The newest few pictures and how much each changed (oldest first). */
  recent: FrameNote[];
  /** "on" = speech is being written down; "none" = this browser can't; "blocked" = mic said no; "off" = turned off. */
  voice: "on" | "none" | "blocked" | "off";
  /** Words being heard right now, not yet a full line. */
  hearing: string;
  /** Lines in transcript.json. */
  lines: number;
  /** The server's clock when this was saved. */
  savedAt: number;
}

const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Cleans a state the page sent, so the file always has the right shape. */
export function cleanState(raw: unknown, code: string, savedAt: number): LiveState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const voice = r.voice === "on" || r.voice === "none" || r.voice === "blocked" || r.voice === "off" ? r.voice : "none";
  const startedAt = num(r.startedAt, savedAt);
  return {
    code,
    who: str(r.who, 20),
    startedAt,
    endsAt: Math.min(num(r.endsAt, startedAt + MAX_LIVE_MS), startedAt + MAX_LIVE_MS),
    stoppedAt: r.stoppedAt == null ? null : num(r.stoppedAt, savedAt),
    lastFrame: Math.max(0, Math.floor(num(r.lastFrame))),
    lastFrameAt: num(r.lastFrameAt),
    firstFrame: Math.max(0, Math.floor(num(r.firstFrame))),
    recent: Array.isArray(r.recent)
      ? r.recent.slice(-KEEP_NOTES).filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({ n: Math.max(0, Math.floor(num(x.n))), at: num(x.at), change: Math.min(1, Math.max(0, num(x.change))) }))
      : [],
    voice,
    hearing: str(r.hearing, 300),
    lines: Math.max(0, Math.floor(num(r.lines))),
    savedAt,
  };
}

/** Cleans transcript lines the page sent. */
export function cleanLines(raw: unknown): LiveLine[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveLine[] = [];
  for (const l of raw.slice(-KEEP_LINES)) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const text = str(o.text, 500).trim();
    if (!text) continue;
    out.push({ n: Math.max(1, Math.floor(num(o.n, 1))), at: Math.max(0, num(o.at)), text, by: o.by === "typed" ? "typed" : "voice" });
  }
  return out;
}

/** Over: Stop was pressed, its 30 minutes are up, or nothing came for 60 s past its end. */
export function isOver(s: LiveState, now: number): boolean {
  return s.stoppedAt != null || now > s.endsAt + 60_000;
}
