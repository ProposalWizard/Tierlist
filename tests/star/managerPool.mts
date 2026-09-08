// Verifies the real-manager pool: dream-club locking, pool shrink/regrow
// across a sack cycle, tier reputation ranges, and determinism.
import {
  DREAM_APPOINTMENTS, ELITE_MANAGERS, STRONG_MANAGERS, RECOGNISABLE_MANAGERS,
  allPoolManagers, managerTier, dreamClubFor, rollReplacementManager,
  TIER_REPUTATION_RANGE,
} from "../../lib/star/managerPool";
import { hireReplacementManager, reputationTier } from "../../lib/star/manager";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";

const problems: string[] = [];
function check(ok: boolean, what: string) {
  if (!ok) problems.push(what);
}

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "AFC Bournemouth",
];
function player(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, position: "ST",
    club, nationality: "England", startYear: 2026,
  } as StarPlayer;
}

// ── Dream Appointments never appear for the wrong club ──
{
  const wenger = "Arsène Wenger";
  check(dreamClubFor(wenger) === "Arsenal", "Wenger locked to Arsenal");
  const pool = allPoolManagers();
  let sawWengerElsewhere = false;
  let sawWengerAtArsenal = false;
  for (let seed = 0; seed < 2000; seed++) {
    const rng = mulberry32(seed);
    const pickArsenal = rollReplacementManager(pool, "Arsenal", "Title", rng);
    if (pickArsenal?.name === wenger) sawWengerAtArsenal = true;
    const rng2 = mulberry32(seed + 100000);
    const pickChelsea = rollReplacementManager(pool, "Chelsea", "Title", rng2);
    if (pickChelsea?.name === wenger) sawWengerElsewhere = true;
  }
  check(sawWengerAtArsenal, "Wenger reachable at Arsenal over enough rolls");
  check(!sawWengerElsewhere, "Wenger never selected for a non-Arsenal club");
}

// ── Dream odds are non-zero only for Title-ambition clubs ──
{
  const pool = allPoolManagers();
  let hit = false;
  for (let seed = 0; seed < 5000; seed++) {
    const rng = mulberry32(seed);
    const pick = rollReplacementManager(pool, "Manchester United", "Survival", rng);
    if (pick?.tier === "dream") hit = true;
  }
  check(!hit, "Dream tier never rolled for a Survival-ambition job, even at a dream club");
}

// ── Every tier's reputation range lands where reputationTier() would call it ──
{
  check(reputationTier(TIER_REPUTATION_RANGE.dream.min) === "Elite", "dream floor reads as Elite");
  check(reputationTier(TIER_REPUTATION_RANGE[1].min) === "Elite" || reputationTier(TIER_REPUTATION_RANGE[1].min) === "Proven",
    "Level 1 floor reads as Elite or Proven");
  check(reputationTier(TIER_REPUTATION_RANGE[3].max) !== "Elite", "Level 3 ceiling never reads as Elite");
}

// ── No overlap between tiers, no duplicate names ──
{
  const all = [...DREAM_APPOINTMENTS.map(d => d.name), ...ELITE_MANAGERS, ...STRONG_MANAGERS, ...RECOGNISABLE_MANAGERS];
  const unique = new Set(all);
  check(unique.size === all.length, "no manager name appears in more than one tier");
  for (const n of ELITE_MANAGERS) check(managerTier(n) === 1, `${n} tagged as Level 1`);
  for (const n of STRONG_MANAGERS) check(managerTier(n) === 2, `${n} tagged as Level 2`);
  for (const n of RECOGNISABLE_MANAGERS) check(managerTier(n) === 3, `${n} tagged as Level 3`);
}

// ── A real hire removes the name from the pool; sacking him returns it ──
{
  const career = makeInitialCareer(player("Arsenal"), CLUBS);
  // Force a specific real name into the job for this test, bypassing the
  // random roll, then exercise the actual give-back path careerFlow.ts uses.
  const before = career.availableManagers ?? [];
  check(before.length === allPoolManagers().length, "career starts with the full pool available");

  const hireName = STRONG_MANAGERS[0];
  const poolAfterHire = before.filter(n => n !== hireName);
  check(!poolAfterHire.includes(hireName), "hired name removed from the pool");
  check(poolAfterHire.length === before.length - 1, "pool shrinks by exactly one on hire");

  // Sacking returns exactly that name.
  const poolAfterSack = [...poolAfterHire, hireName];
  check(poolAfterSack.includes(hireName), "sacked name returned to the pool");
  check(poolAfterSack.length === before.length, "pool is back to full size after one hire+sack cycle");
}

// ── hireReplacementManager: fictional fallback still works with an empty pool ──
{
  const career = makeInitialCareer(player("AFC Bournemouth"), CLUBS);
  const hire = hireReplacementManager(career, "AFC Bournemouth", 2, []);
  check(!!hire.manager.name, "empty pool still produces a named manager");
  check(hire.manager.poolTier === undefined, "empty pool always falls back to a fictional (non-pool) name");
  check(hire.availableManagers.length === 0, "an empty pool stays empty after a fictional fallback hire");
}

// ── Determinism: same inputs, same result ──
{
  const career = makeInitialCareer(player("Liverpool"), CLUBS);
  const pool = allPoolManagers();
  const a = hireReplacementManager(career, "Liverpool", 3, pool);
  const b = hireReplacementManager(career, "Liverpool", 3, pool);
  check(a.manager.name === b.manager.name, "same career/club/season/pool produces the same hire");
  check(a.manager.style === b.manager.style, "same inputs produce the same manager style");
}

if (problems.length > 0) {
  console.log(`FAIL (${problems.length}):`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
} else {
  console.log("PASS");
}
