/**
 * "SAY WHAT FEELS OFF" — the team's plain-words tuning notes.
 *
 * The team tunes by playing (14 Oct 2026): play some chances, then say what
 * feels wrong ("too many cutbacks", "never on my wing"). Each note is stored
 * with what was on screen when it was written, so the cause can be found
 * later: the page, the chance kind, the league if known, the seed and the
 * time. It goes to the shared `star_tuning_notes` table
 * (supabase/migrations/star_tuning_notes.sql) through /api/star/tuning-notes.
 * Until that table exists a note is kept in this browser and the panel says
 * "saved on this device only"; the next save that reaches the table sends the
 * waiting ones too.
 *
 * Reaches the terminal through scripts/tuning-notes.mts (also printed at the
 * end of scripts/tuner-proposals.mts).
 */

export const NOTE_CHIPS = [
  "too many cutbacks",
  "too many crosses",
  "not enough chances",
  "never on my wing",
  "too easy",
  "too hard",
] as const;

export interface TuningNote {
  id: string;
  /** Chips picked, in their on-screen words. */
  chips: string[];
  /** The free-text line, trimmed. */
  text: string;
  page: string;
  kind?: string;
  league?: string;
  position?: string;
  seed?: number;
  minute?: number;
  /** How many chances the session had seen when the note was written. */
  seen?: number;
  at: number;
}

const LOCAL_KEY = "star-tuning-notes-pending-v1";
const LIMIT_TEXT = 500;

export function makeNote(n: Omit<TuningNote, "id" | "at" | "text"> & { text: string }): TuningNote {
  const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { ...n, id, text: n.text.trim().slice(0, LIMIT_TEXT), at: Date.now() };
}

/** Shape check, shared by the route and the script. */
export function isTuningNote(v: unknown): v is TuningNote {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || !/^[\w-]{4,80}$/.test(r.id)) return false;
  if (typeof r.page !== "string" || r.page.length > 60) return false;
  if (!Array.isArray(r.chips) || r.chips.length > 12 || !r.chips.every((c) => typeof c === "string" && c.length <= 60)) return false;
  if (typeof r.text !== "string" || r.text.length > LIMIT_TEXT) return false;
  if (!r.chips.length && !r.text.trim()) return false;
  if (typeof r.at !== "number") return false;
  for (const k of ["kind", "league", "position"] as const) if (r[k] !== undefined && (typeof r[k] !== "string" || (r[k] as string).length > 60)) return false;
  for (const k of ["seed", "minute", "seen"] as const) if (r[k] !== undefined && typeof r[k] !== "number") return false;
  return true;
}

export function pendingNotes(): TuningNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(isTuningNote) : [];
  } catch {
    return [];
  }
}
function setPending(list: TuningNote[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-200))); } catch { /* nothing to keep it in */ }
}

export type SaveResult = { where: "shared" | "device"; message: string };

/** Send one note. Never throws: a failure keeps it on this device. */
export async function saveTuningNote(note: TuningNote): Promise<SaveResult> {
  const waiting = pendingNotes().filter((n) => n.id !== note.id);
  const batch = [...waiting, note];
  try {
    const r = await fetch("/api/star/tuning-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: batch }),
    });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; migrationMissing?: boolean; error?: string };
    if (r.ok && d.ok) {
      setPending([]);
      return { where: "shared", message: waiting.length ? `Saved for the team (and ${waiting.length} waiting).` : "Saved for the team." };
    }
    setPending(batch);
    return {
      where: "device",
      message: d.migrationMissing
        ? "Saved on this device only — the notes table isn't switched on yet."
        : `Saved on this device only — ${d.error ?? `the server said ${r.status}`}.`,
    };
  } catch {
    setPending(batch);
    return { where: "device", message: "Saved on this device only — couldn't reach the server." };
  }
}
