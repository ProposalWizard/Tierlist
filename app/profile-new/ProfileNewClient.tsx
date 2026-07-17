"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getTitleForLevel, MANAGER_TITLES, RARITY_COLORS, type UserProgression } from "@/lib/xp";
import type { ObjectiveCondition } from "@/lib/objectiveTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProfileProps {
  userId: string;
  profile: {
    username: string | null;
    current_streak: number;
    longest_streak: number;
    is_anonymous: boolean;
  };
}

interface SeasonReward {
  id: string;
  season: number;
  level: number;
  card_name: string | null;
  subtitle: string | null;
  image_url: string | null;
}

interface SeasonConfig {
  season: number;
  name: string;
  total_levels: number;
}

interface Objective {
  id: string;
  title: string;
  description: string | null;
  category: string;
  xp_reward: number;
  card_image_url: string | null;
  card_name: string | null;
  conditions: ObjectiveCondition[] | null;
  expires_at: string | null;
  sort_order: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEASON_END = new Date("2026-09-16T23:59:59Z");

function daysLeft(): number {
  const diff = SEASON_END.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function conditionText(c: ObjectiveCondition): string {
  const count = c.count;
  const filters: string[] = [];
  if (c.nationality) filters.push(`${c.nationality} player`);
  if (c.club) filters.push(`from ${c.club}`);
  if (c.position) filters.push(`${c.position}`);
  if (c.continent) filters.push(`from ${c.continent}`);
  if (c.minAge) filters.push(`age ≤ ${c.minAge}`);
  if (c.maxAge) filters.push(`age ≤ ${c.maxAge}`);
  if (c.minOvr) filters.push(`OVR ≥ ${c.minOvr}`);
  const qualifier = filters.length ? ` (${filters.join(", ")})` : "";
  const scope = c.scope === "squad_total" ? " combined" : "";
  const when = c.timeframe === "career" ? " in a career run" : c.timeframe === "season" ? " in a season" : "";

  switch (c.type) {
    case "goals": return `Score ${count} goal${count !== 1 ? "s" : ""}${qualifier}${scope}${when}`;
    case "assists": return `Get ${count} assist${count !== 1 ? "s" : ""}${qualifier}${scope}${when}`;
    case "clean_sheets": return `Keep ${count} clean sheet${count !== 1 ? "s" : ""}${qualifier}${when}`;
    case "squad_count": return `Have ${count} ${qualifier || "players"} in your squad`;
    case "win_event": {
      const eventMap: Record<string, string> = {
        pl_win: "Win the Premier League",
        pl_top4: "Finish Top 4",
        pl_top_half: "Finish Top Half",
        pl_complete: "Complete a PL Season",
        fa_cup_win: "Win the FA Cup",
        efl_cup_win: "Win the League Cup",
        community_shield_win: "Win the Community Shield",
        super_cup_win: "Win the Super Cup",
        cl_win: "Win the Champions League",
        cl_final: "Reach the CL Final",
        cl_sf: "Reach the CL Semi-Final",
        cl_qf: "Reach the CL Quarter-Final",
        cl_r16: "Reach the CL Round of 16",
        cl_qualify: "Qualify from CL League Phase",
        europa_win: "Win the Europa League",
        europa_final: "Reach the Europa Final",
        unbeaten: "Go Unbeaten in a Season",
        double: "Win the Double",
        treble: "Win the Treble",
      };
      return eventMap[c.event ?? ""] ?? (c.event ?? "Unknown event");
    }
    case "login_streak": return `Maintain a ${count}-day login streak`;
    case "season_stat": {
      const statMap: Record<string, string> = {
        wins: "wins", losses: "losses", draws: "draws", points: "points",
        goals_scored: "goals scored", goals_conceded: "goals conceded",
        goal_difference: "goal difference", unbeaten_run: "unbeaten run", win_streak: "win streak",
      };
      const stat = statMap[c.seasonStat ?? ""] ?? c.seasonStat ?? "";
      return c.atMost
        ? `Concede at most ${count} ${stat} in a season`
        : `Achieve ${count} ${stat} in a season`;
    }
    case "single_match": {
      const matchMap: Record<string, string> = {
        goals_scored: `Score ${count} goals in one match`,
        win_margin: `Win by ${count}+ goals`,
      };
      return matchMap[c.matchStat ?? ""] ?? `Single-match: ${count}`;
    }
    default: return `Complete ${count} task${count !== 1 ? "s" : ""}`;
  }
}

function timeLeft(isoStr: string): string {
  const ms = new Date(isoStr).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d left`;
  return `${h}h left`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardThumb({ imageUrl, name, locked }: { imageUrl: string | null; name: string | null; locked: boolean }) {
  return (
    <div className={`relative w-16 h-24 rounded-lg overflow-hidden border-2 flex-shrink-0 ${locked ? "border-gray-700 opacity-60 grayscale" : "border-amber-500/60"}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name ?? "Card"} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-b from-gray-700 to-gray-800 flex items-center justify-center">
          <span className="text-gray-500 text-xs text-center px-1">{name ?? "?"}</span>
        </div>
      )}
      {locked ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        </div>
      ) : (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
          <p className="text-[9px] text-amber-300 font-bold truncate text-center leading-tight">{name}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const OBJ_TABS = [
  { label: "Objectives", categories: ["standard", "daily", "weekly", "monthly", "elite"] },
  { label: "Foundation", categories: ["foundation"] },
  { label: "GOAT Manager", categories: ["goat"] },
  { label: "Record Breakers", categories: ["record_breaker"] },
] as const;

export default function ProfileNewClient({ userId, profile }: ProfileProps) {
  const [progression, setProgression] = useState<UserProgression | null>(null);
  const [seasonConfig, setSeasonConfig] = useState<SeasonConfig | null>(null);
  const [seasonRewards, setSeasonRewards] = useState<SeasonReward[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [unclaimedIds, setUnclaimedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [objTab, setObjTab] = useState(0);
  const [selectedObj, setSelectedObj] = useState<Objective | null>(null);

  const displayName = profile.is_anonymous ? "Anonymous" : (profile.username ?? "Manager");
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    Promise.all([
      fetch("/api/profile/progression").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/season-rewards").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/objectives").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([prog, rewards, objs]) => {
      if (prog && !prog.error) setProgression(prog);
      if (rewards) {
        setSeasonConfig(rewards.config ?? null);
        setSeasonRewards(rewards.rewards ?? []);
      }
      if (objs) {
        setObjectives(objs.objectives ?? []);
        setCompletedIds(objs.completed ?? []);
        setUnclaimedIds(objs.unclaimed ?? []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const level = progression?.level ?? 0;
  const totalXp = progression?.xp ?? 0;
  const currentLevelXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 1000;
  const xpProgress = Math.min(1, currentLevelXp / xpToNext);
  const title = getTitleForLevel(level);
  const titleColors = RARITY_COLORS[title.rarity as keyof typeof RARITY_COLORS];

  // Trophy count = unlocked rewards of category 'trophy'
  const trophyCount = (progression?.rewards ?? []).filter(r => r.category === "trophy" && r.unlocked).length;

  // Road to Legend: find prev and next milestone
  const milestones = seasonRewards.filter(r => r.image_url);
  const prevMilestone = [...milestones].reverse().find(r => r.level <= level) ?? null;
  const nextMilestone = milestones.find(r => r.level > level) ?? null;
  const seasonTotalLevels = seasonConfig?.total_levels ?? 50;
  const seasonName = seasonConfig?.name ?? "Season 1";

  let seasonProgressPct = 0;
  if (prevMilestone && nextMilestone) {
    const span = nextMilestone.level - prevMilestone.level;
    const into = level - prevMilestone.level + xpProgress;
    seasonProgressPct = span > 0 ? Math.min(100, (into / span) * 100) : 100;
  } else if (!nextMilestone) {
    seasonProgressPct = 100;
  } else {
    seasonProgressPct = nextMilestone.level > 0 ? Math.min(100, (level / nextMilestone.level) * 100) : 0;
  }

  // Filter objectives for current tab
  const currentTabCategories = OBJ_TABS[objTab].categories as readonly string[];
  const visibleObjs = objectives.filter(o => currentTabCategories.includes(o.category));
  const tabObjCounts = OBJ_TABS.map(tab => {
    const cats = tab.categories as readonly string[];
    return objectives.filter(o => cats.includes(o.category) && unclaimedIds.includes(o.id)).length;
  });

  return (
    <div className="min-h-screen bg-[#0A0A12] text-white">
      {/* Dev banner */}
      <div className="bg-amber-500/20 border-b border-amber-500/30 py-2 px-4 text-center text-sm text-amber-300">
        Development preview —{" "}
        <Link href="/profile" className="underline hover:text-amber-200">Back to live profile</Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* ── Top row: Manager Profile + Road to Legend ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Manager Profile */}
          <div className="lg:col-span-2 bg-[#13131F] border border-gray-800/60 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">Manager Profile</h2>

            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                {/* Avatar circle */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-amber-900/40">
                  {initials}
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#0A0A12] border-2 border-amber-500 flex items-center justify-center">
                  <span className="text-[9px] font-black text-amber-400">{loading ? "–" : level}</span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-lg leading-tight truncate">{displayName}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${titleColors.text} ${titleColors.border} ${titleColors.bg}`}>
                  {title.name}
                </span>
              </div>
            </div>

            {/* XP bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Level {level}</span>
                <span>{currentLevelXp.toLocaleString()} / {xpToNext.toLocaleString()} XP</span>
              </div>
              <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                  style={{ width: `${xpProgress * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{(xpToNext - currentLevelXp).toLocaleString()} XP to next level</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Level", value: loading ? "–" : level },
                { label: "Total XP", value: loading ? "–" : totalXp.toLocaleString() },
                { label: "Trophies", value: loading ? "–" : trophyCount },
                { label: "Login Streak", value: profile.current_streak > 0 ? `${profile.current_streak}d` : "0d" },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-900/60 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-black text-white mt-0.5">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Road to Legend */}
          <div className="lg:col-span-3 bg-[#13131F] border border-gray-800/60 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">Road to Legend</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{daysLeft()} days left</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-base">{seasonName}</p>
              <p className="text-gray-400 text-xs">Level {level} / {seasonTotalLevels}</p>
            </div>

            {/* Card milestones */}
            <div className="flex items-center gap-3">
              {/* Prev milestone or placeholder */}
              <div className="flex flex-col items-center gap-1.5">
                {prevMilestone ? (
                  <CardThumb imageUrl={prevMilestone.image_url} name={prevMilestone.card_name} locked={false} />
                ) : (
                  <div className="w-16 h-24 rounded-lg border-2 border-gray-700 bg-gray-800/40 flex items-center justify-center">
                    <span className="text-gray-600 text-xs">Lv.1</span>
                  </div>
                )}
                {prevMilestone && (
                  <span className="text-[10px] text-amber-400 font-semibold">Lv.{prevMilestone.level}</span>
                )}
              </div>

              {/* Progress bar between milestones */}
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 rounded-full transition-all duration-700 relative"
                    style={{ width: `${seasonProgressPct}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>{prevMilestone ? `Lv.${prevMilestone.level} unlocked` : "Season start"}</span>
                  <span>{nextMilestone ? `Lv.${nextMilestone.level} next` : "Max level"}</span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {nextMilestone
                    ? `${nextMilestone.level - level} level${nextMilestone.level - level !== 1 ? "s" : ""} to next card`
                    : "All season cards unlocked!"}
                </p>
              </div>

              {/* Next milestone or end placeholder */}
              <div className="flex flex-col items-center gap-1.5">
                {nextMilestone ? (
                  <CardThumb imageUrl={nextMilestone.image_url} name={nextMilestone.card_name} locked />
                ) : (
                  <div className="w-16 h-24 rounded-lg border-2 border-amber-500/40 bg-amber-900/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-500/60" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                )}
                {nextMilestone && (
                  <span className="text-[10px] text-gray-500 font-semibold">Lv.{nextMilestone.level}</span>
                )}
              </div>
            </div>

            {/* XP summary */}
            <div className="mt-auto pt-2 border-t border-gray-800/60 flex items-center justify-between text-xs">
              <span className="text-gray-500">Season XP progress</span>
              <span className="text-amber-400 font-bold">{totalXp.toLocaleString()} XP earned</span>
            </div>
          </div>
        </div>

        {/* ── Objectives ── */}
        <div className="bg-[#13131F] border border-gray-800/60 rounded-2xl overflow-hidden">
          {/* Header + tabs */}
          <div className="border-b border-gray-800/60 px-5 pt-5 pb-0">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Objectives</h2>
            <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
              {OBJ_TABS.map((tab, i) => {
                const count = tabObjCounts[i];
                return (
                  <button
                    key={tab.label}
                    onClick={() => { setObjTab(i); setSelectedObj(null); }}
                    className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors relative ${
                      objTab === i
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body: list + detail */}
          <div className="flex h-[460px]">
            {/* Left: objective list */}
            <div className="w-80 flex-shrink-0 border-r border-gray-800/60 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : visibleObjs.length === 0 ? (
                <div className="p-6 text-center text-gray-600 text-sm">No objectives in this category</div>
              ) : (
                <div className="p-3 space-y-1.5">
                  {visibleObjs.map(obj => {
                    const isCompleted = completedIds.includes(obj.id);
                    const isUnclaimed = unclaimedIds.includes(obj.id);
                    const isSelected = selectedObj?.id === obj.id;
                    return (
                      <button
                        key={obj.id}
                        onClick={() => setSelectedObj(obj)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                          isSelected
                            ? "bg-gray-800 ring-1 ring-amber-500/40"
                            : "hover:bg-gray-800/60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Status icon */}
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border ${
                            isCompleted
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-gray-600"
                          }`}>
                            {isCompleted && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold truncate ${isCompleted ? "text-gray-400" : "text-white"}`}>
                              {obj.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-amber-400 font-bold">+{obj.xp_reward} XP</span>
                              {obj.expires_at && !isCompleted && (
                                <span className="text-[10px] text-orange-400">{timeLeft(obj.expires_at)}</span>
                              )}
                              {isUnclaimed && (
                                <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full">Claim</span>
                              )}
                            </div>
                          </div>
                          {obj.card_image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={obj.card_image_url} alt="Card" className="w-6 h-8 object-cover rounded flex-shrink-0 opacity-80" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: detail panel */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedObj ? (
                <ObjectiveDetail
                  obj={selectedObj}
                  isCompleted={completedIds.includes(selectedObj.id)}
                  isUnclaimed={unclaimedIds.includes(selectedObj.id)}
                  onClaim={async () => {
                    await fetch(`/api/objectives/${selectedObj.id}/claim`, { method: "POST" });
                    setUnclaimedIds(prev => prev.filter(id => id !== selectedObj.id));
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <svg className="w-12 h-12 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="text-gray-600 text-sm">Select an objective to see details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Objective detail panel ───────────────────────────────────────────────────

function ObjectiveDetail({
  obj,
  isCompleted,
  isUnclaimed,
  onClaim,
}: {
  obj: Objective;
  isCompleted: boolean;
  isUnclaimed: boolean;
  onClaim: () => Promise<void>;
}) {
  const [claiming, setClaiming] = useState(false);
  const conditions: ObjectiveCondition[] = Array.isArray(obj.conditions) ? obj.conditions : [];

  const categoryLabel: Record<string, string> = {
    standard: "Standard", daily: "Daily", weekly: "Weekly", monthly: "Monthly",
    elite: "Elite", foundation: "Foundation", goat: "GOAT Manager", record_breaker: "Record Breaker",
  };
  const categoryColor: Record<string, string> = {
    standard: "text-gray-400 border-gray-600 bg-gray-800",
    daily: "text-blue-400 border-blue-600/40 bg-blue-900/20",
    weekly: "text-purple-400 border-purple-600/40 bg-purple-900/20",
    monthly: "text-indigo-400 border-indigo-600/40 bg-indigo-900/20",
    elite: "text-amber-400 border-amber-600/40 bg-amber-900/20",
    foundation: "text-emerald-400 border-emerald-600/40 bg-emerald-900/20",
    goat: "text-yellow-300 border-yellow-500/40 bg-yellow-900/20",
    record_breaker: "text-red-400 border-red-600/40 bg-red-900/20",
  };
  const catStyle = categoryColor[obj.category] ?? "text-gray-400 border-gray-600 bg-gray-800";

  return (
    <div className="space-y-5">
      {/* Title + category */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-black text-white leading-snug">{obj.title}</h3>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${catStyle}`}>
            {categoryLabel[obj.category] ?? obj.category}
          </span>
        </div>
        {obj.description && (
          <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{obj.description}</p>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-2">
        {/* XP badge */}
        <div className="flex items-center gap-1.5 bg-amber-900/30 border border-amber-600/40 rounded-lg px-3 py-1.5">
          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="text-sm font-bold text-amber-400">+{obj.xp_reward} XP</span>
        </div>

        {/* Card reward */}
        {obj.card_image_url && (
          <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={obj.card_image_url} alt={obj.card_name ?? "Card"} className="w-5 h-7 object-cover rounded" />
            <span className="text-sm font-semibold text-gray-200">{obj.card_name ?? "Card"}</span>
          </div>
        )}

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border ${
          isCompleted
            ? "bg-emerald-900/30 border-emerald-600/40"
            : "bg-gray-800 border-gray-700"
        }`}>
          {isCompleted ? (
            <>
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold text-emerald-400">Completed</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
              </svg>
              <span className="text-sm font-semibold text-gray-400">In Progress</span>
            </>
          )}
        </div>

        {/* Timer */}
        {obj.expires_at && (
          <div className="flex items-center gap-1.5 bg-orange-900/20 border border-orange-600/30 rounded-lg px-3 py-1.5">
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-orange-400">{timeLeft(obj.expires_at)}</span>
          </div>
        )}
      </div>

      {/* Requirements */}
      {conditions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-2">Requirements</h4>
          <ul className="space-y-2">
            {conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                  {i + 1}
                </span>
                <span className="text-gray-300 leading-snug">{conditionText(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Claim button */}
      {isUnclaimed && (
        <button
          onClick={async () => {
            setClaiming(true);
            await onClaim();
            setClaiming(false);
          }}
          disabled={claiming}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black py-3 rounded-xl transition-colors text-sm"
        >
          {claiming ? "Claiming…" : "Claim Reward"}
        </button>
      )}
    </div>
  );
}
