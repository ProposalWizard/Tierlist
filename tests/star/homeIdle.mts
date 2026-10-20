/**
 * THE HOME PLAYER'S LIFE (lib/star/homeIdle.ts) and THE MOVING FACE's plain
 * parts (lib/star/style3d/toon/face.ts, faceLandmarks.ts): the same second
 * gives the same pose; weights add to 1 and never jump; every beat is reached;
 * a body without a move stands instead; the ball goes up only for the
 * keepy-uppies; the lips move only while he talks. The faces: every Style A
 * head has its spots measured and they make sense (eyes level and either side
 * of the nose, the mouth under the nose, the chin under the mouth); blinks and
 * glances come from t alone and stay in range.
 */
import { homeIdleAt, homeSway, HOME_IDLE_BEATS, HOME_IDLE_ROUND, HOME_IDLE_FADE } from "../../lib/star/homeIdle";
import { blinkAt, wanderGaze, toonFaceFor, toonFaceLandmarks, TOON_EXPRESSIONS } from "../../lib/star/style3d/toon/face";
import { TOON_FACE_LANDMARKS } from "../../lib/star/style3d/toon/faceLandmarks";
import { TOON_HEADS } from "../../lib/star/style3d/toon/bodies";
import { NEUTRAL_FACE } from "../../lib/star/cutscene/face";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const LEN: Record<string, number> = { idle: 3.38, juggle: 1.2, talk: 5, stretch: 6 };
const all = (c: string) => c in LEN;
const len = (c: string) => LEN[c] ?? 1;

// ── the Home round ──
{
  let prev = homeIdleAt(0, all, len), maxJump = 0;
  const seen = new Set<string>();
  for (let t = 0; t < HOME_IDLE_ROUND * 2; t += 1 / 30) {
    const s = homeIdleAt(t, all, len);
    const w = s.clips.reduce((a, c) => a + c[2], 0);
    check(Math.abs(w - 1) < 1e-6, `t ${t.toFixed(2)}: clip weights add to 1 (${w.toFixed(3)})`);
    check(JSON.stringify(s) === JSON.stringify(homeIdleAt(t, all, len)), `t ${t.toFixed(2)}: the same second, the same pose`);
    // a move's weight never jumps from one frame to the next (the blends)
    for (const [c, , wt] of s.clips) { const p = prev.clips.find((x) => x[0] === c)?.[2] ?? 0; maxJump = Math.max(maxJump, Math.abs(wt - p)); }
    for (const [c, , wt] of prev.clips) if (!s.clips.find((x) => x[0] === c)) maxJump = Math.max(maxJump, wt);
    check(s.juggle >= 0 && s.juggle <= 1 && s.talk >= 0 && s.talk <= 1 && s.idle >= 0 && s.idle <= 1 + 1e-9, `t ${t.toFixed(2)}: ball, lips and stance in range`);
    if (!s.beat.ball && s.clips.every((c) => c[0] !== "juggle")) check(s.juggle === 0, `t ${t.toFixed(2)}: the ball rests unless he juggles`);
    if (!HOME_IDLE_BEATS.some((b) => b.talk && (t % HOME_IDLE_ROUND) >= b.from - 0.01 && (t % HOME_IDLE_ROUND) < b.from + b.dur + HOME_IDLE_FADE)) check(s.talk === 0, `t ${t.toFixed(2)}: the lips are still unless he talks`);
    for (const c of s.clips) seen.add(c[0]);
    prev = s;
  }
  check(maxJump < 0.12, `no move jumps in more than 12% in one frame (worst ${(maxJump * 100).toFixed(1)}%)`);
  for (const b of HOME_IDLE_BEATS) check(seen.has(b.clip), `the round reaches ${b.clip}`);
  check(HOME_IDLE_BEATS.some((b) => b.ball) && HOME_IDLE_BEATS.some((b) => b.talk), "he juggles and he talks in a round");
  // a body without the football moves: he stands for them (never a missing clip)
  for (let t = 0; t < HOME_IDLE_ROUND; t += 0.5) {
    const s = homeIdleAt(t, (c) => c === "idle" || c === "talk", len);
    check(s.clips.every((c) => c[0] === "idle" || c[0] === "talk"), `t ${t}: only moves he has (${s.clips.map((c) => c[0]).join(",")})`);
    check(s.juggle === 0, `t ${t}: no ball kept up without the keepy-uppies move`);
  }
  let sw = 0;
  for (let t = 0; t < 60; t += 0.1) sw = Math.max(sw, Math.abs(homeSway(t)));
  check(sw > 0.008 && sw < 0.025, `his weight shifts 1–2.5 cm (${(sw * 100).toFixed(1)} cm)`);
}

// ── the faces ──
{
  for (const h of TOON_HEADS) {
    const lm = TOON_FACE_LANDMARKS[h];
    check(!!lm, `${h}: its face is measured`);
    if (!lm) continue;
    const [R, L] = lm.eyes;
    check(R[0] < lm.nose[0] && L[0] > lm.nose[0], `${h}: an eye either side of the nose`);
    check(Math.abs(R[1] - L[1]) < 0.004, `${h}: the eyes are level (${((R[1] - L[1]) * 1000).toFixed(1)} mm)`);
    check(R[2] > 0.008 && R[2] < 0.03 && R[3] > 0.004 && R[3] < 0.02, `${h}: a sensible eye opening`);
    check(lm.browY > R[1] && lm.nose[1] < R[1] && lm.mouth[1] < lm.nose[1] && lm.chinY < lm.mouth[1], `${h}: brow, eyes, nose, mouth, chin in order down the face`);
    check(lm.mouth[2] > 0.01 && lm.mouth[2] < 0.04, `${h}: a mouth a sensible width (${(lm.mouth[2] * 2000).toFixed(0)} mm)`);
    check(/^#[0-9a-f]{6}$/.test(lm.colors.white) && /^#[0-9a-f]{6}$/.test(lm.colors.lid), `${h}: its paint colours`);
    const f = toonFaceLandmarks(lm);
    check(f.mouthY === lm.mouth[1] && f.eyes[0][0] === lm.iris[0][0], `${h}: the cut-scene face's landmarks come from its own`);
  }
  let blinks = 0, wasShut = false, maxG = 0, moves = 0;
  let lastG = wanderGaze(0, 4);
  for (let t = 0; t < 60; t += 1 / 60) {
    const b = blinkAt(t, 4);
    check(b >= 0 && b <= 1, `blink in range at ${t.toFixed(2)}`);
    if (b > 0.5 && !wasShut) blinks++;
    wasShut = b > 0.5;
    const g = wanderGaze(t, 4);
    maxG = Math.max(maxG, Math.abs(g[0]), Math.abs(g[1]));
    if (g[0] !== lastG[0] || g[1] !== lastG[1]) moves++;
    lastG = g;
  }
  check(blinks >= 10 && blinks <= 26, `blinks every 2.5–5 s (${blinks} in a minute)`);
  check(maxG <= 1 && moves >= 25 && moves <= 90, `the eyes jump to a new spot every second or two (${moves} in a minute)`);
  check(blinkAt(12.34, 9) === blinkAt(12.34, 9) && wanderGaze(7.7, 2)[0] === wanderGaze(7.7, 2)[0], "the same second, the same eyes");
  check(JSON.stringify(toonFaceFor({})) === JSON.stringify(NEUTRAL_FACE), "no look = the calm face");
  check(toonFaceFor({ elated: 1 }).smile > 0.8 && toonFaceFor({ sad: 1 }).smile < -0.2 && toonFaceFor({ angry: 1 }).browAngry > 0.5, "joy smiles, sad frowns, angry knits the brows");
  check(toonFaceFor({ "eyes-closed": 1 }).lid < 0.05, "eyes closed shuts the lids");
  for (const name of ["neutral", "smile", "grin", "elated", "proud", "determined", "focused", "tense", "sad", "crying", "angry", "shocked", "disappointed", "smirk", "talking", "shout"]) check(name in TOON_EXPRESSIONS, `the game's look "${name}" has a face`);
}

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n  ` + problems.slice(0, 40).join("\n  ")); process.exit(1); }
console.log("✓ Home player's round, the moving face");
