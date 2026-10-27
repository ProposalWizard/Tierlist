// Twin test: real matches PLAYED through roblox/game/match.ts (the website's
// CanvasMatch without the screen). A robot gives the same inputs on both
// sides: drags back from the ball towards goal, taps the strike screen, runs
// after a pass, dribbles on the stick, presses every pause button. Each
// chance's outcome and the final stats must print the same.
// Each match is also played from the trimmed career (matchCareer, what a
// player's device is sent): it must play exactly the same.
//   TWIN_MATCHES=3 TWIN_MATCH_DIVS=premier npx tsx roblox/twin/match.twin.ts
import * as F from "../game/flow";
import * as M from "../game/match";
import * as C from "../../lib/star/clubs";
import type { StarPlayer, MatchStats } from "../../lib/star/types";
import { PictureMemory } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import type { CareerDivision } from "../../lib/star/calendar";
declare const process: { env: Record<string, string | undefined> };

const MATCHES = process.env.TWIN_MATCHES ? Number(process.env.TWIN_MATCHES) : null;
const ONLY = process.env.TWIN_MATCH_DIVS?.split(",");
// Sheffield United's first 8 include a top-down dribble and a penalty shootout.
const DIVS0: [CareerDivision, readonly string[], number, number][] = [
  ["premier", C.PREMIER_LEAGUE_CLUBS, 5, 3], ["league_two", C.LEAGUE_TWO_CLUBS, 4, 3], ["championship", C.CHAMPIONSHIP_CLUBS, 15, 8],
];
const DIVS = ONLY ? DIVS0.filter(([d]) => ONLY.includes(d)) : DIVS0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const DT = 1 / 60;

/** Plays one match with the robot's inputs; returns the printed lines. */
function play(setup: M.MatchSetup): { lines: string[]; stats: MatchStats | null } {
  const lines: string[] = [];
  // the website rolls some looks and lines with Math.random: seeded here so both sides match
  Math.random = mulberry32(setup.seed ^ 0x51ed);
  const m = M.startMatch({ ...setup, pictures: new PictureMemory("twin", false) });
  let chance = 0;
  let lastPhase = "";
  let phaseFrames = 0;
  let frames = 0;
  while (!m.result && frames++ < 400000) {
    const ph: string = m.phase;
    if (ph !== lastPhase) {
      if (ph === "result" || lastPhase === "flight" || lastPhase === "tdDribble") {
        lines.push(`  c${chance} ${m.minute}' ${m.sc.kind} ${lastPhase} -> ${ph} ${m.outcome ?? "-"} ${m.userScore}-${m.oppScore} t${r2(m.now)}`);
      }
      if (ph === "aim" || ph === "tdDribble") chance++;
      if (ph === "tdDribble" || ph === "runup") lines.push(`  phase ${ph} ${m.minute}`);
      lastPhase = ph;
      phaseFrames = 0;
    }
    phaseFrames++;
    if (m.pause) {
      if (m.pause.halfTime) M.drinkKib(m);
      lines.push(`  pause ${m.minute}' ${m.pause.cta}`);
      M.continuePause(m);
    } else if (m.phase === "aim" && phaseFrames === 20) {
      const b = m.sc.ball;
      const gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2 + (((chance * 37) % 7) - 3) * 0.6;
      const dx = gx - b.x, dy = 0 - b.y, n = Math.hypot(dx, dy) || 1;
      const pull = (m.camera.x2 - m.camera.x1) * (0.12 + (chance % 4) * 0.04);
      if (chance % 5 === 3) M.armPowerShot(m, true);
      M.pointerDown(m, { x: b.x, y: b.y });
      M.pointerMove(m, { x: b.x - (dx / n) * pull * 0.5, y: b.y - (dy / n) * pull * 0.5 });
      M.pointerMove(m, { x: b.x - (dx / n) * pull, y: b.y - (dy / n) * pull });
      M.pointerUp(m);
    } else if (m.phase === "contact" && phaseFrames === 15) {
      if (m.powerStrike) M.powerContact(m, ((chance * 29) % 10) / 10);
      else if (chance % 7 === 6) M.contactTimeout(m);
      else M.contact(m, { cx: (((chance * 13) % 5) - 2) * 0.12, cy: (((chance * 7) % 5) - 2) * 0.12, lift: (chance % 3) * 0.3 });
    } else if (m.phase === "runup" && phaseFrames === 10) {
      M.runupNudge(m, (((chance * 3) % 5) - 2) * 0.03, 0);
    } else if (m.phase === "flight") {
      if (m.playOn && phaseFrames % 30 === 1) M.steerRun(m, ((Math.floor(phaseFrames / 30) % 3) - 1) * 0.6, -1, chance % 2 === 0);
      if (phaseFrames === 45 && chance % 4 === 1) { const said = M.callForBall(m); if (said) lines.push(`  call: ${said}`); }
    } else if (m.phase === "tdDribble") {
      if (phaseFrames % 20 === 1) M.dribbleStick(m, ((Math.floor(phaseFrames / 20) % 3) - 1) * 0.5, 1);
      if (phaseFrames % 90 === 45) M.dribbleBurst(m, (Math.floor(phaseFrames / 90) % 2) === 0 ? -1 : 1);
      if (phaseFrames === 150 && chance % 3 === 0 && m.td && m.td.mates.length > 0) M.dribblePass(m, { x: m.td.mates[0].x, y: m.td.mates[0].y });
    }
    M.tick(m, DT);
  }
  const s = m.result;
  for (const e of m.goalEvents) lines.push(`  goal ${e.minute} ${e.scorer} a:${e.assist} you:${e.isUserGoal} ${e.how}`);
  lines.push(s
    ? `  FT ${s.homeScore}-${s.awayScore} goals ${s.goals} assists ${s.assists} chances ${s.chances} passes ${s.passes} energy ${r2(s.endEnergy ?? -1)} rating ${r2(s.rating)} played ${chance} frames ${frames}`
    : `  NO RESULT after ${frames} frames, phase ${m.phase} minute ${m.minute}`);
  return { lines, stats: s };
}

for (const [div, clubs, pick, count] of DIVS) {
  const club = clubs[pick % clubs.length];
  const p = { firstName: "Match", lastName: "Robot", age: 18, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  let g = F.newGame(p, [...clubs], div);
  console.log(`== ${div} ${club}`);
  let played = 0, steps = 0;
  while (played < (MATCHES ?? count) && steps++ < 400) {
    if (g.phase !== "dashboard") {
      if (g.phase === "post-match") g = F.postMatchContinue(g);
      else if (g.phase === "draw") g = F.drawContinue(g);
      else if (g.phase === "knockout-roundup") g = F.knockoutContinue(g);
      else g = F.backToDashboard(g);
      continue;
    }
    const day = F.matchday(g);
    if (day.seasonOver) break;
    if (!day.canPlay || !day.fixture) { g = F.watchFromStands(g); continue; }
    const readied = M.readyForMatch(g.career);
    const setup = M.matchSetupFor(readied);
    if (!setup) break;
    console.log(`match ${played + 1} v ${day.fixture.opponent} ${day.fixture.home ? "home" : "away"} on ${setup.startMinute}' seed ${setup.seed}`);
    const full = play(setup);
    for (const l of full.lines) console.log(l);
    const thin = play({ ...setup, career: M.matchCareer(setup.career) });
    const same = thin.lines.join("\n") === full.lines.join("\n");
    console.log(`  trimmed career: ${same ? "same" : "DIFFERENT"}`);
    if (!same) for (const l of thin.lines) console.log(`  thin${l}`);
    if (!full.stats) break;
    g = F.matchComplete(g, full.stats, readied, day.fixture);
    played++;
  }
}
