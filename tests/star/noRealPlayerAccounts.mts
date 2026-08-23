import { buildRoster, selfAccount } from "../../lib/star/media/accounts";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch } from "../../lib/star/media/feed";
import { generateSquad } from "../../lib/star/squadData";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * NO REAL FOOTBALLER GETS A SOCIAL MEDIA ACCOUNT.
 *
 * Reported directly, as a legal requirement rather than a preference: a real,
 * currently-playing professional has not consented to a fictional persona
 * posting words as if he wrote them, however supportive ("big three points
 * 💪"), and this game has no license to put them in his mouth. Club, fan,
 * rival-fan, press and stats accounts talking ABOUT a real player — third
 * person, commentary and opinion — is the legally uncomplicated part and
 * stays exactly as it was. Only your own, fictional, created player is ever
 * allowed to post as himself.
 *
 * `buildRoster` used to generate 3-4 "teammate" accounts straight off the
 * actual squad (lib/star/media/accounts.ts, until this fix). This checks the
 * fix at both the roster level (no such account exists to begin with) and
 * the end-to-end level (across real generated feeds, nobody but @self ever
 * authors a first-person post).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];

function careerAt(club: string, season: number): CareerState {
  const player: StarPlayer = {
    firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
  } as StarPlayer;
  const career = makeInitialCareer(player, CLUBS);
  // A real-ish squad, real names attached (generateSquad draws from real
  // footballer first/last name lists — see squadData.ts) — the exact shape
  // that used to get turned into "teammate" accounts.
  return { ...career, season, squad: generateSquad(season * 97 + CLUBS.indexOf(club)) };
}

// ── The roster itself never contains one ─────────────────────────────────
{
  let checked = 0;
  for (const club of CLUBS) {
    for (let season = 1; season <= 5; season++) {
      const career = careerAt(club, season);
      const roster = buildRoster(career);
      checked += roster.length;

      check(!roster.some(a => a.archetype === "teammate"),
        `buildRoster(${club}, season ${season}) contains no "teammate"-archetype account at all`);

      // Belt and braces: even under a different archetype, no account should
      // ever be named after one of the real squad's own players.
      const squadNames = new Set(career.squad.map(p => p.name));
      const impersonating = roster.filter(a => squadNames.has(a.name));
      check(impersonating.length === 0,
        `no roster account is named after a real squad player (${club} s${season}): ${impersonating.map(a => a.name).join(", ")}`);
    }
  }
  check(checked > 0, `actually checked a nonzero number of accounts (${checked})`);
}

// ── Your own player still gets one ───────────────────────────────────────
{
  const career = careerAt("Arsenal", 1);
  const self = selfAccount(career);
  check(self.archetype === "teammate", "your own account still exists, under the same voice/interest profile as before");
  check(self.id === "@self" && self.handle.length > 1, "with a real handle of its own");
}

// ── End-to-end: across real generated feeds, nobody but @self ever posts
//    as an individual player ──────────────────────────────────────────────
{
  let posts = 0, teammatePosts = 0;
  const impostors = new Set<string>();
  for (let season = 1; season <= 25; season++) {
    const career = careerAt("Arsenal", season);
    const selfHandle = selfAccount(career).handle;
    for (const week of [1, 2, 3]) {
      const fixture = career.fixtures.find(f => f.week === week);
      if (!fixture) continue;
      const stats: MatchStats = {
        chances: 6, goals: 2, assists: 2, passes: 30, rating: 8.6, starMan: true,
        bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: 2, sponsorPay: 0, totalCash: 3,
        homeScore: fixture.home ? 2 : 1, awayScore: fixture.home ? 1 : 2, minutes: 90,
      };
      const { career: after } = creditMatchResult(career, fixture, stats);
      const media = generateForMatch(career, after, fixture, stats);
      for (const p of media.posts) {
        posts++;
        if (p.author.archetype !== "teammate") continue;
        teammatePosts++;
        if (p.author.handle !== selfHandle) impostors.add(`${p.author.handle} (season ${season})`);
      }
    }
  }

  check(posts > 200, `a real volume of posts to actually check (${posts})`);
  check(teammatePosts > 0, "the \"teammate\" archetype still produces posts at all (it shouldn't have gone silent)");
  check(impostors.size === 0,
    `every single "teammate"-archetype post across twenty-five seasons was authored by the player's own account, nobody else: ${[...impostors].join(", ")}`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — no real footballer has a social media account; your own player still does");
