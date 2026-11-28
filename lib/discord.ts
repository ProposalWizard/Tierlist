/**
 * lib/discord.ts — the Knowitball Discord (Leo, 19 Nov 2026).
 *
 * Two jobs, both off until set:
 *   1. THE INVITE. Every "Join our Discord" button reads DISCORD_INVITE. With
 *      no link the buttons draw nothing, so the site never shows a dead link.
 *      Set it here (DEFAULT_INVITE) or with the Vercel env var
 *      NEXT_PUBLIC_DISCORD_INVITE (the env var wins).
 *   2. NEW-UPDATE POSTS. A patch note with a `discord` line (a player-facing
 *      sentence, never the team's notes) is posted to the server's #updates
 *      channel by the Patch bot's 15-minute run, once, the moment it is first
 *      announced to the team. Needs DISCORD_UPDATES_WEBHOOK (Vercel only, a
 *      secret: the webhook URL is its own password).
 *
 * The server's channels, roles and welcome are built by
 * scripts/discord/setup-server.mjs from scripts/discord/blueprint.json.
 * The plan and growth playbook: docs/DISCORD.md.
 */

/** Paste the server's permanent invite here once the server exists ("https://discord.gg/xxxx"). */
const DEFAULT_INVITE = "https://discord.gg/4kvXDZRBnh"; // permanent invite on 👋・welcome, made 28 Nov 2026

export const DISCORD_INVITE: string = (process.env.NEXT_PUBLIC_DISCORD_INVITE || DEFAULT_INVITE).trim();

export const PLAY_URL = "https://knowitball.co.uk";

export interface DiscordNote {
  version: string;
  title: string;
  author: string;
  discord?: string;
}

/** "Leo's patch notes: Live chances" → "Live chances". */
export const playerTitle = (t: string) =>
  (t ?? "").replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+\w*)?\s*[:—-]?\s*/i, "").trim() || "New update";

/** The webhook message for one update. Pure: no network. Null = this note is not for players. */
export function updatePost(n: DiscordNote): { content: string; embeds: unknown[]; allowed_mentions: { parse: string[] } } | null {
  const line = (n.discord ?? "").trim();
  if (!line) return null;
  return {
    content: "",
    // Never ping @everyone from a bot; the "Update pings" role is pinged by hand when it matters.
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `🆕 ${playerTitle(n.title)}`.slice(0, 250),
      description: `${line.slice(0, 1800)}\n\n**[▶ Play now](${PLAY_URL})**`,
      color: 0x3ddc84,
      footer: { text: `Update ${n.version} · by ${n.author}` },
    }],
  };
}

/** Send one update to the #updates webhook. Never throws; says what happened. */
export async function sendUpdate(n: DiscordNote, webhook: string | undefined = process.env.DISCORD_UPDATES_WEBHOOK): Promise<"sent" | "not-for-players" | "no-webhook" | "failed"> {
  const body = updatePost(n);
  if (!body) return "not-for-players";
  if (!webhook) return "no-webhook";
  try {
    const r = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
