/**
 * WORLD CHECK: runs the lib/star calls behind the world screens the way the
 * screens call them, headless, against a fresh career (no phone, no React).
 *   1. Shop: buy a can, drink it, buy boots (and the same pair again: stacks),
 *      buy a style item, refuse what you cannot afford.
 *   2. Talks: a scripted negotiation (lib/star/negotiation) for a transfer
 *      offer from the summer window, then the agreed wage and the signing.
 *   3. Cup draw: the FA Cup state, its current round, and whether the draw
 *      screen would play after your cup tie (world/cupDraw.ts drawToShow).
 *   4. The League page's data: every league's table, the world, history lines.
 * Run:  cd phone && npx esbuild tools/world-check.ts --bundle --platform=node --outfile=/tmp/wc.cjs --log-level=warning && node /tmp/wc.cjs
 */
import { startCareer } from "../src/game/newCareer";
import type { CareerState, Fixture } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, baseIdOf, LIFESTYLE_ALL_LEVELS } from "@/lib/star/shopData";
import { startNegotiation, makeOffer } from "@/lib/star/negotiation";
import { currentRound } from "@/lib/star/cups";
import { worldOf } from "@/lib/star/world";
import { sortLeague } from "@/lib/star/season";
import { ALL_DIVISIONS, leagueNameFor, divisionOf } from "@/lib/star/calendar";
import { compHistoryFor } from "@/lib/star/world/history";
import { buyKib, drinkCan, buyBoot, buyItem, bootsForSale } from "../src/world/shop";
import { summerInterest, afterTalks, applySigning } from "../src/world/transfers";
import { drawToShow } from "../src/world/cupDraw";
import { realHistory } from "../src/world/history";
import type { TransferOffer } from "@/lib/star/transfers";

let fails = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? "PASS" : "FAIL"}  ${what}`); if (!cond) fails++; };
const rng = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

const fresh = startCareer("Test", "Player");
console.log(`Fresh career: ${fresh.player.club}, ${leagueNameFor(divisionOf(fresh))}, season ${fresh.season}, ★${fresh.money}`);

// ── 1. Shop ────────────────────────────────────────────────────────────────
{
  let c: CareerState = { ...fresh, money: 1_000_000, energy: 40 };
  const can = KIB_CANS[0];
  const price = kibCanPrice(can, c.contract.wage);
  let r = buyKib(c, can);
  ok(r.ok && r.career.money === c.money - price && r.career.kibCans[can.id] === (c.kibCans[can.id] ?? 0) + 1, `buy ${can.name}: −★${price}, one more in the cupboard`);
  c = r.career;
  r = drinkCan(c, can.id);
  ok(r.ok && r.career.energy > c.energy && r.career.kibCans[can.id] === c.kibCans[can.id] - 1, `drink it: energy ${c.energy} → ${r.career.energy}`);
  c = r.career;

  const boots = bootsForSale(c);
  const b = boots.find((x) => baseIdOf(x) !== baseIdOf(c.currentBoot)) ?? boots[0];
  r = buyBoot(c, b);
  ok(r.ok && r.career.currentBoot.id === b.id && r.career.money === c.money - b.price, `buy boots ${b.name} L${b.level ?? 1}: worn at once, −★${b.price}`);
  const again = buyBoot(r.career, b);
  ok(again.ok && again.career.currentBoot.matches === r.career.currentBoot.matches + b.matches, `same pair again stacks matches: ${r.career.currentBoot.matches} → ${again.career.currentBoot.matches}`);
  c = again.career;

  const item = LIFESTYLE_ALL_LEVELS.find((i) => (i.level ?? 1) === 1 && baseIdOf(i) !== "phone")!;
  r = buyItem(c, item);
  ok(r.ok && r.career.ownedItems.some((o) => o.id === item.id) && r.career.money === c.money - item.price, `buy ${item.name}: owned, −★${item.price}`);
  const twice = buyItem(r.career, item);
  ok(!twice.ok, `buying the same level again is refused ("${twice.reason}")`);
  const phone = LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === "phone");
  if (phone) {
    const p = buyItem(r.career, phone);
    ok(p.ok, `buy the phone: ${p.unlocked ? `unlock chain says "${p.unlocked}"` : "bought (no unlock line on this career)"}`);
  }
  const broke = buyItem({ ...fresh, money: 0 }, item);
  ok(!broke.ok && broke.reason === "Not enough money", "with ★0 the shop refuses");
}

// ── 2. Talks (transfer window) ─────────────────────────────────────────────
{
  // A season worth a move: lots of games, goals and good ratings, so clubs come in.
  const good: CareerState = {
    ...fresh,
    seasonStats: { ...fresh.seasonStats, goals: 28, assists: 12, appearances: 40 } as CareerState["seasonStats"],
  };
  let interest = summerInterest(fresh);
  const freshClubs = interest.leagues.reduce((n, l) => n + l.clubs.length, 0);
  console.log(`Summer window on a fresh career: grade ${interest.report.grade}, ${freshClubs} clubs interested`);
  interest = summerInterest(good);
  const total = interest.leagues.reduce((n, l) => n + l.clubs.length, 0);
  console.log(`Summer window after a big season: grade ${interest.report.grade}, ${total} clubs in ${interest.leagues.length} leagues`);
  let offer: TransferOffer | undefined = interest.leagues[0]?.clubs[0]?.offer;
  if (!offer) console.log("  (no club in: the talks below use the club's own wage as a stand-in offer)");
  const base = offer?.wage ?? Math.max(50, fresh.contract.wage);
  // The screen opens startNegotiation(wage, "selling") and the player asks for more each round.
  let st = startNegotiation(base, "selling", rng);
  const open = st.theirPosition;
  let rounds = 0;
  while (st.status === "negotiating" && rounds < 12) {
    const ask = st.finalOffer ? st.theirPosition : Math.round(Math.max(st.theirPosition * 1.15, open * 1.3) - rounds * open * 0.05);
    st = makeOffer(st, ask, rng);
    rounds++;
  }
  ok(st.status !== "negotiating", `talks end in ${rounds} rounds: ${st.status}${st.finalPrice ? ` at ★${st.finalPrice}/wk` : ""} (their opening ★${open}/wk)`);
  if (offer) {
    const res = afterTalks(good, offer, st.status === "accepted" ? st.finalPrice ?? null : null);
    if (res.agreed) {
      ok(res.agreed.wage >= 1, `agreed wage ★${res.agreed.wage}/wk with ${offer.club}`);
      const moved = applySigning(good, res.agreed);
      ok(moved.player.club === offer.club, `signing moves you: ${good.player.club} → ${moved.player.club}`);
    } else {
      ok(res.career.transferWindow?.walkedAway.includes(offer.club) ?? false, `${offer.club} walked away: off the list until next summer`);
    }
  }
}

// ── 3. Cup draw ────────────────────────────────────────────────────────────
{
  const cups = fresh.cupState ?? [];
  console.log(`Cups open on a fresh career: ${cups.map((c) => `${c.competition} (${c.rounds.length} round${c.rounds.length === 1 ? "" : "s"} drawn)`).join(", ") || "none"}`);
  for (const cup of cups) {
    const round = currentRound(cup);
    const mine = round?.ties.find((t) => t.home === fresh.player.club || t.away === fresh.player.club);
    console.log(`  ${cup.competition}: ${round ? `${round.name}, ${round.ties.length} ties${round.byes?.length ? `, ${round.byes.length} byes` : ""}` : "no round"}${mine ? `, yours: ${mine.home} v ${mine.away}` : ", you are not in this round"}`);
    const fixture = { week: 1, opponent: "X", home: true, played: true, kind: "cup", competition: cup.competition } as Fixture;
    const d = drawToShow(fresh, fixture);
    ok(d === null || (d.round.ties.length > 0 && d.competition === cup.competition),
      `draw screen after a ${cup.competition} tie: ${d ? `plays "${d.round.name}", ${d.round.ties.length} ties` : "no fresh draw to show (you are not in it, or it is already played)"}`);
  }
  ok(drawToShow(fresh, null) === null, "no match played: no draw");
}

// ── 4. The League page's data ──────────────────────────────────────────────
{
  const world = worldOf(fresh);
  ok(world.leagues.length === ALL_DIVISIONS.length - 1, `world plays the other ${world.leagues.length} leagues`);
  for (const d of ALL_DIVISIONS) {
    const own = d === divisionOf(fresh);
    const lg = world.leagues.find((l) => l.division === d);
    const rows = own ? sortLeague(fresh.league) : lg ? sortLeague(lg.teams) : [];
    const hist = realHistory(leagueNameFor(d));
    ok(rows.length > 0, `${leagueNameFor(d)}: ${rows.length} clubs, ${hist.length} real seasons of history, ${compHistoryFor(fresh, leagueNameFor(d)).length} career seasons`);
  }
  ok(realHistory("Champions League").length > 0 && realHistory("World Cup").length > 0, "Europe and World Cup history files load");
}

console.log(fails ? `\n${fails} FAILED` : "\nAll world checks passed.");
process.exit(fails ? 1 : 0);
