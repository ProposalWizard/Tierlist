/**
 * GAME MUSIC (Mikey, 21 Oct 2026): which track plays where, and the switch.
 *
 *  1. Off on a new phone; the switch reads back.
 *  2. A match picks its bed from the score, the clock, a knockout and a dribble.
 *  3. Screens: home, after a win, practice, full time, the Ballon d'Or night.
 *  4. The turning point fires only for a goal of yours from behind.
 *  5. A bed is not swapped more often than MIN_BED_S (except dribble / final boss).
 *  6. Every track has a file, and every loop's length is sane.
 *  7. A match is quieter than the menus.
 */
import { existsSync } from "node:fs";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(), key: () => null, length: 0,
} as Storage;

const M = await import("../../lib/star/gameMusic.ts");
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log("FAIL", msg); } };

// 1
check(M.gameMusicOn() === false, "music must be off on a new phone");
M.setGameMusicOn(true);
check(M.gameMusicOn() === true && store.get(M.MUSIC_KEY) === "on", "turning it on must read back");
M.setGameMusicOn(false);

// 2
const st = (o: Partial<import("../../lib/star/gameMusic.ts").MatchMusicState>) =>
  ({ us: 0, them: 0, minute: 10, duration: 90, knockout: false, dribbling: false, ...o });
check(M.matchCue(st({})) === "02-working-it-out", "level early: working it out");
check(M.matchCue(st({ us: 1 })) === "10-good-spell", "ahead: good spell");
check(M.matchCue(st({ them: 1 })) === "07-find-a-way", "one behind: find a way");
check(M.matchCue(st({ them: 3, us: 1 })) === "05-under-the-cosh", "two behind: under the cosh");
check(M.matchCue(st({ minute: 80 })) === "09-last-attack", "level late: last attack");
check(M.matchCue(st({ minute: 74 })) === "02-working-it-out", "74' is not late yet");
check(M.matchCue(st({ minute: 80, knockout: true, them: 1 })) === "11-final-boss", "knockout, late, one behind: final boss");
check(M.matchCue(st({ minute: 80, knockout: true, us: 3 })) === "10-good-spell", "knockout, late, 3 up: no boss");
check(M.matchCue(st({ minute: 60, knockout: true })) === "02-working-it-out", "knockout early: no boss");
check(M.matchCue(st({ dribbling: true, them: 2 })) === "04-dribble", "a dribble wins over the score");
check(M.isLate({ minute: 50, duration: 60 }) && !M.isLate({ minute: 49, duration: 60 }), "late scales with match length");

// 3
check(M.sceneCue({ kind: "menu", lastWon: false }) === "08-lobby", "home: lobby");
check(M.sceneCue({ kind: "menu", lastWon: true }) === "03-winning", "home after a win: winning");
check(M.sceneCue({ kind: "practice" }) === "02-working-it-out", "training: working it out");
check(M.sceneCue({ kind: "full-time", us: 2, them: 1 }) === "03-winning", "full time win");
check(M.sceneCue({ kind: "full-time", us: 0, them: 1 }) === "06-defeat", "full time loss");
check(M.sceneCue({ kind: "full-time", us: 1, them: 1 }) === "08-lobby", "full time draw");
check(M.sceneCue({ kind: "ballon-dor", won: null }) === "02-working-it-out", "Ballon d'Or before the reveal");
check(M.sceneCue({ kind: "ballon-dor", won: true }) === "03-winning", "Ballon d'Or won");
check(M.sceneCue({ kind: "ballon-dor", won: false }) === "06-defeat", "Ballon d'Or lost");
check(M.sceneCue({ kind: "none" }) === null, "none: silence");

// 4
check(M.isTurningPoint(0, 1, 1), "level from behind");
check(M.isTurningPoint(1, 3, 2), "pulling one back");
check(!M.isTurningPoint(1, 0, 2), "a goal when ahead is not a turning point");
check(!M.isTurningPoint(1, 1, 2), "a goal when level is not a turning point");
check(!M.isTurningPoint(0, 1, 0), "their goal is not a turning point");

// 5
check(!M.shouldSwap("02-working-it-out", "10-good-spell", M.MIN_BED_S - 1), "no swap before MIN_BED_S");
check(M.shouldSwap("02-working-it-out", "10-good-spell", M.MIN_BED_S), "swap after MIN_BED_S");
check(M.shouldSwap("02-working-it-out", "04-dribble", 0), "into a dribble at once");
check(M.shouldSwap("04-dribble", "02-working-it-out", 0), "out of a dribble at once");
check(M.shouldSwap("09-last-attack", "11-final-boss", 0), "final boss lands at once");
check(!M.shouldSwap("08-lobby", "08-lobby", 100), "same bed never swaps");
check(M.shouldSwap(null, "08-lobby", 0) && M.shouldSwap("08-lobby", null, 0), "start and stop at once");

// 6
for (const [id, c] of Object.entries(M.CUES)) {
  check(existsSync(new URL(`../../public/star/music/${id}.mp3`, import.meta.url)), `${id}.mp3 is missing`);
  if (c.loop) check(c.pre === 0.5 && c.len > 15 && c.len < 70, `${id} loop length ${c.len}`);
}

// 7
check(M.MATCH_VOLUME < M.MENU_VOLUME && M.MATCH_VOLUME < M.RESULT_VOLUME, "a match must be the quietest");

if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
console.log("gameMusic: all checks pass");
