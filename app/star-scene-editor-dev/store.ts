/**
 * The 3D Scene Editor's saves. Per script: each shot's edits (keyed by camera
 * track index), each shot's free camera, and the scene-wide light/mood.
 * This device: localStorage (every read/write in try/catch). Shared: the
 * star_cutscene_edits table via /api/star/cutscene-edits (admin write; until
 * the migration runs the route says migrationMissing and edits stay local).
 *
 * Every save may carry an `approval` (lib/star/sceneEdits/approval.ts): an
 * APPROVED edit is used by the real game where and when it says (read through
 * lib/star/sceneEdits/useApproved.ts); an unapproved one only shows here.
 *
 * Script ids: a director scene saves under its fixture id ("goal", "trophy" …),
 * except "Contract signing", which saves under "director:signing" — the 3D
 * Signing place owns "signing" (and the Manager's Office "office", the 3D
 * Shop "shop", the Garden "garden", the House "house"). A place's saves carry
 * `place`, so an older director save under "signing" (no `place`) is still
 * read back by "Contract signing".
 */
import type { DirectorEdit } from "@/lib/star/cutscene/director";
import type { SigningSceneEdit } from "@/lib/star/signing3dScene";
import type { MoodId, Vec3 } from "@/lib/star/cutscene/types";
import type { SceneApproval } from "@/lib/star/sceneEdits/approval";
import type { ViewEdit } from "@/lib/star/sceneEdits/walkEdit";

export interface SavedEdits {
  shots?: NonNullable<DirectorEdit["shots"]>;
  free?: Record<number, { pos: Vec3; look: Vec3 }>;
  scene?: { mood?: MoodId; exposure?: number; keyLight?: number; keyAngle?: number; keyColor?: string; spot?: { actor: string; intensity: number } | null };
  approval?: SceneApproval;
}

/** A 3D place's saves (Signing, Office): per fixed shot camera + lens, the key light, the exposure. */
export interface PlaceSaved {
  place: "signing" | "office";
  shots?: NonNullable<SigningSceneEdit["shots"]>;
  scene?: { exposure?: number; keyLight?: number; keyAngle?: number; keyColor?: string };
  approval?: SceneApproval;
}
export const emptyPlace = (place: PlaceSaved["place"]): PlaceSaved => ({ place, shots: {}, scene: {} });

/** A walk-around place's saves (Shop, Garden, House): per view turn / rise / distance / lens, the key light, the exposure. */
export interface WalkSaved {
  place: "shop" | "garden" | "house";
  views?: Record<string, ViewEdit>;
  scene?: { exposure?: number; keyLight?: number; keyAngle?: number; keyColor?: string };
  approval?: SceneApproval;
}
export const emptyWalk = (place: WalkSaved["place"]): WalkSaved => ({ place, views: {}, scene: {} });

/** The save id of a director scene (see the note above). */
export const directorId = (fixture: string) => (fixture === "signing" ? "director:signing" : fixture);
const isPlace = (v: unknown) => !!v && typeof v === "object" && "place" in (v as object);
/** A director scene's saves on this device (falling back to an older save under the bare id). */
export function loadDirectorLocal(fixture: string): SavedEdits | null {
  const id = directorId(fixture);
  const v = loadLocal(id);
  if (v || id === fixture) return v;
  const old = loadLocal(fixture);
  return old && !isPlace(old) ? old : null;
}
/** A director scene's shared copy (same fallback). */
export function sharedDirector(edits: Record<string, unknown>, fixture: string): SavedEdits | undefined {
  const id = directorId(fixture);
  const v = edits[id] ?? (id !== fixture && !isPlace(edits[fixture]) ? edits[fixture] : undefined);
  return v as SavedEdits | undefined;
}
export function loadPlaceLocal<P extends PlaceSaved | WalkSaved>(place: P["place"]): P | null {
  const v = loadLocal(place) as unknown;
  return isPlace(v) ? (v as P) : null;
}
export function sharedPlace<P extends PlaceSaved | WalkSaved>(edits: Record<string, unknown>, place: P["place"]): P | undefined {
  const v = edits[place];
  return isPlace(v) ? (v as P) : undefined;
}

const KEY = (id: string) => `star-scene-editor:${id}`;
export const emptySaved = (): SavedEdits => ({ shots: {}, free: {}, scene: {} });

export function loadLocal(id: string): SavedEdits | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as SavedEdits) : null;
  } catch { return null; }
}

export function saveLocal(id: string, e: SavedEdits | PlaceSaved | WalkSaved | Record<string, unknown>): boolean {
  try { localStorage.setItem(KEY(id), JSON.stringify(e)); return true; } catch { return false; }
}

export async function fetchShared(): Promise<{ missing: boolean; edits: Record<string, unknown> }> {
  try {
    const r = await fetch("/api/star/cutscene-edits", { cache: "no-store" });
    const j = await r.json();
    return { missing: !!j.migrationMissing, edits: (j.edits ?? {}) as Record<string, unknown> };
  } catch { return { missing: false, edits: {} }; }
}

export async function pushShared(id: string, e: SavedEdits | PlaceSaved | WalkSaved | Record<string, unknown>): Promise<{ ok: boolean; missing?: boolean; error?: string }> {
  try {
    const r = await fetch("/api/star/cutscene-edits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scriptId: id, edits: e }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true };
    return { ok: false, missing: !!j.migrationMissing, error: j.error ?? `error ${r.status}` };
  } catch { return { ok: false, error: "no connection" }; }
}

/** Commit to game: write approved edits into lib/star/data/sceneEdits.json on main (needs GITHUB_TOKEN). */
export async function commitToGame(rows: { scriptId: string; edits: unknown }[]): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch("/api/star/cutscene-edits/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, message: j.message ?? "Committed." } : { ok: false, message: j.error ?? `Commit failed (${r.status}). Nothing was committed.` };
  } catch { return { ok: false, message: "No connection. Nothing was committed." }; }
}
