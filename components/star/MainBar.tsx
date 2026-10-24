"use client";
import { useState } from "react";
import type { BarBadges } from "@/lib/star/needsYou";

/**
 * THE BOTTOM BAR — the same on every screen (Mikey, 22 Oct 2026, master plan 1:
 * "a requirement for me for this game's release is to have the home button as
 * one of these buttons … home button in the center … the play button on the
 * right"; and on the reply: "the home button … has some sort of home aura
 * around it … basically just move that circular play button onto the right").
 *
 *   League · Training · HOME · Phone · PLAY
 *
 * Relations and Achievements left the bar: Relationships is a Phone app,
 * Achievements a Stats tab. The dashboard shell draws it, and so does every
 * full screen (League, the Shop, Sponsors, Achievements) through page.tsx's
 * `mainBar`, so Home is always one tap away.
 */
export type NavTab = "league" | "skills" | "home" | "media" | "play" | "life";

export default function MainBar({ activeNav = null, onNavigate, onHome, atHome = false, locked, badges, mediaUnread = false }: {
  activeNav?: NavTab | null;
  onNavigate: (tab: NavTab) => void;
  /** Back to the Home swipe screen. */
  onHome: () => void;
  /** On Home already: the Home button is lit and does nothing. */
  atHome?: boolean;
  /** Unlock chain (lib/star/unlocks.ts): buttons still locked, with the line that says how to open each. */
  locked?: Partial<Record<NavTab, string>>;
  /** "Needs you" (lib/star/needsYou.ts): a count or a dot on each button. */
  badges?: BarBadges;
  /** A dot on the Phone when there is something unread. */
  mediaUnread?: boolean;
}) {
  // A locked button answers a tap with its "how to unlock" line.
  const [lockNote, setLockNote] = useState<{ label: string; hint: string; at: number } | null>(null);
  const tap = (tab: NavTab, label: string) => {
    const hint = locked?.[tab];
    if (hint) {
      const at = Date.now();
      setLockNote({ label, hint, at });
      setTimeout(() => setLockNote((n) => (n && n.at === at ? null : n)), 2600);
      return;
    }
    onNavigate(tab);
  };
  // Relationships lives in the Phone now, so its "needs you" dot shows there.
  const phoneDot = (mediaUnread || badges?.life === "dot") && !badges?.media;
  return (
    <div data-main-bar className="sk-nav relative z-30 grid grid-cols-5 items-end gap-1 px-1.5 pb-1.5 pt-1 bg-gradient-to-b from-gray-700 to-gray-800 border-t border-black/50 shadow-[0_-6px_16px_-8px_rgba(0,0,0,.7)]" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom, 0px))" }}>
      {lockNote && (
        <div className="pointer-events-none absolute inset-x-3 bottom-full mb-2 flex items-center gap-2 rounded-xl bg-gray-950/95 px-3 py-2 ring-1 ring-amber-300/40 shadow-lg">
          <span className="text-amber-300"><LockGlyph /></span>
          <span className="text-[12px] font-black text-white">{lockNote.label} is locked —</span>
          <span className="text-[12px] font-bold text-amber-300">{lockNote.hint}</span>
        </div>
      )}
      <NavBtn tour="nav-league" label="League" icon="🏆" active={activeNav === "league"} onClick={() => tap("league", "League")} lockHint={locked?.league} />
      <NavBtn tour="nav-training" label="Training" icon="⚽" active={activeNav === "skills"} onClick={() => tap("skills", "Training")} lockHint={locked?.skills} count={badges?.skills} countTone="bolt" />
      <HomeBtn atHome={atHome} onClick={onHome} />
      <NavBtn tour="nav-phone" label="Phone" icon="📱" active={activeNav === "media" || activeNav === "life"} onClick={() => tap("media", "Phone")} lockHint={locked?.media} dot={phoneDot} count={badges?.media} />
      <PlayBtn active={activeNav === "play"} onClick={() => tap("play", "Play")} locked={!!locked?.play} today={!!badges?.play} />
    </div>
  );
}

/** Home: the middle of the bar, with a warm glow around it ("some sort of home
 *  aura"). Lit while you are on Home; a tap anywhere else brings you back. */
function HomeBtn({ atHome, onClick }: { atHome: boolean; onClick: () => void }) {
  return (
    <button
      onClick={atHome ? undefined : onClick}
      data-tour="home"
      data-home-button
      aria-label={atHome ? "Home (you are here)" : "Home"}
      aria-current={atHome ? "page" : undefined}
      className="kib-press relative min-w-0 h-[50px] rounded-[4px] font-black text-[11px] min-[380px]:text-[12px] leading-tight flex flex-col items-center justify-center gap-0.5 text-white"
      style={{
        background: atHome
          ? "radial-gradient(120% 95% at 50% 40%, rgba(253,224,71,.42) 0%, rgba(245,158,11,.30) 45%, rgba(75,85,99,.95) 100%)"
          : "radial-gradient(120% 95% at 50% 40%, rgba(253,224,71,.22) 0%, rgba(245,158,11,.14) 45%, rgba(75,85,99,1) 100%)",
        boxShadow: atHome
          ? "0 0 14px 2px rgba(251,191,36,.55), inset 0 0 0 1.5px rgba(253,224,71,.85)"
          : "0 0 9px 1px rgba(251,191,36,.30), inset 0 0 0 1px rgba(253,224,71,.45)",
      }}
    >
      <span className="text-[18px] leading-none" style={{ filter: "drop-shadow(0 0 4px rgba(253,224,71,.8))" }}>🏠</span>
      <span>Home</span>
    </button>
  );
}

function LockGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="currentColor" fillOpacity=".25" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function NavBtn({ label, icon, active, onClick, dot, lockHint, tight, tour, count, countTone = "red" }: { tour?: string; label: string; icon: string; active: boolean; onClick: () => void; dot?: boolean; lockHint?: string; /** A long label ("Achievements") set smaller so it is not cut off. */ tight?: boolean; /** "Needs you": a number on the button (unread, sessions left). */ count?: number; /** Red for unread; amber with a bolt for sessions left. */ countTone?: "red" | "bolt" }) {
  if (lockHint) return (
    <button
      onClick={onClick}
      data-tour={tour}
      aria-label={`${label} — locked: ${lockHint}`}
      className="kib-press relative min-w-0 h-[50px] rounded-[4px] font-black text-[11px] min-[380px]:text-[12px] leading-tight flex flex-col items-center justify-center gap-0.5 bg-gray-800 text-gray-400"
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}
    >
      <span className="text-[18px] leading-none opacity-30 grayscale">{icon}</span>
      <span className="max-w-full truncate opacity-60">{label}</span>
      <span className="absolute right-1.5 top-1.5 text-gray-300"><LockGlyph size={12} /></span>
    </button>
  );
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      className={`kib-press relative min-w-0 h-[50px] rounded-[4px] font-black text-[11px] min-[380px]:text-[12px] leading-tight flex flex-col items-center justify-center gap-0.5 ${
        active
          ? "bg-gradient-to-b from-gray-400/70 to-gray-500/70 text-white shadow-inner"
          : "bg-gradient-to-b from-gray-600 to-gray-700 text-gray-100 hover:from-gray-500"
      }`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), 0 2px 4px rgba(0,0,0,.35)" }}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      <span className={`max-w-full truncate ${tight ? "!text-[9px] min-[380px]:!text-[9.5px] tracking-[-0.03em]" : ""}`}>{label}</span>
      {active && <span className="absolute bottom-1 h-[3px] w-5 rounded-full bg-emerald-400" />}
      {dot && <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-700" />}
      {count !== undefined && count > 0 && (
        <span
          data-nav-badge={count}
          aria-label={`${count} waiting`}
          className={`absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-black leading-none tabular-nums ring-2 ring-gray-700 ${countTone === "bolt" ? "bg-amber-400 text-gray-950" : "bg-red-500 text-white"}`}
        >
          {countTone === "bolt" && <span className="-ml-0.5 mr-px text-[9px]">⚡</span>}{count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/** The centre button: bigger than the rest, raised above the bar, green, and
 *  breathing slowly so the eye goes to it. */
function PlayBtn({ active, onClick, locked = false, today = false }: { active: boolean; onClick: () => void; locked?: boolean; /** "Needs you": a match today, so the pulse is quicker and a ring shows. */ today?: boolean }) {
  if (locked) return (
    <div className="relative flex justify-center">
      <button
        onClick={onClick}
        data-tour="nav-play"
        aria-label="Play — locked"
        className="kib-press -mt-5 flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full border-[3px] border-gray-800 bg-gray-700 font-black text-gray-300"
      >
        <LockGlyph size={22} />
        <span className="text-[11px] uppercase tracking-wider leading-none">Play</span>
      </button>
    </div>
  );
  return (
    <div className="relative flex justify-center">
      <button
        onClick={onClick}
        data-tour="nav-play"
        aria-label="Play"
        data-match-today={today ? "" : undefined}
        className={`kib-press kib-play-pulse -mt-5 flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full border-[3px] font-black text-white ${
          active ? "border-white/80" : today ? "border-amber-300" : "border-gray-800"
        }`}
        style={{ background: "radial-gradient(circle at 35% 28%, #6ee7b7 0%, #10b981 45%, #047857 100%)", ...(today ? { animationDuration: "1.2s" } : {}) }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" className="ml-0.5 drop-shadow"><path d="M7 4.5v15l13-7.5z" fill="#fff" /></svg>
        <span className="text-[11px] uppercase tracking-wider leading-none">Play</span>
      </button>
    </div>
  );
}
