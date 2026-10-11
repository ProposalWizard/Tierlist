import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, generateForCareer, mediaOf } from "../../lib/star/media/feed";
import { mulberry32 } from "../../lib/star/season";
import type { CareerDivision } from "../../lib/star/calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, Fixture, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { CareerRecord, StoredPost } from "../../lib/star/media/types";

/**
 * NO HOLES IN ANY POST (11 Oct 2026).
 *
 * The template chooser refuses a line whose body names a fact the event does
 * not have (templates/index.ts slotsFilled — "-. Thank you for the support
 * today!" was seen in the game). This scans EVERY other path that writes
 * words too: thread bodies, chants, graphic titles and captions, the
 * highlight posts, league-week posts and month-end/career posts. Over 224
 * seeded matches in four divisions it looks for "undefined", "NaN", "null",
 * "[object", an unresolved "{slot}", a score printed as "-." and a blank name
 * (" FC" with nothing before it, "  vs", an empty quote).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const BAD: [string, RegExp][] = [
  ["undefined", /undefined/],
  ["NaN", /\bNaN\b/],
  ["null", /\bnull\b/],
  ["[object", /\[object/],
  ["unresolved slot", /\{[^}]*\}/],
  ["empty score", /(^|[\s(])-\s*[.,!?]|(^|\s)-(\s|$)(?!\S)/],
  ["blank name before FC", /(^|[(@:|·—]\s*)FC\b/],
  ["FC FC", /\bFC FC\b/],
  ["blank vs", /(^|\s)vs?\.?\s*($|[(|·—])/],
  ["empty quotes", /""|''|“”/],
  ["empty possessive", /(^|\s)'s\b/],
  ["Infinity", /Infinity/],
];

function careerIn(division: CareerDivision, clubs: readonly string[], seed: number): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: clubs[(seed * 7) % clubs.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  } as StarPlayer;
  return makeInitialCareer(player, [...clubs], division);
}

function playOne(career: CareerState, rng: () => number): CareerState | null {
  const fixture: Fixture | undefined = career.fixtures.find(f => !f.played && f.week === career.week)
    ?? career.fixtures.find(f => !f.played);
  if (!fixture) return null;
  const me = `${career.player.firstName} ${career.player.lastName}`;
  const mates = (career.squad ?? []).map(p => p.name).filter(n => n && n !== me);
  const mate = () => mates[Math.floor(rng() * mates.length)] ?? "Sam Mate";
  const yourGoals = Math.floor(rng() * 4 * rng());
  const mateGoals = Math.floor(rng() * 3);
  const theirs = Math.floor(rng() * 4 * rng());
  const goals: GoalEvent[] = [];
  const hows = ["one_on_one", "cutback", "long_range", "header", "penalty", "free_kick", "tight_angle", undefined];
  for (let i = 0; i < yourGoals; i++) {
    goals.push({ minute: 5 + Math.floor(rng() * 88), scorer: me, isUserGoal: true,
      how: hows[Math.floor(rng() * hows.length)], distance: 6 + rng() * 25,
      ...(rng() < 0.4 ? { assist: mate() } : {}) });
  }
  for (let i = 0; i < mateGoals; i++) {
    goals.push({ minute: 5 + Math.floor(rng() * 88), scorer: mate(), isUserGoal: false,
      ...(rng() < 0.5 ? { assist: me } : {}) });
  }
  goals.sort((a, b) => a.minute - b.minute);
  const ours = goals.length;
  const stats: MatchStats = {
    chances: 3 + yourGoals, goals: yourGoals, assists: goals.filter(g => g.assist === me).length,
    passes: 20 + Math.floor(rng() * 30), rating: 4 + rng() * 5.5, starMan: rng() < 0.3,
    bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: 1, sponsorPay: 0, totalCash: 3,
    homeScore: fixture.home ? ours : theirs, awayScore: fixture.home ? theirs : ours,
    goalEvents: goals, minutes: rng() < 0.15 ? 30 + Math.floor(rng() * 50) : 90,
  };
  const { career: after } = creditMatchResult(career, fixture, stats);
  after.media = generateForMatch(career, after, fixture, stats);
  const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== after.player.club && r.away !== after.player.club);
  if (rest.length) after.media = generateForLeagueWeek({ ...after, media: after.media }, rest);
  return after;
}

function moments(c: CareerState, rng: () => number): [CareerRecord["moment"], string][] {
  const rival = c.league.find(t => t.name !== c.player.club)?.name ?? "Rivals FC";
  return [
    [{ kind: "award", won: true, award: "August Player of the Month", detail: "4 goals and 2 assists in August." }, "potm-1-8"],
    [{ kind: "award", won: false, award: "September Player of the Month", detail: `Someone of ${rival} takes it — 5 goals. You were 2nd on the shortlist.` }, "potm-1-9"],
    [{ kind: "award", won: false, award: "October Player of the Month", detail: `Someone of ${rival} takes it — 3 goals. You were not shortlisted.` }, "potm-1-10"],
    [{ kind: "transfer", from: c.player.club, to: rival, fee: Math.round(rng() * 5_000_000) }, "move"],
    [{ kind: "contract", club: c.player.club, wage: 1200, seasons: 3 }, "deal"],
    [{ kind: "ballon-dor", won: true, total: 1 }, "bdor"],
    [{ kind: "ballon-dor", won: false, total: 0 }, "bdor-lost"],
    [{ kind: "manager-out", name: "Old Gaffer", incoming: "New Gaffer", reason: "Results." }, "gaffer"],
    [{ kind: "call-up", nation: "England", caps: 1 }, "callup"],
    [{ kind: "captain", club: c.player.club }, "armband"],
    [{ kind: "season-end", position: 4, headline: "A good season", detail: "Fourth." }, "review"],
    [{ kind: "hall-record", record: "Most goals", holder: "Old You", was: 30, now: 31, unit: "goals" }, "hall"],
    [{ kind: "award", won: true, award: "Golden Boot", detail: "24 goals." }, "award-boot"],
  ];
}

/** Every string inside a graphic, with where it sits. */
function stringsIn(v: unknown, path: string, out: [string, string][]): void {
  if (typeof v === "string") { out.push([path, v]); return; }
  if (typeof v === "number") { if (!Number.isFinite(v)) out.push([path, String(v)]); return; }
  if (v === null) { out.push([path, "null"]); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => stringsIn(x, `${path}[${i}]`, out)); return; }
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) stringsIn(x, `${path}.${k}`, out);
}

// Graphic fields that are ids or colours, not words on screen.
const NOT_WORDS = /\.(id|clips|clipId|tint|tint2|color|colour|shirt|shorts|badge|glyph|kind|type|image|src|url|face|key|style|variant|seed)(\[\d+\])?$|\.synth\[/i;

const DIVS: [CareerDivision, readonly string[]][] = [
  ["premier", PREMIER_LEAGUE_CLUBS],
  ["championship", CHAMPIONSHIP_CLUBS],
  ["league_one", LEAGUE_ONE_CLUBS],
  ["national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS],
];

let matches = 0, posts = 0, graphics = 0, leagueWeekPosts = 0, careerPosts = 0;
const found = new Map<string, string>();
for (const [division, clubs] of DIVS) {
  for (const seed of [1, 2, 3, 4]) {
    const rng = mulberry32(seed * 977 + division.length);
    // The feed keeps only the newest posts, so each match's posts are read
    // as soon as they are made.
    const seen = new Set<string>();
    const fresh = (cc: CareerState): StoredPost[] => mediaOf(cc).posts.filter(p => !seen.has(p.id) && seen.add(p.id));
    let c: CareerState | null = careerIn(division, clubs, seed);
    const all: StoredPost[] = [];
    for (let w = 0; w < 14 && c; w++) {
      c = playOne(c, rng);
      if (c) { matches++; all.push(...fresh(c)); }
    }
    if (!c) continue;
    for (const [m, key] of moments(c, rng)) {
      try { c = { ...c, media: generateForCareer(c, m, key) }; } catch (e) { problems.push(`${division}: generateForCareer ${m.kind} threw ${(e as Error).message}`); }
      const made = fresh(c);
      careerPosts += made.length;
      all.push(...made);
    }
    for (const p of all) {
      posts++;
      if (p.scope === "league") leagueWeekPosts++;
      const texts: [string, string][] = [["text", p.text], ["author.name", p.author.name], ["author.handle", p.author.handle]];
      if (p.graphic) { graphics++; stringsIn(p.graphic, "graphic", texts); }
      for (const [where, s] of texts) {
        if (where !== "text" && NOT_WORDS.test(where)) continue;
        if (where.startsWith("graphic") && s.trim() === "" ) {
          const k = `blank ${where.replace(/\[\d+\]/g, "[]")}`;
          if (!found.has(k)) found.set(k, `${division} ${p.author.handle}: graphic field ${where} is blank (post: "${p.text.slice(0, 60)}")`);
          continue;
        }
        if (where === "text" && s.trim() === "") { found.set("blank text", `${p.author.handle} posted nothing`); continue; }
        for (const [name, re] of BAD) {
          if (re.test(s)) {
            const k = `${name} @ ${where.replace(/\[\d+\]/g, "[]")}`;
            if (!found.has(k)) found.set(k, `${division} ${p.author.handle} ${where}: "${s.slice(0, 120)}"`);
          }
        }
      }
    }
  }
}

console.log(`Scanned ${posts} posts (${graphics} with graphics, ${leagueWeekPosts} league-week) from ${matches} matches + ${careerPosts} career-moment posts`);
check(matches >= 40, `at least 40 matches played (${matches})`);
check(leagueWeekPosts > 20, `league-week posts were made (${leagueWeekPosts})`);
check(graphics > 50, `graphics were made (${graphics})`);
check(careerPosts > 30, `career moments made posts (${careerPosts})`);
for (const v of Array.from(found.values())) problems.push(v);

if (problems.length) {
  console.error("mediaTextScan FAILED:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("mediaTextScan: all checks passed");
