import { awardsPlan, awardAt, beatAt, skipTarget, winnerPosAt, trophyLiftAt, nomineesFor, AWARD_ORDER, ROOM } from "../../lib/star/awardsNight";
import type { AwardWinner, SeasonAwardStats } from "../../lib/star/seasonAwards";

/**
 * THE SEASON AWARDS NIGHT'S PLAN (lib/star/awardsNight.ts): five awards in
 * order, three nominees each with the winner first, every beat in order,
 * skips that land on the next award, the same plan for the same seed.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const w = (name: string, value: number, isYou = false): AwardWinner => ({ name, club: isYou ? "Arsenal" : `Club ${name}`, isYou, value });
const you = (v: number) => w("You Player", v, true);
function stats(): SeasonAwardStats {
  const nominees: SeasonAwardStats["nominees"] = {
    goldenBoot: [you(27), w("A", 23), w("B", 19)],
    assistKing: [w("C", 15), you(12), w("D", 11)],
    goldenGlove: [w("E", 17), w("F", 15), w("G", 13)],
    youngPlayerOfSeason: [w("H", 88), you(85), w("I", 80)],
    playerOfSeason: [you(112), w("A", 104), w("J", 99)],
  };
  return {
    season: 4, leagueName: "Premier League",
    goldenBoot: nominees.goldenBoot![0], assistKing: nominees.assistKing![0], goldenGlove: nominees.goldenGlove![0],
    youngPlayerOfSeason: nominees.youngPlayerOfSeason![0], playerOfSeason: nominees.playerOfSeason![0],
    teamOfSeason: [], communityShieldGuess: null, superCupGuess: null, nominees,
  };
}

for (let seed = 1; seed <= 30; seed++) {
  const s = stats();
  const p = awardsPlan(s, seed);
  const tag = `seed ${seed}`;
  check(p.awards.map((a) => a.key).join() === AWARD_ORDER.join(), `${tag}: awards out of order`);
  check(p.yourWins === 2, `${tag}: you should win 2, got ${p.yourWins}`);
  check(p.end >= 34 && p.end <= 48, `${tag}: night lasts ${p.end.toFixed(1)} s`);
  let last = p.introEnd;
  for (const a of p.awards) {
    check(a.nominees.length === 3, `${tag} ${a.key}: ${a.nominees.length} nominees`);
    check(a.nominees[0] === a.winner && a.winner === s[a.key], `${tag} ${a.key}: winner not first`);
    check(new Set(a.nominees.map((n) => n.name + n.club)).size === 3, `${tag} ${a.key}: a nominee twice`);
    check(a.from === last && a.from < a.nomineesAt && a.nomineesAt < a.envelopeAt && a.envelopeAt < a.revealAt && a.revealAt < a.walkFrom && a.walkFrom < a.walkTo && a.walkTo < a.end, `${tag} ${a.key}: beats out of order`);
    const len = a.end - a.from;
    check(len >= 6 && len <= 10, `${tag} ${a.key}: lasts ${len.toFixed(1)} s`);
    last = a.end;
    // Beats read back the same.
    check(beatAt(p, a.from + 0.01) === "call" && beatAt(p, a.nomineesAt + 0.01) === "nominees" && beatAt(p, a.revealAt + 0.01) === "reveal"
      && beatAt(p, a.walkFrom + 0.01) === "walk" && beatAt(p, a.walkTo + 0.01) === "moment", `${tag} ${a.key}: beats wrong`);
    check(awardAt(p, a.from + 0.01) === a, `${tag} ${a.key}: awardAt wrong`);
    // The walk: by his table, then on the spot on the stage, never under the floor.
    const start = winnerPosAt(a, a.walkFrom - 0.01), end = winnerPosAt(a, a.walkTo + 1);
    check(!start.onStage && start.y === 0, `${tag} ${a.key}: not by his table before the walk`);
    check(end.onStage && Math.abs(end.y - ROOM.stageH) < 1e-9 && Math.abs(end.x - ROOM.spot.x) < 1e-9 && Math.abs(end.yaw) < 1e-6, `${tag} ${a.key}: not on the spot facing the room`);
    check(!winnerPosAt(a, a.walkFrom - 0.01).seen && winnerPosAt(a, a.walkFrom + 0.01).seen, `${tag} ${a.key}: seen at the wrong time`);
    for (let t = a.walkFrom; t <= a.walkTo; t += 0.05) {
      const at = winnerPosAt(a, t);
      check(at.y >= 0 && at.y <= ROOM.stageH + 1e-9, `${tag} ${a.key}: height ${at.y} at ${t}`);
      // Clear of every table (body ~0.25 m round).
      for (const tb of ROOM.tables) check(Math.hypot(at.x - tb.x, at.z - tb.z) > ROOM.tableR + 0.08 + 0.2, `${tag} ${a.key}: walks through a table at ${t.toFixed(2)}`);
    }
    check(trophyLiftAt(a, a.walkFrom) === 0 && trophyLiftAt(a, a.end) === 1, `${tag} ${a.key}: trophy lift wrong`);
    // A skip lands on the next award (or the end).
    for (const t of [a.from + 0.01, a.nomineesAt + 0.5, a.revealAt + 0.1, a.end - 0.01]) {
      const to = skipTarget(p, t);
      const next = p.awards[p.awards.indexOf(a) + 1];
      check(to === (next ? next.from : p.end), `${tag} ${a.key}: skip at ${t.toFixed(2)} goes to ${to}`);
    }
  }
  check(skipTarget(p, 0) === p.awards[0].from, `${tag}: skip in the intro`);
  check(beatAt(p, 0) === "intro" && beatAt(p, p.end) === "done", `${tag}: intro/done wrong`);
  // The same night every time.
  check(JSON.stringify(awardsPlan(stats(), seed)) === JSON.stringify(p), `${tag}: not deterministic`);
}

// A winner of two awards is one man from one seat.
{
  const p = awardsPlan(stats(), 3);
  const mine = p.awards.filter((a) => a.winner.isYou);
  check(mine.length === 2 && mine[0].winnerId === mine[1].winnerId && mine[0].seat === mine[1].seat, "your two awards: not the same seat");
}
// An older save (no nominees): the winner alone; an award with no winner is left out.
{
  const s = stats();
  delete s.nominees;
  s.goldenGlove = null;
  check(nomineesFor(s, "goldenBoot").length === 1, "old save: winner alone");
  const p = awardsPlan(s, 1);
  check(p.awards.length === 4 && !p.awards.some((a) => a.key === "goldenGlove"), "no-winner award not left out");
}

if (problems.length) {
  console.error(`awardsNight: ${problems.length} problem(s)\n  ` + problems.slice(0, 20).join("\n  "));
  process.exit(1);
}
console.log("awardsNight: 5 awards in order, 3 nominees each, beats in order, skips land on the next award, walks clear of the tables, deterministic — ok");
