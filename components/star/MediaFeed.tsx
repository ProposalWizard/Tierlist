"use client";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Tag } from "@/lib/star/media/types";
import { feedFor } from "@/lib/star/media/feed";
import { formatVolume } from "@/lib/star/media/trending";
import PostCard from "./media/PostCard";
import TransfersPanel from "./TransfersPanel";
import PhoneFrame from "./PhoneFrame";

/**
 * THE FEED — ON YOUR PHONE.
 *
 * Two moments, one screen. Straight out of the ground it shows the immediate
 * reaction and a Continue button; from the dashboard it shows the whole cycle
 * with filters and no way onward except back.
 *
 * It reads and never generates — everything on it was written at full time by
 * lib/star/media, and what is visible is decided by the virtual clock in
 * schedule.ts. This file only decides how it's PRESENTED, and that changed:
 * requested directly, a plain scrolling report never read as your own phone
 * the way pulling it out between matches should. PhoneFrame is the device —
 * the body, the notch, the home indicator; everything below is one app
 * running inside it, Feed and Transfers as its own two tabs the way a real
 * phone keeps two screens in one app rather than two separate apps.
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
  // Feed vs Transfers — two tabs of the one app on the phone, not two
  // separate screens. Dashboard only (mode === "browse"); the post-match
  // "moment" reaction stays exactly the single-purpose screen it already was.
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
    <div className="flex min-h-screen flex-col items-center bg-[radial-gradient(120%_80%_at_50%_-10%,#1f2937_0%,#0b0f14_55%,#05070a_100%)] px-3 py-4 text-white">
      <header className="mb-3 flex w-full max-w-sm items-center gap-2">
        {mode === "browse" && onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 font-black text-white transition hover:bg-white/20"
          >
            ←
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-base font-black uppercase tracking-wide text-white">
            {mode === "moment" ? "Full-time reaction" : "Your phone"}
          </h1>
          <p className="text-[10px] font-bold text-white/55">
            {mode === "moment"
              ? "What they made of that"
              : `Season ${career.season} · Week ${career.week}`}
          </p>
        </div>
      </header>

      {/* The device fills whatever room is left between the header above and
          the Continue button / hint line below — capped so it never grows
          into an implausibly huge phone on a tall desktop viewport. */}
      <div className="flex w-full flex-1 items-center justify-center py-1" style={{ minHeight: 0 }}>
        <div className="w-full" style={{ height: "min(76vh, 660px)" }}>
          <PhoneFrame>
            {/* App bar — the one constant across both tabs. */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-3 pb-2 pt-1">
              <AppMark />
              <span className="text-[13px] font-black tracking-tight text-white">Matchday</span>
            </div>

            {tab === "transfers" ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
                <TransfersPanel career={career} />
              </div>
            ) : (
              <>
                {trends.length > 0 && (
                  <div className="shrink-0 overflow-x-auto border-b border-white/10 px-2.5 py-2">
                    <div className="flex gap-1.5">
                      {trends.map((t, i) => (
                        <div
                          key={t.label}
                          className="flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1"
                        >
                          <span className="text-[9px] font-black text-white/50">{i + 1}</span>
                          <span className="whitespace-nowrap text-[10.5px] font-black text-white">
                            {t.label}{t.hot && " 🔥"}
                          </span>
                          <span className="text-[9px] font-bold tabular-nums text-white/50">
                            {formatVolume(t.volume)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "browse" && (
                  <div className="shrink-0 overflow-x-auto px-2.5 pb-1 pt-2">
                    <div className="flex gap-1.5">
                      {FILTERS.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide transition ${
                            filter === f.id
                              ? "bg-emerald-500 text-black"
                              : "bg-white/10 text-white/75 hover:bg-white/20"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
                  <div className="space-y-2">
                    {shown.map(p => <PostCard key={p.id} post={p} now={now} />)}
                    {shown.length === 0 && (
                      <div className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-8 text-center">
                        <div className="text-sm font-black text-white">Quiet out there.</div>
                        <p className="mt-1 text-[11px] font-bold text-white/60">
                          {posts.length === 0
                            ? "Play a match and the world will have something to say about it."
                            : "Nothing under this filter."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* In-app tab bar — Feed and Transfers, the two screens of the one
                app, the way a real phone app keeps its own sections in one
                bottom bar rather than as two separate apps. Only in "browse":
                the post-match reaction is a single-purpose read, not something
                to navigate around in. */}
            {mode === "browse" && (
              <div className="grid shrink-0 grid-cols-2 border-t border-white/10 bg-black/40 px-2 pb-1 pt-1.5">
                <TabButton active={tab === "feed"} label="Feed" onClick={() => setTab("feed")}>
                  <FeedIcon />
                </TabButton>
                <TabButton active={tab === "transfers"} label="Transfers" onClick={() => setTab("transfers")}>
                  <TransferIcon />
                </TabButton>
              </div>
            )}
          </PhoneFrame>
        </div>
      </div>

      {mode === "moment" && onContinue && (
        <button
          onClick={onContinue}
          className="mt-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-black text-white transition hover:from-emerald-500 hover:to-emerald-400"
        >
          Continue
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {mode === "browse" && (
        <p className="mt-3 max-w-sm text-center text-[10px] font-bold text-white/45">
          The rest of the week&apos;s reaction arrives as it happens.
        </p>
      )}
    </div>
  );
}

/** A small drawn app icon — a ball inside a rounded square, the same
 *  "nothing here is fetched" rule the avatars follow. */
function AppMark() {
  return (
    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#052e1a" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7l3.5 2.5-1.3 4.1H9.8L8.5 9.5z" fill="#052e1a" stroke="none" />
        <path d="M12 3v4M12 21v-4M3 12h4M21 12h-4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function TabButton({ active, label, onClick, children }: {
  active: boolean; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg py-1 transition ${
        active ? "text-white" : "text-white/45 hover:text-white/70"
      }`}
    >
      {children}
      <span className="text-[9px] font-black uppercase tracking-wide">{label}</span>
    </button>
  );
}

function FeedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4M21 6H7a4 4 0 00-4 4M7 22l-4-4 4-4M3 18h14a4 4 0 004-4" />
    </svg>
  );
}
