/**
 * lib/teamRoom/botsServer.ts — SERVER ONLY. A run of every bot (Harry, 12 Nov
 * 2026: "have you done a run of all bots?"). Each bot's hands: read what it
 * needs, decide with the pure sums (patchBot.ts, bugs.ts, today.ts, health.ts,
 * lib/backup/plan.ts), write its rows into team_bot_posts with the site's own
 * key. No browser can write there.
 *
 * Asked by:
 *   /api/cron/patch-bot   every 15 minutes (needs CRON_SECRET): Patch, Bug, Today
 *   /api/cron/limits      08:00 UK (needs CRON_SECRET): Health
 *   /api/admin/team/bots  an admin opening an admin page (Patch, Bug, Today),
 *                         or pressing Run now on a bot's page (that one bot)
 *
 * Every run answers in plain words what it did, or why it did nothing.
 * Asking twice never posts twice: each bot reads its own rows first.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitsPost, sizesByTopFolder, ukClock, type Manifest } from "@/lib/backup/plan";
import { postHealth, r2Config, r2ListAll, readManifest, supabaseSizes } from "@/lib/backup/server";
import type { TeamPerson } from "./config";
import type { BotRow } from "./channels";
import type { TeamMessage } from "./logic";
import { BUG_BOT, bugPollPlan, duplicateBugRows, type FeedbackRow } from "./bugs";
import { botSettings } from "./patchBot";
import { runPatchBot, settingsRows } from "./patchBotServer";
import { TODAY_BOT, TODAY_CHANNEL, todayAskPlan, ukDay } from "./today";

const COLS = "id, bot, channel, title, body, url, everyone, created_at, meta";

export interface BotRun {
  bot: string; ok: boolean;
  /** How many rows it wrote. */
  posted: number;
  /** One plain line: what it did, or why it did nothing. */
  text: string;
  /** Switched off on its page. */
  off?: boolean;
  /** For the Health bot: the post was red (the caller rings phones). */
  red?: boolean; title?: string; body?: string;
}

const fail = (bot: string, e: unknown): BotRun => ({ bot, ok: false, posted: 0, text: `Could not run: ${e instanceof Error ? e.message : "unknown error"}` });

async function rowsOf(sb: SupabaseClient, bot: string, limit = 500): Promise<BotRow[]> {
  const { data, error } = await sb.from("team_bot_posts").select(COLS).eq("bot", bot).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BotRow[];
}
async function enabled(sb: SupabaseClient, bot: string): Promise<boolean> {
  return botSettings(await settingsRows(sb), bot).enabled;
}

/* ── Patch bot ──────────────────────────────────────────────────────── */

export async function runPatch(sb: SupabaseClient, now: Date): Promise<BotRun> {
  const r = await runPatchBot(sb, now);
  if (!r.ok) return { bot: "patch-notes", ok: false, posted: 0, text: `Could not run: ${r.error ?? "unknown error"}` };
  if (r.off) return { bot: "patch-notes", ok: true, posted: 0, off: true, text: "Switched off: nothing announced." };
  const parts = [
    r.posted.length ? `announced ${r.posted.map((v) => `v${v}`).join(", ")} in #general` : "",
    r.nudged.length ? `reminded about ${r.nudged.map((v) => `v${v}`).join(", ")}` : "",
    r.removed ? `removed ${r.removed} double post${r.removed === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return { bot: "patch-notes", ok: true, posted: r.posted.length + r.nudged.length, text: parts.length ? `Done: ${parts.join("; ")}.` : "Nothing to do: every patch note is already announced and no reminder is due." };
}

/* ── Bug bot (the safety net behind the database trigger) ───────────── */

export async function runBugBot(sb: SupabaseClient, now: Date): Promise<BotRun> {
  try {
    const since = new Date(now.getTime() - BUG_BOT.lookbackMs).toISOString();
    let feedback: FeedbackRow[];
    const first = await sb.from("feedback").select("id, message, page_url, created_at, user_id").gte("created_at", since).order("created_at", { ascending: true }).limit(200);
    if (first.error) {
      // An older feedback table without user_id: read it without.
      const second = await sb.from("feedback").select("id, message, page_url, created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(200);
      if (second.error) throw new Error(second.error.message);
      feedback = (second.data ?? []) as FeedbackRow[];
    } else feedback = (first.data ?? []) as FeedbackRow[];

    let rows = await rowsOf(sb, BUG_BOT.bot);
    const plan = bugPollPlan({ feedback, rows, now: now.getTime() });
    for (const p of plan) {
      const { error } = await sb.from("team_bot_posts").insert(p);
      if (error) throw new Error(error.message);
    }
    let removed = 0;
    if (plan.length) {
      rows = await rowsOf(sb, BUG_BOT.bot);
      const extra = duplicateBugRows(rows);
      if (extra.length) { await sb.from("team_bot_posts").delete().in("id", extra); removed = extra.length; }
    }
    const made = plan.length - removed;
    return {
      bot: BUG_BOT.bot, ok: true, posted: made,
      text: made > 0 ? `Done: posted ${made} report card${made === 1 ? "" : "s"} in #bugs that the database had not posted.`
        : feedback.length ? `Nothing to do: all ${feedback.length} report${feedback.length === 1 ? "" : "s"} from the last 3 days already ${feedback.length === 1 ? "has its" : "have their"} card.`
          : "Nothing to do: no player has sent a report in the last 3 days.",
    };
  } catch (e) { return fail(BUG_BOT.bot, e); }
}

/* ── Today bot ──────────────────────────────────────────────────────── */

export async function runTodayBot(sb: SupabaseClient, now: Date): Promise<BotRun> {
  try {
    if (!(await enabled(sb, TODAY_BOT.bot))) return { bot: TODAY_BOT.bot, ok: true, posted: 0, off: true, text: "Switched off: it asked nobody." };
    const rows = await rowsOf(sb, TODAY_BOT.bot, 30);
    const since = new Date(now.getTime() - 36 * 3600_000).toISOString();
    const { data, error } = await sb.from("team_messages").select("id, person, body, image_url, page, pinned, created_at").gte("created_at", since).like("body", `[#${TODAY_CHANNEL}]%`).order("id", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const plan = todayAskPlan({ now, rows, messages: (data ?? []) as TeamMessage[] });
    for (const p of plan) {
      const { error: e2 } = await sb.from("team_bot_posts").insert(p);
      if (e2) throw new Error(e2.message);
    }
    if (plan.length) return { bot: TODAY_BOT.bot, ok: true, posted: 1, text: `Done: asked ${(plan[0].meta.people as string[]).join(" and ")} in #today.` };
    const { day, hour, weekday } = ukDay(now);
    const why = weekday === 0 || weekday === 6 ? "it is the weekend"
      : hour < TODAY_BOT.hour ? `it is before ${TODAY_BOT.hour}:00 UK time`
        : hour > TODAY_BOT.lastHour ? `it is after ${TODAY_BOT.lastHour + 1}:00 UK time`
          : rows.some((r) => (r.meta as Record<string, unknown> | null)?.day === day) ? "it has already asked today" : "all three have checked in today";
    return { bot: TODAY_BOT.bot, ok: true, posted: 0, text: `Nothing to do: ${why}.` };
  } catch (e) { return fail(TODAY_BOT.bot, e); }
}

/* ── Health bot ─────────────────────────────────────────────────────── */

/**
 * The morning limits post (the 08:00 timer) or the same post asked for from
 * the bot's page (`by`: who pressed Run now). Reads sizes, never changes
 * anything, writes the one post.
 */
/** The limits, read this minute: the database, Storage, R2 and last night's backup. Reads only. */
export async function readLimits(sb: SupabaseClient, now: Date) {
  const day = ukClock(now).day;
  const notes: string[] = [];
  const sizes = await supabaseSizes(sb).catch(() => ({ dbBytes: null, storageBytes: null, note: "could not read database sizes" }));
  if (sizes.note) notes.push(sizes.note);
  const { config, missing } = r2Config();
  let r2: ReturnType<typeof sizesByTopFolder> | null = null;
  let backup: Manifest | null = null;
  if (!config) notes.push(`R2 is not connected here (${missing.join(", ")})`);
  else {
    try { r2 = sizesByTopFolder(await r2ListAll(config)); } catch { notes.push("could not list the R2 bucket"); }
    try { backup = await readManifest(config, day); } catch { notes.push("could not read last night's backup manifest"); }
  }
  return { day, post: limitsPost({ day, dbBytes: sizes.dbBytes, storageBytes: sizes.storageBytes, r2, backup, notes }) };
}

export async function runHealthBot(sb: SupabaseClient, now: Date, opts: { by?: TeamPerson | null; manual?: boolean } = {}): Promise<BotRun> {
  try {
    if (!opts.manual && !(await enabled(sb, "health"))) return { bot: "health", ok: true, posted: 0, off: true, text: "Switched off: no morning post." };
    const { day, post } = await readLimits(sb, now);
    const title = opts.manual ? `${post.title} · asked for${opts.by ? ` by ${opts.by}` : ""}`.slice(0, 200) : post.title;
    await postHealth(sb, { title, body: post.body, meta: { kind: "limits", red: post.red, level: post.level, day, lines: post.lines, ...(opts.manual ? { manual: true, by: opts.by ?? null } : {}) } });
    return { bot: "health", ok: true, posted: 1, red: post.red, title, body: post.body, text: `Done: posted the limits in #health (${post.level === "green" ? "all green" : post.level === "unknown" ? "some readings missing" : post.level}).` };
  } catch (e) { return fail("health", e); }
}

/* ── All of them ────────────────────────────────────────────────────── */

/** The quarter-hour run: Patch, Bug and Today, one after another. One failing never stops the others. */
export async function runQuarterHour(sb: SupabaseClient, now: Date = new Date()): Promise<{ ok: boolean; runs: BotRun[] }> {
  const runs = [await runPatch(sb, now), await runBugBot(sb, now), await runTodayBot(sb, now)];
  return { ok: runs.every((r) => r.ok), runs };
}

/** Run now, for one bot (its page's button). */
export async function runOne(sb: SupabaseClient, bot: string, by: TeamPerson | null, now: Date = new Date()): Promise<BotRun> {
  if (bot === "patch-notes") return runPatch(sb, now);
  if (bot === "bug") return runBugBot(sb, now);
  if (bot === "today") return runTodayBot(sb, now);
  if (bot === "health") return runHealthBot(sb, now, { manual: true, by });
  return { bot, ok: false, posted: 0, text: "This bot has nothing to run." };
}
