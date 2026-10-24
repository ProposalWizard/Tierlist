"use client";
import { useState } from "react";
import type { GraphicSpec } from "@/lib/star/media/types";
import { synthOf, tally } from "@/lib/star/media/detect/goalOfMonth";
import { clipStyleFor, clipVariantFor, type PostAuthor } from "@/lib/star/media/clipStyle";
import GoalVideo from "./GoalVideo";

/**
 * GOAL OF THE MONTH — the poll under a post (Leo, 22 Oct 2026, plan part 10).
 *
 * One video at a time (five stacked videos would be a page long): the goal
 * you tap in the list plays above it. Each row has a Vote button until you
 * vote; then every row shows its share, like a real poll. Closed, the winner
 * is ticked. The look is the feed's own: dark rows, hairlines, emerald for
 * yours.
 */

type Poll = Extract<GraphicSpec, { type: "gotmPoll" }>;

function count(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function GoalOfMonthPoll({ spec, author, onVote }: {
  spec: Poll;
  author?: PostAuthor;
  /** Your vote. Absent: the poll can be watched but not voted in. */
  onVote?: (index: number) => void;
}) {
  const voted = spec.userVote !== undefined;
  const showResults = voted || !!spec.closed;
  const [sel, setSel] = useState<number>(spec.closed && spec.winner !== undefined ? spec.winner : spec.userVote ?? 0);
  const totals = tally(spec);
  const sum = totals.reduce((a, b) => a + b, 0) || 1;
  const e = spec.entries[sel] ?? spec.entries[0];
  if (!e) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-gray-900/70">
      <GoalVideo
        key={`${spec.pollId}-${sel}`}
        clipIds={e.clipId ? [e.clipId] : []}
        synth={e.synth ? [synthOf(e)!] : undefined}
        priority={e.clipId ? 1 : 0}
        style={clipStyleFor(author)}
        variant={clipVariantFor(author)}
        credit={author ? { handle: author.handle, name: author.name } : undefined}
        title={`${spec.monthName.toUpperCase()} GOTM | ${e.scorerShort.toUpperCase()}`}
        badge="GOAL"
        fallback={null}
      />
      <ul className="flex flex-col gap-1.5 p-2.5">
        {spec.entries.map((x, i) => {
          const pct = Math.round((totals[i] / sum) * 100);
          const mine = spec.userVote === i;
          const won = spec.closed && spec.winner === i;
          const picked = sel === i;
          return (
            <li key={i} className="relative overflow-hidden rounded-lg">
              {showResults && (
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 ${won ? "bg-amber-400/30" : x.isYou ? "bg-emerald-500/25" : "bg-white/10"}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className={`relative flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 ${picked ? "border-white/60" : "border-white/15"}`}>
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  aria-label={`Watch ${x.scorer}'s goal`}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${picked ? "bg-white text-black" : "bg-white/15 text-white"}`} aria-hidden>
                    ▶
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] font-bold leading-4 ${x.isYou ? "text-emerald-300" : "text-white"}`}>
                      {won ? "🏆 " : ""}{x.scorer}
                    </span>
                    <span className="block truncate text-[11px] leading-4 text-white/60">{x.detail}</span>
                  </span>
                </button>
                {showResults ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold tabular-nums text-white">{pct}%</span>
                    {mine && <span className="block text-[10px] leading-3 text-white/70">You voted</span>}
                  </span>
                ) : onVote ? (
                  <button
                    type="button"
                    onClick={() => { setSel(i); onVote(i); }}
                    className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-black active:scale-95"
                  >
                    Vote
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="px-3 pb-2.5 text-[12px] text-white/55">
        {count(sum)} votes · {spec.closed ? "Final result" : "Closes after your next match"}
      </p>
    </div>
  );
}
