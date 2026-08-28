"use client";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Tag } from "@/lib/star/media/types";
import { feedFor } from "@/lib/star/media/feed";
import { formatVolume } from "@/lib/star/media/trending";
import PostCard from "./media/PostCard";
import TransfersPanel from "./TransfersPanel";

/**
 * THE FEED
 *
 * Two moments, one screen. Straight out of the ground it shows the immediate
 * reaction and a Continue button; from the dashboard it shows the whole cycle
 * with filters and no way onward except back.
 *
 * It reads and never generates — everything on it was written at full time by
 * lib/star/media, and what is visible is decided by the virtual clock in
 * schedule.ts.
 */

interface Props {
  career: CareerState;
  /** Post-match: the first wave, then a Continue. Dashboard: everything. */
  mode: "moment" | "browse";
  onContinue?: () => void;
  onBack?: () => void;
}

const FILTERS: { id: string; label: string; tags?: Tag[] }[] = [
  { id: "all", label: "All" },
  { id: "news", label: "News", tags: ["drama", "transfer", "manager", "trophy", "relegation", "title"] },
  { id: "stats", label: "Stats", tags: ["stat", "record", "streak", "milestone"] },
  { id: "fans", label: "Fans", tags: ["derby", "shame", "goal", "opinion"] },
];

export default function MediaFeed({ career, mode, onContinue, onBack }: Props) {
  const [filter, setFilter] = useState("all");
  // Feed vs Transfers — a real top-level view, not another filter, since
  // transfers are a different KIND of thing than a post. Dashboard only
  // (mode === "browse"); the post-match "moment" reaction stays exactly the
  // single-purpose screen it already was.
  const [tab, setTab] = useState<"feed" | "transfers">("feed");

  const { posts, trends, now } = useMemo(
    () => feedFor(career, mode === "moment" ? "moment" : "settled"),
    [career, mode],
  );

  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter);
    if (!f?.tags) return posts;
    // A fan filter that hides the fans would be a strange filter, so archetype
    // counts as well as subject matter.
    const social = new Set(["fan", "rivalFan", "teammate", "meme"]);
    return posts.filter(p =>
      p.tags.some(t => f.tags!.includes(t))
      || (f.id === "fans" && social.has(p.author.archetype))
      || (f.id === "stats" && p.author.archetype === "stats"));
  }, [posts, filter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 px-3 py-4 text-white">
      <div className="mx-auto w-full max-w-sm">
        <header className="mb-3 flex items-center gap-2">
          {mode === "browse" && onBack && (
            <button
              onClick={onBack}
              aria-label="Back"
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 font-black text-white transition hover:bg-white/20"
            >
              ←
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-black uppercase tracking-wide text-white">
              {mode === "moment" ? "Full-time reaction" : "The Feed"}
            </h1>
            <p className="text-[10px] font-bold text-white/70">
              {mode === "moment"
                ? "What they made of that"
                : `Season ${career.season} · Week ${career.week} · the last month`}
            </p>
          </div>
        </header>

        {mode === "browse" && (
          <nav className="mb-3 flex gap-1.5">
            {(["feed", "transfers"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                  tab === t
                    ? "bg-amber-500 text-black"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                {t === "feed" ? "Feed" : "Transfers"}
              </button>
            ))}
          </nav>
        )}

        {tab === "transfers" ? (
          <TransfersPanel career={career} />
        ) : (
          <>
            {trends.length > 0 && (
              <section className="mb-3 rounded-xl border border-white/12 bg-gray-800/80 p-3">
                <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/70">
                  Trending in football
                </div>
                <ul className="space-y-1">
                  {trends.map((t, i) => (
                    <li key={t.label} className="flex items-baseline gap-2">
                      <span className="w-3 text-[10px] font-black text-white/60">{i + 1}</span>
                      <span className="flex-1 truncate text-[12px] font-black text-white">
                        {t.label}{t.hot && <span className="ml-1">🔥</span>}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums text-white/70">
                        {formatVolume(t.volume)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {mode === "browse" && (
              <nav className="mb-3 flex gap-1.5">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                      filter === f.id
                        ? "bg-emerald-600 text-white"
                        : "bg-white/10 text-white/80 hover:bg-white/20"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </nav>
            )}

            <div className="space-y-2.5">
              {shown.map(p => <PostCard key={p.id} post={p} now={now} />)}
              {shown.length === 0 && (
                <div className="rounded-xl border border-white/12 bg-gray-800/80 px-3 py-8 text-center">
                  <div className="text-sm font-black text-white">Quiet out there.</div>
                  <p className="mt-1 text-[11px] font-bold text-white/70">
                    {posts.length === 0
                      ? "Play a match and the world will have something to say about it."
                      : "Nothing under this filter."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {mode === "moment" && onContinue && (
          <button
            onClick={onContinue}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-black text-white transition hover:from-emerald-500 hover:to-emerald-400"
          >
            Continue
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {mode === "browse" && (
          <p className="mt-4 text-center text-[10px] font-bold text-white/60">
            The rest of the week&apos;s reaction arrives as it happens.
          </p>
        )}
      </div>
    </div>
  );
}
