"use client";
import type { CareerState } from "@/lib/star/types";
import { careerVerdict, retirementCheck, testimonialFor, TESTIMONIAL_APPEARANCES } from "@/lib/star/retirement";

/**
 * Two screens that share their numbers: the decision, and what it added up to.
 */

export function RetirementChoice({ career, onRetire, onPlayOn }: {
  career: CareerState;
  onRetire: () => void;
  onPlayOn: () => void;
}) {
  const check = retirementCheck(career);
  const verdict = careerVerdict(career);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white px-3 py-6">
      <div className="mx-auto w-full max-w-sm text-center">
        <div className="inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
          End of the season
        </div>
        <h1 className="mt-3 text-2xl font-black">{check.mustRetire ? "That is the end of it" : "Do you go again?"}</h1>
        <p className="mt-2 text-sm text-gray-200">{check.reason}</p>

        <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800 p-4 text-left">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/85">As it stands</div>
          <div className="mt-1 text-lg font-black text-white">{verdict.title}</div>
          <p className="mt-0.5 text-xs text-gray-200">{verdict.summary}</p>
        </div>

        {testimonialFor(career) ? (
          <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-left">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">Testimonial</div>
            <div className="mt-0.5 text-xs text-white">
              {career.player.club} will put on a testimonial for you. ★{testimonialFor(career)!.payout}.
            </div>
          </div>
        ) : (
          <div className="mt-3 text-[10px] text-white/85">
            {TESTIMONIAL_APPEARANCES - (career.clubAppearances ?? 0)} more appearances for {career.player.club} would
            have earned you a testimonial.
          </div>
        )}

        <div className="mt-5 space-y-2">
          <button
            onClick={onRetire}
            className="w-full rounded-xl bg-amber-400 py-3 font-black text-gray-950 transition hover:bg-amber-300"
          >
            Hang them up 🥾
          </button>
          {!check.mustRetire && (
            <button
              onClick={onPlayOn}
              className="w-full rounded-xl bg-emerald-600 py-3 font-black text-white transition hover:bg-emerald-500"
            >
              One more season
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LegacyScreen({ career, onNewCareer }: {
  career: CareerState;
  onNewCareer: () => void;
}) {
  const v = careerVerdict(career);
  const s = career.careerStats;
  const avg = s.ratingCount > 0 ? (s.totalRating / s.ratingCount).toFixed(2) : "—";

  const byCompetition = new Map<string, number>();
  for (const t of career.trophies) byCompetition.set(t.competition, (byCompetition.get(t.competition) ?? 0) + 1);

  const byAward = new Map<string, number>();
  for (const a of career.awards ?? []) byAward.set(a.kind, (byAward.get(a.kind) ?? 0) + 1);
  const individual = Array.from(byAward.entries());

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white px-3 py-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
            {career.player.firstName} {career.player.lastName} · {career.player.startYear}–{career.player.startYear + v.seasons}
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">{v.title}</h1>
          <p className="mt-1 text-xs text-gray-200">{v.summary}</p>
          <div className="mx-auto mt-3 h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${Math.max(3, v.score)}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-white/85">Legacy {Math.round(v.score)}/100</div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Apps" value={s.appearances} />
          <Stat label="Goals" value={s.goals} />
          <Stat label="Assists" value={s.assists} />
          <Stat label="Avg rating" value={avg} />
          <Stat label="Caps" value={career.caps ?? 0} />
          <Stat label="Intl goals" value={career.internationalGoals ?? 0} />
        </div>

        <Panel title="Honours">
          {byCompetition.size === 0 && <Line>Nothing in the cabinet. It happens.</Line>}
          {Array.from(byCompetition.entries()).map(([comp, n]) => (
            <Line key={comp}>{n}× {comp}</Line>
          ))}
          {career.ballonDorWins > 0 && <Line>{career.ballonDorWins}× Ballon d&apos;Or</Line>}
        </Panel>

        <Panel title="Individual">
          {individual.length === 0 && <Line>No individual awards.</Line>}
          {individual.map(([kind, n]) => <Line key={kind}>{n}× {kind}</Line>)}
          {career.captain && <Line>Captain of {career.player.club}</Line>}
        </Panel>

        {career.testimonial && (
          <div className="mt-3 rounded-xl border border-amber-400/60 bg-amber-500/15 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-200">Testimonial</div>
            <div className="mt-1 text-xs font-bold text-white">
              A full house at {career.testimonial.club} to say goodbye. ★{career.testimonial.payout}.
            </div>
            <div className="mt-0.5 text-[10px] text-gray-200">
              {career.clubAppearances} appearances for one club will do that.
            </div>
          </div>
        )}

        <Panel title="Clubs">
          {v.clubs.map((c) => <Line key={c}>{c}</Line>)}
          {(career.transfers ?? []).length === 0 && <Line>One club, start to finish.</Line>}
        </Panel>

        <Panel title="Achievements">
          <Line>{career.achievements.length} unlocked</Line>
        </Panel>

        <button
          onClick={onNewCareer}
          className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-black text-white transition hover:bg-emerald-500"
        >
          Start a new career
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 py-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/85">{label}</div>
      <div className="text-lg font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">{title}</div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold text-white">{children}</div>;
}
