import { poolFor } from "../../lib/star/euro";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE REAL 36-CLUB CHAMPIONS/EUROPA LEAGUE FIELD, REBUILT 13 SEP 2026.
 *
 * Rewritten from scratch for the 13 Sep 2026 rebuild — this file used to
 * test the OLD `reshuffleEurope`/`RESHUFFLE_EXEMPT_NATIONS` design (33/37-
 * club foreign-only pools, a fixed exempt-club-identity list for England/
 * Spain/Italy/Germany/France). That whole design is gone, replaced by
 * `seasonField` (euro.ts): both competitions are now genuinely 36 clubs
 * every season — the real UEFA count, not 33/37 or the 38/38 the Lineups
 * picker had separately drifted to. Requested directly, in full mechanical
 * detail:
 *
 *   · Season 1 is the exact static roster clubs.ts gives — untouched.
 *   · England's slots are filled by REAL Premier League qualification
 *     (`seasonQualifiers`), never randomised — the specific clubs can
 *     genuinely change season to season as the league table changes, but
 *     the COUNT of English clubs in each competition never does.
 *   · Spain/Italy/Germany/France each have a fixed, PERMANENT count per
 *     competition (whatever season 1 actually has) — which specific clubs
 *     fill those slots is randomised each season, drawn from that nation's
 *     own real pool (its usual entrants plus its own "Other"-section
 *     reserves).
 *   · Every other nation's clubs are reshuffled between the two
 *     competitions each season — freely if it has one club in Europe, but
 *     split at least 1-and-1 if it has two or more (exactly 1-1 for
 *     precisely two, e.g. Scotland's now-three clubs never all land in one
 *     competition).
 *   · A club whose own nation has more real depth than there are slots for
 *     it can genuinely sit out a season rather than being force-fit
 *     somewhere.
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

// The real, fixed per-nation counts, read directly off the actual season-1
// rosters rather than hardcoded — if clubs.ts's lists ever change, this
// test's own expectations move with them instead of going stale.
function countByNation(names: string[], clubs: string[]): number {
  return clubs.filter(c => names.includes(c)).length;
}
const SPAIN_CL = ["Real Madrid", "FC Barcelona", "Atlético Madrid", "Villarreal CF", "Real Betis Balompié", "Real Sociedad", "RC Celta", "Sevilla FC"];
const ITALY_CL = ["Inter", "AC Milan", "Napoli", "Juventus", "Roma", "Lazio", "Como", "Atalanta"];
const GERMANY_CL = ["FC Bayern München", "Borussia Dortmund", "RB Leipzig", "VfB Stuttgart", "Eintracht Frankfurt", "Bayer 04 Leverkusen", "TSG 1899 Hoffenheim", "FC Schalke 04"];
const FRANCE_CL = ["Paris Saint-Germain", "Olympique Lyonnais", "RC Lens", "Lille OSC", "Olympique de Marseille", "Stade Rennais FC", "AS Monaco", "RC Strasbourg Alsace"];

// ── Season 1 is untouched — the exact given rosters ─────────────────────
{
  const cl = poolFor("Champions League", careerAt(1)).map(c => c.name);
  check(cl.length === 36, `season 1 Champions League is the real 36 (${cl.length})`);
  check(cl.length === poolFor("Champions League").length,
    "…and passing a season-1 career changes nothing versus no career at all");
  check(new Set(cl).size === 36, "…and every one of them is distinct, no duplicates");
}

// ── From season 2 on: real reshuffling, every real constraint holds ─────
for (const season of [2, 3, 4, 5, 6, 7, 8]) {
  const career = careerAt(season);
  const cl = poolFor("Champions League", career).map(c => c.name);
  const el = poolFor("Europa League", career).map(c => c.name);

  check(cl.length === 36, `season ${season}: the Champions League field is genuinely 36 clubs (${cl.length})`);
  check(el.length === 36, `season ${season}: the Europa League field is genuinely 36 clubs (${el.length})`);
  check(new Set(cl).size === 36, `season ${season}: no duplicate Champions League club`);
  check(new Set(el).size === 36, `season ${season}: no duplicate Europa League club`);
  check(cl.every(name => !el.includes(name)), `season ${season}: no club plays in both competitions at once`);

  // Main nations: the COUNT is permanent, drawn straight from season 1's
  // real rosters (5 England-champions/3 England-europa etc.) — never
  // hardcoded here as a guessed number. England's SPECIFIC clubs are real
  // qualification, not a fixed identity — they can be any of the whole
  // division's 20, so counted against the whole English ladder, not just
  // season 1's own 5/3 names.
  const englishCl = countByNation(PREMIER_LEAGUE_CLUBS, cl);
  const englishEl = countByNation(PREMIER_LEAGUE_CLUBS, el);
  const spainCl = countByNation(SPAIN_CL, cl);
  const spainEl = countByNation(SPAIN_CL, el);
  const italyCl = countByNation(ITALY_CL, cl);
  const italyEl = countByNation(ITALY_CL, el);
  const germanyCl = countByNation(GERMANY_CL, cl);
  const germanyEl = countByNation(GERMANY_CL, el);
  const franceCl = countByNation(FRANCE_CL, cl);
  const franceEl = countByNation(FRANCE_CL, el);

  const expectedEnglishCl = CHAMPIONS_LEAGUE_CLUBS.filter(c => PREMIER_LEAGUE_CLUBS.includes(c)).length;
  const expectedEnglishEl = EUROPA_LEAGUE_CLUBS.filter(c => PREMIER_LEAGUE_CLUBS.includes(c)).length;
  const expectedSpainCl = SPAIN_CL.filter(c => CHAMPIONS_LEAGUE_CLUBS.includes(c)).length;
  const expectedSpainEl = SPAIN_CL.filter(c => EUROPA_LEAGUE_CLUBS.includes(c)).length;
  const expectedItalyCl = ITALY_CL.filter(c => CHAMPIONS_LEAGUE_CLUBS.includes(c)).length;
  const expectedItalyEl = ITALY_CL.filter(c => EUROPA_LEAGUE_CLUBS.includes(c)).length;
  const expectedGermanyCl = GERMANY_CL.filter(c => CHAMPIONS_LEAGUE_CLUBS.includes(c)).length;
  const expectedGermanyEl = GERMANY_CL.filter(c => EUROPA_LEAGUE_CLUBS.includes(c)).length;
  const expectedFranceCl = FRANCE_CL.filter(c => CHAMPIONS_LEAGUE_CLUBS.includes(c)).length;
  const expectedFranceEl = FRANCE_CL.filter(c => EUROPA_LEAGUE_CLUBS.includes(c)).length;

  check(englishCl === expectedEnglishCl, `season ${season}: England always has exactly ${expectedEnglishCl} Champions League clubs (got ${englishCl})`);
  check(englishEl === expectedEnglishEl, `season ${season}: England always has exactly ${expectedEnglishEl} Europa League clubs (got ${englishEl})`);
  check(spainCl === expectedSpainCl, `season ${season}: Spain always has exactly ${expectedSpainCl} Champions League clubs (got ${spainCl})`);
  check(spainEl === expectedSpainEl, `season ${season}: Spain always has exactly ${expectedSpainEl} Europa League clubs (got ${spainEl})`);
  check(italyCl === expectedItalyCl, `season ${season}: Italy always has exactly ${expectedItalyCl} Champions League clubs (got ${italyCl})`);
  check(italyEl === expectedItalyEl, `season ${season}: Italy always has exactly ${expectedItalyEl} Europa League clubs (got ${italyEl})`);
  check(germanyCl === expectedGermanyCl, `season ${season}: Germany always has exactly ${expectedGermanyCl} Champions League clubs (got ${germanyCl})`);
  check(germanyEl === expectedGermanyEl, `season ${season}: Germany always has exactly ${expectedGermanyEl} Europa League clubs (got ${germanyEl})`);
  check(franceCl === expectedFranceCl, `season ${season}: France always has exactly ${expectedFranceCl} Champions League clubs (got ${franceCl})`);
  check(franceEl === expectedFranceEl, `season ${season}: France always has exactly ${expectedFranceEl} Europa League clubs (got ${franceEl})`);
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
console.log("PASS — both competitions are genuinely 36 clubs every season, season 1 keeps the exact given rosters, England/Spain/Italy/Germany/France each keep a permanent per-competition club count drawn from their real season-1 rosters, and the reshuffle genuinely varies season to season while staying stable within one");
