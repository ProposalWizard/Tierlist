/**
 * THE REAL BUILD-UP FROM TRACKING — where the ball and every man really were
 * over the seconds before a real shot (or around a real corner), from
 * data/realmoments/tracks.json (IDSSE / DFL and SkillCorner tracking).
 *
 * Two uses:
 *  - `buildUpOf`: the decoded positions (seconds from the start, metres), the
 *    shape the Full Highlights Rebuild reads for its build-ups;
 *  - `trackLeadIn`: a lead-in for CanvasMatch's `leadIn` prop: the match
 *    replays the real movement in its own picture (2D or 3D), then the chance
 *    starts exactly where the replay ends.
 *
 * Pure; tests/star/realMoments.mts checks it.
 */
import type { Scenario, Vec2 } from "../canvasEngine";
import { leadInEntities, type LeadIn } from "../leadIn";
import type { RealTrack } from "./types";

export type TrackSide = "you" | "mate" | "opp" | "keeper";

export interface BuildUpMan { side: TrackSide; name: string; path: { t: number; x: number; y: number }[] }

/** The real positions over the window, decoded. t: seconds from the first frame; `eventT`: when the shot / kick is. */
export interface RealBuildUp {
  durS: number;
  /** Seconds into the window of the event itself (the shot: the end; a corner kick: 1 s in). */
  eventT: number;
  dt: number;
  ball: { t: number; x: number; y: number; z: number }[];
  men: BuildUpMan[];
}

export function buildUpOf(tr: RealTrack): RealBuildUp {
  const n = tr.ball.length / 3;
  const ball = Array.from({ length: n }, (_, i) => ({ t: +(i * tr.dt).toFixed(3), x: tr.ball[i * 3], y: tr.ball[i * 3 + 1], z: tr.ball[i * 3 + 2] }));
  const men = tr.men.map((row) => {
    const side = row[0] as TrackSide, name = String(row[1] ?? "");
    const path: BuildUpMan["path"] = [];
    for (let i = 0; i < n; i++) path.push({ t: ball[i].t, x: Number(row[2 + i * 2]), y: Number(row[3 + i * 2]) });
    return { side, name, path };
  });
  return { durS: ball[n - 1].t, eventT: +(-tr.t0).toFixed(3), dt: tr.dt, ball, men };
}

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const smooth = (f: number) => { const c = Math.min(1, Math.max(0, f)); return c * c * (3 - 2 * c); };

function along<T extends { t: number }>(pts: T[], t: number, get: (p: T) => number[]): number[] {
  if (t <= pts[0].t) return get(pts[0]);
  const last = pts[pts.length - 1];
  if (t >= last.t) return get(last);
  const dt = pts[1].t - pts[0].t;
  const i = Math.min(pts.length - 2, Math.floor(t / dt));
  const f = (t - pts[i].t) / dt;
  const a = get(pts[i]), b = get(pts[i + 1]);
  return a.map((v, k) => lerp(v, b[k], f));
}

/** Passes seen in the ball's track: the ball moving 9+ m/s for 0.4 s or more (seconds, in order). */
export function passesInTrack(b: RealBuildUp, upTo = b.durS): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let s0: number | null = null;
  for (let i = 1; i < b.ball.length; i++) {
    const p = b.ball[i - 1], q = b.ball[i];
    if (q.t > upTo + 1e-6) break;
    const v = Math.hypot(q.x - p.x, q.y - p.y) / (q.t - p.t);
    if (v >= 9 && s0 === null) s0 = p.t;
    if (v < 9 && s0 !== null) { if (p.t - s0 >= 0.4) out.push({ start: s0, end: p.t }); s0 = null; }
  }
  if (s0 !== null && upTo - s0 >= 0.4) out.push({ start: s0, end: upTo - 0.05 });
  return out;
}

const lastName = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? "";

/**
 * The real movement before a SHOT as a lead-in for the chance `sc`
 * (scenarioForShot of the same moment): each of the chance's men is matched to
 * the real man standing where he stands, and replays that man's real run;
 * team-mates the chance left out (off its camera) run too, as extras. Ends
 * exactly on the chance (every man, the ball on the grass).
 */
export function trackLeadIn(tr: RealTrack, sc: Scenario, opts: { camera?: "tv" } = { camera: "tv" }): LeadIn & { matched: number; build: RealBuildUp } {
  const b = buildUpOf(tr);
  const durS = b.eventT;                          // a shot: the whole window is before it
  const ents = leadInEntities(sc);
  const endOf = (m: BuildUpMan) => { const p = along(m.path, durS, (q) => [q.x, q.y]); return { x: p[0], y: p[1] }; };
  const used = new Set<number>();
  const keyMan = new Map<string, number>();
  const take = (side: TrackSide[], at: Vec2, within: number) => {
    let best = -1, bd = within;
    b.men.forEach((m, i) => {
      if (used.has(i) || !side.includes(m.side)) return;
      const e = endOf(m);
      const d = Math.hypot(e.x - at.x, e.y - at.y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0) used.add(best);
    return best;
  };
  // YOU first (the shooter), then the keeper, then the rest by nearest end spot.
  const order = [...ents].sort((a, c) => (a.key === "you" ? -2 : a.side === "keeper" ? -1 : 0) - (c.key === "you" ? -2 : c.side === "keeper" ? -1 : 0));
  for (const e of order) {
    const at = e.get();
    const i = e.key === "you" ? b.men.findIndex((m) => m.side === "you")
      : take(e.side === "keeper" ? ["keeper"] : e.side === "opp" ? ["opp", "keeper"] : ["mate"], at, e.side === "keeper" ? 2.5 : 1.5);
    if (i >= 0) { used.add(i); keyMan.set(e.key, i); }
  }
  const endEnt = new Map(ents.map((e) => [e.key, e.get()]));
  // Team-mates the chance does not have: drawn while it plays (extra0, extra1…).
  const extras: number[] = [];
  b.men.forEach((m, i) => { if (!used.has(i) && m.side === "mate") extras.push(i); });
  extras.forEach((i, k) => keyMan.set(`extra${k}`, i));

  const end = { x: sc.ball.x, y: sc.ball.y };
  const bEnd = along(b.ball, durS, (q) => [q.x, q.y, q.z]);
  const ballOff = { x: end.x - bEnd[0], y: end.y - bEnd[1] };
  const ballAt = (t: number) => {
    const p = along(b.ball, Math.min(durS, Math.max(0, t)), (q) => [q.x, q.y, q.z]);
    const f = smooth(t / durS);
    const zf = 1 - smooth((t - (durS - 0.4)) / 0.4);
    return { x: p[0] + ballOff.x * f, y: p[1] + ballOff.y * f, z: Math.max(0, p[2]) * zf };
  };
  const posAt = (key: string, t: number): Vec2 | null => {
    const i = keyMan.get(key);
    if (i === undefined) return null;
    const m = b.men[i];
    const p = along(m.path, Math.min(durS, Math.max(0, t)), (q) => [q.x, q.y]);
    const want = endEnt.get(key);
    if (!want) return { x: p[0], y: p[1] };
    const e = endOf(m), f = smooth(t / durS);
    return { x: p[0] + (want.x - e.x) * f, y: p[1] + (want.y - e.y) * f };
  };
  const passes = passesInTrack(b, durS);
  const nearestName = (t: number) => {
    const ball = ballAt(t);
    let best = "", bd = 3;
    for (const m of b.men) {
      const p = along(m.path, Math.min(durS, t), (q) => [q.x, q.y]);
      const d = Math.hypot(p[0] - ball.x, p[1] - ball.y);
      if (d < bd) { bd = d; best = m.side === "you" ? "you" : lastName(m.name); }
    }
    return best;
  };
  const captionAt = (t: number) => {
    const p = passes.find((q) => t >= q.start && t < q.end);
    if (p) {
      const a = nearestName(Math.max(0, p.start - 0.05)), c = nearestName(Math.min(durS, p.end + 0.1));
      return a && c && a !== c ? `${a === "you" ? "You" : a} → ${c === "you" ? "you" : c}` : "The ball is played on";
    }
    const who = nearestName(t);
    if (t > durS - 0.6) return "Your shot";
    return who === "you" ? "You have it" : who ? `${who} on the ball` : "The move…";
  };
  return {
    durS, ballAt, posAt, captionAt, extraMates: extras.length,
    passStart: passes.map((p) => p.start), passEnd: passes.map((p) => p.end),
    ...(opts.camera ? { camera: opts.camera } : {}),
    matched: Array.from(keyMan.keys()).filter((k) => !k.startsWith("extra")).length,
    build: b,
  };
}
