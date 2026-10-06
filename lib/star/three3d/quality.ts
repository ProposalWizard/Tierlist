/**
 * 3D QUALITY — Settings → Look → "3D quality: Auto | Low | Medium | High"
 * (Harry, 5 Oct 2026: "the less lag is BIG"). One setting per phone, shared
 * by every 3D scene (the garden, the shop, the signing, the office).
 *
 * The tier is chosen BEFORE a scene makes its renderer (antialias is fixed
 * when the WebGL context is made), so it can't wait for a benchmark:
 *   - Low / Medium / High: the player's own pick.
 *   - Auto (the default): picked from what the browser says about the device
 *     (autoTierFromDevice): iPhone or not, Android or desktop, memory and
 *     cores where the browser tells you, the screen's pixel ratio, and the
 *     GPU's name if a scene on this phone has already read it (saved under
 *     QUALITY3D_AUTO_KEY by noteGpu3d, so it counts from the next visit on).
 *
 * Every scene reads one profile (TIER_PROFILES) for its pixel caps, frame
 * cap, antialias, shadows and outlines. A scene that can't keep up steps
 * DOWN one tier (stepDownTier), never to its own private "low".
 *
 * High is exactly the New look as it was on 5 Oct 2026 (1.5 pixels per
 * screen point standing still, 1 while moving, antialias, full shadows,
 * outlines). Kept free of three.js so the Settings screen can import it.
 */
import { useSyncExternalStore } from "react";

export type Quality3d = "low" | "medium" | "high";
export type Quality3dSetting = "auto" | Quality3d;

export const QUALITY3D_KEY = "star-3d-quality";
/** The GPU's name a scene read on this phone: { v, gpu, hint }. */
export const QUALITY3D_AUTO_KEY = "star-3d-quality-auto";
const VALUES: readonly Quality3dSetting[] = ["auto", "low", "medium", "high"];
const AUTO_VERSION = 2;

// ─────────────────────────────── profiles ───────────────────────────────

export interface TierProfile {
  tier: Quality3d;
  /** Pixels per screen point while the picture is still (the sharpest it gets). */
  maxPixelRatio: number;
  /** Pixels per screen point while walking / the camera moves (the softer frame isn't seen in motion). */
  movePixelRatio: number;
  /** The lowest the moving picture may go when frames are slow (dynamic resolution's floor). */
  minPixelRatio: number;
  /** MSAA. Fixed when the WebGL context is made. */
  antialias: boolean;
  shadows: boolean;
  /** Shadow map size as a share of the scene's own (garden 2048, shop 1024). */
  shadowScale: number;
  /** The shadow map size the garden uses (the biggest scene's), for the table. */
  shadowMapSize: number;
  /** Frames a second while moving. */
  fpsCap: 30 | 60;
  /** Frames a second while nothing but idle sway moves. */
  stillFps: 30 | 60;
  /** The thin dark outline round each person (one more skinned draw each). */
  outlines: boolean;
  anisotropy: number;
  /** Skinned characters drawn live; the rest become impostor cards. */
  maxLiveCharacters: number;
}

export const TIER_PROFILES: Record<Quality3d, TierProfile> = {
  low: { tier: "low", maxPixelRatio: 1, movePixelRatio: 0.85, minPixelRatio: 0.6, antialias: false, shadows: false, shadowScale: 0, shadowMapSize: 0, fpsCap: 30, stillFps: 30, outlines: false, anisotropy: 1, maxLiveCharacters: 2 },
  medium: { tier: "medium", maxPixelRatio: 1.25, movePixelRatio: 1, minPixelRatio: 0.7, antialias: false, shadows: true, shadowScale: 0.5, shadowMapSize: 1024, fpsCap: 60, stillFps: 30, outlines: true, anisotropy: 2, maxLiveCharacters: 4 },
  high: { tier: "high", maxPixelRatio: 1.5, movePixelRatio: 1, minPixelRatio: 0.75, antialias: true, shadows: true, shadowScale: 1, shadowMapSize: 2048, fpsCap: 60, stillFps: 30, outlines: true, anisotropy: 4, maxLiveCharacters: 8 },
};

/** One tier down (null at Low). A scene too slow for three seconds takes this step. */
export function stepDownTier(t: Quality3d): Quality3d | null {
  return t === "high" ? "medium" : t === "medium" ? "low" : null;
}

/** A scene's shadow map size at this tier (0 = no shadows). */
export function shadowSizeFor(prof: TierProfile, base: number): number {
  return prof.shadows ? Math.max(256, Math.round(base * prof.shadowScale)) : 0;
}

/** ?q=low|medium|high on a test page. */
export function parseQuality3d(v: string | null | undefined): Quality3d | null {
  return v === "low" || v === "medium" || v === "high" ? v : v === "med" ? "medium" : null;
}

// ───────────────────────────── the setting ─────────────────────────────

let cached: Quality3dSetting | null = null;
const listeners = new Set<() => void>();

export function quality3dSetting(): Quality3dSetting {
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(QUALITY3D_KEY); } catch { v = null; }
    cached = v && (VALUES as readonly string[]).includes(v) ? (v as Quality3dSetting) : "auto";
  }
  return cached;
}

export function setQuality3dSetting(v: Quality3dSetting) {
  try { localStorage.setItem(QUALITY3D_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === QUALITY3D_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useQuality3dSetting = () => useSyncExternalStore(subscribe, quality3dSetting, () => "auto" as Quality3dSetting);

// ─────────────────────────────── Auto ───────────────────────────────

export interface DeviceInfo {
  /** window.devicePixelRatio */
  dpr: number;
  /** navigator.userAgent */
  ua: string;
  /** navigator.platform (an iPad says "MacIntel") */
  platform?: string;
  /** navigator.maxTouchPoints */
  touchPoints?: number;
  /** navigator.deviceMemory, GB (Chrome only; capped at 8; absent on iPhone) */
  memoryGb?: number;
  /** navigator.hardwareConcurrency */
  cores?: number;
  /** What the GPU's name said last time a scene read it (tierHintFromGpu). */
  gpuHint?: Quality3d | null;
}

export type DeviceKind = "iphone" | "ipad" | "android" | "desktop";

export function deviceKind(d: Pick<DeviceInfo, "ua" | "platform" | "touchPoints">): DeviceKind {
  const ua = d.ua || "";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/iPad/i.test(ua) || (d.platform === "MacIntel" && (d.touchPoints ?? 0) > 1)) return "ipad";
  if (/Android/i.test(ua)) return "android";
  if (/Mobi/i.test(ua)) return "android"; // another phone browser: treat as a mid phone
  return "desktop";
}

/**
 * Auto's pick from the device alone (reasoned from public device tables,
 * not measured here):
 *   - iPhone → Medium. Strong GPUs, but a 3× screen and Safari takes the 3D
 *     away when memory runs short (seen on Harry's phone); Medium has no
 *     MSAA buffers, a half-size shadow map and 1.25 pixels standing still.
 *   - iPad → High (bigger battery and memory).
 *   - Android → Medium; Low with ≤3 GB or ≤4 cores; High only once its GPU
 *     is known to be a flagship one (Adreno 640+, Mali-G77+, Immortalis).
 *   - Desktop → High; Medium with ≤4 GB or ≤2 cores.
 *   - A GPU known to be weak or software-drawn caps it (Low), a mid one caps
 *     it at Medium.
 */
export function autoTierFromDevice(d: DeviceInfo): Quality3d {
  const kind = deviceKind(d);
  const mem = d.memoryGb, cores = d.cores;
  let t: Quality3d;
  if (kind === "iphone") t = "medium";
  else if (kind === "ipad") t = "high";
  else if (kind === "android") {
    if ((mem !== undefined && mem <= 3) || (cores !== undefined && cores <= 4)) t = "low";
    else t = d.gpuHint === "high" && (mem === undefined || mem >= 6) ? "high" : "medium";
  } else {
    t = (mem !== undefined && mem <= 4) || (cores !== undefined && cores <= 2) ? "medium" : "high";
  }
  if (d.gpuHint === "low") t = "low";
  else if (d.gpuHint === "medium" && t === "high") t = "medium";
  return t;
}

/** What the GPU's name alone says (reasoned from the public GPU tables): old Mali/Adreno/PowerVR and software renderers are low; desktop and recent flagship mobile GPUs are high; Apple reports only "Apple GPU" (null). */
export function tierHintFromGpu(name: string): Quality3d | null {
  const n = name.toLowerCase();
  if (!n) return null;
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(n)) return "low";
  if (/mali-(4|t)|adreno \(tm\) [2-5]\d\d\b|adreno [2-5]\d\d\b|powervr|sgx|videocore|intel\(r\) hd graphics [2-5]/.test(n)) return "low";
  if (/mali-g(5[0-9]|7[0-6])\b|adreno \(tm\) 6[0-3]\d|adreno 6[0-3]\d/.test(n)) return "medium";
  if (/nvidia|geforce|radeon|rtx|adreno \(tm\) (6[4-9]\d|7\d\d|8\d\d)|adreno (6[4-9]\d|7\d\d|8\d\d)|mali-g(7[7-9]|[89]\d\d?|6[1-9]\d)|immortalis|apple m\d/.test(n)) return "high";
  return null;
}

function savedGpuHint(): Quality3d | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(QUALITY3D_AUTO_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o?.v === AUTO_VERSION && (o.hint === "low" || o.hint === "medium" || o.hint === "high") ? o.hint : null;
  } catch { return null; }
}

/** Save the GPU's name a scene just read, so Auto can use it from the next visit. */
export function noteGpu3d(gpu: string) {
  if (!gpu) return;
  try { localStorage.setItem(QUALITY3D_AUTO_KEY, JSON.stringify({ v: AUTO_VERSION, gpu, hint: tierHintFromGpu(gpu) })); } catch { /* fine */ }
}

/** This browser's own device info (empty-ish on the server). */
export function currentDeviceInfo(): DeviceInfo {
  if (typeof navigator === "undefined") return { dpr: 1, ua: "" };
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    ua: nav.userAgent || "",
    platform: nav.platform,
    touchPoints: nav.maxTouchPoints,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : undefined,
    gpuHint: savedGpuHint(),
  };
}

/** What Auto picks on this device right now. */
export function autoQuality3d(): Quality3d { return autoTierFromDevice(currentDeviceInfo()); }

/** The tier a 3D scene should open at: the player's pick, else Auto. */
export function quality3dTier(): Quality3d {
  const s = quality3dSetting();
  return s === "auto" ? autoQuality3d() : s;
}
