/**
 * MAKING A GOAL VIDEO WITHOUT FREEZING THE FEED (speed pass, 22 Oct 2026).
 * Leo: "I will NOT tolerate loading times even on bad phones".
 *
 * Before: every video in the feed was drawn and encoded on the page itself,
 * frame by frame, while you scrolled. Measured with the CPU slowed 6× (a
 * cheap phone): 124 freezes over 100 ms in 40 scroll steps, the longest 5.3 s.
 *
 * Now:
 *  1. A video is made in a Web Worker (clip.worker.ts): the same drawing and
 *     encoder, away from the page. The still is drawn there too.
 *  2. A made video is kept on the phone (IndexedDB, "star-goal-videos"), so
 *     the feed opened again, even after closing the game, plays it at once.
 *  3. A browser without workers that can draw (no OffscreenCanvas) makes it
 *     on the page as before, but only between scrolls and in idle time,
 *     one frame at a time.
 */
import type { Edit } from "./edit";
import { posterMoment } from "./edit";
import { drawEditFrame, prepareClipSprites, type ClipCredit } from "./render";
import { encodeEdit, type EncodedClip } from "./encode";
import type { WorkerJob, PosterJob, WorkerReply } from "./clip.worker";

/** Bump when the drawing changes, so kept videos are made again. */
const CACHE_VERSION = 1;
/** How many made videos this phone keeps (about 0.3–1 MB each). */
export const KEEP_VIDEOS = 40;

// ── The worker ──────────────────────────────────────────────────────────────

let worker: Worker | null = null;
let workerOk: Promise<boolean> | null = null;
let broken = false;
let nextId = 1;
const waiters = new Map<number, (m: WorkerReply) => void>();

/** Settings the drawing reads from the page's storage (looks, moves). */
function settings(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("star-look")) continue;
      const v = localStorage.getItem(k);
      if (v !== null && v.length < 400) out[k] = v;
    }
  } catch { /* none */ }
  return out;
}

/** True when videos are made in the worker (resolves once it has started). */
export function workerReady(moves: Edit["moves"] = "new"): Promise<boolean> {
  if (workerOk) return workerOk;
  workerOk = new Promise<boolean>((res) => {
    if (typeof window === "undefined" || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") { res(false); return; }
    try {
      worker = new Worker(new URL("./clip.worker.ts", import.meta.url));
    } catch { res(false); return; }
    const timer = setTimeout(() => { broken = true; res(false); }, 15_000);
    worker.onmessage = (ev: MessageEvent<WorkerReply>) => {
      const m = ev.data;
      if (m.id === -1 && m.kind === "ready") { clearTimeout(timer); if (!m.ok) broken = true; res(m.ok); return; }
      waiters.get(m.id)?.(m);
    };
    worker.onerror = () => { clearTimeout(timer); broken = true; res(false); for (const w of Array.from(waiters.values())) w({ id: 0, kind: "error", message: "worker died" }); };
    worker.postMessage({ kind: "ping", moves });
  });
  return workerOk;
}

/** Start the worker early (it loads the figures before the first video is asked for). */
export function warmVideoMaker(moves: Edit["moves"] = "new"): void {
  void playerReady(moves);
  void workerReady(moves).then(ok => {
    if (!ok) { void prepareClipSprites(moves); return; }
  });
}

// ── The still ───────────────────────────────────────────────────────────────

const posters = new Map<string, ImageBitmap | HTMLCanvasElement>();

/**
 * The still for a video: drawn in the worker when it can be, else on the page
 * in idle time. Kept for the session.
 */
export async function posterFor(key: string, edit: Edit, credit?: ClipCredit): Promise<ImageBitmap | HTMLCanvasElement | null> {
  const hit = posters.get(key);
  if (hit) return hit;
  if (await workerReady() && !broken && worker) {
    const id = nextId++;
    const reply = await new Promise<WorkerReply>((res) => {
      waiters.set(id, res);
      worker!.postMessage({ id, kind: "poster", edit, credit, settings: settings() } satisfies PosterJob);
    });
    waiters.delete(id);
    if (reply.kind === "poster") { posters.set(key, reply.bitmap); return reply.bitmap; }
  }
  await prepareClipSprites(edit.moves);
  await idle();
  const c = document.createElement("canvas");
  c.width = edit.w; c.height = edit.h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  drawEditFrame(ctx, edit, 0, credit, posterMoment(edit));
  posters.set(key, c);
  return c;
}

// ── Kept videos (IndexedDB) ─────────────────────────────────────────────────

const VDB = "star-goal-videos";
const VSTORE = "videos";

function openVideos(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(VDB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(VSTORE)) db.createObjectStore(VSTORE, { keyPath: "key" }).createIndex("savedAt", "savedAt");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

interface KeptVideo { key: string; savedAt: number; blob: Blob; mime: string; ext: "mp4" | "webm"; duration: number; width: number; height: number; hasAudio: boolean }

const cacheKey = (key: string) => `v${CACHE_VERSION}|${key}`;

/** A video made before on this phone, or null. */
export async function keptVideo(key: string): Promise<Omit<EncodedClip, "audio"> | null> {
  const db = await openVideos();
  if (!db) return null;
  try {
    const tx = db.transaction(VSTORE, "readonly");
    const req = tx.objectStore(VSTORE).get(cacheKey(key));
    const row = await new Promise<KeptVideo | undefined>((res) => { req.onsuccess = () => res(req.result as KeptVideo | undefined); req.onerror = () => res(undefined); });
    if (!row || !(row.blob instanceof Blob) || row.blob.size === 0) return null;
    return { blob: row.blob, mime: row.mime, ext: row.ext, duration: row.duration, width: row.width, height: row.height, hasAudio: row.hasAudio };
  } catch { return null; } finally { db.close(); }
}

async function keepVideo(key: string, v: EncodedClip): Promise<void> {
  const db = await openVideos();
  if (!db) return;
  try {
    const tx = db.transaction(VSTORE, "readwrite");
    const st = tx.objectStore(VSTORE);
    const row: KeptVideo = { key: cacheKey(key), savedAt: Date.now(), blob: v.blob, mime: v.mime, ext: v.ext, duration: v.duration, width: v.width, height: v.height, hasAudio: v.hasAudio };
    st.put(row);
    // Keep the newest KEEP_VIDEOS.
    const keys = st.index("savedAt").getAllKeys();
    keys.onsuccess = () => {
      const all = keys.result as IDBValidKey[];
      for (const k of all.slice(0, Math.max(0, all.length - KEEP_VIDEOS))) st.delete(k);
    };
    await new Promise<void>((res) => { tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res(); });
  } catch { /* full: it is simply made again next time */ } finally { db.close(); }
}

// ── Making one ──────────────────────────────────────────────────────────────

/** When the feed was last scrolled (the page-side fallback waits for a pause). */
let lastScroll = 0;
if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => { lastScroll = performance.now(); }, { capture: true, passive: true });
  window.addEventListener("touchmove", () => { lastScroll = performance.now(); }, { capture: true, passive: true });
}

function idle(): Promise<void> {
  return new Promise((res) => {
    const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => res(), { timeout: 1500 }); else setTimeout(res, 16);
  });
}

/** The page-side fallback: one frame at a time, never while scrolling. */
async function gate(): Promise<void> {
  while (performance.now() - lastScroll < 250) await new Promise(r => setTimeout(r, 120));
  await idle();
}

/**
 * Make (or fetch the kept copy of) the video for `edit`. Resolves null when
 * this browser cannot make video.
 */
/** Videos being made now: a second ask for the same one joins it (premake.ts starts them at full time). */
const inFlight = new Map<string, { job: Promise<EncodedClip | null>; listeners: Set<(k: number) => void> }>();

export function makeVideo(
  key: string,
  edit: Edit,
  opts: { credit?: ClipCredit; onProgress?: (k: number) => void; audio?: AudioBuffer | null } = {},
): Promise<EncodedClip | null> {
  const have = inFlight.get(key);
  if (have) {
    if (opts.onProgress) have.listeners.add(opts.onProgress);
    return have.job.then(v => (v && !v.audio && opts.audio ? { ...v, audio: opts.audio } : v));
  }
  const listeners = new Set<(k: number) => void>();
  if (opts.onProgress) listeners.add(opts.onProgress);
  const job = makeOne(key, edit, { ...opts, onProgress: k => listeners.forEach(f => f(k)) });
  inFlight.set(key, { job, listeners });
  const done = () => { inFlight.delete(key); };
  job.then(done, done);
  return job;
}

async function makeOne(
  key: string,
  edit: Edit,
  opts: { credit?: ClipCredit; onProgress?: (k: number) => void; audio?: AudioBuffer | null },
): Promise<EncodedClip | null> {
  const kept = await keptVideo(key);
  if (kept) { opts.onProgress?.(1); return { ...kept, audio: opts.audio ?? null }; }
  const audio = opts.audio ?? null;
  let out: EncodedClip | null = null;
  if (await workerReady() && !broken && worker) {
    const id = nextId++;
    const job: WorkerJob = {
      id, edit, credit: opts.credit, settings: settings(),
      audio: audio ? { sampleRate: audio.sampleRate, channels: Array.from({ length: audio.numberOfChannels }, (_, ch) => audio.getChannelData(ch).slice()) } : null,
    };
    const reply = await new Promise<WorkerReply>((res) => {
      waiters.set(id, (m) => {
        if (m.kind === "progress") { opts.onProgress?.(m.k); return; }
        res(m);
      });
      worker!.postMessage(job, job.audio ? job.audio.channels.map(c => c.buffer) : []);
    });
    waiters.delete(id);
    if (reply.kind === "done") {
      out = { blob: reply.blob, mime: reply.mime, ext: reply.ext, duration: reply.duration, width: reply.width, height: reply.height, hasAudio: reply.hasAudio, audio };
    } else if (reply.kind === "none") {
      return null;
    } else {
      // The worker could not make it: the page makes this one (and the rest).
      broken = true;
    }
  }
  if (!out) out = await encodeEdit(edit, { credit: opts.credit, onProgress: opts.onProgress, audio, gate });
  if (out) void keepVideo(key, out);
  return out;
}

/** True once the worker has failed (or never started): the page makes videos. */
export function videosOnPage(): boolean {
  return broken;
}

// ── The live player (a second worker, so making files never slows it) ──────

let player: Worker | null = null;
let playerOk: Promise<boolean> | null = null;
const liveWaiters = new Map<number, (m: WorkerReply) => void>();

/** True when this phone can play a goal live in the player worker. */
export function playerReady(moves: Edit["moves"] = "new"): Promise<boolean> {
  if (playerOk) return playerOk;
  playerOk = new Promise<boolean>((res) => {
    if (typeof window === "undefined" || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined"
      || typeof HTMLCanvasElement === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) { res(false); return; }
    try { player = new Worker(new URL("./clip.worker.ts", import.meta.url)); } catch { res(false); return; }
    const timer = setTimeout(() => res(false), 15_000);
    player.onmessage = (ev: MessageEvent<WorkerReply>) => {
      const m = ev.data;
      if (m.id === -1 && m.kind === "ready") { clearTimeout(timer); res(m.ok); return; }
      liveWaiters.get(m.id)?.(m);
    };
    player.onerror = () => { clearTimeout(timer); res(false); };
    player.postMessage({ kind: "ping", moves });
  });
  return playerOk;
}

/**
 * Play `edit` live on `canvas` (drawn in the player worker, in real time,
 * looping). `onFirst` fires when the first frame is on screen; `onTime`
 * reports the clip time a few times a second. Returns a stop function, or
 * null when this phone cannot play live (the canvas is then untouched).
 */
export async function startLive(
  canvas: HTMLCanvasElement, edit: Edit, credit: ClipCredit | undefined,
  onFirst: () => void, onTime: (t: number) => void,
): Promise<(() => void) | null> {
  if (!(await playerReady(edit.moves)) || !player) return null;
  let off: OffscreenCanvas;
  try { off = canvas.transferControlToOffscreen(); } catch { return null; }
  const id = nextId++;
  liveWaiters.set(id, (m) => {
    if (m.kind === "live-first") onFirst();
    else if (m.kind === "live-t") onTime(m.t);
  });
  player.postMessage({ id, kind: "live", canvas: off, edit, credit, settings: settings() }, [off]);
  return () => { liveWaiters.delete(id); player?.postMessage({ kind: "live-stop", id }); };
}

/** Get the live player ready for this goal (drawings loaded, kits coloured). */
const warmed = new Set<string>();
export function warmLive(key: string, edit: Edit, credit?: ClipCredit): void {
  if (warmed.has(key)) return;
  warmed.add(key);
  void playerReady(edit.moves).then(ok => {
    if (ok && player) player.postMessage({ kind: "live-warm", edit, credit, settings: settings() });
  });
}
