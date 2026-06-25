import type { ObjectiveCondition, ObjectiveProgress, SeasonCheckData, SeasonStatType, SquadPlayer, WinEvent } from "./objectiveTypes";
import { WIN_EVENT_OPTIONS } from "./objectiveTypes";

const WIN_EVENT_LABELS: Record<string, string> = Object.fromEntries(
  WIN_EVENT_OPTIONS.map(o => [o.value, o.label])
);

function playerMatchesFilter(player: SquadPlayer, cond: ObjectiveCondition): boolean {
  if (cond.nationality) {
    if (!player.nationality?.toLowerCase().includes(cond.nationality.toLowerCase())) return false;
  }
  if (cond.club) {
    if (!player.club?.toLowerCase().includes(cond.club.toLowerCase())) return false;
  }
  if (cond.position) {
    const posMatch = cond.positionMatch ?? "assigned";
    if (posMatch === "assigned") {
      if (!player.assignedPosition?.toUpperCase().includes(cond.position.toUpperCase())) return false;
    } else {
      const natural = (player.naturalPositions ?? player.assignedPosition ?? "").toUpperCase();
      if (!natural.includes(cond.position.toUpperCase())) return false;
    }
  }
  return true;
}

function competitionMatches(comp: string | undefined, season: "pl_draft" | "cl_draft"): boolean {
  if (!comp || comp === "any") return true;
  return comp === season;
}

function getStatValue(stats: { goals: number; assists: number; cleanSheets: number }, type: string): number {
  if (type === "goals") return stats.goals;
  if (type === "assists") return stats.assists;
  if (type === "clean_sheets") return stats.cleanSheets;
  return 0;
}

function longestStreak(matches: { goalsFor: number; goalsAgainst: number }[], pred: (m: { goalsFor: number; goalsAgainst: number }) => boolean): number {
  let best = 0, cur = 0;
  for (const m of matches) {
    if (pred(m)) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }
  return best;
}

function computeSeasonStat(stat: SeasonStatType, matches: { goalsFor: number; goalsAgainst: number }[]): number {
  switch (stat) {
    case "wins":            return matches.filter(m => m.goalsFor > m.goalsAgainst).length;
    case "losses":          return matches.filter(m => m.goalsFor < m.goalsAgainst).length;
    case "draws":           return matches.filter(m => m.goalsFor === m.goalsAgainst).length;
    case "points":          return matches.reduce((s, m) => s + (m.goalsFor > m.goalsAgainst ? 3 : m.goalsFor === m.goalsAgainst ? 1 : 0), 0);
    case "goals_scored":    return matches.reduce((s, m) => s + m.goalsFor, 0);
    case "goals_conceded":  return matches.reduce((s, m) => s + m.goalsAgainst, 0);
    case "goal_difference": return matches.reduce((s, m) => s + (m.goalsFor - m.goalsAgainst), 0);
    case "unbeaten_run":    return longestStreak(matches, m => m.goalsFor >= m.goalsAgainst);
    case "win_streak":      return longestStreak(matches, m => m.goalsFor > m.goalsAgainst);
  }
}

export function evaluateObjective(
  conditions: ObjectiveCondition[],
  currentProgress: ObjectiveProgress,
  seasonData: SeasonCheckData,
  sameSeason?: boolean,
): { newProgress: ObjectiveProgress; complete: boolean } {
  const newProgress: ObjectiveProgress = { ...currentProgress };

  const squadByName = new Map<string, SquadPlayer>();
  for (const p of seasonData.squad) squadByName.set(p.name, p);

  const seasonValues: Record<string, number> = {};

  for (const cond of conditions) {
    if (!competitionMatches(cond.competition, seasonData.competition)) continue;

    if (cond.type === "goals" || cond.type === "assists" || cond.type === "clean_sheets") {
      const scope = cond.scope ?? "squad_total";
      const timeframe = cond.timeframe ?? "career";
      const statsSource =
        cond.withinCompetition === "pl_only" && seasonData.plPlayerStats
          ? seasonData.plPlayerStats
          : seasonData.playerStats;

      const perPlayer: { name: string; value: number }[] = [];
      for (const stats of statsSource) {
        const p = squadByName.get(stats.name);
        if (!p || !playerMatchesFilter(p, cond)) continue;
        const val = getStatValue(stats, cond.type);
        if (val > 0) perPlayer.push({ name: stats.name, value: val });
      }

      if (scope === "squad_total") {
        const seasonTotal = perPlayer.reduce((s, pp) => s + pp.value, 0);
        seasonValues[cond.id] = seasonTotal;
        if (timeframe === "career") {
          newProgress[cond.id] = (currentProgress[cond.id] ?? 0) + seasonTotal;
        } else {
          newProgress[cond.id] = Math.max(currentProgress[cond.id] ?? 0, seasonTotal);
        }
      } else {
        for (const pp of perPlayer) {
          const key = `${cond.id}__${pp.name}`;
          seasonValues[key] = pp.value;
          if (timeframe === "career") {
            newProgress[key] = (currentProgress[key] ?? 0) + pp.value;
          } else {
            newProgress[key] = Math.max(currentProgress[key] ?? 0, pp.value);
          }
        }
        if (timeframe === "career") {
          for (const key of Object.keys(currentProgress)) {
            if (key.startsWith(`${cond.id}__`) && !(key in newProgress)) {
              newProgress[key] = currentProgress[key];
            }
          }
        }
      }
    }

    if (cond.type === "squad_count") {
      const count = seasonData.squad.filter(p => playerMatchesFilter(p, cond)).length;
      seasonValues[cond.id] = count;
      newProgress[cond.id] = Math.max(newProgress[cond.id] ?? 0, count);
    }

    if (cond.type === "win_event") {
      const happened = cond.event ? seasonData.events.includes(cond.event as WinEvent) : false;
      if (cond.consecutive) {
        if (happened) {
          newProgress[cond.id] = (newProgress[cond.id] ?? 0) + 1;
        } else {
          newProgress[cond.id] = 0;
        }
      } else {
        if (happened) {
          newProgress[cond.id] = (newProgress[cond.id] ?? 0) + 1;
        }
      }
      seasonValues[cond.id] = newProgress[cond.id] ?? 0;
    }

    if (cond.type === "single_match") {
      const matchStat = cond.matchStat ?? "goals_scored";
      const matchResults = seasonData.matchResults ?? [];
      let bestThisSeason = 0;
      for (const m of matchResults) {
        const val = matchStat === "goals_scored"
          ? m.goalsFor
          : Math.max(0, m.goalsFor - m.goalsAgainst);
        if (val > bestThisSeason) bestThisSeason = val;
      }
      const career = Math.max(currentProgress[cond.id] ?? 0, bestThisSeason);
      newProgress[cond.id] = career;
      seasonValues[cond.id] = career;
    }

    // login_streak: managed by /api/objectives/check-login, leave progress unchanged
    if (cond.type === "login_streak") {
      seasonValues[cond.id] = newProgress[cond.id] ?? 0;
    }

    if (cond.type === "season_stat" && cond.seasonStat) {
      const currentMatches = seasonData.plMatchResults ?? seasonData.matchResults ?? [];
      const seasonCount = cond.seasonCount ?? 1;

      let matchSource: { goalsFor: number; goalsAgainst: number }[];
      if (seasonCount > 1 && seasonData.historicalPlMatchResults) {
        // Take the last (seasonCount - 1) historical seasons + current season, concatenated in order.
        // For streaks this correctly spans season boundaries; for cumulative stats it sums across seasons.
        const history = seasonData.historicalPlMatchResults.slice(-(seasonCount - 1));
        matchSource = [...history.flat(), ...currentMatches];
      } else {
        matchSource = currentMatches;
      }

      const stat = computeSeasonStat(cond.seasonStat, matchSource);

      if (cond.atMost) {
        const prev = currentProgress[cond.id] as number | undefined;
        newProgress[cond.id] = prev === undefined ? stat : Math.min(prev, stat);
      } else {
        newProgress[cond.id] = Math.max(currentProgress[cond.id] ?? 0, stat);
      }
      seasonValues[cond.id] = stat;
    }
  }

  const complete = conditions.every(cond => {
    if (!competitionMatches(cond.competition, seasonData.competition)) {
      return sameSeason ? false : isConditionMet(cond, newProgress, {});
    }
    if (sameSeason) {
      return isConditionMetThisSeason(cond, seasonData, seasonValues);
    }
    return isConditionMet(cond, newProgress, seasonValues);
  });

  return { newProgress, complete };
}

function isConditionMet(
  cond: ObjectiveCondition,
  progress: ObjectiveProgress,
  seasonValues: Record<string, number>,
): boolean {
  if (cond.type === "squad_count") {
    return (seasonValues[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "win_event") {
    return (progress[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "single_match") {
    return (progress[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "login_streak") {
    return (progress[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "season_stat") {
    if (cond.atMost) {
      const best = progress[cond.id] as number | undefined;
      return best !== undefined && best <= cond.count;
    }
    return (progress[cond.id] ?? 0) >= cond.count;
  }

  const scope = cond.scope ?? "squad_total";
  const timeframe = cond.timeframe ?? "career";

  if (scope === "squad_total") {
    if (timeframe === "season") {
      return (seasonValues[cond.id] ?? 0) >= cond.count;
    }
    return (progress[cond.id] ?? 0) >= cond.count;
  }

  const prefix = `${cond.id}__`;
  const source = timeframe === "season" ? seasonValues : progress;
  for (const key of Object.keys(source)) {
    if (key.startsWith(prefix) && source[key] >= cond.count) return true;
  }
  return false;
}

function isConditionMetThisSeason(
  cond: ObjectiveCondition,
  seasonData: SeasonCheckData,
  seasonValues: Record<string, number>,
): boolean {
  if (cond.type === "win_event") {
    const happened = cond.event ? seasonData.events.includes(cond.event as WinEvent) : false;
    return happened;
  }

  if (cond.type === "squad_count") {
    return (seasonValues[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "single_match") {
    return (seasonValues[cond.id] ?? 0) >= cond.count;
  }

  if (cond.type === "season_stat") {
    if (cond.atMost) {
      const val = seasonValues[cond.id] as number | undefined;
      return val !== undefined && val <= cond.count;
    }
    return (seasonValues[cond.id] ?? 0) >= cond.count;
  }

  // goals/assists/clean_sheets: use season values
  const scope = cond.scope ?? "squad_total";
  if (scope === "squad_total") {
    return (seasonValues[cond.id] ?? 0) >= cond.count;
  }
  const prefix = `${cond.id}__`;
  for (const key of Object.keys(seasonValues)) {
    if (key.startsWith(prefix) && seasonValues[key] >= cond.count) return true;
  }
  return false;
}

export function conditionSummary(cond: ObjectiveCondition): string {
  const scope = cond.scope ?? "squad_total";
  const timeframe = cond.timeframe ?? (cond.type === "squad_count" ? "season" : "career");
  const posMatch = cond.positionMatch ?? "assigned";

  const playerFilters: string[] = [];
  if (cond.nationality) playerFilters.push(cond.nationality);
  if (cond.club) playerFilters.push(cond.club);
  if (cond.position) {
    playerFilters.push(posMatch === "natural" ? `natural ${cond.position}` : `playing at ${cond.position}`);
  }

  const comp = cond.competition && cond.competition !== "any"
    ? ` (${cond.competition === "pl_draft" ? "PL Draft" : "CL Draft"})`
    : "";

  const withinComp = cond.withinCompetition === "pl_only" ? " · PL only" : "";

  const p = cond.count !== 1;

  switch (cond.type) {
    case "goals":
    case "assists":
    case "clean_sheets": {
      const verb = cond.type === "goals" ? "Score" : cond.type === "assists" ? "Get" : "Keep";
      const noun = cond.type === "goals" ? `goal${p ? "s" : ""}`
                 : cond.type === "assists" ? `assist${p ? "s" : ""}`
                 : `clean sheet${p ? "s" : ""}`;
      let desc = `${verb} ${cond.count} ${noun}`;
      if (scope === "any_player") {
        const f = playerFilters.length > 0 ? ` ${playerFilters.join(", ")}` : "";
        desc += ` with a single${f} player`;
      } else if (playerFilters.length > 0) {
        desc += ` with ${playerFilters.join(", ")} players`;
      }
      if (timeframe === "season") desc += " in one season";
      return desc + withinComp + comp;
    }

    case "squad_count": {
      const f = playerFilters.length > 0 ? ` ${playerFilters.join(", ")}` : "";
      return `Have ${cond.count}+${f} player${p ? "s" : ""} in your squad${comp}`;
    }

    case "win_event": {
      if (!cond.event) return "Achieve event";
      const label = WIN_EVENT_LABELS[cond.event] ?? cond.event.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (cond.count <= 1) return label + comp;
      const consec = cond.consecutive ? " in a row" : "";
      return `${label} ${cond.count} time${p ? "s" : ""}${consec}${comp}`;
    }

    case "single_match": {
      const matchStat = cond.matchStat ?? "goals_scored";
      if (matchStat === "goals_scored") {
        return `Score ${cond.count}+ goals in a single match${comp}`;
      }
      return `Win a match by ${cond.count}+ goals${comp}`;
    }

    case "login_streak": {
      const tf = cond.timeframe ?? "season";
      const which = tf === "career" ? "longest ever login streak" : "current login streak";
      return `Reach a ${which} of ${cond.count} day${p ? "s" : ""}`;
    }

    case "season_stat": {
      const stat = cond.seasonStat ?? "wins";
      const compLabel = comp || (cond.withinCompetition === "pl_only" ? " (PL only)" : "");
      const sc = cond.seasonCount ?? 1;
      const spanLabel = sc > 1 ? ` (across any ${sc} consecutive seasons)` : " in a single PL season";
      switch (stat) {
        case "wins":
          return `Win ${cond.count}+ matches${spanLabel}${compLabel}`;
        case "losses":
          return cond.atMost
            ? `Lose ${cond.count} or fewer matches${spanLabel}${compLabel}`
            : `Lose ${cond.count}+ matches${spanLabel}${compLabel}`;
        case "draws":
          return `Draw ${cond.count}+ matches${spanLabel}${compLabel}`;
        case "points":
          return `Earn ${cond.count}+ points${spanLabel}${compLabel}`;
        case "goals_scored":
          return `Score ${cond.count}+ team goals${spanLabel}${compLabel}`;
        case "goals_conceded":
          return cond.atMost
            ? `Concede ${cond.count} or fewer goals${spanLabel}${compLabel}`
            : `Concede ${cond.count}+ goals${spanLabel}${compLabel}`;
        case "goal_difference":
          return `Reach a goal difference of +${cond.count}${spanLabel}${compLabel}`;
        case "unbeaten_run":
          return `Go ${cond.count}+ games unbeaten in a row${sc > 1 ? ` (spanning up to ${sc} seasons)` : " in a PL season"}${compLabel}`;
        case "win_streak":
          return `Win ${cond.count}+ matches in a row${sc > 1 ? ` (spanning up to ${sc} seasons)` : " in a PL season"}${compLabel}`;
      }
    }
  }
}
