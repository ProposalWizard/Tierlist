/**
 * lib/star/saveBackups.ts — what the Backups list in Settings → Saves shows
 * (components/star/SaveBackupsView.tsx), worked out without a browser.
 *
 * Harry, 28 Nov 2026: his saves were "cooked — completely different on my
 * phone and pc". Saves are now one set per account (lib/star/onlineSlots.ts),
 * and every copy the game stopped using along the way was kept as a backup
 * (storage.ts keepCareerBackup). This file turns those backups into rows:
 * where, when, the career's headline, and a short "what changed" line
 * against the save in that slot today. Restoring is storage.ts
 * restoreCareerBackup; this file never writes anything.
 *
 * Where backups live (28 Nov 2026): on this device only. The account keeps
 * one row per save slot (star_careers), with no history, so there are no
 * account-side backups to list yet. The table that would hold them is
 * written out in docs/plans/star-career-history.sql (not run; needs Harry).
 */
import type { CareerState } from "./types";
import { hasClub } from "./calendar";
import { starLevel } from "./starPoints";
import { differentCareers } from "./storage";

/** One backup as storage.ts keeps it (CareerBackup), minus what we don't read. */
export interface BackupLike {
  id: string;
  at: number;
  slot: number;
  why: string;
  playerName: string;
  season: number;
  career: unknown;
}

export interface BackupRow {
  id: string;
  slot: number;
  at: number;
  where: "device" | "account";
  /** "On this device" / "On your account". */
  whereWords: string;
  playerName: string;
  /** Null for a trial (no club yet). */
  club: string | null;
  season: number;
  age: number | null;
  stars: number | null;
  /** One short line: how this backup differs from the save there now. */
  change: string;
  /** Why it was kept, in plain words. */
  why: string;
  /** False when the copy could not be read: shown, never restorable. */
  readable: boolean;
}

/** Plain words for the `why` each place in the game writes. */
export function whyWords(why: string): string {
  switch (why) {
    case "kept this device's copy": return "Kept when you chose this device's copy";
    case "kept the online copy": return "Kept when you chose the online copy";
    case "replaced online from Saves": return "Kept when you replaced the online copy";
    case "before restoring a backup": return "Your save just before you restored a backup";
    case "deleted": return "Kept when you deleted this save";
    default: return why ? why.charAt(0).toUpperCase() + why.slice(1) : "Kept by the game";
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How far apart two points of a career are, in seasons and weeks. */
function calendarGap(a: { season: number; week: number }, b: { season: number; week: number }): number {
  return (a.season - b.season) * 100 + (a.week - b.week);
}

/**
 * One short line: this backup against the save in its slot today.
 *   "A different career: your save is Sam Hale"
 *   "2 seasons behind your save · 31 fewer goals"
 *   "6 weeks behind your save · before your move to Wrexham"
 *   "Same as your save now"
 */
export function whatChanged(backup: CareerState, now: CareerState | null): string {
  if (!now) return "This save is empty now";
  if (differentCareers(backup, now)) {
    return `A different career: your save now is ${`${now.player.firstName} ${now.player.lastName}`.trim()}`;
  }
  const bw = { season: backup.season, week: backup.week ?? 0 };
  const nw = { season: now.season, week: now.week ?? 0 };
  const gap = calendarGap(bw, nw);
  const parts: string[] = [];
  if (backup.season !== now.season) {
    const n = Math.abs(backup.season - now.season);
    parts.push(`${plural(n, "season")} ${gap < 0 ? "behind" : "ahead of"} your save`);
  } else if (bw.week !== nw.week) {
    const n = Math.abs(bw.week - nw.week);
    parts.push(`${plural(n, "week")} ${gap < 0 ? "behind" : "ahead of"} your save`);
  }
  const bg = backup.careerStats?.goals ?? 0, ng = now.careerStats?.goals ?? 0;
  if (bg !== ng) parts.push(`${plural(Math.abs(bg - ng), "goal")} ${bg < ng ? "fewer" : "more"}`);
  const bc = hasClub(backup) ? backup.player.club : null, nc = hasClub(now) ? now.player.club : null;
  if (bc !== nc && nc && gap < 0) parts.push(`before your move to ${nc}`);
  else if (bc !== nc && bc) parts.push(`at ${bc}`);
  if (!parts.length) return "Same as your save now";
  return parts.slice(0, 2).join(" · ");
}

/**
 * The rows for one save slot, newest first. `decode` turns a backup back
 * into a career (storage.ts careerFromBackup); `current` is the save in
 * that slot now (null when empty).
 */
export function backupRows(
  backups: BackupLike[], slot: number, decode: (b: BackupLike) => CareerState | null, current: CareerState | null,
): BackupRow[] {
  return backups
    .filter((b) => b.slot === slot)
    .slice()
    .sort((a, b) => b.at - a.at)
    .map((b): BackupRow => {
      const c = decode(b);
      const base = { id: b.id, slot: b.slot, at: b.at, where: "device" as const, whereWords: "On this device", why: whyWords(b.why) };
      if (!c) {
        return { ...base, playerName: b.playerName || "Unknown player", club: null, season: b.season, age: null, stars: null, change: "This copy could not be read", readable: false };
      }
      return {
        ...base,
        playerName: `${c.player.firstName} ${c.player.lastName}`.trim(),
        club: hasClub(c) ? c.player.club : null,
        season: c.season,
        age: typeof c.player.age === "number" ? c.player.age : null,
        stars: starLevel(c),
        change: whatChanged(c, current),
        readable: true,
      };
    });
}

/** How many backups a slot has (for the "Backups · 3" button). */
export function backupCount(backups: Pick<BackupLike, "slot">[], slot: number): number {
  return backups.filter((b) => b.slot === slot).length;
}

/** "Today, 21:14" / "Yesterday, 09:02" / "25 Nov, 21:14" / "25 Nov 2025". */
export function whenWords(at: number, now: number): string {
  const d = new Date(at), n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(n) - day(d)) / 86_400_000);
  if (days === 0) return `Today, ${hm}`;
  if (days === 1) return `Yesterday, ${hm}`;
  const mon = d.toLocaleString("en-GB", { month: "short" });
  return d.getFullYear() === n.getFullYear() ? `${d.getDate()} ${mon}, ${hm}` : `${d.getDate()} ${mon} ${d.getFullYear()}`;
}

// ── Download ────────────────────────────────────────────────────────────────

export const BACKUP_FILE_KIND = "knowitball-star-career-backup";
export const BACKUP_FILE_VERSION = 1;

export interface BackupFile {
  kind: typeof BACKUP_FILE_KIND;
  version: typeof BACKUP_FILE_VERSION;
  slot: number;
  /** When the backup was kept (ISO time). */
  keptAt: string;
  why: string;
  playerName: string;
  season: number;
  /** The save itself, exactly as the game stores it. */
  career: unknown;
}

/** The file "Download" gives: a name and the JSON text. */
export function backupDownload(b: BackupLike): { filename: string; text: string; file: BackupFile } {
  const file: BackupFile = {
    kind: BACKUP_FILE_KIND, version: BACKUP_FILE_VERSION,
    slot: b.slot, keptAt: new Date(b.at).toISOString(), why: b.why,
    playerName: b.playerName, season: b.season, career: b.career,
  };
  const name = (b.playerName || "career").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "career";
  const stamp = file.keptAt.slice(0, 16).replace(/[:T]/g, "-");
  return { filename: `knowitball-save${b.slot}-${name}-season${b.season}-${stamp}.json`, text: JSON.stringify(file), file };
}
