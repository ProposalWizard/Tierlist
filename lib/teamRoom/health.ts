/**
 * lib/teamRoom/health.ts — the Health bot's posts as the room draws them
 * (Harry, 12 Nov 2026: "Health bot: posts the 08:00 limits result into
 * #health … with the 4 lines and colours").
 *
 * The morning job (lib/teamRoom/healthBotServer.ts) writes one row a day into
 * team_bot_posts: bot "health", channel "health", a body of four lines
 * (Database, Supabase Storage, Cloudflare R2, last night's backup) and
 * meta.lines with each line's level. This file turns a row into coloured
 * lines and the history list. Pure: tested in tests/star/teamRoomBots.mts.
 */
import type { BotRow } from "./channels";

export type HealthLevel = "green" | "amber" | "red" | "unknown";
export const HEALTH_BOT = { bot: "health", channel: "health", ukHour: 8 } as const;

const LEVELS: readonly HealthLevel[] = ["green", "amber", "red", "unknown"];
const isLevel = (x: unknown): x is HealthLevel => typeof x === "string" && (LEVELS as readonly string[]).includes(x);
const DOT_LEVEL: Record<string, HealthLevel> = { "🟢": "green", "🟠": "amber", "🟡": "amber", "🔴": "red", "⚪": "unknown" };
const metaOf = (r: Pick<BotRow, "meta">) => (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;

export interface HealthLine { level: HealthLevel; text: string; note: boolean }

/**
 * A post's body as lines, each with its colour. The colour comes from
 * meta.lines (by position) and, failing that, from the dot the line starts
 * with. A "Note: …" line (a reading that could not be taken) has no colour.
 */
export function healthLines(row: Pick<BotRow, "body" | "meta">): HealthLine[] {
  const levels = Array.isArray(metaOf(row).lines) ? (metaOf(row).lines as { level?: unknown }[]) : [];
  let i = 0;
  return (row.body ?? "").split("\n").map((raw) => raw.trim()).filter(Boolean).map((raw) => {
    if (/^Note:/i.test(raw)) return { level: "unknown" as HealthLevel, text: raw, note: true };
    const dot = Array.from(raw)[0];
    const fromDot = DOT_LEVEL[dot];
    const text = fromDot ? raw.slice(dot.length).trim() : raw;
    const fromMeta = levels[i]?.level;
    i++;
    return { level: isLevel(fromMeta) ? fromMeta : fromDot ?? "unknown", text, note: false };
  });
}

/** The post's overall level: red beats amber beats unknown beats green. */
export function healthLevel(row: Pick<BotRow, "body" | "meta">): HealthLevel {
  const l = metaOf(row).level;
  if (isLevel(l)) return l;
  const lines = healthLines(row).filter((x) => !x.note);
  return (["red", "amber", "unknown", "green"] as const).find((v) => lines.some((x) => x.level === v)) ?? "unknown";
}

export const HEALTH_WORD: Record<HealthLevel, string> = { green: "All green", amber: "Amber", red: "Red", unknown: "Readings missing" };

/** A morning limits post (not a "did not run" notice, not a settings row). */
export const isLimitsPost = (r: Pick<BotRow, "bot" | "meta">) => r.bot === HEALTH_BOT.bot && metaOf(r).kind === "limits";

/** The Health bot's posts, newest first (limits posts and its notices), at most `max`. */
export function healthPosts(rows: readonly BotRow[], max = 14): BotRow[] {
  return rows.filter((r) => r.bot === HEALTH_BOT.bot && r.channel === HEALTH_BOT.channel && metaOf(r).kind !== "settings")
    .sort((a, b) => b.id - a.id).slice(0, max);
}

/** The newest morning limits post, or null when none has arrived. */
export const latestLimits = (rows: readonly BotRow[]): BotRow | null => healthPosts(rows, 500).find(isLimitsPost) ?? null;

/** Has the morning post for this UK day gone out already? (Run now on the same day posts again, marked "asked for".) */
export const limitsPostedFor = (rows: readonly BotRow[], day: string) => rows.some((r) => isLimitsPost(r) && metaOf(r).day === day && metaOf(r).manual !== true);
