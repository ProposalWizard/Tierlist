/**
 * Big late moments (Leo, 22 Oct 2026): YOUR goal at 85'+ that wins it or
 * levels it gets the late call, in the goal video (goalClip/audio.ts
 * planAudio, ClipMeta.late) and live (lib/star/lateCommentary.ts).
 * Every other goal is called exactly as before.
 */
import { readFileSync, existsSync } from "node:fs";
import { trackFromStored, type GoalTrack } from "../../lib/star/goalClip/track";
import { makeEdit, type ClipStyle } from "../../lib/star/goalClip/edit";
import { planAudio, finishOf } from "../../lib/star/goalClip/audio";
import { CALLS, LATE_CALLS, LATE_REPLAY_LINES, SCORE_LINES, pickCall, lateKindOf } from "../../lib/star/goalClip/commentary";
import { COMMENTARY_SECONDS } from "../../lib/star/goalClip/commentaryDurations";
import { LATE_GOAL_LINES, lateGoalLine, playLateGoalCall } from "../../lib/star/lateCommentary";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${f}`, import.meta.url), "utf8"))) as GoalTrack;

// The lines: a recording, a length, and a manifest entry each.
const manifest = JSON.parse(readFileSync(new URL("../../public/sfx/manifest.json", import.meta.url), "utf8")) as { sounds: { name: string; duration: number }[] };
const lateIds = [...Object.values(LATE_CALLS).flat(), ...LATE_REPLAY_LINES].map(l => l.id);
check(LATE_CALLS.winner.length >= 5 && LATE_CALLS.level.length >= 3, "late calls for a winner and an equaliser");
check(LATE_GOAL_LINES.length === Object.values(LATE_CALLS).flat().length, "LATE_GOAL_LINES lists every late call");
for (const id of lateIds) {
  check(existsSync(new URL(`../../public/sfx/${id}.mp3`, import.meta.url)), `recording for ${id}`);
  check((COMMENTARY_SECONDS[id] ?? 0) > 0.8, `length for ${id}`);
  const m = manifest.sounds.find(s => s.name === id);
  check(!!m && m.duration > 0.8, `manifest entry for ${id}`);
}

// Which goals are late.
check(lateKindOf(88, true, 2, 1) === "winner", "2-1 at 88' (was 1-1): winner");
check(lateKindOf(90, true, 1, 1) === "level", "1-1 at 90' (was 0-1): level");
check(lateKindOf(85, true, 3, 2) === "winner", "85' counts");
check(lateKindOf(84, true, 2, 1) === undefined, "84' is not late");
check(lateKindOf(89, true, 3, 1) === undefined, "3-1 was already ahead: not a big moment");
check(lateKindOf(89, true, 1, 3) === undefined, "1-3 is a consolation");
check(lateKindOf(89, false, 2, 1) === undefined, "a team-mate's goal is not yours");

const isLateCall = (s: string) => Object.values(LATE_CALLS).flat().some(l => l.id === s);
const isLateCo = (s: string) => LATE_REPLAY_LINES.some(l => l.id === s);
const CALL_IDS = new Set(Object.values(CALLS).flat().map(l => l.id));
const SCORE_IDS = new Set(Object.values(SCORE_LINES).flat().map(l => l.id));

for (const f of ["scramble.json", "lay-off.json"]) {
  const tr = load(f);
  for (const style of ["broadcast", "reverse", "tiktok"] as ClipStyle[]) {
    const tag = `${f} ${style}`;
    // An ordinary goal: the same call as the plain pick, no late lines.
    const plain = planAudio(makeEdit([tr], style));
    const base = (() => { let h = 2166136261; const s = tr.meta.id; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; })();
    const expect = pickCall(finishOf(tr), `${tr.meta.id}:${base}:0`, []).id;
    check(plain.cues.some(c => c.sound === expect), `${tag}: ordinary goal keeps its call ${expect}`);
    check(!plain.cues.some(c => isLateCall(c.sound) || isLateCo(c.sound)), `${tag}: ordinary goal has no late lines`);
    // A late field on someone else's goal changes nothing.
    const notYours = { ...tr, meta: { ...tr.meta, isYou: false, late: "winner" as const } };
    check(JSON.stringify(planAudio(makeEdit([notYours], style))) === JSON.stringify(planAudio(makeEdit([{ ...tr, meta: { ...tr.meta, isYou: false } }], style))),
      `${tag}: late on a goal not yours is ignored`);

    for (const kind of ["winner", "level"] as const) {
      const late = { ...tr, meta: { ...tr.meta, isYou: true, minute: 89, late: kind } };
      const p = planAudio(makeEdit([late], style));
      const calls = p.cues.filter(c => isLateCall(c.sound));
      check(calls.length === 1, `${tag} ${kind}: one late call (got ${calls.length})`);
      check(calls.every(c => LATE_CALLS[kind].some(l => l.id === c.sound)), `${tag} ${kind}: the call fits the kind`);
      check(!p.cues.some(c => CALL_IDS.has(c.sound) || SCORE_IDS.has(c.sound)), `${tag} ${kind}: no ordinary call or score line`);
      // Kinds of the same moment: timing as before (just after the goal).
      const plainCall = plain.cues.find(c => CALL_IDS.has(c.sound));
      check(!!plainCall && calls.length === 1 && Math.abs(calls[0].at - plainCall.at) < 1e-6, `${tag} ${kind}: late call at the same moment`);
      if (style !== "tiktok" && plain.cues.some(c => c.sound.startsWith("cc-"))) {
        check(p.cues.some(c => isLateCo(c.sound)), `${tag} ${kind}: co-commentator's late line over the replay`);
      }
    }
  }
}

// Live: a seeded pick, the right kind, and never a throw outside a browser.
for (let s = 0; s < 20; s++) {
  check(LATE_CALLS.winner.some(l => l.id === lateGoalLine("winner", s)), `live winner pick ${s}`);
  check(LATE_CALLS.level.some(l => l.id === lateGoalLine("level", s)), `live level pick ${s}`);
  check(lateGoalLine("winner", s) === lateGoalLine("winner", s), "same seed, same line");
}
try { playLateGoalCall("winner", 1); playLateGoalCall("level", 2); } catch { check(false, "playLateGoalCall never throws"); }

if (problems.length) { console.error("lateCommentary FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("lateCommentary: ok");
