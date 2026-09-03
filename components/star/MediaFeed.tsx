"use client";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Tag, Trend } from "@/lib/star/media/types";
import { feedFor } from "@/lib/star/media/feed";
import { formatVolume } from "@/lib/star/media/trending";
import { divisionOf, fixtureDate, formatDateNumeric } from "@/lib/star/calendar";
import PostCard from "./media/PostCard";
import TransfersPanel from "./TransfersPanel";
import PhoneFrame from "./PhoneFrame";

/**
 * THE FEED — ON YOUR PHONE.
 *
 * Two moments, one screen. Straight out of the ground it shows the immediate
 * reaction and a Continue button; reached from the bottom nav it IS the
 * screen — full-bleed inside DashboardShell (see its own `fullBleed` prop),
 * no header of its own, because the bottom nav is already right there to
 * leave by. Requested directly, after the phone shipped a size too small:
 * "the whole screen should be the phone" — the back button and the "Your
 * phone / Season X · Week Y" header this used to carry were exactly the
 * room it needed.
 *
 * It reads and never generates — everything on it was written at full time by
 * lib/star/media, and what is visible is decided by the virtual clock in
 * schedule.ts. This file only decides how it's PRESENTED.
 */

/**
 * A real phone's own proportions (roughly a modern iPhone: 390×844) — used
 * to LOCK the shape of whatever box the phone renders inside, rather than
 * letting it fill whatever rectangle its container happens to be.
 *
 * Reported directly: on a real phone it usually looks right, but the exact
 * same screen would come out either stretched tall or squashed wide
 * depending on browser zoom or window size. Root cause was that neither
 * place PhoneFrame gets sized actually constrained BOTH dimensions
 * together — browse mode was plain `h-full w-full` (no ratio at all, just
 * whatever shape DashboardShell's body box happened to be that moment);
 * the standalone post-match screen set width from the column's own width
 * and height from `min(80vh, 780px)` — two totally independent formulas,
 * so they only ever agreed by coincidence at one particular window size.
 * `aspect-ratio` plus a height AND a max-width together is what actually
 * produces a real "shrink to fit, preserve the phone's own shape" box —
 * CSS resolves the un-set dimension from the ratio and still respects
 * whichever constraint (the height or the max-width) is tighter.
 */
const PHONE_ASPECT = "390 / 844";

interface Props {
  career: CareerState;
  /** Post-match: the first wave, then a Continue, its own full standalone
   *  screen. From the bottom nav: everything, full-bleed inside
   *  DashboardShell — no header, no Continue, the bottom nav is the way out. */
  mode: "moment" | "browse";
  onContinue?: () => void;
}

const FILTERS: { id: string; label: string; tags?: Tag[] }[] = [
  { id: "all", label: "All" },
  { id: "news", label: "News", tags: ["drama", "transfer", "manager", "trophy", "relegation", "title"] },
  { id: "stats", label: "Stats", tags: ["stat", "record", "streak", "milestone"] },
  { id: "fans", label: "Fans", tags: ["derby", "shame", "goal", "opinion"] },
];

export default function MediaFeed({ career, mode, onContinue }: Props) {
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

  // The status bar's own clock, reading real — "22/08/26", not a fixed
  // "9:41" — the Saturday of whatever week the career is on, its own week
  // granularity being the finest date this game tracks.
  const dateLabel = formatDateNumeric(
    fixtureDate(career.player.startYear, career.season, career.week, "saturday", divisionOf(career)),
  );

  const phone = (
    <PhoneFrame statusLabel={dateLabel}>
      {/* App bar — the one constant across both tabs. Reads "Post Match
          Reactions" for the standalone full-time screen (mode === "moment")
          instead of the ordinary "Matchday" — requested directly, once the
          screen's OWN header above the phone (see below) was removed: the
          phone itself is now the only place left to say what this moment
          actually is. */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-3 pb-2 pt-1">
        <AppMark />
        <span className="text-[13px] font-black tracking-tight text-white">
          {mode === "moment" ? "Post Match Reactions" : "Matchday"}
        </span>
      </div>

      {tab === "transfers" ? (
        <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
          <TransfersPanel career={career} />
        </div>
      ) : (
        <>
          {trends.length > 0 && <TrendTicker trends={trends} />}

          {mode === "browse" && (
            <div className="kib-noscroll shrink-0 overflow-x-auto px-2.5 pb-1 pt-2">
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

          <div className="kib-noscroll min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
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
              {/* The end of the list — without it there is nothing to tell
                  a reader they have actually reached the bottom rather than
                  a feed that just stopped loading. */}
              {shown.length > 0 && (
                <div className="py-6 text-center">
                  <div className="text-[13px] font-black text-white/70">You&apos;re all caught up.</div>
                  <div className="mt-0.5 text-[11px] font-bold text-white/40">Touch grass.</div>
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
  );

  // Reached from the bottom nav: full-bleed inside DashboardShell already —
  // just fill whatever room it gave us, no screen of our own to build. No
  // background of its own any more, either: reported directly, the dark
  // gradient this used to sit on read as its own box around the phone,
  // wanted only around the bottom nav below it. DashboardShell's own body
  // (a plain grey gradient) shows straight through instead — "I liked it
  // how it was before where it was only the phone there."
  if (mode === "browse") {
    return (
      <div className="flex h-full w-full items-center justify-center p-2">
        <div className="h-full" style={{ aspectRatio: PHONE_ASPECT, maxWidth: "min(28rem, 100%)" }}>{phone}</div>
      </div>
    );
  }

  // Straight out of the ground: its own standalone screen, same as it
  // always was — a real moment with a Continue, not a place to navigate
  // around in.
  return (
    <div className="flex min-h-screen flex-col items-center bg-[radial-gradient(120%_80%_at_50%_-10%,#1f2937_0%,#0b0f14_55%,#05070a_100%)] px-3 py-4 text-white">
      {/* No header of its own any more — reported directly: the phone's own
          app bar now says "Post Match Reactions" (see `phone` above),
          which was exactly what this "Full-time reaction / What they made
          of that" header used to say a second time above it. */}
      <div className="flex w-full flex-1 items-center justify-center py-1" style={{ minHeight: 0 }}>
        <div className="h-full" style={{ aspectRatio: PHONE_ASPECT, maxHeight: 780, maxWidth: "min(28rem, 100%)" }}>{phone}</div>
      </div>

      {onContinue && (
        <button
          onClick={onContinue}
          className="mt-4 flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-black text-white transition hover:from-emerald-500 hover:to-emerald-400"
        >
          Continue
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

/**
 * A ticker, not a shelf — the row used to be a horizontal scroller a reader
 * had to drag through by hand. Requested directly: a continuous roll,
 * left, that never cuts back to its own start the way a "1 to 10, then
 * snap back to 1" loop would.
 *
 * The trick is duplicating the row once and animating exactly to -50%: the
 * tail of the second copy lands pixel-for-pixel on the head of the first,
 * so the reset is invisible and the count keeps climbing past the nominal
 * length (11 really is the next tag after 10, reading as the SAME tag
 * again rather than a jump) — the "revolving door" asked for.
 */
function TrendTicker({ trends }: { trends: Trend[] }) {
  const loop = [...trends, ...trends];
  // Roughly constant on-screen speed regardless of how many tags there are
  // — more tags means more width to cover, so the duration scales with
  // count rather than staying fixed and speeding up on a busy day.
  const seconds = Math.max(14, trends.length * 4.5);
  return (
    <div className="shrink-0 overflow-hidden border-b border-white/10 py-2">
      <style>{`
        @keyframes kibTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .kib-ticker { animation: kibTicker ${seconds}s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .kib-ticker { animation: none; } }
      `}</style>
      <div className="kib-ticker flex w-max gap-1.5 px-2.5">
        {loop.map((t, i) => (
          <div
            key={`${t.label}-${i}`}
            className="flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1"
          >
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
