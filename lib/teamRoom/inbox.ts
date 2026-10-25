/**
 * lib/teamRoom/inbox.ts — the patch-notes Inbox and its phone buzz (Harry,
 * 21 Oct 2026: "we should also have notifications in an inbox for everyone on
 * patch notes they haven't read yet (not backlogged starting from yesterday's)").
 *
 * Pure: no React, no database, no web-push, so it is tested with fakes
 * (tests/star/teamRoomInbox.mts).
 *
 *   The Inbox     every patch note published on or after TEAM_ROOM.inboxFrom,
 *                 not your own, that you have not marked "Read and understood"
 *                 (the same receipts as the Patch notes page). Newest first.
 *   Updates       an updated note (updatedAt set) is unread and buzzes again:
 *                 its receipt and ring key is "version@updatedAt" (extras.ts).
 *   The buzz      when a new patch note reaches the site, everyone but its
 *                 author gets ONE buzz (several new notes = one buzz that
 *                 counts them). Each person is rung for a version once ever:
 *                 the versions already rung are kept in their account
 *                 (app_metadata.teamPushPatches), so no table and no SQL.
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";
import { mentionsIn, patchAuthor, patchIsUpdated, patchReadKey, patchTime, type PatchMeta, type TeamAck } from "./extras";
import { mentionsAll, type PushPayload } from "./notify";
import type { TeamNote } from "./logic";

const at = (iso: string) => Date.parse(iso) || 0;

/** "Harry's patch notes: B14 Running" → "B14 Running". */
export function shortPatchTitle(title: string): string {
  return (title ?? "").replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+\w*)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";
}

/** Has this person said "Read and understood" on this version? */
const hasRead = (acks: TeamAck[], person: TeamPerson, version: string) =>
  acks.some((a) => a.kind === "patch" && a.target === version && a.person === person);

/**
 * The Inbox: patch notes `person` still has to read, newest first. Only
 * notes published on or after `from` (older ones never appear), never their
 * own. Same publish time: the archive's order (newest first) is kept.
 */
export function inboxFor(notes: PatchMeta[], person: TeamPerson | null, acks: TeamAck[], from: string = TEAM_ROOM.inboxFrom): PatchMeta[] {
  if (!person) return [];
  const start = at(from);
  return notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => at(patchTime(n)) >= start && patchAuthor(n.title) !== person && !hasRead(acks, person, patchReadKey(n)))
    .sort((a, b) => at(patchTime(b.n)) - at(patchTime(a.n)) || a.i - b.i)
    .map(({ n }) => n);
}

/** The receipt that says you have seen a note that @'s you (kept with the patch-note receipts, team_acks). */
export const noteSeenKey = (id: number) => `n:${id}`;

/**
 * Notes under patch notes that @ you (or @all) by someone else, not seen yet,
 * written on or after `from`. Newest first. Opening the note's thread marks
 * them seen (the same "patch" receipts, target "n:<id>").
 */
export function noteMentionsFor(notes: TeamNote[], person: TeamPerson | null, acks: TeamAck[], from: string = TEAM_ROOM.inboxFrom): TeamNote[] {
  if (!person) return [];
  const start = at(from);
  return notes
    .filter((n) => n.target_kind === "patch" && n.person !== person && n.id > 0 && at(n.created_at) >= start
      && (mentionsIn(n.body).includes(person) || mentionsAll(n.body))
      && !hasRead(acks, person, noteSeenKey(n.id)))
    .sort((a, b) => at(b.created_at) - at(a.created_at) || b.id - a.id);
}

/** The bell's number: 0 to 99, then "99+". */
export const bellCount = (n: number) => (n <= 0 ? "" : n > 99 ? "99+" : String(n));

/**
 * Who to ring for which new patch notes: published on or after `from`,
 * within `freshMs` of `now` (a note from the future by more than 5 minutes
 * is ignored), not the person's own, and not rung to them before.
 * `rung` = the versions each person has already been rung for.
 */
export function patchesToRing(
  notes: PatchMeta[], now: number, rung: Partial<Record<TeamPerson, readonly string[]>>,
  from: string = TEAM_ROOM.inboxFrom, freshMs: number = TEAM_ROOM.push.patchFreshMs,
): { person: TeamPerson; notes: PatchMeta[] }[] {
  const start = at(from);
  const fresh = notes.filter((n) => {
    const t = at(patchTime(n));
    const age = now - t;
    return t >= start && age >= -5 * 60_000 && age <= freshMs;
  });
  const out: { person: TeamPerson; notes: PatchMeta[] }[] = [];
  for (const p of TEAM_PEOPLE) {
    const had = rung[p] ?? [];
    const mine = fresh.filter((n) => patchAuthor(n.title) !== p && !had.includes(patchReadKey(n)));
    if (mine.length) out.push({ person: p, notes: inboxFor(mine, p, [], from) });
  }
  return out;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** One buzz for one or more new patch notes (newest first). Tap opens the newest. */
export function payloadForPatches(notes: PatchMeta[]): PushPayload {
  const newest = notes[0];
  const url = `${TEAM_ROOM.home}?tab=notes${newest ? `&v=${encodeURIComponent(newest.version)}` : ""}`;
  if (notes.length <= 1) {
    const who = newest ? patchAuthor(newest.title) : null;
    return {
      title: `${newest && patchIsUpdated(newest) ? "Updated" : "New"} patch notes${who ? ` from ${who}` : ""}${newest ? ` · v${newest.version}` : ""}`,
      body: cut(newest ? shortPatchTitle(newest.title) : "Open the Inbox to read it.", 160),
      tag: "kib-patch", url, icon: TEAM_ROOM.push.icon,
    };
  }
  return {
    title: `${notes.length} new patch notes to read`,
    body: cut(notes.map((n) => `v${n.version} ${shortPatchTitle(n.title)}`).join(" · "), 160),
    tag: "kib-patch", url, icon: TEAM_ROOM.push.icon,
  };
}

/** Remember the versions a person has been rung for (newest kept). */
export function withRungPatches(list: unknown, versions: readonly string[], cap = 300): string[] {
  const had = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  return [...had.filter((x) => !versions.includes(x)), ...versions].slice(-cap);
}

/**
 * Sort versions newest first by their numbers ("0.100h" after "0.99h";
 * parseFloat would put 0.100h at 0.1). Letters after the number are ignored.
 */
export function compareVersionsDesc(a: string, b: string): number {
  const parts = (v: string) => (v.match(/\d+/g) ?? []).map(Number);
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (y[i] ?? -1) - (x[i] ?? -1);
    if (d) return d;
  }
  return 0;
}
