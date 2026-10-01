/**
 * WHICH UI THE CAREER RUNS IN — "old" or "new". Settings → UI: Old | New.
 *
 * Harry, 1 Oct 2026: "instead of the pitch look we are gna have an old ui and
 * new ui model to switch between with all these changes. so keep the old ui
 * exactly how it is as a backup … old ui is current and new ui is whatever we
 * eventually land on after this review with mikey and the final build too".
 *
 * - "old": the career screens exactly as they were on branch Harry on 1 Oct
 *   2026, frozen in components/star/legacy/ (LegacyStarDevPage.tsx is the old
 *   page). Nothing there gets restyled — it is the backup.
 * - "new": the v0.23 screens (app/star-dev/page.tsx + components/star/), in
 *   the green "pitch" look. The separate Classic | Pitch look switch is gone:
 *   the pitch look IS the New UI's styling for now.
 *
 * Both share the save, every game rule in lib/star, the match (CanvasMatch /
 * EnginePlay) and the trial. Saved per device, like the player look
 * (figureSkin.ts). A new player gets the New UI.
 */
import { useSyncExternalStore } from "react";

export type UiVersion = "old" | "new";

/** THE ONE LINE: the UI everyone gets when nobody has chosen. */
export const UI_VERSION_DEFAULT: UiVersion = "new";
export const UI_VERSION_KEY = "star-ui-version";

let stored: UiVersion | null | undefined;
const listeners = new Set<() => void>();

function readStored(): UiVersion | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(UI_VERSION_KEY);
    return v === "old" || v === "new" ? v : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === UI_VERSION_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function uiVersion(): UiVersion {
  if (stored === undefined) stored = readStored();
  return stored ?? UI_VERSION_DEFAULT;
}

export function setUiVersion(v: UiVersion): void {
  try { localStorage.setItem(UI_VERSION_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The UI, re-rendering when Settings flips it. Null on the server and in the
 *  first client render, so the page never mounts the wrong UI for a moment
 *  (each one loads and saves the career the instant it mounts). */
export function useUiVersionOrNull(): UiVersion | null {
  return useSyncExternalStore(subscribe, uiVersion, () => null);
}

/** The UI, "new" until known. For small pieces inside shared screens (the
 *  match) that draw one way or the other. */
export function useUiVersion(): UiVersion {
  return useSyncExternalStore(subscribe, uiVersion, () => UI_VERSION_DEFAULT);
}

// ── The old look switch, kept as a shim so New UI screens compile unchanged ──
export type UiLook = "classic" | "pitch";
/** New UI is always the pitch look; Old UI never reads this. */
export function useUiLook(): UiLook {
  return useUiVersion() === "new" ? "pitch" : "classic";
}
