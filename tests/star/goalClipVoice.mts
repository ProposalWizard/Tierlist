/**
 * The NEW commentary voice (Leo, 30 Oct 2026; lib/star/goalClip/commentaryVoice.ts).
 * Off (the default, and always on the server/in tests): the plan is exactly
 * the old one. On ("v2"): every line has its new recording and length, the
 * plan says so, and the voices still never talk over each other.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { trackFromStored, type GoalTrack } from "../../lib/star/goalClip/track";
import { makeEdit, type ClipStyle } from "../../lib/star/goalClip/edit";
import { planAudio } from "../../lib/star/goalClip/audio";
import { allCommentaryLines } from "../../lib/star/goalClip/commentary";
import { COMMENTARY_SECONDS_V2 } from "../../lib/star/goalClip/commentaryDurationsV2";
import { commentarySet, commentaryTable, commentaryUrl } from "../../lib/star/goalClip/commentaryVoice";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${f}`, import.meta.url), "utf8"))) as GoalTrack;
const tracks = [load("scramble.json"), load("lay-off.json")];

check(commentarySet() === "v1", "switch off outside a browser: the old voice");
check(commentaryUrl("cl-g1", "v1") === "/sfx/cl-g1.mp3", "old voice: the old file");
check(commentaryUrl("cl-g1", "v2") === "/sfx/v2/cl-g1.mp3", "new voice: its own file");

for (const l of allCommentaryLines()) {
  const f = new URL(`../../public/sfx/v2/${l.id}.mp3`, import.meta.url);
  check(existsSync(f), `new recording for ${l.id}`);
  if (existsSync(f)) check(statSync(f).size < 80_000, `${l.id}: small file (${statSync(f).size} bytes)`);
  const s = COMMENTARY_SECONDS_V2[l.id] ?? 0;
  check(s > 0.4 && s < 6, `${l.id}: new length ${s}s`);
}

const secs = commentaryTable("v2");
for (const tr of tracks) {
  for (const style of ["broadcast", "reverse", "fan", "tiktok"] as ClipStyle[]) {
    const e = makeEdit([tr], style);
    const off = planAudio(e);
    check(off.voice === undefined, `${tr.meta.id} ${style}: off = no voice field (old plan)`);
    check(JSON.stringify(off) === JSON.stringify(planAudio(e, "v1")), `${tr.meta.id} ${style}: off = v1 plan`);
    const on = planAudio(e, "v2");
    check(on.voice === "v2", `${tr.meta.id} ${style}: on = v2 plan`);
    const talk = on.cues.filter(c => c.sound.startsWith("cl-") || c.sound.startsWith("cc-"));
    for (let i = 1; i < talk.length; i++) {
      const prevEnd = talk[i - 1].at + (secs[talk[i - 1].sound] ?? 0);
      check(talk[i].at >= prevEnd - 1e-6, `${tr.meta.id} ${style}: ${talk[i].sound} starts after ${talk[i - 1].sound} ends`);
    }
    check(on.cues.every(c => c.at <= on.duration + 1e-6), `${tr.meta.id} ${style}: every sound inside the video`);
  }
}

if (problems.length) { console.error("goalClipVoice FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalClipVoice: ok");
