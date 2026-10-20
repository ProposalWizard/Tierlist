"use client";

/**
 * THE CUP'S TOP BLOCK AND ITS ROAD — shared by a domestic cup's own screen
 * (CupScreen.tsx) and its tab on League → Table (CupSummary below). Light on
 * purpose: League → Table also lives in the phone's app, which loads with
 * Home, so this file never pulls in the round-up or the draw.
 */
import { useMemo } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import type { CupState } from "@/lib/star/cups";
import { cupStatus, cupViewFor, roundShort, type CupView, type RoundMark } from "@/lib/star/cupView";
import { seasonStartYear } from "@/lib/star/calendar";
import { competitionLook } from "@/lib/star/competitionLook";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
import TrophyImage from "./TrophyImage";
import { Chev, PressButton } from "./ui";

const MARK: Record<RoundMark, { bar: string; text: string }> = {
  won: { bar: "#22c55e", text: "#bbf7d0" },
  bye: { bar: "#86efac", text: "#bbf7d0" },
  lost: { bar: "#ef4444", text: "#fecaca" },
  now: { bar: "#facc15", text: "#fef08a" },
  played: { bar: "rgba(255,255,255,.42)", text: "rgba(255,255,255,.85)" },
  drawn: { bar: "rgba(255,255,255,.2)", text: "rgba(255,255,255,.8)" },
  future: { bar: "rgba(255,255,255,.07)", text: "rgba(255,255,255,.4)" },
};

function seasonTag(career: CareerState): string {
  const y = seasonStartYear(career.player.startYear, career.season);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

// ── The road: one segment per round ─────────────────────────────────────────

/** One segment per round, coloured by how it went for you: green won (light
 *  green a bye), red out, yellow your next tie, grey without you, dashed
 *  not drawn yet. */
export function CupRoad({ view }: { view: CupView }) {
  return (
    <div data-cup-road className="flex gap-1">
      {view.names.map((name, i) => {
        const m = view.marks[i];
        const word = m === "bye" ? "bye" : m === "won" ? "won" : m === "lost" ? "out" : m === "now" ? "next" : "";
        return (
          <div key={name} title={name} data-cup-round={name} data-mark={m} className="flex min-w-0 flex-1 flex-col items-center gap-1 pt-1">
            <span className="block h-[7px] w-full" style={{ background: MARK[m].bar, borderRadius: 2, outline: m === "future" ? "1px dashed rgba(255,255,255,.28)" : undefined }} />
            <span className="text-[11px] font-bold leading-none" style={{ color: MARK[m].text }}>{roundShort(name)}</span>
            <span className="h-[9px] text-[9px] font-semibold uppercase leading-none" style={{ color: MARK[m].text }}>{word}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── The top block ───────────────────────────────────────────────────────────

export function CupHero({ career, view, compact = false, children }: { career: CareerState; view: CupView; compact?: boolean; children?: React.ReactNode }) {
  const look = competitionLook(view.competition);
  const st = cupStatus(view, career);
  const color = st.tone === "gold" ? "#fde047" : st.tone === "grey" ? "#cbd5e1" : "#ffffff";
  return (
    <div className="relative overflow-hidden" style={{ background: look.bg, boxShadow: `inset 0 -1px 0 rgba(255,255,255,.12), inset 0 1px 0 ${look.glow}` }}>
      <div className={`flex items-center gap-3 px-3 ${compact ? "pt-3" : "pt-4"}`}>
        <div className="grid shrink-0 place-items-center" style={{ width: compact ? 46 : 64 }}>
          <TrophyImage name={view.competition} height={compact ? 46 : 64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">{view.competition} · {seasonTag(career)}</div>
          <div data-cup-headline className={`sk-display mt-1 leading-none ${compact ? "text-[22px]" : "text-[30px]"}`} style={{ color, textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>{st.headline}</div>
          {st.sub && <div data-cup-sub className={`mt-1 font-bold text-white ${compact ? "truncate text-[12px]" : "text-[13px]"}`}>{st.sub}</div>}
        </div>
      </div>
      {view.winner && (
        <div data-cup-winner className="mx-3 mt-3 flex items-center justify-center gap-2 border-y border-white/15 py-2 text-[15px] font-bold text-amber-200">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">Winners</span>
          <ClubBadge club={view.winner} size={22} />
          {shortClub(view.winner)}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * The cup's tab on League → Table: where it stands for you, the road, and a
 * way into the cup's own screen. Replaces the long list of every tie (the
 * Lower League Trophy's Round 1 alone was 56 rows).
 */
export function CupSummary({ career, state, onOpen }: { career: CareerState; state: CupState; onOpen: () => void }) {
  const view = useMemo(() => cupViewFor(career, state), [career, state]);
  return (
    <div data-cup-summary={state.competition}>
      <CupHero career={career} view={view} compact>
        <div className="px-3 pt-3"><CupRoad view={view} /></div>
        <div className="px-3 pb-3 pt-3">
          <PressButton variant="primary" size="none" onClick={onOpen} data-cup-open={state.competition} className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-black uppercase">
            Open the {state.competition === "Lower League Trophy" ? "Trophy" : state.competition}
            <Chev dir="right" size={13} />
          </PressButton>
        </div>
      </CupHero>
    </div>
  );
}
