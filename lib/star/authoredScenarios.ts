import { normaliseScenarioCamera } from "./scenarios";
import type { MatchScenario } from "./scenarios";
import raw from "./authoredScenarios.json";

/**
 * SCENARIOS THAT LIVE IN THE CODE.
 *
 * ── Why this exists alongside the Supabase pool ──
 *
 * `star_scenarios` (lib/star/scenarioStore.ts) is the LIVE path: a save from
 * the gallery or the builder is on every device a second later, with no
 * deploy. That is the right shape for iterating, and it is not going away.
 *
 * It is also the only copy. A dropped table, a wrong DELETE, a project
 * restored from a week-old backup — and hand-placed geometry nobody has a
 * second copy of is gone. Asked for directly: "it's super important that we
 * have a way to save the scenarios straight into the code through the
 * website so when something is saved it is permanently changed across the
 * repo." This file is that second, stronger path. A scenario committed here
 * is in git: it is reviewable, revertible, and survives anything that
 * happens to the database.
 *
 * Nothing here is generated at build time and nothing is hidden: the pool is
 * a plain JSON file a person can read and a diff can show. The Scenario
 * Gallery's "Commit to repo" button is what writes it
 * (app/api/star/scenarios/commit/route.ts), through the GitHub Contents API.
 *
 * ── Why a loader rather than importing the JSON directly ──
 *
 * The file is written by an API route and can be hand-edited, so it is the
 * one place a malformed scenario could enter the game. Validating here, once,
 * means a bad entry is DROPPED with a console warning rather than handed to a
 * renderer that assumes it has coordinates. Mirrors `scenarioStore.ts`'s own
 * reason for validating what comes back off the wire.
 */

interface RawFile {
  scenarios?: Record<string, unknown>;
}

/** As deep as a reader actually relies on. Deliberately the same shape check
 *  `scenarioStore.ts` and the scenarios API route each apply to their own
 *  input — three doors into one pool, each checking what comes through it. */
export function isMatchScenario(s: unknown): s is MatchScenario {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  const sc = s as Record<string, unknown>;
  if (typeof sc.id !== "string" || !sc.id.trim()) return false;
  if (typeof sc.name !== "string") return false;
  if (typeof sc.kind !== "string" || !sc.kind) return false;
  const cam = sc.camera as Record<string, unknown> | undefined;
  if (!cam
    || !Number.isFinite(cam.centerX as number) || !Number.isFinite(cam.centerY as number)
    || !Number.isFinite(cam.viewHeight as number) || typeof cam.facing !== "string") return false;
  const ball = sc.ball as Record<string, unknown> | undefined;
  if (!ball || !Number.isFinite(ball.x as number) || !Number.isFinite(ball.y as number)) return false;
  if (!Array.isArray(sc.players)) return false;
  return sc.players.every((p) => {
    if (!p || typeof p !== "object") return false;
    const pl = p as Record<string, unknown>;
    return typeof pl.id === "string" && typeof pl.side === "string"
      && Number.isFinite(pl.x as number) && Number.isFinite(pl.y as number);
  });
}

/** Every valid authored scenario, keyed by id. Built once at module load —
 *  the file is a build-time constant, so there is nothing to re-read. */
export const AUTHORED_SCENARIOS: Record<string, MatchScenario> = (() => {
  const out: Record<string, MatchScenario> = {};
  const src = (raw as RawFile).scenarios;
  if (!src || typeof src !== "object") return out;
  for (const [id, value] of Object.entries(src)) {
    if (isMatchScenario(value)) out[id] = normaliseScenarioCamera(value);
    else if (typeof console !== "undefined") {
      console.warn(`authoredScenarios.json: dropping "${id}" — not a MatchScenario`);
    }
  }
  return out;
})();

/** Newest first, matching `listScenarios()` so either pool reads the same way. */
export function authoredScenarioList(): MatchScenario[] {
  return Object.values(AUTHORED_SCENARIOS).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function authoredScenario(id: string): MatchScenario | null {
  return AUTHORED_SCENARIOS[id] ?? null;
}

/**
 * Merge scenarios INTO the current file's own parsed contents, keyed by id,
 * and hand back the exact text to commit.
 *
 * Merging (never replacing) is the whole safety property: a commit only ever
 * touches the ids it carries, so two people committing different scenarios
 * cannot wipe each other's work, and a hand-added entry survives every
 * commit but one of its own id. The same reasoning `fetchSharedScenarios`
 * already had to apply to the database path.
 *
 * Two-space JSON with a trailing newline so a real git diff shows one
 * scenario changing, not the whole file reflowing.
 */
export function mergeAuthoredFile(
  currentText: string,
  incoming: MatchScenario[],
): { text: string; added: string[]; replaced: string[] } {
  let parsed: RawFile & Record<string, unknown>;
  try {
    const p = JSON.parse(currentText);
    parsed = (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
  } catch {
    // An unparseable file is not something to silently flatten — but neither
    // is it a reason to refuse the write and lose the scenario. Start from an
    // empty pool and keep going; git still holds whatever was there before.
    parsed = {};
  }
  const scenarios: Record<string, unknown> =
    (parsed.scenarios && typeof parsed.scenarios === "object" && !Array.isArray(parsed.scenarios))
      ? { ...(parsed.scenarios as Record<string, unknown>) }
      : {};

  const added: string[] = [];
  const replaced: string[] = [];
  for (const sc of incoming) {
    if (Object.prototype.hasOwnProperty.call(scenarios, sc.id)) replaced.push(sc.id);
    else added.push(sc.id);
    scenarios[sc.id] = sc;
  }

  const next = { ...parsed, scenarios };
  return { text: `${JSON.stringify(next, null, 2)}\n`, added, replaced };
}

/**
 * Remove scenarios from the file's own parsed contents, by id.
 *
 * The mirror of `mergeAuthoredFile`, for the gallery's Delete button. Because
 * the gallery display now reads the committed file (not just Supabase),
 * deleting a committed scenario ONLY from the database would leave it to
 * reappear from the file on the next load — so a real delete has to reach
 * the code too. `removed` names what was actually there to take out, so the
 * caller can tell "deleted 1" from "there was nothing to delete".
 */
export function removeFromAuthoredFile(
  currentText: string,
  ids: string[],
): { text: string; removed: string[] } {
  let parsed: RawFile & Record<string, unknown>;
  try {
    const p = JSON.parse(currentText);
    parsed = (p && typeof p === "object" && !Array.isArray(p)) ? p : {};
  } catch {
    parsed = {};
  }
  const scenarios: Record<string, unknown> =
    (parsed.scenarios && typeof parsed.scenarios === "object" && !Array.isArray(parsed.scenarios))
      ? { ...(parsed.scenarios as Record<string, unknown>) }
      : {};

  const removed: string[] = [];
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(scenarios, id)) {
      delete scenarios[id];
      removed.push(id);
    }
  }
  const next = { ...parsed, scenarios };
  return { text: `${JSON.stringify(next, null, 2)}\n`, removed };
}
