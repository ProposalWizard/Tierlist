/**
 * lib/marketing/suite.ts — the editing suite's notes (Harry, 22 Oct 2026;
 * docs/plans/2026-10-21-marketing-production.md, piece 4). PURE: the page and
 * the server check notes with the same code.
 *
 * One cut, two kinds of note, never mixed:
 *   review  REVIEW mode: notes pinned to moments, tagged fix / keep / check.
 *   edit    EDIT mode: instructions for Claude: cut a range out, change
 *           something at a moment, or a note for the whole video.
 *
 * Where they live: one JSON object in R2 next to the video
 * (`<video key>.notes.json`, lib/marketing/r2.ts). Why R2, not a pushed file:
 * a note saves in under a second with no commit and no deploy, stays private
 * (the repo is public; a note can name an unreleased feature), and lives in
 * the same one place as the video. Claude reads them with
 * `node scripts/marketing/suite-notes.mjs` (needs the R2 settings in its
 * environment) or from the "Copy for Claude" text on the page.
 *
 * Times are seconds in the cut as uploaded.
 */

export const REVIEW_TAGS = ["fix", "keep", "check"] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];
export const EDIT_TYPES = ["cut", "at", "general"] as const;
export type EditType = (typeof EDIT_TYPES)[number];
export const EDIT_STATUS = ["open", "done", "skipped"] as const;
export type EditStatus = (typeof EDIT_STATUS)[number];

/** The names on screen, in one place. */
export const MODE_LABEL = { review: "Review", edit: "Edit for Claude" } as const;
export const TAG_LABEL: Record<ReviewTag, string> = { fix: "Fix", keep: "Keep", check: "Check" };
export const TYPE_LABEL: Record<EditType, string> = { cut: "Cut out", at: "Change here", general: "Whole video" };

export const MAX_ITEMS = 300;
export const MAX_TEXT = 2000;
export const MAX_SECONDS = 36_000;

export interface ReviewNote { id: string; start: number; end: number; tag: ReviewTag; text: string; by: string; at: string }
export interface EditNote { id: string; type: EditType; start: number | null; end: number | null; text: string; by: string; at: string; status: EditStatus }
export interface SuiteNotes { v: 1; key: string; updated: string; review: ReviewNote[]; edit: EditNote[] }

export const emptyNotes = (key: string): SuiteNotes => ({ v: 1, key, updated: "", review: [], edit: [] });

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const ID_RE = /^[a-z0-9]{4,24}$/;
const time = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= MAX_SECONDS ? Math.round(x * 100) / 100 : null);
const text = (x: unknown): string | null => {
  if (typeof x !== "string") return null;
  const t = x.replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT);
  return t || null;
};
const by = (x: unknown) => (typeof x === "string" ? x.replace(/[^\w .@-]/g, "").trim().slice(0, 40) : "") || "Someone";
const iso = (x: unknown) => (typeof x === "string" && !Number.isNaN(Date.parse(x)) ? new Date(x).toISOString() : "");

export function parseReview(x: unknown): ReviewNote | null {
  if (!isObj(x) || typeof x.id !== "string" || !ID_RE.test(x.id)) return null;
  const start = time(x.start), t = text(x.text);
  if (start === null || !t || !REVIEW_TAGS.includes(x.tag as ReviewTag)) return null;
  const end = Math.max(start, time(x.end) ?? start);
  return { id: x.id, start, end, tag: x.tag as ReviewTag, text: t, by: by(x.by), at: iso(x.at) };
}

export function parseEdit(x: unknown): EditNote | null {
  if (!isObj(x) || typeof x.id !== "string" || !ID_RE.test(x.id) || !EDIT_TYPES.includes(x.type as EditType)) return null;
  const type = x.type as EditType;
  const t = text(x.text) ?? (type === "cut" ? "Cut this out." : null);
  if (!t) return null;
  let start: number | null = null, end: number | null = null;
  if (type !== "general") {
    start = time(x.start);
    if (start === null) return null;
    end = Math.max(start, time(x.end) ?? start);
    if (type === "cut" && end - start < 0.1) return null;
  }
  const status = EDIT_STATUS.includes(x.status as EditStatus) ? (x.status as EditStatus) : "open";
  return { id: x.id, type, start, end, text: t, by: by(x.by), at: iso(x.at), status };
}

/** A notes file, checked. Bad entries are left out, never a crash. */
export function parseNotes(raw: unknown, key: string): SuiteNotes {
  const out = emptyNotes(key);
  if (!isObj(raw)) return out;
  out.updated = iso(raw.updated);
  const seen = new Set<string>();
  for (const r of Array.isArray(raw.review) ? raw.review : []) { const n = parseReview(r); if (n && !seen.has(n.id) && out.review.length < MAX_ITEMS) { seen.add(n.id); out.review.push(n); } }
  for (const r of Array.isArray(raw.edit) ? raw.edit : []) { const n = parseEdit(r); if (n && !seen.has(n.id) && out.edit.length < MAX_ITEMS) { seen.add(n.id); out.edit.push(n); } }
  return sortNotes(out);
}

export function sortNotes(n: SuiteNotes): SuiteNotes {
  n.review.sort((a, b) => a.start - b.start || a.at.localeCompare(b.at));
  // Whole-video notes first, then by time.
  n.edit.sort((a, b) => (a.start ?? -1) - (b.start ?? -1) || a.at.localeCompare(b.at));
  return n;
}

/**
 * One change from the page. The server reads the current file, applies it and
 * writes it back, so two people saving at once both keep their notes.
 */
export type SuiteOp =
  | { op: "add" | "update"; list: "review"; item: unknown }
  | { op: "add" | "update"; list: "edit"; item: unknown }
  | { op: "delete"; list: "review" | "edit"; id: string };

export function applyOp(cur: SuiteNotes, opRaw: unknown, who: string, now: Date): { ok: true; notes: SuiteNotes } | { ok: false; error: string } {
  if (!isObj(opRaw) || (opRaw.list !== "review" && opRaw.list !== "edit")) return { ok: false, error: "Not a change the suite understands." };
  const list = opRaw.list;
  const next: SuiteNotes = { ...cur, review: [...cur.review], edit: [...cur.edit] };
  if (opRaw.op === "delete") {
    if (typeof opRaw.id !== "string") return { ok: false, error: "Which note?" };
    if (list === "review") next.review = next.review.filter((n) => n.id !== opRaw.id);
    else next.edit = next.edit.filter((n) => n.id !== opRaw.id);
  } else if (opRaw.op === "add" || opRaw.op === "update") {
    const stamped = isObj(opRaw.item) ? { ...opRaw.item, by: opRaw.op === "add" ? who : (opRaw.item.by ?? who), at: opRaw.op === "add" ? now.toISOString() : (opRaw.item.at ?? now.toISOString()) } : null;
    const item = list === "review" ? parseReview(stamped) : parseEdit(stamped);
    if (!item) return { ok: false, error: list === "review" ? "A note needs a time, a tag and some words." : "An edit needs words (and a time unless it is for the whole video; a cut needs a start and an end)." };
    const arr = (list === "review" ? next.review : next.edit) as (ReviewNote | EditNote)[];
    const i = arr.findIndex((n) => n.id === item.id);
    if (opRaw.op === "add" && i >= 0) return { ok: false, error: "That note is already saved." };
    if (opRaw.op === "update" && i < 0) return { ok: false, error: "That note was deleted. Add it again." };
    if (opRaw.op === "add" && arr.length >= MAX_ITEMS) return { ok: false, error: `This cut already has ${MAX_ITEMS} notes.` };
    if (i >= 0) arr[i] = item; else arr.push(item);
  } else return { ok: false, error: "Not a change the suite understands." };
  next.updated = now.toISOString();
  return { ok: true, notes: sortNotes(next) };
}

/* ── Time on screen ──────────────────────────────────────────────────── */
export const FPS = 30;
/** 0:07.4 */
export function clock(t: number): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
export const stepFrames = (t: number, frames: number, dur: number) => Math.max(0, Math.min(dur || 0, Math.round((t + frames / FPS) * FPS) / FPS));
/** A ruler tick every this many seconds, so ticks sit at least minPx apart. */
export function rulerStep(pxPerSec: number, minPx = 56): number {
  for (const s of [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s * pxPerSec >= minPx) return s;
  return 600;
}
/** Times for the filmstrip: the middle of each of `count` equal slices. */
export const thumbTimes = (dur: number, count: number) => (dur > 0 && count > 0 ? Array.from({ length: count }, (_, i) => ((i + 0.5) * dur) / count) : []);
/** Stack overlapping ranges into rows, so two notes at the same moment don't hide each other. */
export function rows<T extends { id: string; start: number | null; end: number | null }>(items: T[], minLen: number): Map<string, number> {
  const ends: number[] = [];
  const out = new Map<string, number>();
  for (const it of [...items].filter((x) => x.start !== null).sort((a, b) => a.start! - b.start!)) {
    const s = it.start!, e = Math.max(it.end ?? s, s + minLen);
    let r = ends.findIndex((x) => x <= s);
    if (r < 0) { r = ends.length; ends.push(e); } else ends[r] = e;
    out.set(it.id, r);
  }
  return out;
}
export const newId = (rand: () => number = Math.random) => Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");

/** The text for "Copy for Claude": every note and edit, in time order, with the video's key. */
export function forClaude(n: SuiteNotes, title: string): string {
  const lines = [`Editing suite notes for "${title}"`, `Video: ${n.key}`, ""];
  const range = (s: number | null, e: number | null) => (s === null ? "whole video" : e !== null && e - s >= 0.15 ? `${clock(s)} to ${clock(e)}` : clock(s));
  lines.push(`EDIT FOR CLAUDE (${n.edit.length})`);
  if (!n.edit.length) lines.push("- none");
  n.edit.forEach((e, i) => lines.push(`${i + 1}. [${TYPE_LABEL[e.type]}] ${range(e.start, e.end)}: ${e.text}${e.status !== "open" ? ` (${e.status})` : ""} (${e.by})`));
  lines.push("", `REVIEW NOTES (${n.review.length})`);
  if (!n.review.length) lines.push("- none");
  n.review.forEach((r, i) => lines.push(`${i + 1}. [${TAG_LABEL[r.tag]}] ${range(r.start, r.end)}: ${r.text} (${r.by})`));
  lines.push("", "Follow .claude/skills/suite-inbox/SKILL.md.");
  return lines.join("\n");
}
