/**
 * COLD EDITS — THE CUTS (Leo, 31 Oct 2026: "want more variety and video types
 * again, not rlly seeing like cold football edits … do better in general").
 * Leo's switch part "coldEdits" (lib/star/leoUpdate.ts). With it off no
 * account is ever given one of these styles (media/clipStyle.ts), so this
 * file is not reached and every video is as before.
 *
 * Six kinds of edit-page video, after how football edits are made on TikTok,
 * Reels and Shorts (research: docs/handoffs/2026-10-31-leo/round4/edits/RESEARCH.md):
 *  - cold:     a velocity edit. The build-up sped up, a ramp down into the
 *              strike, the contact frozen with the scorer ringed, the goal ON
 *              the drop, then a hit on every beat. Black and white with the
 *              scorer's kit colour kept, grain, letterbox, an RGB split on the
 *              big hits, one word of caption ("cold.").
 *  - aura:     slow motion, glow, warm grade; the celebration held long and
 *              pushed in on, "+1000 aura".
 *  - rewind:   the goal live, then wound back on tape (◀◀), then played again
 *              slow from another camera; the goal on the drop.
 *  - statCard: the goal, then the picture frozen and a stat card (distance,
 *              shot speed, minute, finish) built one row a beat.
 *  - montage:  every goal in the post, each cut strike → net in a few beats,
 *              a counter, a flash on each goal; a title and an end card.
 *  - angles:   the same goal from three cameras back to back, each cut on a beat.
 *
 * Every edit is cut in WHOLE BEATS of its music (editMusic.ts): every shot
 * lasts a whole number of beats and the music starts so the drop is on a
 * beat boundary of the video. So every cut, flash and shake is on a beat by
 * construction (tests/star/goalVideoCold.mts measures it).
 *
 * Still only cuts of the recording (CLAUDE.md: "the goal replays should
 * always be the same"): slow motion is the recording played slower, a rewind
 * is it played backwards, a freeze is one recorded frame held. Every choice
 * is seeded from the account's cut (`variant`) and the goals: no Math.random.
 */
import { kitsOf } from "../kits";
import { CX } from "../pitch";
import { frameAt, trackDuration, type GoalTrack } from "./track";
import type { ClipAngle } from "./cameras";
import { EDIT_BEATS, beatSecs, type EditBeat, type EditBeatId } from "./editMusic";
import {
  TALL, EDIT_FPS, airFinish, celebCut, closeWindow,
  type ClipMoves, type ClipStyle, type ColdFx, type Edit, type Shot, type ShotFx,
} from "./edit";
import type { EditOptions } from "./editBetter";

/** In every cold edit's video name (premake.ts goalVideoKey): bump when a cut or its look changes. */
export const COLD_EDIT_VERSION = "cold1";

export const COLD_STYLES =["cold", "aura", "rewind", "statCard", "montage", "angles"] as const;
export type ColdStyle = (typeof COLD_STYLES)[number];
export function isColdStyle(s: ClipStyle | string | undefined): s is ColdStyle {
  return !!s && (COLD_STYLES as readonly string[]).includes(s);
}

/** How the picture is graded (coldRender.ts). Plain numbers: a 2D renderer can read them too. */
export interface EditLook {
  /** 0 = full colour, 1 = black and white. */
  desat: number;
  /** A colour kept in full while the rest goes grey (the scorer's shirt). */
  keep?: string;
  /** 1 = as filmed. */
  contrast: number;
  /** Multiply the colours: [r, g, b] (1 = none). A cold blue, a warm gold. */
  tint: [number, number, number];
  /** Film grain strength, 0..1. */
  grain: number;
  /** Black bars top and bottom, each this share of the height. */
  letterbox: number;
  /** Dark corners, 0..1. */
  vignette: number;
  /** Bloom on the bright parts, 0..1. */
  glow: number;
  /** The caption's look. */
  font: "cold" | "aura" | "tape" | "clean";
}

/** The music under an edit: which loop, and from where. */
export interface EditMusicCue {
  id: EditBeatId;
  url: string;
  bpm: number;
  /** Video seconds the music starts at (0). */
  at: number;
  /** Seconds into the file at video time 0. */
  offset: number;
  /** Video seconds of the drop. */
  dropAt: number;
  gain: number;
}

/** A hit on a beat: a flash, a shake, a zoom punch or an RGB split. */
export interface BeatHit {
  /** Video seconds. */
  at: number;
  kind: "flash" | "shake" | "punch" | "rgb";
  /** 0..1. */
  k: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function picker(variant: number, tracks: GoalTrack[]) {
  const base = `cold|${variant}|${tracks.map(t => t.meta.id).join(",")}`;
  return <T>(list: readonly T[], what: string): T => list[hash(`${base}|${what}`) % list.length];
}

// ── Words burnt into the edits (invented; no real people or brands) ─────────
export const COLD_WORDS = ["cold.", "ice cold.", "different.", "clinical.", "no mercy.", "unbothered.", "silence.", "him."] as const;
export const AURA_WORDS = ["+1000 aura", "aura farming", "main character", "pure aura", "the aura is unreal"] as const;
export const REWIND_WORDS = ["wait… run it back", "rewind that", "one more time", "again.", "hold on…"] as const;
export const MONTAGE_TITLES = ["every goal.", "the collection.", "all of them.", "goals only."] as const;
export const ANGLE_WORDS = ["every angle.", "all angles.", "watch it 3 ways"] as const;
export const STAT_TITLES = ["THE NUMBERS", "BY THE NUMBERS", "GOAL DATA"] as const;

/** The shirt the scorer wore in the recording (his side's change kit on a clash). */
export function scorerShirt(t: GoalTrack): string {
  const b = t.bodies.find(x => x.id === t.meta.scorerBody);
  if (b?.kit?.shirt) return b.kit.shirt;
  const ours = b ? b.side === "us" : true;
  const home = ours === t.meta.youAreHome;
  return kitsOf(home ? t.meta.home : t.meta.away).home.shirt;
}

/** Clip seconds: just before the strike to just after it goes in (the super slow-mo). */
function strikeWindow(t: GoalTrack): { from: number; to: number } {
  return { from: Math.max(0, t.strikeT - 0.45), to: Math.min(trackDuration(t), t.goalT + 0.3) };
}

/** How far out it was struck (m) and how fast it went (km/h), from the recording. */
export function goalNumbers(t: GoalTrack): { distance: number; speed: number } {
  const at = frameAt(t, Math.max(0, t.strikeT)).ball;
  const distance = Math.hypot(at.x - CX, Math.max(0, at.y));
  const a = frameAt(t, t.strikeT + 0.03).ball;
  const dt = Math.max(0.05, Math.min(0.12, t.goalT - t.strikeT - 0.03));
  const b = frameAt(t, t.strikeT + 0.03 + dt).ball;
  const speed = (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / dt) * 3.6;
  return { distance, speed };
}

function finishWord(t: GoalTrack): string {
  const strike = t.events.filter(e => e.kind === "shot" && e.t <= t.goalT + 0.05).pop();
  if (strike?.mode === "header") return "Header";
  if (strike?.mode === "volley") return "Volley";
  if (strike?.mode === "chip") return "Chip";
  if (strike?.mode === "curl") return "Curler";
  const how = t.meta.how;
  if (how === "penalty") return "Penalty";
  if (how === "free_kick") return "Free kick";
  if (how === "rebound") return "Rebound";
  if (how === "tap_in") return "Tap-in";
  return "Strike";
}

/**
 * Cuts measured in beats. `pos` is the video time so far, in beats; every
 * shot added is a whole number of beats long.
 */
class BeatCut {
  shots: Shot[] = [];
  pos = 0;
  constructor(readonly B: number) {}
  /** Play clip `from` → `to` in `beats` beats (the speed follows). */
  seg(track: number, angle: ClipAngle, from: number, to: number, beats: number, x: Partial<Shot> = {}): void {
    const n = Math.max(1, Math.round(beats));
    if (to - from < 0.03) { this.hold(track, angle, from, n, x); return; }
    this.shots.push({ track, angle, from, to, rate: (to - from) / (n * this.B), replay: false, ...x });
    this.pos += n;
  }
  /** Hold the picture at clip time `at` for `beats` beats. */
  hold(track: number, angle: ClipAngle, at: number, beats: number, x: Partial<Shot> = {}): void {
    const n = Math.max(1, Math.round(beats));
    this.shots.push({ track, angle, from: at, to: at, rate: 1, hold: n * this.B, replay: false, ...x });
    this.pos += n;
  }
  /** Beats needed to play `span` clip seconds at about `rate`, within [lo, hi]. */
  beatsFor(span: number, rate: number, lo = 1, hi = 16): number {
    return Math.max(lo, Math.min(hi, Math.round(span / (rate * this.B))));
  }
}

const cold = (c: ColdFx, x: ShotFx = {}): ShotFx => ({ ...x, cold: c });

/** Tall pictures from these cameras are wide: zoomed on the ball so it reads on a phone. */
const WIDE_ZOOM: Partial<Record<ClipAngle, number>> = { net: 1.4, spider: 1.45, reverse: 1.3, tv: 1.25, high: 1.3, side: 1.3 };
const zoomFor = (a: ClipAngle, extra = 1): ShotFx["zoom"] | undefined => {
  const z = (WIDE_ZOOM[a] ?? 1) * extra;
  return z !== 1 ? { from: z, to: z, over: 0 } : undefined;
};

/**
 * The hits after the drop: a small shake on every beat, a bigger one on the
 * back beat, a flash and an RGB split on each bar's downbeat. Before the drop
 * only the cuts get a hit.
 */
function beatHits(B: number, dropBeat: number, endBeat: number, cutBeats: number[], strength: number, flashes: boolean): BeatHit[] {
  const hits: BeatHit[] = [];
  for (const c of cutBeats) if (c > 0 && c < dropBeat) hits.push({ at: c * B, kind: "punch", k: 0.35 * strength });
  for (let b = dropBeat; b < endBeat; b++) {
    const k = b - dropBeat;
    if (k % 4 === 0) {
      if (flashes) hits.push({ at: b * B, kind: "flash", k: (k === 0 ? 0.95 : 0.55) * strength });
      hits.push({ at: b * B, kind: "rgb", k: (k === 0 ? 1 : 0.6) * strength });
      hits.push({ at: b * B, kind: "shake", k: (k === 0 ? 1 : 0.55) * strength });
    } else hits.push({ at: b * B, kind: "shake", k: (k % 2 === 0 ? 0.45 : 0.25) * strength });
  }
  return hits.sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
}

/** Cut start times, in beats. */
function cutBeatsOf(c: BeatCut): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const s of c.shots) { out.push(Math.round(acc)); acc += (s.hold ?? (s.to - s.from) / s.rate) / c.B; }
  return out;
}

function musicCue(beat: EditBeat, B: number, dropBeat: number, gain = 0.85): EditMusicCue {
  // The file's drop on the video's drop: both on the same beat grid.
  const offset = Math.max(0, (beat.dropBeat - dropBeat) * B);
  return { id: beat.id as EditBeatId, url: beat.url, bpm: beat.bpm, at: 0, offset, dropAt: dropBeat * B, gain };
}

export function makeColdEdit(tracksIn: GoalTrack[], styleIn: ClipStyle, moves: ClipMoves, variant: number, _opts?: EditOptions): Edit {
  const v = Math.abs(Math.floor(variant));
  let style = styleIn as ColdStyle;
  // One goal: a montage is the angles edit. Several: cold and angles become a montage.
  if (style === "montage" && tracksIn.length < 2) style = "angles";
  if ((style === "cold" || style === "angles") && tracksIn.length > 1) style = "montage";
  const tracks = style === "montage" ? tracksIn.slice(-8) : tracksIn.slice(-1);
  const pick = picker(v, tracks);
  const edit: Edit = { style, better: true, accent: "#FFFFFF", variant: v, moves, ...TALL, fps: EDIT_FPS, tracks, shots: [] };
  if (!tracks.length) return edit;
  const t = tracks[tracks.length - 1];
  const shirt = scorerShirt(t);
  const dur = trackDuration(t);
  const s = t.strikeT, g = t.goalT;

  if (style === "cold") {
    const beat = EDIT_BEATS.ice;
    const B = beatSecs(beat);
    const c = new BeatCut(B);
    const angle = pick<ClipAngle>(["follow", "follow", "spider", "tv"], "angle");
    const z = angle === "follow" ? 1 : WIDE_ZOOM[angle] ?? 1;
    const lead = pick([2.6, 3.2, 3.8], "lead");
    const start = Math.max(0, s - lead);
    const word = pick(COLD_WORDS, "word");
    // Build-up, fast; the ramp into the strike; the contact frozen and ringed.
    c.seg(0, angle, start, Math.max(start + 0.05, s - 0.45), c.beatsFor(s - 0.45 - start, 1.6, 2, 6), { fx: { zoom: { from: z, to: z, over: 0 } } });
    c.seg(0, angle, Math.max(start, s - 0.45), s + 0.02, 2, { fx: { zoom: { from: z, to: z * 1.15, over: 0.8 } } });
    c.hold(0, angle, s + 0.02, 1, { fx: cold({ spotlight: true }, { zoom: { from: z * 1.15, to: z * 1.45, over: 0.12 } }) });
    // The flight, slow: it crosses the line on the last frame — the drop.
    c.seg(0, angle, s + 0.02, g, c.beatsFor(g - s, 0.55, 1, 4), { fx: { zoom: { from: z * 1.3, to: z, over: 0.5 } } });
    const drop = c.pos;
    // The net, the word; another camera; the celebration; the name.
    const end = Math.min(dur, g + 1.4);
    c.seg(0, angle, g, end, 4, { caption: word, fx: { zoom: { from: z * 1.1, to: z, over: 0.6 } } });
    const again = pick<ClipAngle>(["net", "strike", "reverse"], "again");
    const w = closeWindow(t);
    c.seg(0, again, w.from, w.to, 4, { replay: true, fx: { ...(zoomFor(again) ? { zoom: zoomFor(again)! } : {}) } });
    // Your celebration, tight; a goal with none: the strike once more, slower still.
    const cel = celebCut(t);
    if (cel !== null) {
      c.seg(0, "tight", cel, Math.min(dur, cel + 1.6), 4, { replay: true, caption: word });
      c.hold(0, "tight", Math.min(dur, cel + 1.6), 4, { replay: true, fx: cold({ card: "end", title: (t.meta.scorerShort || t.meta.scorer).toUpperCase(), sub: "🥶" }) });
    } else {
      const sw = strikeWindow(t);
      c.seg(0, "strike", sw.from, sw.to, 4, { replay: true, caption: word });
      c.hold(0, "strike", sw.to, 4, { replay: true, fx: cold({ card: "end", title: (t.meta.scorerShort || t.meta.scorer).toUpperCase(), sub: "🥶" }) });
    }
    edit.shots = c.shots;
    edit.look = { desat: 0.92, keep: shirt, contrast: 1.3, tint: [0.92, 0.98, 1.08], grain: 0.5, letterbox: 0.085, vignette: 0.55, glow: 0, font: "cold" };
    edit.music = musicCue(beat, B, drop);
    edit.hits = beatHits(B, drop, c.pos, cutBeatsOf(c), 1, true);
    return edit;
  }

  if (style === "aura") {
    const beat = EDIT_BEATS.halo;
    const B = beatSecs(beat);
    const c = new BeatCut(B);
    const angle = pick<ClipAngle>(["follow", "tv", "follow"], "angle");
    const z = angle === "follow" ? 1 : WIDE_ZOOM[angle] ?? 1;
    const word = pick(AURA_WORDS, "word");
    // Slow from the start; the goal on the drop.
    c.seg(0, angle, Math.max(0, s - 1.8), s + 0.02, c.beatsFor(1.8, 0.6, 2, 6), { fx: { zoom: { from: z, to: z * 1.12, over: 3 } } });
    c.seg(0, angle, s + 0.02, g, c.beatsFor(g - s, 0.5, 1, 3), { fx: { zoom: { from: z * 1.12, to: z, over: 0.6 } } });
    const drop = c.pos;
    // The net, slow, the word; the strike again in super slow-mo, pushing in.
    c.seg(0, angle, g, Math.min(dur, g + 0.9), 2, { caption: word, fx: { zoom: { from: z, to: z * 1.06, over: 1.5 } } });
    const sw = strikeWindow(t);
    c.seg(0, "strike", sw.from, sw.to, c.beatsFor(sw.to - sw.from, 0.28, 2, 4), { replay: true, caption: word, fx: { zoom: { from: 1, to: 1.25, over: 3 } } });
    // Your celebration, long and slow, pushing in on him (a goal with none: the name).
    const cel = celebCut(t);
    let last = { angle: "strike" as ClipAngle, at: sw.to };
    if (cel !== null) {
      const celEnd = Math.min(dur, cel + 2.4);
      c.seg(0, "tight", cel, celEnd, c.beatsFor(celEnd - cel, 0.45, 2, 6), { replay: true, fx: { zoom: { from: 1, to: 1.3, over: 4 } } });
      last = { angle: "tight", at: celEnd };
    }
    c.hold(0, last.angle, last.at, 3, { replay: true, fx: cold({ card: "end", title: (t.meta.scorerShort || t.meta.scorer).toUpperCase(), sub: "✨ aura ✨" }) });
    edit.shots = c.shots;
    edit.look = { desat: 0.35, keep: shirt, contrast: 1.12, tint: [1.08, 1.0, 0.9], grain: 0.18, letterbox: 0.07, vignette: 0.7, glow: 0.7, font: "aura" };
    edit.music = musicCue(beat, B, drop, 0.8);
    edit.hits = beatHits(B, drop, c.pos, cutBeatsOf(c), 0.35, false).filter(h => h.kind !== "rgb");
    return edit;
  }

  if (style === "rewind") {
    const beat = EDIT_BEATS.tape;
    const B = beatSecs(beat);
    const c = new BeatCut(B);
    const angle = pick<ClipAngle>(["follow", "tv", "spider"], "angle");
    const z = angle === "follow" ? 1 : WIDE_ZOOM[angle] ?? 1;
    const lead = pick([2.4, 3.0], "lead");
    const from = Math.max(0, s - lead);
    const liveEnd = Math.min(dur, g + 0.7);
    c.seg(0, angle, from, liveEnd, c.beatsFor(liveEnd - from, 1.05, 3, 8), { fx: { zoom: { from: z, to: z, over: 0 } } });
    // Wound back on tape.
    c.seg(0, angle, Math.max(0, s - 0.8), liveEnd, 2, { rewind: true, caption: pick(REWIND_WORDS, "word"), fx: cold({ vhs: true, tag: "◀◀ REWIND" }, { zoom: { from: z, to: z, over: 0 } }) });
    // Again, slow, from another camera; the goal on the drop.
    const again = pick<ClipAngle>(["net", "strike", "reverse"], "again");
    c.seg(0, again, Math.max(0, s - 0.6), g, 4, { replay: true, fx: cold({ tag: "▶ 0.5x" }, { ...(zoomFor(again) ? { zoom: zoomFor(again)! } : {}) }) });
    const drop = c.pos;
    c.seg(0, again, g, Math.min(dur, g + 0.9), 2, { replay: true, fx: cold({ tag: "▶ 0.5x" }, { ...(zoomFor(again) ? { zoom: zoomFor(again)! } : {}), flashAt: g }) });
    c.hold(0, again, Math.min(dur, g + 0.9), 2, { replay: true, fx: cold({ spotlight: true, tag: "❚❚ PAUSE" }, { ...(zoomFor(again) ? { zoom: zoomFor(again)! } : {}) }) });
    edit.shots = c.shots;
    edit.look = { desat: 0.15, contrast: 1.08, tint: [1.04, 1.0, 0.94], grain: 0.3, letterbox: 0, vignette: 0.45, glow: 0.15, font: "tape" };
    edit.music = musicCue(beat, B, drop, 0.8);
    edit.hits = beatHits(B, drop, c.pos, cutBeatsOf(c), 0.5, false);
    return edit;
  }

  if (style === "statCard") {
    const beat = EDIT_BEATS.tape;
    const B = beatSecs(beat);
    const c = new BeatCut(B);
    const angle = pick<ClipAngle>(["follow", "tv"], "angle");
    const z = angle === "follow" ? 1 : WIDE_ZOOM[angle] ?? 1;
    const from = Math.max(0, s - pick([2.2, 2.8], "lead"));
    c.seg(0, angle, from, g, c.beatsFor(g - from, 1.0, 3, 8), { fx: { zoom: { from: z, to: z, over: 0 } } });
    const drop = c.pos;
    const { distance, speed } = goalNumbers(t);
    const [h, a] = t.meta.scoreAfter ?? [0, 0];
    const rows: [string, string][] = [
      ["DISTANCE", `${distance.toFixed(1)} m`],
      ["SHOT SPEED", `${Math.round(speed)} km/h`],
      ["FINISH", finishWord(t)],
      ...(t.meta.minute > 0 ? [["MINUTE", `${t.meta.minuteLabel}'`] as [string, string]] : []),
      ["SCORE", `${h}-${a}`],
    ];
    c.seg(0, angle, g, Math.min(dur, g + 0.5), 2, { fx: { zoom: { from: z, to: z, over: 0 }, flashAt: g } });
    // Frozen on the strike, the scorer ringed; the card builds a row a beat.
    c.hold(0, angle, s + 0.02, rows.length + 3, { fx: cold({ spotlight: true, card: "stat", rows, title: pick(STAT_TITLES, "title") }, { zoom: { from: z, to: z * 1.2, over: 0.4 } }) });
    const again = airFinish(t) ? "strike" : pick<ClipAngle>(["strike", "net"], "again");
    const w = closeWindow(t);
    c.seg(0, again, w.from, w.to, 4, { replay: true, fx: cold({ tag: `${Math.round(speed)} KM/H` }, { ...(zoomFor(again) ? { zoom: zoomFor(again)! } : {}) }) });
    edit.shots = c.shots;
    edit.look = { desat: 0.2, contrast: 1.1, tint: [1, 1, 1], grain: 0.12, letterbox: 0, vignette: 0.35, glow: 0, font: "clean" };
    edit.accent = pick(["#22D3EE", "#A3E635", "#FACC15"], "accent");
    edit.music = musicCue(beat, B, drop, 0.75);
    edit.hits = beatHits(B, drop, c.pos, cutBeatsOf(c), 0.3, false).filter(x => x.kind !== "rgb");
    return edit;
  }

  if (style === "angles") {
    const beat = EDIT_BEATS.drift;
    const B = beatSecs(beat);
    const c = new BeatCut(B);
    const cams = pick<ClipAngle[]>([["follow", "net", "strike", "spider"], ["tv", "reverse", "net", "strike"], ["spider", "strike", "net", "reverse"]], "cams");
    const word = pick(ANGLE_WORDS, "word");
    const z0 = cams[0] === "follow" ? 1 : WIDE_ZOOM[cams[0]] ?? 1;
    const from = Math.max(0, s - 2);
    c.seg(0, cams[0], from, g, c.beatsFor(g - from, 1.0, 4, 10), { caption: word, fx: cold({ tag: "CAM 1" }, { zoom: { from: z0, to: z0, over: 0 } }) });
    const drop = c.pos;
    for (let k = 1; k < 4; k++) {
      const cam = cams[k];
      const ww = { from: Math.max(0, s - 0.5), to: Math.min(dur, g + 0.35) };
      c.seg(0, cam, ww.from, ww.to, 4, { replay: true, fx: cold({ tag: `CAM ${k + 1}` }, { ...(zoomFor(cam) ? { zoom: zoomFor(cam)! } : {}) }) });
    }
    // Your celebration as the fifth camera; a goal with none ends on its name.
    const cel = celebCut(t);
    if (cel !== null) c.seg(0, "tight", cel, Math.min(dur, cel + 1.6), 4, { replay: true, fx: cold({ tag: "CAM 5" }) });
    else {
      const cam = cams[3];
      c.hold(0, cam, Math.min(dur, g + 0.35), 3, { replay: true, fx: cold({ card: "end", title: (t.meta.scorerShort || t.meta.scorer).toUpperCase(), sub: word.toUpperCase() }, zoomFor(cam) ? { zoom: zoomFor(cam)! } : {}) });
    }
    edit.shots = c.shots;
    edit.look = { desat: 0.45, keep: shirt, contrast: 1.2, tint: [0.96, 1.0, 1.04], grain: 0.3, letterbox: 0.075, vignette: 0.5, glow: 0, font: "cold" };
    edit.music = musicCue(beat, B, drop);
    edit.hits = beatHits(B, drop, c.pos, cutBeatsOf(c), 0.8, true);
    return edit;
  }

  // Montage: every goal, strike → net in a few beats.
  const beat = EDIT_BEATS.drift;
  const B = beatSecs(beat);
  const c = new BeatCut(B);
  const n = tracks.length;
  const angles = pick<ClipAngle[]>([["follow", "tv", "spider", "net"], ["tv", "follow", "net", "spider"], ["spider", "follow", "tv", "strike"]], "angles");
  const t0 = tracks[0];
  c.hold(0, angles[0], Math.max(0, t0.strikeT - 1.2), 2, { fx: cold({ card: "title", title: pick(MONTAGE_TITLES, "title"), sub: `${n} GOALS` }, zoomFor(angles[0]) ? { zoom: zoomFor(angles[0])! } : {}) });
  let drop = -1;
  tracks.forEach((tr, i) => {
    const a = angles[i % angles.length];
    const zf = zoomFor(a);
    const counter = `${i + 1}/${n}`;
    const d = trackDuration(tr);
    c.seg(i, a, Math.max(0, tr.strikeT - 1.0), tr.strikeT + 0.02, 2, { fx: cold({ counter }, zf ? { zoom: zf } : {}) });
    c.seg(i, a, tr.strikeT + 0.02, tr.goalT, c.beatsFor(tr.goalT - tr.strikeT, 0.6, 1, 3), { fx: cold({ counter }, zf ? { zoom: zf } : {}) });
    if (drop < 0) drop = c.pos;
    c.seg(i, a, tr.goalT, Math.min(d, tr.goalT + 0.8), 2, { caption: (tr.meta.scorerShort || tr.meta.scorer).toUpperCase(), fx: cold({ counter }, zf ? { zoom: zf } : {}) });
  });
  const lt = tracks[n - 1];
  c.hold(n - 1, "tight", Math.min(trackDuration(lt), lt.goalT + 1.2), 4, { replay: true, fx: cold({ card: "end", title: `${n} GOALS`, sub: (lt.meta.scorerShort || lt.meta.scorer).toUpperCase() }) });
  edit.shots = c.shots;
  edit.look = { desat: 0.6, keep: scorerShirt(lt), contrast: 1.2, tint: [0.95, 1.0, 1.06], grain: 0.3, letterbox: 0, vignette: 0.45, glow: 0, font: "cold" };
  edit.music = musicCue(beat, B, Math.max(0, drop));
  // Every goal flashes on its beat.
  const goalBeats = new Set<number>();
  let acc = 0;
  for (const sh of c.shots) {
    const tr = tracks[sh.track];
    if (sh.hold === undefined && Math.abs(sh.from - tr.goalT) < 1e-6) goalBeats.add(Math.round(acc / B));
    acc += sh.hold ?? (sh.to - sh.from) / sh.rate;
  }
  edit.hits = [
    ...beatHits(B, Math.max(0, drop), c.pos, cutBeatsOf(c), 0.7, false),
    ...Array.from(goalBeats).map(b => ({ at: b * B, kind: "flash" as const, k: 0.85 })),
  ].sort((x, y) => x.at - y.at || x.kind.localeCompare(y.kind));
  return edit;
}
