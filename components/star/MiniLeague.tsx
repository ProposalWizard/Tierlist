"use client";

/**
 * THE MINI LEAGUE TABLE — your position and the clubs either side of you,
 * under Next Match on Home (Harry, 1 Oct 2026, P96: "that UI is pretty cool.
 * We could just have that on the home screen, even underneath, like the next
 * game"). The Stats screen's league card look, but flat: no floating card,
 * it fades into the page. The whole thing opens the League screen.
 */
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import ClubBadge from "./ClubBadge";
import { useState } from "react";
import { FlatPanel, rgba, tint, useCountUp } from "./ui";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const ordinal = (n: number) => (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");

export const MINI_LEAGUE_ROW = 16;
/** Height of the panel for `rows` rows, so Home can budget for it. */
export const miniLeagueHeight = (rows: number) => 16 + rows * MINI_LEAGUE_ROW + 4;

export default function MiniLeague({ career, glow, rows = 5, onOpen }: { career: CareerState; glow: string; rows?: number; onOpen?: () => void }) {
  const table = sortLeague(career.league);
  const me = table.findIndex((t) => t.name === career.player.club);
  const pos = useCountUp(me + 1, 700);
  if (me < 0) return null;
  const n = Math.min(rows, table.length);
  const from = Math.max(0, Math.min(me - Math.floor(n / 2), table.length - n));
  const slice = table.slice(from, from + n);
  return (
    <FlatPanel
      fade="both"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? "Open the league table" : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      className={`px-3 py-[2px] ${onOpen ? "kib-press cursor-pointer" : ""}`}
    >
      <div className="flex h-[16px] items-center justify-between">
        <span className="text-[11px] font-black uppercase leading-none tracking-[0.14em] text-white">🏆 {leagueNameFor(divisionOf(career))}</span>
        <span className="flex items-center gap-1.5 leading-none">
          <span className="text-[13px] font-black tabular-nums text-yellow-200">{Math.round(pos)}<span className="text-[9px]">{ordinal(me + 1)}</span></span>
          <span className="text-[10px] font-black uppercase tracking-wider text-white">Full table ›</span>
        </span>
      </div>
      <div>
        {slice.map((t, i) => {
          const rank = from + i + 1, you = t.name === career.player.club;
          return (
            <div
              key={t.name}
              className={`flex items-center gap-1.5 px-1.5 text-[11.5px] font-black leading-none ${you ? "text-white" : "text-white/85"}`}
              style={{ height: MINI_LEAGUE_ROW, ...(you ? { background: `linear-gradient(90deg, ${rgba(tint(glow, 0.22), 0.8)}, ${rgba(glow, 0.35)} 70%, transparent)`, boxShadow: `inset 0 0 0 1px ${rgba(tint(glow, 0.5), 0.9)}` } : null) }}
            >
              <span className="w-4 text-right tabular-nums text-white/60">{rank}</span>
              <ClubBadge club={t.name} kit={kitsOf(t.name).home} size={13} />
              <span className="min-w-0 flex-1 truncate">{short(t.name)}</span>
              <span className="w-5 text-right tabular-nums text-white/60">{t.played}</span>
              <span className={`w-6 text-right tabular-nums ${you ? "text-yellow-200" : "text-white"}`}>{t.points}</span>
            </div>
          );
        })}
      </div>
    </FlatPanel>
  );
}

/** Height of the closed league dropdown, so Home can budget for it. */
export const LEAGUE_DROPDOWN_H = 24;

/**
 * THE LEAGUE AS A DROPDOWN (Harry, 1 Oct 2026: "remove the table or make it
 * a dropdown", so the sky behind the goal shows). Closed it is one slim row:
 * the league, your position and a chevron. Open, the rows either side of you
 * drop down over the stand, with Full table to open the League screen.
 */
export function LeagueDropdown({ career, glow, onOpen }: { career: CareerState; glow: string; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const table = sortLeague(career.league);
  const me = table.findIndex((t) => t.name === career.player.club);
  const pos = useCountUp(me + 1, 700);
  if (me < 0) return null;
  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="kib-press flex w-full items-center justify-between px-3 text-left"
        style={{ height: LEAGUE_DROPDOWN_H, background: "linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.12))", textShadow: "0 1px 3px rgba(0,0,0,.85)" }}
      >
        <span className="text-[11px] font-black uppercase leading-none tracking-[0.14em] text-white">🏆 {leagueNameFor(divisionOf(career))}</span>
        <span className="flex items-center gap-1.5 leading-none">
          <span className="text-[13px] font-black tabular-nums text-yellow-200">{Math.round(pos)}<span className="text-[9px]">{ordinal(me + 1)}</span></span>
          <span className="text-[12px] font-black text-white transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }}>▾</span>
        </span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full" style={{ animation: "kib-drop .18s ease-out", background: "rgba(4,16,10,.86)", boxShadow: "0 8px 18px rgba(0,0,0,.5)" }}>
          <style>{`@keyframes kib-drop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
          <MiniLeague career={career} glow={glow} rows={5} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}
