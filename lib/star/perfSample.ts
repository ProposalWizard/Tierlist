/**
 * THE SPEED RECORDER — the pure half (Harry, 27 Nov 2026: "when we turn on the speed check, it's
 * recording directly back to a database with some understanding of what screens it is on at the time,
 * what actions are being had … so it would be automatically tracking over playtests").
 *
 * Who records (perfRecordingWanted): the team's accounts (admins and testers, the same check as the
 * DevGate pages), and anyone whose phone has the speed readout switched on (?fps=1 once, or the switch
 * at the top of Settings: lib/star/three3d/frameMeterPref.ts). Nobody else: a normal player sends
 * nothing. A local `next dev` build counts as admin for the game's tools, but not here: it records
 * only with ?fps=1, so the playtest agents' software-GL numbers never fill the table by themselves.
 *
 * One sample every 5 s at most (SAMPLE_EVERY_MS), sent in batches of up to 6 (about every 30 s, and
 * when the page is hidden), never more than 2 h a tab session (STOP_AFTER_MS), at most 60 waiting.
 * The browser half (lib/star/perfRecorder.ts) reads the frame meter's counters and sends each batch to
 * the Supabase table star_perf_samples AND to PostHog as the event "perf_sample".
 *
 * Everything here is pure (no window, no clock of its own) so tests/star/perfSample.mts can drive it
 * with a fake clock: nothing depends on the frame rate.
 */

export const SAMPLE_EVERY_MS = 5000;
export const SEND_EVERY = 6;
export const STOP_AFTER_MS = 2 * 60 * 60 * 1000;
export const MAX_QUEUE = 60;
export const MAX_ACTIONS = 8;
export const PERF_EVENT = "perf_sample";
export const PERF_TABLE = "star_perf_samples";

// ── who records ────────────────────────────────────────────────────────────────

export interface RecordGate {
  /** The server said this account is an admin or a tester (never true on a dev build's shortcut). */
  team: boolean;
  /** The speed readout's switch is on for this phone (?fps=1 once, or Settings). */
  meterOn: boolean;
}
export type RecordReason = "team" | "fps" | null;

/** Why this tab records, or null when it must send nothing. */
export function perfRecordingWanted(g: RecordGate): RecordReason {
  if (g.team) return "team";
  if (g.meterOn) return "fps";
  return null;
}

// ── where the player is ────────────────────────────────────────────────────────

/** The 3D places Harry named, plus "match" (the 2D match) and "match3d" (the match drawn in 3D). */
export type PerfPlace = "garden" | "house" | "shop" | "casino" | "phone" | "match" | "match3d" | "training" | "gym" | "world" | "drive" | "compound" | "cutscene" | "other3d";

/** The career's screen (the star-dev phase) as a 3D place, or null for a flat screen. */
export function placeOfPhase(phase: string | null | undefined): PerfPlace | null {
  if (!phase) return null;
  if (phase === "garden") return "garden";
  if (phase === "home-3d") return "house";
  if (phase === "shop-3d") return "shop";
  if (phase === "casino-3d" || phase.startsWith("casino-")) return "casino";
  if (phase === "training-3d") return "training";
  if (phase === "gym-3d") return "gym";
  if (phase === "street-3d") return "other3d";
  if (phase === "match" || phase === "farewell-match") return "match";
  return null;
}

/** A test page's 3D place, from its address (/star-garden3d-dev, /star-world3d-dev?place=gym …). */
export function placeOfPath(path: string, search = ""): PerfPlace | null {
  const q = new URLSearchParams(search).get("place");
  if (path.startsWith("/star-world3d-dev")) return q === "gym" ? "gym" : q === "compound" ? "compound" : q === "garden" ? "garden" : q === "house" ? "house" : "world";
  if (path.startsWith("/star-drive3d-dev")) return "drive";
  if (path.startsWith("/star-garden3d-dev")) return "garden";
  if (path.startsWith("/star-home3d-dev")) return "house";
  if (path.startsWith("/star-shop3d-dev")) return "shop";
  if (path.startsWith("/star-training3d-dev")) return "training";
  if (path.startsWith("/star-phone3d-dev")) return "phone";
  if (path.startsWith("/star-scene-editor-dev") || path.startsWith("/star-3d-area-dev")) return "cutscene";
  if (path.startsWith("/star-3d-bench-dev") || path.startsWith("/star-3d-dev")) return "other3d";
  return null;
}

export interface WhereFacts {
  path: string;
  search?: string;
  /** The career's phase (app/star-dev/page.tsx, served at /road-to-the-golden-ball), when that page is up. */
  phase?: string | null;
  /** The 3D phone is open (its layer is on the page). */
  phoneUp?: boolean;
  /** A 3D frame was drawn in the last 4 s. */
  drawing3d?: boolean;
}

/** The one place a sample is filed under. The phone wins (it sits over the house); a match drawn in 3D is "match3d". */
export function placeOf(w: WhereFacts): PerfPlace | null {
  if (w.phoneUp) return "phone";
  const p = w.phase ? placeOfPhase(w.phase) : placeOfPath(w.path, w.search);
  if (p === "match" && w.drawing3d) return "match3d";
  return p;
}

/** The screen name a sample is filed under: the career's phase when the page has one, else the page itself. */
export function screenOf(path: string, phase?: string | null): string {
  if (phase) return phase.slice(0, 40);
  return (path || "/").slice(0, 60);
}

// ── what the player did ────────────────────────────────────────────────────────

export interface PerfAction {
  /** Seconds since the tab started recording. */
  t: number;
  /** tap = a named button; phase = the screen changed; match = a match event; nav = the bottom bar. */
  k: "tap" | "phase" | "match" | "nav";
  v: string;
}

/**
 * A button's name, safe to send: the words on the button (or its aria-label / data-perf), squashed to
 * one line, at most 32 characters. Anything that could be someone's own words is dropped: an empty
 * label, an address (@), a run of 9+ digits (a phone number, a code; money with commas is fine).
 */
export function safeLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.includes("@") || /\d{9,}/.test(s.replace(/[\s()-]/g, ""))) return null; // a phone number, a code
  return s.length > 32 ? s.slice(0, 31) + "…" : s;
}

/** The actions since the last sample, newest last, at most MAX_ACTIONS. */
export class ActionLog {
  private list: PerfAction[] = [];
  push(a: PerfAction) {
    const last = this.list[this.list.length - 1];
    if (last && last.k === a.k && last.v === a.v && a.t - last.t < 1) return; // a double fire, once
    this.list.push(a);
    if (this.list.length > MAX_ACTIONS) this.list.shift();
  }
  take(): PerfAction[] { const out = this.list; this.list = []; return out; }
  get size() { return this.list.length; }
}

// ── the sample ─────────────────────────────────────────────────────────────────

/** One sample: exactly the columns of star_perf_samples (supabase/migrations/star_perf_samples.sql) that the browser may write. */
export interface PerfRow {
  session_id: string;
  account_id: string | null;
  reason: "team" | "fps";
  sampled_at: string;
  page: string;
  screen: string;
  nav: string | null;
  place: string | null;
  loading: string | null;
  actions: PerfAction[];
  source: "3d" | "page";
  fps: number | null;
  worst_ms: number | null;
  frames: number | null;
  draws: number | null;
  tris: number | null;
  js_ms: number | null;
  pixel_ratio: number | null;
  px_cap: number | null;
  res_scale: number | null;
  quality_rung: number | null;
  quality_tier: string | null;
  quality_setting: string | null;
  gpu: string | null;
  gpu_class: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  screen_w: number | null;
  screen_h: number | null;
  viewport_w: number | null;
  viewport_h: number | null;
  dpr: number | null;
  mem_gb: number | null;
  cores: number | null;
  app_version: string | null;
}

/** The columns the browser may write, in one list (the migration's GRANT, the test). */
export const PERF_COLUMNS: (keyof PerfRow)[] = [
  "session_id", "account_id", "reason", "sampled_at", "page", "screen", "nav", "place", "loading", "actions",
  "source", "fps", "worst_ms", "frames", "draws", "tris", "js_ms", "pixel_ratio", "px_cap", "res_scale",
  "quality_rung", "quality_tier", "quality_setting", "gpu", "gpu_class", "device", "browser", "os",
  "screen_w", "screen_h", "viewport_w", "viewport_h", "dpr", "mem_gb", "cores", "app_version",
];

/** The frame numbers for a sample: the 3D counters when a 3D frame is fresh, else the page's own frame clock. */
export interface FrameFacts {
  fps: number; worstMs: number; frames: number;
  draws?: number; tris?: number; jsMs?: number; pixelRatio?: number;
}

const r1 = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const int = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x) : null);
const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

export interface SampleInput {
  session: string;
  account: string | null;
  reason: "team" | "fps";
  at: number; // ms since 1970
  where: WhereFacts;
  nav?: string | null;
  loading?: string | null;
  actions: PerfAction[];
  three: FrameFacts | null;
  page: FrameFacts | null;
  /** The scene's governor (rung null when the scene has none: the tier alone). */
  gov?: { rung: number | null; tier: string } | null;
  qualitySetting?: string | null;
  caps?: { cap: number | null; scale: number | null } | null;
  device: DeviceFacts;
}

export interface DeviceFacts {
  gpu: string | null; gpuClass: string | null; device: string | null; browser: string | null; os: string | null;
  screenW: number | null; screenH: number | null; viewportW: number | null; viewportH: number | null;
  dpr: number | null; memGB: number | null; cores: number | null; appVersion: string | null;
}

/** Build one row. Pure. */
export function buildSample(i: SampleInput): PerfRow {
  const f = i.three ?? i.page;
  const three = !!i.three;
  return {
    session_id: i.session.slice(0, 40),
    account_id: i.account,
    reason: i.reason,
    sampled_at: new Date(i.at).toISOString(),
    page: cut(i.where.path || "/", 60)!,
    screen: screenOf(i.where.path, i.where.phase),
    nav: cut(i.nav ?? null, 20),
    place: placeOf({ ...i.where, drawing3d: three }),
    loading: cut(i.loading ?? null, 40),
    actions: i.actions.slice(-MAX_ACTIONS).map((a) => ({ t: r1(a.t) ?? 0, k: a.k, v: a.v.slice(0, 32) })),
    source: three ? "3d" : "page",
    fps: r1(f?.fps), worst_ms: int(f?.worstMs), frames: int(f?.frames),
    draws: three ? int(i.three!.draws) : null,
    tris: three ? int(i.three!.tris) : null,
    js_ms: three ? r1(i.three!.jsMs) : null,
    pixel_ratio: three ? r2(i.three!.pixelRatio) : null,
    px_cap: r2(i.caps?.cap ?? null),
    res_scale: r2(i.caps?.scale ?? null),
    quality_rung: i.gov ? i.gov.rung : null,
    quality_tier: cut(i.gov?.tier ?? null, 10),
    quality_setting: cut(i.qualitySetting ?? null, 10),
    gpu: cut(i.device.gpu, 80), gpu_class: cut(i.device.gpuClass, 16),
    device: cut(i.device.device, 40), browser: cut(i.device.browser, 24), os: cut(i.device.os, 24),
    screen_w: int(i.device.screenW), screen_h: int(i.device.screenH),
    viewport_w: int(i.device.viewportW), viewport_h: int(i.device.viewportH),
    dpr: r2(i.device.dpr), mem_gb: i.device.memGB, cores: int(i.device.cores),
    app_version: cut(i.device.appVersion, 40),
  };
}

/** The same sample as PostHog event properties (the row, plus PostHog's own "$current_url"-free names). */
export function posthogProps(row: PerfRow): Record<string, unknown> {
  const { actions, ...rest } = row;
  return { ...rest, actions: actions.map((a) => `${a.k}:${a.v}`).join(" | "), action_count: actions.length };
}

// ── device, from the browser's own words ───────────────────────────────────────

/** Browser, OS and phone model from a user agent (and the model Chrome gives separately, if any). */
export function parseAgent(ua: string, model?: string | null): { device: string; browser: string; os: string } {
  const os = /iPhone|iPad|iPod/.test(ua) ? `iOS ${(ua.match(/OS (\d+)[_.](\d+)/) ?? []).slice(1, 3).join(".")}`.trim()
    : /Android/.test(ua) ? `Android ${(ua.match(/Android (\d+(?:\.\d+)?)/) ?? [])[1] ?? ""}`.trim()
    : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "other";
  const BROWSERS: [RegExp, string][] = [
    [/SamsungBrowser\/(\d+)/, "Samsung"], [/CriOS\/(\d+)/, "Chrome"], [/FxiOS\/(\d+)/, "Firefox"], [/Firefox\/(\d+)/, "Firefox"],
    [/Edg\/(\d+)/, "Edge"], [/Chrome\/(\d+)/, "Chrome"], [/Version\/(\d+).*Safari/, "Safari"],
  ];
  let browser = "other";
  for (const [re, name] of BROWSERS) { const m = ua.match(re); if (m) { browser = `${name} ${m[1]}`; break; } }
  const fromUa = (ua.match(/Android [\d.]+; ([^;)]+)[;)]/) ?? [])[1]?.trim();
  const device = (model && model.trim()) || (fromUa && fromUa !== "K" ? fromUa : "")
    || (/iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mobile/.test(ua) ? "phone" : "computer");
  return { device, browser, os };
}

// ── the sampler: when to take a sample, when to send ───────────────────────────

export interface SamplerOptions {
  everyMs?: number; sendEvery?: number; stopAfterMs?: number; maxQueue?: number;
}

/**
 * The clock and the queue, with no clock of its own: the browser half calls `tick(now)` from a timer
 * (about once a second) and `flush()` when the page hides. Frame-rate free: a slow phone gets the same
 * one sample per 5 s as a fast one.
 */
export class PerfSampler {
  readonly everyMs: number; readonly sendEvery: number; readonly stopAfterMs: number; readonly maxQueue: number;
  private lastAt = -Infinity;
  private queue: PerfRow[] = [];
  taken = 0;
  dropped = 0;
  stopped = false;

  constructor(private startedAt: number, o: SamplerOptions = {}) {
    this.everyMs = o.everyMs ?? SAMPLE_EVERY_MS;
    this.sendEvery = o.sendEvery ?? SEND_EVERY;
    this.stopAfterMs = o.stopAfterMs ?? STOP_AFTER_MS;
    this.maxQueue = o.maxQueue ?? MAX_QUEUE;
  }

  /** Time for a sample? (Not while hidden; never twice in 5 s; never after 2 h.) */
  due(now: number, visible = true): boolean {
    if (this.stopped) return false;
    if (now - this.startedAt >= this.stopAfterMs) { this.stopped = true; return false; }
    return visible && now - this.lastAt >= this.everyMs;
  }

  /** Just switched on: the first sample comes one full 5 s later (so the frame clock has something to say). */
  hold(now: number) { this.lastAt = now; }

  /** Keep one sample. Returns a batch to send when the batch is full, else null. */
  add(now: number, row: PerfRow): PerfRow[] | null {
    this.lastAt = now;
    this.taken++;
    this.queue.push(row);
    while (this.queue.length > this.maxQueue) { this.queue.shift(); this.dropped++; }
    return this.queue.length >= this.sendEvery ? this.flush() : null;
  }

  /** Everything waiting, emptied (the page is hiding, or the batch is full). */
  flush(): PerfRow[] { const out = this.queue; this.queue = []; return out; }

  /** A send failed for want of a connection: the batch is dropped, never resent (no pile-up). */
  lost(n: number) { this.dropped += n; }

  get waiting() { return this.queue.length; }
}
