/**
 * ANIMATION DIALS — how big each New animation is, and which ones are on.
 *
 * Leo, 6 Oct 2026: "make the strikes bigger ... (not the actual shot but just
 * the visuals of course, we dont wanna be changing actual gameplay). also
 * again make this all toggleable and testing area and editable and viewable
 * and everything so that if its not good we can alter and change and
 * potentially just remove it all."
 *
 * One phone at a time (this browser only). The real match and the test page
 * (/star-animations-dev) both read the same values, every frame, through
 * `animSettings()` — a module-level value, never a prop, so the one-engine
 * guard has nothing new to compare.
 *
 * Looks only. Nothing here is read by the ball, the keeper's save maths, the
 * outcome or any timing — only by lib/star/actionAnim.ts, which only makes
 * limb numbers for the drawing.
 *
 * The master switch stays Settings → Look → Animations: New | Old
 * (animLook.ts). Old is the old game whatever these say.
 */
import { useSyncExternalStore } from "react";

/** The families that can each be switched off on their own. Off = that one
 *  falls back to the Old look while the rest stay New. */
export type AnimFamily =
  | "keeperSaves" | "keeperCatch" | "touch" | "shots" | "passes" | "headers" | "blocks" | "flashes";

export const ANIM_FAMILIES: { id: AnimFamily; label: string; note: string }[] = [
  { id: "keeperSaves", label: "Keeper saves", note: "One glove at full stretch, a palm away, getting back up." },
  { id: "keeperCatch", label: "Keeper catch / fumble", note: "Holding it to his chest; spilling it." },
  { id: "touch", label: "Touch / trap", note: "A team-mate taking a pass down: foot, thigh, chest." },
  { id: "shots", label: "Shots", note: "A team-mate's driven shot, curl, volley, chip. Off: your own leg swings on his shot, as it used to." },
  { id: "passes", label: "Passes", note: "A team-mate's side-foot pass." },
  { id: "headers", label: "Headers", note: "The jump to head it: shots, passes and headed clearances." },
  { id: "blocks", label: "Blocks / clearances", note: "A defender's leg across the ball; his big hoof clear." },
  { id: "flashes", label: "Contact flashes", note: "The small flash and dust puff where boot or glove meets the ball." },
];

export interface AnimDials {
  /** Master: 1 = as designed, 0 = every New animation flattened to standing still, 2 = double. */
  exaggeration: number;
  /** A shot's leg: how far out, up and across the boot goes (× the first version's reach). */
  strikeSwing: number;
  /** Radians the body leans away from the kicking leg as he strikes. */
  strikeLean: number;
  /** 0-1: the standing leg set wider and its knee bent. */
  plantBend: number;
  /** 0-1: the other arm thrown out and up for balance. */
  armBalance: number;
  /** Size of the flash (and dust puff) at the boot. 0 = none. */
  contactFlash: number;
  /** A pass's leg swing (× the first version). */
  passSwing: number;
  /** How big a trap / thigh / chest cushion is (× the first version). */
  touchCushion: number;
  /** Header jump height and arm throw (× the first version). */
  headerJump: number;
  /** A block: leg out and body lean (× the first version). */
  blockReach: number;
  /** A clearance's hoof (× the first version). */
  clearanceSwing: number;
  /** Radians: how far over a one-handed top-corner stretch leans. */
  oneHandLean: number;
  /** 0-1: how far in he brings a caught ball. */
  catchHold: number;
  /** A low parry's palm up and away (× the first version). */
  parry: number;
  /** A fumble: how far the hands fly apart and drop (× the first version). */
  fumbleSpill: number;
  /** Size of the keeper's glove flash (× the first version). */
  keeperFlash: number;
}

export interface AnimSettings {
  dials: AnimDials;
  on: Record<AnimFamily, boolean>;
}

/** The first New version (6 Oct 2026, before "make the strikes bigger").
 *  Setting every dial to these draws exactly what that version drew. */
export const FIRST_VERSION_DIALS: AnimDials = {
  exaggeration: 1,
  strikeSwing: 1, strikeLean: 0, plantBend: 0, armBalance: 0, contactFlash: 0,
  passSwing: 1, touchCushion: 1, headerJump: 1, blockReach: 1, clearanceSwing: 1,
  oneHandLean: 1.15, catchHold: 1, parry: 1, fumbleSpill: 1, keeperFlash: 1,
};

/** The bigger look (the defaults). */
export const DEFAULT_ANIM_DIALS: AnimDials = {
  exaggeration: 1,
  strikeSwing: 1.8, strikeLean: 0.24, plantBend: 1, armBalance: 1, contactFlash: 1,
  passSwing: 1.5, touchCushion: 1.25, headerJump: 1.2, blockReach: 1.25, clearanceSwing: 1.6,
  oneHandLean: 1.15, catchHold: 1, parry: 1, fumbleSpill: 1, keeperFlash: 1,
};

export const ALL_FAMILIES_ON: Record<AnimFamily, boolean> = {
  keeperSaves: true, keeperCatch: true, touch: true, shots: true, passes: true, headers: true, blocks: true, flashes: true,
};

export const DEFAULT_ANIM_SETTINGS: AnimSettings = { dials: DEFAULT_ANIM_DIALS, on: ALL_FAMILIES_ON };

/** [min, max, step], the slider label, and what it moves. */
export const DIAL_INFO: Record<keyof AnimDials, { min: number; max: number; step: number; label: string; group: string }> = {
  exaggeration: { min: 0, max: 2, step: 0.05, label: "Exaggeration (all)", group: "Master" },
  strikeSwing: { min: 0.5, max: 2.5, step: 0.05, label: "Strike swing size", group: "Shots" },
  strikeLean: { min: 0, max: 0.6, step: 0.02, label: "Strike lean", group: "Shots" },
  plantBend: { min: 0, max: 1.5, step: 0.05, label: "Plant-leg bend", group: "Shots" },
  armBalance: { min: 0, max: 1.5, step: 0.05, label: "Balancing arm", group: "Shots" },
  contactFlash: { min: 0, max: 2, step: 0.05, label: "Contact flash size", group: "Shots" },
  passSwing: { min: 0.5, max: 2.5, step: 0.05, label: "Pass swing", group: "Team-mates" },
  touchCushion: { min: 0.5, max: 2, step: 0.05, label: "Touch / trap cushion", group: "Team-mates" },
  headerJump: { min: 0.5, max: 2, step: 0.05, label: "Header jump", group: "Team-mates" },
  blockReach: { min: 0.5, max: 2, step: 0.05, label: "Block reach", group: "Defenders" },
  clearanceSwing: { min: 0.5, max: 2.5, step: 0.05, label: "Clearance swing", group: "Defenders" },
  oneHandLean: { min: 0.6, max: 1.6, step: 0.05, label: "Keeper one-hand lean", group: "Keeper" },
  catchHold: { min: 0, max: 1, step: 0.05, label: "Keeper catch-hold", group: "Keeper" },
  parry: { min: 0, max: 3, step: 0.1, label: "Keeper parry", group: "Keeper" },
  fumbleSpill: { min: 0, max: 2, step: 0.05, label: "Keeper fumble spill", group: "Keeper" },
  keeperFlash: { min: 0, max: 2, step: 0.05, label: "Keeper flash size", group: "Keeper" },
};

export const DIAL_KEYS = Object.keys(DIAL_INFO) as (keyof AnimDials)[];

const KEY = "star-anim-dials";

/** Any stored value made safe: numbers clamped to their range, anything
 *  missing or broken back to its default. */
export function sanitizeAnimSettings(raw: unknown): AnimSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as { dials?: Record<string, unknown>; on?: Record<string, unknown> };
  const d = r.dials && typeof r.dials === "object" ? r.dials : {};
  const o = r.on && typeof r.on === "object" ? r.on : {};
  const dials = { ...DEFAULT_ANIM_DIALS };
  for (const k of DIAL_KEYS) {
    const v = d[k];
    if (typeof v === "number" && Number.isFinite(v)) dials[k] = Math.max(DIAL_INFO[k].min, Math.min(DIAL_INFO[k].max, v));
  }
  const on = { ...ALL_FAMILIES_ON };
  for (const f of ANIM_FAMILIES) if (typeof o[f.id] === "boolean") on[f.id] = o[f.id] as boolean;
  return { dials, on };
}

let cached: AnimSettings | undefined;
const listeners = new Set<() => void>();

function readStored(): AnimSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_ANIM_SETTINGS;
    const v = localStorage.getItem(KEY);
    return v ? sanitizeAnimSettings(JSON.parse(v)) : DEFAULT_ANIM_SETTINGS;
  } catch {
    return DEFAULT_ANIM_SETTINGS;
  }
}

/** Read every frame by the match: cheap (cached). */
export function animSettings(): AnimSettings {
  if (cached === undefined) cached = readStored();
  return cached;
}

/** Is this family drawn New? (Only asked when the master switch is New.) */
export function animFamilyOn(f: AnimFamily): boolean {
  return animSettings().on[f];
}

export function setAnimSettings(next: AnimSettings): AnimSettings {
  const clean = sanitizeAnimSettings(next);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* the in-memory value still changes */ }
  cached = clean;
  listeners.forEach((f) => f());
  return clean;
}

export function setAnimDial(k: keyof AnimDials, v: number): AnimSettings {
  const s = animSettings();
  return setAnimSettings({ ...s, dials: { ...s.dials, [k]: v } });
}

export function setAnimFamily(f: AnimFamily, on: boolean): AnimSettings {
  const s = animSettings();
  return setAnimSettings({ ...s, on: { ...s.on, [f]: on } });
}

export function resetAnimSettings(): AnimSettings {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  cached = DEFAULT_ANIM_SETTINGS;
  listeners.forEach((f) => f());
  return cached;
}

/** For tests: forget the cached value so the next read goes to storage. */
export function _forgetAnimSettings(): void { cached = undefined; }

/** The settings as text to paste to someone ("Copy settings"). */
export function exportAnimSettings(s: AnimSettings = animSettings()): string {
  return JSON.stringify(s);
}

/** Paste them back. Returns null if the text is not settings at all. */
export function importAnimSettings(text: string): AnimSettings | null {
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || !("dials" in v)) return null;
    return setAnimSettings(sanitizeAnimSettings(v));
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { cached = undefined; listeners.forEach((f) => f()); }
  });
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export const useAnimSettings = () => useSyncExternalStore(subscribe, animSettings, () => DEFAULT_ANIM_SETTINGS);
