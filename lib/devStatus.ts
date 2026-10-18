/**
 * lib/devStatus.ts — live progress bars on the team board (ship 2 of
 * docs/plans/2026-10-15/teamboard.md, design B: a Stop hook sends them).
 *
 * A progress update (the progress-update skill) is text like
 *     Keeper dive fix        ████████░░  80%  filming to check · ~10 min left
 *     Waiting on: you, to merge Harry → main
 * Each chat's Stop hook (scripts/hooks/post-status-hook.mjs) keeps only those
 * lines and POSTs them to /api/dev-status with DEV_STATUS_TOKEN. This file
 * reads them back into bars. Pure; tests in tests/star/teamBoard.mts.
 */
import { timingSafeEqual } from "crypto";

export interface DevBar { label: string; pct: number; note: string }
export interface DevStatus { at: string; bars: DevBar[]; waiting: string | null; session: string | null }

export const STATUS_PEOPLE = ["Harry", "Mikey", "Leo"] as const;
export const MAX_STATUS_CHARS = 6000;

const BAR_LINE = /^(.*?)\s*([█░▓▒■□]{4,})\s*(\d{1,3})\s*%\s*(.*)$/;

/** The bar lines of an update, as label / percent / the words after it. */
export function parseBars(text: string): DevBar[] {
  const out: DevBar[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^[\s`>*-]+/, "").trimEnd();
    const m = BAR_LINE.exec(line);
    if (!m) continue;
    const label = m[1].replace(/[│|·]+$/, "").trim();
    if (!label) continue;
    out.push({ label: label.slice(0, 60), pct: Math.max(0, Math.min(100, Number(m[3]))), note: m[4].replace(/^[·\-–—\s]+/, "").trim().slice(0, 120) });
    if (out.length >= 10) break;
  }
  return out;
}

export function parseWaiting(text: string): string | null {
  const m = /^\s*Waiting on:\s*(.+)$/im.exec(text);
  return m ? m[1].trim().slice(0, 140) : null;
}

/**
 * What the hook sends: only the bar lines, "Started…", "Waiting on…" and the
 * usage lines, with anything shaped like a key blanked out. Empty string =
 * this message had no bars, send nothing.
 */
export function extractUpdate(message: string): string {
  const lines = message.replace(/\r/g, "").split("\n");
  if (!lines.some((l) => BAR_LINE.test(l.replace(/^[\s`>*-]+/, "")))) return "";
  const keep = lines.filter((l) => {
    const t = l.replace(/^[\s`>*-]+/, "");
    return BAR_LINE.test(t) || /^(Started|Waiting on|Speed check|UPDATE)\b/i.test(t) || /\b(tokens?|weekly|usage)\b/i.test(t);
  });
  return scrub(keep.join("\n")).slice(0, MAX_STATUS_CHARS);
}

/** Blank out anything that looks like a secret before it leaves the chat. */
export function scrub(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, "[key]")
    .replace(/\b(ghp|gho|ghs|github_pat|sk|phc|sk-ant)[-_][A-Za-z0-9_-]{12,}/g, "[key]");
}

/** Constant-time check of the shared password. */
export function tokenMatches(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function statusFromRow(row: { created_at: string; body: string; session?: string | null }): DevStatus {
  return { at: row.created_at, bars: parseBars(row.body), waiting: parseWaiting(row.body), session: row.session ?? null };
}
