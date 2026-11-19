"use client";
/**
 * components/DiscordButton.tsx — "Join our Discord" (Leo, 19 Nov 2026).
 * Draws nothing until lib/discord.ts has an invite, so no dead links.
 * Each press is a PostHog event ("discord_click", { from }) so we can see
 * which button brings people in.
 */
import { DISCORD_INVITE } from "@/lib/discord";
import { posthogClient } from "@/components/PostHogProvider";

const LOGO = (
  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0" fill="currentColor">
    <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.5 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
  </svg>
);

export default function DiscordButton({ from, label = "Join our Discord", sub, className = "" }: {
  /** Where it was pressed: "footer", "game-settings", … */
  from: string;
  label?: string;
  sub?: string;
  className?: string;
}) {
  if (!DISCORD_INVITE) return null;
  return (
    <a
      href={DISCORD_INVITE}
      target="_blank"
      rel="noopener noreferrer"
      data-discord={from}
      onClick={() => { void posthogClient().then((ph) => ph?.capture("discord_click", { from })).catch(() => {}); }}
      className={`inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752c4] ${className}`}
    >
      {LOGO}
      <span className="flex flex-col leading-tight">
        <span>{label}</span>
        {sub && <span className="text-[11px] font-normal text-white/80">{sub}</span>}
      </span>
    </a>
  );
}
