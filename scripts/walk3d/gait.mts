/**
 * HOW LIGHT IS THE WALK (Harry, 28 Nov 2026: "walking improved but seems a bit heavy for some"). Per build and
 * walk, on the real body, through one loop at the speed the cut scenes move him:
 *
 *   cadence   steps a second (the clip's own, and at the scene's speeds: the walk-out moves men at 0.92 to
 *             1.18 m/s); a fit young man walks at 1.8 to 2.0 steps a second at 1.3 to 1.5 m/s
 *   step      step length (m) and as a share of his height (real: about 0.41)
 *   bob       the hips' rise and fall (cm, real: 3 to 5)
 *   knee      the knee's bend at heel strike (degrees, real: 3 to 10) and its most in the stance (real: 15 to 20)
 *   heel      the foot's pitch at contact (degrees toe up, real: 15 to 25: heel first, then the roll)
 *   flat      share of the loop each foot is flat on the ground (real: about 0.35 to 0.45)
 *   arms      hands' swing front to back (cm) and the elbows' bend
 *   lean      the back's forward lean (degrees)
 *
 *   npx tsx scripts/walk3d/gait.mts [--clips=walk,walk_relaxed] [--builds=c1,c2,c3] [--json=FILE]
 */
import { writeFileSync } from "node:fs";
import { loadAll, person, pose, dur, wp, THREE, type Man } from "./lib.mts";
import { groundSpeedOf } from "../../lib/star/three3d/stride";
import type { ToonBody, ToonHead } from "../../lib/star/style3d/toon/bodies";

const arg = (k: string, d = "") => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

export interface GaitRow {
  build: string; clip: string; height: number; D: number; steps: number; cadence: number; ground: number; step: number; stepShare: number;
  bob: number; kneeContact: number; kneeStance: number; vault: number; headPitch: number; heel: number; flat: number; swing: number; elbow: number; lean: number;
  /** cadence at the walk-out's mean speed 1.05 m/s and at 1.35 m/s */
  cad105: number; cad135: number;
}

const ang = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const u = a.clone().sub(b).normalize(), v = c.clone().sub(b).normalize();
  return (Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180) / Math.PI;
};

export async function gaitOf(m: Man, clip: string): Promise<GaitRow | null> {
  const p = m.p;
  if (!p.actions[clip]) return null;
  const B = p.bones;
  pose(m, "idle", 0.5);
  const pitch0 = (() => { const a = wp(B.LeftFoot), to = wp(B.LeftToeBase ?? B.LeftFoot); return (Math.atan2(to.y - a.y, Math.hypot(to.x - a.x, to.z - a.z)) * 180) / Math.PI; })();
  const height = wp(B.Head ?? B.head ?? B.neck).y + 0.12;
  const D = dur(m, clip);
  const N = Math.round(D * 120);
  const rec: { headPitch: number; hy: number; L: THREE.Vector3; R: THREE.Vector3; tL: THREE.Vector3; tR: THREE.Vector3; kL: number; kR: number; hand: number; elbow: number; lean: number }[] = [];
  for (let f = 0; f < N; f++) {
    pose(m, clip, (f / N) * D);
    const H = wp(B.Hips);
    const L = wp(B.LeftFoot), R = wp(B.RightFoot);
    const tL = wp(B.LeftToeBase ?? B.LeftFoot), tR = wp(B.RightToeBase ?? B.RightFoot);
    const kL = 180 - ang(wp(B.LeftUpLeg), wp(B.LeftLeg), L), kR = 180 - ang(wp(B.RightUpLeg), wp(B.RightLeg), R);
    const elbow = 180 - ang(wp(B.LeftArm), wp(B.LeftForeArm), wp(B.LeftHand));
    const nk = wp(B.neck ?? B.Neck ?? B.Head);
    const lean = (Math.atan2(nk.z - H.z, nk.y - H.y) * 180) / Math.PI;
    const hd = wp(B.Head), nb = wp(B.neck ?? B.Neck);
    const headPitch = (Math.atan2(hd.z - nb.z, hd.y - nb.y) * 180) / Math.PI;
    rec.push({ headPitch, hy: H.y, L, R, tL, tR, kL, kR, hand: wp(B.LeftHand).z - H.z, elbow, lean });
  }
  const ys = rec.map((r) => r.hy);
  const bob = Math.max(...ys) - Math.min(...ys);
  // stance and contact per foot
  let kneeC = 0, kneeS = 0, heel = 0, flat = 0, contacts = 0, vault = 0;
  for (const s of ["L", "R"] as const) {
    const ay = rec.map((r) => r[s].y), ty = rec.map((r) => (s === "L" ? r.tL : r.tR).y);
    const amin = Math.min(...ay), tmin = Math.min(...ty);
    const st0 = ay.map((y) => y < amin + 0.015);
    // a stance shorter than a tenth of the loop is a flicker, not a step
    const st = st0.map((v, i) => { if (!v) return false; let n = 0; for (let j = -Math.round(N * 0.06); j <= Math.round(N * 0.06); j++) if (st0[(i + j + N) % N]) n++; return n > N * 0.06; });
    const fl = ay.map((y, i) => y < amin + 0.015 && ty[i] < tmin + 0.01);
    flat += fl.filter(Boolean).length / N / 2;
    for (let i = 0; i < N; i++) {
      const pi = (i - 1 + N) % N;
      if (st[i] && !st[pi]) {
        contacts++;
        const r = rec[i];
        kneeC += s === "L" ? r.kL : r.kR;
        const a = r[s], to = s === "L" ? r.tL : r.tR;
        heel += (Math.atan2(to.y - a.y, Math.hypot(to.x - a.x, to.z - a.z)) * 180) / Math.PI - pitch0;
        // the most bend in the first 40% of this stance
        let mx = 0; for (let j = 0; j < N * 0.25; j++) { const q = rec[(i + j) % N]; if (!st[(i + j) % N]) break; mx = Math.max(mx, s === "L" ? q.kL : q.kR); }
        kneeS += mx;
        // the hips at mid-stance (a quarter of a step on) over the hips at contact: + = he vaults over the leg (light), - = he sinks into it (heavy)
        vault += rec[(i + Math.round(N / 8)) % N].hy - r.hy;
      }
    }
  }
  const steps = Math.max(1, contacts);
  // ground speed on this body as built (a planted ankle's speed backwards, median)
  const back: number[] = [];
  for (const s of ["L", "R"] as const) {
    const ay = rec.map((r) => r[s].y); const amin = Math.min(...ay);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; if (ay[i] < amin + 0.015 && ay[j] < amin + 0.015) back.push(-(rec[j][s].z - rec[i][s].z) / (D / N)); }
  }
  back.sort((a, b) => a - b);
  const ground = back.length ? back[Math.floor(back.length / 2)] : groundSpeedOf(p.actions[clip].getClip()) ?? 0;
  const cadence = steps / D;
  const step = ground / cadence;
  const hz = rec.map((r) => r.hand);
  return {
    build: m.build, clip, height, D, steps, cadence, ground, step, stepShare: step / height, bob,
    kneeContact: kneeC / steps, kneeStance: kneeS / steps, vault: vault / steps, headPitch: rec.reduce((a, r) => a + r.headPitch, 0) / N, heel: heel / steps, flat,
    swing: Math.max(...hz) - Math.min(...hz), elbow: rec.reduce((a, r) => a + r.elbow, 0) / N, lean: rec.reduce((a, r) => a + r.lean, 0) / N,
    cad105: (1.05 / Math.max(0.1, ground)) * cadence, cad135: (1.35 / Math.max(0.1, ground)) * cadence,
  };
}

if (process.argv[1]?.endsWith("gait.mts")) {
  const F = await loadAll();
  const clips = arg("clips", "walk,walk_relaxed,walk_formal,slump_walk").split(",");
  const builds = arg("builds", "c1,c2,c3").split(",") as ToonBody[];
  const head = arg("head", "h1") as ToonHead;
  const rows: GaitRow[] = [];
  console.log("build clip          height  loop steps | own cad  ground  step  /ht | at 1.05 m/s cad | bob cm | knee contact stance | heel deg | flat | arms swing elbow | lean | vault cm | head");
  for (const b of builds) {
    const m = await person(F, head, b, false);
    for (const c of clips) {
      const r = await gaitOf(m, c);
      if (!r) { console.log(`${b} ${c}: none`); continue; }
      rows.push(r);
      console.log(`${b}    ${c.padEnd(13)} ${r.height.toFixed(2)}  ${r.D.toFixed(2)}  ${r.steps}  |  ${r.cadence.toFixed(2)}   ${r.ground.toFixed(2)}  ${r.step.toFixed(2)} ${r.stepShare.toFixed(2)} |   ${r.cad105.toFixed(2)}         | ${(r.bob * 100).toFixed(1).padStart(4)}   |   ${r.kneeContact.toFixed(0).padStart(3)}     ${r.kneeStance.toFixed(0).padStart(3)}   | ${r.heel.toFixed(0).padStart(4)}     | ${r.flat.toFixed(2)} |  ${(r.swing * 100).toFixed(0).padStart(3)}   ${r.elbow.toFixed(0).padStart(3)}  | ${r.lean.toFixed(1).padStart(4)} | ${(r.vault * 100).toFixed(1).padStart(5)} | ${r.headPitch.toFixed(0)}`);
    }
  }
  const j = arg("json"); if (j) writeFileSync(j, JSON.stringify(rows, null, 1));
}
