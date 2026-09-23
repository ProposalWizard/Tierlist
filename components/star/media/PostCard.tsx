"use client";
import { useRef } from "react";
import type { StoredPost } from "@/lib/star/media/types";
import { relativeTime } from "@/lib/star/media/schedule";
import Graphic from "./Graphics";
import Avatar from "./Avatar";

/**
 * One post, laid out like a real social app rather than a card.
 *
 * Rebuilt 23 Sep 2026 from a concept image, asked for directly: the posts
 * "are all boxed with curved things"; they should "integrate nicely into
 * each post" the way real social media does. So: no box, the posts run
 * edge to edge divided by a hairline; the picture sits in a left column
 * with everything else beside it; name, tick, handle and time on ONE line;
 * no category label ("some of them currently are labeled as back page or
 * stats or club, which is unnecessary"); a full action row spread across
 * the post. A graphic (a scoreline, a stat box, a Player of the Month card)
 * sits under the words like an attached picture.
 *
 * Only the look changed. What a post says, who posts it and when are
 * untouched.
 */

/** The scrolling column the posts sit in — shared by the phone and the
 *  Media Lab preview, so the preview can never drift from the real feed. */
export const FEED_LIST_CLASS = "";

function count(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ICON = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The pink a liked heart turns — the same one real social apps use. */
const LIKED = "#f91880";

export default function PostCard({ post, now, onToggleLike }: {
  post: StoredPost;
  now: number;
  /** Tapping the heart. Absent: the heart is just a number, not a button. */
  onToggleLike?: (postId: string) => void;
}) {
  const heartRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const likes = post.metrics.likes + (post.liked ? 1 : 0);

  // Asked for directly: "a very quick animation and it would like almost
  // flash and turn into a red heart." A pop on the heart and a pink ring
  // bursting out of it, on liking only; unliking just goes back quietly.
  const like = () => {
    if (!onToggleLike) return;
    if (!post.liked) {
      heartRef.current?.animate(
        [{ transform: "scale(0.6)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }],
        { duration: 320, easing: "cubic-bezier(.2,.9,.3,1.3)" },
      );
      ringRef.current?.animate(
        [{ transform: "scale(0.3)", opacity: 0.9 }, { transform: "scale(1.6)", opacity: 0 }],
        { duration: 420, easing: "ease-out" },
      );
    }
    onToggleLike(post.id);
  };

  return (
    <article className="flex gap-3 border-b border-white/10 px-3.5 pb-2.5 pt-3">
      <Avatar
        initials={post.author.initials}
        tint={post.author.tint}
        tint2={post.author.tint2}
        glyph={post.author.glyph}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1 text-[14px] leading-5">
          <span className="truncate font-bold text-white">{post.author.name}</span>
          {post.author.verified && (
            <svg width="15" height="15" viewBox="0 0 24 24" className="shrink-0" aria-label="Verified">
              <path fill="#1d9bf0" d="M12 2l2.2 2.2 3.1-.4.6 3.1L20.7 8.5l-1.4 2.8 1.4 2.8-2.8 1.6-.6 3.1-3.1-.4L12 22l-2.2-2.6-3.1.4-.6-3.1-2.8-1.6 1.4-2.8-1.4-2.8 2.8-1.6.6-3.1 3.1.4z" />
              <path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.9-3.9 1.1 1.1z" />
            </svg>
          )}
          <span className="min-w-0 truncate text-white/55">{post.author.handle}</span>
          <span className="shrink-0 text-white/55">· {relativeTime(post.at, now)}</span>
          <svg {...ICON} width={16} height={16} className="ml-auto shrink-0 text-white/45" aria-hidden>
            <circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" />
          </svg>
        </header>

        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-[1.35] text-white">
          {post.text}
        </p>

        {post.graphic && (
          <div className="mt-2.5 overflow-hidden rounded-2xl">
            <Graphic spec={post.graphic} />
          </div>
        )}

        <footer className="mt-2 flex items-center justify-between pr-1 text-[13px] text-white/55">
          <span className="flex items-center gap-1.5">
            <svg {...ICON} aria-label="Replies"><path d="M21 11.5a8.4 8.4 0 01-8.9 8.4 9.4 9.4 0 01-4-.9L3 20l1.1-4.2A8 8 0 013 11.5 8.5 8.5 0 0112 3a8.4 8.4 0 019 8.5z" /></svg>
            {count(post.metrics.replies)}
          </span>
          <span className="flex items-center gap-1.5">
            <svg {...ICON} aria-label="Reposts"><path d="M17 2l3 3-3 3M20 5H8a3 3 0 00-3 3v3M7 22l-3-3 3-3M4 19h12a3 3 0 003-3v-3" /></svg>
            {count(post.metrics.reposts)}
          </span>
          <button
            type="button"
            onClick={like}
            disabled={!onToggleLike}
            aria-pressed={!!post.liked}
            aria-label={post.liked ? "Unlike" : "Like"}
            className="-m-1.5 flex items-center gap-1.5 rounded-full p-1.5 transition-colors enabled:hover:text-[#f91880] disabled:cursor-default"
            style={post.liked ? { color: LIKED } : undefined}
          >
            <span className="relative grid place-items-center">
              <span ref={ringRef} className="pointer-events-none absolute h-6 w-6 rounded-full opacity-0" style={{ boxShadow: `0 0 0 2px ${LIKED}` }} />
              <svg ref={heartRef} {...ICON} fill={post.liked ? LIKED : "none"} stroke={post.liked ? LIKED : "currentColor"} aria-hidden>
                <path d="M12 20s-7-4.4-8.9-8.6A4.9 4.9 0 0112 6.3a4.9 4.9 0 018.9 5.1C19 15.6 12 20 12 20z" />
              </svg>
            </span>
            <span className="tabular-nums">{count(likes)}</span>
          </button>
          <svg {...ICON} aria-hidden><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>
          <svg {...ICON} aria-hidden><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" /></svg>
        </footer>
      </div>
    </article>
  );
}
