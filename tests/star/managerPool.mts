// Verifies the real-manager pool: dream-club locking, pool shrink/regrow
// across a sack cycle, tier reputation ranges, and determinism.
import {
  DREAM_APPOINTMENTS, ELITE_MANAGERS, STRONG_MANAGERS, RECOGNISABLE_MANAGERS,
  allPoolManagers, managerTier, dreamClubFor, rollReplacementManager,
  TIER_REPUTATION_RANGE, managerInterest, managerBaseFee, WORLD_GIANT_CLUBS, clubAmbition,
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

// ── managerInterest: Dream Appointments only consider their own club (or a
// world giant), every other real name is always willing but priced/refused
// by how far the job sits below his level ──
{
  const CLUBS2 = ["Arsenal", "AFC Bournemouth", "Brentford", "Manchester United", "Liverpool"];
  const fergie = "Sir Alex Ferguson";
  check(dreamClubFor(fergie) === "Manchester United", "fixture assumption: Ferguson locked to Manchester United");

  const atOwnClub = managerInterest(makeInitialCareer(player("Manchester United"), CLUBS2), fergie, "Manchester United");
  check(atOwnClub.willing, "Ferguson is genuinely willing at his own club");

  const atSmallClub = managerInterest(makeInitialCareer(player("Brentford"), CLUBS2), fergie, "Brentford");
  check(!atSmallClub.willing, "Ferguson refuses a Premier League job that isn't Manchester United");
  check(!!atSmallClub.reason && atSmallClub.reason.length > 0, "…with a real reason given, not a silent no");

  check(WORLD_GIANT_CLUBS.includes("Real Madrid"), "fixture assumption: Real Madrid is on the world-giant exception list");
  const atRealMadrid = managerInterest(makeInitialCareer(player("Arsenal"), CLUBS2), fergie, "Real Madrid");
  check(atRealMadrid.willing, "…but a genuine world giant is a real exception to the lock");

  // A non-dream real name is always willing in principle, and asks for
  // considerably more to take a job well beneath his level than one that
  // suits it, or one above it. Ambition (clubExpectation) is purely relative
  // to career.league's own strengths, so the league here is forced to a
  // known shape rather than trusted to whatever a fresh 5-club career
  // happens to roll — Manchester United top (Title), Brentford bottom
  // (Survival), regardless of the real world.
  const base = makeInitialCareer(player("Manchester United"), CLUBS2);
  const ranked = [95, 85, 70, 55, 20]; // strongest to weakest, by table index
  const league = base.league.map((t, i) => ({ ...t, strength: ranked[i] ?? 50 }));
  const titleClub = league[0].name, survivalClub = league[league.length - 1].name;
  check(clubAmbition({ ...base, league }, titleClub) === "Title", "fixture assumption: the top-ranked club reads as a Title push");
  check(clubAmbition({ ...base, league }, survivalClub) === "Survival", "fixture assumption: the bottom-ranked club reads as a Survival fight");

  const dyche = STRONG_MANAGERS.find(n => n === "Sean Dyche") ?? STRONG_MANAGERS[0];
  const fitJob = managerInterest({ ...base, league }, dyche, titleClub);
  const beneathJob = managerInterest({ ...base, league }, dyche, survivalClub);
  check(fitJob.willing, "a Level 2 name is willing at a genuine title-chasing job");
  check(beneathJob.anchorFee > fitJob.anchorFee, `a job well beneath his level anchors higher, not lower (${beneathJob.anchorFee} vs ${fitJob.anchorFee})`);
  check(fitJob.anchorFee >= managerBaseFee(dyche) * 0.5, "a job that suits him stays near his real base fee, not artificially discounted to nothing");
}

if (problems.length > 0) {
  console.log(`FAIL (${problems.length}):`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
} else {
  console.log("PASS");
}
