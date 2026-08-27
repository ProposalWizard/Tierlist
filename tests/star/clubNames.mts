import { shortClub } from "../../lib/star/media/grammar";
import { CLUB_SHORT_NAMES } from "../../lib/star/clubs";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS } from "../../lib/star/clubs";

/**
 * SHORTENED CLUB NAMES.
 *
 * Given directly, club by club, for every name on the English ladder —
 * "so that I don't have to keep telling you" — after the old suffix-
 * stripping heuristic got Nottingham Forest wrong (there is no rule that
 * turns "Nottingham Forest" into "Forest") and several others were never
 * checked against what the user actually wanted. CLUB_SHORT_NAMES
 * (clubs.ts) is now the one place that list lives; this checks shortClub
 * actually reads it, and that every real club on the ladder has an entry.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Every club on the ladder has a given short name, not a guessed one ────
for (const club of [...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS]) {
  check(club in CLUB_SHORT_NAMES, `${club} has a given short name, not the heuristic fallback`);
}

// ── shortClub reads the given list first ───────────────────────────────
const SPOT_CHECKS: [string, string][] = [
  ["Nottingham Forest", "Forest"],
  ["Manchester United", "Man United"],
  ["Manchester City", "Man City"],
  ["Wolverhampton Wanderers", "Wolves"],
  ["Queens Park Rangers", "QPR"],
  ["Preston North End", "PNE"],
  ["Middlesbrough", "Boro"],
  ["West Bromwich Albion", "West Brom"],
  ["Tottenham Hotspur", "Spurs"],
  ["Crystal Palace", "Palace"],
  ["Brighton & Hove Albion", "Brighton"],
  ["Aston Villa", "Villa"],
  ["Fulham FC", "Fulham"],
  ["Millwall FC", "Millwall"],
  ["Reading FC", "Reading"],
];
for (const [full, short] of SPOT_CHECKS) {
  check(shortClub(full) === short, `shortClub("${full}") is "${short}" (got "${shortClub(full)}")`);
}

// ── A club not on the given list still falls back sanely (the old
// heuristic, for Champions League/Europa League/Other clubs) ────────────
check(shortClub("Real Sociedad") === "Real Sociedad", "an ungiven club still gets a name, not a crash");
check(shortClub("FC Bayern München").length > 0, "…any ungiven club, really");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — every English-ladder club has its given short name, read before any heuristic");
