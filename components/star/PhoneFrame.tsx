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
}: {
  children: React.ReactNode;
  /** The status-bar clock — a fixed, recognisable time rather than a real
   *  ticking one, so the screen never has to reconcile a live clock with
   *  server-rendered markup. */
  statusLabel?: string;
}) {
  return (
    <div
      className="relative mx-auto flex h-full w-full max-w-[300px] flex-col overflow-hidden rounded-[2.6rem] border-[3px] border-[#3a3a3f] bg-[#111114] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.75),inset_0_0_0_1.5px_rgba(255,255,255,0.06)]"
      style={{
        // A hairline of graphite between the bezel and the glass — the same
        // "titanium" edge the reference photo's own frame has, not a flat
        // black slab.
        backgroundImage: "linear-gradient(155deg, #232327 0%, #131316 40%, #0a0a0c 100%)",
      }}
    >
      {/* The screen — a hair inset from the outer bezel, everything else
          (status bar, app chrome, content) lives inside this. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.3rem] bg-black">
        {/* Status bar */}
        <div className="relative z-20 flex shrink-0 items-center justify-between px-6 pb-1 pt-2.5 text-white">
          <span className="text-[11px] font-bold tabular-nums">{statusLabel}</span>
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

        {/* Home indicator */}
        <div className="pointer-events-none relative z-20 flex shrink-0 justify-center pb-1.5 pt-1">
          <div className="h-[4px] w-[108px] rounded-full bg-white/60" />
        </div>
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
