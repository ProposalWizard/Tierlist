/**
 * THE CRASH NET FOR THE 3D PLACES (24 Nov 2026, second round).
 *
 * Mikey's app closed with no error screen in the signing's handshake. A JavaScript error does NOT do that here: src/Boot.tsx
 * already sets a global handler that shows its "Something went wrong" screen for any uncaught error. A vanished app is the phone's
 * own code dying (the GL, the view system, memory), which JavaScript cannot catch; for that, src/safety.ts keeps the trail of steps.
 * This file is for the JavaScript errors that DO happen while a 3D place is open (a frame, a callback out of the scene, a timer
 * of the scene's own, a promise): with a place mounted, such an error
 *   1. is written to the phone's storage at once (message, first stack lines, the place, the scene's last event),
 *   2. does NOT reach the handler that was there before (Boot's error screen / the fatal handler),
 *   3. fails the open place over to its plain version (its `onFail` or the plain card) and turns the Live 3D scenes switch back
 *      off (and the match's 3D view for the match), so the same scene does not start again on the next try,
 *   4. shows in Settings in the red card ("Last error: ...").
 * With no 3D place mounted, the previous handler runs exactly as before.
 *
 * No React and no phone-only imports besides the two small stores, so tools/live3d-check.mjs runs this same file.
 */
import { markLive3dOffByCrash, setPref } from "../game/prefs";
import { currentTrail, markStep, recordLastError } from "../safety";

/** A failed-over place stays covered this long (a late timer of the scene's own after it was let go). */
export const GRACE_MS = 1500;
const MATCH_PLACE = /match/i;

export interface PlaceNet {
  /** The scene's last event ("event stamp", "setShot(shake)" …), also kept as a step. */
  event(text: string): void;
  /** The place was closed or let go: it no longer counts as mounted. */
  unregister(): void;
  /** A frame of the scene threw (installFrameGate's onError). True when the net took it (the place was failed over). */
  onFrameError(e: unknown): boolean;
  /** Wraps a scene's callbacks: `onEvent` is noted as a step and handed to the screen AFTER the frame, not inside it. */
  wrapCallbacks<CB>(cb: CB, dead: () => boolean): CB;
}
interface Entry { id: number; name: string; failOver(why: string): void; lastEvent: string | null }
const places = new Map<number, Entry>();
let seq = 0;
let graceUntil = 0;
let reporting = false;

/** True while a 3D place is mounted (or was failed over a moment ago). */
export function netArmed(): boolean { return places.size > 0 || Date.now() < graceUntil; }
/** Names of the places mounted now (for the checks). */
export function mountedPlaces(): string[] { return Array.from(places.values()).map((p) => p.name); }

function stackLines(e: unknown): string[] {
  const s = e instanceof Error ? (e.stack ?? "") : "";
  return s.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => l.slice(0, 200));
}
const messageOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })()) || String(e);

/**
 * An error came up while a 3D place is mounted. Returns true when the net took it (the caller must NOT pass it on), false when no
 * place is mounted (the caller does what it always did).
 */
export function reportPlaceError(source: string, e: unknown): boolean {
  if (!netArmed() || reporting) return false;
  reporting = true;
  try {
    const open = Array.from(places.values());
    const name = open.length ? open.map((p) => p.name).join(" + ") : "(a 3D place that was just let go)";
    const lastEvent = open.map((p) => p.lastEvent).filter(Boolean).pop() ?? null;
    const message = messageOf(e);
    console.warn(`[3D net] ${source} in ${name}:`, e);
    if (open.length) {
      // 1. on the phone's storage at once (a step too, so the trail shows it)
      const steps = open.flatMap((p) => currentTrail(p.name)).slice(-5).map((x) => `${new Date(x.at).toISOString().slice(11, 19)} ${x.step}`);
      recordLastError({ place: name, source, message: message.slice(0, 300), stack: stackLines(e), lastEvent, at: Date.now(), steps });
      for (const p of open) markStep(p.name, `ERROR (${source}): ${message.slice(0, 80)}`);
      // 3. so it does not start again: the switch off (and the match's 3D view for the match)
      try { setPref("live3dScenes", false); markLive3dOffByCrash(`a 3D error in ${name}`); } catch { /* the switch stays as it was */ }
      if (open.some((p) => MATCH_PLACE.test(p.name))) { try { setPref("matchView3d", false); } catch { /* as it was */ } }
      // fail each place over to its plain version, once
      for (const p of open) {
        places.delete(p.id); // no longer a 3D place: the next error is the previous handler's again (after the short grace)
        try { p.failOver(`${source}: ${message.slice(0, 120)}`); } catch (err) { console.warn("[3D net] fail-over", err); }
      }
      graceUntil = Date.now() + GRACE_MS;
    }
    return true;
  } catch (err) {
    console.warn("[3D net] could not take the error:", err);
    return false;
  } finally {
    reporting = false;
  }
}

/** A 3D place is on screen. `failOver(why)` must show its plain version. */
export function registerPlace(name: string, failOver: (why: string) => void): PlaceNet {
  ensureInstalled();
  const id = ++seq;
  const entry: Entry = { id, name, failOver, lastEvent: null };
  places.set(id, entry);
  const net: PlaceNet = {
    event(text) { entry.lastEvent = text; markStep(name, text); },
    unregister() { places.delete(id); },
    onFrameError(e) { return reportPlaceError("a frame threw", e); },
    wrapCallbacks<CB>(cb: CB, dead: () => boolean): CB {
      const c = cb as unknown as Record<string, unknown> | null;
      if (!c || typeof c !== "object" || typeof c.onEvent !== "function") return cb;
      const onEvent = c.onEvent as (...a: unknown[]) => unknown;
      return {
        ...c,
        onEvent: (...a: unknown[]) => {
          net.event(`event ${a.map((x) => String(x)).join(",")}`);
          // out of the frame that fired it: React work (a render, a spring) must not run inside the GL frame
          setTimeout(() => {
            if (dead()) return;
            try { onEvent(...a); } catch (e) { if (!reportPlaceError("an event callback threw", e)) throw e; }
          }, 0);
        },
      } as unknown as CB;
    },
  };
  return net;
}

// ── the global handler ──────────────────────────────────────────────────────

type Handler = ((e: unknown, isFatal?: boolean) => void) & { __kibNet?: boolean };
interface EU { getGlobalHandler?: () => Handler | undefined; setGlobalHandler?: (h: Handler) => void }
let rejectionsHooked = false;

/** Put the net in front of whatever global handler is there now (Boot's), once. Called by registerPlace; safe to call again. */
export function ensureInstalled() {
  try {
    const eu = (globalThis as unknown as { ErrorUtils?: EU }).ErrorUtils;
    if (eu?.getGlobalHandler && eu.setGlobalHandler) {
      const prev = eu.getGlobalHandler();
      if (!(prev && prev.__kibNet)) {
        const net: Handler = (error, isFatal) => {
          let took = false;
          try { took = reportPlaceError(isFatal ? "an uncaught error" : "an error", error); } catch { took = false; }
          if (!took) prev?.(error, isFatal);
        };
        net.__kibNet = true;
        eu.setGlobalHandler(net);
      }
    }
  } catch { /* the net must never stop the app */ }
  // Unhandled promise rejections: Hermes can tell us (it does not close the app by itself; with a place open they are treated alike).
  try {
    const h = (globalThis as unknown as { HermesInternal?: { enablePromiseRejectionTracker?: (o: object) => void } }).HermesInternal;
    if (!rejectionsHooked && typeof h?.enablePromiseRejectionTracker === "function") {
      rejectionsHooked = true;
      h.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, rejection: unknown) => {
          if (!reportPlaceError("an unhandled promise", rejection)) console.warn("Possible Unhandled Promise Rejection:", rejection);
        },
        onHandled: () => { /* a handler arrived late: nothing to undo */ },
      });
    }
  } catch { /* no tracker here */ }
}

// ── the GL after the place is gone ──────────────────────────────────────────

/**
 * Every call on the GL context becomes a no-op (the view is gone: a late timer, frame or dispose of the scene must not reach
 * expo-gl's native side). `isContextLost` says yes and `getError` says none, as a lost context does.
 */
export function neutralizeGl(gl: unknown) {
  try {
    const g = gl as Record<string, unknown> & { __kibDead?: boolean };
    if (!g || g.__kibDead) return;
    g.__kibDead = true;
    const names = new Set<string>(Object.keys(g));
    for (const k in g) names.add(k);
    for (const k of names) {
      if (k === "__kibDead" || k === "__kib") continue;
      let v: unknown;
      try { v = g[k]; } catch { continue; }
      if (typeof v !== "function") continue;
      try { g[k] = k === "isContextLost" ? () => true : k === "getError" ? () => 0 : () => undefined; } catch { /* a read-only member stays as it is */ }
    }
  } catch { /* nothing to neutralise */ }
}

