// Twin test: the trial PLAYED through roblox/game/trialPlay.ts (all five
// stages, with the real match for the free kick, the gate and the shootout),
// then the server's steps (roblox/game/trialFlow.ts): the results recorded,
// the scout's offer, the manager's talk and the signing. A robot gives the
// same inputs on both sides; every line must match.
//   TWIN_TRIALS=3 npx tsx roblox/twin/trial.twin.ts
import * as T from "../game/trialPlay";
import * as TF from "../game/trialFlow";
import * as M from "../game/match";
import * as S from "../game/strikeScreen";
import { PictureMemory } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";
import type { CareerDivision } from "../../lib/star/calendar";
declare const process: { env: Record<string, string | undefined> };

const TRIALS = Number(process.env.TWIN_TRIALS ?? 4);
const r2 = (n: number) => Math.round(n * 100) / 100;
const DT = 1 / 60;
const DIVS: [CareerDivision, string][] = [["league_two", "Bristol Rovers"], ["premier", "Brentford"], ["championship", "Burnley"], ["national_league", "Altrincham"]];

for (let t = 0; t < TRIALS; t++) {
  const [div, club] = DIVS[t % DIVS.length];
  Math.random = mulberry32(0x7a1 + t);
  const p = { firstName: "Trial", lastName: "Robot", age: 17, skinTone: "tan", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  const career = TF.newTrialCareer(p, div, 1000 + t * 7919);
  const tr = career.trial!;
  console.log(`== trial ${t + 1} at ${club}: seed ${tr.seed} base ${r2(tr.baseDifficulty)} adversity ${tr.adversity ?? "-"}`);
  const tp = T.startTrialPlay(career);
  let frames = 0, stageFrames = 0, lastStage = "", lastPhase = "", pf = 0, chance = 0;
  let strike: S.StrikeScreen | null = null;
  while (!tp.done && frames++ < 200000) {
    const v = T.trialView(tp);
    const stageKey = `${tp.stage}:${tp.card?.kind ?? ""}`;
    if (stageKey !== lastStage) { lastStage = stageKey; stageFrames = 0; if (tp.card) console.log(`  card ${v.card?.kind} ${v.card?.label ?? ""}`); }
    stageFrames++;
    if (tp.card?.kind === "scout" && stageFrames === 30) T.tapToGo(tp);
    const m = T.pitchMatch(tp);
    if (m) {
      const ph: string = m.phase;
      if (ph !== lastPhase) {
        if (ph === "result") console.log(`  ${tp.stage} ${m.sc.kind} -> ${m.outcome ?? "-"} t${r2(tp.clock)}`);
        if (ph === "aim") chance++;
        lastPhase = ph; pf = 0;
      }
      pf++;
      if (ph === "aim" && pf === 25) {
        const b = m.sc.ball;
        const cones = v.cones;
        const gx = cones.length ? (cones[0].x + cones[1].x) / 2 + ((chance % 3) - 1) * 0.5 : (m.sc.goal.x1 + m.sc.goal.x2) / 2 + (((chance * 37) % 7) - 3) * 0.6;
        const gy = cones.length ? cones[0].y : 0;
        const dx = gx - b.x, dy = gy - b.y, n = Math.hypot(dx, dy) || 1;
        const pull = (m.camera.x2 - m.camera.x1) * (0.14 + (chance % 3) * 0.05);
        M.pointerDown(m, { x: b.x, y: b.y });
        M.pointerMove(m, { x: b.x - (dx / n) * pull, y: b.y - (dy / n) * pull });
        M.pointerUp(m);
      } else if (ph === "contact") {
        if (pf === 1) strike = S.openStrike(m);
        if (strike) {
          if (pf === 18) S.strikeTap(strike, (((chance * 13) % 5) - 2) * 0.2, (((chance * 7) % 5) - 2) * 0.15);
          S.strikeStep(strike, m, DT);
        }
      }
    }
    if (tp.dribble) {
      if (!tp.dribble.started && stageFrames === 20) T.tapToGo(tp);
      if (tp.dribble.started) {
        T.dribbleSteer(tp, Math.sin(stageFrames / 40) * 0.8);
        if (stageFrames % 70 === 35) T.dribbleKnock(tp, stageFrames % 140 === 35 ? -1 : 1);
      }
    }
    if (tp.vision) {
      const vs = tp.vision;
      if (vs.phase === "ready" && stageFrames === 20) T.tapToGo(tp);
      if (vs.phase === "live" && tp.clock - vs.startedAt > 0.3 + vs.rep * 0.25) {
        // the robot finds the right man on even reps, the man next to him on odd ones
        const pick = vs.rep % 2 === 0 ? vs.setup.correct : (vs.setup.correct + 1) % vs.layout.men.length;
        if (vs.rep !== 4) T.visionTap(tp, vs.layout.men[pick]);
      }
    }
    T.tick(tp, DT);
  }
  console.log(`  played in ${frames} frames, ${r2(tp.clock)} s`);
  for (const r of tp.back.results) console.log(`  ${r.stage} quality ${r2(r.quality)} score ${tp.trial.results[r.stage as keyof typeof tp.trial.results]?.score}`);
  // the server's side: through JSON, as the device sends it
  const back = JSON.parse(JSON.stringify(tp.back)) as TF.TrialReturn;
  const recorded = TF.recordTrialReturn(career, back);
  console.log(`  recorded: ${recorded ? "yes" : "NO"}; final pen ${back.finalPenScored}`);
  if (!recorded) continue;
  const mt = TF.managerTalk(recorded);
  if (mt) {
    console.log(`  offer: ${mt.offer.club} (${mt.offer.division}) ${mt.talk.openingWeekly} a week, first contract ${mt.firstContract}`);
    for (const l of mt.talk.lines) console.log(`  says: ${l}`);
  }
  const signed = TF.acceptManagerOffer(recorded);
  console.log(signed
    ? `  signed: ${signed.player.club} ${signed.contract.club} ${signed.contract.wage} ${signed.contract.seasonsRemaining} seasons, ${signed.league.length} clubs, ${signed.fixtures.length} fixtures`
    : "  not signed");
  // a tampered result is refused
  console.log(`  tampered refused: ${TF.recordTrialReturn(career, { ...back, results: back.results.map((r) => ({ ...r, quality: 2 })) }) === null}`);
}
void PictureMemory;
