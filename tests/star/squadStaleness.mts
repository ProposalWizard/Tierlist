import { shouldUpgradeExternalSquads } from "../../lib/star/leagueSquads";
import type { LeagueSquad } from "../../lib/star/types";

/**
 * A CLUB'S ENTRY CAN BE PRESENT, NON-EMPTY, AND STILL ENTIRELY FAKE.
 *
 * Reported directly, with a real example: a cup tie against Lincoln City
 * fielded a lineup of invented names (Luke Mbappe, Andres Watkins) even
 * though real Lincoln City data has been in the database the whole
 * time — checked directly against Supabase, not assumed. `fetchLeagueSquads`
 * falls back to `generatedSquad` per club on a failed request, and a
 * generated squad is twenty non-empty entries — so it silently passed BOTH
 * of `shouldUpgradeExternalSquads`'s existing checks (the emptiness ratio,
 * and "is this club present at all") and, once saved, would never have
 * been re-fetched for the rest of that career. Fixed by treating a club
 * whose entire roster is generated ids (`gen:${club}:${i}`, `generatedSquad`'s
 * own tell — a real fetch never produces one) as needing a re-fetch too.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function real(club: string, n = 3): LeagueSquad {
  return {
    club,
    players: Array.from({ length: n }, (_, i) => ({
      id: `sf_${club}_${i}`, name: `Real Player ${i}`, position: "CM" as const,
      overall: 65, goals: 0, assists: 0,
    })),
  };
}

function fake(club: string, n = 20): LeagueSquad {
  return {
    club,
    players: Array.from({ length: n }, (_, i) => ({
      id: `gen:${club}:${i}`, name: `Invented Name ${i}`, position: "CM" as const,
      overall: 65, goals: 0, assists: 0,
    })),
  };
}

// ── The bug, reproduced directly: an all-fake club slips past both of the
// pre-existing checks ──────────────────────────────────────────────────────
{
  const squads = [real("Arsenal"), real("Chelsea"), fake("Lincoln City")];
  check(shouldUpgradeExternalSquads(squads), "a club whose whole roster is generated ids triggers a re-fetch");
  check(shouldUpgradeExternalSquads(squads, ["Arsenal", "Chelsea", "Lincoln City"]),
    "…still true with expectedClubs supplied (every club IS present, so the old missing-club check alone would say no)");
}

// ── A genuinely healthy snapshot must not be flagged ────────────────────────
{
  const squads = [real("Arsenal"), real("Chelsea"), real("Lincoln City")];
  check(!shouldUpgradeExternalSquads(squads), "an all-real snapshot is never flagged as stale");
  check(!shouldUpgradeExternalSquads(squads, ["Arsenal", "Chelsea", "Lincoln City"]),
    "…even with expectedClubs supplied and every one of them present");
}

// ── The two pre-existing checks still work ──────────────────────────────────
{
  const mostlyEmpty: LeagueSquad[] = [real("Arsenal"), { club: "Chelsea", players: [] }, { club: "Fulham", players: [] }];
  check(shouldUpgradeExternalSquads(mostlyEmpty), "the original low-ratio-of-populated-clubs check still fires");

  const missingOne = [real("Arsenal"), real("Chelsea")];
  check(shouldUpgradeExternalSquads(missingOne, ["Arsenal", "Chelsea", "Lincoln City"]),
    "the original missing-from-expectedClubs check still fires");
  check(!shouldUpgradeExternalSquads(missingOne), "…but not when no expectedClubs list is given to check against");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a club's entry being present and non-empty no longer means it's real");
