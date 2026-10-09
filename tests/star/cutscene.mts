/**
 * THE CUT-SCENE SYSTEM — the parts that are plain data and maths:
 * scripts are valid, time-only and repeatable; the generator covers every
 * event it claims, rerolls with a seed, and shoots at least as well (by the
 * film rules in cinema.ts) as the hand-made scenes; the signature stays in
 * its box and the ink only grows; camera presets frame what they say.
 * (The pictures themselves are checked by eye: scripts/cutscene/stills.mjs,
 * scripts/film/frames3d.mjs.)
 */
import { FIXTURES, FIXTURE_EVENTS } from "../../lib/star/cutscene/fixtures";
import { generateScript, scoreScript } from "../../lib/star/cutscene/generate";
import { EVENT_KINDS_COVERED } from "../../lib/star/cutscene/beats";
import { compileScript, lintScript, rootAt, clipsAt, cameraAt, overlayAt } from "../../lib/star/cutscene/timeline";
import { makeSignature, signatureAt } from "../../lib/star/cutscene/signature";
import { shotPose, type Anchor } from "../../lib/star/cutscene/presets/camera";
import { castLook } from "../../lib/star/cutscene/casting";
import { makePath, rng, lensToFov } from "../../lib/star/cutscene/math";
import type { Emotion, StoryEvent } from "../../lib/star/cutscene/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── maths ──
{
  const p = makePath([[0, 0, 0], [3, 0, 4]]);
  check(Math.abs(p.length - 5) < 0.05, `straight path length 5 (${p.length.toFixed(3)})`);
  const a = rng(7), b = rng(7);
  check([0, 1, 2, 3].every(() => a.next() === b.next()), "same seed, same numbers");
  check(lensToFov(50, 1.5) < lensToFov(24, 1.5), "a longer lens sees less");
}

// ── the signature ──
{
  for (const name of ["Tom Hale", "A", "Jean-Pierre Van Der Berg", ""]) {
    const s = makeSignature(name);
    const pts = s.strokes.flat();
    check(pts.every(([x, y]) => x >= 0 && x <= 300 && y >= 0 && y <= 60), `${name || "(blank)"}: the signature stays in its 300 × 60 box`);
    check(s.strokes.length >= 3, `${name || "(blank)"}: more than one stroke (the pen lifts)`);
    let last = -1, mono = true;
    for (let i = 0; i <= 100; i++) { const a = signatureAt(s, i / 100); if (a.ink < last - 1e-9) mono = false; last = a.ink; }
    check(mono, `${name}: ink never shrinks`);
    check(signatureAt(s, 1).ink > 0.999 && signatureAt(s, 0).ink < 0.01, `${name}: starts blank, ends signed`);
    check(JSON.stringify(makeSignature(name)) === JSON.stringify(s), `${name}: the same name signs the same way`);
  }
}

// ── the hand-made scenes ──
const body = { has: (n: string) => ["idle", "sitidle", "sitdown", "jog", "slump_walk", "sprint", "dribble_run", "shot_r", "celebrate_fist", "boss-idle", "boss-sit", "boss-talk"].includes(n), dur: () => 2 };
for (const [id, make] of Object.entries(FIXTURES)) {
  const s = make();
  const lint = lintScript(s);
  check(lint.length === 0, `${id}: script is clean (${lint.slice(0, 3).join("; ")})`);
  const C = compileScript(s);
  // the camera is always on something
  let gaps = 0;
  for (let t = 0; t < s.duration; t += 0.1) if (!cameraAt(C, t)) gaps++;
  check(gaps === 0, `${id}: a shot at every moment (${gaps} gaps)`);
  // time only: the same t twice, whatever came between, gives the same answer
  for (const m of C.cast) {
    const a = JSON.stringify([rootAt(C, m.id, 3.3), clipsAt(C, m.id, 3.3, body.has, body.dur, m.role, "player")]);
    rootAt(C, m.id, 9.9); clipsAt(C, m.id, 0.2, body.has, body.dur, m.role, "player");
    const b = JSON.stringify([rootAt(C, m.id, 3.3), clipsAt(C, m.id, 3.3, body.has, body.dur, m.role, "player")]);
    check(a === b, `${id}/${m.id}: the same moment twice is the same`);
    for (const t of [0, 1.7, s.duration * 0.5, s.duration - 0.1]) {
      const w = clipsAt(C, m.id, t, body.has, body.dur, m.role, "player").entries.reduce((x, e) => x + e[2], 0);
      check(Math.abs(w - 1) < 1e-6, `${id}/${m.id} @${t.toFixed(1)}: clip weights add to 1 (${w.toFixed(3)})`);
    }
  }
  check(overlayAt(C, 0.05).fade > 0.5 && overlayAt(C, s.duration - 0.01).fade > 0.5, `${id}: fades in and out`);
}

// ── the generator ──
const EMO: Record<string, Emotion> = { signed: "pride", scored: "joy", "won-trophy": "joy", promoted: "joy", walkout: "tension", debut: "tension", rivalry: "defiance", "press-conference": "pride", arrival: "joy", award: "gratitude", "record-broken": "joy", injured: "sadness", dropped: "sadness", sacked: "anger", "transfer-request": "defiance", "mentor-advice": "inspired" };
let distinct = 0;
for (const kind of EVENT_KINDS_COVERED) {
  for (const stakes of [0.2, 0.9]) {
    const ev: StoryEvent = { kind, stakes, emotion: EMO[kind] ?? "joy", intensity: 0.6, rivalPresent: kind === "rivalry" };
    const s1 = generateScript(ev, 1), s1b = generateScript(ev, 1), s2 = generateScript(ev, 2);
    const lint = lintScript(s1);
    check(lint.length === 0, `generated ${kind} (stakes ${stakes}): clean (${lint.slice(0, 3).join("; ")})`);
    check(s1.duration > 2 && s1.duration < 40, `generated ${kind}: a sensible length (${s1.duration.toFixed(1)} s)`);
    check(JSON.stringify(s1) === JSON.stringify(s1b), `generated ${kind}: same event + seed = same scene`);
    if (JSON.stringify(s1.tracks) !== JSON.stringify(s2.tracks)) distinct++;
    const q = scoreScript(s1);
    check(q.score >= 0.8, `generated ${kind} (stakes ${stakes}): shot rules ${(q.score * 100).toFixed(0)}% (${q.notes.join("; ")})`);
  }
}
check(distinct >= EVENT_KINDS_COVERED.length, `a new seed rerolls most scenes (${distinct} of ${EVENT_KINDS_COVERED.length * 2})`);

// the generator, given the hand-made scene's event, shoots at least as well
for (const [id, ev] of Object.entries(FIXTURE_EVENTS)) {
  const hand = scoreScript(FIXTURES[id]());
  const best = Math.max(...[1, 2, 3].map((seed) => scoreScript(generateScript(ev, seed)).score));
  check(best >= hand.score - 1e-9, `${id}: generated ${(best * 100).toFixed(0)}% vs hand-made ${(hand.score * 100).toFixed(0)}% (${hand.notes.join("; ")})`);
}

// ── camera presets ──
{
  const man: Anchor = { pos: [0, 0, 0], yaw: 0, head: [0, 1.7, 0], chest: [0, 1.35, 0.05], hips: [0, 1.0, 0], height: 1.8 };
  const close = shotPose({ preset: "close", subject: { actor: "x" } }, man, null, { aspect: 0.46, k: 0, t: 0, seed: 1 });
  const wide = shotPose({ preset: "wide", subject: { actor: "x" } }, man, null, { aspect: 0.46, k: 0, t: 0, seed: 1 });
  const dc = Math.hypot(close.pos[0], close.pos[2]), dw = Math.hypot(wide.pos[0], wide.pos[2]);
  check(dc > 0.4 && dc < 2.5, `a close-up stands near (${dc.toFixed(2)} m)`);
  check(dw > dc * 2, `a wide stands further than a close-up (${dw.toFixed(2)} vs ${dc.toFixed(2)})`);
  check(close.pos[2] > 0, "a close-up is in front of him");
  const L = shotPose({ preset: "medium", subject: { actor: "x" }, side: 1 }, man, null, { aspect: 0.46, k: 0, t: 0, seed: 1 });
  const R = shotPose({ preset: "medium", subject: { actor: "x" }, side: -1 }, man, null, { aspect: 0.46, k: 0, t: 0, seed: 1 });
  check(L.pos[0] > 0 && R.pos[0] < 0, "side +1 is his left, −1 his right");
  const low = shotPose({ preset: "low-hero", subject: { actor: "x" } }, man, null, { aspect: 0.46, k: 0, t: 0, seed: 1 });
  check(low.pos[1] < 0.6 && low.look[1] > low.pos[1], "a hero shot looks up from low");
}

// ── casting ──
{
  const you = castLook({ id: "you", role: "you" }, { club: { name: "Testers", shirt: "#123456", trim: "#abcdef" }, player: { skin: "#5c3a1e", number: 23 } });
  check(you.kit?.shirt === "#123456" && you.number === 23 && you.skin === "#5c3a1e", "you wear your club, number and skin");
  const boss = castLook({ id: "boss", role: "manager" });
  check(boss.body === "manager", "the manager is in a suit");
}

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n  ` + problems.join("\n  ")); process.exit(1); }
console.log("✓ cut-scene system: scripts, generator, signature, cameras, casting");
