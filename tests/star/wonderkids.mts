import { growWonderkids, growthCeilingFor } from "../../lib/star/leagueSquads";
import { feeFor, runTransferWindow } from "../../lib/star/leagueTransfers";
import { detectWonderkidHype } from "../../lib/star/media/detect/wonderkids";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";
import type { Role } from "../../lib/star/formations";

/** A real spread of positions, not twenty identical strikers — every club's
 *  own formation needs already read the pool for who plays where, and an
 *  all-one-position pool leaves every club oversupplied at that one role
 *  and desperate at every other, which starves the matching loop of any
 *  real "need" for anyone at all. */
const REAL_POSITIONS: Role[] = ["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM", "ST", "GK", "CB", "CDM", "CM", "RW", "LW", "CAM", "ST"];

/**
 * HIGH POTENTIAL — A REAL SCOUTING JUDGEMENT WITH REAL CONSEQUENCES.
 *
 * Requested directly, alongside the admin toggle itself (sofifa_players.
 * high_potential, ticked per FC-27 row in /admin/football/players): a
 * tagged player should (1) have a real chance to grow his overall at each
 * season rollover, (2) cost more in a transfer than his age/rating alone
 * would justify, and (3) be meaningfully more likely to move to a bigger
 * club while he's still at a small one — "because they have high
 * potential." All three are measured here against the real functions,
 * not just exercised for coverage.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mkPlayer(id: string, overall: number, age: number, highPotential: boolean, position: Role = "ST", worldClassPotential = false): LeaguePlayer {
  return {
    id, name: id, position, positions: [position], overall, goals: 0, assists: 0, age,
    ...(highPotential ? { highPotential: true } : {}),
    ...(worldClassPotential ? { worldClassPotential: true } : {}),
  };
}

// ── growWonderkids: only tagged, only young, only sometimes, never past the cap ──
{
  const squads: LeagueSquad[] = [{
    club: "Test FC",
    players: [
      mkPlayer("tagged-young", 70, 19, true),
      mkPlayer("untagged-young", 70, 19, false),
      mkPlayer("tagged-old", 70, 30, true),
    ],
  }];

  let taggedYoungGrew = 0, untaggedGrew = 0, taggedOldGrew = 0;
  const trials = 400;
  for (let seed = 1; seed <= trials; seed++) {
    const out = growWonderkids(squads, mulberry32(seed * 7919 + 3));
    const p = (id: string) => out[0].players.find(x => x.id === id)!;
    if (p("tagged-young").overall > 70) taggedYoungGrew++;
    if (p("untagged-young").overall > 70) untaggedGrew++;
    if (p("tagged-old").overall > 70) taggedOldGrew++;
  }
  check(untaggedGrew === 0, `a player with no High Potential tag never grows, however many seasons pass (${untaggedGrew}/${trials})`);
  check(taggedOldGrew === 0, `a High Potential player past the age ceiling has already peaked (${taggedOldGrew}/${trials})`);
  check(taggedYoungGrew > trials * 0.4 && taggedYoungGrew < trials * 0.8,
    `a young High Potential player grows roughly at the tuned chance, not always or never (${taggedYoungGrew}/${trials})`);

  // The cap actually holds — run one player through enough seasons that,
  // uncapped, he'd sail past it. Checked against his OWN real ceiling
  // (growthCeilingFor), not a hardcoded number — see the ceiling-overlap
  // section below for why a specific High Potential player's own ceiling
  // isn't always the plain tuned default.
  let capped: LeagueSquad[] = [{ club: "Test FC", players: [mkPlayer("climber", 60, 18, true)] }];
  const climberCeiling = growthCeilingFor("climber", false);
  for (let season = 1; season <= 40; season++) {
    capped = growWonderkids(capped, mulberry32(season * 991 + 1));
    capped[0].players[0].age = 18; // stays young on purpose — isolates the OVERALL cap from the age gate
  }
  check(capped[0].players[0].overall <= climberCeiling, `growth never exceeds this specific player's own real ceiling (${climberCeiling}) however many seasons run (${capped[0].players[0].overall})`);
}

// ── The ceiling itself genuinely overlaps between tiers ────────────────────
//
// Requested directly: NOT "World Class always beats High Potential" — a
// real minority of High Potential players secretly break out into the
// World Class ceiling, and a real minority of World Class players
// underachieve into the ordinary one. Fixed per player, not re-rolled.
{
  const highCap = 92, worldClassCap = 97; // the tuned defaults, per tuning.ts
  const trials = 500;
  let highBreakouts = 0, worldClassUnderachievers = 0;
  for (let i = 0; i < trials; i++) {
    const highId = `high-player-${i}`;
    const worldClassId = `world-class-player-${i}`;
    if (growthCeilingFor(highId, false) === worldClassCap) highBreakouts++;
    if (growthCeilingFor(worldClassId, true) === highCap) worldClassUnderachievers++;
  }
  check(highBreakouts > 0 && highBreakouts < trials * 0.3,
    `a real, minority share of High Potential players genuinely break out to the World Class ceiling — some, not most, not none (${highBreakouts}/${trials})`);
  check(worldClassUnderachievers > 0 && worldClassUnderachievers < trials * 0.5,
    `a real, minority share of World Class players genuinely underachieve to the ordinary ceiling — some, but still fewer than half (${worldClassUnderachievers}/${trials})`);

  // The SAME player id always gets the SAME destiny — his own hidden
  // ceiling, decided once, not re-rolled every time this is asked.
  const first = growthCeilingFor("same-player-twice", true);
  const second = growthCeilingFor("same-player-twice", true);
  check(first === second, "the same player's ceiling is stable across repeated reads, not re-rolled each time");
}

// ── feeFor: the premium is real, and it's age-gated ────────────────────────
{
  const plain = feeFor(75);
  const taggedYoung = feeFor(75, true, 20);
  const taggedOld = feeFor(75, true, 30);
  check(taggedYoung > plain, `a High Potential fee is higher than the same rating with no tag (${taggedYoung} vs ${plain})`);
  check(Math.abs(taggedYoung - plain) > plain * 0.3, `the premium is a real multiplier, not a rounding nudge (${taggedYoung} vs ${plain})`);
  check(Math.abs(taggedOld - plain) < 1e-9, `the premium stops once the player is past the fee-premium age ceiling (${taggedOld} vs ${plain})`);
}

// ── World Class Potential: a real, STRONGER tier stacked on top ───────────
{
  const plain = feeFor(75);
  const high = feeFor(75, true, 20, false);
  const worldClass = feeFor(75, true, 20, true);
  check(worldClass > high, `a World Class fee is genuinely higher than the same player merely tagged High Potential (${worldClass} vs ${high})`);
  check(Math.abs(worldClass - high) > high * 0.2, `the World Class premium is a real extra multiplier, not a rounding nudge (${worldClass} vs ${high})`);
  const worldClassOld = feeFor(75, true, 30, true);
  check(Math.abs(worldClassOld - plain) < 1e-9, "the World Class premium is age-gated exactly the same way High Potential's own premium is");

  // World Class WITHOUT the high_potential flag set shouldn't happen in
  // practice (the admin route always sets both together), but the formula
  // itself should still read it honestly as "no premium at all" rather
  // than silently applying one — a stronger tier of nothing is still nothing.
  const worldClassAlone = feeFor(75, false, 20, true);
  check(Math.abs(worldClassAlone - plain) < 1e-9, "World Class alone, without High Potential, applies no premium — it's a stronger TIER of that flag, not an independent one");

  const squads: LeagueSquad[] = [{
    club: "Test FC",
    players: [
      mkPlayer("high-only", 70, 19, true, "ST", false),
      mkPlayer("world-class", 70, 19, true, "ST", true),
    ],
  }];
  let highGrew = 0, worldClassGrew = 0;
  const trials = 400;
  for (let seed = 1; seed <= trials; seed++) {
    const out = growWonderkids(squads, mulberry32(seed * 6659 + 11));
    const p = (id: string) => out[0].players.find(x => x.id === id)!;
    if (p("high-only").overall > 70) highGrew++;
    if (p("world-class").overall > 70) worldClassGrew++;
  }
  check(worldClassGrew > highGrew, `a World Class player grows genuinely more often than a merely High Potential one, same age and rating (${worldClassGrew}/${trials} vs ${highGrew}/${trials})`);
}

// ── A wonderkid at a small club really does move to bigger clubs more ──────
//
// Two otherwise-identical strikers at the same weak club, one tagged, one
// not. Measured across many independent transfer windows: the tagged one
// should land at a genuinely stronger club a lot more often than his
// untagged twin, which is the whole point of the reach-up bonus.
{
  function player(): StarPlayer {
    return {
      firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
      club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    } as StarPlayer;
  }

  // A real strength gradient, fully controlled — the weakest club (last in
  // the list) carries both twins; the rest are stacked progressively
  // stronger so "did he end up somewhere genuinely bigger" has a clean
  // answer.
  function buildDivision(season: number): CareerState {
    const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
    const weakClub = PREMIER_LEAGUE_CLUBS[PREMIER_LEAGUE_CLUBS.length - 1];
    const leagueSquads: LeagueSquad[] = PREMIER_LEAGUE_CLUBS.map((c, i) => {
      if (c === weakClub) {
        // A real spread of positions, and — deliberately — carrying THREE
        // extra bodies past `transfers.squadTarget` (20): `sellability`
        // treats any club at or under that target as "essentially settled",
        // selling only on a rare unhappy roll, whatever position a player
        // holds. A club genuinely over-stocked lists its players at the
        // ordinary, much higher starter/bench odds instead — the realistic
        // condition an actual selling club is in, not an edge case.
        const players = REAL_POSITIONS.map((pos, k) => mkPlayer(`${c}-fill-${k}`, 60, 25, false, pos));
        players[11] = mkPlayer("wonderkid", 66, 19, true, "ST");
        players[19] = mkPlayer("twin", 66, 19, false, "ST");
        players.push(mkPlayer(`${c}-extra-0`, 58, 27, false, "CM"));
        players.push(mkPlayer(`${c}-extra-1`, 58, 27, false, "CB"));
        players.push(mkPlayer(`${c}-extra-2`, 58, 27, false, "GK"));
        return { club: c, players };
      }
      // Every other club stacked well above the weak one, ramping up —
      // real reach-up territory for either twin — but weak specifically at
      // ST, a real gap either twin can fill (positionNeed reads whether a
      // club actually wants the position being offered, not just whether it
      // could afford an upgrade anywhere).
      const strength = 74 + i * 1.1;
      return {
        club: c,
        players: REAL_POSITIONS.map((pos, k) => mkPlayer(`${c}-${k}`, pos === "ST" ? 58 : Math.round(strength), 25, false, pos)),
      };
    });
    return { ...base, season, leagueSquads, squad: base.squad.map(p => ({ ...p, overall: 60 })) };
  }

  // Every "big" club here is deliberately out of the ordinary REACH_UP's
  // reach (gap > 5) but within the High-Potential-extended one — so ANY
  // move at all for the wonderkid is already evidence of the bonus, and
  // his average destination strength (when he moves) should run well
  // above his untagged twin's (on the rare summer-unhappy roll that still
  // lets the twin move at all, within the ordinary, tighter reach).
  const TRIALS = 400;
  let wonderkidMoves = 0, twinMoves = 0;
  let wonderkidStrengthSum = 0, twinStrengthSum = 0;
  const destStrength = (club: string) => 74 + PREMIER_LEAGUE_CLUBS.indexOf(club) * 1.1;
  for (let season = 1; season <= TRIALS; season++) {
    const career = buildDivision(season);
    const { moves } = runTransferWindow(career, "summer", mulberry32(season * 60413 + 11));
    const wkMove = moves.find(m => m.player === "wonderkid");
    const twinMove = moves.find(m => m.player === "twin");
    if (wkMove) { wonderkidMoves++; wonderkidStrengthSum += destStrength(wkMove.to); }
    if (twinMove) { twinMoves++; twinStrengthSum += destStrength(twinMove.to); }
  }
  check(wonderkidMoves > twinMoves,
    `the High Potential player moves at all more often than his untagged twin — the extended reach opens up destinations the twin can never qualify for (${wonderkidMoves} vs ${twinMoves} of ${TRIALS} windows)`);
  if (wonderkidMoves > 0 && twinMoves > 0) {
    const wkAvg = wonderkidStrengthSum / wonderkidMoves, twinAvg = twinStrengthSum / twinMoves;
    check(wkAvg > twinAvg,
      `when he does move, the High Potential player's average destination is a stronger club than his twin's (${wkAvg.toFixed(1)} vs ${twinAvg.toFixed(1)})`);
  }
}

// ── Media hype: only tagged players, at most one a week, respects its own chance ──
{
  const squads: LeagueSquad[] = [
    { club: "Small FC", players: [mkPlayer("hype-me", 68, 18, true), mkPlayer("nobody", 68, 18, false)] },
  ];

  // chance = 0 never fires, whatever the pool looks like.
  let firedAtZero = 0;
  for (let seed = 1; seed <= 200; seed++) {
    if (detectWonderkidHype(squads, 1, 1, mulberry32(seed), 0).length > 0) firedAtZero++;
  }
  check(firedAtZero === 0, `a media chance of 0 never features anyone (${firedAtZero}/200)`);

  // chance = 1 always fires, and only ever names the tagged player.
  let firedAtOne = 0, namedUntagged = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const out = detectWonderkidHype(squads, 1, 1, mulberry32(seed), 1);
    if (out.length > 0) {
      firedAtOne++;
      check(out.length <= 1, `never more than one pick a week (saw ${out.length})`);
      if (out[0].facts.player !== "hype-me") namedUntagged++;
    }
  }
  check(firedAtOne === 200, `a media chance of 1 always features someone, when the pool has a tagged player (${firedAtOne}/200)`);
  check(namedUntagged === 0, `the untagged player is never featured, however many draws run (${namedUntagged}/200)`);

  // An empty pool (nobody tagged anywhere) never fires, even at chance 1.
  const untaggedOnly: LeagueSquad[] = [{ club: "Small FC", players: [mkPlayer("nobody", 68, 18, false)] }];
  check(detectWonderkidHype(untaggedOnly, 1, 1, mulberry32(1), 1).length === 0,
    "no tagged player anywhere in the division means no hype post, even at chance 1");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — High Potential players actually grow, cost a real premium, actually move to bigger clubs, get their own media hype, and World Class Potential stacks a genuinely stronger version of all of it on top");
