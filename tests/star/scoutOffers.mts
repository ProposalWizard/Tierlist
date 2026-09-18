import {
  generateScoutOffers, clubsForDivision, NO_INTEREST_BELOW, offerLeagueName,
} from "../../lib/star/scoutOffers";
import { mulberry32 } from "../../lib/star/season";
import { divisionRank } from "../../lib/star/calendar";

/**
 * WHO COMES IN FOR YOU, AND WHETHER THE TRIAL MEANT ANYTHING.
 *
 * This is the piece that makes the whole opening real. Until it existed the
 * trial score was computed, displayed, and then discarded — every player
 * arrived at the same club however they had played.
 *
 * Three properties carry it:
 *
 *  1. **A better trial genuinely gets you better clubs.** Not "sometimes" —
 *     measured across hundreds of trials at every score.
 *  2. **A bad enough trial gets you nothing**, which is a designed outcome
 *     rather than an edge case: it is the free-agent life, and the reason
 *     career creation was split in two.
 *  3. **The same score does not always bring the same clubs.** A trial you
 *     could read off a table is a trial with one right answer.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

/** The average ladder position of the clubs that came in — 1 is the Premier
 *  League, 5 the National League. Lower is better. */
function averageRank(score: number, samples = 250): number {
  let total = 0, n = 0;
  for (let seed = 1; seed <= samples; seed++) {
    const offers = generateScoutOffers(score, mulberry32(seed * 7919));
    if (!offers.length) continue;
    total += divisionRank(offers[0].division);
    n++;
  }
  return n ? total / n : 99;
}

// ── A better trial gets you better clubs ────────────────────────────────
{
  const ranks = [30, 45, 60, 75, 90, 100].map(s => ({ s, r: averageRank(s) }));
  for (let i = 1; i < ranks.length; i++) {
    check(
      ranks[i].r <= ranks[i - 1].r + 0.02,
      `a better trial must not bring worse clubs — ${ranks[i - 1].s} gave rank `
      + `${ranks[i - 1].r.toFixed(2)}, ${ranks[i].s} gave ${ranks[i].r.toFixed(2)}`,
    );
  }
  check(
    ranks[0].r - ranks[ranks.length - 1].r > 1.5,
    `the gap between a poor trial and a perfect one should be more than one division `
    + `(${ranks[0].r.toFixed(2)} vs ${ranks[ranks.length - 1].r.toFixed(2)})`,
  );

  // A perfect trial really can reach the top. No ceiling was a deliberate
  // decision, so this is the test that it was honoured.
  let reachedPremier = 0;
  for (let seed = 1; seed <= 300; seed++) {
    if (generateScoutOffers(97, mulberry32(seed * 31)).some(o => o.division === "premier")) reachedPremier++;
  }
  check(reachedPremier > 150, `a near-perfect trial should often reach the Premier League, did ${reachedPremier}/300`);

  // …and a modest one essentially never does, or the top means nothing.
  let flukes = 0;
  for (let seed = 1; seed <= 300; seed++) {
    if (generateScoutOffers(40, mulberry32(seed * 31)).some(o => o.division === "premier")) flukes++;
  }
  check(flukes < 15, `a modest trial should almost never reach the Premier League, did ${flukes}/300`);
}

// ── A bad enough trial gets you nothing ─────────────────────────────────
{
  for (const score of [0, 5, 15, NO_INTEREST_BELOW - 1]) {
    for (let seed = 1; seed <= 40; seed++) {
      check(
        generateScoutOffers(score, mulberry32(seed)).length === 0,
        `a trial scoring ${score} must bring nobody`,
      );
    }
  }
  // …and just above the bar, somebody always does. A player who scraped it
  // must not be left in limbo by a run of bad rolls — that reads as a bug.
  for (let seed = 1; seed <= 200; seed++) {
    const offers = generateScoutOffers(NO_INTEREST_BELOW, mulberry32(seed * 13));
    check(offers.length > 0, `clearing the bar must always bring somebody (seed ${seed})`);
  }
  check(NO_INTEREST_BELOW > 0 && NO_INTEREST_BELOW < 40, `the bar is real but clearable (${NO_INTEREST_BELOW})`);
}

// ── The same score does not always bring the same clubs ─────────────────
{
  const seen = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const offers = generateScoutOffers(62, mulberry32(seed * 101));
    seen.add(offers.map(o => o.club).sort().join("|"));
  }
  check(seen.size > 60, `the same trial should bring different clubs on different days, saw ${seen.size} sets`);
}

// ── Every offer is a real, coherent offer ───────────────────────────────
{
  for (let seed = 1; seed <= 400; seed++) {
    const score = (seed * 7) % 101;
    const offers = generateScoutOffers(score, mulberry32(seed * 977));
    const clubs = offers.map(o => o.club);
    check(new Set(clubs).size === clubs.length, `no club offers twice (score ${score})`);

    for (const o of offers) {
      check(clubsForDivision(o.division).includes(o.club),
        `${o.club} must actually play in ${o.division}`);
      check(o.wage > 0 && Number.isFinite(o.wage), `${o.club} offers a real wage (${o.wage})`);
      check(o.goalBonus > 0 && o.assistBonus > 0, `${o.club} offers real bonuses`);
      check(o.seasons >= 1 && o.seasons <= 5, `${o.club} offers a sane contract length (${o.seasons})`);
      check(o.pitch.length > 0, `${o.club} actually says something`);
      check(offerLeagueName(o).length > 0, `${o.club}'s league has a name`);
    }
    // Best club first — the order a player reads them in.
    for (let i = 1; i < offers.length; i++) {
      check(offers[i - 1].strength >= offers[i].strength, "offers are sorted best-first");
    }
  }
}

// ── A better trial earns a better deal at the SAME club ─────────────────
//
// So the number matters even when the badge does not change — otherwise a 60
// and an 85 that both land in League One feel identical.
{
  const wageAt = (score: number) => {
    let total = 0, n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (const o of generateScoutOffers(score, mulberry32(seed * 53))) {
        if (o.division !== "league_one") continue;
        total += o.wage; n++;
      }
    }
    return n ? total / n : 0;
  };
  const poor = wageAt(50), good = wageAt(72);
  check(poor > 0 && good > 0, "League One clubs come in at both scores, or this proves nothing");
  check(good > poor, `the same division should pay more for a better trial (${poor.toFixed(0)} vs ${good.toFixed(0)})`);
}

// ── Wages climb with the ladder ─────────────────────────────────────────
{
  const byDivision = new Map<string, number[]>();
  for (let seed = 1; seed <= 600; seed++) {
    for (const o of generateScoutOffers((seed * 11) % 101, mulberry32(seed * 313))) {
      byDivision.set(o.division, [...(byDivision.get(o.division) ?? []), o.wage]);
    }
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const order = ["premier", "championship", "league_one", "league_two", "national_league"];
  let last = Infinity;
  for (const d of order) {
    const ws = byDivision.get(d);
    check(!!ws && ws.length > 5, `${d} should make real offers to sample`);
    if (!ws?.length) continue;
    const m = mean(ws);
    check(m < last, `${d} should pay less than the division above it (${m.toFixed(0)} vs ${last.toFixed(0)})`);
    last = m;
  }
}

// ── Nonsense in cannot produce nonsense out ─────────────────────────────
{
  for (const junk of [NaN, -50, 500, Infinity]) {
    const offers = generateScoutOffers(junk, mulberry32(1));
    check(Array.isArray(offers), `a nonsense score (${junk}) still returns a list`);
    for (const o of offers) {
      check(Number.isFinite(o.wage) && o.wage > 0, `…with a real wage (${o.wage})`);
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the trial score genuinely decides who comes in for you, and a bad enough one brings nobody");
