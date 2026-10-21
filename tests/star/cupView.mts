import { makeInitialCareer } from "../../lib/star/careerFlow";
import { playCupRound, tieWinner, roundNamesFor, type CupState } from "../../lib/star/cups";
import { cupViewFor, cupStatus, roundShort } from "../../lib/star/cupView";
import { cupBracket } from "../../lib/star/knockoutView";
import { LEAGUE_ONE_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * A DOMESTIC CUP'S OWN SCREEN (CupScreen.tsx, 20 Oct 2026): what
 * lib/star/cupView.ts tells it — the road, your path, who is left, the
 * bracket round, the headline — checked on the Lower League Trophy from a
 * League One career (a tie and a bye), a Premier League career (not in it),
 * and the FA Cup.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}
const careerAt = (club: string, clubs: string[], div: "league_one" | "premier") =>
  makeInitialCareer(playerAt(club), [...clubs], div);
const llt = (c: CareerState) => c.cupState!.find(s => s.competition === "Lower League Trophy")!;
const withCup = (c: CareerState, st: CupState): CareerState =>
  ({ ...c, cupState: c.cupState!.map(s => (s.competition === st.competition ? st : s)) });

/** Play the current round, you winning (or losing) yours 2–0 / 0–2. */
function playRound(st: CupState, c: CareerState, win: boolean, seed: number): CupState {
  const you = c.player.club;
  const r = st.rounds[st.rounds.length - 1];
  const tie = r.ties.find(t => t.home === you || t.away === you);
  const res = tie ? (tie.home === you === win ? { hs: 2, as: 0 } : { hs: 0, as: 2 }) : null;
  return playCupRound(st, c.league, you, res, mulberry32(seed));
}

// ── Round 1, with a tie ─────────────────────────────────────────────────────
{
  let c: CareerState | null = null;
  for (const club of LEAGUE_ONE_CLUBS) {
    const t = careerAt(club, LEAGUE_ONE_CLUBS, "league_one");
    if (!llt(t).rounds[0].byes?.includes(club)) { c = t; break; }
  }
  check(!!c, "a League One club without a bye");
  if (c) {
    const v = cupViewFor(c, llt(c));
    check(v.names.length === 7 && v.marks.length === 7, `7 rounds on the road (${v.marks.length})`);
    check(v.marks[0] === "now", `Round 1 is your next tie (${v.marks[0]})`);
    check(v.marks.slice(1).every(m => m === "future"), "the other six are not drawn");
    check(v.entered && !v.tied && !v.out, "in it, not out");
    check(v.path.length === 1 && v.path[0].kind === "tie" && v.path[0].result === null, "your road: the Round 1 tie, not played");
    check(v.left.length === 120, `120 clubs still in it (${v.left.length})`);
    check(v.bracketFrom === null, "no bracket before the last sixteen");
    check(!!v.next && v.next.competition === "Lower League Trophy", "your next Trophy fixture is found");
    const st = cupStatus(v, c);
    check(st.headline === "Round 1", `headline Round 1 (${st.headline})`);
    check(/home to|away at/.test(st.sub), `the line under it names your opponent (${st.sub})`);
    check(roundShort("Quarter-Final") === "QF" && roundShort("Round 1") === "R1", "short round names");

    // Win every round to the final.
    let cup = llt(c);
    for (let i = 0; i < 7; i++) cup = playRound(cup, c, true, 900 + i);
    const won = withCup(c, cup);
    const w = cupViewFor(won, cup);
    check(cup.winner === c.player.club, "won it");
    check(w.marks.every(m => m === "won"), `every round marked won (${w.marks.join(",")})`);
    check(w.path.length === 7 && w.path.every(s => s.result === "won" && s.you === 2 && s.them === 0), "your road: seven 2–0 wins");
    check(w.left.length === 1 && w.left[0] === c.player.club, "only the winner is left");
    const names = roundNamesFor("Lower League Trophy");
    check(w.bracketFrom === names.length - 1, `bracket from the final (${w.bracketFrom})`);
    const br = cupBracket(cup, w.bracketFrom!, c.player.club);
    check(!!br && br.champion === c.player.club, "the bracket crowns you");
    check(cupStatus(w, won).headline === "Winners!", "headline Winners!");

    // Out in the Round of 32.
    let out = llt(c);
    out = playRound(out, c, true, 11); out = playRound(out, c, true, 12); out = playRound(out, c, false, 13);
    const o = cupViewFor(withCup(c, out), out);
    check(o.out === "Round of 32", `out in the Round of 32 (${o.out})`);
    check(o.marks[0] === "won" && o.marks[1] === "won" && o.marks[2] === "lost", `won, won, out (${o.marks.slice(0, 3).join(",")})`);
    check(o.marks[3] === "drawn", `the Round of 16 drawn without you (${o.marks[3]})`);
    check(o.left.length === 16 && !o.left.includes(c.player.club), `16 left, not you (${o.left.length})`);
    check(o.bracketFrom === 3, `bracket from the Round of 16 once drawn (${o.bracketFrom})`);
    const os = cupStatus(o, withCup(c, out));
    check(os.headline === "Out" && /Round of 32: lost 0–2 to /.test(os.sub), `out line (${os.sub})`);
    // Who is left = the winners of the round just played.
    const r32 = out.rounds[2];
    check(r32.ties.map(tieWinner).every(x => !!x && o.left.includes(x)), "every Round of 32 winner is still in it");
  }
}

// ── Round 1, with a bye ─────────────────────────────────────────────────────
{
  const club = LEAGUE_ONE_CLUBS.find(x => llt(careerAt(x, LEAGUE_ONE_CLUBS, "league_one")).rounds[0].byes?.includes(x));
  check(!!club, "a League One club with a bye");
  if (club) {
    const c = careerAt(club, LEAGUE_ONE_CLUBS, "league_one");
    const v = cupViewFor(c, llt(c));
    check(v.marks[0] === "bye", `Round 1 marked bye (${v.marks[0]})`);
    check(v.path.length === 1 && v.path[0].kind === "bye", "your road starts with the bye");
    const st = cupStatus(v, c);
    check(st.sub === "Through on a bye to the Round of 64", `bye line (${st.sub})`);
    const after = playRound(llt(c), c, true, 77);
    const a = cupViewFor(withCup(c, after), after);
    check(a.marks[0] === "bye" && a.marks[1] === "now", `bye, then your Round of 64 tie (${a.marks.slice(0, 2).join(",")})`);
    check(a.left.length === 64, `64 left after Round 1 (${a.left.length})`);
  }
}

// ── Not in it: a Premier League career ──────────────────────────────────────
{
  const c = careerAt(PREMIER_LEAGUE_CLUBS[0], PREMIER_LEAGUE_CLUBS, "premier");
  const v = cupViewFor(c, llt(c));
  check(!v.entered && v.path.length === 0, "a Premier League club is not in the Trophy");
  check(v.marks[0] === "drawn", `Round 1 drawn without you (${v.marks[0]})`);
  check(cupStatus(v, c).headline === "Not in it", "headline Not in it");
  // The FA Cup (ten rounds, Mikey 19 Oct 2026): a Premier League club joins in
  // the Third Round, so at the start it is "in it" but not yet drawn.
  const fa = c.cupState!.find(s => s.competition === "FA Cup")!;
  const f = cupViewFor(c, fa);
  check(!f.entered && f.joins === "Third Round", `the FA Cup: you join in the Third Round (${f.joins})`);
  check(cupStatus(f, c).headline === "Joins in the Third Round", `headline says when you join (${cupStatus(f, c).headline})`);
  check(f.names.length === roundNamesFor("FA Cup").length && f.names.length === 10, "the FA Cup's own ten rounds");
  check(f.bracketFrom === null, "no bracket yet");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 40)) console.log("  ✗", p);
  process.exit(1);
}
console.log("PASS cupView");
