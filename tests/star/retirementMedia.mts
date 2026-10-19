import { buildLeagueSquad, type RosterRow } from "../../lib/star/leagueSquads";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { generateForRollover, mediaOf } from "../../lib/star/media/feed";
import { notableRetirements, promisingRegens, FAMOUS_MIN_OVERALL } from "../../lib/star/retirementNews";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, CHAMPIONS_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, StarPlayer } from "../../lib/star/types";
import type { StoredPost } from "../../lib/star/media/types";

/**
 * RETIREMENTS AND REGENS IN THE FEED.
 *
 * A seeded world (synthetic squads with real-looking ages, as in
 * worldAgeing.mts) through the real rollover (advanceSeason), then the
 * media pass page.tsx runs after it (generateForRollover). Checks:
 *  - your own team-mates who retire always get posts, by their real name;
 *  - a famous name elsewhere gets posts; an unknown one does not;
 *  - High Potential regens get "one to watch" posts;
 *  - no post has a hole ({slot}, "undefined", "NaN", a double space);
 *  - running the same rollover's media twice adds nothing.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const POS = ["GK", "GK", "CB", "CB", "CB", "CB", "LB", "RB", "CDM", "CDM", "CM", "CM", "CM",
  "CAM", "CAM", "LW", "LW", "RW", "RW", "ST", "ST", "ST"];
const FIRST = ["Tom", "Luis", "Marco", "Kai", "Joel", "Rafa", "Ivan", "Noah", "Eli", "Sam", "Owen"];
const LAST = ["Harlow", "Benitez", "Vardo", "Okon", "Strand", "Mertel", "Quill", "Basso", "Lindell", "Ferro", "Doak"];

function roster(club: string, level: number, seed: number): RosterRow[] {
  const rng = mulberry32(seed);
  return POS.map((pos, i) => {
    const r = rng();
    const age = r < 0.15 ? 17 + Math.floor(rng() * 4) : r < 0.85 ? 21 + Math.floor(rng() * 11) : 32 + Math.floor(rng() * 5);
    return {
      id: `${club.replace(/\W/g, "").slice(0, 6)}${seed % 1000}_${i}`,
      name: `${FIRST[(seed + i) % FIRST.length]} ${LAST[(seed * 3 + i) % LAST.length]}${i}`,
      positions: pos, overall: Math.round(level + (rng() - 0.5) * 10), age, nation: "England", image: `/x/${i}.png`,
      ...(rng() < 0.2 && age < 21 ? { highPotential: true } : {}),
    };
  });
}

const make = (clubs: readonly string[], lo: number, hi: number, salt: number): LeagueSquad[] =>
  clubs.map((c, i) => buildLeagueSquad(c, roster(c, hi - (hi - lo) * (i / Math.max(1, clubs.length - 1)), salt + i * 31), true));

const you = PREMIER_LEAGUE_CLUBS[3];
const player = {
  firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
  club: you, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
} as StarPlayer;

let career: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS], "premier");
const premier = make(PREMIER_LEAGUE_CLUBS, 72, 84, 1000);
const europe = make(CHAMPIONS_LEAGUE_CLUBS.filter(c => !PREMIER_LEAGUE_CLUBS.includes(c)), 74, 86, 3000);
// One certain famous retirement abroad, one certain unknown one.
// Outfield men only: a keeper retires two years later (worldAgeing.ts).
const outfield = (sq: LeagueSquad) => sq.players.map((p, i) => ({ p, i })).filter(x => x.p.position !== "GK").map(x => x.i);
const abroad = europe[0];
const [fi, ui] = outfield(abroad).slice(-2);
abroad.players[fi] = { ...abroad.players[fi], age: 40, retireAt: 40, overall: 95 };
abroad.players[ui] = { ...abroad.players[ui], age: 40, retireAt: 40, overall: 60 };
const ownLeague = premier.find(s => s.club === you)!;
// Two of your team-mates are certain to retire (40, outfield).
const [o1, o2] = outfield(ownLeague).slice(-2);
ownLeague.players[o1] = { ...ownLeague.players[o1], age: 40, retireAt: 40 };
ownLeague.players[o2] = { ...ownLeague.players[o2], age: 40, retireAt: 40 };
const famousName = abroad.players[fi].name;
const unknownName = abroad.players[ui].name;
const ownRetirees = [ownLeague.players[o1].name, ownLeague.players[o2].name];

career = {
  ...career,
  leagueSquads: premier,
  externalSquads: [...make(CHAMPIONSHIP_CLUBS, 64, 72, 2000), ...europe],
  squad: ownLeague.players.map((p, i) => ({
    id: `sf_${p.id}`, sofifaId: p.id, name: p.name, shortName: p.name.split(" ").pop()!, position: p.position,
    seasonGoals: 0, seasonAssists: 0, careerGoals: i === o1 ? 12 : 0, careerAssists: i === o1 ? 4 : 0,
    overall: p.overall, age: p.age, ...(p.retireAt ? { retireAt: p.retireAt } : {}),
  })),
};

const allNames = new Set<string>([
  ...[...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])].flatMap(s => s.players.map(p => p.name)),
]);

const holes = (t: string) => /[{}]|undefined|NaN|null|\s{2}|\(\s*\)|,\s*[,.]/.test(t);

let totalRetire = 0, totalRegen = 0, totalOwn = 0;
let firstRoll: CareerState | null = null;
for (let s = 1; s <= 4; s++) {
  const before = career;
  const next = advanceSeason(career, false).career;
  if (!firstRoll) firstRoll = next;
  const notes = next.lastRetirements ?? [];
  const media = generateForRollover(next);
  const fresh: StoredPost[] = media.posts.filter(p => !mediaOf(before).posts.some(q => q.id === p.id));
  const retire = fresh.filter(p => p.eventId === "teammate-retires" || p.eventId === "legend-retires");
  const regen = fresh.filter(p => p.eventId === "regen-watch");
  totalRetire += retire.length; totalRegen += regen.length;
  totalOwn += fresh.filter(p => p.eventId === "teammate-retires").length;

  // Every own retiree is in the notes, every note gets at least one post.
  for (const n of notes) {
    const about = fresh.filter(p => p.id.includes(`-retire-${n.id}:`));
    check(about.length > 0, `s${s}: ${n.name} (${n.club}) retired but nobody posted`);
    check(about.every(p => p.text.includes(n.name) || p.text.toLowerCase().includes(n.name.split(" ").pop()!.toLowerCase())),
      `s${s}: a post about ${n.name} does not name him`);
    if (!n.own) check((n.overall ?? 0) >= 66, `s${s}: ${n.name} rated ${n.overall} is not famous`);
  }
  for (const p of [...retire, ...regen]) {
    check(!holes(p.text), `s${s}: post with a hole: "${p.text}"`);
  }
  // Regens named are this rollover's High Potential boys.
  const boys = promisingRegens(next, you, before.season);
  for (const b of boys) {
    check(fresh.some(p => p.id.includes(`-regen-${b.id}:`)), `s${s}: one to watch ${b.name} has no post`);
    check(b.id.startsWith(`rg${before.season}.`), `s${s}: ${b.id} is not this rollover's regen`);
  }
  // Replay: the same rollover's media again adds nothing.
  const again = generateForRollover({ ...next, media });
  check(again.posts.length === media.posts.length, `s${s}: replaying the rollover media posted again`);

  if (s === 1) {
    const ownNotes = notes.filter(n => n.own).map(n => n.name);
    for (const n of ownRetirees) check(ownNotes.includes(n), `s1: team-mate ${n} (40) is not in the retirement news`);
    check(notes.some(n => n.name === famousName), `s1: famous ${famousName} (95, 40) is not in the news`);
    check(!notes.some(n => n.name === unknownName), `s1: unknown ${unknownName} (60) should not be news`);
    for (const n of notes) check(allNames.has(n.name), `s1: ${n.name} is not a real squad name`);
    const withGoals = fresh.find(p => p.text.includes("12 goal"));
    console.log(`  season 1: ${notes.length} retirement notes, ${retire.length} retirement posts, ${regen.length} regen posts${withGoals ? ", goals-with-us line seen" : ""}`);
    for (const p of [...retire.slice(0, 6), ...regen.slice(0, 4)]) console.log(`    ${p.author.handle} [${p.scope}] ${p.text}`);
  }
  career = { ...next, media };
}
console.log(`  4 rollovers: ${totalRetire} retirement posts (${totalOwn} about team-mates), ${totalRegen} one-to-watch posts`);
check(totalOwn > 0, "no team-mate retirement post in 4 rollovers");
check(totalRegen > 0, "no one-to-watch post in 4 rollovers");

// notableRetirements: the famous threshold.
check(FAMOUS_MIN_OVERALL >= 70, "famous bar is a real bar");
check(notableRetirements([], {}, you).length === 0, "nothing retired, nothing to say");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — retirements and regens reach the feed, by name, once, with no holes");
