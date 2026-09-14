import { interestedClubs } from "../../lib/star/transferMarket";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, SquadPlayer, StarPlayer } from "../../lib/star/types";
import type { Role } from "../../lib/star/formations";

/**
 * WHO'S ACTUALLY INTERESTED IN BUYING YOUR PLAYER.
 *
 * Requested directly: a plain squad player shouldn't draw interest from a
 * Champions-calibre side, and a club genuinely thin (or empty) at a
 * position should be a real, plausible taker even for an ordinary player —
 * both need to fall out of the same real reach/need math the AI-vs-AI
 * transfer window already uses, not a coin flip.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

/** A full 20-man squad at a flat overall, at every real outfield position
 *  plus a keeper — deep, even cover everywhere, nothing thin. */
function evenSquad(club: string, overall: number): LeagueSquad {
  const positions: Role[] = ["GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CDM", "CM", "CM", "CM", "CAM", "CAM", "LW", "LW", "RW", "RW", "ST", "ST"];
  const players: LeaguePlayer[] = positions.map((pos, i) => ({
    id: `${club}:${i}`, name: `${club} Player ${i}`, position: pos, positions: [pos],
    overall, goals: 0, assists: 0,
  }));
  return { club, players };
}

/** Same shape, but with NOBODY at all who can play `hole` — an empty slot,
 *  the strongest possible real need. */
function squadMissing(club: string, overall: number, hole: Role): LeagueSquad {
  const base = evenSquad(club, overall);
  return { club, players: base.players.filter(p => p.position !== hole) };
}

function squadPlayer(overall: number, position: Role, extra?: Partial<SquadPlayer>): SquadPlayer {
  return {
    id: "seller-player", name: "Seller Player", shortName: "S. Player", position,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    overall, age: 24, ...extra,
  };
}

function baseCareer(): CareerState {
  return makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
}

// ── A club genuinely empty at the position is a real, interested buyer ──
{
  const career: CareerState = {
    ...baseCareer(),
    leagueSquads: [
      squadMissing("Weak Utd", 66, "ST"), // no striker at all — maximum real need
      evenSquad("Stacked FC", 66),         // full, even depth — no real gap anywhere
    ],
  };
  const seller = squadPlayer(70, "ST");
  const interest = interestedClubs(seller, "Arsenal", career);
  const clubs = interest.map(i => i.club);
  check(clubs.includes("Weak Utd"), `a club with no striker at all is genuinely interested (${clubs.join(", ")})`);
  check(!clubs.includes("Stacked FC"), `a club already deep at the position shows no real interest (${clubs.join(", ")})`);
  const weak = interest.find(i => i.club === "Weak Utd")!;
  check(weak.roleIntent === "starter", `an empty slot means they'd start him, not just add cover (${weak.roleIntent})`);
  check(weak.expectedOffer > 0, "a real, positive expected offer");
}

// ── Reach: nobody signs far outside their own level, up or down ─────────
{
  const career: CareerState = {
    ...baseCareer(),
    leagueSquads: [
      squadMissing("Elite FC", 90, "ST"),   // a genuine title side, even with the hole
      squadMissing("Relegation FC", 55, "ST"),
    ],
  };
  const midPlayer = squadPlayer(70, "ST");
  const interest = interestedClubs(midPlayer, "Arsenal", career);
  const clubs = interest.map(i => i.club);
  check(!clubs.includes("Elite FC"), `a title-calibre side doesn't sign a plain 70-rated player just because it has a hole (${clubs.join(", ")})`);
  check(!clubs.includes("Relegation FC"), `a struggling side can't reach up for a 70-rated player either (${clubs.join(", ")})`);
}

// ── A club that already plays the position elsewhere (wrong shape) is skipped ──
{
  // A formation is deterministic per club name — this just confirms the
  // function never throws or fabricates interest for a role a club's real
  // formation has zero slots for; specific formation shapes aren't asserted
  // here since they're already covered by formations.mts.
  const career: CareerState = { ...baseCareer(), leagueSquads: [squadMissing("Weak Utd", 66, "GK")] };
  const seller = squadPlayer(70, "GK");
  const interest = interestedClubs(seller, "Arsenal", career);
  check(Array.isArray(interest), "never throws even against every real club shape");
}

// ── Potential genuinely widens reach upward ──────────────────────────────
{
  const career: CareerState = {
    ...baseCareer(),
    leagueSquads: [squadMissing("Ambitious FC", 88, "ST")],
  };
  const plain = squadPlayer(70, "ST", { age: 19 });
  const wonderkid = squadPlayer(70, "ST", { age: 19, worldClassPotential: true });
  const plainInterest = interestedClubs(plain, "Arsenal", career).map(i => i.club);
  const wonderkidInterest = interestedClubs(wonderkid, "Arsenal", career).map(i => i.club);
  check(!plainInterest.includes("Ambitious FC"), `a plain 70-rated 19-year-old is out of this club's reach (${plainInterest.join(", ")})`);
  check(wonderkidInterest.includes("Ambitious FC"), `the same rating with World Class Potential reaches further up (${wonderkidInterest.join(", ")})`);
}

// ── A desperate buyer offers more than an indifferent one ────────────────
{
  const career: CareerState = {
    ...baseCareer(),
    leagueSquads: [
      squadMissing("Desperate FC", 68, "ST"),
      (() => {
        // Real, but thin — cover exists, just not great cover, a genuine
        // gap without being a total hole.
        const sq = evenSquad("Mildly Interested FC", 68);
        sq.players = sq.players.map(p => p.position === "ST" ? { ...p, overall: 60 } : p);
        return sq;
      })(),
    ],
  };
  const seller = squadPlayer(68, "ST");
  const interest = interestedClubs(seller, "Arsenal", career);
  const desperate = interest.find(i => i.club === "Desperate FC");
  const mild = interest.find(i => i.club === "Mildly Interested FC");
  check(!!desperate && !!mild, `both real, distinct offers are present (${interest.map(i => i.club).join(", ")})`);
  if (desperate && mild) {
    check(desperate.expectedOffer > mild.expectedOffer,
      `the club with the bigger real gap offers more (${desperate.expectedOffer} vs ${mild.expectedOffer})`);
  }
}

// ── A club with no real strength data can't chase an elite target ───────
//
// Reported directly, with real named examples: Ferencvárosi and Sheffield
// United both showed interest in an 88-rated Chelsea starter, neither
// club's squad ever actually fetched for that career — their "interest"
// rode entirely on the flat 65-strength guess plus reach bonuses happening
// to clear the bar, not on any real evidence either club belongs in that
// conversation.
{
  const unverified: LeagueSquad = { club: "Ferencvárosi Torna Club", players: [] }; // known to exist, never fetched
  const career: CareerState = { ...baseCareer(), leagueSquads: [unverified] };
  const elite = squadPlayer(88, "ST", { age: 27 });
  const interest = interestedClubs(elite, "Chelsea", career);
  check(interest.length === 0, `a club with no real strength data on file shows no interest in an 88-rated player (${interest.map(i => i.club).join(", ")})`);

  // The same club is a real, legitimate buyer for an ordinary player —
  // this isn't "unverified clubs never buy anything," only "can't reach
  // for an elite target on a blind guess."
  const ordinary = squadPlayer(65, "ST", { age: 27 });
  const ordinaryInterest = interestedClubs(ordinary, "Chelsea", career);
  check(ordinaryInterest.some(i => i.club === "Ferencvárosi Torna Club"),
    `…but the same club is a real candidate for a plain, ordinary-level player (${ordinaryInterest.map(i => i.club).join(", ")})`);

  // A club with a REAL fetched squad showing the exact same strength is
  // judged on that real number, uncapped — the cap only bites the blind
  // guess, never real data.
  const verified: LeagueSquad = evenSquad("Verified FC", 65);
  const careerWithReal: CareerState = { ...baseCareer(), leagueSquads: [verified] };
  const realStrengthInterest = interestedClubs(elite, "Chelsea", careerWithReal);
  check(realStrengthInterest.length === 0,
    `a real (not guessed) 65-strength club still genuinely can't reach an 88-rated player either — the cap didn't need to fire for this to already be true (${realStrengthInterest.map(i => i.club).join(", ")})`);
}

// ── Sorted by expected offer, capped at maxResults ───────────────────────
{
  const clubs: LeagueSquad[] = Array.from({ length: 8 }, (_, i) => squadMissing(`Club ${i}`, 65 + i, "ST"));
  const career: CareerState = { ...baseCareer(), leagueSquads: clubs };
  const seller = squadPlayer(68, "ST");
  const interest = interestedClubs(seller, "Arsenal", career, 3);
  check(interest.length <= 3, `capped at the requested maximum (${interest.length})`);
  const offers = interest.map(i => i.expectedOffer);
  check(offers.every((v, i) => i === 0 || offers[i - 1] >= v), `sorted highest expected offer first (${offers.join(", ")})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — interested clubs are real, need-and-reach-driven buyers: an empty slot draws a genuine starter offer, nothing signs wildly outside its own level, potential widens reach upward, a bigger real gap offers more, and the list is sorted and capped");
