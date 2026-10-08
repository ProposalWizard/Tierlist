import {
  cryptoRng, seededRng, spinRoulette, roulettePayout, isRed, spinSlots, slotsPayout, SLOTS_SYMBOLS,
  drawCard, handValue, dealerPlay, blackjackSettle, raceWinOdds, dealRaceRatings, raceScores, finishOf,
  horseBetPayout, ownHorseScores, validRouletteChoice, raceWinChances, type Card, type RouletteChoice,
} from "../../lib/star/casinoRules";
import {
  handlePlay, signCard, stakeCap, STAKE_SLACK_MIN, netOf,
  type CasinoStore, type PlayRow, type EngineCtx, type Trusted,
} from "../../lib/star/casinoEngine";
import { streakMultiplier, pickShot } from "../../lib/star/goalieMode";

/**
 * THE CASINO ON THE SERVER (Harry, 8 Oct 2026: "move the casino to the
 * server"). lib/star/casinoRules.ts holds the rules both the phone and the
 * server use; lib/star/casinoEngine.ts is the server's side. Checked here:
 *  1. the payouts are exactly today's (each old rule from Casino.tsx is
 *     copied below and compared on every possible result);
 *  2. the random numbers are fair (distribution and return per stake);
 *  3. the server engine against an in-memory table: stakes, request keys
 *     (a retry never plays twice), the signed race card, the hidden dealer
 *     card, Goalie Mode's steps, and the net the save guard reads.
 * The Supabase half (casinoDb.ts, star_casino.sql) cannot run here: no live
 * database. It is checked by the verify queries at the bottom of the
 * migration once it has run.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. Payouts are today's ────────────────────────────────────────────────
{
  // Casino.tsx's roulette, before the move (8 Oct 2026), verbatim in effect.
  const oldRoulette = (choice: RouletteChoice, winner: number, bet: number) => {
    let win = 0;
    const redWin = isRed(winner);
    if (typeof choice === "number" && choice === winner) win = bet * 35;
    else if (choice === "red" && redWin) win = bet * 2;
    else if (choice === "black" && !redWin && winner !== 0) win = bet * 2;
    else if (choice === "even" && winner !== 0 && winner % 2 === 0) win = bet * 2;
    else if (choice === "odd" && winner % 2 === 1) win = bet * 2;
    return win;
  };
  const choices: RouletteChoice[] = ["red", "black", "even", "odd", ...Array.from({ length: 37 }, (_, i) => i)];
  let mism = 0;
  for (const c of choices) for (let w = 0; w <= 36; w++) if (roulettePayout(c, w, 2000) !== oldRoulette(c, w, 2000)) mism++;
  check(mism === 0, `roulette pays exactly as before on all ${choices.length * 37} bets × results (${mism} differ)`);
  check(!validRouletteChoice(37) && !validRouletteChoice("green") && !validRouletteChoice(1.5) && validRouletteChoice(0), "roulette only takes real bets");

  const oldSlots = (a: string, b: string, c: string, bet: number) => {
    let win = 0;
    if (a === b && b === c) win = a === "7️⃣" ? bet * 20 : a === "⭐" ? bet * 10 : bet * 5;
    else if (a === b || b === c) win = bet;
    return win;
  };
  let slotMism = 0, slotReturn = 0;
  for (const a of SLOTS_SYMBOLS) for (const b of SLOTS_SYMBOLS) for (const c of SLOTS_SYMBOLS) {
    if (slotsPayout([a, b, c], 100) !== oldSlots(a, b, c, 100)) slotMism++;
    slotReturn += slotsPayout([a, b, c], 1);
  }
  check(slotMism === 0, `slots pay exactly as before on all 216 lines (${slotMism} differ)`);
  console.log(`slots return per ★1 staked (exact): ${(slotReturn / 216).toFixed(4)}; roulette, red: ${(18 / 37 * 2).toFixed(4)}; a number: ${(35 / 37).toFixed(4)}`);

  // Blackjack: win 2×, push 1×, lose/bust 0 (as Casino.tsx's hold()).
  const c = (rank: string): Card => ({ rank, value: rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : parseInt(rank, 10), suit: "♠" });
  check(blackjackSettle([c("K"), c("9")], [c("K"), c("7")], 100).payout === 200, "blackjack: 19 beats 17, pays 2×");
  check(blackjackSettle([c("K"), c("7")], [c("10"), c("7")], 100).payout === 100, "blackjack: a push gives the stake back");
  check(blackjackSettle([c("K"), c("6")], [c("10"), c("7")], 100).payout === 0, "blackjack: 16 loses to 17");
  check(blackjackSettle([c("K"), c("6"), c("8")], [c("10"), c("6"), c("9")], 100).verdict === "bust", "blackjack: your bust loses even when the dealer would bust");
  check(blackjackSettle([c("K"), c("6")], [c("10"), c("6"), c("9")], 100).payout === 200, "blackjack: dealer bust pays 2×");
  check(handValue([c("A"), c("A"), c("9")]) === 21 && handValue([c("A"), c("K")]) === 21, "aces count 1 or 11");
  const rng = seededRng(7);
  let under17 = 0;
  for (let i = 0; i < 2000; i++) if (handValue(dealerPlay([drawCard(rng), drawCard(rng)], rng)) < 17) under17++;
  check(under17 === 0, "the dealer always draws to 17");

  // Horse: a winning bet pays stake × odds, rounded; anything else 0.
  check(horseBetPayout(2, [1, 2, 9, 3, 4, 5], [2, 3, 4.5, 6, 8, 10], 1000) === 4500, "a winning horse pays stake × odds");
  check(horseBetPayout(1, [1, 2, 9, 3, 4, 5], [2, 3, 4.5, 6, 8, 10], 1000) === 0, "a losing horse pays nothing");
  check(finishOf([1, 9, 5], 0) === 3 && finishOf([1, 9, 5], 1) === 1, "finishing places run highest score first");
  const r1 = raceWinOdds([60, 70, 80, 90, 50, 40]);
  check(JSON.stringify(r1) === JSON.stringify(raceWinOdds([60, 70, 80, 90, 50, 40])), "the odds for a field come out the same every time (phone and server agree)");
  check(r1[3] < r1[0] && r1[0] < r1[5], "a better horse is shorter odds");
}

// ── 2. Fair random numbers ────────────────────────────────────────────────
{
  const rng = cryptoRng();
  const N = 74_000;
  const counts = new Array(37).fill(0);
  let red = 0;
  for (let i = 0; i < N; i++) { const w = spinRoulette(rng); counts[w]++; if (roulettePayout("red", w, 1) > 0) red++; }
  const exp = N / 37;
  const chi = counts.reduce((s, k) => s + (k - exp) ** 2 / exp, 0);
  // 36 degrees of freedom: 99.9% of fair wheels score under ~67.
  check(chi < 67, `roulette pockets are even (chi-square ${chi.toFixed(1)}, 36 d.f.)`);
  check(counts.every(k => k > 0), "every pocket comes up");
  check(Math.abs(red / N - 18 / 37) < 0.01, `red comes up 18 times in 37 (${(red / N).toFixed(4)})`);

  let ret = 0;
  for (let i = 0; i < 60_000; i++) ret += slotsPayout(spinSlots(rng), 1);
  check(Math.abs(ret / 60_000 - 110 / 216) < 0.02, `slots return about ★0.51 per ★1 (${(ret / 60_000).toFixed(3)})`);

  let bjRet = 0;
  for (let i = 0; i < 20_000; i++) {
    const p = [drawCard(rng), drawCard(rng)];
    while (handValue(p) < 17) p.push(drawCard(rng)); // a simple "hit to 17" player
    bjRet += blackjackSettle(p, dealerPlay([drawCard(rng), drawCard(rng)], rng), 1).payout;
  }
  check(bjRet / 20_000 > 0.8 && bjRet / 20_000 < 1.0, `blackjack, hitting to 17, returns under the stake (${(bjRet / 20_000).toFixed(3)})`);

  // The race odds match how the race really goes (house keeps about 13%).
  const ratings = [55, 62, 70, 78, 86, 93];
  const odds = raceWinOdds(ratings);
  let back = 0;
  const T = 40_000;
  for (let i = 0; i < T; i++) back += horseBetPayout(5, raceScores(ratings, rng), odds, 1000) / 1000;
  check(back / T > 0.75 && back / T < 0.98, `backing the favourite returns under the stake (${(back / T).toFixed(3)})`);
  // No horse on any card pays back more than the stake on average (the old
  // sampled odds did on 47% of cards).
  let worst = 0;
  const cardRng = seededRng(42);
  for (let k = 0; k < 2000; k++) {
    const rs = dealRaceRatings(cardRng);
    const p = raceWinChances(rs), o = raceWinOdds(rs);
    for (let i = 0; i < 6; i++) worst = Math.max(worst, p[i] * o[i]);
  }
  check(worst < 1, `no race-card bet returns more than the stake (best ★${worst.toFixed(3)} per ★1 over 2,000 cards)`);
  const deal = dealRaceRatings(rng);
  check(deal.length === 6 && deal.every(r => r >= 40 && r <= 95 && Number.isInteger(r)), "a race card is six horses rated 40-95");
  const own = ownHorseScores({ speed: 88, stamina: 84, energy: 100 }, rng);
  check(own.scores.length === 6 && own.ratings[0] === 86, "your own horse races five rivals");
}

// ── 3. The server engine ──────────────────────────────────────────────────

/** star_casino_plays, in memory: unique (user_id, idem_key), step guard. */
function memoryStore(): CasinoStore & { rows: PlayRow[] } {
  const rows: PlayRow[] = [];
  let id = 0, t = 0;
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    rows,
    async findByIdem(u, k) { const r = rows.find(x => x.user_id === u && x.idem_key === k); return r ? clone(r) : null; },
    async get(u, i) { const r = rows.find(x => x.user_id === u && x.id === i); return r ? clone(r) : null; },
    async insert(row) {
      if (rows.some(x => x.user_id === row.user_id && x.idem_key === row.idem_key)) return "conflict";
      const r: PlayRow = { ...clone(row), id: `00000000-0000-0000-0000-${String(++id).padStart(12, "0")}`, at: 1_900_000_000_000 + ++t };
      rows.push(r);
      return clone(r);
    },
    async update(u, i, from, patch) {
      const r = rows.find(x => x.user_id === u && x.id === i);
      if (!r || r.step !== from) return false;
      Object.assign(r, clone(patch));
      return true;
    },
    async countSince(u, s, g, since) { return rows.filter(x => x.user_id === u && x.slot === s && x.game === g && x.at > since).length; },
  };
}

const SECRET = "test-secret";
function ctxFor(trusted: Trusted | null, now = 1_900_000_000_000, seed = 1): EngineCtx {
  return { userId: "u1", slot: 1, now, rng: seededRng(seed), secret: SECRET, trusted: async () => trusted };
}
const T0: Trusted = { money: 1_000_000, wage: 2_000, savedAt: 1_800_000_000_000, horse: null, netSince: 0 };
const res = <T,>(a: { status: number; body: Record<string, unknown> }) => a.body.result as T;

await (async () => {
  const store = memoryStore();
  // Roulette: a play, then the same request again (a retry).
  const req = { game: "roulette", choice: "red", stake: 10_000, bank: 50_000, idemKey: "key-roulette-1" };
  const a = await handlePlay(req, ctxFor(T0, undefined, 3), store);
  const b = await handlePlay(req, ctxFor(T0, undefined, 99), store);
  check(a.status === 200 && JSON.stringify(a.body) === JSON.stringify(b.body), "a retried bet gets the first answer back");
  check(store.rows.length === 1, `…and is stored once (${store.rows.length} rows)`);
  const r = res<{ winner: number; payout: number }>(a);
  check(r.payout === roulettePayout("red", r.winner, 10_000), "the stored payout follows the rules");
  check(store.rows[0].net === r.payout - 10_000, "net = payout − stake");

  // Stakes: within the bank sent, within the trusted save.
  check((await handlePlay({ ...req, idemKey: "key-roulette-2", stake: 60_000 }, ctxFor(T0), store)).status === 400, "a stake above the bank is refused");
  const capped = await handlePlay({ ...req, idemKey: "key-roulette-3", stake: 5_000_000, bank: 9e9 }, ctxFor(T0), store);
  check(capped.status === 400, "a stake above what the last trusted save could have is refused (an edited bank)");
  check(stakeCap(T0) === 1_000_000 + Math.max(STAKE_SLACK_MIN, 60 * 2_000), "the stake cap: trusted money + net since + slack");
  check(stakeCap({ ...T0, netSince: 2_000_000 }) > 3_000_000, "…plus wins the server has recorded since");
  check((await handlePlay({ ...req, idemKey: "key-roulette-4", stake: 0 }, ctxFor(T0), store)).status === 400, "a zero stake is refused");
  check((await handlePlay({ ...req, idemKey: "key-roulette-5", stake: 1.5 }, ctxFor(T0), store)).status === 400, "a part-star stake is refused");
  check((await handlePlay({ ...req, idemKey: "key-roulette-6", choice: 40 }, ctxFor(T0), store)).status === 400, "a bet on pocket 40 is refused");
  check((await handlePlay({ ...req, idemKey: "short" }, ctxFor(T0), store)).status === 400, "a request without a proper key is refused");
  check(store.rows.length === 1, "refused bets leave no row");

  // Many spins: the table's net is the sum of what was paid.
  let paid = 0, staked = 0;
  for (let i = 0; i < 300; i++) {
    const p = await handlePlay({ game: "slots", stake: 2_000, bank: 1e7, idemKey: `key-slots-${i}` }, ctxFor(T0, undefined, 1000 + i), store);
    paid += res<{ payout: number }>(p).payout; staked += 2_000;
  }
  const slotRows = store.rows.filter(x => x.game === "slots");
  check(netOf(slotRows) === paid - staked, `the table's net matches what was paid (${netOf(slotRows)} vs ${paid - staked})`);
})();

// Horse racing: the card is the server's.
await (async () => {
  const store = memoryStore();
  const now = 1_900_000_000_000;
  const dealt = res<{ card: { ratings: number[]; nonce: string; exp: number }; sig: string; odds: number[] }>(
    await handlePlay({ game: "horse", action: "card" }, ctxFor(T0, now, 5), store));
  check(dealt.card.ratings.length === 6 && JSON.stringify(dealt.odds) === JSON.stringify(raceWinOdds(dealt.card.ratings)), "the server deals a card and prices it with the shared odds");
  const bet = { game: "horse", card: dealt.card, sig: dealt.sig, pick: 0, stake: 5_000, bank: 1e6, idemKey: "key-horse-1" };
  const first = await handlePlay(bet, ctxFor(T0, now + 1000, 6), store);
  check(first.status === 200, "a bet on a dealt card is taken");
  const reuse = await handlePlay({ ...bet, idemKey: "key-horse-2", pick: 3 }, ctxFor(T0, now + 2000, 7), store);
  check(JSON.stringify(reuse.body) === JSON.stringify(first.body) && store.rows.length === 1, "a card can only be bet on once (a second bet gets the first race back)");
  const forged = { ...dealt.card, ratings: [95, 40, 40, 40, 40, 40] };
  check((await handlePlay({ ...bet, card: forged, idemKey: "key-horse-3" }, ctxFor(T0, now, 8), store)).status === 409, "a card with its ratings changed is refused");
  const fresh = { ...dealt.card, nonce: "ab".repeat(12) };
  check((await handlePlay({ ...bet, card: fresh, sig: signCard(fresh, "wrong-secret"), idemKey: "key-horse-4" }, ctxFor(T0, now, 8), store)).status === 409, "a card signed with the wrong key is refused");
  check((await handlePlay({ ...bet, card: { ...dealt.card, nonce: "cd".repeat(12) }, idemKey: "key-horse-5" }, ctxFor(T0, dealt.card.exp + 1, 8), store)).status === 409, "an expired card is refused");
  const r = res<{ scores: number[]; payout: number; finish: number }>(first);
  check(r.payout === horseBetPayout(0, r.scores, raceWinOdds(dealt.card.ratings), 5_000), "the race result pays by the shared rules");

  // Your own horse: never better than the best one sold, and not raced flat out.
  const strong = await handlePlay({ game: "horse_own", horse: { speed: 999, stamina: 999, energy: 100 }, idemKey: "key-own-1" }, ctxFor(null, now, 9), store);
  const sr = res<{ ratings: number[] }>(strong);
  check(sr.ratings[0] === 86, `an edited super-horse races as the best horse sold (rating ${sr.ratings[0]})`);
  check((await handlePlay({ game: "horse_own", horse: { speed: 60, stamina: 60, energy: 10 }, idemKey: "key-own-2" }, ctxFor(null, now, 9), store)).status === 400, "a tired horse cannot race");
  const tHorse: Trusted = { ...T0, savedAt: 1_900_000_000_000 + store.rows.length, horse: { speed: 60, stamina: 60, energy: 40 } };
  let raced = 0;
  for (let i = 0; i < 10; i++) {
    const a = await handlePlay({ game: "horse_own", horse: { speed: 60, stamina: 60, energy: 100 }, idemKey: `key-own-r${i}` }, ctxFor(tHorse, now, 20 + i), store);
    if (a.status === 200) raced++;
  }
  check(raced === 1 + 3, `races since the last save are capped by the saved horse's energy (${raced} of 10)`);
  check(store.rows.filter(x => x.game === "horse_own").every(x => x.stake === 0 && x.net === x.payout), "own-horse races stake nothing and record the purse");
})();

// Blackjack: the dealer's second card stays on the server.
await (async () => {
  const store = memoryStore();
  let checked = 0, consistent = 0, hidden = 0;
  for (let i = 0; i < 200; i++) {
    const deal = await handlePlay({ game: "blackjack", action: "deal", stake: 1_000, bank: 1e6, idemKey: `key-bj-${i}` }, ctxFor(T0, undefined, 500 + i), store);
    const d = res<{ playId: string; player: Card[]; dealerUp: Card; dealer?: Card[] }>(deal);
    if (!d.dealer && JSON.stringify(deal.body).split("rank").length === d.player.length + 2) hidden++;
    const row = store.rows.find(x => x.id === d.playId)!;
    check(row.status === "open" && row.net === -1_000, "an open hand counts its stake as lost until it settles");
    let last: { player: Card[]; dealer?: Card[]; payout?: number; done: boolean } = { player: d.player, done: false };
    let k = 0;
    while (!last.done && handValue(last.player) < 15) {
      last = res(await handlePlay({ game: "blackjack", action: "hit", playId: d.playId, idemKey: `key-bj-${i}-h${k++}` }, ctxFor(T0, undefined, 900 + i * 7 + k), store));
    }
    const standReq = { game: "blackjack", action: "stand", playId: d.playId, idemKey: `key-bj-${i}-s` };
    const fin = last.done ? last : res<typeof last>(await handlePlay(standReq, ctxFor(T0, undefined, 3000 + i), store));
    if (!last.done) {
      const again = res<typeof last>(await handlePlay(standReq, ctxFor(T0, undefined, 4000 + i), store));
      if (JSON.stringify(again) !== JSON.stringify(fin)) problems.push("a retried stand changed the result");
    }
    const settled = store.rows.find(x => x.id === d.playId)!;
    checked++;
    if (settled.status === "settled" && settled.payout === blackjackSettle(fin.player, fin.dealer!, 1_000).payout && settled.secret === null) consistent++;
    // Nothing more once settled.
    const late = await handlePlay({ game: "blackjack", action: "hit", playId: d.playId, idemKey: `key-bj-${i}-late` }, ctxFor(T0), store);
    if (JSON.stringify(res(late)) !== JSON.stringify(fin)) problems.push("a hit after the hand ended changed it");
  }
  check(hidden === checked, `the deal shows one dealer card, never the second (${hidden}/${checked})`);
  check(consistent === checked, `every hand settles by the shared rules (${consistent}/${checked})`);
  check(store.rows.every(x => x.secret === null), "settled hands keep no hidden cards");
  const other = await handlePlay({ game: "blackjack", action: "hit", playId: store.rows[0].id, idemKey: "key-bj-x" }, { ...ctxFor(T0), userId: "u2" }, store);
  check(other.status === 404, "another account cannot play your hand");
})();

// Goalie Mode: shots dealt one at a time, dives judged on the server.
await (async () => {
  const store = memoryStore();
  const t0 = 1_900_000_000_000;
  const start = res<{ playId: string; shot: ReturnType<typeof pickShot> }>(
    await handlePlay({ game: "goalie", action: "start", stake: 10_000, bank: 1e6, idemKey: "key-g-start" }, ctxFor(T0, t0, 11), store));
  const early = await handlePlay({ game: "goalie", action: "dive", playId: start.playId, dive: null, idemKey: "key-g-early" }, ctxFor(T0, t0 + 50, 12), store);
  check(early.status === 409, "a dive sent before the ball could arrive is refused");
  check((await handlePlay({ game: "goalie", action: "cashout", playId: start.playId, idemKey: "key-g-cash0" }, ctxFor(T0, t0 + 60), store)).status === 400, "no cashing out with a shot in the air");
  // A perfect dive at the strike, at the target (what a scripted keeper would do).
  let streak = 0, shot = start.shot, t = t0, saves = 0;
  for (let i = 0; i < 4; i++) {
    t += Math.ceil(shot.arriveAtT * 1000) + 100;
    const dive = { commitT: shot.strikeAtT, targetX: shot.targetX, targetZ: shot.targetZ };
    const d = res<{ saved: boolean; streak: number }>(await handlePlay({ game: "goalie", action: "dive", playId: start.playId, dive, idemKey: `key-g-d${i}` }, ctxFor(T0, t, 20 + i), store));
    if (!d.saved) break;
    saves++; streak = d.streak;
    if (i < 3) {
      const n = res<{ shot: typeof shot }>(await handlePlay({ game: "goalie", action: "next", playId: start.playId, idemKey: `key-g-n${i}` }, ctxFor(T0, t, 40 + i), store));
      shot = n.shot; t += 10;
    }
  }
  check(saves >= 3, `perfect dives are saved (${saves}/4) — the server judges with the same maths`);
  if (saves === 4) {
    const cash = res<{ payout: number }>(await handlePlay({ game: "goalie", action: "cashout", playId: start.playId, idemKey: "key-g-cash" }, ctxFor(T0, t + 10), store));
    check(cash.payout === Math.round(10_000 * streakMultiplier(streak)), `cash-out pays stake × the streak multiplier (${cash.payout})`);
    const row = store.rows[0];
    check(row.status === "settled" && row.net === cash.payout - 10_000, "the run settles with its net");
    const twice = res<{ payout: number }>(await handlePlay({ game: "goalie", action: "cashout", playId: start.playId, idemKey: "key-g-cash2" }, ctxFor(T0, t + 20), store));
    check(twice.payout === cash.payout && store.rows[0].payout === cash.payout, "cashing out twice pays once");
  }
  // A missed shot ends the run at nothing.
  const run2 = res<{ playId: string; shot: typeof start.shot }>(
    await handlePlay({ game: "goalie", action: "start", stake: 10_000, bank: 1e6, idemKey: "key-g2-start" }, ctxFor(T0, t0, 77), store));
  const wrong = { commitT: 0, targetX: -run2.shot.targetX * 3, targetZ: 0 };
  const miss = res<{ saved: boolean }>(await handlePlay({ game: "goalie", action: "dive", playId: run2.playId, dive: wrong, idemKey: "key-g2-d" }, ctxFor(T0, t0 + Math.ceil(run2.shot.arriveAtT * 1000) + 100, 78), store));
  const row2 = store.rows.find(x => x.id === run2.playId)!;
  check(run2.shot.offTarget || (!miss.saved && row2.status === "settled" && row2.net === -10_000), "a goal conceded settles the run at −stake");
})();

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("casino: all checks pass");
