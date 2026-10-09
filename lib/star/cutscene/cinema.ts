/**
 * THE CINEMATOGRAPHER — shot intents → camera shots, by film rules:
 *
 *  - open on an establishing shot; then go wide → medium → close as the
 *    feeling rises (emotion shots tighten with intensity and stakes);
 *  - keep the camera on one side of the line between the two main people
 *    (the 180° rule: a shot of THEM is from the mirrored side);
 *  - after the big moment, cut to a reaction;
 *  - triumph is seen from low (a hero angle), defeat from above;
 *  - no jump cuts: two shots in a row of the same thing change size or angle;
 *  - shot length grows with the stakes (a big moment is allowed to breathe),
 *    and a long hold is split into two angles;
 *  - tension, shock and anger shake the camera a little; emotion pushes in.
 *
 * Pure: (intents, event, seed) → CameraTrack[]. Deterministic.
 */
import type { CameraTrack, ShotPreset, ShotSpec, StoryEvent, Target, Track, Vec3 } from "./types";
import type { ShotIntent } from "./beats";
import { LOCATIONS } from "./presets/locations";
import { shotSizeRank } from "./presets/camera";
import { rng } from "./math";
import { valenceOf } from "./story";

export interface CinemaOpts { ev: StoryEvent; seed: number; duration: number; loc: keyof typeof LOCATIONS; mainPair: [string, string | undefined] }

const sameTarget = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b);
const actorOf = (t: Target) => ("actor" in t && !t.local ? t.actor : null);

export function presetFor(it: ShotIntent, ev: StoryEvent, R: ReturnType<typeof rng>): ShotPreset {
  const v = valenceOf(ev), s = ev.stakes, i = ev.intensity ?? 0.5;
  switch (it.purpose) {
    case "establish": return "establishing";
    case "action": return it.subject2 ? "ots" : "full";
    case "follow": return "medium-wide";
    case "detail": return "insert";
    case "two": return it.subject2 ? (R.chance(0.5) ? "two-shot" : "ots") : "medium-wide";
    case "emotion": return i + s > 1.3 ? "close" : i + s > 0.8 ? "medium-close" : "medium";
    case "reaction": return s > 0.6 ? "medium-close" : "medium";
    case "hero": return v >= 0 ? (s > 0.5 ? "low-hero" : "full") : "high-angle";
    case "crowd": return "wide";
    case "pov": return "pov";
  }
  return "medium";
}

export function cinematograph(intents: ShotIntent[], o: CinemaOpts): CameraTrack[] {
  const R = rng(o.seed * 31 + 5);
  const ev = o.ev;
  const loc = LOCATIONS[o.loc];
  // 1. order; later intents cut earlier ones short; drop slivers
  const xs = intents.slice().sort((a, b) => a.at - b.at || (b.weight ?? 0.5) - (a.weight ?? 0.5)).map((x) => ({ ...x }));
  const kept: ShotIntent[] = [];
  for (const x of xs) {
    const prev = kept[kept.length - 1];
    if (prev && x.at < prev.at + prev.dur) {
      const cut = x.at - prev.at;
      if (cut < 0.75) {
        if ((x.weight ?? 0.5) > (prev.weight ?? 0.5)) { kept.pop(); x.dur += x.at - prev.at; x.at = prev.at; }
        else { const end = x.at + x.dur; if (end > prev.at + prev.dur) prev.dur = end - prev.at; continue; }
      } else prev.dur = cut;
    }
    kept.push(x);
  }
  // 2. no gaps: each shot runs to the next; the first from 0; the last to the end
  if (kept.length) { kept[0].dur += kept[0].at; kept[0].at = 0; }
  for (let i = 0; i < kept.length - 1; i++) kept[i].dur = kept[i + 1].at - kept[i].at;
  if (kept.length) kept[kept.length - 1].dur = Math.max(0.5, o.duration - kept[kept.length - 1].at);

  // 3. the line: which side the camera keeps to
  const side: 1 | -1 = R.chance(0.5) ? 1 : -1;
  const [A, B] = o.mainPair;
  const sideFor = (t: Target): 1 | -1 => (actorOf(t) && B && actorOf(t) === B ? (-side as 1 | -1) : side);

  const maxLen = 2.6 + ev.stakes * 1.8;
  const v = valenceOf(ev);
  const shake = ["tension", "shock", "anger"].includes(ev.emotion) ? 0.35 : ev.emotion === "joy" && (ev.intensity ?? 0) > 0.7 ? 0.18 : 0;
  const out: CameraTrack[] = [];
  let last: { preset: ShotPreset; subject: Target; side: number; yaw: number } | null = null;
  const push = (it: ShotIntent, at: number, dur: number, alt: boolean) => {
    let preset: ShotPreset = it.hint?.preset ?? presetFor(it, ev, R);
    if (alt) preset = preset === "close" ? "medium-close" : preset === "medium" || preset === "medium-close" ? "close" : preset === "ots" ? "medium-close" : "medium";
    let yaw = it.hint?.yaw ?? 0;
    const sd = it.hint?.side ?? sideFor(it.subject);
    // no jump cut: same thing, same size, same side → change the size, or swing round
    if (last && sameTarget(last.subject, it.subject) && Math.abs(shotSizeRank(last.preset) - shotSizeRank(preset)) < 2 && last.side === sd && Math.abs(last.yaw - yaw) < 25) {
      if (preset !== "insert" && preset !== "establishing") yaw += 32 * (R.chance(0.5) ? 1 : -1);
    }
    const spec: ShotSpec = {
      preset, subject: it.subject, subject2: it.subject2, side: sd, yaw,
      lens: it.hint?.lens ?? (preset === "close" || preset === "medium-close" ? 50 + ev.stakes * 22 : undefined),
      move: it.hint?.move ?? moveFor(it, preset, ev, R),
      moveAmount: it.hint?.moveAmount,
      shake: it.hint?.shake ?? (it.purpose === "establish" ? 0 : shake),
      fixed: it.hint?.fixed,
      rise: it.hint?.rise,
    };
    if (preset === "establishing" && !spec.fixed) spec.fixed = { pos: loc.establish.pos, look: loc.establish.look, lens: loc.establish.lens };
    const cut: CameraTrack["cut"] = last && sameTarget(last.subject, it.subject) && it.purpose === "follow" ? "blend" : "cut";
    out.push({ type: "camera", at, dur, shot: spec, cut, blend: cut === "blend" ? 0.5 : undefined, name: it.name ?? `${it.purpose}` });
    last = { preset, subject: it.subject, side: sd, yaw };
  };
  for (const it of kept) {
    if (it.dur > maxLen && it.purpose !== "establish" && it.purpose !== "follow" && !it.hint?.fixed) {
      const h = it.dur / 2;
      push(it, it.at, h, false);
      push(it, it.at + h, it.dur - h, true);
    } else push(it, it.at, it.dur, false);
  }
  void v; void A;
  return out;
}

function moveFor(it: ShotIntent, p: ShotPreset, ev: StoryEvent, R: ReturnType<typeof rng>): ShotSpec["move"] {
  if (p === "establishing") return R.chance(0.5) ? "dolly-in" : "orbit-left";
  if (it.purpose === "follow") return "follow";
  if (it.purpose === "emotion") return (ev.intensity ?? 0.5) + ev.stakes > 0.9 ? "dolly-in" : "push";
  if (it.purpose === "hero") return ev.stakes > 0.6 ? "crane-up" : "push";
  if (it.purpose === "crowd") return "orbit-right";
  return "static";
}

/** Fades, letterbox: the frame round the shots. */
export function frameTracks(duration: number, stakes: number): Track[] {
  return [
    { type: "transition", at: 0, dur: 0.6, kind: "fade-in" },
    { type: "transition", at: duration - 0.7, dur: 0.7, kind: "fade-out" },
    { type: "letterbox", at: 0, amount: 0.1 + stakes * 0.06 },
  ];
}

/**
 * How well-shot a script is, 0..1, from the rules above (the generator's
 * scenes must score at least as well as the hand-made ones).
 */
export function shotQuality(tracks: Track[], duration: number, mainPair: [string, string | undefined]): { score: number; notes: string[] } {
  const cams = tracks.filter((t): t is CameraTrack => t.type === "camera").sort((a, b) => a.at - b.at);
  const notes: string[] = [];
  let s = 0, n = 0;
  const add = (ok: number, why: string) => { s += ok; n++; if (ok < 1) notes.push(`${why} (${(ok * 100).toFixed(0)}%)`); };
  if (!cams.length) return { score: 0, notes: ["no shots"] };
  // covered from start to end
  let covered = 0;
  for (const c of cams) covered += c.dur;
  add(Math.min(1, covered / duration) * (cams[0].at < 0.05 ? 1 : 0.5), "covers the whole scene");
  // opens wide
  add(["establishing", "wide", "full"].includes(cams[0].shot.preset) || cams[0].shot.fixed ? 1 : 0.4, "opens wide");
  // pace: 0.22 – 0.75 cuts a second
  const pace = cams.length / duration;
  add(pace < 0.22 ? pace / 0.22 : pace > 0.75 ? 0.75 / pace : 1, "pace of cuts");
  // no slivers
  const short = cams.filter((c) => c.dur < 0.7 && !c.shot.fixed).length;
  add(1 - short / cams.length, "no shot under 0.7 s");
  // variety of sizes
  const sizes = new Set(cams.map((c) => c.shot.preset));
  add(Math.min(1, sizes.size / 4), "variety of shot sizes");
  // gets close at least once
  add(cams.some((c) => ["close", "medium-close", "extreme-close", "insert"].includes(c.shot.preset)) ? 1 : 0, "a close-up");
  // the 180° rule for the main pair
  const [A, B] = mainPair;
  if (B) {
    const sideOf = (c: CameraTrack) => { const a = "actor" in c.shot.subject ? c.shot.subject.actor : null; return a === A ? c.shot.side ?? 1 : a === B ? -(c.shot.side ?? 1) : null; };
    const ss = cams.map(sideOf).filter((x): x is number => x !== null);
    const major = ss.filter((x) => x === (ss[0] ?? 1)).length;
    add(ss.length ? major / ss.length : 1, "keeps to one side of the line");
  }
  // no jump cuts
  let jumps = 0;
  for (let i = 1; i < cams.length; i++) {
    const a = cams[i - 1].shot, b = cams[i].shot;
    if (JSON.stringify(a.subject) === JSON.stringify(b.subject) && a.preset === b.preset && (a.yaw ?? 0) === (b.yaw ?? 0) && a.side === b.side && !a.fixed && !b.fixed && cams[i].cut !== "blend") jumps++;
  }
  add(1 - jumps / Math.max(1, cams.length - 1), "no jump cuts");
  return { score: s / n, notes };
}

export type { Vec3 };
