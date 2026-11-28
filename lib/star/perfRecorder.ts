/**
 * THE SPEED RECORDER — the browser half (Harry, 27 Nov 2026). The rules (who, how often, what) are in
 * lib/star/perfSample.ts; this file only reads the page and sends.
 *
 * Started from /star-dev (app/star-dev/page.tsx) and from every 3D place (three3d/frameMeter.ts), once
 * per page. For a normal player it only checks, every 5 s, whether the speed readout was switched on,
 * and sends nothing. While on:
 *   - every 5 s one sample: page, career screen (phase) and bottom-bar tab, the 3D place, a loading
 *     screen if one is marked, the actions since the last sample (named buttons, screen changes, shots in
 *     a match), the frame numbers (the 3D counters of frameStats.ts when a 3D frame is fresh, else the
 *     page's own frame clock), pixel ratio, cap and automatic resolution, quality rung, GPU, device;
 *   - every 6 samples (about 30 s), and when the page hides, the batch goes to Supabase
 *     (star_perf_samples, insert only) and to PostHog ("perf_sample", only after Accept on cookies);
 *   - offline, or before the table exists: the batch is dropped, nothing is shown, nothing retries;
 *   - a small red dot top-right while it records, and "● recording" on the frame meter.
 * Never inside a frame: a 1 s timer does all the work; the frame clock only reads the time.
 * Read it back: npx tsx scripts/perf-report.mts.
 */
import {
  ActionLog, PerfSampler, buildSample, parseAgent, perfRecordingWanted, posthogProps, safeLabel,
  PERF_EVENT, PERF_TABLE, type DeviceFacts, type FrameFacts, type PerfAction, type PerfRow, type RecordReason,
} from "./perfSample";
import { frameMeterOn } from "./three3d/frameMeterPref";
import { startFrameStats } from "./three3d/frameStats";
import { currentGovernor } from "./three3d/governor";
import { currentDeviceCaps, gpuClass, quality3dSetting, quality3dTier, QUALITY3D_AUTO_KEY } from "./three3d/quality";
import { resScale } from "./three3d/resScale";
import { offlineDevPlayEnabled } from "./devMode";

type Win = Window & {
  __perfRecording?: boolean;
  /** For measuring scripts and the local check: what was sent last (no keys). */
  __perfRec?: { reason: RecordReason; taken: number; sent: number; dropped: number; supabase: string; lastRows: PerfRow[]; lastRequest: { url: string; prefer: string; auth: "user" | "anon"; body: string } | null; lastPosthog: Record<string, unknown>[] };
};

const SESSION_KEY = "kib-perf-session";
let started = false;
let phase: string | null = null;
/** The page the phase belongs to (/star-dev is served at /road-to-the-golden-ball): a phase is used only there. */
let phasePath: string | null = null;
let nav: string | null = null;
let loadingHint: string | null = null;
const actions = new ActionLog();
let t0 = 0;

/** The page's screen (the star-dev phase and bottom-bar tab). Called by app/star-dev/page.tsx on every change. */
export function perfScreen(p: string | null, n?: string | null): void {
  phasePath = typeof location !== "undefined" ? location.pathname : null;
  if (p !== phase) { phase = p; if (started && p) perfAction("phase", p); }
  const nn = n ?? null;
  if (nn !== nav) { nav = nn; if (started && nn) perfAction("nav", nn); }
}

/** A loading screen is up (its name), or gone (null). Pages may also mark one with [data-perf-loading="name"]. */
export function perfLoading(name: string | null): void { loadingHint = name; }

/** Note one player action (a named button, a match event). No free text: a short fixed label only. */
export function perfAction(k: PerfAction["k"], v: string): void {
  if (!started || !t0) return;
  const label = k === "tap" ? safeLabel(v) : v.slice(0, 32);
  if (label) actions.push({ t: (performance.now() - t0) / 1000, k, v: label });
}

function session(now: number): { id: string; at: number } {
  try {
    const k = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as { id: string; at: number } | null;
    if (k && typeof k.id === "string" && typeof k.at === "number") return k;
  } catch { /* private mode */ }
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const s = { id, at: now };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  return s;
}

function gpuNow(): string | null {
  try {
    const raw = localStorage.getItem(QUALITY3D_AUTO_KEY);
    const g = raw ? String(JSON.parse(raw)?.gpu ?? "") : "";
    if (g) return g;
  } catch { /* nothing kept */ }
  try { // once per page: a throwaway context, released at once
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ?? c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" ? name : null;
  } catch { return null; }
}

function deviceNow(model: string | null): DeviceFacts {
  const n = navigator as Navigator & { deviceMemory?: number };
  const a = parseAgent(navigator.userAgent, model);
  const gpu = gpuNow();
  return {
    gpu, gpuClass: gpu ? gpuClass(gpu) : null, device: a.device, browser: a.browser, os: a.os,
    screenW: screen.width, screenH: screen.height, viewportW: window.innerWidth, viewportH: window.innerHeight,
    dpr: window.devicePixelRatio || 1, memGB: typeof n.deviceMemory === "number" ? n.deviceMemory : null,
    cores: typeof n.hardwareConcurrency === "number" ? n.hardwareConcurrency : null,
    appVersion: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "").slice(0, 12) || (offlineDevPlayEnabled() ? "dev" : null),
  };
}

/** The page's own frame clock: gaps between animation frames, the last 5 s. Reads the time only. */
function startPageClock(): () => FrameFacts | null {
  const gaps: { t: number; ms: number }[] = [];
  let last = -1;
  const tick = (t: number) => {
    if (document.visibilityState === "hidden") last = -1;
    else { if (last >= 0) gaps.push({ t, ms: t - last }); last = t; }
    while (gaps.length && t - gaps[0].t > 5000) gaps.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    if (gaps.length < 2) return null;
    const span = Math.max(500, gaps[gaps.length - 1].t - gaps[0].t + gaps[0].ms);
    return { fps: (gaps.length * 1000) / span, worstMs: Math.max(...gaps.map((g) => g.ms)), frames: gaps.length };
  };
}

function showDot(on: boolean) {
  let el = document.querySelector<HTMLElement>("[data-perf-dot]");
  if (!on) { if (el) el.style.display = "none"; return; }
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("data-perf-dot", "");
    el.title = "Speed recording is on";
    Object.assign(el.style, {
      position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 6px)", right: "6px", width: "9px", height: "9px",
      borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 0 2px rgba(255,255,255,0.85)", zIndex: "2147483001",
      pointerEvents: "none", opacity: "0.9",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
  }
  el.style.display = "block";
}

/** Start the recorder (once per page). Safe to call from anywhere; does nothing on the server. */
export function startPerfRecorder(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const w = window as Win;
  const dev = offlineDevPlayEnabled();
  let team = false;
  let account: string | null = null;
  // The team check: the same server answer as the DevGate pages (admins and testers). A dev build's
  // "everyone is admin" shortcut does not count: there only ?fps=1 records.
  if (!dev) {
    void import("@/lib/useIsAdmin").then((m) => m.isTesterNow()).then(async (yes) => {
      if (!yes) return;
      team = true;
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().auth.getSession();
        account = data.session?.user.id ?? null;
      } catch { /* no account: still records, without it */ }
    }).catch(() => { /* not team */ });
  }

  let reason: RecordReason = null;
  let sampler: PerfSampler | null = null;
  let pageClock: (() => FrameFacts | null) | null = null;
  let device: DeviceFacts | null = null;
  let model: string | null = null;
  let supabaseState = "ready";
  const stat = { taken: 0, sent: 0 };
  const dbg = () => (w.__perfRec ??= { reason: null, taken: 0, sent: 0, dropped: 0, supabase: "ready", lastRows: [], lastRequest: null, lastPosthog: [] });

  const send = (rows: PerfRow[]) => {
    if (!rows.length || !sampler) return;
    const d = dbg();
    d.lastRows = rows;
    if (typeof navigator !== "undefined" && navigator.onLine === false) { sampler.lost(rows.length); d.dropped = sampler.dropped; return; }
    // PostHog (only after Accept on cookies: posthogClient answers null otherwise)
    void import("@/components/PostHogProvider").then(({ posthogClient }) => posthogClient()).then((ph) => {
      const props = rows.map(posthogProps);
      d.lastPosthog = props;
      if (ph) rows.forEach((r, i) => ph.capture(PERF_EVENT, props[i], { timestamp: new Date(r.sampled_at) }));
    }).catch(() => { /* no analytics */ });
    // Supabase: insert only, no read back. Quiet on any failure; a missing table stops it for this tab.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon || supabaseState === "off") return;
    void (async () => {
      let token: string | null = null;
      if (team && account) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          token = (await createClient().auth.getSession()).data.session?.access_token ?? null;
        } catch { token = null; }
      }
      // A row says whose it is only with that account's own token (the table's check: account_id = auth.uid()).
      const body = JSON.stringify(token ? rows : rows.map((r) => ({ ...r, account_id: null })));
      const endpoint = `${url}/rest/v1/${PERF_TABLE}`;
      d.lastRequest = { url: endpoint, prefer: "return=minimal", auth: token ? "user" : "anon", body };
      try {
        const res = await fetch(endpoint, {
          method: "POST", keepalive: body.length < 60000,
          headers: { apikey: anon, Authorization: `Bearer ${token ?? anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body,
        });
        if (res.ok) { stat.sent += rows.length; d.sent = stat.sent; d.supabase = supabaseState = "ok"; return; }
        // 404 / PGRST205: the table is not made yet (star_perf_samples.sql not run). Stop asking this tab.
        if (res.status === 404) supabaseState = "off";
        d.supabase = supabaseState === "off" ? "off (no table yet)" : `failed ${res.status}`;
      } catch { d.supabase = "failed (offline)"; }
    })();
  };

  const flush = () => { if (sampler) send(sampler.flush()); };

  const turnOn = (r: Exclude<RecordReason, null>) => {
    const now = Date.now();
    const s = session(now);
    reason = r;
    sampler ??= new PerfSampler(s.at);
    sampler.hold(now);
    t0 ||= performance.now();
    startFrameStats();
    pageClock ??= startPageClock();
    w.__perfRecording = true;
    dbg().reason = r;
    showDot(true); // team and ?fps=1 alike: whoever records can see it
    if (phase) perfAction("phase", phase);
    try { // Chrome's phone model ("SM-G981B" for an S20), once
      const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<{ model?: string }> } }).userAgentData;
      void uad?.getHighEntropyValues?.(["model"]).then((v) => { model = v.model || null; device = null; }).catch(() => {});
    } catch { /* not Chrome */ }
  };
  const turnOff = () => { flush(); reason = null; w.__perfRecording = false; showDot(false); if (w.__perfRec) w.__perfRec.reason = null; };

  // ── the light action hook: named buttons, shots in a match ──
  document.addEventListener("click", (e) => {
    if (!reason) return;
    const tgt = e.target as Element | null;
    if (!tgt || typeof tgt.closest !== "function" || tgt.closest("input, textarea, select, [contenteditable]")) return;
    const el = tgt.closest("[data-perf], button, a, [role=button]");
    if (!el) return;
    perfAction("tap", el.getAttribute("data-perf") || el.getAttribute("aria-label") || el.textContent || "");
  }, { capture: true, passive: true });
  window.addEventListener("kib-live-swing", (e) => {
    if (!reason) return;
    const d = (e as CustomEvent<{ hit?: boolean; why?: string }>).detail ?? {};
    perfAction("match", d.hit ? "shot hit" : `shot ${d.why ?? "missed"}`);
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.addEventListener("pagehide", flush);

  let n = 0;
  window.setInterval(() => {
    n++;
    // Off: check the switch every 5 s only.
    if (!reason && n % 5 !== 0) return;
    const want = sampler?.stopped ? null : perfRecordingWanted({ team, meterOn: frameMeterOn() });
    if (want && !reason) turnOn(want);
    else if (!want && reason) turnOff();
    if (!reason || !sampler) return;
    if (want && want !== reason) { reason = want; dbg().reason = want; }
    const now = Date.now();
    if (!sampler.due(now, document.visibilityState !== "hidden")) {
      if (sampler.stopped) turnOff(); // 2 h: done for this tab
      return;
    }
    device ??= deviceNow(model);
    const st = startFrameStats().summary();
    const three: FrameFacts | null = st && performance.now() - st.t < 4500 && st.frames >= 2
      ? { fps: st.fps, worstMs: st.worstMs, frames: st.frames, draws: st.draws, tris: st.tris, jsMs: st.jsMs, pixelRatio: st.pixelRatio }
      : null;
    const g = currentGovernor();
    let caps: { cap: number | null; scale: number | null } | null = null;
    try { const c = currentDeviceCaps(); caps = { cap: c.scaled ? c.maxPixelRatio : null, scale: c.scaled ? resScale.scale : null }; } catch { caps = null; }
    let qs: string | null = null;
    try { qs = quality3dSetting(); } catch { qs = null; }
    const marked = document.querySelector("[data-perf-loading]")?.getAttribute("data-perf-loading") || null;
    const row = buildSample({
      session: session(now).id, account: reason === "team" ? account : null, reason, at: now,
      where: { path: location.pathname, search: location.search, phase: phasePath === location.pathname ? phase : null, phoneUp: !!document.querySelector(".hp-layer") },
      nav, loading: loadingHint ?? marked, actions: actions.take(), three, page: pageClock ? pageClock() : null,
      gov: g ? { rung: g.index, tier: g.tier } : three ? { rung: null, tier: quality3dTier() } : null, qualitySetting: qs, caps, device,
    });
    stat.taken++;
    const d = dbg(); d.taken = stat.taken;
    const batch = sampler.add(now, row);
    d.dropped = sampler.dropped;
    if (batch) send(batch);
  }, 1000);
}
