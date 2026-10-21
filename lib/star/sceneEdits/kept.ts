/**
 * THE SCENE GENERATOR'S MARKS AND KEPT SCENES (Harry, 20 Oct 2026, GEN-1:
 * the Scene generator as an admin page in the Studio tab).
 *
 *  - A RECIPE is what makes a generated scene: the event kind, the feeling,
 *    how big the moment is (stakes), how intense, and the seed. Same recipe =
 *    the same scene (lib/star/cutscene/generate.ts).
 *  - A MARK is Good or Bad on one recipe, so we can see which ones work.
 *  - A KEPT scene is a generated script saved as it is ("Keep as a hand-made
 *    scene"), so later changes to the generator never change it. The 3D Scene
 *    Editor opens kept scenes like the hand-made fixtures.
 *
 * Both live on this device (localStorage) and in the shared table
 * star_cutscene_edits ("mark:<recipe>" and "kept:<id>" rows; never approved,
 * so the game never reads them). No new table.
 */
import type { CutsceneScript, Emotion, EventKind, StoryEvent } from "../cutscene/types";

export interface Recipe { kind: EventKind; emotion: Emotion; stakes: number; intensity: number; seed: number }
export type Mark = "good" | "bad";
export interface MarkRow { mark: Mark; recipe: Recipe; at: string; note?: string }
export interface KeptScene { id: string; name: string; script: CutsceneScript; recipe: Recipe; at: string }

/** One id per recipe ("gen-scored-joy-80-3"): the kept scene's id and the editor's save id. */
export const recipeId = (r: Recipe) => `gen-${r.kind}-${r.emotion}-${Math.round(r.stakes * 100)}-${Math.round(r.intensity * 100)}-${r.seed}`;
export const markRowId = (r: Recipe) => `mark:${recipeId(r)}`;
export const keptRowId = (id: string) => `kept:${id}`;

/** The generator's input for a recipe. */
export const eventOf = (r: Recipe): StoryEvent => ({ kind: r.kind, emotion: r.emotion, stakes: r.stakes, intensity: r.intensity, home: true });

/** A short name for a kept scene: "Scored · joy · big moment · seed 3". */
export function recipeName(r: Recipe): string {
  const size = r.stakes >= 0.75 ? "big moment" : r.stakes >= 0.4 ? "middling" : "small moment";
  const k = r.kind.replace(/-/g, " ");
  return `${k[0].toUpperCase()}${k.slice(1)} · ${r.emotion} · ${size} · seed ${r.seed}`;
}

/** Make a kept scene from a generated script (its id is the recipe's). */
export function keepScene(script: CutsceneScript, r: Recipe, now = new Date()): KeptScene {
  const id = recipeId(r);
  return { id, name: recipeName(r), script: { ...script, id, title: recipeName(r) }, recipe: r, at: now.toISOString() };
}

const isKept = (v: unknown): v is { kept: KeptScene } => {
  const k = (v as { kept?: KeptScene } | null)?.kept;
  return !!k && typeof k.id === "string" && !!k.script && typeof k.script === "object" && Array.isArray(k.script.tracks);
};
const isMark = (v: unknown): v is MarkRow => !!v && ((v as MarkRow).mark === "good" || (v as MarkRow).mark === "bad") && !!(v as MarkRow).recipe;

/** Every kept scene: the shared rows and this device's, one per id (the newer wins), newest first. */
export function keptScenes(shared: Record<string, unknown> | null | undefined, local: KeptScene[] = []): KeptScene[] {
  const by = new Map<string, KeptScene>();
  const add = (k: KeptScene) => { const o = by.get(k.id); if (!o || Date.parse(k.at) > Date.parse(o.at)) by.set(k.id, k); };
  for (const [id, v] of Object.entries(shared ?? {})) if (id.startsWith("kept:") && isKept(v)) add(v.kept);
  for (const k of local) if (k && typeof k.id === "string" && k.script) add(k);
  return Array.from(by.values()).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Every mark: the shared rows and this device's (the newer wins), keyed by recipe id. */
export function allMarks(shared: Record<string, unknown> | null | undefined, local: Record<string, MarkRow> = {}): Record<string, MarkRow> {
  const out: Record<string, MarkRow> = {};
  const add = (id: string, m: MarkRow) => { const o = out[id]; if (!o || Date.parse(m.at) > Date.parse(o.at)) out[id] = m; };
  for (const [id, v] of Object.entries(shared ?? {})) if (id.startsWith("mark:") && isMark(v)) add(id.slice(5), v);
  for (const [id, m] of Object.entries(local)) if (isMark(m)) add(id, m);
  return out;
}

/** Good and bad counts per event kind (the page's tally). */
export function markTally(marks: Record<string, MarkRow>): Record<string, { good: number; bad: number }> {
  const t: Record<string, { good: number; bad: number }> = {};
  for (const m of Object.values(marks)) {
    const k = m.recipe.kind;
    t[k] ??= { good: 0, bad: 0 };
    t[k][m.mark]++;
  }
  return t;
}

// ── This device (every read and write in try/catch) ──
const KEPT_KEY = "star-scene-generator:kept";
const MARK_KEY = "star-scene-generator:marks";

export function loadKeptLocal(): KeptScene[] {
  try { const v = JSON.parse(localStorage.getItem(KEPT_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveKeptLocal(k: KeptScene): boolean {
  try {
    const all = loadKeptLocal().filter((x) => x.id !== k.id);
    localStorage.setItem(KEPT_KEY, JSON.stringify([k, ...all].slice(0, 40)));
    return true;
  } catch { return false; }
}
export function loadMarksLocal(): Record<string, MarkRow> {
  try { const v = JSON.parse(localStorage.getItem(MARK_KEY) ?? "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function saveMarkLocal(r: Recipe, m: MarkRow): boolean {
  try { const all = loadMarksLocal(); all[recipeId(r)] = m; localStorage.setItem(MARK_KEY, JSON.stringify(all)); return true; } catch { return false; }
}
