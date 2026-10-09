/**
 * THE TIMELINE — a script read at time t, with no three.js and no memory.
 *
 * Everything the director draws is worked out here from (script, t) alone:
 * which clips each actor plays and how much, where he stands and faces,
 * which shot is on and how far through, the letterbox, fades and captions.
 * So seek(t) gives the same picture whichever frame came before, and the
 * frame-by-frame filming tool can step through it.
 */
import type {
  CameraTrack, CaptionTrack, CareerContext, CastMember, ClipTrack, Cond, CutsceneScript, LetterboxTrack,
  MoveTrack, PlaceTrack, SoundTrack, StoryEvent, Target, Track, TransitionTrack, TurnTrack, Vec3,
} from "./types";
import { LOCATIONS, resolvePoint, type LocationPreset } from "./presets/locations";
import { GAIT_SPEED, defaultIdle, resolveClip } from "./presets/clips";
import { angleDiff, clamp, lerp, lerpAngle, makePath, smooth, windowWeight, yawTo, v3 } from "./math";

// ── Conditions and text ───────────────────────────────────────────────────

export interface CondContext {
  home?: boolean; trophy?: string; emotion?: string; rivalPresent?: boolean; stakes?: number; flags?: string[];
}

export function condContext(career?: CareerContext, ev?: StoryEvent): CondContext {
  return {
    home: ev?.home ?? career?.home, trophy: ev?.detail?.trophy ?? career?.trophy, emotion: ev?.emotion,
    rivalPresent: ev?.rivalPresent, stakes: ev?.stakes, flags: [...(career?.flags ?? []), ...(ev?.night ? ["night"] : [])],
  };
}

export function testCond(c: Cond | undefined, x: CondContext): boolean {
  if (!c) return true;
  if (c.home !== undefined && !!x.home !== c.home) return false;
  if (c.trophy !== undefined && !(Array.isArray(c.trophy) ? c.trophy : [c.trophy]).includes(x.trophy ?? "")) return false;
  if (c.emotion !== undefined && !(Array.isArray(c.emotion) ? c.emotion : [c.emotion]).includes(x.emotion ?? "")) return false;
  if (c.rivalPresent !== undefined && !!x.rivalPresent !== c.rivalPresent) return false;
  if (c.minStakes !== undefined && (x.stakes ?? 0.5) < c.minStakes) return false;
  if (c.maxStakes !== undefined && (x.stakes ?? 0.5) > c.maxStakes) return false;
  if (c.flag !== undefined && !(x.flags ?? []).includes(c.flag)) return false;
  if (c.not && testCond(c.not, x)) return false;
  return true;
}

/** {club}, {player}, {opponent} … filled from the career. */
export function fillText(s: string, career?: CareerContext): string {
  const v: Record<string, string> = {
    club: career?.club?.name ?? "the club", short: career?.club?.short ?? career?.club?.name ?? "the club",
    player: career?.player?.name ?? "the new signing", surname: career?.player?.surname ?? career?.player?.name?.split(" ").slice(-1)[0] ?? "",
    number: String(career?.player?.number ?? 9), opponent: career?.opponent?.name ?? "them",
    manager: career?.manager?.name ?? "the manager", season: String(career?.season ?? 1),
  };
  return s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
}

// ── Compiling (conditions applied, tracks sorted and indexed) ─────────────

export interface Compiled {
  script: CutsceneScript;
  loc: LocationPreset;
  cast: CastMember[];
  tracks: Track[];
  byActor: Map<string, Track[]>;
  cameras: CameraTrack[];
  career?: CareerContext;
}

export function compileScript(script: CutsceneScript, career?: CareerContext, ev?: StoryEvent): Compiled {
  const x = condContext(career, ev ?? script.source?.event);
  const loc = LOCATIONS[script.set.location];
  const cast = script.cast.filter((c) => testCond(c.when, x));
  const ids = new Set(cast.map((c) => c.id));
  const tracks = script.tracks
    .filter((t) => testCond(t.when, x))
    .filter((t) => !("actor" in t) || ids.has((t as { actor: string }).actor))
    .map((t) => (t.type === "caption" ? { ...t, text: fillText(t.text, career) } : t))
    .sort((a, b) => a.at - b.at);
  const byActor = new Map<string, Track[]>();
  for (const id of Array.from(ids)) byActor.set(id, []);
  for (const t of tracks) if ("actor" in t) byActor.get((t as { actor: string }).actor)?.push(t);
  const cameras = tracks.filter((t): t is CameraTrack => t.type === "camera");
  return { script, loc, cast, tracks, byActor, cameras, career };
}

// ── Where each actor stands (analytic: no posing needed) ─────────────────

export interface RootState {
  pos: Vec3; yaw: number;
  /** A move under way: the gait clip, its time, how much (0..1). */
  gait?: { clip: string; time: number; weight: number; speed: number };
}

const moveCache = new WeakMap<MoveTrack, { path: ReturnType<typeof makePath>; pts: Vec3[] }>();

function castOf(c: Compiled, id: string) { return c.cast.find((m) => m.id === id); }

function initialRoot(c: Compiled, id: string, depth: number): RootState {
  const m = castOf(c, id);
  const loc = c.loc;
  let pos: Vec3 = [0, 0, 0], yaw = 0;
  if (m?.mark !== undefined) {
    pos = resolvePoint(loc, m.mark);
    if (typeof m.mark === "string") yaw = loc.marks[m.mark]?.yaw ?? 0;
  }
  if (typeof m?.face === "number") yaw = (m.face * Math.PI) / 180;
  else if (typeof m?.face === "string") {
    const tp = loc.marks[m.face]?.pos ?? (depth < 2 && castOf(c, m.face) ? rootAt(c, m.face, 0, depth + 1).pos : null);
    if (tp) yaw = yawTo(pos, tp);
  }
  return { pos: [...pos] as Vec3, yaw };
}

/** A target's rough place on the floor plan at time t (actors: their root; props: where they rest). */
export function targetRootPoint(c: Compiled, tg: Target, t: number, depth = 0): Vec3 | null {
  if ("actor" in tg) return depth < 3 ? v3.add(rootAt(c, tg.actor, t, depth + 1).pos, [0, 1.5, 0]) : null;
  if ("mark" in tg) { const p = c.loc.marks[tg.mark]?.pos; return p ? [p[0], p[1] + (tg.y ?? 0), p[2]] : null; }
  if ("point" in tg) return tg.point;
  if ("prop" in tg) {
    const ps = c.script.props?.find((p) => p.id === tg.prop);
    if (ps?.at !== undefined) return resolvePoint(c.loc, ps.at);
    return null;
  }
  return null;
}

function facingYaw(c: Compiled, from: Vec3, f: number | Target, t: number, depth: number, fallback: number): number {
  if (typeof f === "number") return (f * Math.PI) / 180;
  const p = targetRootPoint(c, f, t, depth);
  return p ? yawTo(from, p) : fallback;
}

export function rootAt(c: Compiled, id: string, t: number, depth = 0): RootState {
  const st = initialRoot(c, id, depth);
  const tracks = c.byActor.get(id) ?? [];
  let gait: RootState["gait"];
  for (const tr of tracks) {
    if (tr.at > t) break;
    if (tr.type === "place") {
      const p = tr as PlaceTrack;
      st.pos = [...resolvePoint(c.loc, p.to)] as Vec3;
      if (typeof p.to === "string" && p.yaw === undefined) st.yaw = c.loc.marks[p.to]?.yaw ?? st.yaw;
      if (p.yaw !== undefined) st.yaw = facingYaw(c, st.pos, p.yaw, t, depth, st.yaw);
    } else if (tr.type === "turn") {
      const tt = tr as TurnTrack;
      const want = facingYaw(c, st.pos, tt.to, t, depth, st.yaw);
      st.yaw = lerpAngle(st.yaw, want, smooth((t - tt.at) / Math.max(1e-3, tt.dur)));
    } else if (tr.type === "move") {
      const mv = tr as MoveTrack;
      let cache = moveCache.get(mv);
      const start = mv.from !== undefined ? resolvePoint(c.loc, mv.from) : st.pos;
      if (!cache || cache.pts[0][0] !== start[0] || cache.pts[0][2] !== start[2]) {
        const pts = [start, ...mv.path.map((p) => resolvePoint(c.loc, p))];
        cache = { path: makePath(pts), pts };
        moveCache.set(mv, cache);
      }
      const { path } = cache;
      const s = clamp((t - mv.at) / Math.max(1e-3, mv.dur));
      const e = mv.ease ?? 0.35;
      const u = lerp(s, smooth(s), e);
      st.pos = path.at(u);
      // speed (m/s) now: d(u)/dt * length
      const du = (1 - e) + e * 6 * s * (1 - s);
      const speed = (path.length / Math.max(1e-3, mv.dur)) * du;
      const pathYaw = (() => { const d = path.dir(Math.min(0.995, u)); return Math.atan2(d[0], d[2]); })();
      const startYaw = st.yaw;
      let want = pathYaw;
      if (mv.facing !== undefined && mv.facing !== "path") want = facingYaw(c, st.pos, mv.facing, t, depth, pathYaw);
      // turn into the path over the first 0.4 s, not at once
      const turnK = smooth((t - mv.at) / 0.4);
      st.yaw = s >= 1 ? want : lerpAngle(startYaw, want, turnK);
      if (t <= mv.at + mv.dur && path.length > 0.05 && mv.gait !== "none") {
        const g = mv.gait ?? (path.length / mv.dur > 2.4 ? "jog" : "walk");
        const nat = GAIT_SPEED[g] ?? 1.3;
        const w = windowWeight(t, mv.at, mv.at + mv.dur, 0.2, 0.3);
        gait = { clip: g, time: (path.length * u) / nat, weight: w, speed };
      } else gait = undefined;
    }
  }
  return gait ? { ...st, gait } : st;
}

// ── Which clips, how much ────────────────────────────────────────────────

export interface ClipSample { entries: [string, number, number][]; upright: number }

/** The clip time of a clip track at t (aliases resolved by `choose`). */
function clipTime(tr: ClipTrack, t: number, dur: number, from?: number, speedK = 1, holdC?: number): number {
  const hold = tr.hold ?? holdC;
  if (hold !== undefined) return clamp(hold, 0, Math.max(0, dur - 1e-3));
  const sp = speedK < 0 ? -Math.abs((tr.speed ?? 1) * speedK) : (tr.speed ?? 1) * speedK;
  let tt = (tr.from ?? from ?? 0) + (t - tr.at) * sp;
  if (tr.loop) tt = ((tt % dur) + dur) % dur;
  else tt = clamp(tt, 0, Math.max(0, dur - 1e-3));
  return tt;
}

/**
 * Body clips for an actor at t: [real clip, time, weight][]. `has` / `dur`
 * describe the body (which clips it has, how long each is).
 */
export function clipsAt(c: Compiled, id: string, t: number, has: (n: string) => boolean, dur: (n: string) => number, role: string, body: string): ClipSample {
  const tracks = (c.byActor.get(id) ?? []).filter((x): x is ClipTrack => x.type === "clip");
  const out = new Map<string, [number, number]>();
  let upright = 0;
  const add = (name: string, time: number, w: number, up = 0) => {
    if (w <= 1e-4) return;
    const cur = out.get(name);
    out.set(name, cur ? [cur[0], cur[1] + w] : [time, w]);
    upright += up * w;
  };
  const sample = (tr: ClipTrack | null, w: number) => {
    if (!tr) {
      const ch = resolveClip(defaultIdle(role, body), has);
      if (ch) add(ch.clip, ((t * (ch.speed ?? 1)) % Math.max(0.1, dur(ch.clip)) + dur(ch.clip)) % Math.max(0.1, dur(ch.clip)), w, ch.upright ?? 0);
      return;
    }
    const ch = resolveClip(tr.clip, has);
    if (!ch) return;
    add(ch.clip, clipTime(tr, t, dur(ch.clip), ch.from, ch.speed ?? 1, ch.hold), w, ch.upright ?? 0);
  };
  let i = -1;
  for (let j = 0; j < tracks.length; j++) if (tracks[j].at <= t) i = j;
  if (i < 0) sample(null, 1);
  else {
    const cur = tracks[i];
    const end = cur.dur !== undefined ? cur.at + cur.dur : Infinity;
    // the clip that was on before this one (still running, or idle)
    const prevOf = (k: number): ClipTrack | null => {
      for (let j = k - 1; j >= 0; j--) {
        const p = tracks[j];
        const pe = p.dur !== undefined ? p.at + p.dur : Infinity;
        if (pe >= tracks[k].at) return p;
      }
      return null;
    };
    if (t > end) {
      const out2 = cur.blendOut ?? 0.3;
      const k = out2 > 0 ? smooth((t - end) / out2) : 1;
      sample(cur, 1 - k);
      // after it ends: whatever was under it, or idle
      sample(prevOfEnded(tracks, i, t), k);
    } else {
      const bi = cur.blendIn ?? 0.25;
      const k = bi > 0 ? smooth((t - cur.at) / bi) : 1;
      sample(cur, k);
      if (k < 1) sample(prevOf(i), 1 - k);
    }
  }
  // a move's gait over the top
  const r = rootAt(c, id, t);
  let entries = Array.from(out.entries()).map(([n, [time, w]]) => [n, time, w] as [string, number, number]);
  if (r.gait && r.gait.weight > 0) {
    const ch = resolveClip(r.gait.clip, has);
    if (ch) {
      const d = Math.max(0.1, dur(ch.clip));
      const time = ((r.gait.time * (ch.speed ?? 1)) % d + d) % d;
      const gw = r.gait.weight;
      entries = entries.map(([n, tt, w]) => [n, tt, w * (1 - gw)] as [string, number, number]);
      upright = upright * (1 - gw) + (ch.upright ?? 0) * gw;
      const same = entries.find((e) => e[0] === ch.clip);
      if (same) { same[1] = time; same[2] += gw; } else entries.push([ch.clip, time, gw]);
    }
  }
  const tot = entries.reduce((s, e) => s + e[2], 0) || 1;
  return { entries: entries.filter((e) => e[2] > 1e-4).map(([n, tt, w]) => [n, tt, w / tot]), upright: upright / tot };
}

function prevOfEnded(tracks: ClipTrack[], i: number, t: number): ClipTrack | null {
  for (let j = i - 1; j >= 0; j--) {
    const p = tracks[j];
    const pe = p.dur !== undefined ? p.at + p.dur : Infinity;
    if (pe >= t && p.loop) return p;
  }
  return null;
}

// ── Windows (poses, reaches, looks, faces, fx …) ─────────────────────────

export function trackWeight(tr: { at: number; dur?: number; blendIn?: number; blendOut?: number }, t: number, defIn = 0.3, defOut = 0.3): number {
  const end = tr.at + (tr.dur ?? Infinity);
  return windowWeight(t, tr.at, end, tr.blendIn ?? defIn, tr.blendOut ?? defOut);
}

// ── The camera ───────────────────────────────────────────────────────────

export interface CameraSample {
  cur: CameraTrack; index: number; k: number;
  /** A blend from the shot before (cut "blend"/"whip"). */
  prev?: { track: CameraTrack; k: number; mix: number };
}

export function cameraAt(c: Compiled, t: number): CameraSample | null {
  const cams = c.cameras;
  if (!cams.length) return null;
  let i = 0;
  for (let j = 0; j < cams.length; j++) if (cams[j].at <= t) i = j;
  const cur = cams[i];
  const k = clamp((t - cur.at) / Math.max(1e-3, cur.dur));
  if (i > 0 && (cur.cut === "blend" || cur.cut === "whip")) {
    const b = cur.cut === "whip" ? cur.blend ?? 0.18 : cur.blend ?? 0.8;
    if (t < cur.at + b) {
      const p = cams[i - 1];
      return { cur, index: i, k, prev: { track: p, k: clamp((t - p.at) / Math.max(1e-3, p.dur), 0, 1.4), mix: (t - cur.at) / b } };
    }
  }
  return { cur, index: i, k };
}

// ── The frame's dressing (letterbox, fades, captions, sounds) ────────────

export interface Overlay { letterbox: number; fade: number; fadeColor: string; captions: CaptionTrack[]; shot: string }

export function overlayAt(c: Compiled, t: number): Overlay {
  let lb = 0;
  const lbs = c.tracks.filter((x): x is LetterboxTrack => x.type === "letterbox");
  let prevAmt = 0;
  for (const l of lbs) {
    if (l.at > t) break;
    const k = l.dur ? smooth((t - l.at) / l.dur) : 1;
    lb = lerp(prevAmt, l.amount, k);
    prevAmt = l.amount;
  }
  let fade = 0, fadeColor = "#000000";
  for (const tr of c.tracks) {
    if (tr.type !== "transition") continue;
    const x = tr as TransitionTrack;
    if (t < x.at) continue;
    const s = clamp((t - x.at) / Math.max(1e-3, x.dur));
    const done = t > x.at + x.dur;
    let a = 0;
    if (x.kind === "fade-in") a = done ? 0 : 1 - smooth(s);
    else if (x.kind === "fade-out") a = smooth(s);
    else if (x.kind === "dip-black" || x.kind === "dip-white") a = done ? 0 : Math.sin(s * Math.PI);
    else if (x.kind === "flash") a = done ? 0 : 1 - s;
    if (a > fade) { fade = a; fadeColor = x.color ?? (x.kind === "dip-white" || x.kind === "flash" ? "#ffffff" : "#000000"); }
  }
  const captions = c.tracks.filter((x): x is CaptionTrack => x.type === "caption" && t >= x.at && t <= x.at + x.dur);
  const cam = cameraAt(c, t);
  return { letterbox: lb, fade, fadeColor, captions, shot: cam?.cur.name ?? cam?.cur.shot.preset ?? "" };
}

export function soundsBetween(c: Compiled, t0: number, t1: number): SoundTrack[] {
  return c.tracks.filter((x): x is SoundTrack => x.type === "sound" && x.at > t0 && x.at <= t1);
}

/** Check a script for mistakes a person would see (a clip asked of nobody, a prop used before it exists …). */
export function lintScript(s: CutsceneScript): string[] {
  const out: string[] = [];
  const loc = LOCATIONS[s.set.location];
  if (!loc) { out.push(`unknown location ${s.set.location}`); return out; }
  const ids = new Set(s.cast.map((m) => m.id));
  const props = new Set((s.props ?? []).map((p) => p.id));
  const markOk = (p: string | Vec3 | undefined) => p === undefined || typeof p !== "string" || !!loc.marks[p];
  for (const m of s.cast) if (!markOk(m.mark)) out.push(`${m.id}: no mark ${m.mark}`);
  for (const p of s.props ?? []) if (!markOk(p.at)) out.push(`prop ${p.id}: no mark ${p.at}`);
  const tgt = (tg: Target, where: string) => {
    if ("actor" in tg && !ids.has(tg.actor)) out.push(`${where}: no actor ${tg.actor}`);
    if ("prop" in tg && !props.has(tg.prop)) out.push(`${where}: no prop ${tg.prop}`);
    if ("mark" in tg && !loc.marks[tg.mark]) out.push(`${where}: no mark ${tg.mark}`);
  };
  for (const tr of s.tracks) {
    const w = `${tr.type}@${tr.at.toFixed(2)}`;
    if ("actor" in tr && !ids.has((tr as { actor: string }).actor)) out.push(`${w}: no actor ${(tr as { actor: string }).actor}`);
    if (tr.at < 0 || tr.at > s.duration + 0.01) out.push(`${w}: outside the scene (0..${s.duration})`);
    if (tr.type === "move") for (const p of tr.path) if (!markOk(p)) out.push(`${w}: no mark ${p}`);
    if (tr.type === "place" && !markOk(tr.to)) out.push(`${w}: no mark ${tr.to}`);
    if (tr.type === "reach" || tr.type === "look") tgt(tr.target, w);
    if (tr.type === "camera") { tgt(tr.shot.subject, w); if (tr.shot.subject2) tgt(tr.shot.subject2, w); }
    if (tr.type === "prop" && !props.has(tr.prop)) out.push(`${w}: no prop ${tr.prop}`);
    if (tr.type === "trace" && (!props.has(tr.tool) || !props.has(tr.along.prop))) out.push(`${w}: trace needs props ${tr.tool} and ${tr.along.prop}`);
  }
  const cams = s.tracks.filter((x) => x.type === "camera").sort((a, b) => a.at - b.at);
  if (!cams.length) out.push("no camera shots");
  else if (cams[0].at > 0.01) out.push("nothing on camera before the first shot");
  return out;
}

/** Where a camera's subject faces (for the 180° rule). Exported for cinema.ts. */
export const facingDiff = angleDiff;
