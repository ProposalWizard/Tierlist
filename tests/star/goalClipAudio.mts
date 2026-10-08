/**
 * Goal video sound (lib/star/goalClip/audio.ts): the plan of what plays when.
 * The mixing itself needs a browser (OfflineAudioContext) and is checked in
 * the real game; this checks the timing and the rules on real recordings.
 */
import { readFileSync } from "node:fs";
import { trackFromStored, type GoalTrack } from "../../lib/star/goalClip/track";
import { makeEdit, shotLength, editDuration, type ClipStyle } from "../../lib/star/goalClip/edit";
import { planAudio, COMMENTARY_GOAL, COMMENTARY_REPLAY, COMMENTARY_DELAY, BED_REPLAY, CLIP_SOUNDS } from "../../lib/star/goalClip/audio";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${f}`, import.meta.url), "utf8"))) as GoalTrack;
const tracks = [load("scramble.json"), load("lay-off.json")];
check(tracks.every(Boolean), "fixtures load");

const isGoalLine = (s: string) => (COMMENTARY_GOAL as readonly string[]).includes(s);
const isReplayLine = (s: string) => (COMMENTARY_REPLAY as readonly string[]).includes(s);

for (const tr of tracks) {
  for (const style of ["broadcast", "reverse", "fan"] as ClipStyle[]) {
    const e = makeEdit([tr], style);
    const p = planAudio(e);
    const tag = `${tr.meta.id} ${style}`;
    check(Math.abs(p.duration - editDuration(e)) < 1e-6, `${tag}: plan lasts as long as the video`);
    check(p.cues.every(c => c.at >= 0 && c.at <= p.duration + 1e-6), `${tag}: every sound inside the video`);
    check(p.cues.every(c => (CLIP_SOUNDS as readonly string[]).includes(c.sound)), `${tag}: only known files`);
    for (let i = 1; i < p.bed.length; i++) check(p.bed[i].at >= p.bed[i - 1].at, `${tag}: crowd line in time order`);

    // The net and the roar land on the frame the ball goes in (live shot).
    const goalAt = (tr.goalT - e.shots[0].from) / e.shots[0].rate;
    const net = p.cues.find(c => c.sound === "goal-net");
    check(!!net && Math.abs(net.at - goalAt) < 1e-6, `${tag}: net on the goal frame`);
    const roar = p.cues.find(c => c.sound === "crowd-cheer-stadium");
    check(!!roar && Math.abs(roar.at - goalAt) < 0.1, `${tag}: crowd roars at the goal`);

    // The scoring kick is heard when the video shows it.
    const kick = p.cues.find(c => c.sound === "kick-hard" && Math.abs(c.at - (tr.strikeT - e.shots[0].from)) < 1e-6);
    check(!!kick, `${tag}: the strike is heard on its frame`);

    const goalLines = p.cues.filter(c => isGoalLine(c.sound));
    const replayLines = p.cues.filter(c => isReplayLine(c.sound));
    if (style === "fan") {
      check(goalLines.length === 0 && replayLines.length === 0, `${tag}: a fan's phone has no commentator`);
    } else {
      check(goalLines.length === 1, `${tag}: one commentator line for one goal (got ${goalLines.length})`);
      check(goalLines.length === 1 && Math.abs(goalLines[0].at - (goalAt + COMMENTARY_DELAY)) < 1e-6, `${tag}: commentator just after the goal`);
      check(replayLines.length === 1, `${tag}: a replay line over the slow motion`);
      const replayStart = shotLength(e.shots[0]);
      check(replayLines.length === 1 && replayLines[0].at > replayStart, `${tag}: replay line during the replay`);
      check(p.bed.some(b => b.at >= replayStart && b.gain === BED_REPLAY), `${tag}: the crowd drops back for the replay`);
      // Slow-motion kicks are slower and deeper.
      const slowNet = p.cues.filter(c => c.sound === "goal-net" && c.at > replayStart);
      check(slowNet.length === 1 && slowNet[0].rate < 1, `${tag}: the replay's net plays slowed`);
    }
    // One sound per touch: never a soft and a hard kick on the same moment.
    const kicks = p.cues.filter(c => c.sound === "kick-hard" || c.sound === "kick-soft");
    check(kicks.every((k, i) => kicks.every((o, j) => i === j || Math.abs(o.at - k.at) > 0.02)), `${tag}: no double kick on one touch`);
    // A keeper who was beaten makes no glove sound.
    const beaten = tr.events.filter(ev => ev.kind === "save" && ev.save === "beaten" && ev.t >= e.shots[0].from && ev.t <= e.shots[0].to);
    check(beaten.every(ev => !p.cues.some(c => c.sound === "keeper-save" && Math.abs(c.at - (ev.t - e.shots[0].from)) < 1e-6)), `${tag}: no glove sound for a beaten keeper`);
    // The same goal always sounds the same.
    check(JSON.stringify(planAudio(makeEdit([tr], style))) === JSON.stringify(p), `${tag}: same plan every time`);
  }
}

// A reel: one commentator line per goal, and two goals do not get the same line.
const reel = planAudio(makeEdit(tracks, "broadcast"));
const reelLines = reel.cues.filter(c => isGoalLine(c.sound));
check(reelLines.length === 2, `reel: a line per goal (got ${reelLines.length})`);
check(reelLines.length === 2 && reelLines[0].sound !== reelLines[1].sound, "reel: two goals, two different lines");

if (problems.length) { console.error("goalClipAudio FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalClipAudio: ok");
