"use client";
import { useEffect, useRef, useState } from "react";
import type { VoteTally } from "@/lib/star/voting";
import { Burst, PressButton, Shine, rgba } from "@/components/star/legacy/ui";
import { Screen, Dots } from "@/components/star/legacy/ui/Screen";

/** Each option's bar colour, in order: yes-green, no-red, then the rest. */
const BAR_COLORS: [string, string][] = [["#10b981", "#6ee7b7"], ["#ef4444", "#fca5a5"], ["#3b82f6", "#93c5fd"], ["#f59e0b", "#fde68a"], ["#8b5cf6", "#c4b5fd"]];
const SCOPE_GLOW: Record<string, string> = { boardroom: "#b45309", fans: "#2563eb", public: "#0891b2", "governing-body": "#6366f1" };

/**
 * THE CEREMONY — PRESENTATION LAYER FOR A VOTE (PHASE 2 OF STAR_POWER_POLITICS.MD).
 *
 * Generic on purpose: takes a `VoteTally` (already decided — see voting.ts's
 * own note on why) and animates toward it, exactly the beat the brief asks
 * for — offer the proposal, a live count that climbs fast and settles slow,
 * then the pass/fail reveal, with the overrule option surfaced even after a
 * "fail." Nothing here knows about players, clubs, or transfer fees; the
 * caller supplies the question (already inside `tally`) and decides what
 * "passed" means via `successOptionId`. Reused as-is by every future vote
 * this engine grows into — a kit vote, a fan vote, a Rule Book change —
 * just by handing it a different `scope` label and a different tally.
 */

export type VoteScope = "boardroom" | "fans" | "public" | "governing-body";

const SCOPE_LABEL: Record<VoteScope, string> = {
  boardroom: "Shareholders' Meeting",
  fans: "Fan Vote",
  public: "Public Vote",
  "governing-body": "Governing Body Vote",
};

const SCOPE_ICON: Record<VoteScope, string> = {
  boardroom: "🏛️", fans: "🧣", public: "🌍", "governing-body": "⚖️",
};

interface Props {
  tally: VoteTally;
  scope: VoteScope;
  /** Which option id counts as "passed" for the reveal banner. Defaults to the first option. */
  successOptionId?: string;
  /** Whether ownership/power is high enough to overrule this specific vote. */
  canOverrule: boolean;
  /** Shareholder reputation cost shown on the overrule button, for real stakes up front. */
  overruleCost: number;
  onDone: (accepted: boolean, overruled: boolean) => void;
}

type Stage = "podium" | "crowd" | "counting" | "result";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * A small fixed crowd of silhouette heads, a few visibly "writing it down"
 * (a little wobble, staggered) — asked directly for a first-person feel:
 * you at a desk, cameras either side, looking out at a room taking notes
 * before the board reveals the tally. Plain CSS/SVG, no new assets or a
 * canvas — the room is a repeated shape, not individually authored people.
 */
function CrowdRow({ count, delayBase }: { count: number; delayBase: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="kit-write w-4 h-5 rounded-t-full bg-gradient-to-b from-white/40 to-white/15"
          style={{ animationDelay: `${delayBase + i * 0.13}s` }}
        />
      ))}
    </div>
  );
}

export default function VoteCeremony({ tally, scope, successOptionId, canOverrule, overruleCost, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("podium");
  const [displayed, setDisplayed] = useState<Record<string, number>>(() => Object.fromEntries(tally.options.map(o => [o.id, 0])));
  const [displayedAbstentions, setDisplayedAbstentions] = useState(0);
  const frameRef = useRef<number>(0);

  const successId = successOptionId ?? tally.options[0].id;
  const passed = tally.winner === successId;
  const totalCounted = Object.values(tally.counts).reduce((a, b) => a + b, 0) + tally.abstentions;

  useEffect(() => {
    if (stage !== "counting") return;
    const DURATION_MS = 1800;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = easeOutCubic(t);
      setDisplayed(Object.fromEntries(tally.options.map(o => [o.id, Math.round(tally.counts[o.id] * eased)])));
      setDisplayedAbstentions(Math.round(tally.abstentions * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else setStage("result");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, tally]);

  return (
    <Screen glow={SCOPE_GLOW[scope] ?? "#6366f1"} tone={stage === "result" ? (passed ? "#10b981" : "#ef4444") : undefined} center className="max-w-sm px-4 py-8">
      <div className="w-full">
        <div className="text-center mb-4">
          <div className="kit-trophy-in text-4xl mb-1" style={{ filter: "drop-shadow(0 0 16px rgba(255,255,255,.35))" }}>{SCOPE_ICON[scope]}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/90">{SCOPE_LABEL[scope]}</div>
        </div>

        {stage === "podium" && (
          <>
            {/* First-person desk view: cameras either side, the proposal
                announced from your own seat before the room even reacts. */}
            <div className="kit-card kit-rise relative p-4 mb-3 overflow-hidden">
              <div className="kit-camera-flash absolute left-2 top-3 text-lg">📸</div>
              <div className="kit-camera-flash absolute right-2 top-3 text-lg" style={{ animationDelay: "1.1s" }}>📸</div>
              <div className="text-center pt-2 pb-1">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/80 mb-2">You put it to the room</div>
                <div className="font-black text-white text-lg leading-snug">{tally.question}</div>
              </div>
              {/* The desk itself, right at the bottom of your own view. */}
              <div className="mt-3 h-6 rounded-t-2xl bg-gradient-to-b from-amber-900 to-amber-950 border-t-2 border-amber-700 flex items-center justify-center">
                <div className="w-1.5 h-3 -mt-4 rounded-full bg-gray-600" />
              </div>
            </div>
            <PressButton variant="primary" pulse onClick={() => setStage("crowd")} className="w-full">
              Present the Proposal
            </PressButton>
          </>
        )}

        {stage === "crowd" && (
          <>
            <div className="kit-card kit-rise p-4 mb-3">
              <div className="text-center text-[10px] font-black uppercase tracking-widest text-white/80 mb-3">
                The room takes it in
              </div>
              <div className="space-y-2">
                <CrowdRow count={7} delayBase={0} />
                <CrowdRow count={9} delayBase={0.25} />
                <CrowdRow count={7} delayBase={0.5} />
              </div>
              <div className="text-center text-[9px] font-semibold text-white/85 mt-3">Everyone's writing it down.</div>
            </div>
            <PressButton variant="primary" pulse onClick={() => setStage("counting")} className="w-full normal-case tracking-normal">
              Look to the Board — Call the Vote
            </PressButton>
          </>
        )}

        {stage !== "podium" && stage !== "crowd" && (
          <div className="kit-card p-4 text-center mb-4">
            <div className="font-black text-white text-lg">{tally.question}</div>
          </div>
        )}

        {(stage === "counting" || stage === "result") && (
          <>
            {/* The board: each option's bar grows as the count ticks up,
                the real numbers beside it the whole way. The winner lights
                up once the count is in. */}
            <div className="kit-card relative overflow-hidden mb-3">
              <div className="flex items-center justify-between px-3 pt-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                <span>The board</span>
                {stage === "counting" ? <span className="text-amber-300">Counting <Dots /></span> : <span className="text-white/80">Final count</span>}
              </div>
              {tally.options.map((o, i) => {
                const count = displayed[o.id] ?? 0;
                const pct = totalCounted > 0 ? Math.round((count / totalCounted) * 100) : 0;
                const isLeader = stage === "result" && o.id === tally.winner;
                const [c0, c1] = BAR_COLORS[i % BAR_COLORS.length];
                return (
                  <div key={o.id} className={`relative px-3 py-2.5 ${i > 0 ? "border-t border-white/[0.06]" : ""}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm">{o.label}{isLeader && <span className="kit-slam ml-2 inline-block rounded-full bg-gradient-to-b from-yellow-300 to-amber-500 px-1.5 py-px text-[9px] uppercase text-gray-950">Most votes</span>}</span>
                      <span className="font-black text-xl tabular-nums" style={isLeader ? { color: c1, textShadow: `0 0 12px ${rgba(c0, 0.6)}` } : undefined}>{count.toLocaleString()}<span className="ml-1 text-[11px] text-white/55">{pct}%</span></span>
                    </div>
                    <div className="relative h-4 overflow-hidden rounded-full bg-black/55" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
                      <div
                        className="relative h-full overflow-hidden rounded-full"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c0}, ${c1})`, boxShadow: `0 0 ${isLeader ? 18 : 10}px ${rgba(c0, isLeader ? 0.85 : 0.5)}` }}
                      >
                        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/35" />
                        {isLeader && <Shine trigger={1} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-3 py-2 border-t border-white/[0.06] text-[10px] text-white font-semibold flex justify-between">
                <span>Abstentions</span>
                <span className="tabular-nums">{displayedAbstentions.toLocaleString()}</span>
              </div>
            </div>

            {stage === "result" && (
              <>
                <div className="relative">
                  {passed && <Burst colors={["#34d399", "#fde047", "#ffffff", "#6ee7b7"]} count={26} className="left-1/2 top-1/2" />}
                  <div
                    className={`${passed ? "kit-stamp" : "kit-shake-x"} rounded-xl p-3 text-center mb-3 text-lg font-black uppercase tracking-widest`}
                    style={passed
                      ? { color: "#6ee7b7", background: "linear-gradient(180deg, rgba(6,95,70,.8), rgba(4,47,36,.9))", boxShadow: "inset 0 0 0 2px rgba(52,211,153,.6), 0 0 26px rgba(52,211,153,.35)" }
                      : { color: "#fca5a5", background: "linear-gradient(180deg, rgba(127,29,29,.8), rgba(69,10,10,.9))", boxShadow: "inset 0 0 0 2px rgba(248,113,113,.55), 0 0 26px rgba(239,68,68,.3)" }}
                  >
                    {passed ? "The vote passes" : "The vote fails"}
                  </div>
                </div>

                {passed || !canOverrule ? (
                  <PressButton variant={passed ? "primary" : "secondary"} pulse={passed} onClick={() => onDone(passed, false)} className="w-full">
                    Continue
                  </PressButton>
                ) : (
                  <div className="space-y-2">
                    <PressButton variant="danger" onClick={() => onDone(true, true)} className="w-full normal-case tracking-normal">
                      Overrule — costs {overruleCost} shareholder reputation
                    </PressButton>
                    <PressButton variant="secondary" size="sm" onClick={() => onDone(false, false)} className="w-full py-2 normal-case">
                      Accept the result
                    </PressButton>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
