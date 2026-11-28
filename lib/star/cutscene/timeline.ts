/**
 * THE TIMELINE — a script read at time t, with no three.js and no memory.
 *
 * Everything the director draws is worked out here from (script, t) alone:
 * which clips each actor plays and how much, where he stands and faces,
 * which shot is on and how far through, the letterbox, fades and captions.
 * So seek(t) gives the same picture whichever frame came before, and the
 * frame-by-frame filming tool can step through it.
 */
import { ownMotion, type OwnMotion } from "../people/life";
import type {
  CameraTrack, CaptionTrack, CareerContext, CastMember, ClipTrack, Cond, CutsceneScript, LetterboxTrack,
  MoveTrack, PlaceTrack, SoundTrack, StoryEvent, Target, Track, TransitionTrack, TurnTrack, Vec3,
} from "./types";
import { LOCATIONS, resolvePoint, type LocationPreset } from "./presets/locations";
import { GAIT_SPEED, defaultIdle, resolveClip, type ClipChoice } from "./presets/clips";
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
  /** No spacing pass: every man exactly where the script puts him (tests, and the before/after films). */
  noCrowd?: boolean;
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

/** How much of his own pace (people/life.ts, +-12%) a cut-scene walk takes, and of his surge (+-10%). */
export const WALK_PACE = { shift: 0.35, surge: 0.7 };

function rootAtRaw(c: Compiled, id: string, t: number, depth = 0): RootState {
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
      const s0 = clamp((t - mv.at) / Math.max(1e-3, mv.dur));
      // HIS OWN PACE (Harry: "22 players walking at the same pace in the same time"): on a walk of any length a
      // brisker man (people/life.ts pace, 12% either way) draws ahead in the middle and a slower one drops back;
      // every man still starts and arrives where and when the script says.
      // (and over the walk he surges and eases off a little on his own rhythm, so two men who happen to share a
      // cadence still drift in and out of step)
      // LIGHTER (28 Nov 2026, Harry: "seems a bit heavy for some"): the pace shift was (pace - 1) x 0.9 and the
      // surge +-10%, so a slow man set off 22% under the scene's speed and his legs, stepping at the clip's own
      // length, slowed to 1.3 to 1.6 steps a second: a plod. Now +-8% at either end and a +-4% surge (each man still
      // draws ahead or drops back up to 4% of the walk, and the spacing pass below keeps him off the man ahead).
      const own0 = ownMotion(id);
      const pw = mv.gait !== "none" && path.length > 0.8 ? (own0.pace - 1) * WALK_PACE.shift : 0;
      const sv = pw ? own0.surge * WALK_PACE.surge : 0;
      const s = clamp(s0 + pw * 2 * s0 * (1 - s0) + (sv / (2 * Math.PI)) * Math.sin(2 * Math.PI * s0));
      const e = mv.ease ?? 0.35;
      const u = lerp(s, smooth(s), e);
      st.pos = path.at(u);
      // speed (m/s) now: d(u)/dt * length
      const du = ((1 - e) + e * 6 * s * (1 - s)) * (1 + pw * 2 * (1 - 2 * s0) + sv * Math.cos(2 * Math.PI * s0));
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

// ── Walking together: nobody walks through anybody ───────────────────────

/**
 * ROOM TO WALK (28 Nov 2026, Harry on the 22-man walk-out: "players walking through each other on the cut scene").
 * With each man on his own pace and surge, a brisker man caught the man ahead and walked through him. Every group
 * walk (two or more men on a walk at the same time, the same way, within a few metres) is now walked once, ahead of
 * time, in small steps (1/60 s), from the script alone, so seek(t) still gives the same picture from any frame:
 *   - each man aims for where the script puts him (his path, his start and his arrival), at its speed, and makes up
 *     ground gently if he fell behind (up to 25% quicker, never more than CROWD.catchUp m/s);
 *   - closing on the man ahead, he eases off so he keeps CROWD.gap behind him, and a step to the side (at most
 *     CROWD.aside) while he is held up; side by side, two men keep CROWD.side between them; men who have stopped
 *     stand CROWD.stand apart in a line;
 *   - and on every step, whatever the speeds, no two men are nearer than CROWD.gapMin front to back or CROWD.side
 *     side by side (the man behind gives way).
 * His legs follow the ground he really covers (the stride clock is the distance walked), so a man who waits stands.
 * Runs, sprints and celebrations are left alone (men run into each other on purpose), and so is anyone not walking.
 */
export const CROWD = { gap: 0.85, gapMin: 0.7, stand: 0.75, side: 0.55, aside: 0.22, catchUp: 1.45, dt: 1 / 60 };
const WALKING = new Set(["walk", "walk-proud", "walk-sad", "walk-confident", "walk_relaxed", "walk_formal", "walk_confident", "slump_walk"]);

interface CrowdSim {
  ids: string[]; t0: number; n: number;
  x: Float32Array[]; z: Float32Array[]; w: Float32Array[]; v: Float32Array[]; turn: Float32Array[];
  /** the walk clip each man is on at each step ("" = none) */
  clip: string[][];
  /** where he ended against where the script leaves him (kept after the walk, if he never got there) */
  off: [number, number][];
}
const crowdCache = new WeakMap<Compiled, CrowdSim | null>();
let crowdBuilding = false;

function walkMovesOf(c: Compiled, id: string): MoveTrack[] {
  return (c.byActor.get(id) ?? []).filter((t): t is MoveTrack => {
    if (t.type !== "move") return false;
    const mv = t as MoveTrack;
    if (mv.gait === "none") return false;
    const pts = mv.path.map((p) => resolvePoint(c.loc, p));
    let len = 0; for (let i = 1; i < pts.length; i++) len += v3.dist(pts[i - 1], pts[i]);
    const g = mv.gait ?? (len / Math.max(0.1, mv.dur) > 2.4 ? "jog" : "walk");
    return WALKING.has(g) && mv.dur > 0.3;
  });
}

/** The group walks of a script, walked once (null: nobody walks with anybody). */
export function crowdOf(c: Compiled): CrowdSim | null {
  if (c.noCrowd || crowdOff()) return null;
  const hit = crowdCache.get(c);
  if (hit !== undefined) return hit;
  crowdBuilding = true;
  let sim: CrowdSim | null = null;
  try { sim = buildCrowd(c); } finally { crowdBuilding = false; }
  crowdCache.set(c, sim);
  return sim;
}

function buildCrowd(c: Compiled): CrowdSim | null {
  const moves = new Map<string, MoveTrack[]>();
  for (const m of c.cast) { const w = walkMovesOf(c, m.id); if (w.length) moves.set(m.id, w); }
  const ids0 = Array.from(moves.keys());
  if (ids0.length < 2) return null;
  // who walks with whom: overlapping in time, the same way, within 2.5 m at some moment
  const dirOf = (id: string, mv: MoveTrack): [number, number] => {
    const a = rootAtRaw(c, id, mv.at), b = rootAtRaw(c, id, mv.at + mv.dur);
    const dx = b.pos[0] - a.pos[0], dz = b.pos[2] - a.pos[2], l = Math.hypot(dx, dz);
    return l < 1e-3 ? [0, 0] : [dx / l, dz / l];
  };
  const parent = new Map(ids0.map((id) => [id, id]));
  const find = (a: string): string => { while (parent.get(a) !== a) a = parent.get(a)!; return a; };
  const joined = new Set<string>();
  for (let i = 0; i < ids0.length; i++) for (let j = i + 1; j < ids0.length; j++) {
    const A = ids0[i], B = ids0[j];
    let together = false;
    for (const ma of moves.get(A)!) for (const mb of moves.get(B)!) {
      const s = Math.max(ma.at, mb.at), e = Math.min(ma.at + ma.dur, mb.at + mb.dur);
      if (e - s < 0.3) continue;
      const da = dirOf(A, ma), db = dirOf(B, mb);
      if (da[0] * db[0] + da[1] * db[1] < 0.6) continue;
      for (let t = s; t <= e + 1e-6; t += 0.25) { const pa = rootAtRaw(c, A, t).pos, pb = rootAtRaw(c, B, t).pos; if (Math.hypot(pa[0] - pb[0], pa[2] - pb[2]) < 2.5) { together = true; break; } }
      if (together) break;
    }
    if (together) { parent.set(find(A), find(B)); joined.add(A); joined.add(B); }
  }
  const ids = ids0.filter((id) => joined.has(id));
  if (ids.length < 2) return null;
  const all = ids.flatMap((id) => moves.get(id)!);
  const t0 = Math.min(...all.map((m) => m.at));
  const tEnd = Math.max(...all.map((m) => m.at + m.dur));
  const dt = CROWD.dt;
  const nMax = Math.ceil((tEnd + 6 - t0) / dt) + 1;
  const K = ids.length;
  // the script's own places (raw), every step
  const rx = ids.map(() => new Float32Array(nMax)), rz = ids.map(() => new Float32Array(nMax)), ryaw = ids.map(() => new Float32Array(nMax));
  const rclip: string[][] = ids.map(() => new Array(nMax).fill(""));
  ids.forEach((id, i) => {
    for (let k = 0; k < nMax; k++) {
      const r = rootAtRaw(c, id, t0 + k * dt);
      rx[i][k] = r.pos[0]; rz[i][k] = r.pos[2]; ryaw[i][k] = r.yaw; rclip[i][k] = r.gait && r.gait.weight > 0 ? r.gait.clip : "";
    }
  });
  const x = ids.map((_, i) => new Float32Array(nMax)), z = ids.map(() => new Float32Array(nMax)), w = ids.map(() => new Float32Array(nMax));
  const v = ids.map(() => new Float32Array(nMax)), turn = ids.map(() => new Float32Array(nMax));
  const clip: string[][] = ids.map(() => new Array(nMax).fill(""));
  const vx = new Float64Array(K), vz = new Float64Array(K);
  const lastClip = ids.map(() => "walk");
  ids.forEach((_, i) => { x[i][0] = rx[i][0]; z[i][0] = rz[i][0]; });
  const bias = ids.map((id) => ((hashSide(id) & 1) ? 1 : -1));
  const breath = ids.map((id) => [3 + ((hashSide(id) >>> 3) % 1000) / 333, ((hashSide(id) >>> 13) % 628) / 100] as [number, number]);
  let n = nMax;
  for (let k = 0; k < nMax - 1; k++) {
    const nx = new Float64Array(K), nz = new Float64Array(K);
    for (let i = 0; i < K; i++) {
      const px = x[i][k], pz = z[i][k];
      const vrx = (rx[i][k + 1] - rx[i][k]) / dt, vrz = (rz[i][k + 1] - rz[i][k]) / dt;
      const vr = Math.hypot(vrx, vrz);
      const ex = rx[i][k + 1] - px, ez = rz[i][k + 1] - pz, err = Math.hypot(ex, ez);
      // aim: the script's own speed, plus a gentle catch-up
      let dx = vrx + ex * 1.5, dz = vrz + ez * 1.5;
      const cap = Math.max(vr * 1.15, Math.min(CROWD.catchUp, err * 1.5));
      const dl = Math.hypot(dx, dz);
      if (dl > cap) { dx *= cap / dl; dz *= cap / dl; }
      // his way forward
      let fx = dx, fz = dz; const fl = Math.hypot(fx, fz);
      if (fl > 1e-4) { fx /= fl; fz /= fl; } else { fx = Math.sin(ryaw[i][k]); fz = Math.cos(ryaw[i][k]); }
      let along = dx * fx + dz * fz;
      let lat = 0;
      for (let j = 0; j < K; j++) {
        if (j === i) continue;
        const ox = x[j][k] - px, oz = z[j][k] - pz;
        const a = ox * fx + oz * fz, l = ox * -fz + oz * fx; // ahead, and to his left (+)
        if (a <= 0 || Math.abs(l) > CROWD.side + 0.15) continue;
        // the man ahead: keep CROWD.gap behind him, closing no quicker than he goes
        const va = vx[j] * fx + vz[j] * fz;
        // (the gap breathes a little, each man on his own slow rhythm: a line that keeps one speed marches in step)
        // (and standing in a line, as men stop at the end of a walk, they stand closer: CROWD.stand)
        const gapWalk = CROWD.gap + 0.12 * Math.sin((2 * Math.PI * (t0 + k * dt)) / breath[i][0] + breath[i][1]);
        const gapNow = CROWD.stand + (gapWalk - CROWD.stand) * clamp(va / 0.6);
        const lim = Math.max(0, va + (a - gapNow) * 2.5);
        const held = along - lim;
        if (along > lim) along = lim;
        // held up while the script still has him walking on: a step to the side, away from the man ahead (his own
        // side if square behind)
        if (held > 0.15 && vr > 0.3 && a < CROWD.gap + 0.5 && Math.abs(l) < CROWD.side) {
          const sgn = Math.abs(l) > 0.04 ? -Math.sign(l) : bias[i];
          lat += sgn * 0.35 * (1 - Math.max(0, a - CROWD.gapMin) / (CROWD.gap + 0.5 - CROWD.gapMin));
        }
      }
      // never more than CROWD.aside off the script's line
      const offL = (px - rx[i][k]) * -fz + (pz - rz[i][k]) * fx;
      if (lat === 0) lat = Math.max(-0.4, Math.min(0.4, -offL * 1.5));
      if (offL + lat * dt > CROWD.aside) lat = Math.min(lat, (CROWD.aside - offL) / dt);
      if (offL + lat * dt < -CROWD.aside) lat = Math.max(lat, (-CROWD.aside - offL) / dt);
      let wx = fx * along - fz * lat, wz = fz * along + fx * lat;
      // no sudden starts or stops (2.5 m/s/s)
      const ax2 = wx - vx[i], az2 = wz - vz[i], al = Math.hypot(ax2, az2), amax = 2.5 * dt;
      if (al > amax) { wx = vx[i] + (ax2 * amax) / al; wz = vz[i] + (az2 * amax) / al; }
      nx[i] = px + wx * dt; nz[i] = pz + wz * dt;
    }
    // nobody inside anybody: the man behind gives way (three passes)
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      if (i === j) continue;
      const ox = nx[j] - nx[i], oz = nz[j] - nz[i];
      const sp = Math.hypot(nx[i] - x[i][k], nz[i] - z[i][k]) / dt;
      let fx = nx[i] - x[i][k], fz = nz[i] - z[i][k];
      const fl = Math.hypot(fx, fz);
      if (fl > 1e-5) { fx /= fl; fz /= fl; } else { fx = Math.sin(ryaw[i][k]); fz = Math.cos(ryaw[i][k]); }
      const a = ox * fx + oz * fz, l = ox * -fz + oz * fx;
      if (a > 0 && Math.abs(l) < CROWD.side && a < CROWD.gapMin && sp > 1e-3) {
        const back = CROWD.gapMin - a;
        nx[i] -= fx * back; nz[i] -= fz * back;
      } else {
        const d = Math.hypot(ox, oz);
        if (d < CROWD.side && d > 1e-6) { const p = (CROWD.side - d) / 2; nx[i] -= (ox / d) * p; nz[i] -= (oz / d) * p; nx[j] += (ox / d) * p; nz[j] += (oz / d) * p; }
      }
    }
    for (let i = 0; i < K; i++) {
      const ux = nx[i] - x[i][k], uz = nz[i] - z[i][k], d = Math.hypot(ux, uz);
      vx[i] = ux / dt; vz[i] = uz / dt;
      x[i][k + 1] = nx[i]; z[i][k + 1] = nz[i];
      w[i][k + 1] = w[i][k] + d; v[i][k + 1] = d / dt;
      if (rclip[i][k + 1]) lastClip[i] = rclip[i][k + 1];
      clip[i][k + 1] = d / dt > 0.04 || rclip[i][k + 1] ? lastClip[i] : "";
      // facing: the script's, turned a little towards where he really steps (a step aside)
      const want = d / dt > 0.15 ? angleDiff(Math.atan2(ux, uz), ryaw[i][k + 1]) : 0;
      turn[i][k + 1] = turn[i][k] + (clamp(want, -0.35, 0.35) - turn[i][k]) * Math.min(1, dt * 6);
    }
    // all there (and the script is done with them): stop
    if (t0 + (k + 1) * dt > tEnd + 0.5 && ids.every((_, i) => Math.hypot(x[i][k + 1] - rx[i][k + 1], z[i][k + 1] - rz[i][k + 1]) < 0.01 && v[i][k + 1] < 0.01)) { n = k + 2; break; }
  }
  const off = ids.map((_, i) => [x[i][n - 1] - rx[i][n - 1], z[i][n - 1] - rz[i][n - 1]] as [number, number]);
  return { ids, t0, n, x, z, w, v, turn, clip, off };
}

/** ?spacing=0 on the bench (SPACING=0 in node): the old walk, men through each other (before/after films). */
function crowdOff(): boolean {
  try {
    if (typeof window === "undefined") return typeof process !== "undefined" && process.env?.SPACING === "0";
    return new URLSearchParams(window.location.search).get("spacing") === "0";
  } catch { return false; }
}

function hashSide(id: string): number { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return h >>> 0; }

export function rootAt(c: Compiled, id: string, t: number, depth = 0): RootState {
  const raw = rootAtRaw(c, id, t, depth);
  if (crowdBuilding) return raw;
  const sim = crowdOf(c);
  const i = sim ? sim.ids.indexOf(id) : -1;
  if (!sim || i < 0 || t < sim.t0) return raw;
  const f = (t - sim.t0) / CROWD.dt;
  if (f >= sim.n - 1) {
    const [ox, oz] = sim.off[i];
    return Math.abs(ox) + Math.abs(oz) < 1e-3 ? raw : { ...raw, pos: [raw.pos[0] + ox, raw.pos[1], raw.pos[2] + oz] };
  }
  const k = Math.floor(f), u = f - k;
  const L = (a: Float32Array) => a[k] + (a[k + 1] - a[k]) * u;
  const pos: Vec3 = [L(sim.x[i]), raw.pos[1], L(sim.z[i])];
  const yaw = raw.yaw + L(sim.turn[i]);
  const speed = L(sim.v[i]);
  const name = sim.clip[i][k + 1] || sim.clip[i][k];
  let gait: RootState["gait"];
  if (name) {
    const clipName = raw.gait?.clip ?? name;
    const nat = GAIT_SPEED[clipName] ?? 1.3;
    // his legs walk the ground he covers: a man held up stands, a man making up ground walks on
    const base = raw.gait ? raw.gait.weight : 1;
    const weight = Math.min(base, clamp(speed / 0.35));
    if (weight > 1e-3) gait = { clip: clipName, time: L(sim.w[i]) / nat, weight, speed };
  }
  return { pos, yaw, ...(gait ? { gait } : {}) };
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

/** EACH PERSON'S OWN MOTION now lives in people/life.ts (every Person3D reads it, not only the cut scenes). */
export { ownMotion, type OwnMotion };

/**
 * Body clips for an actor at t: [real clip, time, weight][]. `has` / `dur`
 * describe the body (which clips it has, how long each is).
 */
export function clipsAt(c: Compiled, id: string, t: number, has: (n: string) => boolean, dur: (n: string) => number, role: string, body: string, ground?: (n: string) => number | undefined): ClipSample {
  const tracks = (c.byActor.get(id) ?? []).filter((x): x is ClipTrack => x.type === "clip");
  const out = new Map<string, [number, number]>();
  let upright = 0;
  const add = (name: string, time: number, w: number, up = 0) => {
    if (w <= 1e-4) return;
    const cur = out.get(name);
    out.set(name, cur ? [cur[0], cur[1] + w] : [time, w]);
    upright += up * w;
  };
  const own = ownMotion(id);
  // his own standing idle (people/life.ts): a plain "idle" becomes his, when the body has it
  const mine = (ch: ClipChoice | null): ClipChoice | null => (ch && ch.clip === "idle" && own.idle !== "idle" && has(own.idle) ? { ...ch, clip: own.idle } : ch);
  const sample = (tr: ClipTrack | null, w: number) => {
    if (!tr) {
      const ch = mine(resolveClip(defaultIdle(role, body), has));
      // (each man's idle starts at his own moment: a line of 22 never sways as one)
      if (ch) add(ch.clip, ((t * (ch.speed ?? 1) * own.rate + own.phase * dur(ch.clip)) % Math.max(0.1, dur(ch.clip)) + dur(ch.clip)) % Math.max(0.1, dur(ch.clip)), w, ch.upright ?? 0);
      return;
    }
    const ch = mine(resolveClip(tr.clip, has));
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
    let ch = resolveClip(r.gait.clip, has);
    let rate = 1;
    // each man has his own walk (people/life.ts: four of them), its stride clock scaled so his feet still keep up
    if (ch && ch.clip === "walk" && own.walk !== "walk" && has(own.walk)) { ch = { ...ch, clip: own.walk }; rate = (GAIT_SPEED.walk ?? 1.35) / (GAIT_SPEED[own.walk] ?? 1.35); }
    if (ch) {
      const d = Math.max(0.1, dur(ch.clip));
      // his own place in the stride: no two men's feet land together (the walk-out marched in step)
      // THE FEET KEEP UP (Harry: "the quality is like jittering"): the stride clock is the distance walked over the
      // clip's own ground speed on this body (three3d/stride.ts, measured). The old fixed speeds (walk 1.35 m/s
      // against legs that cover 0.93 to 1.04) slid every planted foot 13 to 15 cm a step.
      const gs = ground?.(ch.clip);
      // (and each man's stride a touch his own, 2% either way, as real men of one build differ: two men held to
      // one speed by the line still drift out of step; a planted foot gives about 1 cm a step for it)
      const clock = gs && gs > 0.2 ? ((r.gait.time * (GAIT_SPEED[r.gait.clip] ?? 1.3)) / gs) * (1 + (own.rate - 1) * 0.17) : r.gait.time * (ch.speed ?? 1) * rate;
      const time = ((clock + own.phase * d) % d + d) % d;
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
