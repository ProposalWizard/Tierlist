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
import type { CameraTrack, CutsceneScript, ShotPreset, ShotSpec, StoryEvent, Target, Track, Vec3 } from "./types";
import { CLIP_QUALITY, POSE_QUALITY, GAIT_QUALITY } from "./presets/clips";
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
        else {
          // the lighter one waits for the heavier to finish, if enough of it is left
          const end = x.at + x.dur, pend = prev.at + prev.dur;
          if (end - pend >= 0.75) { x.at = pend; x.dur = end - pend; }
          else { if (end > pend) prev.dur = end - prev.at; continue; }
        }
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
    // establishing: indoors, the set's own view; outdoors a wide on the people that moves in (never tiny figures in a big field)
    if (preset === "establishing" && !spec.fixed) {
      if (loc.indoor) spec.fixed = { pos: loc.establish.pos, look: loc.establish.look, lens: loc.establish.lens };
      else { spec.preset = "full"; spec.move = "dolly-in"; spec.moveAmount = 0.3; spec.lens = 28; }
    }
    // the first shot sets the place and moves: never a static close-up cold
    if (!out.length && shotSizeRank(spec.preset) > shotSizeRank("medium-wide") && !spec.fixed) { spec.preset = "medium-wide"; spec.move = "dolly-in"; spec.moveAmount = 0.25; }
    const cut: CameraTrack["cut"] = last && sameTarget(last.subject, it.subject) && it.purpose === "follow" ? "blend" : "cut";
    out.push({ type: "camera", at, dur, shot: spec, cut, blend: cut === "blend" ? 0.5 : undefined, name: it.name ?? `${it.purpose}` });
    last = { preset: spec.preset, subject: it.subject, side: sd, yaw };
  };
  for (const it of kept) {
    if (it.dur > maxLen && it.purpose !== "establish" && it.purpose !== "follow" && !it.hint?.fixed) {
      const h = it.dur / 2;
      push(it, it.at, h, false);
      push(it, it.at + h, it.dur - h, true);
    } else push(it, it.at, it.dur, false);
  }
  // at least one close shot of a person (the feeling is in the face): the longest emotion/hero/reaction shot after the first tightens
  const isClose = (p: ShotPreset) => ["close", "medium-close", "extreme-close"].includes(p);
  if (!out.some((c) => isClose(c.shot.preset))) {
    const cands = out.slice(1).filter((c) => "actor" in c.shot.subject && !c.shot.fixed && c.shot.preset !== "insert");
    const pick = cands.sort((a, b) => b.dur - a.dur)[0];
    if (pick) { pick.shot = { ...pick.shot, preset: "medium-close", lens: 55 + ev.stakes * 20, move: "push" }; pick.name = `${pick.name} · close`; }
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
  add(["establishing", "wide", "full", "medium-wide", "two-shot", "low-hero"].includes(cams[0].shot.preset) || cams[0].shot.fixed ? 1 : 0.4, "opens on the place");
  // pace: 0.22 – 0.75 cuts a second
  const pace = cams.length / duration;
  add(pace < 0.22 ? pace / 0.22 : pace > 0.75 ? 0.75 / pace : 1, "pace of cuts");
  // no slivers
  const short = cams.filter((c) => c.dur < 0.7 && !c.shot.fixed).length;
  add(1 - short / cams.length, "no shot under 0.7 s");
  // variety of sizes
  const sizes = new Set(cams.map((c) => c.shot.preset));
  add(Math.min(1, sizes.size / 3), "variety of shot sizes");
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

// ── THE FILM PASS (Settings → Look → "Cut-scene camera: New") ─────────────
//
// Harry, 9 Oct 2026: "do a pass of camera angles in the cut scenes, hide bad
// animations with good zooms and angles, wide angles". Run over ANY script
// (hand-made or generated) after its shots are chosen; Old plays the script
// exactly as written.
//
//  1. Open on the place: a wide establishing shot (the room's own view
//     indoors, a wide that moves in outdoors), then mediums and close-ups.
//  2. Nothing stands still: a static shot gets a slow push-in or a gentle
//     dolly; an establishing view creeps in.
//  3. Two people talking: a plain medium on one of them becomes an
//     over-the-shoulder.
//  4. Hide weak animation (presets/clips.ts: CLIP_QUALITY, POSE_QUALITY,
//     GAIT_QUALITY, and the pen, the handshake grip and the prop holds): a
//     wide shot never stays on a weak move for more than WEAK_WIDE_MAX s. It
//     cuts to the face, a cutaway to the prop (the pen on the paper, the
//     trophy, the boots on the tunnel floor) or the other person's reaction,
//     in 1.2–2.6 s shots. A long tight shot over a weak move is split too.
//  5. Cut on action: a cut that falls just before or after someone starts a
//     move is moved onto the start of the move.
// Pure: (script) → script. Deterministic.

/** A stretch where someone is doing a move that looks weak from far away. */
export interface WeakWindow { at: number; end: number; actor: string; what: string; prop?: string }

/** The longest a wide shot may sit on a weak move (seconds). */
export const WEAK_WIDE_MAX = 1.0;
/** Shot sizes that show the whole body (or the hands at a desk). */
const SHOWS_BODY = new Set<ShotPreset>(["establishing", "wide", "crowd", "full", "medium-wide", "two-shot", "low-hero", "high-angle", "top-down", "medium", "profile", "dutch"]);
/** Roles whose heads do not hold up in a close-up (a stand-in head): kept at medium-wide or wider. */
const NO_CLOSE_ROLES = new Set<string>(["journalist"]);
const isShowsBody = (c: CameraTrack) => SHOWS_BODY.has(c.shot.preset) || (!!c.shot.fixed && c.shot.preset !== "insert");

/** Every weak stretch in a script, by the move-quality tags. */
export function weakWindows(s: CutsceneScript): WeakWindow[] {
  const out: WeakWindow[] = [];
  const byActor = new Map<string, Track[]>();
  for (const tr of s.tracks) if ("actor" in tr) { const a = (tr as { actor: string }).actor; if (!byActor.has(a)) byActor.set(a, []); byActor.get(a)!.push(tr); }
  for (const [actor, trs] of Array.from(byActor.entries())) {
    const clips = trs.filter((x) => x.type === "clip").sort((a, b) => a.at - b.at) as Extract<Track, { type: "clip" }>[];
    clips.forEach((c, i) => {
      if ((CLIP_QUALITY[c.clip] ?? "ok") !== "weak") return;
      const end = c.dur !== undefined ? c.at + c.dur : clips[i + 1]?.at ?? s.duration;
      out.push({ at: c.at, end, actor, what: c.clip });
    });
    for (const tr of trs) {
      if (tr.type === "pose" && POSE_QUALITY[tr.pose] === "weak") out.push({ at: tr.at, end: tr.at + tr.dur, actor, what: tr.pose, prop: tr.prop });
      if (tr.type === "move" && tr.gait && GAIT_QUALITY[tr.gait] === "weak") out.push({ at: tr.at, end: tr.at + tr.dur, actor, what: `walk` });
      if (tr.type === "trace") out.push({ at: tr.at, end: tr.at + tr.dur, actor, what: "pen", prop: tr.along.prop });
      if (tr.type === "reach") {
        const r = tr as Extract<Track, { type: "reach" }> & { grip?: string };
        const toProp = "prop" in r.target ? r.target.prop : undefined;
        if (r.grip === "pen" || r.grip === "shake" || (toProp && r.dur < 6)) out.push({ at: r.at, end: r.at + r.dur, actor, what: r.grip === "shake" ? "handshake" : "hands", prop: toProp });
      }
    }
  }
  return out.filter((w) => w.end - w.at > 0.15).sort((a, b) => a.at - b.at);
}

/** The weak moves that matter in a shot: its own people's, plus anyone walking (a crowd of walkers shows in any wide). Background clapping does not. */
function weakFor(ws: WeakWindow[], c: CameraTrack): WeakWindow[] {
  const who = new Set<string>(["you"]);
  for (const tg of [c.shot.subject, c.shot.subject2]) if (tg && "actor" in tg) who.add(tg.actor);
  return ws.filter((w) => who.has(w.actor) || w.what === "walk");
}

/** Seconds of [a, b] covered by weak windows, and the first weak window in it. */
function weakIn(ws: WeakWindow[], a: number, b: number, prefer?: string): { secs: number; first: WeakWindow | null; start: number; end: number } {
  let secs = 0, first: WeakWindow | null = null, start = Infinity, end = -Infinity;
  // the union of the overlaps
  const segs = ws.map((w) => [Math.max(a, w.at), Math.min(b, w.end), w] as const).filter(([x, y]) => y > x).sort((p, q) => p[0] - q[0]);
  let cx = -Infinity, cy = -Infinity;
  for (const [x, y, w] of segs) {
    if (!first) first = w;
    start = Math.min(start, x); end = Math.max(end, y);
    if (x > cy) { if (cy > cx) secs += cy - cx; cx = x; cy = y; } else cy = Math.max(cy, y);
  }
  if (cy > cx) secs += cy - cx;
  // the window the cover is about: the shot's own subject first, one with a prop to cut to first
  const rank = (w: WeakWindow) => (w.actor === prefer ? 0 : 2) + (w.prop ? 0 : 1);
  const best = segs.map((x) => x[2]).sort((p, q) => rank(p) - rank(q))[0];
  return { secs, first: best ?? first, start, end };
}

const gentleMove = (sh: ShotSpec, k: number): Pick<ShotSpec, "move" | "moveAmount"> => {
  if (sh.move && sh.move !== "static") return { move: sh.move, moveAmount: sh.moveAmount };
  if (sh.fixed) return { move: "dolly-in", moveAmount: 0.08 };
  switch (sh.preset) {
    case "establishing": case "wide": case "crowd": return { move: "dolly-in", moveAmount: 0.15 };
    case "two-shot": case "full": case "medium-wide": return { move: k % 2 ? "orbit-left" : "orbit-right", moveAmount: 9 };
    case "ots": return { move: "dolly-in", moveAmount: 0.1 };
    case "pov": return { move: "static" };
    default: return { move: "push" };
  }
};

export function filmPass(script: CutsceneScript): CutsceneScript {
  const cams0 = script.tracks.filter((t): t is CameraTrack => t.type === "camera").sort((a, b) => a.at - b.at);
  if (!cams0.length) return script;
  const rest = script.tracks.filter((t) => t.type !== "camera");
  const loc = LOCATIONS[script.set.location];
  const ws = weakWindows(script);
  const ids = new Set(script.cast.map((m) => m.id));
  const props = new Set((script.props ?? []).map((p) => p.id));
  const you: Target = ids.has("you") ? { actor: "you" } : { actor: script.cast[0]?.id ?? "you" };
  const mk = (c: CameraTrack, at: number, dur: number, shot: ShotSpec, name: string, cut: CameraTrack["cut"] = "cut"): CameraTrack => ({ ...c, at, dur, shot, name, cut, blend: cut === "blend" ? c.blend : undefined });
  let cams: CameraTrack[] = cams0.map((c) => ({ ...c, shot: { ...c.shot } }));

  // 1. open on the place
  const first = cams[0];
  const opensWide = first.shot.preset === "establishing" || first.shot.preset === "wide" || first.shot.preset === "crowd" || (!!first.shot.fixed && first.shot.preset !== "insert");
  if (!opensWide) {
    const est: ShotSpec = loc.indoor && loc.establish
      ? { preset: "establishing", subject: first.shot.subject, fixed: { pos: loc.establish.pos, look: loc.establish.look, lens: loc.establish.lens }, move: "dolly-in", moveAmount: 0.12 }
      : { preset: "wide", subject: "actor" in first.shot.subject ? first.shot.subject : you, side: first.shot.side, yaw: (first.shot.yaw ?? 0) - 20, lens: 24, rise: 0.5, move: "dolly-in", moveAmount: 0.35 };
    const d = Math.min(1.8, first.dur * 0.55);
    if (first.dur - d < 0.8) cams[0] = mk(first, 0, first.dur, est, "The place");
    else cams = [mk(first, 0, d, est, "The place"), mk(first, d, first.dur - d, first.shot, first.name ?? "shot"), ...cams.slice(1)];
  }

  // 3. two people talking: a plain medium on one of them → over the shoulder
  let twoSeen = 0;
  for (const c of cams.slice(1)) {
    const s2 = c.shot.subject2;
    if (!s2 || !("actor" in s2) || !("actor" in c.shot.subject) || c.shot.fixed) continue;
    if (c.shot.preset === "medium") c.shot = { ...c.shot, preset: "ots", lens: c.shot.lens ?? 50 };
    else if (c.shot.preset === "two-shot" && twoSeen++ > 0) c.shot = { ...c.shot, preset: "ots", lens: c.shot.lens ?? 45 };
  }

  // 3b. faces that do not hold up close (the journalist's head smears its lower face,
  //     coordinator's still 9 Oct 2026): never tighter than a medium-wide on them
  const noClose = new Set(script.cast.filter((m) => NO_CLOSE_ROLES.has(m.role)).map((m) => m.id));
  for (const c of cams) {
    const s1 = c.shot.subject;
    if (!("actor" in s1) || !noClose.has(s1.actor) || c.shot.fixed) continue;
    if (shotSizeRank(c.shot.preset) > shotSizeRank("medium-wide")) c.shot = { ...c.shot, preset: "medium-wide", lens: 35, yaw: (c.shot.yaw ?? 0) + 10 };
  }

  // 4. hide weak animation
  const out: CameraTrack[] = [];
  let coverK = 0;
  for (const c of cams) {
    const a = c.at, b = c.at + c.dur;
    const w = weakIn(weakFor(ws, c), a, b, "actor" in c.shot.subject ? c.shot.subject.actor : undefined);
    const wide = isShowsBody(c);
    const long = !wide && c.shot.preset !== "insert" && c.dur > 3.0 && w.secs > 2.0;
    if ((!wide || w.secs <= WEAK_WIDE_MAX + 0.05) && !long) { out.push(c); continue; }
    // where the cover starts: a second into the weak move (a tight shot that runs long: half way)
    let cut = wide ? Math.max(a, w.start) + WEAK_WIDE_MAX : a + Math.min(2.6, c.dur / 2);
    if (cut - a < 0.8) cut = Math.min(b, a + 0.8);
    if (b - cut < 0.6) { out.push(c); continue; }
    if (cut > a + 0.01) out.push(mk(c, a, cut - a, c.shot, c.name ?? "shot", c.cut));
    // cover shots for [cut, b]
    const wf = w.first!;
    const who: Target = ids.has(wf.actor) ? { actor: wf.actor } : you;
    const other = "actor" in c.shot.subject && c.shot.subject.actor !== wf.actor ? c.shot.subject : c.shot.subject2 && "actor" in c.shot.subject2 && c.shot.subject2.actor !== wf.actor ? c.shot.subject2 : undefined;
    const sd = c.shot.side ?? 1;
    // head and shoulders, never a face filling the frame (a stretched face texture shows at that size; coordinator, 9 Oct 2026)
    const face: ShotSpec = { preset: "medium-close", subject: who, subject2: other, side: sd, yaw: -8, lens: 45, move: "push" };
    const faceMid: ShotSpec = { preset: "medium-close", subject: who, subject2: other, side: sd, yaw: 14, lens: 52, move: "dolly-in", moveAmount: 0.12 };
    const prop = wf.prop && props.has(wf.prop) ? wf.prop : undefined;
    const covers: { shot: ShotSpec; name: string }[] = [];
    if (wf.what === "walk") {
      covers.push({ shot: { preset: "medium", subject: who, side: sd, yaw: 165, lens: 24, move: "follow" }, name: "Into the light" });
      covers.push({ shot: { preset: "medium-close", subject: who, side: sd, yaw: 10, lens: 50, move: "follow" }, name: "The face" });
    } else if (prop) {
      covers.push({ shot: { preset: "insert", subject: { prop }, side: sd, yaw: 30, lens: 42, rise: wf.what.startsWith("trophy") ? -0.55 : 0.04, move: "push" }, name: wf.what === "pen" ? "The pen" : `The ${prop}` });
      covers.push({ shot: face, name: "The face" });
    } else {
      covers.push({ shot: face, name: "The face" });
      if (other && !("actor" in other && noClose.has(other.actor))) covers.push({ shot: { preset: "close", subject: other, subject2: who, side: -sd as 1 | -1, yaw: 8, lens: 62, move: "push" }, name: "Reaction" });
      else covers.push({ shot: faceMid, name: "Closer" });
    }
    // after the weak move ends, the shot goes back to its own subject from a new angle
    const weakEnd = Math.min(b, w.end);
    const coverEnd = b - weakEnd >= 1.3 ? weakEnd : b;
    let t = cut;
    while (coverEnd - t > 0.01) {
      let d = Math.min(2.4, coverEnd - t);
      if (coverEnd - (t + d) < 0.8) d = coverEnd - t; // no sliver at the end
      if (d > 2.9) d = (coverEnd - t) / 2;
      // the scene's very last shot is never a cutaway to a prop or the feet: it ends on the person
      const endsScene = c === cams[cams.length - 1] && t + d >= b - 0.01;
      let cv = covers[coverK++ % covers.length];
      // never the same framing as the shot just before (a jump cut): take the other cover
      const lastShot = out[out.length - 1]?.shot;
      if (lastShot && covers.length > 1 && lastShot.preset === cv.shot.preset && Math.abs((lastShot.yaw ?? 0) - (cv.shot.yaw ?? 0)) < 40) cv = covers[coverK++ % covers.length];
      if (endsScene && cv.shot.preset === "insert") cv = covers.find((x) => x.shot.preset !== "insert") ?? cv;
      out.push(mk(c, t, d, cv.shot, `${c.name ?? "shot"} · ${cv.name.toLowerCase()}`));
      t += d;
    }
    if (coverEnd < b - 0.01) out.push(mk(c, coverEnd, b - coverEnd, { ...c.shot, yaw: (c.shot.yaw ?? 0) + 28 }, `${c.name ?? "shot"} · again`));
  }

  // 2. nothing stands still
  out.forEach((c, k) => { c.shot = { ...c.shot, ...gentleMove(c.shot, k) }; });
  // over a SEATED shoulder the chair back fills half the frame: look over it
  const seated = (id: string, t: number) => script.tracks.some((x) => x.type === "clip" && x.actor === id && x.at <= t && /^sit/.test(x.clip)) && !script.tracks.some((x) => x.type === "clip" && x.actor === id && x.at <= t && x.clip === "stand-up");
  for (const c of out) {
    const s2 = c.shot.subject2;
    if (c.shot.preset === "ots" && s2 && "actor" in s2 && seated(s2.actor, c.at + 0.05)) c.shot = { ...c.shot, rise: (c.shot.rise ?? 0) + 0.28 };
  }

  // 5. cut on action: a cut within 0.3 s of someone starting a move goes onto it (+0.08 s)
  const starts = script.tracks
    .filter((t) => (t.type === "clip" && !(t as { loop?: boolean }).loop) || t.type === "move" || (t.type === "pose" && (t as { blendIn?: number }).blendIn !== 0))
    .map((t) => t.at + 0.08).sort((x, y) => x - y);
  for (let i = 1; i < out.length; i++) {
    const p = out[i - 1], c = out[i];
    const near = starts.filter((s) => Math.abs(s - c.at) < 0.3 && s - p.at >= 0.8 && c.at + c.dur - s >= 0.8).sort((x, y) => Math.abs(x - c.at) - Math.abs(y - c.at))[0];
    if (near === undefined || Math.abs(near - c.at) < 0.02) continue;
    const end = c.at + c.dur;
    p.dur = near - p.at; c.at = near; c.dur = end - near;
  }
  // a cover after its own shot can't be a "blend"; slivers fold into the shot before
  const final: CameraTrack[] = [];
  for (const c of out) {
    const prev = final[final.length - 1];
    if (prev && c.dur < 0.7) { prev.dur += c.dur; continue; }
    final.push(c);
  }
  return { ...script, tracks: [...rest, ...final], id: script.id, source: script.source };
}

/** Of a script, the seconds a body-showing shot sits on a weak move past WEAK_WIDE_MAX (0 = all hidden). */
export function weakWideOverrun(s: CutsceneScript): number {
  const ws = weakWindows(s);
  let over = 0;
  for (const c of s.tracks.filter((t): t is CameraTrack => t.type === "camera")) {
    if (!isShowsBody(c)) continue;
    const w = weakIn(weakFor(ws, c), c.at, c.at + c.dur);
    over += Math.max(0, w.secs - (WEAK_WIDE_MAX + 0.3));
  }
  return over;
}
