import { previewCareer, PREVIEW_SHAPES } from "../../lib/star/retirementPreview";
import { careerOverview } from "../../lib/star/careerOverview";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { CAREER_SEASONS } from "../../lib/star/retirement";
import type { StarPlayer } from "../../lib/star/types";

/**
 * THE END OF A CAREER, WITHOUT PLAYING ONE (Leo, 5 Oct 2026).
 *
 * The made-up careers on /star-retirement-dev have to add up, or the preview
 * shows a screen no real career could produce. And the overview has to cope
 * with every save that exists: a finished career, a career still going, and
 * an old save that never recorded season-by-season history.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

for (const { id } of PREVIEW_SHAPES) {
  for (let seed = 1; seed <= 6; seed++) {
    const c = previewCareer(id, seed);
    const tag = `${id}#${seed}`;
    const o = careerOverview(c);
    const rows = c.seasonArchive ?? [];
    check(c.retired === true, `${tag}: retired`);
    check(c.season === CAREER_SEASONS, `${tag}: a whole career is ${CAREER_SEASONS} seasons (${c.season})`);
    check(o.seasons.length === c.season, `${tag}: one overview row per season (${o.seasons.length} v ${c.season})`);
    check(rows.reduce((n, r) => n + r.goals, 0) === c.careerStats.goals, `${tag}: career goals = the seasons added up`);
    check(rows.reduce((n, r) => n + r.apps, 0) === c.careerStats.appearances, `${tag}: career apps = the seasons added up`);
    check(o.totals.goals === c.careerStats.goals, `${tag}: the overview's total is the career's`);
    check(o.seasons[0].age === 16 && o.seasons[o.seasons.length - 1].age === c.player.age, `${tag}: ages run 16 to ${c.player.age}`);
    check(o.seasons.every(s => !!s.stats && !!s.world), `${tag}: every season has numbers and winners`);
    check(o.seasons.filter(s => s.live).length === 0, `${tag}: a finished career has no live season`);
    const honourTotal = o.honours.filter(h => h.competition !== "Ballon d'Or").reduce((n, h) => n + h.count, 0);
    check(honourTotal === c.trophies.length, `${tag}: the cabinet holds every trophy (${honourTotal} v ${c.trophies.length})`);
    check(o.clubs.reduce((n, cl) => n + cl.goals, 0) === c.careerStats.goals, `${tag}: club goals add up to career goals`);
    check(o.clubs.filter(cl => cl.last).length === 1 && o.clubs.find(cl => cl.last)?.club === c.player.club, `${tag}: the club you finished at is marked last`);
    check(o.spells[o.spells.length - 1].club === c.player.club, `${tag}: the journey ends where the career did`);
    check(new Set(o.clubs.map(cl => cl.club)).size === o.clubs.length, `${tag}: a club appears once, however many spells`);
    const bdRows = (c.seasonHistory ?? []).filter(r => r.ballonDor?.yourRank === 1).length;
    check(bdRows === c.ballonDorWins, `${tag}: Ballon d'Or count matches the seasons it was won (${bdRows} v ${c.ballonDorWins})`);
    for (const s of o.seasons) {
      if (s.trophies.includes("Premier League")) check(s.world?.winners.league === s.club, `${tag}: a league you won names you the winner (${s.label})`);
    }
  }
}

// The shapes are actually different careers.
{
  const legend = careerOverview(previewCareer("legend", 1));
  const oneClub = careerOverview(previewCareer("oneClub", 1));
  const journey = careerOverview(previewCareer("journeyman", 1));
  const grafter = careerOverview(previewCareer("grafter", 1));
  const quiet = careerOverview(previewCareer("quiet", 1));
  check(legend.totals.ballonDors >= 1, `the legend wins a Ballon d'Or (${legend.totals.ballonDors})`);
  check(legend.clubs.length === 3 && legend.clubs[0].years.includes("·"), `the legend goes home: Brighton twice in one card (${legend.clubs.map(c => c.years).join(" / ")})`);
  check(legend.spells.length === 4 && legend.spells[0].club === legend.spells[3].club, `and four spells on the journey (${legend.spells.map(s => s.club).join(" → ")})`);
  check(oneClub.clubs.length === 1 && !!oneClub.life.testimonial, "the one-club man gets his testimonial");
  check(journey.clubs.length === 7, `the journeyman has seven clubs (${journey.clubs.length})`);
  check(grafter.seasons.some(s => s.world?.move === "promoted"), "the grafter goes up at least once");
  check(legend.ageAtEnd === 35, `twenty seasons from 16: the last is played at 35 (${legend.ageAtEnd})`);
  check(legend.totals.goals > quiet.totals.goals && quiet.totals.goals > 0, "a legend scores more than the quiet one");
  check(quiet.clubs.length === 2 && quiet.totals.ballonDors === 0, "the quiet one: two clubs, no Ballon d'Or");
}

// The career so far (upTo): not retired, no testimonial, the seasons cut.
for (const { id } of PREVIEW_SHAPES) {
  const c = previewCareer(id, 3, { upTo: 19 });
  check(c.retired === false && c.season === 19, `${id}: upTo 19 is season 19, not retired (${c.season}, ${c.retired})`);
  check(!c.testimonial, `${id}: no testimonial before retiring`);
  check((c.seasonArchive ?? []).length === 19 && c.player.age === 34, `${id}: 19 seasons, age 34 (${c.player.age})`);
  const whole = previewCareer(id, 3);
  check(JSON.stringify(whole.seasonArchive!.slice(0, 19)) === JSON.stringify(c.seasonArchive), `${id}: the first 19 seasons match the whole career's`);
}

// A career still going: the season in progress is live, with no winners yet.
{
  const player = { firstName: "Test", lastName: "Player", age: 16, position: "ST", club: "Arsenal", nationality: "England", startYear: 2026 } as StarPlayer;
  const c = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]);
  const playing = { ...c, seasonStats: { ...c.seasonStats, appearances: 4, goals: 2, totalRating: 28, ratingCount: 4 } };
  const o = careerOverview(playing);
  check(o.seasons.length === 1 && o.seasons[0].live, "a first season in progress is one live row");
  check(!o.seasons[0].world, "with no winners yet");
  check(!o.retired, "and the career is not retired");
  const fresh = careerOverview(c);
  check(fresh.seasons.length === 1 && !fresh.seasons[0].stats, "a career with no games yet has no numbers, not zeroes");
}

// An old save: no archive, no history, only trophies and transfers.
{
  const c = previewCareer("journeyman", 2);
  const old = { ...c, seasonArchive: undefined, seasonHistory: undefined };
  const o = careerOverview(old);
  check(o.seasons.slice(0, -1).every(s => !s.world && !s.stats), "an old save's seasons have no invented numbers");
  check(!!o.seasons[o.seasons.length - 1].stats && !o.seasons[o.seasons.length - 1].live, "its last season still shows (from the season's own tally), not as live");
  check(o.seasons[0].club === "Burton Albion" && o.seasons[o.seasons.length - 1].club === "Barnsley",
    `the club each season is worked out from the transfers (${o.seasons[0].club} … ${o.seasons[o.seasons.length - 1].club})`);
  check(o.honours.length > 0 || c.trophies.length === 0, "trophies still show: they were always recorded");
  check(o.historyFrom === undefined, "and the overview knows no winners were recorded");
}

if (problems.length) { console.error("retirementPreview FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("retirementPreview: all checks passed");
