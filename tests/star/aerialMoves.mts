/**
 * HEADERS AND VOLLEYS YOU SEE HAPPEN (lib/star/aerialMoves.ts; Harry, 25 Oct
 * 2026: "4, 5, 6 different animations based on the aerial acrobatic skill,
 * based on flair, based on the angle of the ball, the height of the ball").
 *
 * Pins:
 *   1. a header chance is always a header move, a volley chance a volley move;
 *   2. which move: height (jump / stand / chest), angle (side / front), and the
 *      skill gates; bicycle and scorpion are rare (measured shares below) and
 *      never happen under their Aerial or flair gates;
 *   3. the same chance always picks the same move;
 *   4. the rise ends ON the contact frame with the full jump; the follow-through
 *      starts after it and ends on the last frame, back on the grass;
 *   5. liftToMeet: the drawn ball is always exactly on the contact point;
 *   6. the tint is small: power within its powerK, aim within ± spreadDeg;
 *   7. the baked clips (index-a.json, index.json) match the specs: frames,
 *      contact frame, a contact point per cell, and the contact points are
 *      where they should be (head high, a front volley's laces low);
 *   8. CanvasMatch opens the ball screen from the move's rise (not after
 *      AIR_TAP_OPEN_S), draws you with the move's clip, and the old flow is
 *      only behind ?airmoves=old.
 */
import { readFileSync } from "node:fs";
import {
  AERIAL_MOVES, AERIAL_SPECS, pickAerialMove, turnAngleDeg, aerialRise, aerialFollow, aerialStrikeTint, liftToMeet,
  bicycleChance, scorpionChance, BICYCLE_GATE, SCORPION_GATE, type AerialMove, type AerialPickIn,
} from "../../lib/star/aerialMoves";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const toGoal = { x: 0, y: -1 };
/** A ball coming in at `deg` to the line to goal (0 = from behind you, heading for goal). */
const inAt = (deg: number) => ({ x: Math.sin((deg * Math.PI) / 180), y: -Math.cos((deg * Math.PI) / 180) });
const pick = (o: Partial<AerialPickIn>) => pickAerialMove({ kind: "volley", ballZ: 0.8, inDir: inAt(90), toGoal, aerial: 60, flair: 60, seed: 1, ...o });

// 0. the angle reads as it says
check(Math.abs(turnAngleDeg(inAt(0), toGoal)) < 1e-6 && Math.abs(turnAngleDeg(inAt(90), toGoal) - 90) < 1e-6 && Math.abs(turnAngleDeg(inAt(180), toGoal) - 180) < 1e-6, "turnAngleDeg");

// 1 + 2 + 3 over random chances
const share = (aerial: number, flair: number, n = 6000) => {
  const r = mulberry32(aerial * 101 + flair);
  const c: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const kind = r() < 0.5 ? "header" : "volley";
    const ballZ = kind === "header" ? 1.5 + r() * 1.1 : 0.6 + r() * 0.7;
    const o: AerialPickIn = { kind, ballZ, inDir: inAt(r() * 180), toGoal, aerial, flair, seed: (r() * 2 ** 31) | 0 };
    const m = pickAerialMove(o);
    c[m] = (c[m] ?? 0) + 1;
    check(AERIAL_SPECS[m].kind === kind, `${kind} chance picked ${m}`);
    check(pickAerialMove(o) === m, "same chance, different move");
  }
  const vol = n / 2;
  return { c, bike: (c.bicycle ?? 0) / vol, scorp: (c.scorpion ?? 0) / vol, dive: (c.divingHeader ?? 0) / (n / 2) };
};
const top = share(95, 95), mid = share(60, 60), acroOnly = share(95, 40), flairOnly = share(40, 95);
check(top.bike > 0.02 && top.bike < 0.15, `bicycle at 95/95 is ${(top.bike * 100).toFixed(1)}% of volleys (want 2-15%)`);
check(top.scorp > 0.005 && top.scorp < 0.06, `scorpion at 95/95 is ${(top.scorp * 100).toFixed(1)}% of volleys (want 0.5-6%)`);
for (const [nm, s] of [["60/60", mid], ["Aerial 95 flair 40", acroOnly], ["Aerial 40 flair 95", flairOnly]] as const) {
  check(s.bike === 0 && s.scorp === 0, `${nm}: a bicycle or scorpion happened (gates are Aerial ${BICYCLE_GATE.aerial}/${SCORPION_GATE.aerial}, flair ${BICYCLE_GATE.flair}/${SCORPION_GATE.flair})`);
}
check(bicycleChance(BICYCLE_GATE.aerial - 1, 99) === 0 && scorpionChance(99, SCORPION_GATE.flair - 1) === 0, "gates");
check(top.dive > mid.dive, "a diving header is likelier with more Aerial");

// 2. height and angle
check(pick({ kind: "header", ballZ: 2.45, aerial: 60 }) === "jumpHeader", "a high cross is a jumping header");
check(pick({ kind: "header", ballZ: 1.85, inDir: inAt(0), aerial: 60 }) === "standHeader", "a cross at head height is a standing header");
check(pick({ ballZ: 1.25, inDir: inAt(170) }) === "chestVolley", "a chest-high ball is a chest-down volley");
check(pick({ ballZ: 0.8, inDir: inAt(90) }) === "sideVolley", "a cross from the side is a side volley");
check(pick({ ballZ: 0.7, inDir: inAt(170) }) === "frontVolley", "a cut-back is a front volley");
// a bicycle needs the ball coming from behind and high enough; never on a cut-back
let bikeSeen = false;
for (let s = 0; s < 400; s++) {
  if (pick({ ballZ: 1.1, inDir: inAt(20), aerial: 99, flair: 99, seed: s }) === "bicycle") bikeSeen = true;
  check(pick({ ballZ: 1.1, inDir: inAt(170), aerial: 99, flair: 99, seed: s }) !== "bicycle", "a bicycle on a cut-back");
  check(pick({ ballZ: 0.5, inDir: inAt(20), aerial: 99, flair: 99, seed: s }) !== "bicycle", "a bicycle on a low ball");
}
check(bikeSeen, "no bicycle on a high ball from behind at 99/99");

// 4. rise and follow
for (const m of AERIAL_MOVES) {
  const s = AERIAL_SPECS[m];
  const end = aerialRise(m, s.riseS);
  check(end.frame === s.contactFrame && Math.abs(end.liftK - 1) < 1e-9 && Math.abs(end.moveU - 1) < 1e-9, `${m}: rise does not end on the touch`);
  let last = -1;
  for (let e = 0; e < s.riseS - 1e-6; e += s.riseS / 20) { const f = aerialRise(m, e).frame; check(f >= last && f < s.contactFrame, `${m}: rise frame ${f} at ${e.toFixed(2)}`); last = f; }
  check(aerialFollow(m, 0).frame === s.contactFrame, `${m}: the follow-through does not start on the touch`);
  const done = aerialFollow(m, s.followS);
  check(done.frame === s.frames - 1 && done.liftK === 0 && done.done, `${m}: the follow-through does not end on the last frame, on the grass`);
  check(s.contactFrame > 0 && s.contactFrame < s.frames - 1, `${m}: no take-off or no follow-through frames`);
  check(s.riseS >= 0.3 && s.riseS <= 0.7, `${m}: rise ${s.riseS} s (want a visible 0.3-0.7 s)`);
}

// 5. the ball always meets the contact point
for (const m of AERIAL_MOVES) for (const ball of [0, 20, 60, 140]) for (const cUp of [10, 40, 70]) {
  const r = liftToMeet(m, ball, cUp, 30);
  check(Math.abs(r.ballUpPx - (cUp + r.liftPx)) < 1e-9, `${m}: ball not on the contact point`);
  check(r.liftPx >= AERIAL_SPECS[m].minLiftM * 30 - 1e-9 && r.liftPx <= AERIAL_SPECS[m].maxLiftM * 30 + 1e-9, `${m}: jump out of range`);
}

// 6. the tint is small
for (const m of AERIAL_MOVES) for (let s = 0; s < 200; s++) {
  const t = aerialStrikeTint(m, { x: 0, y: -1 }, 0.9, s);
  const deg = (Math.abs(Math.atan2(t.dir.x, -t.dir.y)) * 180) / Math.PI;
  check(deg <= AERIAL_SPECS[m].spreadDeg + 1e-6, `${m}: aim turned ${deg.toFixed(2)}°`);
  check(Math.abs(t.power - Math.min(1, 0.9 * AERIAL_SPECS[m].powerK)) < 1e-9, `${m}: power`);
  check(Math.abs(Math.hypot(t.dir.x, t.dir.y) - 1) < 1e-9, `${m}: aim not a unit`);
}
check(AERIAL_SPECS.bicycle.spreadDeg > AERIAL_SPECS.jumpHeader.spreadDeg && AERIAL_SPECS.scorpion.spreadDeg > AERIAL_SPECS.frontVolley.spreadDeg, "a bicycle/scorpion is not the widest");

// 7. the baked clips
for (const file of ["public/star/sprites/index-a.json", "public/star/sprites/index.json"]) {
  const idx = JSON.parse(readFileSync(file, "utf8"));
  check(!!idx.atlases?.["3"], `${file}: no atlas 3`);
  for (const m of AERIAL_MOVES) {
    const s = AERIAL_SPECS[m], c = idx.chars.player.clips[s.clip];
    if (!c) { check(false, `${file}: no clip ${s.clip}`); continue; }
    check(c.atlas === 3 && c.frames === s.frames && c.strikeFrame === s.contactFrame && c.dirs === 8, `${file}: ${s.clip} frames/contact/dirs ${c.frames}/${c.strikeFrame}/${c.dirs}`);
    check(c.cells?.length === c.frames * 8 && c.pts?.length === c.cells.length && c.pts.every((p: number[]) => p.length === 15 && p.every(Number.isFinite)), `${file}: ${s.clip} points`);
    // On the contact frame, facing down the screen (dir 2): how high the contact point is (baked px over its shadow).
    const p = c.pts[2 * c.frames + s.contactFrame];
    const k = s.point === "head" ? 0 : s.point === "chest" ? 5 : 10;
    const up = (p[k + 2] - p[k + 1]) / idx.standH; // share of a standing man's height
    const want: Record<AerialMove, [number, number]> = {
      // (the toon head is big: its brow is about 0.7 of a standing man's drawn height)
      standHeader: [0.6, 1.0], jumpHeader: [0.55, 1.0], divingHeader: [0.35, 0.8], chestVolley: [0.12, 0.45], frontVolley: [0.15, 0.5],
      sideVolley: [0.3, 0.7], bicycle: [0.35, 1.1], scorpion: [0.3, 0.9],
    };
    check(up >= want[m][0] && up <= want[m][1], `${file}: ${s.clip} contact point at ${up.toFixed(2)} of his height (want ${want[m].join("-")})`);
  }
}

// 8. CanvasMatch
const cm = readFileSync("components/star/CanvasMatch.tsx", "utf8");
check(/aerialMovesOn\(\)/.test(cm) && /ar\.e >= ar\.preS \+ AERIAL_SPECS\[ar\.move\]\.riseS/.test(cm), "CanvasMatch does not open the ball screen at the end of the move's rise");
check(/spritePoints\("player", clip, tHit/.test(cm), "CanvasMatch does not place the ball on the baked contact point");
check(/aerial: aerialFig/.test(cm), "CanvasMatch does not draw you with the move's clip");
check(/aerialStrikeTint\(/.test(cm), "the strike is not tinted by the move");

if (problems.length) {
  console.log(`aerialMoves FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log(`aerialMoves: ${AERIAL_MOVES.length} moves; at Aerial/flair 95: bicycle ${(top.bike * 100).toFixed(1)}%, scorpion ${(top.scorp * 100).toFixed(1)}% of volleys, diving ${(top.dive * 100).toFixed(1)}% of headers; at 60/60 none; ball always on the contact point — all checks pass`);
