/**
 * lib/teamRoom/asks.ts — messages that become tasks, the / commands and each
 * person's quick links (Harry, 12 Nov 2026: "added tasks @Mikey do this and
 * then it goes to them … in their to-do page it could be like proposals:
 * Harry asked you to do this, accept" · "slash show, slash today, slash to-do"
 * · "he can quickly link the marketing studio into his home").
 *
 * Pure sums, tested in tests/star/teamRoomAsks.mts. No new table:
 *   * A proposal is an ordinary to-do row whose title starts "[ask] ". Its
 *     owner presses Accept (the tag comes off, it is a normal job) or Decline
 *     (the row is deleted). The to-do table's rules already let the owner do both.
 *   * Quick links are kept in your own sign-in account's details, like your
 *     🔔 choices, so they follow you to every phone and computer.
 */
import { TEAM_PEOPLE, type TeamPerson } from "./config";
import { parseMessage } from "./extras";
import type { TeamMessage, TeamTask } from "./logic";

/* ── Proposals ───────────────────────────────────────────────────────── */

export const ASK_TAG = "[ask] ";
export const isAsk = (t: Pick<TeamTask, "title">) => (t.title ?? "").startsWith(ASK_TAG);
/** The job's words without the tag. */
export const askTitle = (t: Pick<TeamTask, "title">) => (isAsk(t) ? t.title.slice(ASK_TAG.length) : t.title);
/** "… (message 12)" at the end of a task made from a message: which one. */
export const askMessageId = (t: Pick<TeamTask, "title">): number | null => {
  const m = /\(message (\d{1,12})\)$/.exec(t.title ?? "");
  return m ? Number(m[1]) : null;
};

export interface AskOffer { to: TeamPerson[]; title: string }

/**
 * "@Mikey do the cup-final thumbnail by Friday" → offer a task for Mikey with
 * those words. Offered when a message names someone other than its sender and
 * has at least two words left once the names are taken out. A question to
 * someone ("@Leo did you see this?") is still offered: the sender decides.
 */
export function askOffer(m: Pick<TeamMessage, "body" | "person">): AskOffer | null {
  const p = parseMessage(m.body);
  const to = p.mentions.filter((x) => x !== m.person);
  if (!to.length) return null;
  const words = p.text.replace(/(^|[^\w@])@(harry|mikey|leo|all|everyone|team)\b[,:]?/gi, "$1").replace(/\s+/g, " ").replace(/^[\s,:;.\-–]+/, "").trim();
  if (words.split(" ").filter((w) => /\w/.test(w)).length < 2) return null;
  const title = words[0].toUpperCase() + words.slice(1);
  return { to, title: title.length > 140 ? title.slice(0, 139) + "…" : title };
}

/** The to-do row for a proposal: tagged, and it remembers the message it came from. */
export function askRow(offer: Pick<AskOffer, "title">, to: TeamPerson, from: TeamPerson, messageId?: number | null) {
  const tail = messageId ? ` (message ${messageId})` : "";
  return { owner: to, made_by: from, title: `${ASK_TAG}${offer.title}`.slice(0, 200 - tail.length) + tail };
}

/** Proposals waiting on you: someone else asked, you have not answered. Newest first. */
export function asksFor(tasks: readonly TeamTask[], me: TeamPerson | null): TeamTask[] {
  if (!me) return [];
  return tasks.filter((t) => t.owner === me && t.made_by !== me && isAsk(t) && !t.done_at).sort((a, b) => b.id - a.id);
}

/** Proposals you sent that are still waiting for a yes or no. */
export function asksSentBy(tasks: readonly TeamTask[], me: TeamPerson | null): TeamTask[] {
  if (!me) return [];
  return tasks.filter((t) => t.made_by === me && t.owner !== me && isAsk(t) && !t.done_at).sort((a, b) => b.id - a.id);
}

/** Who a message has already been turned into a task for (proposed or accepted). */
export function askedFrom(tasks: readonly TeamTask[], messageId: number): TeamPerson[] {
  return TEAM_PEOPLE.filter((p) => tasks.some((t) => t.owner === p && askMessageId(t) === messageId));
}

/** The title a proposal has once accepted (the tag off; "(message 12)" stays so the link back works). */
export const acceptedTitle = (t: Pick<TeamTask, "title">) => askTitle(t);

/* ── / commands ──────────────────────────────────────────────────────── */

export const COMMANDS = [
  { cmd: "/show", hint: "record your screen for the team", soon: true },
  { cmd: "/today", hint: "what everyone is on · /today words checks you in for today (in #today) and sets your status until midnight", soon: false },
  { cmd: "/todo", hint: "/todo words adds a job for you · /todo @Mikey words asks Mikey", soon: false },
] as const;

export type Command =
  | { kind: "todo-open" }
  | { kind: "todo-add"; title: string }
  | { kind: "todo-ask"; to: TeamPerson[]; title: string }
  | { kind: "today-show" }
  | { kind: "today-set"; text: string }
  | { kind: "show" };

/** What a typed line asks for, or null when it is an ordinary message. Only a line that STARTS with the command counts. */
export function parseCommand(text: string, me: TeamPerson | null): Command | null {
  const m = /^\/(todo|today|show)(?:\s+([\s\S]*))?$/i.exec((text ?? "").trim());
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const rest = (m[2] ?? "").trim();
  if (cmd === "show") return { kind: "show" };
  if (cmd === "today") return rest ? { kind: "today-set", text: rest.slice(0, 80) } : { kind: "today-show" };
  if (!rest) return { kind: "todo-open" };
  const offer = me ? askOffer({ body: rest, person: me }) : null;
  if (offer) return { kind: "todo-ask", to: offer.to, title: offer.title };
  return { kind: "todo-add", title: rest.replace(/\s+/g, " ").slice(0, 200) };
}

/** The end of today on this device: when a "/today words" status clears. */
export function endOfToday(now: number): string {
  const d = new Date(now);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export interface TodayLine { person: TeamPerson; status: string; open: number; first: string | null }

/** /today: one line per person. Their status words (or "no status"), open jobs and the newest one. */
export function todayLines(input: { tasks: readonly TeamTask[]; statusOf: (p: TeamPerson) => string | null; jobTitle?: (t: TeamTask) => string }): TodayLine[] {
  return TEAM_PEOPLE.map((person) => {
    const open = input.tasks.filter((t) => t.owner === person && !t.done_at && !isAsk(t) && !/^\[job:/.test(t.title)).sort((a, b) => b.id - a.id);
    return { person, status: input.statusOf(person)?.trim() || "no status", open: open.length, first: open[0] ? open[0].title.replace(/\s*\(message \d+\)$/, "") : null };
  });
}

/* ── Quick links ─────────────────────────────────────────────────────── */

/** Where they are kept in your account's details. */
export const LINKS_KEY = "teamLinks";
export const MAX_LINKS = 8;

/** Only this site's own pages: "/admin/…" or "/star-…-dev" and the like. Never a full web address. */
export const isSitePath = (s: unknown): s is string => typeof s === "string" && /^\/(?!\/)[\w\-./?=&%#]{0,180}$/.test(s);

/** Read and tidy saved links: site pages only, no doubles, at most 8. */
export function cleanLinks(raw: unknown): string[] {
  const out: string[] = [];
  for (const x of Array.isArray(raw) ? raw : []) if (isSitePath(x) && !out.includes(x)) out.push(x);
  return out.slice(0, MAX_LINKS);
}

/** Pin a page (newest last) or take it off. */
export function withLink(links: readonly string[], url: string, on: boolean): string[] {
  const rest = links.filter((x) => x !== url);
  return cleanLinks(on ? [...rest, url] : rest);
}
