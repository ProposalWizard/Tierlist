// Twin test: the relationship games PLAYED through roblox/game/relgamePlay.ts
// (woodwork, the manager's penalties, the extra session on the real match;
// the signing session), then the gain worked out as the server does.
import * as R from "../game/relgamePlay";
import * as S from "../game/strikeScreen";
import * as M from "../game/match";
import * as F from "../game/flow";
import * as C from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { StarPlayer } from "../../lib/star/types";

const DT = 1 / 60;
const p = { firstName: "Rel", lastName: "Robot", age: 18, skinTone: "tan", club: C.CHAMPIONSHIP_CLUBS[6], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const career = F.newGame(p, [...C.CHAMPIONSHIP_CLUBS], "championship").career;
console.log(`mates: ${JSON.stringify(R.woodworkMates(career))}`);
for (const game of ["woodwork", "penalties", "session", "signing", "woodwork"] as R.RelGame[]) {
  Math.random = mulberry32(game.length * 1009);
  const rp = R.startRelGame(career, game);
  let frames = 0, pf = 0, last = "", shotNo = 0;
  let strike: S.StrikeScreen | null = null;
  const log: string[] = [];
  while (!rp.done && frames++ < 40000) {
    const m = R.pitchMatch(rp);
    if (m) {
      const ph: string = m.phase;
      if (ph !== last) { last = ph; pf = 0; if (ph === "aim") shotNo++; if (ph === "result") log.push(String(m.outcome)); }
      pf++;
      if (ph === "aim" && pf % 90 === 20) {
        const b = m.sc.ball;
        const tx = game === "woodwork" ? (shotNo % 2 ? 30.5 : 37.5) : 34 + (shotNo % 3 - 1) * 2.5;
        const dx = tx - b.x, dy = -b.y, n = Math.hypot(dx, dy) || 1;
        const pull = (m.camera.x2 - m.camera.x1) * (0.13 + (shotNo % 3) * 0.04);
        M.pointerDown(m, { x: b.x, y: b.y });
        M.pointerMove(m, { x: b.x - (dx / n) * pull, y: b.y - (dy / n) * pull });
        M.pointerUp(m);
      } else if (ph === "contact") {
        if (!strike) strike = S.openStrike(m);
        if (strike) { if (pf === 14) S.strikeTap(strike, (shotNo % 3 - 1) * 0.3, 0.2 + (shotNo % 2) * 0.3); S.strikeStep(strike, m, DT); }
      }
      if (ph !== "contact") strike = null;
    }
    if (game === "signing") {
      if (!rp.started && frames === 20) R.signingStart(rp);
      const f = rp.fan;
      // right on most fans, wrong on every fourth, never for the press
      if (f && frames % 25 === 0 && !f.press) R.signingTap(rp, f.n % 4 === 3 ? "boot" : f.want[f.got]);
    }
    R.tick(rp, DT);
  }
  const gain = R.relgameGain(career, game, rp.count, 0.5);
  console.log(`${game}: count ${rp.count}${game === "signing" ? `, missed ${rp.missed}` : ""} in ${frames} frames [${log.join(",")}] -> ${JSON.stringify(gain)}`);
}
console.log(`refused: ${JSON.stringify([R.relgameGain(career, "woodwork", 9, 0.5), R.relgameGain(career, "signing", -1, 0.5), R.relgameGain(career, "penalties", 1.5, 0.5)])}`);
