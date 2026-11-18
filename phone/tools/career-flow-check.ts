/**
 * CAREER FLOW CHECK: plays a career headlessly through the phone's flow
 * (phone/src/game/flow.ts) and, from the same starting career with the same
 * dice, through the website's lib calls written out in app/star-dev/page.tsx's
 * order. The two careers must come out the same.
 *
 * Run from the repo root:
 *   npx esbuild phone/tools/career-flow-check.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --external:react-native-mmkv --external:react \
 *     --outfile=/tmp/cfc.mjs && node /tmp/cfc.mjs [seasons]
 *
 * Every match is played as the website's "Sim this match" (simulateOwnMatch);
 * the dice (Math.random) and the clock (Date.now) are fixed, so both runs see
 * the same numbers in the same order.
 */
import type { CareerState, Fixture, MatchStats, StarPlayer } from "@/lib/star/types";
import * as flow from "../src/game/flow";
import { getCareer, setCareer } from "../src/game/store";
import { getSession } from "../src/game/session";

import { creditMatchResult, simulateMissedFixture, awardLeagueTrophyIfWon, advanceSeason, checkForContractOffer, markContractOfferUsed, attachClub } from "@/lib/star/careerFlow";
import { nextFixtureFor, fixtureLabel, nationOf, leaguePosition } from "@/lib/star/competitions";
import { projectedEnergy } from "@/lib/star/week";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { simulateOwnMatch } from "@/lib/star/simMatch";
import { recordFirstMatch } from "@/lib/star/unlocks";
import { generateForMatch, generateForInternational, generateForCallUp, generateForCareer, generateForLeagueWeek, generateForRollover } from "@/lib/star/media/feed";
import { nationKits, nationStrength } from "@/lib/star/international";
import { formHasCollapsed, dropToYouth, endLoan, loanRecallOffer } from "@/lib/star/youth";
import { checkNewAchievements } from "@/lib/star/achievements";
import { computeStarRating } from "@/lib/star/rating";
import { withStars } from "@/lib/star/starPoints";
import { periodDue, decide, applyDecision, syncIntl } from "@/lib/star/intl/career";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";
import { computeBallonDorShortlist } from "@/lib/star/ballonDor";
import { retirementCheck } from "@/lib/star/retirement";
import { isRegionalDivision, divisionOf } from "@/lib/star/calendar";
import { sortLeague, mulberry32 } from "@/lib/star/season";
import { generateRelegationOffers } from "@/lib/star/relegationOffers";
import { requestOf, clearAfterWindow } from "@/lib/star/transferRequest";
import { windowInterest, withRecall } from "@/lib/star/transferInterest";
import { acceptOffer } from "@/lib/star/transfers";
import { clubsForDivision } from "@/lib/star/scoutOffers";
import { trialComplete } from "@/lib/star/trial";

const SEASONS = Number(process.argv[2] ?? 2);

// ── Fixed dice and clock ──
let dice = mulberry32(1);
Math.random = () => dice();
const FIXED_NOW = Date.UTC(2026, 7, 1);
Date.now = () => FIXED_NOW;
const reseed = (n: number) => { dice = mulberry32(n); };

let failures = 0;
const fail = (m: string) => { failures++; console.log("  FAIL:", m); };
const ok = (m: string) => console.log("  ok:", m);

// ═══ 1. A new career through the phone's flow (profile → trial → signing) ═══
reseed(11);
const player = {
  firstName: "Test", lastName: "Striker", age: 16, skinTone: "tan", club: "", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2026, preferredNumber: 9, preferredFoot: "right",
  hairStyle: "short", hairColour: "brown",
} as unknown as StarPlayer;
let step = flow.beginCareer(player, "premier", 12345);
if (step.screen !== "career-trial") fail(`new career should open the trial, got ${step.screen}`);
for (const st of flow.trialStages(getCareer()!)) flow.simulateTrialStage(st);
if (!trialComplete(getCareer()!.trial!)) fail("trial not complete after every stage");
step = flow.afterTrial();
ok(`trial done → ${step.screen}`);
if (step.screen === "career-manager-talk") step = flow.acceptManagerOffer();
else { const o = flow.offersWithAgreedTerms(getCareer()!, flow.offersForTrial(getCareer()!)); if (o[0]) step = flow.signTrialOffer(o[0]); }
if (step.screen !== "career-signed") fail(`signing should show the contract, got ${step.screen}`);
step = flow.finishSigning();
const signed = getCareer()!;
ok(`signed for ${signed.player.club} (${signed.division}), ${signed.fixtures.length} fixtures, ${signed.league.length} clubs`);
if (!signed.player.club || signed.fixtures.length === 0) fail("no club or no fixtures after signing");

// The website's signing, from the same trial (page.tsx signTrialOffer), must give the same club.
{
  const off = flow.offersForTrial(signed);
  if (off[0] && off[0].club !== signed.contract.club && signed.placement?.kind !== "loan") fail(`signed ${signed.contract.club}, offer was ${off[0].club}`);
  void attachClub; void clubsForDivision;
}

const START: CareerState = JSON.parse(JSON.stringify(signed));

// ═══ 2. The website's order, written out from page.tsx ═══

/** page.tsx's effects after any change outside the match: central check, then syncIntl. */
function webSettle(c: CareerState): CareerState {
  const ids = checkNewAchievements(c);
  if (ids.length) { const u = { ...c, achievements: [...c.achievements, ...ids] }; c = withStars({ ...u, starRating: computeStarRating(u) }); }
  if (c.player?.club && c.fixtures?.length && !c.intl?.xi?.[c.season]) c = syncIntl(c);
  return c;
}
function webSimStats(r: CareerState, f: Fixture): MatchStats {
  const sel = selectionFor(r);
  const bootOn = r.currentBoot.matches > 0;
  return simulateOwnMatch(r, f, { selection: sel, duties: setPieceDuties(r, sel.status), skills: {
    power: Math.min(100, r.skills.power + (bootOn ? r.currentBoot.power : 0)),
    technique: Math.min(100, r.skills.technique + (bootOn ? r.currentBoot.technique : 0)) } });
}
/** handleSimMatch → handleMatchComplete. */
function webMatch(c0: CareerState): CareerState {
  const f = nextFixtureFor(c0)!;
  const career: CareerState = { ...c0, weekActions: 0, energy: projectedEnergy(c0) };
  const stats = webSimStats(career, f);
  const credited = creditMatchResult(career, f, stats);
  const next = recordFirstMatch(credited.career);
  next.media = f.kind === "international"
    ? generateForInternational(career, next, f, stats, nationOf(career), nationKits(nationOf(career)).home, nationStrength(nationOf(career)))
    : generateForMatch(career, next, f, stats);
  const restOfWeek = (next.results ?? []).filter((r) => r.week === f.week && r.home !== career.player.club && r.away !== career.player.club);
  if (restOfWeek.length) next.media = generateForLeagueWeek({ ...next, media: next.media }, restOfWeek);
  const p = credited.potmAwarded;
  if (p) {
    const place = p.isYou ? "won it" : p.yourPlace ? `${p.yourPlace}${["st", "nd", "rd"][p.yourPlace - 1] ?? "th"} on the shortlist` : "not shortlisted";
    next.media = generateForCareer({ ...next, media: next.media }, { kind: "award", won: p.isYou, award: `${p.monthName} Player of the Month`,
      detail: p.isYou ? `${p.goals} goals and ${p.assists} assists in ${p.monthName}.` : `${p.winner} of ${p.club} takes it — ${p.goals} goals. You were ${place}.` }, `potm-${p.season}-${p.month}`);
  }
  void fixtureLabel;
  return webSettle(formHasCollapsed(next) ? dropToYouth(next) : next);
}
/** continueAfterMatch's career-changing branches (no world screens): call-ups and the early contract offer. */
function webAfterMatch(c: CareerState): CareerState {
  if (c.fixtures.filter((f) => !f.played).length === 0) return c;
  while (periodDue(c) !== null) c = webCallUp(c);
  const early = checkForContractOffer(c);
  if (early) c = webSettle(markContractOfferUsed(c, early)); // the renewal screen: "Back" (no new deal)
  return c;
}
function webCallUp(c: CareerState): CareerState {
  const d = decide(c, periodDue(c)!);
  let next = applyDecision(c, d);
  const rec = next.international ?? { decided: [], callUps: 0, snubs: 0, matches: [] };
  next = { ...next, international: { ...rec, callUps: rec.callUps + (d.called ? 1 : 0), snubs: rec.snubs + (d.called ? 0 : 1) } };
  if (d.called) next = { ...next, media: generateForCallUp(next, d.nation, next.international?.callUps ?? 1, d.period.label, `callup-${d.period.key}`) };
  return webSettle(next);
}
function webRoll(from: CareerState, userWon: boolean, forced = false, justTransferred = false): CareerState {
  const { career: rolled } = advanceSeason(from, userWon, justTransferred, { noSackAfterPromotion: false });
  const next = endLoan(rolled);
  next.lastSeasonRecords = from.seasonRecords ?? [];
  next.seasonRecords = [];
  if (forced && next.ladderNews) next.ladderNews = { ...next.ladderNews, yourMove: null };
  if (userWon) next.media = generateForCareer(next, { kind: "ballon-dor", won: true, total: next.ballonDorWins }, "bdor");
  for (const a of (next.awards ?? []).filter((x) => x.season === from.season)) next.media = generateForCareer({ ...next, media: next.media }, { kind: "award", won: true, award: a.kind, detail: a.detail }, `award-${a.kind}`);
  if (next.managerNews && next.manager) next.media = generateForCareer({ ...next, media: next.media }, { kind: "manager-out", name: from.manager?.name ?? "The manager", incoming: next.manager.name, reason: next.managerNews }, "gaffer");
  if (next.lastSeasonJudgement) next.media = generateForCareer({ ...next, media: next.media }, { kind: "season-end", position: leaguePosition(from), headline: next.lastSeasonJudgement.headline, detail: next.lastSeasonJudgement.detail }, "review");
  next.media = generateForRollover({ ...next, media: next.media });
  return webSettle(next);
}
/** endSeason → Golden Ball → openTransferWindowOrRoll (stay put / first forced offer) → rollOverSeason. */
function webSeasonEnd(from: CareerState): CareerState {
  const { career: awarded } = awardLeagueTrophyIfWon(from);
  let c = webSettle({ ...awarded, lastSeasonAwardStats: computeSeasonAwardStats(awarded) });
  const won = computeBallonDorShortlist(c).playerRank === 1;
  if (retirementCheck(c).mustRetire) return c;
  if (isRegionalDivision(divisionOf(c)) && sortLeague(c.league).slice(-4).some((t) => t.name === c.player.club)) {
    const forced = generateRelegationOffers(c, mulberry32(c.season * 8831 + c.fame));
    if (forced.length > 0) {
      const agreed = requestOf(c).agreed;
      const offer = (agreed ? [agreed, ...forced.filter((o) => o.club !== agreed.club)] : forced)[0];
      const moved = clearAfterWindow(acceptOffer(c, offer));
      moved.media = generateForCareer(moved, { kind: "transfer", from: c.player.club, to: offer.club, fee: offer.transferFee ?? offer.signingFee }, "transfer");
      return webRoll(moved, won, true, true);
    }
  }
  const interest = withRecall(windowInterest(c, "summer", { step3Promoted: false }), loanRecallOffer(c), c);
  c = interest.leagues.length > 0 ? clearAfterWindow(c) : c;
  return webRoll(c, won);
}
/** One whole season of the website, from a career at its first match. */
function webSeason(c: CareerState): CareerState {
  for (let guard = 0; guard < 200 && nextFixtureFor(c); guard++) {
    while (periodDue(c) !== null) c = webCallUp(c);
    const f = nextFixtureFor(c);
    if (!f) break;
    const sel = selectionFor({ ...c, energy: projectedEnergy(c) });
    if (f.watch || sel.status === "Squad" || sel.status === "Injured") { c = webSettle(simulateMissedFixture(c, f).career); continue; }
    c = webAfterMatch(webMatch(c));
  }
  return webSeasonEnd(c);
}

// ═══ 3. The phone's flow, the same season ═══
function phoneSeason(): void {
  for (let guard = 0; guard < 200 && flow.nextFixture(); guard++) {
    while (flow.callUpDecision()) flow.answerCallUp(flow.callUpDecision()!);
    const c = getCareer()!;
    const f = flow.nextFixture();
    if (!f) break;
    const sel = flow.preMatchSelection(c);
    if (f.watch || sel.status === "Squad" || sel.status === "Injured") { flow.watchFromStands(); continue; }
    flow.simMatch();
    if (!getSession().report) fail("no post-match report after a match");
    let s = flow.postMatchContinue();
    while (s.screen === "career-callup") s = flow.answerCallUp(flow.callUpDecision()!);
    if (s.screen === "career-contract-renewal") s = flow.contractComplete(null);
    if (s.screen !== "tabs") fail(`after a match the flow went to ${s.screen}`);
  }
  if (!flow.seasonOver()) fail("season not over after every fixture");
  {
    const lg = getCareer()!.league;
    const games = 2 * (lg.length - 1);
    const short = lg.filter((t) => t.played !== games);
    if (short.length) fail(`table incomplete: ${short.map((t) => `${t.name} ${t.played}/${games}`).join(", ")}`);
    else ok(`table complete: ${lg.length} clubs × ${games} games, top ${sortLeague(lg)[0].name}, your place ${sortLeague(lg).findIndex((t) => t.name === getCareer()!.player.club) + 1}`);
  }
  let s = flow.endSeason();
  if (s.screen !== "career-golden-ball") fail(`season end opened ${s.screen}`);
  const won = computeBallonDorShortlist(getCareer()!).playerRank === 1;
  s = flow.ballonDorContinue(won);
  if (s.screen === "career-final-season") s = flow.playOn();
  if (s.screen === "career-season-awards") s = flow.continueAfterRollover();
  if (s.screen === "career-contract-renewal") s = flow.contractComplete(null);
}

// ═══ 4. Run both, season by season, and compare ═══
const strip = (c: CareerState) => JSON.parse(JSON.stringify(c, (k, v) => (k === "decidedAt" ? undefined : v)));
function firstDiff(a: unknown, b: unknown, path = ""): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return `${path}: ${JSON.stringify(a)?.slice(0, 80)} vs ${JSON.stringify(b)?.slice(0, 80)}`;
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) { const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`); if (d) return d; }
  return path;
}

let web: CareerState = JSON.parse(JSON.stringify(START));
setCareer(JSON.parse(JSON.stringify(START)));
for (let season = 1; season <= SEASONS; season++) {
  console.log(`Season ${season}:`);
  const seed = 1000 + season;
  reseed(seed);
  const t0 = performance.now();
  phoneSeason();
  const phoneMs = performance.now() - t0;
  reseed(seed);
  web = webSeason(web);
  const phone = getCareer()!;
  const last = phone.lastSeasonAwardStats;


  ok(`phone season played in ${Math.round(phoneMs)} ms; now season ${phone.season}, ${phone.player.club}, goals ${phone.careerStats.goals}, apps ${phone.careerStats.appearances}, money ★${Math.round(phone.money)}`);
  if (phone.season !== season + 1) fail(`season did not advance (is ${phone.season})`);
  if (!last) fail("no season award stats");
  const left = phone.fixtures.filter((f) => !f.played).length;
  if (left === 0) fail("new season has no fixtures");
  const d = firstDiff(strip(phone), strip(web));
  if (d) fail(`phone and website careers differ at ${d}`);
  else ok("phone career == website career (every field)");
  // The table of the new season starts at zero for every club.
  if (phone.league.some((t) => t.played !== 0)) fail("new season's table not reset");
  // A complete table at the end of the old season: every club played every other twice.
  if (!last?.leagueName) fail("award stats missing the league name");
}
console.log(failures ? `\n${failures} FAILED` : "\nALL OK");
if (failures) process.exitCode = 1;
