import { runTransferWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * NO CLUB BUYS HALF THE DIVISION'S TRANSFER WINDOW.
 *
 * Reported directly, with real numbers from an actual fresh save's very
 * first window: one club took 17 of that window's 32 total moves. Every
 * club starts a save at an identical twenty players, so this had nothing to
 * do with squad size — it was the matching loop itself. Each listed player
 * independently asks "who is my single best-fitting buyer" against the SAME
 * unchanged snapshot every other listed player that window also reads, and
 * nothing stopped one club — whichever one `generateSquad`'s randomness
 * happened to draw a few weak positions for — from winning that question
 * over and over, for completely different sellers.
 *
 * `maxSigningsFor` fixes this with a hard per-club ceiling, fixed at the
 * club's squad size at the START of the window (see the file for the full
 * reasoning). This checks that ceiling actually holds under real
 * conditions, and that the realized distribution looks like the target this
 * was checked against: most clubs make few or no signings, only a genuinely
 * short-handed club can make more, and nobody dominates a window.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

/** A fresh division exactly the way a new save actually looks: every club
 *  at exactly twenty, generated with real per-club randomness so some clubs
 *  legitimately draw weaker rosters than others — the real condition that
 *  produced the reported bug, not a contrived one. */
function freshCareer(season: number): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return {
    ...base,
    season,
    leagueSquads: PREMIER_LEAGUE_CLUBS.map((c): LeagueSquad => ({
      club: c,
      players: generateSquad(clubNameSeed(c) + season).map((p): LeaguePlayer => ({
        id: `${c}:${p.id}`, name: p.name, position: p.position, positions: p.positions ?? [p.position],
        overall: 60 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
      })),
    })),
    // A real free-agent pool too — some of the reported pile-up was free
    // agents specifically, not just club-to-club sales.
    freeAgents: PREMIER_LEAGUE_CLUBS.slice(0, 10).flatMap((c, ci) =>
      Array.from({ length: 3 }, (_, i) => ({
        id: `fa-${ci}-${i}`, name: `Free Agent ${ci}-${i}`, position: "CM" as const,
        positions: ["CM" as const], overall: 62 + (i * 3), goals: 0, assists: 0,
      }))),
  };
}

// ── No club ever exceeds a healthy squad's cap, across many fresh saves ────
{
  let maxSeen = 0;
  let anyZero = 0, windows = 0;
  for (let season = 1; season <= 60; season++) {
    const c = freshCareer(season);
    const { moves, loans } = runTransferWindow(c, "summer", mulberry32(season * 7331 + 3));
    windows++;
    const perClub = new Map<string, number>();
    for (const m of moves) perClub.set(m.to, (perClub.get(m.to) ?? 0) + 1);
    for (const l of loans) perClub.set(l.loanClub, (perClub.get(l.loanClub) ?? 0) + 1);
    for (const n of perClub.values()) maxSeen = Math.max(maxSeen, n);
    // Some clubs untouched entirely — twenty clubs, rarely more than a
    // handful trading in one window.
    if (perClub.size < PREMIER_LEAGUE_CLUBS.length) anyZero++;
  }
  check(maxSeen <= 6,
    `no club ever takes more than a genuinely short-handed club's own ceiling, across sixty fresh saves' first windows (worst seen: ${maxSeen})`);
  check(anyZero === windows,
    `every single one of those windows leaves at least one club untouched entirely (${anyZero}/${windows})`);
}

// ── A short-handed club is allowed more business than a full one ───────────
//
// The report also named a real, separate factor: a genuinely thin squad
// SHOULD be able to do more business than a full one — just not without
// limit either. Checked directly against the two clubs' actual outcomes
// rather than just the formula, since the cap only matters if the matching
// loop can actually reach it.
{
  function squadOfSize(seed: number, size: number): LeaguePlayer[] {
    const roles: LeaguePlayer["position"][] = [
      "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST",
      "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST",
    ];
    const rng = mulberry32(seed);
    return Array.from({ length: size }, (_, i) => ({
      id: `s${seed}-${i}`, name: `Player ${seed}-${i}`, position: roles[i % roles.length],
      positions: [roles[i % roles.length]], overall: 65 + Math.floor(rng() * 8), goals: 0, assists: 0,
    }));
  }

  let thinMax = 0, fullMax = 0;
  for (let season = 1; season <= 80; season++) {
    const base = freshCareer(season);
    const career: CareerState = {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq => {
        if (sq.club === "Everton") return { club: "Everton", players: squadOfSize(season * 11 + 1, 11) };
        if (sq.club === "Brighton & Hove Albion") return { club: "Brighton & Hove Albion", players: squadOfSize(season * 11 + 2, 20) };
        return sq;
      }),
    };
    const { moves, loans } = runTransferWindow(career, "summer", mulberry32(season * 5009 + 4));
    const thin = moves.filter(m => m.to === "Everton").length + loans.filter(l => l.loanClub === "Everton").length;
    const full = moves.filter(m => m.to === "Brighton & Hove Albion").length + loans.filter(l => l.loanClub === "Brighton & Hove Albion").length;
    thinMax = Math.max(thinMax, thin);
    fullMax = Math.max(fullMax, full);
  }
  check(thinMax > fullMax,
    `an eleven-man club is allowed to do more business than a full twenty-man one, across eighty windows (best seen: ${thinMax} vs ${fullMax})`);
  check(fullMax <= 3, `…while the full club never exceeds a healthy squad's own ceiling (${fullMax})`);
  check(thinMax <= 6, `…and even the short-handed one has a real ceiling, not an open one (${thinMax})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — no club dominates a transfer window; a short-handed club still has a real ceiling");
