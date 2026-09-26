import { existsSync } from "node:fs";
import { trophyArt, TROPHY_ART_NAMES } from "../../lib/star/trophyArt";
import { leagueNameFor } from "../../lib/star/calendar";

/**
 * TROPHY PICTURES (24 Sep 2026): every pictured name points at a file that
 * exists, and the names are the ones the game actually uses — a typo here
 * would silently fall back to the emoji forever.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

for (const name of TROPHY_ART_NAMES) {
  const src = trophyArt(name)!;
  check(existsSync(`public${src}`), `${name}: ${src} exists`);
}
for (const d of ["premier", "championship", "league_one", "league_two", "national_league"] as const) {
  check(!!trophyArt(leagueNameFor(d)), `the ${leagueNameFor(d)} title has a picture`);
}
for (const c of ["FA Cup", "League Cup", "Champions League", "Europa League", "World Cup"]) {
  check(!!trophyArt(c), `${c} has a picture`);
}
for (const a of ["Ballon d'Or", "Golden Boot", "Player of the Month", "Player of the Season"]) {
  check(!!trophyArt(a), `${a} has a picture`);
}
check(trophyArt("Community Shield") === null, "a trophy with no picture yet returns null, so its emoji stays");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — ${TROPHY_ART_NAMES.length} trophies have real pictures, under the names the game uses`);
