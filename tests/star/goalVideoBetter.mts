/**
 * BETTER GOAL VIDEOS (Leo's switch part "betterVideos", 31 Oct 2026):
 * "BETTER! MORE VARIETY! … BETTER! EDITS! … BETTER VIDEOS!"
 *
 *  1. The camera keeps the ball in the picture: every frame from just before
 *     the strike until it is in the net, on every live shot and replay of
 *     every style and cut (cameras + digital zoom + shake, betterView.ts), on
 *     two real recordings and 25 made-up goals of every kind. The scorer is
 *     in the picture at the strike.
 *  2. No jitter: the ball's place on the picture moves smoothly inside a
 *     shot (no frame-to-frame jump bigger than a fifth of the picture, except
 *     the one cut of a zoom punch).
 *  3. Cuts land on sensible moments: the TikTok freeze is on the strike, the
 *     flash on the ball crossing the line; every replay holds the strike and
 *     the goal; a highlights reel and a TikTok end on a card.
 *  4. Variety: two accounts posting the same goal get different videos; the
 *     same account the same video every time.
 *  5. Every style is still only the recording (no shot outside it), and
 *     each kind of account maps to a sensible style.
 *
 * Run: npx tsx tests/star/goalVideoBetter.mts
 */
import { readFileSync } from "node:fs";
import { trackFromStored, frameAt, trackDuration, type GoalTrack } from "../../lib/star/goalClip/track";
import { synthTrack, type SynthKind } from "../../lib/star/goalClip/synth";
import { makeEdit, editDuration, momentAt, shotLength, type ClipStyle, type Edit } from "../../lib/star/goalClip/edit";
import { rigFor } from "../../lib/star/goalClip/cameras";
import { viewAt, applyView } from "../../lib/star/goalClip/betterView";
import { project } from "../../lib/star/firstPersonView";
import { clipStyleFor, clipVariantFor } from "../../lib/star/media/clipStyle";
import { goalVideoKey } from "../../lib/star/goalClip/premake";
import { planAudio } from "../../lib/star/goalClip/audio";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

const load = (n: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${n}.json`, import.meta.url), "utf8"))) as GoalTrack;
const KINDS: SynthKind[] = ["run_in", "header", "long_range", "tap_in", "penalty"];
const goals: [string, GoalTrack][] = [["lay-off", load("lay-off")], ["scramble", load("scramble")]];
for (const kind of KINDS) for (let i = 0; i < 5; i++) {
  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: i % 2 === 0, minute: 10 + i * 17, scoreAfter: [1, 0], seed: `better-${kind}-${i}`, kind });
  if (t) goals.push([`${kind}#${i}`, t]);
}
const STYLES: ClipStyle[] = ["broadcast", "highlights", "tiktok", "fan", "reverse"];
const VARIANTS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Where the ball is on the finished picture at video time `outT`, or null (behind the camera). */
function ballOnPicture(e: Edit, outT: number): { x: number; y: number; shot: number; t: number } | null {
  const m = momentAt(e, outT);
  const sh = e.shots[m.shot];
  const tr = e.tracks[sh.track];
  const rig = rigFor(tr, sh.angle, m.t, e.w, e.h);
  const b = frameAt(tr, m.t).ball;
  const p = project(rig.cam, b.x, b.y, b.z);
  if (!p) return null;
  // The phone's turn (roll) about the middle, as drawScene does.
  let px = p.px, py = p.py;
  if (rig.roll) {
    const c = Math.cos(rig.roll), s = Math.sin(rig.roll), dx = (px - e.w / 2) * 1.06, dy = (py - e.h / 2) * 1.06;
    px = e.w / 2 + dx * c - dy * s; py = e.h / 2 + dx * s + dy * c;
  }
  const q = applyView(viewAt(e, m), px, py);
  return { x: q.x, y: q.y, shot: m.shot, t: m.t };
}

function scorerOnPicture(e: Edit, shotIdx: number, t: number): boolean {
  const sh = e.shots[shotIdx], tr = e.tracks[sh.track];
  const si = tr.bodies.findIndex(b => b.id === tr.meta.scorerBody);
  if (si < 0) return true;
  const rig = rigFor(tr, sh.angle, t, e.w, e.h);
  const b = frameAt(tr, t).bodies[si];
  const p = project(rig.cam, b.x, b.y, 0.9);
  if (!p) return false;
  const q = applyView(viewAt(e, { shot: shotIdx, t, intoShot: sh.hold !== undefined ? 0 : (t - sh.from) / sh.rate }), p.px, p.py);
  return q.x >= 0 && q.x <= e.w && q.y >= 0 && q.y <= e.h;
}

// ── 1 and 2. The ball in the picture, moving smoothly ───────────────────────
const byAngle: Record<string, number> = {};
const byScorer: Record<string, number> = {};
let frames = 0, out = 0, jumps = 0, scorerMissing = 0, scorerChecks = 0;
const worst: string[] = [];
for (const [name, tr] of goals) for (const style of STYLES) for (const v of VARIANTS) {
  const e = makeEdit([tr], style, "new", v, { better: true });
  const dur = editDuration(e);
  let prev: { x: number; y: number; shot: number } | null = null;
  for (let f = 0; f * (1 / 30) < dur; f++) {
    const outT = f / 30;
    const m = momentAt(e, outT);
    const sh = e.shots[m.shot];
    if (sh.fx?.card || sh.angle === "tight") { prev = null; continue; }
    const t = e.tracks[sh.track];
    if (m.t < t.strikeT - 0.3 || m.t > t.goalT) { prev = null; continue; }
    frames++;
    const p = ballOnPicture(e, outT);
    const margin = 4;
    const inside = !!p && p.x >= margin && p.x <= e.w - margin && p.y >= margin && p.y <= e.h - margin;
    if (!inside) { out++; byAngle[`${style}:${sh.angle}`] = (byAngle[`${style}:${sh.angle}`] ?? 0) + 1; if (worst.length < 12) worst.push(`${name} ${style} v${v} ${sh.angle} t=${m.t.toFixed(2)} at ${p ? `${p.x.toFixed(0)},${p.y.toFixed(0)}` : "behind"} of ${e.w}x${e.h}`); }
    if (p && prev && prev.shot === p.shot && !(sh.fx?.zoom && m.intoShot < (sh.fx.zoom.over || 0) + 0.04)) {
      const jump = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (jump > Math.max(e.w, e.h) * 0.2) jumps++;
    }
    prev = p ? { x: p.x, y: p.y, shot: m.shot } : null;
  }
  // The scorer at the strike, on every shot that shows the strike.
  e.shots.forEach((sh, i) => {
    const t = e.tracks[sh.track];
    if (sh.fx?.card || sh.angle === "tight" || t.strikeT < sh.from || t.strikeT > sh.to) return;
    scorerChecks++;
    if (!scorerOnPicture(e, i, t.strikeT)) { scorerMissing++; byScorer[`${style}:${sh.angle}`] = (byScorer[`${style}:${sh.angle}`] ?? 0) + 1; if (worst.length < 16) worst.push(`scorer off: ${name} ${style} v${v} ${sh.angle}`); }
  });
}
if (out || scorerMissing) console.log("   misses by style:camera", JSON.stringify(byAngle), "scorer", JSON.stringify(byScorer));
console.log(`1. ball in the picture: ${frames - out} of ${frames} frames (strike to goal, ${goals.length} goals × ${STYLES.length} styles × ${VARIANTS.length} cuts); scorer at the strike: ${scorerChecks - scorerMissing} of ${scorerChecks}`);
check(out === 0, `ball out of the picture on ${out} frames: ${worst.join("; ")}`);
check(scorerMissing === 0, `scorer out of the picture at the strike on ${scorerMissing} shots: ${worst.join("; ")}`);
console.log(`2. ball jumps of over a fifth of the picture between frames inside a shot: ${jumps}`);
check(jumps === 0, `${jumps} jumps`);

// ── 3. Cuts on sensible moments ─────────────────────────────────────────────
for (const [name, tr] of goals) for (const v of VARIANTS) {
  const tk = makeEdit([tr], "tiktok", "new", v, { better: true });
  check(tk.w < tk.h, `${name} tiktok v${v}: tall`);
  const freeze = tk.shots.find(s => s.hold !== undefined && !s.fx?.card);
  if (freeze) check(Math.abs(freeze.from - tr.strikeT) < 0.05, `${name} tiktok v${v}: the freeze is on the strike (${freeze.from.toFixed(2)} v ${tr.strikeT.toFixed(2)})`);
  check(tk.shots.some(s => s.fx?.flashAt !== undefined && Math.abs(s.fx.flashAt - tr.goalT) < 1e-6), `${name} tiktok v${v}: a flash as it goes in`);
  check(tk.shots.some(s => s.fx?.shakeAt !== undefined && Math.abs(s.fx.shakeAt - tr.goalT) < 1e-6), `${name} tiktok v${v}: the shake on the goal`);
  check(tk.shots[tk.shots.length - 1].fx?.card === "name", `${name} tiktok v${v}: ends on the name card`);
  check(tk.shots.some(s => !!s.caption), `${name} tiktok v${v}: captions`);
  // The ramp: faster than live before the strike, slow on it.
  const into = tk.shots.filter(s => !s.replay && s.hold === undefined && s.to <= tr.strikeT + 0.03);
  check(into.some(s => s.rate > 1) || tr.strikeT - into[0]?.from < 0.6, `${name} tiktok v${v}: the build-up is sped up`);
  check(into.some(s => s.rate <= 0.3), `${name} tiktok v${v}: slows right down into the strike`);

  const bc = makeEdit([tr], "broadcast", "new", v, { better: true });
  const reps = bc.shots.filter(s => s.replay);
  check(reps.length >= 2 && reps.length <= 3, `${name} broadcast v${v}: 2-3 replays (${reps.length})`);
  check(new Set(reps.map(s => s.angle)).size === reps.length, `${name} broadcast v${v}: each replay from another camera`);
  for (const r of reps) check(r.from <= tr.strikeT && r.to >= tr.goalT, `${name} broadcast v${v}: the ${r.angle} replay holds the strike and the goal`);
  check(reps.every(s => !!s.fx?.label), `${name} broadcast v${v}: every replay is labelled`);
  check(!bc.shots[0].replay && bc.shots[0].angle === "tv", `${name} broadcast v${v}: live on the TV camera first`);

  const hl = makeEdit([tr], "highlights", "new", v, { better: true });
  check(hl.shots[hl.shots.length - 1].fx?.card === "stats", `${name} highlights v${v}: ends on the stats card`);
  check(hl.shots[0].from <= tr.strikeT - 2 || hl.shots[0].from === 0, `${name} highlights v${v}: starts before the move`);

  const fan = makeEdit([tr], "fan", "new", v, { better: true });
  check(fan.w < fan.h && fan.shots.every(s => !s.replay && s.rate === 1), `${name} fan v${v}: one tall take, live`);
}
// Every shot plays the recording, inside it.
for (const [name, tr] of goals) for (const style of STYLES) for (const v of VARIANTS) {
  const e = makeEdit([tr], style, "new", v, { better: true });
  for (const s of e.shots) check(s.from >= 0 && s.to <= trackDuration(tr) + 1e-6 && s.from <= s.to && s.rate > 0, `${name} ${style} v${v}: shot inside the recording`);
  check(editDuration(e) > 2 && editDuration(e) < 22, `${name} ${style} v${v}: a sensible length (${editDuration(e).toFixed(1)} s)`);
}
// A reel of two goals: each goal, then the card.
{
  const reel = makeEdit([goals[0][1], goals[3][1]], "highlights", "new", 2, { better: true });
  check(new Set(reel.shots.map(s => s.track)).size === 2, "reel: both goals");
  check(reel.shots[reel.shots.length - 1].fx?.card === "stats", "reel: ends on the full-time card");
}
// The sound is planned on the same clock (held stills and cards included).
for (const [name, tr] of goals.slice(0, 6)) for (const style of STYLES) for (const v of [0, 3]) {
  const e = makeEdit([tr], style, "new", v, { better: true });
  const plan = planAudio(e);
  check(Math.abs(plan.duration - editDuration(e)) < 1e-6, `${name} ${style} v${v}: sound as long as the video`);
  check(plan.cues.every(c => Number.isFinite(c.at) && c.at >= -1e-6 && c.at <= plan.duration + 0.2), `${name} ${style} v${v}: every sound inside the video`);
  const kicks = plan.cues.filter(c => c.sound === "kick-hard").map(c => c.at).sort((a, b) => a - b);
  check(kicks.every((k, i) => i === 0 || k - kicks[i - 1] > 0.05), `${name} ${style} v${v}: no doubled kick (a freeze or a cut on the strike)`);
}
console.log("3. cuts: freeze on the strike, flash and shake on the goal, replays hold strike and goal, cards at the end; sound on the same clock");

// ── 4. Variety ──────────────────────────────────────────────────────────────
const sig = (e: Edit) => JSON.stringify([e.accent, e.shots.map(s => [s.angle, s.rate.toFixed(2), s.caption ?? "", s.fx?.label ?? ""])]);
const tr0 = goals[0][1];
for (const style of STYLES) {
  const handles = ["@a", "@bb", "@ccc", "@dddd", "@eeeee", "@ffffff"];
  const cuts = new Set(handles.map(h => sig(makeEdit([tr0], style, "new", clipVariantFor({ handle: h, name: h, archetype: "meme", platform: "x" }), { better: true }))));
  check(cuts.size >= 3, `${style}: six accounts make at least 3 different videos of one goal (${cuts.size})`);
  check(sig(makeEdit([tr0], style, "new", 5, { better: true })) === sig(makeEdit([tr0], style, "new", 5, { better: true })), `${style}: the same post is the same video`);
}
// The post's own captions are used.
const own = makeEdit([tr0], "tiktok", "new", 1, { better: true, captions: ["HOOK LINE", "HIT LINE", "AGAIN LINE"] });
check(own.shots.some(s => s.caption === "HOOK LINE") && own.shots.some(s => s.caption === "HIT LINE") && own.shots.some(s => s.caption === "AGAIN LINE"), "a post's own captions are used");
console.log("4. variety: different accounts, different videos; the same post, the same video");

// ── 5. Who posts what ───────────────────────────────────────────────────────
const A = (archetype: string, platform = "x", persona?: string, handle = "@x") => ({ handle, name: "n", archetype: archetype as never, platform: platform as never, ...(persona ? { persona } : {}) });
check(clipStyleFor(A("club"), true) === "broadcast", "club: broadcast");
check(clipStyleFor(A("aggregator"), true) === "highlights", "aggregator: highlights");
check(clipStyleFor(A("stats"), true) === "highlights", "stats: highlights");
check(clipStyleFor(A("fan"), true) === "fan", "fan: fan cam");
check(clipStyleFor(A("meme"), true) === "tiktok", "meme: tiktok");
check(clipStyleFor(A("tabloid", "news"), true) === "reverse", "paper: reverse");
check(clipStyleFor(A("aggregator", "x", "edits"), true) === "tiktok", "persona edits: tiktok");
check(clipStyleFor(A("aggregator", "x", "breaking"), true) === "broadcast", "persona breaking (TV desk): broadcast");
check(clipStyleFor(A("aggregator", "x", "clips"), true) === "highlights", "persona clips: highlights");
check(clipStyleFor(A("fan", "youtube", "fanTV"), true) === "fan", "persona fanTV: fan cam");
check(clipStyleFor(A("pundit", "x", undefined, "@edits.by.kai"), true) === "tiktok", "an edits handle: tiktok");
check(clipStyleFor(A("aggregator")) === "reverse", "switch off: as before");
// The key: its own name with the part on, unchanged off.
check(goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x") === "tiktok|1|new|a||@x", "key off: as before");
check(goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x", false, true) !== goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x"), "key on: its own name");
check(goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x", false, true, ["A"]) !== goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x", false, true), "key on: captions in the name");
console.log("5. account kinds → styles; video names");

if (problems.length) {
  console.log(`\n✗ ${problems.length} problems:\n  ${problems.slice(0, 40).join("\n  ")}`);
  process.exit(1);
}
console.log("\n✓ all passed");
