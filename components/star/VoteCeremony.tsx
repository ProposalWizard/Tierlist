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

type Stage = "offer" | "counting" | "result";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function VoteCeremony({ tally, scope, successOptionId, canOverrule, overruleCost, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("offer");
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
      <div className="w-full max-w-sm">
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">{SCOPE_ICON[scope]}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">{SCOPE_LABEL[scope]}</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center mb-4">
          <div className="font-black text-white text-lg">{tally.question}</div>
        </div>

        {stage === "offer" && (
          <button
            onClick={() => setStage("counting")}
            className="w-full py-3 rounded-lg font-black text-sm bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition"
          >
            Put It To A Vote
          </button>
        )}

        {stage !== "offer" && (
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
