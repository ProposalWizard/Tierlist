"use client";

/**
 * The frame every relationship game shares (Mikey, 4 Oct 2026, relationships
 * revamp): a Back button, the game's name, the bar it moves, the game itself,
 * and one result panel at the end showing exactly what changed.
 */
import type React from "react";
import { FlatPanel, SquareBar, PressButton } from "../ui";

export interface GameResult {
  won: boolean;
  /** What the bar (or the brand's happiness) moves by. */
  gain: number;
  /** Money spent (the day off). */
  cost?: number;
  /** One line about how it went. */
  line?: string;
}

export const toneOf = (v: number): [string, string] => (v >= 70 ? ["#10b981", "#6ee7b7"] : v >= 40 ? ["#eab308", "#fde047"] : ["#ef4444", "#fda4af"]);

export function GameShell({ title, who, current, tone, onBack, children }: {
  title: string; who: string; current: number; tone: string; onBack?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b1220] px-3 pb-6 pt-3 text-white" data-relgame={title}>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-3 flex items-center gap-2">
          {onBack && <button onClick={onBack} className="kib-press rounded px-3 py-2 text-[13px] font-black uppercase ring-1 ring-white/25">← Back</button>}
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[18px] font-black uppercase leading-none tracking-wide" style={{ color: tone }}>{title}</div>
          </div>
        </div>
        <FlatPanel fade="none" edge className="mb-3 px-2 py-2">
          <div className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-white">{who}</div>
          {/* SquareBar's number is absolutely placed: it needs a relative box,
              or it covers the whole screen and swallows every tap. */}
          <div className="relative">
            <SquareBar value={current} colors={toneOf(current)} className="h-[18px]">{Math.round(current)}</SquareBar>
          </div>
        </FlatPanel>
        {children}
      </div>
    </div>
  );
}

export function ResultPanel({ result, who, current, onContinue }: { result: GameResult; who: string; current: number; onContinue: () => void }) {
  const after = Math.max(0, Math.min(100, current + result.gain));
  const sign = result.gain > 0 ? `+${result.gain}` : `${result.gain}`;
  return (
    <div className={`mt-3 p-4 text-center ring-2 ${result.won ? "bg-emerald-900/80 ring-emerald-400" : "bg-red-950/80 ring-red-500"}`} style={{ borderRadius: 4 }} data-result={result.won ? "won" : "lost"}>
      <div className="text-[20px] font-black uppercase">{result.won ? "Nice one" : "Not this time"}</div>
      {result.line && <div className="mt-1 text-[14px] font-bold text-white">{result.line}</div>}
      <div className="mt-2 text-[15px] font-black text-white">
        {result.gain === 0 ? `${who} stays at ${Math.round(current)}.${result.won ? " The higher it is, the harder it moves." : ""}` : `${who} ${sign}: ${Math.round(current)} → ${Math.round(after)}`}
      </div>
      {!!result.cost && <div className="mt-1 text-[13px] font-bold text-amber-200">Cost ★{result.cost.toLocaleString("en-GB")}</div>}
      <PressButton variant="primary" size="none" onClick={onContinue} className="mt-3 w-full rounded py-3 text-[14px] font-black uppercase">Continue →</PressButton>
    </div>
  );
}
