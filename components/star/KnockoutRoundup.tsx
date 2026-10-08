"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardTie, BracketView, RoundupStage } from "@/lib/star/knockoutView";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
import { PressButton, Shine } from "./ui";
import { Screen } from "./ui/Screen";
import { prefersReducedMotion } from "./ui/motion";

/**
 * THE CUP AND EUROPEAN ROUND-UP (Mikey, 8 Oct 2026): after each of your cup
 * or European knockout matches, a results board of the whole round and —
 * from the last sixteen — the bracket, mirrored like a cup "Road to the
 * Final" graphic, where the round just played pops its scores in and its
 * winners' lines grow and their crests slide into the next tie. After the
 * Champions/Europa League league phase, the table splits first: top eight
 * to the round of 16, 9th–24th into the play-off, the rest out.
 *
 * Reads only lib/star/knockoutView.ts; decides nothing.
 */

export type { RoundupStage };

export const COMPETITION_GLOW: Record<string, { glow: string; bg: string }> = {
  "FA Cup": { glow: "#dc2626", bg: "radial-gradient(120% 80% at 50% 25%, #7f1d1d 0%, #3b0a0a 60%, #1a0505 100%)" },
  "League Cup": { glow: "#16a34a", bg: "radial-gradient(120% 80% at 50% 25%, #1f7a43 0%, #0f4a28 55%, #082a17 100%)" },
  "Champions League": { glow: "#2563eb", bg: "radial-gradient(120% 80% at 50% 25%, #1e3a8a 0%, #0b1a4a 60%, #050b24 100%)" },
  "Europa League": { glow: "#f97316", bg: "radial-gradient(120% 80% at 50% 25%, #9a3412 0%, #431407 60%, #1c0802 100%)" },
};

// ── The results board ────────────────────────────────────────────────────────

function legsLine(t: BoardTie): string | null {
  const bits: string[] = [];
  if (t.legs && t.legs.length > 1) bits.push(`${t.legs[0].hs}–${t.legs[0].as}, ${t.legs[1].hs}–${t.legs[1].as}`);
  if (t.aet) bits.push("aet");
  if (t.pens) bits.push(`pens ${t.pens.hs}–${t.pens.as}`);
  return bits.length ? bits.join(" · ") : null;
}

function Board({ ties }: { ties: BoardTie[] }) {
  return (
    <div className="flex flex-col gap-1 px-2 pb-2">
      {ties.map((t, i) => {
        const played = t.hs !== undefined;
        const homeWon = t.winner === t.home, awayWon = t.winner === t.away;
        const line = legsLine(t);
        return (
          <div key={`${t.home}-${t.away}`}
            className="rounded-md px-2 py-1.5"
            style={{
              background: t.yours ? "rgba(250,204,21,.16)" : "rgba(0,0,0,.25)",
              boxShadow: t.yours ? "inset 0 0 0 1.5px #facc15" : undefined,
              animation: `koRow 320ms ease-out both`, animationDelay: `${Math.min(i, 24) * 45}ms`,
            }}>
            <div className="flex items-center gap-1.5">
              <div className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 ${awayWon ? "opacity-45" : ""}`}>
                <span className={`truncate text-right text-[12.5px] ${homeWon ? "font-bold text-white" : "text-white/90"}`}>
                  {shortClub(t.home)}{t.pens && homeWon ? " ✅" : ""}
                </span>
                <ClubBadge club={t.home} size={20} />
              </div>
              <div className="w-[52px] shrink-0 text-center text-[14px] font-bold tabular-nums text-white">
                {played ? `${t.hs} – ${t.as}` : <span className="text-white/50">v</span>}
              </div>
              <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${homeWon ? "opacity-45" : ""}`}>
                <ClubBadge club={t.away} size={20} />
                <span className={`truncate text-[12.5px] ${awayWon ? "font-bold text-white" : "text-white/90"}`}>
                  {t.pens && awayWon ? "✅ " : ""}{shortClub(t.away)}
                </span>
              </div>
            </div>
            {(line || t.upset) && (
              <div className="mt-0.5 flex items-center justify-center gap-2 text-[10px] text-white/75">
                {line && <span>{t.legs && t.legs.length > 1 ? "agg. · " : ""}{line}</span>}
                {t.upset && <span className="rounded-sm bg-amber-400 px-1 text-[9px] font-bold uppercase tracking-wide text-black">Upset</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── The league-phase table splitting ─────────────────────────────────────────

function TableSplit({ rows }: { rows: { name: string; pts: number; gd: number; yours: boolean }[] }) {
  const zone = (i: number) => (i < 8 ? { c: "#22c55e", l: "Round of 16" } : i < 24 ? { c: "#f59e0b", l: "Play-off" } : { c: "#6b7280", l: "Out" });
  return (
    <div className="px-2 pb-2">
      <div className="mb-1.5 flex justify-center gap-3 text-[10px] text-white/80">
        {[0, 8, 24].map(i => (
          <span key={i} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: zone(i).c }} />{zone(i).l}</span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-1.5 py-[2px] text-[11.5px]"
          style={{
            opacity: i >= 24 ? 0.5 : 1,
            animation: "koRow 280ms ease-out both", animationDelay: `${Math.min(i, 35) * 30}ms`,
            background: r.yours ? "rgba(250,204,21,.18)" : undefined,
          }}>
          <span className="h-4 w-1 rounded-sm" style={{ background: zone(i).c }} />
          <span className="w-5 text-right tabular-nums text-white/70">{i + 1}</span>
          <ClubBadge club={r.name} size={16} />
          <span className={`flex-1 truncate ${r.yours ? "font-bold text-yellow-200" : "text-white"}`}>{shortClub(r.name)}</span>
          <span className="w-8 text-right tabular-nums text-white/70">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
          <span className="w-6 text-right font-bold tabular-nums text-white">{r.pts}</span>
        </div>
      ))}
    </div>
  );
}

// ── The bracket ──────────────────────────────────────────────────────────────

const W = 360, H = 430;
const C = 28, R = C / 2;
type Slot = "top" | "bottom";

function spot(bi: number, j: number, slot: Slot): [number, number] {
  if (bi === 3) return [slot === "top" ? 158 : 202, 234];
  const half = (8 >> bi) / 2;
  const right = j >= half;
  const k = j % half;
  const xs = [22, 70, 118];
  const x = right ? W - xs[bi] : xs[bi];
  const y = bi === 0 ? 70 + k * 96 + (slot === "bottom" ? 40 : 0)
    : bi === 1 ? 90 + 192 * k + (slot === "bottom" ? 96 : 0)
    : 138 + (slot === "bottom" ? 192 : 0);
  return [x, y];
}
const CHAMP: [number, number] = [180, 52];

function connector(bi: number, j: number): { stubs: Record<Slot, string>; out: string } {
  const a = spot(bi, j, "top"), b = spot(bi, j, "bottom");
  if (bi === 3) {
    const y = a[1] - R - 16;
    return {
      stubs: { top: `M${a[0]},${a[1] - R} V${y} H${CHAMP[0]}`, bottom: `M${b[0]},${b[1] - R} V${y} H${CHAMP[0]}` },
      out: `M${CHAMP[0]},${y} V${CHAMP[1] + R + 8}`,
    };
  }
  const t = spot(bi + 1, Math.floor(j / 2), j % 2 === 0 ? "top" : "bottom");
  const dir = t[0] > a[0] ? 1 : -1;
  const ex = (a[0] + dir * R + t[0] - dir * R) / 2;
  const my = (a[1] + b[1]) / 2;
  return {
    stubs: { top: `M${a[0] + dir * R},${a[1]} H${ex} V${my}`, bottom: `M${b[0] + dir * R},${b[1]} H${ex} V${my}` },
    out: `M${ex},${my} V${t[1]} H${t[0] - dir * R}`,
  };
}

const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

function Bracket({ view, you, step }: { view: BracketView; you: string; step: number }) {
  const a = view.animate;
  const scoresShown = (bi: number) => a === null || bi < a || (bi === a && step >= 1);
  const advanced = (bi: number) => a === null || bi < a || (bi === a && step >= 2);
  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" fill="none">
        {view.rounds.map((ties, bi) => ties.map((t, j) => {
          const c = connector(bi, j);
          const lit = !!t.winner && advanced(bi);
          const ws: Slot | null = t.winner ? (t.top === t.winner ? "top" : "bottom") : null;
          return (
            <g key={`${bi}-${j}`}>
              <path d={c.stubs.top} stroke="rgba(255,255,255,.25)" strokeWidth={1.6} />
              <path d={c.stubs.bottom} stroke="rgba(255,255,255,.25)" strokeWidth={1.6} />
              <path d={c.out} stroke="rgba(255,255,255,.25)" strokeWidth={1.6} />
              {ws && (
                <>
                  <path d={c.stubs[ws]} pathLength={1} stroke="#facc15" strokeWidth={2.6} strokeLinecap="round"
                    style={{ strokeDasharray: 1, strokeDashoffset: lit ? 0 : 1, transition: "stroke-dashoffset 420ms ease-out" }} />
                  <path d={c.out} pathLength={1} stroke="#facc15" strokeWidth={2.6} strokeLinecap="round"
                    style={{ strokeDasharray: 1, strokeDashoffset: lit ? 0 : 1, transition: "stroke-dashoffset 420ms ease-out 380ms" }} />
                </>
              )}
            </g>
          );
        }))}
      </svg>

      <div className="absolute -translate-x-1/2 -translate-y-1/2 text-[40px] leading-none" style={pct(180, 145)} aria-hidden>🏆</div>
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(CHAMP[0], CHAMP[1])}>
        <div className="grid place-items-center rounded-full border-2 border-dashed border-white/35" style={{ width: C + 12, height: C + 12 }}>
          {view.champion && advanced(3) && <div style={{ animation: "koPop 420ms ease-out" }}><ClubBadge club={view.champion} size={C + 4} /></div>}
        </div>
        <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-yellow-200/90">
          {view.champion && advanced(3) ? "Winners" : "Final"}
        </div>
      </div>

      {view.rounds.flatMap((ties, bi) => ties.flatMap((t, j) => (["top", "bottom"] as Slot[]).map(slot => {
        const club = t[slot];
        const at = spot(bi, j, slot);
        // A club in round bi > 0 came from feeder (bi-1, 2j or 2j+1).
        const fromRound = bi - 1;
        let arrived = true;
        let from: [number, number] = at;
        if (bi > 0 && a !== null && fromRound === a) {
          arrived = step >= 2;
          const fj = 2 * j + (slot === "top" ? 0 : 1);
          const ft = view.rounds[fromRound][fj];
          from = spot(fromRound, fj, ft?.top === club ? "top" : "bottom");
        } else if (bi === 0 && slot === "bottom" && a === -1) {
          arrived = step >= 1;
          from = [at[0] < 180 ? -30 : W + 30, at[1]];
        }
        const pos = arrived ? at : from;
        const shown = scoresShown(bi) && t.topScore !== undefined;
        const score = slot === "top" ? t.topScore : t.bottomScore;
        const lost = shown && t.winner && club && club !== t.winner;
        const inward = at[0] < 180 || (bi === 3 && slot === "top") ? 1 : -1;
        const pensWon = shown && t.pensWinner === slot;
        return (
          <div key={`${bi}-${j}-${slot}`} className="absolute" style={{
            ...pct(pos[0], pos[1]), width: C, height: C, marginLeft: -R, marginTop: -R,
            transition: "left 620ms cubic-bezier(.3,.7,.2,1) 360ms, top 620ms cubic-bezier(.3,.7,.2,1) 360ms, opacity 280ms 360ms",
            opacity: club ? (arrived ? (lost ? 0.38 : 1) : 0) : 1,
            zIndex: arrived ? 2 : 3,
          }}>
            {club ? (
              <>
                <div className="relative rounded-full" style={{ boxShadow: club === you ? "0 0 0 2px #facc15, 0 0 10px rgba(250,204,21,.7)" : "0 2px 5px rgba(0,0,0,.45)" }}>
                  <ClubBadge club={club} size={C} />
                </div>
                {score !== undefined && (
                  <div className="absolute grid h-[16px] min-w-[16px] place-items-center rounded-full bg-black px-[3px] text-[10px] font-bold text-white"
                    style={{ top: R - 2, left: inward > 0 ? C - 5 : -11, transform: shown ? "scale(1)" : "scale(0)", transition: "transform 240ms cubic-bezier(.3,1.6,.5,1)" }}>
                    {score}
                  </div>
                )}
                {pensWon && <div className="absolute -top-2 text-[9px]" style={{ left: inward > 0 ? C - 4 : -8 }}>✅</div>}
              </>
            ) : (
              <div className="h-full w-full rounded-full border-2 border-dashed border-white/25 bg-black/15" />
            )}
          </div>
        );
      })))}
    </div>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

export default function KnockoutRoundup({ competition, stages, you, nextLine, onContinue }: {
  competition: string;
  stages: RoundupStage[];
  you: string;
  /** "Quarter-final · away at Spurs", or how it ended. */
  nextLine: string;
  onContinue: () => void;
}) {
  const [at, setAt] = useState(0);
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage = stages[at];
  const last = at === stages.length - 1;
  const bracketSteps = stage?.kind === "bracket" && stage.view.animate !== null ? (stage.view.animate === -1 ? 1 : 2) : 0;
  const animDone = step >= bracketSteps;
  const look = COMPETITION_GLOW[competition] ?? COMPETITION_GLOW["League Cup"];

  useEffect(() => { setStep(0); }, [at]);
  useEffect(() => {
    if (prefersReducedMotion()) { setStep(bracketSteps); return; }
    if (animDone) return;
    timer.current = setTimeout(() => setStep(s => s + 1), step === 0 ? 700 : 1100);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [step, animDone, bracketSteps]);

  const skip = () => { if (timer.current) clearTimeout(timer.current); setStep(bracketSteps); };
  const scrolls = stage?.kind !== "bracket";
  const content = useMemo(() => stage, [stage]);
  if (!content) return null;

  return (
    <Screen glow={look.glow} className="max-w-sm px-3 py-3">
      <div className="w-full select-none" onClick={animDone ? undefined : skip}>
        <div className="relative overflow-hidden" style={{ background: look.bg }}>
          <div className="relative z-10 pt-3 pb-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/75">{competition}</div>
            <h2 className="sk-display mt-0.5 text-[26px] leading-none text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
              {content.title}
            </h2>
          </div>
          <div className={scrolls ? "max-h-[62vh] overflow-y-auto" : ""} key={at}>
            {content.kind === "board" && <Board ties={content.ties} />}
            {content.kind === "table" && <TableSplit rows={content.rows} />}
            {content.kind === "bracket" && <Bracket view={content.view} you={you} step={step} />}
          </div>
          <div className="relative z-10 px-4 pb-3 pt-2 text-center">
            {last && <div className="min-h-[18px] text-[13px] font-semibold text-white">{nextLine}</div>}
            <div className="mt-2 flex justify-center">
              {animDone ? (
                <PressButton variant="primary" pulse={last} onClick={() => (last ? onContinue() : setAt(at + 1))} className="relative overflow-hidden px-8 py-3">
                  {last && <Shine loop every={3} />}
                  {last ? "Continue" : "Next"}
                </PressButton>
              ) : (
                <span className="py-3 text-[11px] text-white/60">Tap to skip</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes koPop{0%{transform:scale(.2)}70%{transform:scale(1.15)}100%{transform:scale(1)}}@keyframes koRow{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}`}</style>
    </Screen>
  );
}
