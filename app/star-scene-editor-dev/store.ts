/**
 * The 3D Scene Editor's saves. Per script: each shot's edits (keyed by camera
 * track index), each shot's free camera, and the scene-wide light/mood.
 * This device: localStorage (every read/write in try/catch). Shared: the
 * star_cutscene_edits table via /api/star/cutscene-edits (admin write; until
 * the migration runs the route says migrationMissing and edits stay local).
 * The game's own cut scenes do NOT read these yet.
 */
import type { DirectorEdit } from "@/lib/star/cutscene/director";
import type { MoodId, Vec3 } from "@/lib/star/cutscene/types";

export interface SavedEdits {
  shots?: NonNullable<DirectorEdit["shots"]>;
  free?: Record<number, { pos: Vec3; look: Vec3 }>;
  scene?: { mood?: MoodId; exposure?: number; keyLight?: number; keyAngle?: number; keyColor?: string; spot?: { actor: string; intensity: number } | null };
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

export function saveLocal(id: string, e: SavedEdits): boolean {
  try { localStorage.setItem(KEY(id), JSON.stringify(e)); return true; } catch { return false; }
}

export async function fetchShared(): Promise<{ missing: boolean; edits: Record<string, SavedEdits> }> {
  try {
    const r = await fetch("/api/star/cutscene-edits", { cache: "no-store" });
    const j = await r.json();
    return { missing: !!j.migrationMissing, edits: (j.edits ?? {}) as Record<string, SavedEdits> };
  } catch { return { missing: false, edits: {} }; }
}

export async function pushShared(id: string, e: SavedEdits): Promise<{ ok: boolean; missing?: boolean; error?: string }> {
  try {
    const r = await fetch("/api/star/cutscene-edits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scriptId: id, edits: e }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true };
    return { ok: false, missing: !!j.migrationMissing, error: j.error ?? `error ${r.status}` };
  } catch { return { ok: false, error: "no connection" }; }
}
