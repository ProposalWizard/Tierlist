/**
 * lib/teamRoom/bugs.ts — #bugs fills itself (plan A2, U4; Harry, 25 Oct 2026:
 * "the bug bot in this picture works really cool, I like that for ours").
 *
 * A player's report (the feedback table) becomes one Bug bot post in #bugs,
 * written inside the database by a trigger (team_room_v4.sql), so it shows in
 * seconds and nobody copies it across. The card shows the report, the page it
 * came from and two buttons: Hand to… (pick Harry, Mikey or Leo: it becomes a
 * #todo task for them) and Mark fixed (greys the card: "Fixed by Leo").
 * Pure: tested in tests/star/teamRoomStatus.mts.
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

/* ── The Bug bot's safety net (12 Nov 2026) ───────────────────────────── */

/**
 * The trigger in team_room_v4.sql posts a report the moment it is sent. If
 * that trigger is ever missing (a new database, a restore), the site does the
 * same job itself every 15 minutes: any report from the last 3 days with no
 * card yet gets one. A report is matched to its card by the report's own id
 * (meta.feedback_id), so the trigger and the check can both run and a report
 * still gets exactly one card.
 */
export const BUG_BOT = {
  bot: "bug", channel: "bugs",
  /** Only reports this new are ever posted (older ones were there before #bugs existed). */
  lookbackMs: 3 * 24 * 3600_000,
  /** A report this fresh is left alone: the trigger gets the first go. */
  graceMs: 2 * 60_000,
  maxPerRun: 10,
} as const;

/** A row of the feedback table (what a player sent from the site's form). */
export interface FeedbackRow { id: string; message: string | null; page_url: string | null; created_at: string; user_id?: string | null }
export interface NewBugRow { bot: string; channel: string; title: string; body: string; url: string | null; everyone: boolean; meta: Record<string, unknown> }

const metaOfRow = (r: Pick<BotRow, "meta">) => (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
/** The report ids that already have a card. */
export const postedFeedbackIds = (rows: readonly BotRow[]) => new Set(rows.filter((r) => r.bot === BUG_BOT.bot).map((r) => String(metaOfRow(r).feedback_id ?? "")).filter(Boolean));

/** One report as its Bug bot row: the same title, words, page and meta the database trigger writes. */
export function bugRowFor(f: FeedbackRow): NewBugRow {
  const words = (f.message ?? "").trim();
  const first = (words.split("\n")[0] ?? "").trim().slice(0, 140);
  const page = (f.page_url ?? "").slice(0, 300);
  const path = page.replace(/^https?:\/\/[^/]+/, "");
  return {
    bot: BUG_BOT.bot, channel: BUG_BOT.channel, title: first || "Bug report", body: (f.message ?? "").slice(0, 2000),
    url: path.startsWith("/") ? path.slice(0, 300) : null, everyone: false,
    meta: { feedback_id: String(f.id), page, signed_in: !!f.user_id, reported_at: f.created_at, by: "check" },
  };
}

/**
 * The cards to post now: reports from the last 3 days, older than 2 minutes,
 * with no card yet; oldest first, at most 10. Run it again with the rows it
 * made: nothing.
 */
export function bugPollPlan(input: { feedback: readonly FeedbackRow[]; rows: readonly BotRow[]; now: number; max?: number }): NewBugRow[] {
  const have = postedFeedbackIds(input.rows);
  const seen = new Set<string>();
  return input.feedback
    .filter((f) => {
      const t = Date.parse(f.created_at) || 0;
      const id = String(f.id);
      if (!id || have.has(id) || seen.has(id)) return false;
      if (input.now - t > BUG_BOT.lookbackMs || input.now - t < BUG_BOT.graceMs) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0))
    .slice(0, input.max ?? BUG_BOT.maxPerRun)
    .map(bugRowFor);
}

/** Two cards for one report (the trigger and the check landed together): the ids to delete, keeping the oldest. */
export function duplicateBugRows(rows: readonly BotRow[]): number[] {
  const first = new Map<string, number>();
  const out: number[] = [];
  for (const r of [...rows].filter((x) => x.bot === BUG_BOT.bot).sort((a, b) => a.id - b.id)) {
    const id = String(metaOfRow(r).feedback_id ?? "");
    if (!id) continue;
    if (first.has(id)) out.push(r.id); else first.set(id, r.id);
  }
  return out;
}
