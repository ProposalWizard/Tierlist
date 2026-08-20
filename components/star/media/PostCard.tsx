"use client";
import type { StoredPost } from "@/lib/star/media/types";
import { relativeTime } from "@/lib/star/media/schedule";
import Graphic from "./Graphics";
import Avatar from "./Avatar";

/**
 * One post.
 *
 * The archetype changes the chrome as well as the words — a newspaper reads as a
 * masthead, a supporter reads as somebody's phone — because a feed where every
 * card is identical undoes most of the work the voice system did.
 */

const CHROME: Record<string, { label: string; accent: string }> = {
  club: { label: "Club", accent: "border-l-emerald-500" },
  league: { label: "League", accent: "border-l-indigo-400" },
  competition: { label: "Cup", accent: "border-l-amber-400" },
  broadsheet: { label: "Press", accent: "border-l-slate-300" },
  tabloid: { label: "Back Page", accent: "border-l-red-500" },
  insider: { label: "Transfers", accent: "border-l-orange-400" },
  stats: { label: "Stats", accent: "border-l-cyan-400" },
  aggregator: { label: "Highlights", accent: "border-l-rose-400" },
  pundit: { label: "Opinion", accent: "border-l-violet-400" },
  fan: { label: "", accent: "border-l-white/25" },
  rivalFan: { label: "", accent: "border-l-white/25" },
  teammate: { label: "", accent: "border-l-sky-400" },
  meme: { label: "", accent: "border-l-pink-400" },
};

function count(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function PostCard({ post, now }: { post: StoredPost; now: number }) {
  const chrome = CHROME[post.author.archetype] ?? CHROME.fan;
  return (
    <article className={`rounded-xl border border-white/12 border-l-[3px] ${chrome.accent} bg-gray-800/80 p-3`}>
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
