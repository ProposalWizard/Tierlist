import {
  seededRng, spinRoulette, roulettePayout, spinSlots, slotsPayout, drawCard, dealerPlay, blackjackSettle,
  raceScores, finishOf, dealRaceRatings, raceWinOdds, handValue, SLOTS_SYMBOLS, ROULETTE_ORDER,
  type Card, type RouletteChoice,
} from "../../lib/star/casinoRules";
import { rouletteRound, slotsRound, blackjackDeal, blackjackHit, blackjackStand, horseBetRound } from "../../lib/star/casinoRounds";
import {
  pocketAngle, pocketAt, planBall, ballAt, faceAngle, faceAt, planReel, reelAt, raceDurations, horseAt, crossingOrder, cardSpot,
} from "../../lib/star/casino3d/motion";
import { stationAt, STAND, BAR, FOCUS, IN_ROOM_GAMES } from "../../lib/star/casino3d/plan";

/**
 * THE 3D CASINO'S GAMES (Harry, 8 Oct 2026: "the next part of the 3D casino
 * is having the games actually run in 3D").
 *  1. The rounds the 3D room plays (lib/star/casinoRounds.ts) pay exactly
 *     what the flat casino's own code paid: the old inline code from
 *     Casino.tsx is copied below and both are run on the same seeds.
 *  2. The 3D only SHOWS the roll: the ball always comes to rest in the
 *     winning pocket, each reel on its symbol, the horses cross in the order
 *     the scores gave.
 *  3. The bar no longer shows the "Horse racing" card.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const SEEDS = 3000;

// ── 1. Same seed, same payout ─────────────────────────────────────────────
{
  // Casino.tsx before the 3D games (8 Oct 2026), verbatim apart from Math.random → rng.
  const oldRoulette = (picked: RouletteChoice, stake: number, rng: () => number) => { const w = spinRoulette(rng); return { winner: w, payout: roulettePayout(picked, w, stake) }; };
  const oldSlots = (stake: number, rng: () => number) => { const r = spinSlots(rng); return { reels: r, payout: slotsPayout(r, stake) }; };
  const oldDeal = (rng: () => number) => ({ player: [drawCard(rng), drawCard(rng)], dealer: [drawCard(rng), drawCard(rng)] });
  const oldHit = (player: Card[], rng: () => number) => [...player, drawCard(rng)];
  const oldStand = (player: Card[], dealer: Card[], stake: number, rng: () => number) => {
    const full = dealerPlay(dealer, rng);
    const s = blackjackSettle(player, full, stake);
    return { dealer: full, payout: s.payout, verdict: s.verdict };
  };
  const oldHorse = (ratings: number[], odds: number[], pickIdx: number, stake: number, rng: () => number, noise: number) => {
    const scores = raceScores(ratings, rng, noise);
    return { scores, payout: finishOf(scores, pickIdx) === 1 ? Math.round(stake * odds[pickIdx]) : 0 };
  };
  const choices: RouletteChoice[] = ["red", "black", "even", "odd", 0, 7, 17, 32];
  let rDiff = 0, sDiff = 0, bDiff = 0, hDiff = 0;
  let rPaid = 0, sPaid = 0, bPaid = 0, hPaid = 0, staked = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const c = choices[seed % choices.length];
    const a = rouletteRound(c, 2000, seededRng(seed)), b = oldRoulette(c, 2000, seededRng(seed));
    if (a.winner !== b.winner || a.payout !== b.payout) rDiff++;
    rPaid += a.payout;

    const s1 = slotsRound(2000, seededRng(seed)), s2 = oldSlots(2000, seededRng(seed));
    if (s1.reels.join() !== s2.reels.join() || s1.payout !== s2.payout) sDiff++;
    sPaid += s1.payout;

    // a whole hand: deal, hit while under 15, stand — one rng for each side
    const r1 = seededRng(seed), r2 = seededRng(seed);
    let h1 = blackjackDeal(r1), h2 = oldDeal(r2);
    let p1 = h1.player, p2 = h2.player;
    while (handValue(p1) < 15) { p1 = blackjackHit(p1, r1); p2 = oldHit(p2, r2); }
    let pay1 = 0, pay2 = 0;
    if (handValue(p1) <= 21) {
      const st1 = blackjackStand(p1, h1.dealer, 2000, r1), st2 = oldStand(p2, h2.dealer, 2000, r2);
      pay1 = st1.payout; pay2 = st2.payout;
      if (st1.dealer.length !== st2.dealer.length || st1.verdict !== st2.verdict) bDiff++;
    }
    if (JSON.stringify(p1) !== JSON.stringify(p2) || pay1 !== pay2) bDiff++;
    bPaid += pay1;
    void h1; void h2; h1 = h2 = null as never;

    const ratings = dealRaceRatings(seededRng(seed * 7));
    const odds = raceWinOdds(ratings);
    const pick = seed % 6;
    const x1 = horseBetRound(ratings, odds, pick, 2000, seededRng(seed), 50), x2 = oldHorse(ratings, odds, pick, 2000, seededRng(seed), 50);
    if (x1.scores.join() !== x2.scores.join() || x1.payout !== x2.payout) hDiff++;
    hPaid += x1.payout;
    staked += 2000;
  }
  check(rDiff === 0, `roulette: the 3D round pays as the flat game on ${SEEDS} seeds (${rDiff} differ)`);
  check(sDiff === 0, `slots: the 3D round pays as the flat game on ${SEEDS} seeds (${sDiff} differ)`);
  check(bDiff === 0, `blackjack: the 3D hand plays and pays as the flat game on ${SEEDS} seeds (${bDiff} differ)`);
  check(hDiff === 0, `horses: the 3D race pays as the flat game on ${SEEDS} seeds (${hDiff} differ)`);
  console.log(`returned per ★1 over ${SEEDS} seeded rounds (same both ways): roulette ${(rPaid / staked).toFixed(3)}, slots ${(sPaid / staked).toFixed(3)}, blackjack ${(bPaid / staked).toFixed(3)}, horses ${(hPaid / staked).toFixed(3)}`);
}

// ── 2a. The ball rests in the winning pocket ─────────────────────────────
{
  check(ROULETTE_ORDER.every((n) => pocketAt(pocketAngle(n)) === n), "every pocket's middle reads back as its own number");
  let wrong = 0, wandered = 0, wentForward = 0;
  for (let k = 0; k < 37 * 40; k++) {
    const winner = ROULETTE_ORDER[k % 37];
    const phi0 = (k * 2.3917) % 40 - 20;
    const p = planBall(winner, phi0, { T: 5, trackR: 0.43, pocketR: 0.31 });
    const end = ballAt(p, p.T);
    if (pocketAt(end.phi) !== winner || Math.abs(end.r - 0.31) > 1e-9 || end.y !== 0) wrong++;
    // from 90% of the way the ball sits in the pocket and does not leave it
    for (let t = p.T * 0.9; t <= p.T + 1; t += 0.05) if (pocketAt(ballAt(p, t).phi) !== winner) { wandered++; break; }
    if (p.phiEnd > p.phi0) wentForward++;
  }
  check(wrong === 0, `the ball ends in the winning pocket on every throw (${wrong} of ${37 * 40} miss)`);
  check(wandered === 0, `once in, the ball stays in that pocket (${wandered} wander)`);
  check(wentForward === 0, "the ball always runs against the wheel");
}

// ── 2b. Each reel stops on its symbol ────────────────────────────────────
{
  let wrong = 0, backwards = 0;
  for (let k = 0; k < 600; k++) {
    const sym = k % SLOTS_SYMBOLS.length;
    const p = planReel(sym, (k * 1.7) % 9, 1.2 + (k % 3) * 0.45);
    if (faceAt(reelAt(p, p.tStop + 0.3)) !== sym || faceAt(p.end) !== sym) wrong++;
    let prev = -Infinity;
    for (let t = 0; t <= p.tStop; t += 0.01) { const a = reelAt(p, t); if (a < prev - 1e-9) { backwards++; break; } prev = a; }
  }
  check(SLOTS_SYMBOLS.every((_, i) => faceAt(faceAngle(i)) === i), "every face's middle reads back as its own symbol");
  check(wrong === 0, `every reel stops on the rolled symbol (${wrong} of 600 wrong)`);
  check(backwards === 0, `no reel runs backwards while braking (${backwards})`);
}

// ── 2c. The horses cross in the rolled order ─────────────────────────────
{
  let wrong = 0, back = 0;
  for (let seed = 1; seed <= 800; seed++) {
    const ratings = dealRaceRatings(seededRng(seed));
    const scores = raceScores(ratings, seededRng(seed + 99), 50);
    const durs = raceDurations(scores);
    const wob = scores.map((_, i) => (((seed * 31 + i * 17) % 100) / 100 - 0.5) * 1.6);
    // the order they reach the line, stepping through the race
    const crossed: number[] = [];
    let prev = scores.map(() => 0);
    for (let t = 0; t <= 8 && crossed.length < 6; t += 0.002) {
      const now = durs.map((d, i) => horseAt(t, d, wob[i]));
      now.forEach((x, i) => { if (x < prev[i] - 1e-9) back++; if (x >= 1 && !crossed.includes(i)) crossed.push(i); });
      prev = now;
    }
    const byScore = [...scores.keys()].sort((a, b) => finishOf(scores, a) - finishOf(scores, b));
    // (two horses within one 2 ms step of each other can show up in the same step)
    if (durs[crossed[0]] - durs[byScore[0]] > 0.0021 || crossingOrder(durs)[0] !== byScore[0]) wrong++;
  }
  check(wrong === 0, `the winner of the roll is first past the post on the screen (${wrong} of 800 wrong)`);
  check(back === 0, `no horse goes backwards (${back})`);
}

// ── 2d. Cards fan out and never sit on each other ────────────────────────
{
  let overlap = 0;
  for (const who of ["player", "dealer"] as const) for (let n = 1; n <= 7; n++) for (let i = 1; i < n; i++) {
    if (Math.abs(cardSpot(who, i, n).x - cardSpot(who, i - 1, n).x) < 0.12) overlap++;
  }
  check(overlap === 0, "cards in a hand sit side by side");
}

// ── 3. The bar is not the racing screen ──────────────────────────────────
{
  let atBar = 0;
  for (let x = BAR.x + 0.3; x <= BAR.x + 1.3; x += 0.1) for (let z = BAR.z0; z <= BAR.z1; z += 0.1) if (stationAt(x, z) === "horses") atBar++;
  check(atBar === 0, `standing at the bar never shows the Horse racing card (${atBar} spots did)`);
  for (const g of IN_ROOM_GAMES) check(stationAt(...STAND[g].at) === g, `standing at the ${g} shows the ${g} card`);
  check(IN_ROOM_GAMES.every((g) => !!FOCUS[g]), "every in-room game has a close-up");
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("casino3dGames: all checks pass");
