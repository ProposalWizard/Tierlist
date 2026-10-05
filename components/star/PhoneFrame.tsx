"use client";

/**
 * A PHONE, ON SCREEN.
 *
 * The Feed used to just BE the list — a heading, some filter chips, a column
 * of cards, however far down the page went. Requested directly: make it read
 * as your own phone, the way checking a social app between matches actually
 * feels, not a report the game hands you. This is the device itself — the
 * body, the screen, the notch, the home indicator — and it draws none of the
 * football itself; MediaFeed puts an app inside it the same way you'd put
 * one on a real phone.
 *
 * Deliberately just CSS, no photo — a drawn phone that never 404s, matching
 * the same "nothing here is fetched" rule the feed's own avatars already
 * follow (see media/Avatar.tsx).
 */

export default function PhoneFrame({
  children,
  statusLabel = "9:41",
  wallpaper,
  rim,
  ownHomeBar = false,
  onBack,
  backLabel = "Back",
  onHome,
}: {
  children: React.ReactNode;
  /** The screen's background (the phone home screen's club wallpaper).
   *  Plain black without it. */
  wallpaper?: React.CSSProperties;
  /** A colour the bezel is edge-lit with (your club's), like the home cards. */
  rim?: string;
  /** The status-bar clock — a fixed, recognisable time rather than a real
   *  ticking one, so the screen never has to reconcile a live clock with
   *  server-rendered markup. */
  statusLabel?: string;
  /** The content draws a working home bar (ui/Nav.tsx's HomeBar): skip the
   *  decorative one so there are not two. */
  ownHomeBar?: boolean;
  /** Draws the phone's navigation bar with a Back button on the right, like
   *  an Android phone's (Mikey, 5 Oct 2026: the old home pill in the middle
   *  "is not very noticeable"). Replaces the home indicator. */
  onBack?: () => void;
  /** What the Back button says to a screen reader (e.g. "Close phone"). */
  backLabel?: string;
  /** The nav bar's Home button: back to the phone's home screen. Absent =
   *  already there (drawn dimmed). */
  onHome?: () => void;
}) {
  return (
    <div
      className="relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-[2.6rem] border-[3px] border-[#3a3a3f] bg-[#111114] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.75),inset_0_0_0_1.5px_rgba(255,255,255,0.06)]"
      style={{
        // A hairline of graphite between the bezel and the glass — the same
        // "titanium" edge the reference photo's own frame has, not a flat
        // black slab.
        backgroundImage: "linear-gradient(155deg, #232327 0%, #131316 40%, #0a0a0c 100%)",
        ...(rim ? { boxShadow: `0 30px 70px -20px rgba(0,0,0,0.75), 0 0 34px -6px ${rim}66, inset 0 0 0 1.5px rgba(255,255,255,0.08)` } : {}),
      }}
    >
      {/* Scrollbars off, everywhere inside the phone — reported directly:
          "get rid of the scroll wheels... I don't like scroll wheels at
          all." A real phone doesn't show one either; the content still
          scrolls, this only hides the track/thumb chrome. Same pattern
          MatchCommentary.tsx's own feed already uses. */}
      <style>{`
        .kib-noscroll::-webkit-scrollbar { display: none; }
        .kib-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      {/* The screen — a hair inset from the outer bezel, everything else
          (status bar, app chrome, content) lives inside this. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.3rem] bg-black" style={wallpaper}>
        {/* Status bar */}
        <div className="relative z-20 flex shrink-0 items-center justify-between px-6 pb-1 pt-2.5 text-white">
          {/* ── Kept clear of the notch ──
              The dynamic island below is centred and 86px wide, so it starts
              at (50% − 43px). This label starts at the 24px gutter and had no
              width limit at all, so a longer one than the "9:41" this was
              built around ran straight under it — the real in-game date
              (22/08/26) was measured overlapping by about 16px, swallowing
              the year. Found by playtest.

              Capping the width structurally, rather than shortening the date,
              means no future label can reach the notch either. */}
          <span className="max-w-[calc(50%-3.5rem)] truncate text-[11px] font-bold tabular-nums">
            {statusLabel}
          </span>
          <div className="flex items-center gap-1">
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div>

        {/* The dynamic island sits over the status bar, not the app content
            below it — z-index above everything in this component, but
            MediaFeed's own header still reads fine underneath the notch's
            narrow width. */}
        <div className="pointer-events-none absolute left-1/2 top-1.5 z-30 h-[20px] w-[86px] -translate-x-1/2 rounded-full bg-black" />

        {/* App content — MediaFeed supplies everything from here down. */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {/* Navigation bar (Mikey, 5 Oct 2026): Home on the left, Back on
            the right, like an Android phone's. No box round either ("maybe
            it's not contained… just nicely placed") — a bold icon and word
            on the bar itself, sat in from the screen's curved corners. Home
            dims on the home screen, where it has nowhere to go. */}
        {onBack && (
          <div
            className="relative z-20 flex h-[52px] shrink-0 items-center justify-between border-t border-white/10 px-7 pb-1.5"
            style={{ background: "linear-gradient(180deg, rgba(17,24,39,.85), rgba(3,7,18,.95))" }}
          >
            <button
              onClick={onHome}
              disabled={!onHome}
              aria-label="Home screen"
              data-phone-home
              className="kib-press flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-white disabled:opacity-35"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" />
              </svg>
              Home
            </button>
            <button
              onClick={onBack}
              aria-label={backLabel}
              data-phone-back
              className="kib-press flex items-center gap-1.5 text-[13px] font-black uppercase tracking-wide text-white"
            >
              Back
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Home indicator */}
        {!ownHomeBar && !onBack && (
          <div className="pointer-events-none relative z-20 flex shrink-0 justify-center pb-1.5 pt-1">
            <div className="h-[4px] w-[108px] rounded-full bg-white/60" />
          </div>
        )}
      </div>

      {/* Side buttons — a thin insert on each edge, purely decorative. */}
      <div className="absolute -left-[3px] top-24 h-6 w-[3px] rounded-l bg-[#3a3a3f]" />
      <div className="absolute -left-[3px] top-32 h-10 w-[3px] rounded-l bg-[#3a3a3f]" />
      <div className="absolute -left-[3px] top-44 h-10 w-[3px] rounded-l bg-[#3a3a3f]" />
      <div className="absolute -right-[3px] top-32 h-14 w-[3px] rounded-r bg-[#3a3a3f]" />
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="0.5" />
      <rect x="4.5" y="5" width="3" height="6" rx="0.5" />
      <rect x="9" y="3" width="3" height="8" rx="0.5" />
      <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="14" height="11" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M1 4.5a10 10 0 0 1 14 0" />
      <path d="M3.8 7.3a6 6 0 0 1 8.4 0" />
      <path d="M6.6 10a2 2 0 0 1 2.8 0" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="22" height="11" viewBox="0 0 24 12" fill="none" aria-hidden>
      <rect x="0.75" y="0.75" width="19.5" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <rect x="2.25" y="2.25" width="16.5" height="7.5" rx="1.4" fill="currentColor" />
      <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
