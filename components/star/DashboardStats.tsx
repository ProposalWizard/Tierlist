"use client";
import { fameOf, fameLevel } from "@/lib/star/fame";
import { useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { selectionFor, MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { expectationStatus, personalDuty } from "@/lib/star/expectations";
import { reputationTier } from "@/lib/star/manager";
import { leadingScorer } from "@/lib/star/recognition";
import { clauseSummary } from "@/lib/star/contracts";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { ClubCard, StatBar, PressButton, RiseIn, CountUp, rgba, useClubTheme } from "./ui";
import { SegTabs, CardTitle } from "./screenKit";

/**
 * Stats · Contract · Status — under the League card on the Stats page.
 * Reskinned 28 Sep 2026 to the home screen's look: club-colour cards, the
 * home tab strip, glossy bars. Every number and button is the same.
 */

interface Props {
  career: CareerState;
  onRenew: () => void;
}

/** A section card on Status, lit in its own colour (was a coloured left border). */
function Panel({ tone, title, right, children }: { tone: string; title: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <ClubCard glow={tone} strength={0.3} className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: tone }}>{title}</div>
        {right}
      </div>
      {children}
    </ClubCard>
  );
}

const ord = (n: number) => (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

export default function DashboardStats({ career, onRenew }: Props) {
  const { glow } = useClubTheme(career);
  const [tab, setTab] = useState<"stats" | "contract" | "status">("stats");
  const selection = selectionFor(career);
  const duties = setPieceDuties(career, selection.status);
  const { pos, exp, onTrack } = expectationStatus(career);
  const duty = personalDuty(career);

  const avgSeasonRating = career.seasonStats.ratingCount > 0
    ? career.seasonStats.totalRating / career.seasonStats.ratingCount
    : 0;
  const avgCareerRating = career.careerStats.ratingCount > 0
    ? career.careerStats.totalRating / career.careerStats.ratingCount
    : 0;

  const energy = Math.round(career.energy);
  const energyColors: [string, string] = career.energy >= MIN_ENERGY_TO_START ? ["#34d399", "#a3e635"] : career.energy >= MIN_ENERGY_TO_SUB ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"];
  const sharp = Math.round(career.matchFitness);
  const statusLook = selection.status === "1st Team"
    ? { bg: "linear-gradient(180deg, #4ade80, #059669)", ink: "text-white", glow: "rgba(16,185,129,.7)" }
    : selection.status === "Substitute"
      ? { bg: "linear-gradient(180deg, #fde047, #f59e0b)", ink: "text-gray-950", glow: "rgba(245,158,11,.7)" }
      : { bg: "linear-gradient(180deg, #f87171, #b91c1c)", ink: "text-white", glow: "rgba(220,38,38,.7)" };

  return (
    <div className="mt-2">
      <SegTabs className="mb-2" value={tab} onChange={setTab} tabs={[["stats", "Stats"], ["contract", "Contract"], ["status", "Status"]] as const} />

      {tab === "stats" && (
        <RiseIn key="stats">
          <ClubCard glow={glow} className="overflow-hidden">
            <div className="grid grid-cols-3 border-b border-white/10 bg-black/30 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">
              <div className="pl-3">Stats</div>
              <div className="text-center">Season</div>
              <div className="text-center">Career</div>
            </div>
            {[
              ["Appearances", career.seasonStats.appearances, career.careerStats.appearances],
              ["Goals", career.seasonStats.goals, career.careerStats.goals],
              ["Hat Tricks", career.seasonStats.hatTricks, career.careerStats.hatTricks],
              ["Passes", career.seasonStats.passes, career.careerStats.passes],
              ["Assists", career.seasonStats.assists, career.careerStats.assists],
              ["Star Man", career.seasonStats.starMan, career.careerStats.starMan],
              ["Average Rating", avgSeasonRating.toFixed(1), avgCareerRating.toFixed(1)],
            ].map(([label, s, c], i) => (
              <div key={String(label)} className={`grid grid-cols-3 items-center py-1.5 ${i % 2 === 0 ? "bg-white/[0.04]" : ""}`}>
                <div className="pl-3 text-xs font-bold text-white/90">{label}</div>
                <div className="text-center text-[14px] font-black tabular-nums text-white">{s}</div>
                <div className="text-center text-[14px] font-black tabular-nums text-amber-200">{c}</div>
              </div>
            ))}
          </ClubCard>
        </RiseIn>
      )}

      {tab === "contract" && (
        <RiseIn key="contract">
          <ClubCard glow={glow} className="overflow-hidden">
            {[
              ["Club", career.contract.club],
              ["League", leagueNameFor(divisionOf(career))],
              ["Position", career.player.position],
              ["Wage", `★ ${career.contract.wage} / week`],
              ["Goal Bonus", `★ ${career.contract.goalBonus}`],
              ["Assist Bonus", `★ ${career.contract.assistBonus}`],
              ["Seasons Left", career.contract.seasonsRemaining],
            ].map(([label, val], i) => (
              <div key={String(label)} className={`flex items-center px-3 py-2 ${i % 2 === 0 ? "bg-white/[0.04]" : ""}`}>
                <div className="flex-1 text-xs font-bold text-white/80">{label}</div>
                <div className={`text-xs font-black ${String(val).startsWith("★") ? "text-yellow-200" : "text-white"}`}>{val}</div>
              </div>
            ))}
            {/* A contract was a wage, two bonuses and a number of seasons — every
                deal in the game was the same deal at a different price. */}
            {clauseSummary(career.contract).map((c) => (
              <div key={c.label} className="border-t border-white/10 bg-black/25 px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">{c.label}</div>
                <div className="text-[11px] text-white">{c.detail}</div>
              </div>
            ))}
            {clauseSummary(career.contract).length === 0 && (
              <div className="border-t border-white/10 bg-black/25 px-3 py-2 text-[10px] text-white/85">
                No clauses in this one. Ask for some at the next renewal.
              </div>
            )}
          </ClubCard>
          <PressButton variant="primary" onClick={onRenew} className="mt-2 w-full">
            Propose renewal
          </PressButton>
        </RiseIn>
      )}

      {tab === "status" && (
        <div className="space-y-2">
          {/* Derived, not read off the stored field: an old save was stamped
              "1st Team" when the career was created and never updated. */}
          <RiseIn index={0}>
            <div
              className={`rounded-xl py-2 text-center text-sm font-black uppercase tracking-wider ${statusLook.ink}`}
              style={{ background: statusLook.bg, boxShadow: `inset 0 1px 0 rgba(255,255,255,.45), 0 8px 18px -8px ${statusLook.glow}` }}
            >
              {selection.status}
            </div>
          </RiseIn>
          <RiseIn index={1} className="grid grid-cols-2 gap-2">
            {/* "Sharpness" — Harry, 28 Sep 2026: "fitness probably should be
                sharpness". Same number (career.matchFitness), new word. */}
            <ClubCard glow={sharp >= 70 ? "#10b981" : "#6b7280"} className="p-2.5">
              <div className="flex items-baseline justify-between">
                <CardTitle>Sharpness</CardTitle>
                <span className="text-[16px] font-black tabular-nums text-white"><CountUp value={sharp} />%</span>
              </div>
              <StatBar value={sharp} colors={sharp >= 70 ? ["#34d399", "#a3e635"] : ["#9ca3af", "#d1d5db"]} className="mt-1.5 h-2.5" />
            </ClubCard>
            <ClubCard glow={energyColors[0]} className="p-2.5">
              <div className="flex items-baseline justify-between">
                <CardTitle>⚡ Energy</CardTitle>
                <span className="text-[16px] font-black tabular-nums text-white"><CountUp value={energy} />%</span>
              </div>
              <StatBar value={energy} colors={energyColors} className="mt-1.5 h-2.5" />
            </ClubCard>
            {/* Was written from all over the career (a good match, a trophy,
                a lifestyle purchase) and read from all over it too (transfer
                interest, international call-ups, sponsors), but never once
                shown to the player who was earning it. Sponsors is the screen
                that actually spends this number (sponsorEligible). */}
            <ClubCard glow="#d946ef" className="col-span-2 flex items-center justify-between px-3 py-2">
              <CardTitle tone="text-fuchsia-200">★ Fame</CardTitle>
              <span className="text-sm font-black text-white">{fameOf(career)} · {fameLevel(fameOf(career)).name}</span>
            </ClubCard>
          </RiseIn>
          <RiseIn index={2} className="flex items-center gap-2">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(180deg, ${rgba(glow, 0.55)}, ${rgba(glow, 0.2)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px ${rgba(glow, 0.7)}, 0 6px 14px -6px ${rgba(glow, 0.8)}` }}
            >
              <span className="text-2xl font-black tabular-nums text-white" style={{ textShadow: "0 2px 6px rgba(0,0,0,.5)" }}>{career.squadNumber ?? "—"}</span>
            </div>
            <ClubCard glow="#facc15" className="flex-1 p-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Standing</div>
              <div className="text-xs font-black text-white">
                {career.captain ? "🅲 Club captain" : "Not the captain"}
                {leadingScorer(career) && career.seasonStats.goals > 0 ? " · leading the scoring charts" : ""}
              </div>
              <div className="text-[10px] font-bold text-white/85">
                {(career.clubAppearances ?? 0)} appearance{(career.clubAppearances ?? 0) === 1 ? "" : "s"} for {career.player.club}
              </div>
            </ClubCard>
          </RiseIn>

          {(career.sponsorNews ?? []).length > 0 && (
            <Panel tone="#a78bfa" title="💰 Sponsors">
              <div className="mt-1 space-y-0.5">
                {(career.sponsorNews ?? []).map((n, i) => (
                  <div key={i} className={`text-[11px] font-bold ${n.includes("not delivered") ? "text-red-300" : "text-white"}`}>{n}</div>
                ))}
              </div>
            </Panel>
          )}

          {(career.betNews ?? []).length > 0 && (
            <Panel tone="#34d399" title="🏆 Casino — Competition Bets">
              <div className="mt-1 space-y-0.5">
                {(career.betNews ?? []).map((n, i) => (
                  <div key={i} className={`text-[11px] font-bold ${n.includes("didn't win") ? "text-red-300" : "text-white"}`}>{n}</div>
                ))}
              </div>
            </Panel>
          )}

          {(career.awards ?? []).length > 0 && (
            <Panel tone="#fbbf24" title="🏅 Individual honours">
              <div className="mt-1 space-y-0.5">
                {[...(career.awards ?? [])].reverse().slice(0, 5).map((a, i) => (
                  <div key={i} className="text-[11px] text-white">
                    <span className="font-black text-amber-200">{a.kind}</span>
                    {" · S"}{a.season}{a.week ? ` wk ${a.week}` : ""} — {a.detail}
                  </div>
                ))}
                {(career.awards ?? []).length > 5 && (
                  <div className="text-[10px] text-white">…and {(career.awards ?? []).length - 5} more</div>
                )}
              </div>
            </Panel>
          )}

          {/* What the board actually wants. Finishing sixth used to be worth
              the same at every club in the division. */}
          <Panel
            tone={onTrack ? "#34d399" : "#f87171"}
            title="📋 Board expectation"
            right={<span className={`text-[10px] font-black uppercase tracking-widest ${onTrack ? "text-emerald-300" : "text-red-300"}`}>{exp.ambition}</span>}
          >
            <div className="mt-1.5 text-[11px] font-bold text-white">{exp.summary}</div>
            <div className="mt-1 text-[11px] text-white">
              {pos}{ord(pos)} of {career.league.length}
              {" · "}target {exp.targetPosition}{ord(exp.targetPosition)} or better
            </div>
            <div className="mt-1 text-[11px] text-white">
              <span className="font-black">{duty.duty}.</span> {duty.summary} Target {duty.goalTarget} goals — you have {career.seasonStats.goals}.
            </div>
          </Panel>

          {career.lastSeasonJudgement && (
            <Panel tone="#38bdf8" title="📅 Last season">
              <div className={`mt-1 text-[12px] font-black ${career.lastSeasonJudgement.score >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                {career.lastSeasonJudgement.headline}
              </div>
              <div className="mt-0.5 text-[11px] text-white">{career.lastSeasonJudgement.detail}</div>
            </Panel>
          )}

          <Panel
            tone="#60a5fa"
            title={<>👔 The manager{career.manager ? ` — ${career.manager.name}` : ""}</>}
            right={career.manager && (
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-200">
                {reputationTier(career.manager.reputation)}
              </span>
            )}
          >
            <div className="mt-1 text-[11px] font-bold text-white">{selection.reason}</div>
            <StatBar
              value={Math.max(3, selection.standing)}
              colors={selection.standing >= 55 ? ["#34d399", "#a3e635"] : selection.standing >= 34 ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"]}
              className="mt-2 h-2"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className={`rounded-full px-2 py-0.5 ${duties.freeKicks ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-black/30 text-white"}`}>
                Free kicks {duties.freeKicks ? "✓" : `need FK ${duties.freeKickNeeded}`}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${duties.penalties ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-300/30" : "bg-black/30 text-white"}`}>
                Penalties {duties.penalties ? "✓" : `need FK ${duties.penaltyNeeded}`}
              </span>
            </div>
          </Panel>
          <Panel tone="#fb923c" title={<>👟 Boots — {career.currentBoot.name}</>}>
            <div className="mt-1 text-[11px] font-bold text-white">
              {career.currentBoot.matches} matches remaining · Pow +{career.currentBoot.power} · Tec +{career.currentBoot.technique}
            </div>
          </Panel>
          <Panel tone="#34d399" title="⚡ Skills">
            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
              {(["pace", "power", "technique", "vision", "freeKick"] as const).map((k) => (
                <div key={k} className="rounded-lg bg-black/30 py-1 ring-1 ring-white/5">
                  <div className="text-[9px] font-black uppercase text-white/75">{k === "freeKick" ? "FK" : k.slice(0, 4)}</div>
                  <div className="text-sm font-black tabular-nums text-emerald-300">{career.skills[k]}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
