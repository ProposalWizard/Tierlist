/**
 * THE LOADING SCREENS: which one shows (Harry, 27 Nov 2026).
 *
 * "Loading screens must MATCH THE SECTION YOU'RE GOING INTO, with several
 * options per section so it doesn't get old." Each section has its own list;
 * the one shown is picked at random from the list, never the same one twice
 * in a row (remembered per device, per section). Pure: the screen reads and
 * writes the memory (components/star/loading/LoadingCurtain.tsx).
 *
 *   match       the matchday programme (three covers), or the walk-out
 *               cut scene's look (no input)
 *   garden / house / shop / casino
 *               keepie-uppies over a real still of the place (several lights).
 *               The gym (test page only, its own builder's files) has no
 *               section yet: its room has no good portrait still.
 *   training    the coach's drill board (three boards)
 *   ballon-dor / awards
 *               the gala: the golden ball, the invitation
 *   first-load  the whole game's opening (built on the server, no JS needed:
 *               components/star/loading/BootScreen.tsx)
 *
 * Random quiz questions were dropped ("not sure that's gonna work").
 */

export type LoadSection =
  | "first-load" | "match"
  | "garden" | "house" | "shop" | "casino"
  | "training" | "ballon-dor" | "awards";

/** What a variant is drawn as. */
export type LoadKind = "keepie" | "programme" | "tunnel" | "board" | "gala" | "boot";

export interface LoadVariant {
  id: string;
  kind: LoadKind;
  /** keepie: the backdrop still (public/star/loading/<still>.webp) and its weather. */
  still?: string;
  weather?: "clear" | "rain" | "night" | "lamp" | "neon";
  /** programme: the cover. board: the board. gala: the set. boot: the opening. */
  look?: string;
}

const K = (id: string, still: string, weather: LoadVariant["weather"] = "clear"): LoadVariant => ({ id, kind: "keepie", still, weather });

export const LOAD_VARIANTS: Record<LoadSection, LoadVariant[]> = {
  "first-load": [
    { id: "boot-floodlights", kind: "boot", look: "floodlights" },
    { id: "boot-golden", kind: "boot", look: "golden" },
    { id: "boot-sunset", kind: "boot", look: "sunset" },
  ],
  match: [
    { id: "programme-classic", kind: "programme", look: "classic" },
    { id: "programme-photo", kind: "programme", look: "photo" },
    { id: "programme-retro", kind: "programme", look: "retro" },
    { id: "tunnel", kind: "tunnel" },
  ],
  garden: [
    K("keepie-garden-day", "garden-day"),
    K("keepie-garden-sunset", "garden-sunset"),
    K("keepie-garden-night", "garden-night", "night"),
    K("keepie-garden-rain", "garden-day", "rain"),
  ],
  house: [
    K("keepie-house", "house"),
    K("keepie-house-lamp", "house", "lamp"),
  ],
  shop: [
    K("keepie-shop", "shop"),
    K("keepie-shop-neon", "shop", "neon"),
  ],
  casino: [
    K("keepie-casino", "casino"),
    K("keepie-casino-neon", "casino", "neon"),
  ],
  training: [
    { id: "board-white", kind: "board", look: "white" },
    { id: "board-chalk", kind: "board", look: "chalk" },
    { id: "board-pitch", kind: "board", look: "pitch" },
  ],
  "ballon-dor": [
    { id: "gala-ball", kind: "gala", look: "ball" },
    { id: "gala-invite", kind: "gala", look: "invite" },
  ],
  // the red carpet (Gala.tsx look "carpet") is out of the rotation: too flat next to the others (27 Nov stills)
  awards: [
    { id: "gala-invite", kind: "gala", look: "invite" },
    { id: "gala-ball", kind: "gala", look: "ball" },
  ],
};

/**
 * One of the section's screens: random (`rnd` in 0..1), never `last` when
 * there is another to show. `only` narrows the list (a reduced choice, e.g.
 * no tunnel stills on a device that can't show them); an empty result falls
 * back to the whole list.
 */
export function pickVariant(section: LoadSection, last: string | null | undefined, rnd: number, only?: (v: LoadVariant) => boolean): LoadVariant {
  const all = LOAD_VARIANTS[section];
  const allowed = only ? all.filter(only) : all;
  const pool0 = allowed.length ? allowed : all;
  const pool = pool0.length > 1 ? pool0.filter((v) => v.id !== last) : pool0;
  const r = Math.min(0.999999, Math.max(0, Number.isFinite(rnd) ? rnd : 0));
  return pool[Math.floor(r * pool.length)];
}

/** The per-device memory of the last screen per section (localStorage, JSON). */
export const LOAD_MEMORY_KEY = "kib-loading-last";

export function readLast(raw: string | null, section: LoadSection): string | null {
  try {
    const m = raw ? JSON.parse(raw) : null;
    const v = m && typeof m === "object" ? (m as Record<string, unknown>)[section] : null;
    return typeof v === "string" ? v : null;
  } catch { return null; }
}

export function writeLast(raw: string | null, section: LoadSection, id: string): string {
  let m: Record<string, string> = {};
  try { const p = raw ? JSON.parse(raw) : null; if (p && typeof p === "object" && !Array.isArray(p)) m = p as Record<string, string>; } catch { /* start again */ }
  m[section] = id;
  return JSON.stringify(m);
}

/**
 * Real progress, shown quietly (a small ring), from the files three.js was
 * asked for since the screen opened: `done` of `asked`, against what this
 * place asked for last time (`expected`, remembered per device) so the ring
 * does not jump back as new files are found. Never 1 until the place says it
 * is ready; never goes backwards (`prev`). null = nothing to show yet.
 */
export function progressOf(done: number, asked: number, expected: number, prev: number | null): number | null {
  const total = Math.max(asked, expected);
  if (total <= 0) return prev;
  const p = Math.min(0.95, done / total);
  return Math.max(prev ?? 0, p);
}
