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
const AUTO_VERSION = 3; // 3: phone GPUs never "high" (27 Nov 2026); a saved v2 hint is read again

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
  /** Frames a second while nothing but idle sway moves (20 on every tier since 9 Oct 2026: a still screen needs no more). */
  stillFps: 20 | 30 | 60;
  /** The thin dark outline round each person (one more skinned draw each). */
  outlines: boolean;
  anisotropy: number;
  /** Skinned characters drawn live; the rest become impostor cards. */
  maxLiveCharacters: number;
}

/**
 * 9 Oct 2026 (Harry's iPhone screenshots: "every edge is jagged and
 * pixel-stepped"): Medium (every iPhone's Auto) drew 1.25 pixels per point
 * standing still and 1 (as low as 0.7) moving, with no antialias, on a 3×
 * screen. Every tier now keeps edges smooth — antialias on, never under 1.25
 * pixels on Medium and High — and wins the time back elsewhere: Medium drops
 * the outline (one more skinned draw per person), the stadium is merged into
 * a few draws, and dynamic resolution only trims down to a floor that still
 * looks smooth.
 */
export const TIER_PROFILES: Record<Quality3d, TierProfile> = {
  low: { tier: "low", maxPixelRatio: 1.25, movePixelRatio: 1.25, minPixelRatio: 1, antialias: true, shadows: false, shadowScale: 0, shadowMapSize: 0, fpsCap: 30, stillFps: 20, outlines: false, anisotropy: 1, maxLiveCharacters: 2 },
  medium: { tier: "medium", maxPixelRatio: 1.5, movePixelRatio: 1.5, minPixelRatio: 1.25, antialias: true, shadows: true, shadowScale: 0.5, shadowMapSize: 1024, fpsCap: 60, stillFps: 20, outlines: false, anisotropy: 2, maxLiveCharacters: 4 },
  high: { tier: "high", maxPixelRatio: 2, movePixelRatio: 1.5, minPixelRatio: 1.25, antialias: true, shadows: true, shadowScale: 1, shadowMapSize: 2048, fpsCap: 60, stillFps: 20, outlines: true, anisotropy: 4, maxLiveCharacters: 8 },
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
 *   - Android → Medium; Low with ≤3 GB or ≤4 cores. Never High on a phone
 *     (9 Oct 2026); the governor (three3d/governor.ts) drops further on a
 *     phone that still struggles.
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
    // Phones open on Medium, flagship or not (Harry, 9 Oct 2026: the 3D "struggling
    // on phone"); the governor (three3d/governor.ts) drops it further if it struggles.
    else t = "medium";
  } else {
    t = (mem !== undefined && mem <= 4) || (cores !== undefined && cores <= 2) ? "medium" : "high";
  }
  if (d.gpuHint === "low") t = "low";
  else if (d.gpuHint === "medium" && t === "high") t = "medium";
  return t;
}

/**
 * What the GPU's name alone says (reasoned from the public GPU tables): old Mali/Adreno/PowerVR and
 * software renderers are low; desktop GPUs are high; Apple reports only "Apple GPU" (null).
 *
 * 27 Nov 2026 (Mikey's Galaxy S20: "loads of lag in the garden"): phone GPUs are never "high" here any
 * more. The S20's Mali-G77 (Exynos 990, Europe) and Adreno 650 (Snapdragon 865, US) were read as "high",
 * the same as a desktop card; they are 2020 phone GPUs that throttle when warm. Every Android GPU now
 * says at most "medium"; the oldest say "low". See gpuClass for the pixel caps that go with them.
 */
export function tierHintFromGpu(name: string): Quality3d | null {
  const n = name.toLowerCase();
  if (!n) return null;
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(n)) return "low";
  if (/mali-(4|t)|mali-g(3\d|5[0-7])\b|adreno \(tm\) [2-5]\d\d\b|adreno [2-5]\d\d\b|adreno \(tm\) 6[0-1]\d|adreno 6[0-1]\d|powervr|sgx|videocore|intel\(r\) hd graphics [2-5]/.test(n)) return "low";
  if (/mali|adreno|immortalis|xclipse|maleoon/.test(n)) return "medium";
  if (/nvidia|geforce|radeon|rtx|apple m\d/.test(n)) return "high";
  return null;
}

/** Which family of graphics chip this is (the pixel caps and the start tier read it). */
export type GpuClass = "apple" | "android-high" | "android-mid" | "android-low" | "software" | "desktop" | "unknown";

/**
 * The GPU family from its name (WEBGL_debug_renderer_info; "" when the browser hides it).
 *   android-high: Adreno 7xx/8xx, Immortalis, Mali-G710 and newer, Xclipse (2022 on)
 *   android-mid:  Adreno 640-699, Mali-G76/G77/G78 (the Galaxy S20's two chips sit here)
 *   android-low:  older Adreno and Mali, PowerVR
 */
export function gpuClass(name: string): GpuClass {
  const n = (name || "").toLowerCase();
  if (!n) return "unknown";
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(n)) return "software";
  if (/apple/.test(n)) return "apple";
  if (/adreno \(tm\) [78]\d\d|adreno [78]\d\d|immortalis|mali-g(71[0-9]|72[0-9]|6[1-9]\d|[89]\d\d)\b|xclipse/.test(n)) return "android-high";
  if (/adreno \(tm\) 6[4-9]\d|adreno 6[4-9]\d|mali-g(7[6-9]|68)\b/.test(n)) return "android-mid";
  if (/mali|adreno|powervr|sgx|videocore|maleoon/.test(n)) return "android-low";
  if (/nvidia|geforce|radeon|rtx|intel|amd/.test(n)) return "desktop";
  return "unknown";
}

/** What a device may draw: the most pixels per screen point, and how deep the governor's ordinary slow rule may go. */
export interface DeviceCaps {
  /** The most pixels per screen point any 3D place draws at (Infinity: no cap, as before). */
  maxPixelRatio: number;
  /** The fewest the automatic resolution may go to while frames are slow. */
  minPixelRatio: number;
  /** The governor's ordinary slow rule may step this deep (2 = pixels only, as on Apple; 4 = shadows and post too). */
  slowFloor: number;
  /** Is this an Android (or other non-Apple phone) — the automatic resolution scaler runs. */
  scaled: boolean;
}

/** Most pixels per frame a mid phone GPU should colour (about 1.5x a 412-point-wide screen). */
const MID_PIXEL_BUDGET = 900_000;
const HIGH_PIXEL_BUDGET = 1_400_000;

/**
 * The caps for a device. Apple and desktop: exactly as before (no cap; the pixels rule stops at
 * rung 2). Android and other non-Apple phones (27 Nov 2026): at most 1.5 pixels per point (1.75 on
 * the newest chips), fewer still on a big screen, the automatic resolution free to go down to 1,
 * and the slow rule allowed to drop shadows and post too, so a Galaxy S20 does not sit at 25 fps.
 */
export function deviceCaps(d: DeviceInfo & { gpu?: string; cssPixels?: number }): DeviceCaps {
  const kind = deviceKind(d);
  if (kind === "iphone" || kind === "ipad" || kind === "desktop") return { maxPixelRatio: Infinity, minPixelRatio: 1, slowFloor: 2, scaled: false };
  const cls = gpuClass(d.gpu ?? "");
  const css = d.cssPixels && d.cssPixels > 0 ? d.cssPixels : 412 * 915;
  const high = cls === "android-high";
  const budget = high ? HIGH_PIXEL_BUDGET : MID_PIXEL_BUDGET;
  let cap = high ? 1.75 : cls === "android-low" || cls === "software" ? 1.25 : 1.5;
  cap = Math.min(cap, Math.sqrt(budget / css));
  cap = Math.max(1, Math.round(cap * 20) / 20);
  return { maxPixelRatio: cap, minPixelRatio: 1, slowFloor: 4, scaled: true };
}

/** This browser's caps (the GPU name from the last scene that read it). */
export function currentDeviceCaps(): DeviceCaps {
  // ?pxcap=0 on any page: as before 27 Nov 2026 (no cap, no automatic resolution), for a before/after
  try { if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pxcap") === "0") return { maxPixelRatio: Infinity, minPixelRatio: 1, slowFloor: 2, scaled: false }; } catch { /* fine */ }
  const d = currentDeviceInfo();
  const css = typeof window !== "undefined" ? (window.innerWidth || 0) * (window.innerHeight || 0) : 0;
  return deviceCaps({ ...d, gpu: savedGpuName() ?? "", cssPixels: css });
}

function savedGpuName(): string | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(QUALITY3D_AUTO_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return typeof o?.gpu === "string" ? o.gpu : null;
  } catch { return null; }
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
