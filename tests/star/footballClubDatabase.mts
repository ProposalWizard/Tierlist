import { CLUB_DATABASE } from "../../lib/star/data/footballClubDatabase";
import { realPrestigeFactor } from "../../lib/star/investments";
import { facilitiesFor } from "../../lib/star/facilities";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
  OTHER_CLUBS, CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE REAL CLUB DATABASE — INTEGRITY, NOT JUST PRESENCE.
 *
 * Requested directly, 14 Sep 2026: a real spreadsheet the user built by
 * hand (stadium/capacity/training/youth/reputation for every real club
 * this game knows about) wired into `facilities.ts` and `investments.ts`'s
 * real prestige multiplier. The single most important thing to guard here
 * isn't that the data LOOKS right — it's that its 125 names are the EXACT
 * same 125 names clubs.ts's own combined roster uses, with no drift and no
 * near-miss spelling. This game has real, hard-won scars from exactly that
 * class of silent mismatch (see clubs.ts's own header on OTHER_CLUBS, and
 * euro.ts's on CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS both drifting
 * from what the simulation actually read) — this test exists so the SAME
 * mistake can't happen a third time with this new data source, silently,
 * without a single test ever catching it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Exact 1:1 match against clubs.ts's own combined roster ──────────────
{
  const gameClubs = new Set([
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS,
    ...OTHER_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS,
  ]);
  const dbClubs = new Set(Object.keys(CLUB_DATABASE));

  check(gameClubs.size === 125, `the game's own combined roster is genuinely 125 distinct clubs (${gameClubs.size})`);
  check(dbClubs.size === 125, `the real database has genuinely 125 entries (${dbClubs.size})`);

  const missingFromDb = [...gameClubs].filter(c => !dbClubs.has(c));
  const extraInDb = [...dbClubs].filter(c => !gameClubs.has(c));
  check(missingFromDb.length === 0, `every real game club has a database entry — none missing (${missingFromDb.join(", ")})`);
  check(extraInDb.length === 0, `the database has no entries for a club the game doesn't actually have (${extraInDb.join(", ")})`);
}

// ── Every entry is real, sane data — not a placeholder or an out-of-range value ──
{
  for (const [club, profile] of Object.entries(CLUB_DATABASE)) {
    check(profile.stadium.length > 0, `${club} has a real stadium name, not blank`);
    check(profile.capacity > 0 && profile.capacity < 200_000, `${club}'s capacity is real and plausible (${profile.capacity})`);
    for (const [field, value] of [
      ["trainingRating", profile.trainingRating], ["youthRating", profile.youthRating],
      ["currentReputation", profile.currentReputation], ["historicalReputation", profile.historicalReputation],
    ] as const) {
      check(value >= 1 && value <= 10, `${club}'s ${field} is within the real 1-10 scale (${value})`);
    }
  }
}

// ── facilities.ts genuinely reads this data, not the old per-name hash ──
{
  const madrid = facilitiesFor({} as CareerState, "Real Madrid");
  check(madrid.stadiumName === "Santiago Bernabéu", `Real Madrid's real stadium name comes through (${madrid.stadiumName})`);
  check(madrid.stadiumCapacity === CLUB_DATABASE["Real Madrid"].capacity, `…and its real capacity, not a hashed guess (${madrid.stadiumCapacity})`);
  check(madrid.trainingGroundTier === 3 && madrid.youthAcademyTier === 3,
    `a real 10/10 club reads as the top facility tier (training ${madrid.trainingGroundTier}, youth ${madrid.youthAcademyTier})`);

  // A club genuinely outside the dataset still gets SOMETHING real, via the
  // old deterministic-hash fallback — never throws, never blank.
  const invented = facilitiesFor({} as CareerState, "A Genuinely Merged Club Name");
  check(invented.stadiumName.length > 0 && invented.stadiumCapacity > 0,
    "a club genuinely outside the real dataset still falls back to real, non-empty facilities");
}

// ── investments.ts's real prestige multiplier reflects the real data ────
{
  function player(): StarPlayer {
    return {
      firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
      club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    } as StarPlayer;
  }
  const career = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);

  const madridReputation = CLUB_DATABASE["Real Madrid"].currentReputation;
  const burnleyReputation = CLUB_DATABASE["Burnley"].currentReputation;
  check(madridReputation > burnleyReputation, `the source data itself has Real Madrid rated above Burnley (${madridReputation} vs ${burnleyReputation})`);

  const madridPrestige = realPrestigeFactor("Real Madrid");
  const burnleyPrestige = realPrestigeFactor("Burnley");
  check(madridPrestige > burnleyPrestige, `…and the real prestige multiplier reflects it (${madridPrestige.toFixed(2)}x vs ${burnleyPrestige.toFixed(2)}x)`);
  check(madridPrestige <= 3.0 && burnleyPrestige >= 0.6, `both stay inside the real compressed 0.6x-3.0x band (${burnleyPrestige.toFixed(2)}-${madridPrestige.toFixed(2)})`);

  // Every one of the game's 125 real clubs now gets a genuine, data-driven
  // prestige factor — not the old flat 1x fallback for anyone outside a
  // hand-typed ~30-club list.
  const allGameClubs = [
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS,
    ...OTHER_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS,
  ];
  const stillFlatAtOne = allGameClubs.filter(c => realPrestigeFactor(c) === 1);
  check(stillFlatAtOne.length === 0,
    `no real club falls back to the old flat, undifferentiated 1x any more (${stillFlatAtOne.join(", ")})`);

  void career;
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the real football club database exactly matches clubs.ts's own 125-club roster, every field is real and in range, facilities.ts reads real stadiums/capacities/tiers, and investments.ts's prestige multiplier genuinely reflects real reputation for every club, not just a hand-typed handful");
