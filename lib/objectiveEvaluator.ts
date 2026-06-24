import type { ObjectiveCondition, ObjectiveProgress, SeasonCheckData, SquadPlayer, WinEvent } from "./objectiveTypes";

function playerMatchesFilter(player: SquadPlayer, cond: ObjectiveCondition): boolean {
  if (cond.nationality) {
    if (!player.nationality?.toLowerCase().includes(cond.nationality.toLowerCase())) return false;
  }
  if (cond.club) {
    if (!player.club?.toLowerCase().includes(cond.club.toLowerCase())) return false;
  }
  if (cond.position) {
    if (!player.assignedPosition?.toUpperCase().includes(cond.position.toUpperCase())) return false;
  }
  return true;
}

function competitionMatches(comp: string | undefined, season: "pl_draft" | "cl_draft"): boolean {
  if (!comp || comp === "any") return true;
  return comp === season;
}

export function evaluateObjective(
  conditions: ObjectiveCondition[],
  currentProgress: ObjectiveProgress,
  seasonData: SeasonCheckData,
): { newProgress: ObjectiveProgress; complete: boolean } {
  const newProgress: ObjectiveProgress = { ...currentProgress };

  const squadByName = new Map<string, SquadPlayer>();
  for (const p of seasonData.squad) squadByName.set(p.name, p);

  // Per-season values (not stored, only used for completing in this same season)
  const seasonValues: Record<string, number> = {};

  for (const cond of conditions) {
    if (!competitionMatches(cond.competition, seasonData.competition)) continue;

    if (cond.type === "goals" || cond.type === "assists" || cond.type === "clean_sheets") {
      let total = 0;
      for (const stats of seasonData.playerStats) {
        const p = squadByName.get(stats.name);
        if (!p || !playerMatchesFilter(p, cond)) continue;
        if (cond.type === "goals") total += stats.goals;
        else if (cond.type === "assists") total += stats.assists;
        else if (cond.type === "clean_sheets") total += stats.cleanSheets;
      }
      // Cumulative across career
      newProgress[cond.id] = (newProgress[cond.id] ?? 0) + total;
    }

    if (cond.type === "squad_count") {
      // Per-season: count players in squad matching filters (subs excluded from starters check if needed)
      const count = seasonData.squad.filter(p => playerMatchesFilter(p, cond)).length;
      // Store season value for same-season check; also track career max for display
      seasonValues[cond.id] = count;
      newProgress[cond.id] = Math.max(newProgress[cond.id] ?? 0, count);
    }

    if (cond.type === "win_event") {
      const happened = cond.event ? seasonData.events.includes(cond.event as WinEvent) : false;
      if (happened) newProgress[cond.id] = (newProgress[cond.id] ?? 0) + 1;
      seasonValues[cond.id] = newProgress[cond.id] ?? 0;
    }
  }

  // Objective is complete when ALL conditions are met
  // squad_count must be met THIS season; stats and win_events are cumulative
  const complete = conditions.every(cond => {
    if (!competitionMatches(cond.competition, seasonData.competition)) {
      // Condition doesn't apply this season — treat as already met if previously banked
      return (newProgress[cond.id] ?? 0) >= cond.count;
    }
    if (cond.type === "squad_count") {
      // Must have the squad count in THIS season
      return (seasonValues[cond.id] ?? 0) >= cond.count;
    }
    return (newProgress[cond.id] ?? 0) >= cond.count;
  });

  return { newProgress, complete };
}

// Human-readable summary of a condition
export function conditionSummary(cond: ObjectiveCondition): string {
  const filters: string[] = [];
  if (cond.nationality) filters.push(`${cond.nationality} players`);
  if (cond.club) filters.push(`${cond.club} players`);
  if (cond.position) filters.push(`${cond.position}s`);
  const filterStr = filters.length > 0 ? ` with ${filters.join(" & ")}` : "";
  const comp = cond.competition && cond.competition !== "any" ? ` (${cond.competition === "pl_draft" ? "PL Draft" : "CL Draft"})` : "";

  switch (cond.type) {
    case "goals":        return `Score ${cond.count} goal${cond.count !== 1 ? "s" : ""}${filterStr}${comp}`;
    case "assists":      return `Get ${cond.count} assist${cond.count !== 1 ? "s" : ""}${filterStr}${comp}`;
    case "clean_sheets": return `Keep ${cond.count} clean sheet${cond.count !== 1 ? "s" : ""}${filterStr}${comp}`;
    case "squad_count":  return `Have ${cond.count}+ players${filterStr} in your squad${comp}`;
    case "win_event":    return cond.event ? `${cond.event.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} × ${cond.count}${comp}` : "Achieve event";
  }
}
