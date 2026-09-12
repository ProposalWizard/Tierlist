"use client";
import { useEffect, useRef, useState } from "react";
import type { VoteTally } from "@/lib/star/voting";

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
          className="w-4 h-5 rounded-t-full bg-white/25"
          style={{
            animation: `kib-write 1.4s ease-in-out ${delayBase + i * 0.13}s infinite`,
          }}
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center px-4 py-8">
      <style>{`
        @keyframes kib-write { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }
        @keyframes kib-flash { 0%, 92%, 100% { opacity: 0.15; } 96% { opacity: 0.9; } }
      `}</style>
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">{SCOPE_ICON[scope]}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">{SCOPE_LABEL[scope]}</div>
        </div>

        {stage === "podium" && (
          <>
            {/* First-person desk view: cameras either side, the proposal
                announced from your own seat before the room even reacts. */}
            <div className="relative bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-4 mb-3 overflow-hidden">
              <div className="absolute left-2 top-3 text-lg" style={{ animation: "kib-flash 2.4s linear infinite" }}>📸</div>
              <div className="absolute right-2 top-3 text-lg" style={{ animation: "kib-flash 2.4s linear infinite 1.1s" }}>📸</div>
              <div className="text-center pt-2 pb-1">
                <div className="text-[9px] font-black uppercase tracking-widest text-white/80 mb-2">You put it to the room</div>
                <div className="font-black text-white text-lg leading-snug">{tally.question}</div>
              </div>
              {/* The desk itself, right at the bottom of your own view. */}
              <div className="mt-3 h-6 rounded-t-2xl bg-gradient-to-b from-amber-900 to-amber-950 border-t-2 border-amber-700 flex items-center justify-center">
                <div className="w-1.5 h-3 -mt-4 rounded-full bg-gray-600" />
              </div>
            </div>
            <button
              onClick={() => setStage("crowd")}
              className="w-full py-3 rounded-lg font-black text-sm bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition"
            >
              Present the Proposal
            </button>
          </>
        )}

        {stage === "crowd" && (
          <>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-3">
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
            <button
              onClick={() => setStage("counting")}
              className="w-full py-3 rounded-lg font-black text-sm bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition"
            >
              Look to the Board — Call the Vote
            </button>
          </>
        )}

        {stage !== "podium" && stage !== "crowd" && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center mb-4">
            <div className="font-black text-white text-lg">{tally.question}</div>
          </div>
        )}

        {(stage === "counting" || stage === "result") && (
          <>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-3">
              {tally.options.map((o, i) => {
                const count = displayed[o.id] ?? 0;
                const pct = totalCounted > 0 ? Math.round((count / totalCounted) * 100) : 0;
                const isLeader = stage === "result" && o.id === tally.winner;
                return (
                  <div key={o.id} className={`p-3 ${i > 0 ? "border-t border-black/30" : ""} ${isLeader ? "bg-emerald-900/30" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm">{o.label}</span>
                      <span className="font-black text-lg tabular-nums">{count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isLeader ? "bg-emerald-400" : "bg-white/40"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="px-3 py-2 border-t border-black/30 text-[10px] text-white font-semibold flex justify-between">
                <span>Abstentions</span>
                <span className="tabular-nums">{displayedAbstentions.toLocaleString()}</span>
              </div>
            </div>

            {stage === "result" && (
              <>
                <div className={`rounded-lg p-3 text-center mb-3 font-black ${passed ? "bg-emerald-700/40 text-emerald-300" : "bg-red-900/40 text-red-300"}`}>
                  {passed ? "The vote passes" : "The vote fails"}
                </div>

                {passed || !canOverrule ? (
                  <button
                    onClick={() => onDone(passed, false)}
                    className="w-full py-3 rounded-lg font-black text-sm bg-gray-700 hover:bg-gray-600 active:scale-[0.98] transition"
                  >
                    Continue
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => onDone(true, true)}
                      className="w-full py-3 rounded-lg font-black text-sm bg-red-700 hover:bg-red-600 active:scale-[0.98] transition"
                    >
                      Overrule — costs {overruleCost} shareholder reputation
                    </button>
                    <button
                      onClick={() => onDone(false, false)}
                      className="w-full py-2 rounded-lg font-black text-xs bg-gray-700 hover:bg-gray-600 active:scale-[0.98] transition text-white/85"
                    >
                      Accept the result
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
