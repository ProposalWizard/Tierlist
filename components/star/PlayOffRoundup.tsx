"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bracket, BracketTie, Slot } from "@/lib/star/playOffBracket";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";
import { PressButton, Shine } from "./ui";
import { Screen } from "./ui/Screen";
import { prefersReducedMotion } from "./ui/motion";

/**
 * THE PLAY-OFF ROUND-UP — the bracket before each of your play-off matches
 * (Mikey, 8 Oct 2026, from a "Road to the Final" cup graphic).
 *
 * Drawn mirrored: side A on the left, side B on the right, the final and the
 * trophy in the middle. The round that has just finished plays out in steps:
 * its scores pop in, the losers fade, then each winner's line grows along
 * the bracket and his crest slides into the next fixture. Your next match
 * pulses. Tap to skip to the end. Nothing here decides anything: the bracket
 * is lib/star/playOffBracket.ts reading the save.
 */

const W = 360;
const H = 380;
const C = 34; // crest size
const R = C / 2;

/** Where each slot sits, by format: [x, y] in a 360 × 380 box. */
const SPOTS: Record<"four" | "six", Record<string, [number, number]>> = {
  four: {
    "sA.top": [62, 180], "sA.bottom": [62, 320],
    "sB.top": [298, 180], "sB.bottom": [298, 320],
    "f.top": [150, 250], "f.bottom": [210, 250],
  },
  six: {
    "qA.top": [30, 128], "qA.bottom": [30, 222],
    "qB.top": [330, 128], "qB.bottom": [330, 222],
    "sA.bottom": [100, 175], "sA.top": [100, 325],
    "sB.bottom": [260, 175], "sB.top": [260, 325],
    "f.top": [150, 250], "f.bottom": [210, 250],
  },
};
const PROMOTED: [number, number] = [180, 66];
const TROPHY_Y = 160;

const SCORE_MS = 900;
const ADVANCE_MS = 1150;

type Step = { kind: "score" | "advance"; stage: number };

function stepsFor(b: Bracket): Step[] {
  const out: Step[] = [];
  for (let s = b.revealFrom; s <= b.revealTo; s++) {
    if (b.ties.some(t => t.stage === s && t.winner)) out.push({ kind: "score", stage: s }, { kind: "advance", stage: s });
  }
  return out;
}

const pct = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

/** The connector from a tie's two slots to where its winner goes. */
function connector(b: Bracket, t: BracketTie): { stubs: Record<Slot, string>; out: string } | null {
  const S = SPOTS[b.format];
  const top = S[`${t.id}.top`], bot = S[`${t.id}.bottom`];
  if (!top || !bot) return null;
  if (t.id === "f") {
    const y = top[1] - R - 18;
    return {
      stubs: { top: `M${top[0]},${top[1] - R} V${y} H${PROMOTED[0]}`, bottom: `M${bot[0]},${bot[1] - R} V${y} H${PROMOTED[0]}` },
      out: `M${PROMOTED[0]},${y} V${PROMOTED[1] + R + 6}`,
    };
  }
  if (!t.feeds || t.feeds === "promoted") return null;
  const tgt = S[`${t.feeds.tie}.${t.feeds.slot}`];
  const dir = tgt[0] > top[0] ? 1 : -1;
  const ex = (top[0] + dir * R + tgt[0] - dir * R) / 2;
  const my = (top[1] + bot[1]) / 2;
  return {
    stubs: {
      top: `M${top[0] + dir * R},${top[1]} H${ex} V${my}`,
      bottom: `M${bot[0] + dir * R},${bot[1]} H${ex} V${my}`,
    },
    out: `M${ex},${my} V${tgt[1]} H${tgt[0] - dir * R}`,
  };
}

export default function PlayOffRoundup({ bracket, title, nextLine, you, onContinue }: {
  bracket: Bracket;
  /** "National League North" etc. */
  title: string;
  /** "Semi-final · 1st leg v Wigan", or how it ended. */
  nextLine: string;
  you: string;
  onContinue: () => void;
}) {
  const steps = useMemo(() => stepsFor(bracket), [bracket]);
  const [done, setDone] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = done >= steps.length;

  useEffect(() => {
    if (prefersReducedMotion()) { setDone(steps.length); return; }
    if (finished) return;
    const wait = done === 0 ? 650 : steps[done - 1].kind === "score" ? SCORE_MS : ADVANCE_MS;
    timer.current = setTimeout(() => setDone(d => d + 1), wait);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [done, finished, steps]);

  const skip = () => { if (timer.current) clearTimeout(timer.current); setDone(steps.length); };
  const reached = (kind: Step["kind"], stage: number) => {
    if (stage < bracket.revealFrom) return true;
    const i = steps.findIndex(s => s.kind === kind && s.stage === stage);
    return i < 0 ? stage < bracket.revealFrom : i < done;
  };

  const S = SPOTS[bracket.format];
  const tieById = (id: string) => bracket.ties.find(t => t.id === id);
  const promotedShown = !!bracket.promoted && reached("advance", 2);

  return (
    <Screen glow="#16a34a" center className="max-w-sm px-3 py-4">
      <div className="w-full select-none" onClick={finished ? undefined : skip}>
        <div className="relative overflow-hidden rounded-none"
          style={{ background: "radial-gradient(120% 80% at 50% 30%, #1f7a43 0%, #0f4a28 55%, #082a17 100%)" }}>
          {/* header */}
          <div className="relative z-10 pt-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/80">{title}</div>
            <h2 className="sk-display mt-0.5 text-[30px] leading-none text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.5)" }}>
              Play-Offs
            </h2>
          </div>

          {/* the bracket */}
          <div className="relative mx-auto w-full" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" fill="none">
              {bracket.ties.map(t => {
                const c = connector(bracket, t);
                if (!c) return null;
                const lit = !!t.winner && reached("advance", t.stage);
                const winSlot: Slot | null = t.winner ? (t.top?.club === t.winner ? "top" : "bottom") : null;
                return (
                  <g key={t.id}>
                    <path d={c.stubs.top} stroke="rgba(255,255,255,.28)" strokeWidth={2} />
                    <path d={c.stubs.bottom} stroke="rgba(255,255,255,.28)" strokeWidth={2} />
                    <path d={c.out} stroke="rgba(255,255,255,.28)" strokeWidth={2} />
                    {winSlot && (
                      <>
                        <path d={c.stubs[winSlot]} pathLength={1} stroke="#facc15" strokeWidth={3} strokeLinecap="round"
                          style={{ strokeDasharray: 1, strokeDashoffset: lit ? 0 : 1, transition: "stroke-dashoffset 450ms ease-out" }} />
                        <path d={c.out} pathLength={1} stroke="#facc15" strokeWidth={3} strokeLinecap="round"
                          style={{ strokeDasharray: 1, strokeDashoffset: lit ? 0 : 1, transition: "stroke-dashoffset 450ms ease-out 420ms" }} />
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* the trophy and who went up */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2 text-[44px] leading-none" style={pct(180, TROPHY_Y)}
              aria-hidden>🏆</div>
            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(PROMOTED[0], PROMOTED[1])}>
              <div className="grid place-items-center rounded-full border-2 border-dashed border-white/35"
                style={{ width: C + 10, height: C + 10, transition: "transform 400ms", transform: promotedShown ? "scale(1.12)" : "scale(1)" }}>
                {promotedShown && <div className="animate-[pop_400ms_ease-out]"><ClubBadge club={bracket.promoted!} size={C + 2} /></div>}
              </div>
              <div className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-yellow-200/90">
                {promotedShown ? "Promoted" : "Up"}
              </div>
            </div>

            {/* every slot */}
            {bracket.ties.flatMap(t => (["top", "bottom"] as Slot[]).map(slot => {
              const team = t[slot];
              const at = S[`${t.id}.${slot}`];
              if (!at) return null;
              const scoreShown = t.topScore !== undefined && reached("score", t.stage);
              const score = slot === "top" ? t.topScore : t.bottomScore;
              const lost = scoreShown && t.winner && team && team.club !== t.winner;
              // A team that got here by winning a tie flies in from that tie.
              const src = team?.from ? tieById(team.from) : undefined;
              const srcStage = src?.stage ?? -1;
              const arrived = !team?.from || reached("advance", srcStage);
              const srcSlot = src && src.top?.club === team?.club ? "top" : "bottom";
              const from = src ? S[`${src.id}.${srcSlot}`] : at;
              const pos = arrived ? at : from;
              const mine = team?.club === you;
              const inward = at[0] < 180 ? 1 : at[0] > 180 ? -1 : 0;
              return (
                <div key={`${t.id}.${slot}`} className="absolute" style={{
                  ...pct(pos[0], pos[1]), width: C, height: C, marginLeft: -R, marginTop: -R,
                  transition: "left 650ms cubic-bezier(.3,.7,.2,1) 380ms, top 650ms cubic-bezier(.3,.7,.2,1) 380ms, opacity 300ms 380ms",
                  opacity: team ? (arrived ? (lost ? 0.38 : 1) : 0) : 1,
                  zIndex: arrived ? 2 : 3,
                }}>
                  {team ? (
                    <>
                      <div className="relative rounded-full" style={{
                        boxShadow: mine ? "0 0 0 2px #facc15, 0 0 12px rgba(250,204,21,.7)" : "0 2px 6px rgba(0,0,0,.45)",
                      }}>
                        <ClubBadge club={team.club} size={C} />
                        {t.next && finished && mine && (
                          <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-yellow-300/80" />
                        )}
                      </div>
                      <div className="absolute left-1/2 top-full mt-0.5 w-[74px] -translate-x-1/2 truncate text-center text-[9px] font-semibold leading-tight text-white/90">
                        {shortClub(team.club)}
                      </div>
                      {score !== undefined && (
                        <div className="absolute grid h-[19px] min-w-[19px] place-items-center rounded-full bg-black px-1 text-[11px] font-bold text-white"
                          style={{
                            top: R - 4, left: inward >= 0 ? C - 6 : -13,
                            transform: scoreShown ? "scale(1)" : "scale(0)",
                            transition: "transform 260ms cubic-bezier(.3,1.6,.5,1)",
                          }}>
                          {score}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full w-full rounded-full border-2 border-dashed border-white/30 bg-black/15" />
                  )}
                </div>
              );
            }))}

            {/* small notes: agg., pens, first-leg score */}
            {bracket.ties.map(t => {
              if (!t.note) return null;
              const a = S[`${t.id}.top`], b = S[`${t.id}.bottom`];
              if (!a || !b) return null;
              const show = t.note.startsWith("1st") || t.note === "end of season" || reached("score", t.stage);
              const x = (a[0] + b[0]) / 2, y = t.id === "f" ? a[1] + 34 : (a[1] + b[1]) / 2;
              return (
                <div key={`n${t.id}`} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-semibold text-emerald-100/90"
                  style={{ ...pct(t.id === "f" ? 180 : x, y), opacity: show ? 1 : 0, transition: "opacity 300ms" }}>
                  {t.note}
                </div>
              );
            })}
          </div>

          <div className="relative z-10 px-4 pb-4 text-center">
            <div className="min-h-[18px] text-[13px] font-semibold text-white" style={{ opacity: finished ? 1 : 0.0, transition: "opacity 300ms" }}>
              {nextLine}
            </div>
            <div className="mt-3 flex justify-center">
              {finished ? (
                <PressButton variant="primary" pulse onClick={onContinue} className="relative overflow-hidden px-8 py-3">
                  <Shine loop every={3} />
                  Continue
                </PressButton>
              ) : (
                <span className="py-3 text-[11px] text-white/60">Tap to skip</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pop{0%{transform:scale(.2)}70%{transform:scale(1.15)}100%{transform:scale(1)}}`}</style>
    </Screen>
  );
}
