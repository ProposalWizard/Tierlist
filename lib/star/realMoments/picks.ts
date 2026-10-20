/**
 * WHICH REAL MOMENTS THE GAME MAY SERVE — the allow / deny list (Harry, 20 Oct
 * 2026: "How do we keep track of it, and how do we edit it in the future?").
 *
 * Every real moment has a stable id (dfl…, sc…, st…). By default the game may
 * serve every FULLY REAL open-play shot that passes the automatic checks
 * (lib/star/fhr/realMomentHighlights.ts `autoCheck`). A pick overrides that:
 *
 *   "use"  — let this one in, even if a check left it out (it must still be a
 *            fully real shot of a kind the game serves);
 *   "dont" — keep this one out of the game.
 *
 * Picks sit in layers, newest first:
 *   1. this device's picks not yet saved for everyone (the Real moments page)
 *   2. the shared star_real_moments_picks table (/api/star/real-moment-picks)
 *   3. the committed file data/realmoments/picks.json (the page's Commit)
 * The game reads all three (pickStore.ts loads 1 and 2).
 *
 * Pure. tests/star/realMomentHighlights.mts checks it.
 */
import PICKS_JSON from "../../../data/realmoments/picks.json";

export type PickValue = "use" | "dont";
export type PickState = PickValue | "auto";

export const PICK_WORDS: Record<PickState, string> = {
  auto: "Automatic (in if it passes the checks)",
  use: "Use in game",
  dont: "Don't use",
};

/** A moment id as the data files make them: letters, digits, _ and -. */
export const isMomentId = (id: unknown): id is string => typeof id === "string" && /^[a-z]{2,4}[A-Za-z0-9_-]{1,60}$/.test(id);

export interface PicksFile { what?: string; picks: Record<string, PickValue> }

/** Only valid ids and values survive. */
export function cleanPicks(raw: unknown): Record<string, PickValue> {
  const out: Record<string, PickValue> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isMomentId(id) && (v === "use" || v === "dont")) out[id] = v;
  }
  return out;
}

const COMMITTED = cleanPicks((PICKS_JSON as unknown as PicksFile).picks);

/** The committed file's picks. */
export const committedPicks = (): Record<string, PickValue> => COMMITTED;

/**
 * The saved layer (table + this device), set by pickStore.ts. null = "auto"
 * there (a cleared pick). On globalThis: tsx can load this file twice (the
 * tests' copy and the game's), and both must read the same marks.
 */
const LAYER_KEY = "__starRealMomentPicks";
const G = globalThis as Record<string, unknown>;
export function setPicksOverlay(next: Record<string, PickValue | null>) { G[LAYER_KEY] = { ...next }; }
export function picksOverlay(): Record<string, PickValue | null> { return (G[LAYER_KEY] as Record<string, PickValue | null> | undefined) ?? {}; }

/** Where a moment stands: the saved layer, then the committed file, else automatic. */
export function pickOf(id: string, layer: Record<string, PickValue | null> = picksOverlay()): PickState {
  if (id in layer) return layer[id] ?? "auto";
  return COMMITTED[id] ?? "auto";
}

/** Is the moment in the game? `passes`: it passes the automatic checks. */
export function inGame(id: string, passes: boolean, layer?: Record<string, PickValue | null>): boolean {
  const p = pickOf(id, layer);
  return p === "use" || (p === "auto" && passes);
}

export interface PickEdit { id: string; value: PickState }

/**
 * The committed file with these picks written in ("auto" removes a line).
 * Keeps the file's own `what`; ids sorted so a diff shows only what changed.
 */
export function mergePicksFile(text: string, edits: PickEdit[]): { text: string; ids: string[] } {
  let file: PicksFile;
  try { file = JSON.parse(text) as PicksFile; } catch { file = { picks: {} }; }
  const picks = cleanPicks(file.picks);
  const ids: string[] = [];
  for (const e of edits) {
    if (!isMomentId(e.id)) continue;
    if (e.value === "auto") delete picks[e.id];
    else if (e.value === "use" || e.value === "dont") picks[e.id] = e.value;
    else continue;
    ids.push(e.id);
  }
  const sorted = Object.fromEntries(Object.keys(picks).sort().map((k) => [k, picks[k]]));
  const out: PicksFile = { what: file.what ?? (PICKS_JSON as unknown as PicksFile).what, picks: sorted };
  return { text: `${JSON.stringify(out, null, 2)}\n`, ids };
}
