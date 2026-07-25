"use client";
import Link from "next/link";
import {
  TrophyIcon, StarBadgeIcon, ChevronIcon, LockIcon,
  HISTORY_ICON_SRC, HOF_ICON_SRC,
} from "./TrophyIcons";

// The History / Hall of Fame pair that sits under the hero on the draft setup
// screen. Lives in its own component because /draft and /draft-dev2 both render
// it and they must not drift apart.

type Accent = "emerald" | "amber";

// Tailwind only emits classes it can see written out in full, so these are
// spelled literally rather than built with `bg-${accent}-500`.
const ACCENT = {
  emerald: {
    border: "border-emerald-500/45",
    hoverBorder: "hover:border-emerald-400/70",
    surface: "bg-[linear-gradient(135deg,#052e22_0%,#06211b_45%,#0a0f14_100%)]",
    shadow: "shadow-[0_2px_14px_-4px_rgba(16,185,129,0.45)]",
    glow: "bg-emerald-400/25",
    chevron: "border-emerald-400/45 text-emerald-300 group-hover:border-emerald-300 group-hover:text-emerald-100",
  },
  amber: {
    border: "border-amber-500/45",
    hoverBorder: "hover:border-amber-400/70",
    surface: "bg-[linear-gradient(135deg,#3a2408_0%,#241705_45%,#0d0b08_100%)]",
    shadow: "shadow-[0_2px_14px_-4px_rgba(245,158,11,0.45)]",
    glow: "bg-amber-400/25",
    chevron: "border-amber-400/45 text-amber-300 group-hover:border-amber-300 group-hover:text-amber-100",
  },
} as const;

const LOCKED = {
  border: "border-gray-700/60",
  hoverBorder: "hover:border-gray-600/70",
  surface: "bg-[linear-gradient(135deg,#151a21_0%,#11151b_45%,#0b0e12_100%)]",
  shadow: "shadow-none",
  glow: "bg-gray-500/10",
  chevron: "border-gray-600 text-gray-500",
} as const;

function NavCard({
  href, title, accent, locked, iconSrc, children,
}: {
  href: string;
  title: React.ReactNode;
  accent: Accent;
  locked: boolean;
  iconSrc: string | null;
  children: React.ReactNode; // the fallback SVG icon
}) {
  const c = locked ? LOCKED : ACCENT[accent];
  return (
    <Link
      href={href}
      className={`group relative flex-1 min-w-0 flex items-center gap-2 rounded-xl border p-2 overflow-hidden transition-all duration-200 hover:scale-[1.015] active:scale-[0.985] ${c.border} ${c.hoverBorder} ${c.surface} ${c.shadow}`}
    >
      {/* Diagonal light streaks, echoing the sheen on the reference artwork. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(114deg, transparent 30%, rgba(255,255,255,0.055) 44%, transparent 52%, transparent 66%, rgba(255,255,255,0.03) 74%, transparent 82%)",
        }}
      />
      {/* Hairline top edge — reads as a lit bevel. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

      {/* Icon, sitting on a soft radial glow rather than a flat chip. */}
      <div className="relative shrink-0 grid place-items-center w-[38px] h-[38px]">
        {!locked && <div className={`absolute inset-1 rounded-full blur-[9px] ${c.glow}`} />}
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconSrc}
            alt=""
            aria-hidden="true"
            className={`relative w-[38px] h-[38px] object-contain ${locked ? "opacity-40 grayscale" : ""}`}
          />
        ) : (
          <div className={`relative w-[38px] h-[38px] ${locked ? "opacity-45 grayscale" : ""}`}>{children}</div>
        )}
        {locked && (
          <div className="absolute -bottom-0.5 -right-0.5 grid place-items-center w-[15px] h-[15px] rounded-full bg-gray-950 border border-gray-600 text-gray-300">
            <LockIcon className="w-2 h-2" />
          </div>
        )}
      </div>

      <div className="relative flex-1 min-w-0">
        <div
          className={`font-black uppercase leading-[1.12] tracking-tight text-[10.5px] sm:text-[11.5px] ${
            locked ? "text-gray-500" : "text-white"
          }`}
        >
          {title}
        </div>
      </div>

      <div
        className={`relative shrink-0 grid place-items-center w-5 h-5 rounded-full border transition-colors ${c.chevron}`}
      >
        <ChevronIcon className="w-2.5 h-2.5" />
      </div>
    </Link>
  );
}

export default function DraftNavCards({ isSignedIn }: { isSignedIn: boolean | null }) {
  const locked = isSignedIn === false;
  return (
    <div className="flex gap-2 mt-4">
      <NavCard
        href={locked ? "/auth?next=/draft/history" : "/draft/history"}
        title={<>History &amp;<br />Achievements</>}
        accent="emerald"
        locked={locked}
        iconSrc={HISTORY_ICON_SRC}
      >
        <TrophyIcon className="w-full h-full" />
      </NavCard>

      <NavCard
        href={locked ? "/auth?next=/draft/records" : "/draft/records"}
        title={<>Hall of<br />Fame</>}
        accent="amber"
        locked={locked}
        iconSrc={HOF_ICON_SRC}
      >
        <StarBadgeIcon className="w-full h-full" />
      </NavCard>
    </div>
  );
}
