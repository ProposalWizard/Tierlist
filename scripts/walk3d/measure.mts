/**
 * THE WALK, MEASURED (Harry, Nov 2026: "legs like squeezing past each other", "the feet still seem abnormally
 * close together", "the quality is like jittering", "no variations"). Every build (c1, c2, c3), every walk,
 * jog, run and standing idle in use, on the real body in its kit cloth, through one full stride:
 *
 *   feet      the ankles' side-to-side distance (cm, min / mean) and as a share of the hip joints' width;
 *             step width at the plants (each foot's side position while it is on the ground; real adults:
 *             8 to 13 cm between heel centres, feet roughly under the hips)
 *   legs      the nearest the two legs' skin (or shorts, socks) come below the crotch, cm; "IN" = one leg's
 *             surface inside the other's (a fault)
 *   slide     a flat foot's travel along the ground per step (cm): now (every scene moves him at the clip's own
 *             ground speed on his body) and with the cut scenes' old fixed speeds (walk 1.35 m/s)
 *   jitter    shake in the hips, head and feet: what is left after the smooth motion (under 6 Hz for the
 *             hips and head, 10 Hz for the feet) is taken out, mm
 *   arms      the nearest a hand or forearm comes to the body, cm ("IN" = through it), and the hands' swing
 *
 *   npx tsx scripts/walk3d/measure.mts [--out=DIR] [--strips] [--heads=h1,m2] [--clips=walk,...] [--json=FILE]
 *   --strips: per build and clip, a picture of 8 frames across the stride from the front, back and side
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadAll, person, pose, dur, wp, snapshot, clearance, render, Img, THREE, clipInfo, type Man, type View } from "./lib.mts";
import { GAIT_SPEED } from "../../lib/star/cutscene/presets/clips";
import type { ToonBody, ToonHead } from "../../lib/star/style3d/toon/bodies";

const arg = (k: string, d = "") => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg("out", "/tmp/walk3d");
const STRIPS = process.argv.includes("--strips");
const HEADS = arg("heads", "h1").split(",") as ToonHead[];
const BUILDS = arg("builds", "c1,c2,c3").split(",") as ToonBody[];
export const WALKS = ["walk", "walk_relaxed", "walk_formal", "walk_confident", "slump_walk"];
export const RUNS = ["jog", "jog_easy", "run", "sprint", "dribble_run"];
export const IDLES = ["idle", "idle_relaxed", "idle_relaxed_m", "idle_talk"];
export const TURNS = ["turn_l", "turn_r"];
const CLIPS = arg("clips", [...WALKS, ...RUNS, ...IDLES, ...TURNS].join(",")).split(",");
mkdirSync(OUT, { recursive: true });

export interface Row {
  head: string; build: string; clip: string;
  hipW: number; feetMin: number; feetMean: number; stepW: number; share: number;
  legNear: number; legIn: number; thighIn: number; shortsIn: number; slide: number; slideScene: number; groundSpeed: number; fileSpeed: number; sceneSpeed: number;
  jitHips: number; jitHead: number; jitFeet: number; seam: number; armNear: number; armIn: number; swing: number;
}

/** What is left after the harmonics under `hz` are taken out of a looping signal (RMS, same units). */
function shake(sig: number[][], D: number, hz: number): number {
  const N = sig.length; let tot = 0;
  for (let c = 0; c < 3; c++) {
    const x = sig.map((s) => s[c]);
    const kmax = Math.floor(hz * D);
    const sm = new Array(N).fill(0);
    for (let k = 0; k <= Math.min(kmax, Math.floor(N / 2)); k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) { const a = (2 * Math.PI * k * n) / N; re += x[n] * Math.cos(a); im -= x[n] * Math.sin(a); }
      const f = k === 0 || (N % 2 === 0 && k === N / 2) ? 1 : 2;
      for (let n = 0; n < N; n++) { const a = (2 * Math.PI * k * n) / N; sm[n] += (f / N) * (re * Math.cos(a) - im * Math.sin(a)); }
    }
    for (let n = 0; n < N; n++) tot += (x[n] - sm[n]) ** 2;
  }
  return Math.sqrt(tot / N);
}

export async function measureClip(m: Man, clip: string, opts: { skin?: boolean } = {}): Promise<Row | null> {
  const p = m.p;
  if (!p.actions[clip]) return null;
  const info = clipInfo((await FILES).fb, clip) as { speed?: number; loop?: boolean } | null;
  const D = dur(m, clip);
  const loop = info?.loop !== false && !TURNS.includes(clip);
  // rest: hip joints
  pose(m, "idle", 0.5);
  const B = p.bones;
  const hipW = wp(B.LeftUpLeg).x - wp(B.RightUpLeg).x;
  const crotch = Math.min(wp(B.LeftUpLeg).y, wp(B.RightUpLeg).y) - 0.25; // below the shorts' crotch (the shorts' two legs meet above it, standing too)
  const fileSpeed = (info?.speed ?? 0) * m.k;
  const sceneSpeed = GAIT_SPEED[clip] ?? 0;
  const N = Math.max(24, Math.round(D * 60));
  const ank: { L: THREE.Vector3; R: THREE.Vector3 }[] = [];
  const toe: { L: THREE.Vector3; R: THREE.Vector3 }[] = [];
  const hips: number[][] = [], head: number[][] = [], feet: number[][] = [];
  const handZ: number[] = [];
  let legNear = 9, legIn = 0, thighIn = 0, shortsIn = 0, armNear = 9, armIn = 0;
  const kneeY = Math.max(wp(B.LeftLeg).y, wp(B.RightLeg).y), hipY = Math.min(wp(B.LeftUpLeg).y, wp(B.RightUpLeg).y);
  for (let f = 0; f < N; f++) {
    const t = loop ? (f / N) * D : (f / (N - 1)) * D;
    pose(m, clip, t);
    const L = wp(B.LeftFoot), R = wp(B.RightFoot);
    ank.push({ L, R });
    toe.push({ L: wp(B.LeftToeBase ?? B.LeftFoot), R: wp(B.RightToeBase ?? B.RightFoot) });
    const h = wp(B.Hips), hd = wp(B.Head ?? B.head ?? B.neck);
    hips.push([h.x, h.y, h.z]); head.push([hd.x, hd.y, hd.z]); feet.push([L.x, L.y, L.z]);
    handZ.push(wp(B.LeftHand).z - h.z);
    if (opts.skin !== false && f % (N > 60 ? 3 : 2) === 0) {
      const s = snapshot(m);
      const c = clearance(m, s, [1], [2], 0.0, kneeY + 0.05);
      thighIn = Math.max(thighIn, clearance(m, s, [1], [2], kneeY + 0.05, hipY - 0.12, 0).inside);
      if (m.meshes.length > 1) shortsIn = Math.max(shortsIn, clearance(m, s, [1], [2], kneeY + 0.05, hipY - 0.25, 1).inside);
      legNear = Math.min(legNear, c.near); if (c.inside > legIn) { legIn = c.inside; if (process.env.WHERE) console.log("  leg IN", clip, t.toFixed(2), c.at.map((q) => +q.toFixed(3))); }
      if (f % 6 === 0) { const a = clearance(m, s, [3, 4], [0, 1, 2], 0.0, 3); armNear = Math.min(armNear, a.near); if (a.inside > armIn) { armIn = a.inside; if (process.env.WHERE) console.log("  arm IN", clip, t.toFixed(2), a.at.map((q) => +q.toFixed(3))); } }
    }
  }
  const sp = ank.map((a) => a.L.x - a.R.x);
  const feetMin = Math.min(...sp), feetMean = sp.reduce((a, b) => a + b, 0) / sp.length;
  // stance: the ankle within 1.5 cm of its lowest
  const minL = Math.min(...ank.map((a) => a.L.y)), minR = Math.min(...ank.map((a) => a.R.y));
  const stL = ank.map((a) => a.L.y < minL + 0.015), stR = ank.map((a) => a.R.y < minR + 0.015);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const xL = mean(ank.filter((_, i) => stL[i]).map((a) => a.L.x)), xR = mean(ank.filter((_, i) => stR[i]).map((a) => a.R.x));
  const stepW = xL - xR;
  // ground speed: how fast a planted foot goes backwards (the body moves forward at that speed when nothing slides)
  const dt = loop ? D / N : D / (N - 1);
  const back: number[] = [];
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; if (!loop && j === 0) continue; if (stL[i] && stL[j]) back.push(-(ank[j].L.z - ank[i].L.z) / dt); if (stR[i] && stR[j]) back.push(-(ank[j].R.z - ank[i].R.z) / dt); }
  back.sort((a, b) => a - b);
  const groundSpeed = back.length ? back[Math.floor(back.length / 2)] : 0;
  // slide per step at a speed v (m/s at timeScale 1): the planted foot's travel while planted, per plant
  // FOOT SLIDE: while the foot is flat on the ground (heel AND toe down: the middle of a step, when nothing may
  // move), how far it travels along the ground per step with the body moving at v
  const minTL = Math.min(...toe.map((a) => a.L.y)), minTR = Math.min(...toe.map((a) => a.R.y));
  const flL = ank.map((a, i) => stL[i] && toe[i].L.y < minTL + 0.01), flR = ank.map((a, i) => stR[i] && toe[i].R.y < minTR + 0.01);
  const flatSlide = (v: number) => {
    let tot = 0, steps = 0;
    for (const [st, k] of [[flL, "L"], [flR, "R"]] as const) {
      let on = false;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N; if (!loop && j === 0) break;
        if (st[i] && !on) { on = true; steps++; }
        if (!st[i]) on = false;
        if (st[i] && st[j]) { const a = ank[i][k], b = ank[j][k]; tot += Math.hypot(b.x - a.x, (b.z + v * dt) - a.z); }
      }
    }
    return steps ? tot / steps : 0;
  };
  const slideAt = (v: number) => {
    let tot = 0, steps = 0;
    for (const [st, k] of [[stL, "L"], [stR, "R"]] as const) {
      let on = false;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N; if (!loop && j === 0) break;
        if (st[i] && !on) { on = true; steps++; }
        if (!st[i]) on = false;
        if (st[i] && st[j]) { const a = ank[i][k], b = ank[j][k]; tot += Math.hypot(b.x - a.x, (b.z + v * dt) - a.z); }
      }
    }
    return steps ? tot / steps : 0;
  };
  const isIdle = IDLES.includes(clip) || TURNS.includes(clip);
  // now: every scene moves him at the clip's own ground speed on this body (three3d/stride.ts); before: the cut
  // scenes' fixed speeds (GAIT_SPEED: walk 1.35 m/s)
  // (standing: how far a flat foot wanders over the whole loop, its widest spread on the ground)
  const drift = () => Math.max(...(["L", "R"] as const).map((k) => { const ps = ank.filter((_, i) => (k === "L" ? flL : flR)[i]).map((a) => a[k]); if (!ps.length) return 0; const xs = ps.map((p) => p.x), zs = ps.map((p) => p.z); return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); }));
  const slide = isIdle ? drift() : flatSlide(groundSpeed);
  const slideScene = isIdle || !sceneSpeed ? slide : flatSlide(sceneSpeed);
  void slideAt;
  const jitHips = loop ? shake(hips, D, 6) : 0, jitHead = loop ? shake(head, D, 6) : 0, jitFeet = loop ? shake(feet, D, 10) : 0;
  // the seam: the jump from the last frame to the first, over the usual frame-to-frame step
  const st = (i: number, j: number) => Math.hypot(hips[j][0] - hips[i][0], hips[j][1] - hips[i][1], hips[j][2] - hips[i][2]);
  const seam = loop ? Math.max(0, st(N - 1, 0) - mean(Array.from({ length: N - 1 }, (_, i) => st(i, i + 1)))) : 0;
  return {
    head: m.head, build: m.build, clip, hipW, feetMin, feetMean, stepW, share: stepW / hipW,
    legNear, legIn, thighIn, shortsIn, slide, slideScene, groundSpeed, fileSpeed, sceneSpeed, jitHips, jitHead, jitFeet, seam, armNear, armIn,
    swing: Math.max(...handZ) - Math.min(...handZ),
  };
}

export function stripFor(m: Man, clip: string, file: string, label: string) {
  const D = dur(m, clip);
  const views: View[] = ["front", "back", "side"];
  const FW = 190, FH = 430, pxm = 205;
  const img = new Img(FW * 8, FH * 3 + 30);
  img.text(label, 8, 8, [20, 20, 20], 2);
  const B = m.p.bones;
  pose(m, "idle", 0.5);
  const hipW = wp(B.LeftUpLeg).x - wp(B.RightUpLeg).x;
  for (let f = 0; f < 8; f++) {
    const t = (f / 8) * D;
    pose(m, clip, t);
    const s = snapshot(m);
    const L = wp(B.LeftFoot), R = wp(B.RightFoot), H = wp(B.Hips);
    views.forEach((v, r) => {
      const fr = render(m, s, v, FW, FH, pxm, H.x, H.z);
      // the ankles' spacing, and the hips' width for scale
      const sx = (x: number) => FW / 2 + (v === "back" ? -(x - H.x) : x - H.x) * pxm;
      if (v !== "side") {
        fr.rect(sx(L.x) - 1, FH - 12, 3, 9, [20, 60, 200]); fr.rect(sx(R.x) - 1, FH - 12, 3, 9, [220, 110, 20]);
        fr.text(`${((L.x - R.x) * 100).toFixed(0)}CM`, 6, FH - 34, [30, 30, 30], 2);
        fr.text(`${(((L.x - R.x) / hipW) * 100).toFixed(0)}%`, FW - 50, FH - 34, [90, 90, 90], 2);
      }
      if (f === 0) fr.text(v, 6, 6, [60, 60, 60], 2);
      fr.text(`${t.toFixed(2)}S`, FW - 70, 6, [120, 120, 120], 2);
      img.blit(fr, f * FW, 30 + r * FH);
      img.line(f * FW, 30 + r * FH, f * FW, 30 + (r + 1) * FH, [210, 210, 210]);
    });
  }
  img.save(file);
}

const FILES = loadAll();
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("measure.mts")) {
  const F = await FILES;
  const rows: Row[] = [];
  const c = (x: number) => (x * 100).toFixed(1).padStart(5);
  const mm = (x: number) => (x * 1000).toFixed(1).padStart(5);
  console.log("head build clip            hipW | feet min mean  step  %hip | below knee: near IN | IN thigh shorts | slide now, old scenes (cm/step) | ground file scene m/s | shake hips head feet mm seam | arms near IN swing");
  for (const head of HEADS) for (const build of BUILDS) {
    const m = await person(F, head, build, process.env.CLOTH !== "0");
    for (const clip of CLIPS) {
      const r = await measureClip(m, clip);
      if (!r) { console.log(`${head} ${build} ${clip}: (not on this body)`); continue; }
      rows.push(r);
      console.log(`${head} ${build}  ${clip.padEnd(15)} ${c(r.hipW)} | ${c(r.feetMin)} ${c(r.feetMean)} ${c(r.stepW)} ${(r.share * 100).toFixed(0).padStart(4)}% | ${c(r.legNear)} ${r.legIn > 0 ? "IN" + mm(r.legIn) : "   -   "} | ${mm(r.thighIn)} ${mm(r.shortsIn)} | ${c(r.slide)} ${c(r.slideScene)} | ${r.groundSpeed.toFixed(2).padStart(5)} ${r.fileSpeed.toFixed(2).padStart(5)} ${r.sceneSpeed.toFixed(2).padStart(5)} | ${mm(r.jitHips)} ${mm(r.jitHead)} ${mm(r.jitFeet)} ${mm(r.seam)} | ${c(r.armNear)} ${r.armIn > 0 ? "IN" + mm(r.armIn) : "   -   "} ${c(r.swing)}`);
      if (STRIPS && [...WALKS, "jog", "run", "idle", "idle_relaxed"].includes(clip)) stripFor(m, clip, `${OUT}/strip-${build}-${head}-${clip}.png`, `${build} ${head} ${clip}  (blue = left leg, orange = right leg; ticks = ankles)`);
    }
  }
  const json = arg("json");
  if (json) writeFileSync(json, JSON.stringify(rows, null, 1));
}
