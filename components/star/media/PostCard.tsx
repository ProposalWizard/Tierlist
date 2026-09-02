"use client";
import type { StoredPost } from "@/lib/star/media/types";
import { relativeTime } from "@/lib/star/media/schedule";
import Graphic from "./Graphics";
import Avatar from "./Avatar";

/**
 * One post.
 *
 * The archetype changes the words but not the card chrome any more — every
 * card used to carry its own coloured left stripe (emerald for a club,
 * amber for a cup account, and so on through nine more colours), which read
 * as unexplained noise rather than information: reported directly, "I can't
 * seem to understand what this is referring to." The archetype is still
 * named on the byline line (Club/League/Stats/Press/…) where it can
 * actually be read, so nothing legible was lost — only the ten-colour key
 * nobody had.
 */

const CHROME: Record<string, { label: string }> = {
  club: { label: "Club" },
  league: { label: "League" },
  competition: { label: "Cup" },
  broadsheet: { label: "Press" },
  tabloid: { label: "Back Page" },
  insider: { label: "Transfers" },
  stats: { label: "Stats" },
  aggregator: { label: "Highlights" },
  pundit: { label: "Opinion" },
  fan: { label: "" },
  rivalFan: { label: "" },
  teammate: { label: "" },
  meme: { label: "" },
};

function count(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PostCard({ post, now }: { post: StoredPost; now: number }) {
  const chrome = CHROME[post.author.archetype] ?? CHROME.fan;
  return (
    <article className="rounded-xl border border-white/12 bg-gray-800/80 p-3">
      <header className="flex items-start gap-2.5">
        <Avatar
          initials={post.author.initials}
          tint={post.author.tint}
          tint2={post.author.tint2}
          glyph={post.author.glyph}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] font-black text-white">{post.author.name}</span>
            {post.author.verified && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#38bdf8" className="shrink-0">
                <path d="M12 2l2.2 2.2 3.1-.4.6 3.1L20.7 8.5l-1.4 2.8 1.4 2.8-2.8 1.6-.6 3.1-3.1-.4L12 22l-2.2-2.6-3.1.4-.6-3.1-2.8-1.6 1.4-2.8-1.4-2.8 2.8-1.6.6-3.1 3.1.4z" />
                <path d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.9-3.9 1.1 1.1z" fill="#0b1220" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/65">
            <span className="truncate">{post.author.handle}</span>
            <span>·</span>
            <span>{relativeTime(post.at, now)}</span>
            {chrome.label && (
              <>
                <span>·</span>
                <span className="uppercase tracking-wider">{chrome.label}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <p className="mt-2 whitespace-pre-line text-[13px] font-semibold leading-snug text-white">
        {post.text}
      </p>

      {post.graphic && (
        <div className="mt-2.5">
          <Graphic spec={post.graphic} />
        </div>
      )}

      <footer className="mt-2.5 flex items-center gap-5 text-[10px] font-bold text-white/60">
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 6H3M21 12H3M15 18H3" strokeLinecap="round" />
          </svg>
          {count(post.metrics.replies)}
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M17 2l4 4-4 4M21 6H7a4 4 0 00-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 004-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {count(post.metrics.reposts)}
        </span>
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-7.5-4.6-9.5-9A5.4 5.4 0 0112 5.5 5.4 5.4 0 0121.5 12c-2 4.4-9.5 9-9.5 9z" />
          </svg>
          {count(post.metrics.likes)}
        </span>
      </footer>
    </article>
  );
}
