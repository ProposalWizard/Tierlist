/**
 * COLD EDITS (Leo's switch part "coldEdits", 31 Oct 2026: "want more variety
 * and video types again, not rlly seeing like cold football edits").
 *
 *  1. On the beat: every shot of every cold edit lasts a whole number of
 *     beats of its music, every hit (flash, shake, punch, RGB split) is on a
 *     beat, and the music starts so its drop is on the video's drop. In the
 *     cold, aura, stat-card and rewind edits the ball crosses the line ON the
 *     drop (within one frame).
 *  2. The ball stays in the picture (inside the letterbox) from the strike to
 *     the goal on every live shot and replay, with the beat's punch and shake.
 *  3. Same post, same video; another account, another video; speeds sane;
 *     every shot inside its recording.
 *  4. Switch off: no account gets a cold style; the video names of every
 *     other style are unchanged; a cold style's name carries its version.
 *  5. Sound: a cold edit is set to its music (no commentator); every other
 *     edit's sound plan has no music.
 *
 * Run: npx tsx tests/star/goalVideoCold.mts
 */
import { readFileSync } from "node:fs";
import { trackFromStored, frameAt, trackDuration, type GoalTrack } from "../../lib/star/goalClip/track";
import { synthTrack, type SynthKind } from "../../lib/star/goalClip/synth";
import { makeEdit, editDuration, momentAt, shotLength, type ClipStyle, type Edit } from "../../lib/star/goalClip/edit";
import { rigFor } from "../../lib/star/goalClip/cameras";
import { applyView } from "../../lib/star/goalClip/betterView";
import { coldViewAt } from "../../lib/star/goalClip/coldRender";
import { COLD_STYLES, COLD_EDIT_VERSION, isColdStyle } from "../../lib/star/goalClip/editCold";
import { EDIT_BEATS } from "../../lib/star/goalClip/editMusic";
import { project } from "../../lib/star/firstPersonView";
import { clipStyleFor, coldClipStyleFor, COLD_BY_PERSONA, BETTER_BY_PERSONA } from "../../lib/star/media/clipStyle";
import { goalVideoKey } from "../../lib/star/goalClip/premake";
import { planAudio } from "../../lib/star/goalClip/audio";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };

const load = (n: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${n}.json`, import.meta.url), "utf8"))) as GoalTrack;
const KINDS: SynthKind[] = ["run_in", "header", "long_range", "tap_in", "penalty"];
const goals: [string, GoalTrack][] = [["lay-off", load("lay-off")], ["scramble", load("scramble")]];
for (const kind of KINDS) for (let i = 0; i < 4; i++) {
  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: i % 2 === 0, minute: 10 + i * 17, scoreAfter: [1, 0], seed: `cold-${kind}-${i}`, kind });
  if (t) goals.push([`${kind}#${i}`, t]);
}
const STYLES = [...COLD_STYLES] as ClipStyle[];
const VARIANTS = [0, 1, 2, 3, 4, 5];
const sets: [string, GoalTrack[]][] = [
  ...goals.map(([n, t]) => [n, [t]] as [string, GoalTrack[]]),
  ["reel3", [goals[0][1], goals[3][1], goals[8][1]]],
  ["reel5", goals.slice(2, 7).map(g => g[1])],
];

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const onBeat = (t: number, B: number) => near(t / B, Math.round(t / B), 1e-6);

// ── 1 + 3. The beat, the drop, sanity ──────────────────────────────────────
let edits = 0, shots = 0, offBeatShots = 0, offBeatHits = 0, hitsN = 0, dropChecks = 0, dropMiss = 0;
const lengths: Record<string, number[]> = {};
for (const [name, tracks] of sets) for (const style of STYLES) for (const v of VARIANTS) {
  const e = makeEdit(tracks, style, "new", v, { better: false });
  edits++;
  check(!!e.music && !!e.look && !!e.hits, `${name}/${style}/${v}: no music/look/hits`);
  if (!e.music) continue;
  const beat = Object.values(EDIT_BEATS).find(b => b.id === e.music!.id)!;
  const B = 60 / beat.bpm;
  const dur = editDuration(e);
  (lengths[e.style] ??= []).push(dur);
  let acc = 0;
  e.shots.forEach((s, i) => {
    shots++;
    if (!onBeat(acc, B)) { offBeatShots++; check(false, `${name}/${style}/${v}: shot ${i} starts at ${acc.toFixed(3)} s, off the beat`); }
    const tr = e.tracks[s.track];
    check(s.from >= -1e-6 && s.to <= trackDuration(tr) + 1e-6 && s.from <= s.to + 1e-9, `${name}/${style}/${v}: shot ${i} outside its recording`);
    if (s.hold === undefined) check(s.rate >= 0.1 && s.rate <= 4, `${name}/${style}/${v}: shot ${i} speed ${s.rate.toFixed(2)}`);
    acc += shotLength(s);
  });
  check(onBeat(dur, B), `${name}/${style}/${v}: ends off the beat`);
  for (const h of e.hits!) { hitsN++; if (!onBeat(h.at, B)) { offBeatHits++; check(false, `${name}/${style}/${v}: ${h.kind} at ${h.at.toFixed(3)} off the beat`); } }
  // The file's drop is on the video's drop, and the file lasts the video.
  const m = e.music;
  check(m.offset >= 0 && near(beat.dropBeat * B - m.offset, m.dropAt, 1e-6), `${name}/${style}/${v}: music drop at ${(beat.dropBeat * B - m.offset).toFixed(3)}, video drop at ${m.dropAt.toFixed(3)}`);
  check(onBeat(m.dropAt, B), `${name}/${style}/${v}: drop off the beat`);
  check(m.offset + dur <= beat.beats * B + 1e-6, `${name}/${style}/${v}: video (${dur.toFixed(2)} s) runs past its music`);
  // The goal on the drop.
  if (["cold", "aura", "statCard", "rewind"].includes(e.style)) {
    dropChecks++;
    const before = momentAt(e, m.dropAt - 1e-4);
    const after = momentAt(e, m.dropAt + 1e-4);
    const tr = e.tracks[e.shots[after.shot].track];
    const ok = Math.abs(before.t - tr.goalT) < 1 / 30 && Math.abs(after.t - tr.goalT) < 1 / 30;
    if (!ok) { dropMiss++; check(false, `${name}/${style}/${v}: on the drop the clip is at ${before.t.toFixed(2)}/${after.t.toFixed(2)}, goal at ${tr.goalT.toFixed(2)}`); }
  }
  // Same post, same video.
  check(JSON.stringify(makeEdit(tracks, style, "new", v, { better: false })) === JSON.stringify(e), `${name}/${style}/${v}: not the same twice`);
}
console.log(`1. ${edits} cold edits, ${shots} shots: ${shots - offBeatShots} cut on a beat; ${hitsN - offBeatHits} of ${hitsN} hits on a beat; goal on the drop in ${dropChecks - dropMiss} of ${dropChecks}`);
for (const [s, l] of Object.entries(lengths)) console.log(`   ${s.padEnd(8)} ${Math.min(...l).toFixed(1)}–${Math.max(...l).toFixed(1)} s`);

// Variety: two accounts, the same goal.
let same = 0, pairs = 0;
for (const [, tracks] of sets.slice(0, 6)) for (const style of STYLES) {
  pairs++;
  if (JSON.stringify(makeEdit(tracks, style, "new", 11).shots) === JSON.stringify(makeEdit(tracks, style, "new", 12345).shots)) same++;
}
console.log(`3. two accounts, same goal, same style: ${pairs - same} of ${pairs} different videos`);
check(same / pairs < 0.5, `too many identical videos across accounts: ${same}/${pairs}`);

// ── 2. The ball in the picture ─────────────────────────────────────────────
let frames = 0, out = 0;
const outBy: Record<string, number> = {};
const worst: string[] = [];
for (const [name, tracks] of sets) for (const style of STYLES) for (const v of VARIANTS) {
  const e = makeEdit(tracks, style, "new", v);
  const lb = (e.look?.letterbox ?? 0) * e.h;
  const n = Math.round(editDuration(e) * e.fps);
  for (let f = 0; f < n; f++) {
    const outT = f / e.fps;
    const m = momentAt(e, outT);
    const sh = e.shots[m.shot];
    const tr = e.tracks[sh.track];
    if (sh.fx?.cold?.card || sh.angle === "tight") continue;
    if (m.t < tr.strikeT - 0.05 || m.t > tr.goalT) continue;
    const rig = rigFor(tr, sh.angle, m.t, e.w, e.h);
    const b = frameAt(tr, m.t).ball;
    const p = project(rig.cam, b.x, b.y, b.z);
    frames++;
    let inside = false;
    if (p) {
      const q = applyView(coldViewAt(e, m, outT), p.px, p.py);
      inside = q.x >= 0 && q.x <= e.w && q.y >= lb && q.y <= e.h - lb;
    }
    if (!inside) {
      out++;
      outBy[e.style] = (outBy[e.style] ?? 0) + 1;
      if (worst.length < 8) worst.push(`${name}/${style}/${v} ${outT.toFixed(2)}s (${sh.angle})`);
    }
  }
}
console.log(`2. ball in the picture, strike to goal: ${frames - out} of ${frames} frames (${(100 * (frames - out) / frames).toFixed(1)}%)${out ? ` — out by style ${JSON.stringify(outBy)}` : ""}`);
check(out / frames < 0.02, `ball out of the picture on ${out} frames: ${worst.join("; ")}`);

// ── 4. The switch ──────────────────────────────────────────────────────────
const ARCH = ["club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme"] as const;
const PLAT = ["x", "instagram", "youtube", "tiktok", "news"] as const;
const personas = [...Object.keys(BETTER_BY_PERSONA), ...Object.keys(COLD_BY_PERSONA), undefined];
let offSame = 0, offAll = 0, coldGiven = 0;
for (const a of ARCH) for (const p of PLAT) for (const persona of personas) for (const better of [false, true]) {
  const author = { handle: `@h${persona ?? ""}`, name: "n", archetype: a, platform: p, persona };
  offAll++;
  const was = clipStyleFor(author, better);
  if (clipStyleFor(author, better, false, "k") === was && !isColdStyle(was)) offSame++;
  if (isColdStyle(clipStyleFor(author, better, true, "k"))) coldGiven++;
}
console.log(`4. switch off: ${offSame} of ${offAll} account styles as before (no cold style); on: ${coldGiven} of ${offAll} get a cold edit`);
check(offSame === offAll, "a cold style given out with the switch off");
check(coldGiven > offAll * 0.15, "too few accounts post cold edits");
const edits1 = coldClipStyleFor({ handle: "@edits.by.kai", name: "kai", archetype: "meme", platform: "tiktok", persona: "edits" }, "a");
const kinds = new Set(Array.from({ length: 40 }, (_, i) => coldClipStyleFor({ handle: "@edits.by.kai", name: "kai", archetype: "meme", platform: "tiktok", persona: "edits" }, `goal${i}`)));
console.log(`   the edits page over 40 goals posts ${kinds.size} kinds (${Array.from(kinds).join(", ")})`);
check(!!edits1 && kinds.size >= 4, "the edits page should post several kinds");
check(clipStyleFor({ handle: "@ClubFC", name: "Club", archetype: "club", platform: "x" }, true, true, "a") === "broadcast", "a club still posts the broadcast");
for (const st of ["broadcast", "reverse", "fan", "tiktok", "highlights"] as ClipStyle[]) {
  check(!goalVideoKey(st, 1, "new", ["a"], undefined, "@x", false, true).includes(COLD_EDIT_VERSION), `key of ${st} changed`);
}
check(goalVideoKey("tiktok", 1, "new", ["a"], undefined, "@x") === "tiktok|1|new|a||@x", "key off: as before");
check(goalVideoKey("cold", 1, "new", ["a"], undefined, "@x").endsWith(`|${COLD_EDIT_VERSION}`), "a cold edit's key carries its version");

// ── 5. Sound ───────────────────────────────────────────────────────────────
const ce = makeEdit([goals[0][1]], "cold", "new", 0);
const cp = planAudio(ce, "v1");
check(!!cp.music && cp.music.url.startsWith("/star/edits/"), "cold edit: no music in the sound plan");
check(!cp.cues.some(c => c.sound.startsWith("cl-") || c.sound.startsWith("cc-")), "cold edit: a commentator over the music");
for (const st of ["broadcast", "reverse", "fan", "tiktok"] as ClipStyle[]) {
  check(!("music" in planAudio(makeEdit([goals[0][1]], st, "new", 0), "v1")), `${st}: music in the plan`);
  check(!("music" in planAudio(makeEdit([goals[0][1]], st, "new", 0, { better: true }), "v1")), `${st} (better): music in the plan`);
}
console.log(`5. sound: cold edit set to ${cp.music?.url} from ${cp.music?.offset.toFixed(2)} s, ${cp.cues.length} pitch sounds, no commentator; other styles no music`);

if (problems.length) {
  console.log(`\n✗ ${problems.length} problems:\n  ${problems.slice(0, 25).join("\n  ")}`);
  process.exit(1);
}
console.log("\n✓ cold edits: on the beat, ball in the picture, switch off unchanged");
