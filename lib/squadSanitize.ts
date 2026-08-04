import type { DraftPlayer } from "@/lib/seasonSimulator";

export const MAX_SQUAD = 20;
export const MAX_OVERALL = 99;
export const MAX_STARTERS = 11;

/**
 * Clamp a stored squad into something that cannot distort a league.
 *
 * The /ready route already validates what it is GIVEN. This exists because
 * draft_room_players is directly writable by its owner under the current RLS
 * policy, so a player can PATCH their squad through PostgREST and skip that
 * route entirely — and the simulator computes every phase rating from the
 * stored squad. Sanitising at the point of USE means the league holds up
 * whether or not security_rls_hardening_jul2026.sql has been applied.
 *
 * This is defence in depth, not a substitute for that migration: it stops
 * impossible squads (ratings of 99999, a fifty-man starting eleven), but it
 * cannot tell a legitimately drafted 99 from an invented one. Only the RLS
 * policy — or checking every player against the draft record — can do that.
 */
export function sanitizeSquad(raw: unknown): DraftPlayer[] {
  if (!Array.isArray(raw)) return [];

  const out: DraftPlayer[] = [];
  for (const entry of raw.slice(0, MAX_SQUAD)) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;

    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name) continue;

    const overall = Number(p.overall);
    if (!Number.isFinite(overall)) continue;

    const attrs = p.attrs && typeof p.attrs === "object"
      ? Object.fromEntries(
          Object.entries(p.attrs as Record<string, unknown>).map(([k, v]) => {
            const n = Number(v);
            return [k, Number.isFinite(n) ? Math.max(0, Math.min(MAX_OVERALL, Math.round(n))) : 0];
          })
        )
      : undefined;

    out.push({
      ...(p as unknown as DraftPlayer),
      name,
      overall: Math.max(1, Math.min(MAX_OVERALL, Math.round(overall))),
      isSub: p.isSub === true,
      ...(attrs ? { attrs: attrs as unknown as DraftPlayer["attrs"] } : {}),
    });
  }

  // No more than eleven starters. computePhaseRatings averages every non-sub,
  // so a squad claiming twenty starters would otherwise be rated on twenty
  // players' worth of quality against everyone else's eleven.
  let starters = 0;
  for (const p of out) {
    if (p.isSub) continue;
    starters++;
    if (starters > MAX_STARTERS) p.isSub = true;
  }

  return out;
}
