/**
 * lib/teamRoom/bugs.ts — #bugs fills itself (plan A2, U4; Harry, 25 Oct 2026:
 * "the bug bot in this picture works really cool, I like that for ours").
 *
 * A player's report (the feedback table) becomes one Bug bot post in #bugs,
 * written inside the database by a trigger (team_room_v4.sql), so it shows in
 * seconds and nobody copies it across. The card shows the report, the page it
 * came from and two buttons: Hand to… (pick Harry, Mikey or Leo: it becomes a
 * #todo task for them) and Mark fixed (greys the card: "Fixed by Leo").
 * Pure: tested in tests/star/teamRoomBugs.mts.
 */
import { isTeamPerson, type TeamPerson } from "./config";
import type { BotPost, BotRow } from "./channels";

export interface BugMark { post_id: number; handed_to: TeamPerson | null; fixed_by: TeamPerson | null; fixed_at: string | null; updated_by: TeamPerson; updated_at: string }

export interface BugReport {
  postId: number;
  /** "#482": the post's own number. */
  number: number;
  title: string;
  body: string;
  /** The page it was sent from, as a path on this site (null if none). */
  page: string | null;
  at: string;
  signedIn: boolean;
  mark: BugMark | null;
}

export const cleanMark = (r: Record<string, unknown>): BugMark | null => {
  const id = Number(r.post_id);
  if (!Number.isSafeInteger(id) || id <= 0 || !isTeamPerson(r.updated_by)) return null;
  return {
    post_id: id,
    handed_to: isTeamPerson(r.handed_to) ? r.handed_to : null,
    fixed_by: isTeamPerson(r.fixed_by) ? r.fixed_by : null,
    fixed_at: typeof r.fixed_at === "string" ? r.fixed_at : null,
    updated_by: r.updated_by, updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date(0).toISOString(),
  };
};

/** The Bug bot's rows as reports, newest first, each with its mark. */
export function bugReports(rows: readonly BotRow[], marks: readonly BugMark[]): BugReport[] {
  return rows.filter((r) => r.bot === "bug").map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    return {
      postId: r.id, number: r.id, title: r.title, body: r.body,
      page: r.url && r.url.startsWith("/") ? r.url : null, at: r.created_at,
      signedIn: meta.signed_in === true, mark: marks.find((m) => m.post_id === r.id) ?? null,
    };
  }).sort((a, b) => b.postId - a.postId);
}

export const isOpen = (b: BugReport) => !b.mark?.fixed_at;

/** "Open 4 · Mine 1" for the #bugs bar. */
export function bugCounts(list: readonly BugReport[], me: TeamPerson | null) {
  const open = list.filter(isOpen);
  return { open: open.length, mine: me ? open.filter((b) => b.mark?.handed_to === me).length : 0, fixed: list.length - open.length };
}

/** The task a "Hand to…" makes in #todo: the report's title and number, so it links back. */
export const handTaskTitle = (b: Pick<BugReport, "number" | "title">) => `🐞 Bug #${b.number}: ${b.title}`.slice(0, 200);

/** A post is the Bug bot's (its card draws differently). */
export const isBugPost = (p: Pick<BotPost, "bot">) => p.bot === "bug";
