"use client";
import { useRef } from "react";
import type { PostReply, QuotedPost, StoredPost } from "@/lib/star/media/types";
import { relativeTime } from "@/lib/star/media/schedule";
import Graphic from "./Graphics";
import Avatar from "./Avatar";
import GoalOfMonthPoll from "./GoalOfMonthPoll";

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

/** Tick colours (Football Twitter): blue paid, gold organisations, grey officials. */
const TICK = { blue: "#1d9bf0", gold: "#e2b719", grey: "#829aab" } as const;

function Tick({ tick, size = 15 }: { tick?: keyof typeof TICK; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0" aria-label="Verified">
      <path fill={TICK[tick ?? "blue"]} d="M12 2l2.2 2.2 3.1-.4.6 3.1L20.7 8.5l-1.4 2.8 1.4 2.8-2.8 1.6-.6 3.1-3.1-.4L12 22l-2.2-2.6-3.1.4-.6-3.1-2.8-1.6 1.4-2.8-1.4-2.8 2.8-1.6.6-3.1 3.1.4z" />
      <path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.9-3.9 1.1 1.1z" />
    </svg>
  );
}

/** A quoted post, boxed inside the one quoting it (Football Twitter). */
function Quote({ q }: { q: QuotedPost }) {
  return (
    <div className="mt-2 rounded-2xl border border-white/15 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[13px] leading-5">
        <Avatar initials={q.initials} tint={q.tint} tint2={q.tint2} glyph={q.glyph} size={18} />
        <span className="truncate font-bold text-white">{q.name}</span>
        {q.verified && <Tick tick={q.tick} size={13} />}
        <span className="min-w-0 truncate text-white/55">{q.handle}</span>
      </div>
      <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-[1.3] text-white/90 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">{q.text}</p>
      {/* The quoted video itself, playable (Leo: no talk of a video you can't
          watch). An older quote with only a play icon shows no icon at all. */}
      {q.graphic && (
        <div className="mt-2 overflow-hidden rounded-xl" data-quote-video>
          <Graphic spec={q.graphic} author={{ handle: q.handle, name: q.name, archetype: "aggregator", platform: "x" }} />
        </div>
      )}
    </div>
  );
}

/** The top replies, under the post (Football Twitter). */
function Replies({ thread }: { thread: PostReply[] }) {
  return (
    <div className="mt-2 space-y-2 border-l-2 border-white/10 pl-3">
      {thread.map((r, i) => (
        <div key={i} className="flex gap-2">
          <Avatar initials={r.initials} tint={r.tint} tint2={r.tint2} glyph={r.glyph} size={22} />
          <div className="min-w-0 flex-1 text-[13px] leading-[1.3]">
            <span className="flex items-center gap-1">
              <span className="truncate font-bold text-white">{r.name}</span>
              {r.verified && <Tick tick={r.tick} size={12} />}
              <span className="min-w-0 truncate text-white/55">{r.handle}</span>
            </span>
            <p className="break-words text-white/90">{r.text}</p>
          </div>
          <span className="shrink-0 self-start text-[12px] text-white/55">♥ {count(r.likes)}</span>
        </div>
      ))}
    </div>
  );
}

/** A TikTok post's words: hashtags in the app's pale blue. */
function TikTokText({ text }: { text: string }) {
  const parts = text.split(/(#[A-Za-z0-9_]+)/g);
  return <>{parts.map((t, i) => (t.startsWith("#") ? <span key={i} className="font-semibold text-[#8ab4ff]">{t}</span> : <span key={i}>{t}</span>))}</>;
}

/** The sound under a TikTok video: a spinning record and "♫ original sound – …". */
function SoundLine({ sound }: { sound: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[13px] text-white/85" data-tiktok-sound>
      <span className="grid h-6 w-6 shrink-0 animate-[spin_4s_linear_infinite] place-items-center rounded-full bg-gradient-to-br from-neutral-700 to-black ring-2 ring-neutral-600">
        <span className="h-2 w-2 rounded-full bg-[#fe2c55]" />
      </span>
      <span className="min-w-0 truncate">♫ {sound}</span>
    </div>
  );
}

/** TikTok's own counts under its post: likes, comments, saves, shares. */
function TikTokCounts({ post, liked, onLike }: { post: StoredPost; liked: boolean; onLike?: () => void }) {
  const m = post.metrics;
  const item = (icon: React.ReactNode, n: number, label: string) => (
    <span className="flex items-center gap-1.5" aria-label={label}>{icon}<span className="tabular-nums font-semibold text-white/80">{count(n)}</span></span>
  );
  return (
    <footer className="mt-2 flex items-center gap-5 pr-1 text-[13px] text-white/60" data-tiktok-counts>
      <button type="button" onClick={onLike} disabled={!onLike} className="flex items-center gap-1.5 disabled:cursor-default" aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill={liked ? "#fe2c55" : "#fff"} d="M12 21s-7.5-4.6-9.6-9A5.4 5.4 0 0112 5.6 5.4 5.4 0 0121.6 12c-2.1 4.4-9.6 9-9.6 9z" /></svg>
        <span className="tabular-nums font-semibold text-white/80">{count(m.likes + (liked ? 1 : 0))}</span>
      </button>
      {item(<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L5 22l4.3-2.2c.9.2 1.8.3 2.7.3 5.5 0 10-3.9 10-8.7S17.5 3 12 3z" /></svg>, m.replies, "Comments")}
      {item(<svg width="16" height="18" viewBox="0 0 20 24" aria-hidden><path fill="#fff" d="M3 2h14a1 1 0 011 1v19l-8-5-8 5V3a1 1 0 011-1z" /></svg>, m.reposts, "Saves")}
      {item(<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#fff" d="M14 4l8 7.5-8 7.5v-4.5C8 14.5 5 16.5 2 20c1-6 4-10.5 12-11.5z" /></svg>, m.quotes ?? Math.round(m.reposts / 3), "Shares")}
      {m.views !== undefined && <span className="ml-auto tabular-nums text-white/50">{count(m.views)} views</span>}
    </footer>
  );
}

/** The pink a liked heart turns — the same one real social apps use. */
const LIKED = "#f91880";

export default function PostCard({ post, now, onToggleLike, onVote }: {
  post: StoredPost;
  now: number;
  /** Tapping the heart. Absent: the heart is just a number, not a button. */
  onToggleLike?: (postId: string) => void;
  /** Voting in a Goal of the Month poll (entry index). Absent: no Vote buttons. */
  onVote?: (postId: string, index: number) => void;
}) {
  const heartRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const likes = post.metrics.likes + (post.liked ? 1 : 0);
  // Football Twitter v2: a TikTok post (it carries its sound) looks like TikTok.
  const tiktok = post.author.platform === "tiktok" && !!post.sound;

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
    <article className="flex gap-3 border-b border-white/10 px-3.5 pb-2.5 pt-3" data-post-event={post.eventId} {...(tiktok ? { "data-tiktok": "" } : {})}>
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
          {post.author.verified && <Tick tick={post.author.tick} />}
          <span className="min-w-0 truncate text-white/55">{post.author.handle}</span>
          <span className="shrink-0 text-white/55">· {relativeTime(post.at, now)}</span>
          <svg {...ICON} width={16} height={16} className="ml-auto shrink-0 text-white/45" aria-hidden>
            <circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" />
          </svg>
        </header>

        <p className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-[1.35] text-white">
          {tiktok ? <TikTokText text={post.text} /> : post.text}
        </p>
        {post.quote && <Quote q={post.quote} />}

        {post.graphic?.type === "gotmPoll" ? (
          <div className="mt-2.5">
            <GoalOfMonthPoll
              spec={post.graphic}
              author={post.author}
              onVote={onVote ? (i: number) => onVote(post.id, i) : undefined}
            />
          </div>
        ) : post.graphic && !(post.graphic.type === "thumbnail" && !post.graphic.clips?.length && !post.graphic.synth?.length) && (
          <div className="mt-2.5 overflow-hidden rounded-2xl">
            <Graphic spec={post.graphic} author={post.author} />
          </div>
        )}

        {tiktok && post.sound && <SoundLine sound={post.sound} />}
        {tiktok ? <TikTokCounts post={post} liked={!!post.liked} onLike={onToggleLike ? like : undefined} /> : (
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
          <span className="flex items-center gap-1.5">
            <svg {...ICON} aria-label="Views"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9" /></svg>
            {post.metrics.views !== undefined && <span className="tabular-nums">{count(post.metrics.views)}</span>}
          </span>
          <svg {...ICON} aria-hidden><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" /></svg>
        </footer>
        )}
        {!!post.thread?.length && <Replies thread={post.thread} />}
      </div>
    </article>
  );
}
