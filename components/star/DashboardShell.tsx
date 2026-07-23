"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";

interface Props {
  career: CareerState;
  onExit: () => void;
  children: React.ReactNode;
  onNavigate: (tab: "league" | "skills" | "life" | "play") => void;
  activeNav?: "league" | "skills" | "life" | "play" | null;
  nextMatchLabel?: string;
}

export default function DashboardShell({ career, onExit, children, onNavigate, activeNav = null, nextMatchLabel }: Props) {
  const fullName = `${career.player.firstName} ${career.player.lastName}`;
  const energyPct = Math.max(0, Math.min(100, career.energy));

  // The site's GlobalNav sits above this shell. Measure the shell's own document
  // position and fill exactly the rest of the viewport, so the bottom nav bar is
  // always on screen (no page scroll — only the middle content area scrolls).
  // Measuring ourselves (not the nav) avoids grabbing the wrong element — the
  // page contains a second, viewport-tall <nav> inside the sidebar drawer.
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellH, setShellH] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return;
      const docTop = rect.top + window.scrollY;
      setShellH(Math.max(400, window.innerHeight - docTop));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={shellRef}
      className="bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col overflow-hidden"
      style={{ height: shellH !== null ? `${shellH}px` : "calc(100dvh - 64px)" }}
    >
      <div className="flex-1 min-h-0 flex flex-col max-w-md w-full mx-auto">
        {/* Top header */}
        <div className="bg-gradient-to-b from-gray-700 to-gray-800 border-b border-black/50 px-3 py-2 flex items-center justify-between shadow-md">
          <button onClick={onExit} className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-lg">✕</button>
          <div className="flex-1 mx-3 text-center bg-white/10 rounded-full py-1 text-white font-black text-sm truncate border border-white/20">
            {fullName}
          </div>
          <button className="w-8 h-8 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-black text-lg">?</button>
        </div>

        {/* Star + Energy bars */}
        <div className="grid grid-cols-2 gap-2 px-3 pt-2">
          <div className="flex items-center gap-2 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-lg px-2 py-1.5 shadow border border-yellow-400">
            <StarIcon />
            <span className="text-white font-black text-sm">Star Rating</span>
            <span className="ml-auto text-white font-black text-sm">{career.starRating.toFixed(1)}</span>
          </div>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500" style={{ width: `${energyPct}%` }} />
            <div className="relative flex items-center gap-1 px-2 py-1.5">
              <HeartIcon />
              <span className="text-white font-black text-sm">Energy</span>
              <span className="ml-auto text-white font-black text-sm">{Math.round(energyPct)}</span>
            </div>
          </div>
        </div>

        {/* Age / Cash strip */}
        <div className="flex items-center px-3 pt-2 gap-2">
          <div className="bg-gray-700 rounded-lg px-3 py-1 text-xs font-black text-white border border-gray-600">
            Age {career.player.age}
          </div>
          <div className="flex-1 text-center text-[10px] font-black text-gray-400 tracking-widest">
            {career.player.club.toUpperCase()}
          </div>
          <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-3 py-1 text-xs font-black text-yellow-300 border border-gray-600">
            <StarIcon small />
            {career.money}
          </div>
        </div>

        {/* Body — the only scrollable region; header + bottom nav stay fixed */}
        <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto">
          {children}
        </div>

        {/* Next match banner */}
        {nextMatchLabel && (
          <div className="mx-3 mb-1 bg-gradient-to-r from-gray-700 to-gray-600 border border-gray-500 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <div className="text-[10px] font-black text-gray-300">Year {career.season}</div>
            <div className="text-xs font-black text-white truncate mx-2">{nextMatchLabel}</div>
            <div className="text-[10px] font-black text-gray-300">Week {career.week}</div>
          </div>
        )}

        {/* Bottom nav */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-gradient-to-b from-gray-700 to-gray-800 border-t border-black/50">
          <NavBtn label="League" icon="🏆" active={activeNav === "league"} onClick={() => onNavigate("league")} />
          <NavBtn label="Skills" icon="⚽" active={activeNav === "skills"} onClick={() => onNavigate("skills")} />
          <NavBtn label="Life" icon="👥" active={activeNav === "life"} onClick={() => onNavigate("life")} />
          <NavBtn label="Play" icon="▶" active={activeNav === "play"} onClick={() => onNavigate("play")} highlight />
        </div>
      </div>
    </div>
  );
}

function NavBtn({ label, icon, active, onClick, highlight }: { label: string; icon: string; active: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 rounded-lg font-black text-xs flex flex-col items-center gap-0.5 transition ${
        highlight
          ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-900/50"
          : active
          ? "bg-gray-500 text-white"
          : "bg-gray-600 text-gray-200 hover:bg-gray-500"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StarIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626">
      <path d="M12 21s-7-4.5-9.5-9.5C.5 7 4 3 8 3c2 0 3.5 1 4 2 .5-1 2-2 4-2 4 0 7.5 4 5.5 8.5C19 16.5 12 21 12 21z" />
    </svg>
  );
}
