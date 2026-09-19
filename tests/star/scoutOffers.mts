import {
  generateScoutOffers, clubsForDivision, NO_INTEREST_BELOW, offerLeagueName,
  RETRIAL_NO_INTEREST_BELOW, GUARANTEED_INTEREST_ABOVE,
} from "../../lib/star/scoutOffers";
import { mulberry32 } from "../../lib/star/season";
import { divisionRank } from "../../lib/star/calendar";
import { startTrial, recordStage, trialScore, TRIAL_STAGES } from "../../lib/star/trial";

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
  // Starts at 45 rather than 30: 30 is the bar itself now, and a score sitting
  // on it brings nobody at all, so there would be no clubs to take a rank of.
  const ranks = [45, 60, 75, 90, 100].map(s => ({ s, r: averageRank(s) }));
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
  // ── Clearing the bar is NOT a contract, and that is the change ──
  //
  // This used to assert the opposite: that any score at or above the bar
  // always brought somebody, on the reasoning that a player who scraped it
  // must not be left in limbo by a run of bad rolls. Measured, that reasoning
  // had made failure impossible — every quality above the bar was signed
  // 100.0 % of the time, so the entire free-agent life was a build almost
  // nobody would ever see. Decided directly: failure should be a real
  // possibility, not a rare safety net.
  //
  // Scraping the bar now means the watching clubs have barely noticed you, and
  // the honest majority outcome is nobody.
  let scrapedSigned = 0;
  for (let seed = 1; seed <= 400; seed++) {
    if (generateScoutOffers(NO_INTEREST_BELOW + 1, mulberry32(seed * 13)).length) scrapedSigned++;
  }
  check(
    scrapedSigned < 60,
    `barely clearing the bar must usually bring nobody, brought somebody ${scrapedSigned}/400`,
  );
  check(NO_INTEREST_BELOW > 0 && NO_INTEREST_BELOW < 40, `the bar is real but clearable (${NO_INTEREST_BELOW})`);

  // …but a trial that genuinely earned a club is never left in limbo. That is
  // what the original assertion was really protecting, and it is still true —
  // it just sits behind a line a mediocre afternoon does not clear.
  for (let seed = 1; seed <= 200; seed++) {
    const offers = generateScoutOffers(GUARANTEED_INTEREST_ABOVE, mulberry32(seed * 13));
    check(offers.length > 0, `a genuinely good trial must always bring somebody (seed ${seed})`);
  }
}

// ── The measured sign-on rate, at four levels of how well you played ────
//
// The property everything above is really about, measured end to end through
// the REAL pipeline — a real seeded trial, five real stages recorded at a
// given quality, the real score, the real offers — rather than by feeding
// `generateScoutOffers` a number chosen by hand. The scoring model in
// trial.ts moved underneath this (a stage is now worth
// `0.95 + 0.05 × difficulty`, so quality and score are close to the same
// number), and a test that asserted on hand-picked scores would not have
// noticed.
//
// The bands are intentionally wide. They are there to catch "failure has
// quietly become impossible again" and "a good trial has quietly stopped
// being enough", not to pin an exact percentage that any tuning pass would
// have to come and edit.
{
  const signRate = (quality: number, trials = 1200) => {
    let signed = 0;
    for (let i = 0; i < trials; i++) {
      const seed = (i * 2654435761) >>> 0;
      let t = startTrial(seed);
      for (const stage of TRIAL_STAGES) t = recordStage(t, stage, quality);
      // The same rng derivation the offer screen itself uses, so this is the
      // roll a real player would actually get.
      if (generateScoutOffers(trialScore(t), mulberry32(t.seed ^ 0x5c0a7)).length) signed++;
    }
    return signed / trials;
  };

  const poor = signRate(0.25);
  const mediocre = signRate(0.5);
  const good = signRate(0.75);
  const perfect = signRate(1);

  // A quarter of the marks is a bad afternoon, and a bad afternoon costs you
  // the contract. It used to be signed 55 % of the time, sometimes by a
  // Championship club.
  check(poor <= 0.10, `a poor trial should almost never be signed, was ${(poor * 100).toFixed(1)}%`);

  // The target, decided directly: roughly a coin flip at half marks.
  check(
    mediocre >= 0.35 && mediocre <= 0.65,
    `a mediocre trial should be about a coin flip, was ${(mediocre * 100).toFixed(1)}%`,
  );
  // …and it must genuinely be a flip rather than a rounding of either
  // certainty, which is the failure mode on both sides of this change.
  check(mediocre > poor + 0.2, "half marks must be worth a great deal more than a quarter");

  // Overcorrecting is the other way to get this wrong: a good trial has to
  // still reliably get you signed.
  check(good >= 0.9, `a good trial must reliably be signed, was ${(good * 100).toFixed(1)}%`);
  check(perfect >= 0.99, `a perfect trial must be signed, was ${(perfect * 100).toFixed(1)}%`);
}

// ── A second look is a lower bar, and a rung further down the ladder ─────
//
// `grantTrial` (freeAgent.ts) counts the looks a career has had; the offers
// screen turns anything past the first into `{ retrial: true }`. Two things
// have to be true of it at once, and the first version of it got the second
// one backwards — a retrial reached the Premier League 90 % of the time
// against a first trial's 22 %, which is a re-roll with a prize on it.
{
  const rate = (score: number, retrial: boolean, samples = 600) => {
    let n = 0;
    for (let seed = 1; seed <= samples; seed++) {
      if (generateScoutOffers(score, mulberry32(seed * 13), { retrial }).length) n++;
    }
    return n / samples;
  };
  const rank = (score: number, retrial: boolean, samples = 3000) => {
    let total = 0, n = 0;
    for (let seed = 1; seed <= samples; seed++) {
      const offers = generateScoutOffers(score, mulberry32(seed * 13), { retrial });
      if (!offers.length) continue;
      total += divisionRank(offers[0].division); n++;
    }
    return n ? total / n : 99;
  };

  // 1. The bar really is lower — at every level, not just at one convenient
  //    score.
  for (const score of [25, 35, 45, 55]) {
    check(
      rate(score, true) > rate(score, false) + 0.05,
      `a second look must be a genuinely lower bar at ${score} — `
      + `${(rate(score, false) * 100).toFixed(1)}% first, ${(rate(score, true) * 100).toFixed(1)}% second`,
    );
  }
  check(
    RETRIAL_NO_INTEREST_BELOW < NO_INTEREST_BELOW,
    `…starting with the bar itself (${RETRIAL_NO_INTEREST_BELOW} vs ${NO_INTEREST_BELOW})`,
  );
  // A score that brought nobody at all first time genuinely brings somebody.
  check(
    rate(NO_INTEREST_BELOW - 5, false) === 0 && rate(NO_INTEREST_BELOW - 5, true) > 0.1,
    "an afternoon that brought nobody first time must bring somebody on the second look",
  );

  // 2. …and it is a way DOWN the leagues, not a shortcut up them. A lower
  //    `divisionRank` is a better club, so a retrial's average must be the
  //    HIGHER number.
  //
  //    Split by where the effect is actually measurable, rather than asserted
  //    everywhere and tuned until it passed. Below about 50 both curves are
  //    drawing from the same bottom two rungs — there is nowhere further down
  //    to send you — so the measured gap there is a couple of hundredths, i.e.
  //    inside the noise of 3,000 samples. Above it the shift is real and
  //    large, and that is where it is worth anything.
  for (const score of [60, 75, 90]) {
    check(
      rank(score, true) > rank(score, false) + 0.15,
      `a second look must land you further down the ladder at ${score} — `
      + `rank ${rank(score, false).toFixed(3)} first, ${rank(score, true).toFixed(3)} second`,
    );
  }
  // At the bottom, the weaker claim that is actually true: never BETTER.
  for (const score of [35, 45]) {
    check(
      rank(score, true) >= rank(score, false) - 0.05,
      `a second look must never bring a better club at ${score} — `
      + `rank ${rank(score, false).toFixed(3)} first, ${rank(score, true).toFixed(3)} second`,
    );
  }
  // The exploit this closes, stated as its own check: failing on purpose and
  // taking the second look must never be a better route to the top.
  const premierOn = (score: number, retrial: boolean) => {
    let n = 0;
    for (let seed = 1; seed <= 600; seed++) {
      if (generateScoutOffers(score, mulberry32(seed * 31), { retrial })
        .some(o => o.division === "premier")) n++;
    }
    return n / 600;
  };
  for (const score of [73, 87, 97]) {
    check(
      premierOn(score, true) < premierOn(score, false),
      `a retrial must not reach the Premier League more often than a first trial at ${score} — `
      + `${(premierOn(score, false) * 100).toFixed(1)}% first, ${(premierOn(score, true) * 100).toFixed(1)}% second`,
    );
  }
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
