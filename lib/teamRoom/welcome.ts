/**
 * lib/teamRoom/welcome.ts — the note shown once, full screen, when someone
 * opens the Team room (Harry, 25 Oct 2026). One message for everyone plus a
 * short line per person; "{name}" becomes the reader's name. "Got it" opens
 * the room. When the note is edited with "Show again" it opens once more,
 * marked UPDATED. It stays pinned at the top of #general. Only Harry edits
 * it and sees who has read it. Pure: tested in tests/star/teamRoomWelcome.mts.
 * Saved in team_welcome / team_welcome_reads (team_room_v4.sql).
 */
import { TEAM_PEOPLE, isTeamPerson, type TeamPerson } from "./config";

export interface WelcomeRow { body: string; lines: Partial<Record<TeamPerson, string>>; version: number; updated_at: string; updated_by: TeamPerson | null }
export interface WelcomeRead { person: TeamPerson; version: number; at: string }

/** Who may edit the note and see who has read it. */
export const WELCOME_EDITOR: TeamPerson = "Harry";

export function cleanWelcome(raw: Record<string, unknown> | null | undefined): WelcomeRow | null {
  if (!raw) return null;
  const lines: Partial<Record<TeamPerson, string>> = {};
  const l = raw.lines && typeof raw.lines === "object" ? (raw.lines as Record<string, unknown>) : {};
  for (const p of TEAM_PEOPLE) if (typeof l[p] === "string" && (l[p] as string).trim()) lines[p] = (l[p] as string).trim().slice(0, 400);
  return {
    body: typeof raw.body === "string" ? raw.body.slice(0, 3000) : "",
    lines,
    version: Math.max(1, Math.floor(Number(raw.version) || 1)),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date(0).toISOString(),
    updated_by: isTeamPerson(raw.updated_by) ? raw.updated_by : null,
  };
}

/** "{name}" → the reader's name, everywhere in the text. */
export const fillName = (text: string, name: TeamPerson) => (text ?? "").replace(/\{name\}/gi, name);

/** Is there a note with words in it? */
export const hasNote = (w: WelcomeRow | null | undefined): w is WelcomeRow => !!w && (!!w.body.trim() || Object.values(w.lines).some((x) => !!x?.trim()));

/** Show the note to `me` now? There is one, and they haven't pressed Got it on this version. */
export function welcomeDue(w: WelcomeRow | null | undefined, reads: readonly WelcomeRead[], me: TeamPerson | null): boolean {
  if (!me || !hasNote(w)) return false;
  return !reads.some((r) => r.person === me && r.version === w.version);
}

/** Shown again after an edit ("UPDATED"): they have read an older version, not this one. */
export const welcomeUpdated = (w: WelcomeRow, reads: readonly WelcomeRead[], me: TeamPerson) =>
  w.version > 1 && reads.some((r) => r.person === me && r.version < w.version);

/** For the editor: each other person, and when they last pressed Got it on this version (null = not yet). */
export function welcomeReceipts(w: WelcomeRow, reads: readonly WelcomeRead[]): { person: TeamPerson; at: string | null; older: boolean }[] {
  return TEAM_PEOPLE.filter((p) => p !== WELCOME_EDITOR).map((p) => {
    const now = reads.find((r) => r.person === p && r.version === w.version);
    return { person: p, at: now?.at ?? null, older: !now && reads.some((r) => r.person === p) };
  });
}

/** Saving: the next version when "Show again" is ticked, else the same one. */
export const nextVersion = (w: WelcomeRow | null, showAgain: boolean) => (w ? w.version + (showAgain ? 1 : 0) : 1);
