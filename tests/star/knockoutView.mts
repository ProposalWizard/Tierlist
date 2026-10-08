import { cupBoard, cupBracket, euroBoard, euroBracketView, euroDoneRound } from "../../lib/star/knockoutView";
import { playCupRound, tieWinner, type CupState } from "../../lib/star/cups";
import { openEuroBracket, advanceEuroBracket, euroTieFromBracket, settleYourKoTie } from "../../lib/star/euroBracket";
import { simulate, type EuroState, type EuroTie } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";

/**
 * THE CUP AND EUROPEAN ROUND-UPS (lib/star/knockoutView.ts): the results
 * board every round and the 16-club bracket from the last sixteen.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── A cup, played out round by round with you winning ───────────────────────
{
  const clubs = Array.from({ length: 64 }, (_, i) => `K${i + 1}`);
  const you = "K5";
  const league = clubs.map((name, i) => ({ name, strength: 85 - i * 0.4 } as never));
  const str = (c: string) => 85 - (Number(c.slice(1)) - 1) * 0.4;
  const rng = mulberry32(3);
  let st: CupState = { competition: "FA Cup", rounds: [{ name: "Round of 64", ties: [] }] };
  // Draw with you in it.
  const hat = [...clubs];
  st.rounds[0].ties = Array.from({ length: 32 }, (_, i) => ({ home: hat[2 * i], away: hat[2 * i + 1] }));
  for (let r = 0; r < 6; r++) {
    const mine = st.rounds[r].ties.find(t => t.home === you || t.away === you)!;
    const youHome = mine.home === you;
    st = playCupRound(st, league, you, { hs: youHome ? 3 : 0, as: youHome ? 0 : 3 }, rng);
    const board = cupBoard(st, r, you, str);
    check(board.length === 32 >> r && board[0].yours, `round ${r}: every tie on the board, yours first`);
    check(board.every(b => b.hs !== undefined && !!b.winner), `round ${r}: every result shows`);
    check(board.every(b => !b.upset || str(b.winner!) <= str(b.winner === b.home ? b.away : b.home) - 8), "upsets are real ones");
    const br = cupBracket(st, r, you);
    if (r < 2) { check(br === null, `round ${r}: no bracket before the last 16`); continue; }
    check(!!br && br.animate === r - 2, `round ${r}: bracket animates its own round`);
    const done = r - 2;
    br!.rounds.forEach((ties, bi) => {
      ties.forEach((t, j) => {
        if (bi <= done) check(t.topScore !== undefined && !!t.winner, `round ${r}: bracket round ${bi} tie ${j} has a result`);
        else check(t.topScore === undefined, `round ${r}: bracket round ${bi} has no score yet`);
        if (bi > 0 && bi <= done + 1 && t.top) {
          // The two feeders of this tie sit at 2j and 2j+1 and their winners are top/bottom.
          const f = br!.rounds[bi - 1];
          check(f[2 * j].winner === t.top && f[2 * j + 1].winner === t.bottom, `round ${r}: tie ${bi}/${j} is fed by the two ties next to each other`);
        }
      });
    });
    if (r === 5) check(br!.champion === you, "the champion shows after the final");
  }
  check(st.winner === you, "you won it");
}

// ── Europe ───────────────────────────────────────────────────────────────────
{
  const table = Array.from({ length: 36 }, (_, i) => `E${i + 1}`);
  const you = "E3";
  const str = (c: string) => 90 - Number(c.slice(1)) * 0.6;
  const rng = mulberry32(11);
  const bracket = advanceEuroBracket(openEuroBracket(table, rng), you, str, simulate, rng);
  let state = { competition: "Champions League", clubs: table.map(n => ({ name: n, strength: str(n), pot: 1 })), leaguePhase: [], liveTable: [],
    matchdaysPlayed: 8, ties: [], bracket } as unknown as EuroState;
  check(euroDoneRound(state, you) === -1, "nothing done after the league phase");
  const po = euroBoard(state, 0, you, false);
  check(po.length === 8 && po.every(b => b.hs === undefined), "play-off pairings show without scores");
  let v = euroBracketView(state, you, -1)!;
  check(v.rounds[0].every(t => !!t.top && !t.bottom), "before the play-off: seeds wait, no opponents");
  check(v.rounds[0].some(t => t.top === you && t.yours), "you (3rd) are a seed");

  // The play-off is played around you: after it (your next is the R16) it shows.
  v = euroBracketView(state, you, 0)!;
  check(v.rounds[0].every(t => !!t.top && !!t.bottom) && v.animate === -1, "after the play-off: R16 full, the play-off winners arrive");
  const et = euroTieFromBracket(state.bracket!, you, str)!;
  check(et.round === "Round of 16", "your first tie is the round of 16");
  const won: EuroTie = { ...et, legs: et.legs.map(l => ({ ...l, us: 2, them: 0 })), result: "W" };
  state = { ...state, bracket: settleYourKoTie(state.bracket!, you, won, str, simulate, rng) };
  const done = euroDoneRound(state, you);
  check(done === 1, `done = round of 16 (${done})`);
  v = euroBracketView(state, you, done)!;
  check(v.animate === 0 && v.rounds[0].every(t => t.topScore !== undefined), "R16 results show and animate");
  check(v.rounds[1].every(t => !!t.top && !!t.bottom) && v.rounds[1].every(t => t.topScore === undefined), "quarter-finals filled, no scores");
  check(v.rounds[2].every(t => !t.top), "semi-finals still empty");
  const board = euroBoard(state, 1, you, true);
  check(board[0].yours && board[0].hs !== undefined && board.every(b => b.legs?.length === 2), "R16 board: yours first, two legs each");
}

if (problems.length) {
  console.error(`knockoutView: ${problems.length} problem(s)`);
  for (const p of [...new Set(problems)].slice(0, 25)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("knockoutView: all good");
