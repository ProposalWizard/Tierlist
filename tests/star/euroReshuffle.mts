import { poolFor } from "../../lib/star/euro";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * A REAL, RANDOMISED EUROPEAN FIELD FROM SEASON 2 ON.
 *
 * Requested directly, in full mechanical detail: England/Germany/Italy/
 * Spain/France's clubs never move between the Champions League and Europa
 * League; every other nation's clubs get reshuffled between the two each
 * season — freely if that nation has only one club in Europe, but split at
 * least 1-and-1 if it has two or more (exactly 1-1 if it has precisely two —
 * the worked example given directly: Scotland's three clubs must never all
 * land in the same competition). Season 1 keeps the exact given rosters.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
function careerAt(season: number): CareerState {
  return { ...base, season };
}

const EXEMPT_CLUBS_CL = ["Real Madrid", "FC Bayern München", "FC Barcelona", "Inter", "Atlético Madrid", "Napoli", "Roma", "Como", "Paris Saint-Germain", "Olympique Lyonnais"];
const EXEMPT_CLUBS_EL = ["Juventus", "AC Milan", "Lazio", "Bayer 04 Leverkusen", "Real Sociedad", "RC Celta", "Crystal Palace", "AFC Bournemouth", "Sunderland"];

// Every non-exempt nation with 2+ clubs across both fields (from the real
// static rosters) and how many it has — used to check the split rule.
const MULTI_CLUB_NATIONS: Record<string, string[]> = {
  Portugal: ["FC Porto", "Sporting CP", "SL Benfica", "Sporting Clube de Braga", "Vitória SC"],
  Netherlands: ["PSV", "Feyenoord", "Ajax", "AZ Alkmaar"],
  Turkey: ["Fenerbahçe SK", "Galatasaray SK", "Beşiktaş JK", "Trabzonspor"],
  Scotland: ["Celtic", "Rangers FC", "Hearts"],
  Belgium: ["Club Brugge KV", "RSC Anderlecht", "KRC Genk", "Union Saint-Gilloise"],
  "Czech Republic": ["SK Slavia Praha", "Sparta Praha", "Viktoria Plzeň"],
  Denmark: ["FC København", "FC Midtjylland"],
  Greece: ["AEK Athens", "Olympiacos FC", "PAOK"],
  Switzerland: ["BSC Young Boys", "FC Basel 1893"],
  Poland: ["Legia Warszawa", "Lech Poznań"],
};

// ── Season 1 is untouched — the exact given rosters ─────────────────────
{
  const cl = poolFor("Champions League", careerAt(1)).map(c => c.name);
  check(cl.includes("Real Madrid") && cl.includes("PSV") && !cl.includes("Ajax"),
    "season 1 is exactly the original static Champions League roster, no reshuffle applied");
  check(poolFor("Champions League", careerAt(1)).length === poolFor("Champions League").length,
    "…and passing a season-1 career changes nothing versus no career at all");
}

// ── From season 2 on: real reshuffling, every real constraint holds ─────
for (const season of [2, 3, 4, 5, 6]) {
  const career = careerAt(season);
  const cl = poolFor("Champions League", career);
  const el = poolFor("Europa League", career);
  const clNames = new Set(cl.map(c => c.name));
  const elNames = new Set(el.map(c => c.name));

  check(cl.length === poolFor("Champions League").length, `season ${season}: the Champions League field stays the real size (${cl.length})`);
  check(el.length === poolFor("Europa League").length, `season ${season}: the Europa League field stays the real size (${el.length})`);

  check(EXEMPT_CLUBS_CL.every(name => clNames.has(name)), `season ${season}: every exempt Champions League club never moves`);
  check(EXEMPT_CLUBS_EL.every(name => elNames.has(name)), `season ${season}: every exempt Europa League club never moves`);

  for (const [nation, clubs] of Object.entries(MULTI_CLUB_NATIONS)) {
    const inCL = clubs.filter(n => clNames.has(n)).length;
    const inEL = clubs.filter(n => elNames.has(n)).length;
    check(inCL + inEL === clubs.length, `season ${season}: ${nation}'s clubs are all still somewhere in Europe (${inCL + inEL}/${clubs.length})`);
    check(inCL >= 1 && inEL >= 1, `season ${season}: ${nation} (${clubs.length} clubs) has at least one in EACH competition (CL=${inCL}, EL=${inEL})`);
    if (clubs.length === 2) {
      check(inCL === 1 && inEL === 1, `season ${season}: ${nation}'s exactly two clubs are split precisely 1-1, never both in the same competition (CL=${inCL}, EL=${inEL})`);
    }
  }

  const total = new Set([...clNames, ...elNames]);
  check(total.size === 70, `season ${season}: all 70 real clubs are still placed somewhere, none invented or lost (${total.size})`);
}

// ── It genuinely varies season to season, not the same shuffle every time ──
{
  const s2 = poolFor("Champions League", careerAt(2)).map(c => c.name).sort().join(",");
  const s3 = poolFor("Champions League", careerAt(3)).map(c => c.name).sort().join(",");
  const s4 = poolFor("Champions League", careerAt(4)).map(c => c.name).sort().join(",");
  check(s2 !== s3 || s3 !== s4, "consecutive seasons can genuinely produce different Champions League fields, not a fixed shuffle");
}

// ── The same season is stable across repeated calls ─────────────────────
{
  const a = poolFor("Champions League", careerAt(5)).map(c => c.name).sort().join(",");
  const b = poolFor("Champions League", careerAt(5)).map(c => c.name).sort().join(",");
  check(a === b, "the same season's reshuffle is stable across repeated calls, not re-rolled every time");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — season 1 keeps the exact given rosters, every season from 2 on genuinely reshuffles non-exempt clubs between Europe's two competitions while exempt clubs never move and every multi-club nation is always split across both");
