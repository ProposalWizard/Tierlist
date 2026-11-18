/**
 * lib/teamRoom/patchBotServer.ts — SERVER ONLY. The Patch bot's hands: it
 * reads the patch notes this deploy carries and writes its posts into
 * team_bot_posts with the site's own key (nobody's browser can write there).
 * What to post is decided by the pure sums in patchBot.ts.
 *
 * Asked by: the timer (/api/cron/patch-bot, needs CRON_SECRET) and any admin
 * opening an admin page (/api/admin/team/bots, { run: true }). Asking twice
 * posts once: it reads its own rows first, and deletes a double if two askers
 * landed in the same second.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import type { TeamPerson } from "./config";
import type { TeamAck } from "./extras";
import type { BotRow } from "./channels";
import {
  PATCH_BOT, announcePlan, botSettings, duplicateAnnounces, isSettingsRow, nudgePlan, settingsRow,
  type BotNote, type BotSettings,
} from "./patchBot";

const COLS = "id, bot, channel, title, body, url, everyone, created_at, meta";

export const botNotes = (): BotNote[] => BUILT_IN_PATCH_NOTES.map((n) => ({
  version: n.version, title: n.title, publishedAt: n.publishedAt, updatedAt: n.updatedAt, updateNote: n.updateNote, author: n.author, summary: n.summary,
}));

/** The Patch bot's own rows (posts, reminders, settings), newest first. */
export async function patchBotRows(sb: SupabaseClient): Promise<BotRow[]> {
  const { data, error } = await sb.from("team_bot_posts").select(COLS).eq("bot", PATCH_BOT.bot).order("id", { ascending: false }).limit(400);
  if (error) throw new Error(error.message);
  return (data ?? []) as BotRow[];
}

/** Every bot's settings rows (a few), for the bots' pages. */
export async function settingsRows(sb: SupabaseClient): Promise<BotRow[]> {
  const { data, error } = await sb.from("team_bot_posts").select(COLS).eq("channel", PATCH_BOT.settingsChannel).order("id", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as BotRow[];
}

export async function saveBotSettings(sb: SupabaseClient, bot: string, s: Pick<BotSettings, "enabled" | "nudgeHours">, by: TeamPerson | null): Promise<BotSettings> {
  const { data, error } = await sb.from("team_bot_posts").insert(settingsRow(bot, s, by)).select(COLS).single();
  if (error) throw new Error(error.message);
  // Older settings rows for this bot are no longer needed (the newest wins).
  await sb.from("team_bot_posts").delete().eq("bot", bot).eq("channel", PATCH_BOT.settingsChannel).lt("id", (data as BotRow).id);
  return botSettings([data as BotRow], bot);
}

export interface PatchBotRun { ok: boolean; off?: boolean; posted: string[]; nudged: string[]; removed: number; error?: string }

/** One run: announce what is new, send due reminders, tidy doubles. Never throws. */
export async function runPatchBot(sb: SupabaseClient, now: Date = new Date()): Promise<PatchBotRun> {
  const out: PatchBotRun = { ok: true, posted: [], nudged: [], removed: 0 };
  try {
    const notes = botNotes();
    let rows = await patchBotRows(sb);
    const settings = botSettings(rows);
    if (!settings.enabled) return { ...out, off: true };

    const posts = announcePlan({ notes, rows });
    for (const p of posts) {
      const { error } = await sb.from("team_bot_posts").insert(p);
      if (error) throw new Error(error.message);
      out.posted.push(String(p.meta.version));
    }
    if (posts.length) {
      // Two askers at once can both write: keep the oldest post of each version.
      rows = await patchBotRows(sb);
      const extra = duplicateAnnounces(rows);
      if (extra.length) {
        await sb.from("team_bot_posts").delete().in("id", extra);
        out.removed = extra.length;
        rows = rows.filter((r) => !extra.includes(r.id));
      }
    }

    if (settings.nudgeHours > 0) {
      const { data: acks } = await sb.from("team_acks").select("kind, target, person, at").eq("kind", "patch");
      const nudges = nudgePlan({ notes, rows, acks: (acks ?? []) as TeamAck[], nudgeHours: settings.nudgeHours, now: now.getTime() });
      for (const n of nudges) {
        const { error } = await sb.from("team_bot_posts").insert(n);
        if (!error) out.nudged.push(String(n.meta.version));
      }
    }

    // The table keeps its newest 500 rows: write the settings again before they age out.
    const mine = rows.find((r) => isSettingsRow(r));
    if (mine) {
      const { data: top } = await sb.from("team_bot_posts").select("id").order("id", { ascending: false }).limit(1);
      const max = (top as { id: number }[] | null)?.[0]?.id ?? 0;
      if (max - mine.id > 300) await saveBotSettings(sb, PATCH_BOT.bot, settings, settings.by);
    }
    return out;
  } catch (e) {
    return { ...out, ok: false, error: (e as Error).message };
  }
}
