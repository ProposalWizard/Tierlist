// Shared vocabulary + validation helpers for objective conditions.
//
// The objective evaluator (lib/objectiveEvaluator.ts) matches a condition's
// nationality/club/position filters against the SoFIFA squad strings using
// case-insensitive SUBSTRING matching. That means a misspelled filter silently
// matches NOTHING — the objective looks valid but can never complete, and the
// admin gets no feedback. These helpers power:
//   1. Autocomplete pickers in the admin (exact DB strings → no typos), and
//   2. An audit that flags conditions whose filters can never match anything.
//
// Pure functions only — safe to import on both server and client.

import type { ObjectiveCondition } from "./objectiveTypes";
import { CONTINENTS } from "./continents";

// Canonical position tokens (SoFIFA spelling). The evaluator upper-cases and
// substring-matches, so "CB" matches "CB", "LCB", etc.
export const POSITION_TOKENS: string[] = [
  "GK",
  "RB", "RWB", "CB", "LB", "LWB",
  "CDM", "CM", "CAM", "RM", "LM",
  "RW", "LW", "CF", "ST",
];

const CONTINENT_SET = new Set(CONTINENTS.map(c => c.toLowerCase()));

/** Split a comma-separated filter string into trimmed, non-empty parts. */
export function splitParts(filter: string | undefined): string[] {
  if (!filter) return [];
  return filter.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * A filter token is "recognized" if at least one known value contains it as a
 * case-insensitive substring — i.e. it will actually match at least one player.
 * This mirrors the evaluator's own `value.includes(part)` logic, so a token
 * that fails this check provably matches nothing (a dead condition).
 *
 * Note: truncations like "Engl" still pass (they're substrings of "England"),
 * which is fine — they match the intended nation. What it catches is the
 * dangerous case: real typos ("Frnace") and accent mismatches ("Cote d'Ivoire"
 * vs a DB value of "Côte d'Ivoire") that match zero players.
 */
export function tokenIsRecognized(token: string, known: string[]): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  return known.some(k => k.toLowerCase().includes(t));
}

/** Position tokens are matched against the fixed POSITION_TOKENS set. */
export function positionIsRecognized(token: string): boolean {
  const t = token.trim().toUpperCase();
  if (!t) return false;
  return POSITION_TOKENS.some(p => p.includes(t) || t.includes(p));
}

export interface ObjectiveIssue {
  severity: "error" | "warning" | "info";
  message: string;
  conditionIndex?: number; // 1-based; undefined = objective-level
  group?: number;          // 1-based OR-group number, if the condition is in one
}

interface AuditableObjective {
  title: string;
  conditions: ObjectiveCondition[] | null;
  or_groups?: ObjectiveCondition[][] | null;
}

/**
 * Audit a single condition's filters for values that can never match. Returns a
 * list of human-readable problems. `knownNations` / `knownClubs` are the exact
 * distinct strings from the player DB (see /api/admin/objectives/vocab).
 */
export function auditCondition(
  cond: ObjectiveCondition,
  knownNations: string[],
  knownClubs: string[],
): string[] {
  const issues: string[] = [];

  const checkField = (raw: string | undefined, known: string[], label: string) => {
    for (const part of splitParts(raw)) {
      if (!tokenIsRecognized(part, known)) {
        issues.push(`${label} "${part}" doesn't match any known value — likely a typo or wrong spelling (matches 0 players).`);
      }
    }
  };

  // Only validate against the DB vocab when we actually have it loaded.
  if (knownNations.length > 0) {
    checkField(cond.nationality, knownNations, "Nationality");
    checkField(cond.excludeNationality, knownNations, "Excluded nationality");
  }
  if (knownClubs.length > 0) {
    checkField(cond.club, knownClubs, "Club");
    checkField(cond.excludeClub, knownClubs, "Excluded club");
  }

  for (const part of splitParts(cond.position)) {
    if (!positionIsRecognized(part)) {
      issues.push(`Position "${part}" isn't a recognised position code (e.g. ST, GK, CM).`);
    }
  }
  for (const part of splitParts(cond.excludePosition)) {
    if (!positionIsRecognized(part)) {
      issues.push(`Excluded position "${part}" isn't a recognised position code.`);
    }
  }

  for (const part of splitParts(cond.continent)) {
    if (!CONTINENT_SET.has(part.toLowerCase())) {
      issues.push(`Continent "${part}" isn't valid — use one of: ${CONTINENTS.join(", ")}.`);
    }
  }
  for (const part of splitParts(cond.excludeContinent)) {
    if (!CONTINENT_SET.has(part.toLowerCase())) {
      issues.push(`Excluded continent "${part}" isn't valid.`);
    }
  }

  // Structural problems independent of the vocab.
  if (cond.type === "win_event" && !cond.event) {
    issues.push(`Event condition has no event selected — it checks nothing.`);
  }
  const isAtMost = (cond.type === "squad_count" || cond.type === "season_stat") && cond.atMost;
  if (!isAtMost && (cond.count == null || cond.count <= 0)) {
    issues.push(`Target count is ${cond.count ?? "missing"} — a condition needs a positive target.`);
  }
  if (cond.minOvr != null && cond.maxOvr != null && cond.minOvr > cond.maxOvr) {
    issues.push(`Min OVR (${cond.minOvr}) is above Max OVR (${cond.maxOvr}) — no player can match.`);
  }
  if (cond.minAge != null && cond.maxAge != null && cond.minAge > cond.maxAge) {
    issues.push(`Min age (${cond.minAge}) is above Max age (${cond.maxAge}) — no player can match.`);
  }

  return issues;
}

/**
 * Audit a whole objective (regular conditions + OR groups). Used by the admin
 * "Audit objectives" tool to surface dead/blank conditions across everything
 * already saved in the DB.
 */
export function auditObjective(
  obj: AuditableObjective,
  knownNations: string[],
  knownClubs: string[],
): ObjectiveIssue[] {
  const out: ObjectiveIssue[] = [];
  const conditions = obj.conditions ?? [];
  const orGroups = obj.or_groups ?? [];

  if (conditions.length === 0 && orGroups.length === 0) {
    out.push({
      severity: "info",
      message: "No conditions — this objective can only be completed manually and will never auto-complete.",
    });
  }

  conditions.forEach((cond, i) => {
    for (const msg of auditCondition(cond, knownNations, knownClubs)) {
      out.push({ severity: "error", message: msg, conditionIndex: i + 1 });
    }
  });

  orGroups.forEach((group, gi) => {
    if (group.length < 2) {
      out.push({
        severity: "warning",
        message: `OR-group ${gi + 1} has ${group.length} condition${group.length === 1 ? "" : "s"} — an OR group needs at least two options to be meaningful.`,
        group: gi + 1,
      });
    }
    group.forEach((cond, ci) => {
      for (const msg of auditCondition(cond, knownNations, knownClubs)) {
        out.push({ severity: "error", message: msg, conditionIndex: ci + 1, group: gi + 1 });
      }
    });
  });

  return out;
}
