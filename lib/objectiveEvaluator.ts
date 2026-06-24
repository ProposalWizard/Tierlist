import type { ObjectiveCondition, ObjectiveProgress, SeasonCheckData, SquadPlayer, WinEvent } from "./objectiveTypes";
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

export function evaluateObjective(
  conditions: ObjectiveCondition[],
  currentProgress: ObjectiveProgress,
  seasonData: SeasonCheckData,
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

      const perPlayer: { name: string; value: number }[] = [];
      for (const stats of seasonData.playerStats) {
        const p = squadByName.get(stats.name);
        if (!p || !playerMatchesFilter(p, cond)) continue;
        const val = getStatValue(stats, cond.type);
        if (val > 0) perPlayer.push({ name: stats.name, value: val });
      }

      if (scope === "squad_total") {
        const seasonTotal = perPlayer.reduce((s, pp) => s + pp.value, 0);
        if (timeframe === "career") {
          newProgress[cond.id] = (currentProgress[cond.id] ?? 0) + seasonTotal;
        } else {
          seasonValues[cond.id] = seasonTotal;
          newProgress[cond.id] = Math.max(currentProgress[cond.id] ?? 0, seasonTotal);
        }
      } else {
        for (const pp of perPlayer) {
          const key = `${cond.id}__${pp.name}`;
          if (timeframe === "career") {
            newProgress[key] = (currentProgress[key] ?? 0) + pp.value;
          } else {
            seasonValues[key] = pp.value;
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
  }

  const complete = conditions.every(cond => {
    if (!competitionMatches(cond.competition, seasonData.competition)) {
      return isConditionMet(cond, newProgress, {});
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
      return desc + comp;
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
  }
}
