/**
 * lib/teamRoom/logic.ts — the Team room's sums, kept pure so they are
 * tested (tests/star/teamRoom.mts): unread counts, idea order, to-do lists,
 * note dots. No React, no database.
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";

export interface TeamMessage { id: number; person: TeamPerson; body: string; image_url: string | null; page: string | null; pinned: boolean; created_at: string }
export type IdeaStage = "idea" | "doing" | "done";
export interface TeamIdea { id: number; person: TeamPerson; title: string; stage: IdeaStage; created_at: string; updated_at: string }
export interface TeamVote { idea_id: number; person: TeamPerson }
export interface TeamTask { id: number; owner: TeamPerson; made_by: TeamPerson; title: string; done_at: string | null; created_at: string }
export type NoteKind = "idea" | "push" | "patch";
export interface TeamNote { id: number; target_kind: NoteKind; target_id: string; owner: TeamPerson | null; person: TeamPerson; body: string; created_at: string }

const t = (iso: string) => Date.parse(iso) || 0;

/** Add or replace rows by id, oldest first. */
export function upsertById<T extends { id: number }>(rows: T[], row: T): T[] {
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) { const out = rows.slice(); out[i] = row; return out; }
  return [...rows, row].sort((a, b) => a.id - b.id);
}

/** Messages from the other two after the moment you last read the chat. */
export function unreadChat(messages: TeamMessage[], me: TeamPerson | null, lastRead: number): number {
  if (!me) return 0;
  return messages.filter((m) => m.person !== me && t(m.created_at) > lastRead).length;
}

/** Notes others left on your ideas or pushes since you last looked. */
export function unreadNotes(notes: TeamNote[], me: TeamPerson | null, lastSeen: number, kind?: NoteKind): number {
  if (!me) return 0;
  return notes.filter((n) => n.owner === me && n.person !== me && t(n.created_at) > lastSeen && (!kind || n.target_kind === kind)).length;
}

export function notesFor(notes: TeamNote[], kind: NoteKind, id: string | number): TeamNote[] {
  const key = String(id);
  return notes.filter((n) => n.target_kind === kind && n.target_id === key).sort((a, b) => a.id - b.id);
}

export function votersOf(votes: TeamVote[], ideaId: number): TeamPerson[] {
  return TEAM_PEOPLE.filter((p) => votes.some((v) => v.idea_id === ideaId && v.person === p));
}

/** Most wanted first, then newest. */
export function rankIdeas(ideas: TeamIdea[], votes: TeamVote[]): TeamIdea[] {
  const n = (id: number) => votes.filter((v) => v.idea_id === id).length;
  return ideas.slice().sort((a, b) => n(b.id) - n(a.id) || t(b.created_at) - t(a.created_at));
}

export function ideasByStage(ideas: TeamIdea[], votes: TeamVote[], stage: IdeaStage): TeamIdea[] {
  const list = rankIdeas(ideas.filter((i) => i.stage === stage), votes);
  // Done: most recently finished on top, votes no longer matter.
  return stage === "done" ? list.sort((a, b) => t(b.updated_at) - t(a.updated_at)) : list;
}

/** By person: open ideas (idea + doing) first, done last. */
export function ideasByPerson(ideas: TeamIdea[], votes: TeamVote[], person: TeamPerson): TeamIdea[] {
  const mine = ideas.filter((i) => i.person === person);
  const order: Record<IdeaStage, number> = { doing: 0, idea: 1, done: 2 };
  const ranked = rankIdeas(mine, votes);
  return ranked.sort((a, b) => order[a.stage] - order[b.stage]);
}

/** Your list: open ones (yours first, then given to you), then ticked in the last day. */
export function tasksFor(tasks: TeamTask[], me: TeamPerson | null, now: number) {
  const empty = { mine: [] as TeamTask[], given: [] as TeamTask[], done: [] as TeamTask[], open: 0 };
  if (!me) return empty;
  const keep = TEAM_ROOM.keepDoneHours * 3600_000;
  const own = tasks.filter((x) => x.owner === me);
  const open = own.filter((x) => !x.done_at).sort((a, b) => t(b.created_at) - t(a.created_at));
  return {
    mine: open.filter((x) => x.made_by === me),
    given: open.filter((x) => x.made_by !== me),
    done: own.filter((x) => x.done_at && now - t(x.done_at) < keep).sort((a, b) => t(b.done_at!) - t(a.done_at!)),
    open: open.length,
  };
}

/** Jobs you gave the other two that are still open. */
export function tasksGivenBy(tasks: TeamTask[], me: TeamPerson | null): TeamTask[] {
  if (!me) return [];
  return tasks.filter((x) => x.made_by === me && x.owner !== me && !x.done_at).sort((a, b) => t(b.created_at) - t(a.created_at));
}

/** Open jobs the other two gave you since you last looked at the list. */
export function newGivenTasks(tasks: TeamTask[], me: TeamPerson | null, lastSeen: number): number {
  if (!me) return 0;
  return tasks.filter((x) => x.owner === me && x.made_by !== me && !x.done_at && t(x.created_at) > lastSeen).length;
}

/** Time for a message: "10:04" today, "Mon 10:04" this week, else "12 Oct". */
export function stamp(iso: string, now: number): string {
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return hm;
  if (now - d.getTime() < 6 * 86400_000) return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${hm}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The page a message was sent from, as a short name for its tag. */
export function pageLabel(path: string | null, names: Record<string, string>): string | null {
  if (!path) return null;
  const clean = path.split("?")[0].split("#")[0];
  if (names[clean]) return names[clean];
  const last = clean.split("/").filter(Boolean).pop();
  return last ? last.replace(/^star-/, "").replace(/-dev$/, "").replace(/-/g, " ") : "home";
}

/** Mark a page's own bottom-left control with this attribute and the chat
 *  bubble sits just above it (B13, 20 Oct 2026). */
export const BUBBLE_CLEAR = "data-bubble-clear";
/** The bubble's size and its gap from the corner (px); ChatBubble uses these. */
export const BUBBLE_SIZE = 40;
export const BUBBLE_EDGE = 12;
/** Gap between a marked control and the bubble (px). */
const CLEAR_GAP = 8;

/**
 * How far up the bubble sits (px from the bottom): BUBBLE_EDGE, or just above
 * the highest marked control under it. Never more than half the screen up.
 */
export function bubbleBottom(
  left: number, viewH: number, marked: { left: number; right: number; top: number; bottom: number }[],
): number {
  let bottom = BUBBLE_EDGE;
  for (const r of marked) {
    if (r.right <= left || r.left >= left + BUBBLE_SIZE) continue;            // not under it, side to side
    if (r.bottom <= viewH - BUBBLE_EDGE - BUBBLE_SIZE - CLEAR_GAP) continue;  // well above where it sits
    bottom = Math.max(bottom, Math.round(viewH - r.top + CLEAR_GAP));
  }
  return Math.min(bottom, Math.round(viewH / 2));
}

/** Should the chat bubble show on this page? */
export function bubbleOn(path: string, adminUrls: string[]): boolean {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";
  if ((TEAM_ROOM.bubbleNever as readonly string[]).includes(p)) return false;
  if (TEAM_ROOM.bubblePrefixes.some((x) => p === x || p.startsWith(x + "/"))) return true;
  return adminUrls.some((u) => {
    const url = u.split("?")[0].replace(/\/+$/, "");
    return url && url !== "/" && !(TEAM_ROOM.bubbleNever as readonly string[]).includes(url) && (p === url || p.startsWith(url + "/"));
  });
}
