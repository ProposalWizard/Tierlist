// Twin test: training levels PLAYED through roblox/game/trainingPlay.ts (the
// strike drills on the real match, the pace run, the vision picks), then the
// stars banked on the server (roblox/game/trainingFlow.ts). Same robot inputs
// on both sides; every line must match.
import * as T from "../game/trainingPlay";
import * as TR from "../game/trainingFlow";
import * as S from "../game/strikeScreen";
import * as M from "../game/match";
import * as F from "../game/flow";
import * as C from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";

const r2 = (n: number) => Math.round(n * 100) / 100;
const DT = 1 / 60;
const p = { firstName: "Train", lastName: "Robot", age: 18, skinTone: "tan", club: C.LEAGUE_TWO_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let career = F.newGame(p, [...C.LEAGUE_TWO_CLUBS], "league_two").career;
career = { ...career, energy: 100, trainingSessions: 99 };
const PLAN: [TR.TrainingSkill, number][] = [
  ["power", 1], ["technique", 1], ["freeKick", 1], ["pace", 1], ["vision", 1], ["aerial", 1],
  ["power", 8], ["technique", 6], ["vision", 6], ["pace", 5], ["freeKick", 9], ["vision", 14],
];
for (const [skill, level] of PLAN) {
  Math.random = mulberry32(level * 31 + skill.length);
  const tp = T.startTraining(career, skill, level);
  let frames = 0, pf = 0, last = "", tryNo = 0;
  let strike: S.StrikeScreen | null = null;
  while (!tp.done && frames++ < 60000) {
    const m = T.pitchMatch(tp);
    if (m) {
      const ph: string = m.phase;
      if (ph !== last) { last = ph; pf = 0; if (ph === "aim") tryNo++; }
      pf++;
      if (ph === "aim" && pf % 90 === 25) {
        const b = m.sc.ball;
        const cones = T.trainingFrame(tp).training.cones;
        let gx = (m.sc.goal.x1 + m.sc.goal.x2) / 2 + (tryNo - 2) * 2.2, gy = 0;
        if (cones.length) { gx = (cones[0].x + cones[1].x) / 2 + (tryNo - 2) * 0.4; gy = cones[0].y; }
        if (tp.vision && tp.vision.cfg.kick) { const pic = tp.vision.pics[tp.vision.tryIdx]; const o = pic.options[(pic.best + tryNo - 1) % pic.options.length]; gx = o.x; gy = o.y; }
        const dx = gx - b.x, dy = gy - b.y, n = Math.hypot(dx, dy) || 1;
        const pull = (m.camera.x2 - m.camera.x1) * (0.12 + tryNo * 0.03);
        M.pointerDown(m, { x: b.x, y: b.y });
        M.pointerMove(m, { x: b.x - (dx / n) * pull, y: b.y - (dy / n) * pull });
        M.pointerUp(m);
      } else if (ph === "contact") {
        if (!strike) strike = S.openStrike(m);
        if (strike) { if (pf === 16) S.strikeTap(strike, (tryNo - 2) * 0.25, 0.15 * tryNo); S.strikeStep(strike, m, DT); }
      }
      if (ph !== "contact") strike = null;
    }
    if (tp.pace) {
      if (!tp.pace.started) { if (frames % 30 === 10) T.tapToGo(tp); }
      else {
        T.paceSteer(tp, Math.sin(frames / 35) * 0.7);
        if (frames % 50 === 20) T.paceKnock(tp, frames % 100 === 20 ? -1 : 1);
      }
    }
    if (tp.vision && !tp.vision.cfg.kick && tp.vision.phase === "play" && tp.clock - tp.vision.goAt > 0.4) {
      const pic = tp.vision.pics[Math.min(tp.vision.tryIdx, tp.vision.pics.length - 1)];
      // wrong on the first try, right after
      const i = tp.vision.tryIdx === 0 ? (pic.best + 1) % pic.options.length : pic.best;
      T.visionTap(tp, pic.options[i]);
    }
    T.tick(tp, DT);
  }
  const before = career.skills[skill];
  const res = TR.trainingComplete(career, skill, level, tp.stars ?? 0);
  console.log(`${skill} L${level}: tries ${tp.results.map((x) => (x ? "Y" : "n")).join("")} stars ${tp.stars} in ${frames} frames (${r2(tp.clock)} s); ${skill} ${before} -> ${res.career.skills[skill]} (+${res.gained}, ${res.newStars} new), energy ${r2(res.career.energy)}, sessions ${res.career.trainingSessions}`);
  career = { ...res.career, energy: 100, trainingSessions: 99 };
}
console.log(`may play power L30 now: ${TR.mayPlayLevel(career, "power", 30)}; power L2: ${TR.mayPlayLevel(career, "power", 2)}`);
