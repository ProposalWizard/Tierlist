#!/usr/bin/env node
/**
 * CUT-SCENE FRAMING CHECK at phone size (390 × 844, a 9:19.5 portrait screen).
 *
 * For every camera shot of each scene (or the given seconds) it seeks the real
 * director, reads where the camera is and where each person's body is, and
 * marks a shot BAD when, on the phone:
 *   face      the subject's head is more than half the screen wide (a face that fills it)
 *   body      the subject's shoulders take 84% of the screen's width or more (a body that fills it)
 *   crop      the subject's head is cut by the top or side of the frame
 *   inside    the camera is inside a person's own space (under 30 cm from his head or body,
 *             22 cm from an arm) or inside a prop
 *   prop      a prop the shot is about fills more than 90% of the screen's height or width
 *   blocked   someone else's head, nearer the lens, covers the subject's face, or anyone's
 *             face fills more than half the screen (someone walking right past the lens; not the
 *             near man of an over-the-shoulder shot, who is there on purpose)
 *
 *   node scripts/bench3d/framing.mjs [--base=http://localhost:3027] [--at=audit|shots] [--out=file.json] [--old] [scene ...]
 * --old: the cameras as they were on 19 Oct 2026 (?framing=old) — the "before".
 *
 * scene: a fixture (signing goal trophy walkout press mentor farewell) or an
 * event "scored:0.8:joy:3" (kind:stakes:emotion:seed). Default: every fixture
 * plus two generated scenes. --at=audit uses the 23 seconds the 19 Oct 3D audit
 * stills were taken at; --at=shots (default) one sample in the middle of every shot;
 * --at=dense three samples in every shot (20%, 50%, 80% through it: a man walking
 * past the lens mid-shot is caught).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const BASE = flags.base ?? "http://localhost:3027";
const AT = flags.at ?? "shots";
const AUDIT = {
  signing: [4.0, 10.1, 15.6], goal: [2.2, 5.5, 8.5], trophy: [1.6, 4.1, 6.3], walkout: [2.3, 5.8, 9.0],
  press: [1.7, 4.3, 6.7], mentor: [2.2, 5.6, 8.7], farewell: [2.4, 5.9, 9.2], "scored:0.8:joy:3": [3.0, 7.1],
};
let scenes = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!scenes.length) scenes = ["signing", "goal", "trophy", "walkout", "press", "mentor", "farewell", "scored:0.8:joy:3", "won-trophy:0.9:joy:5"];
const urlOf = (s) => {
  const old = flags.old ? "&framing=old" : "";
  if (!s.includes(":")) return `${BASE}/star-3d-bench-dev/scene?scene=director&fixture=${s}&clean=1${old}`;
  const [kind, stakes, emotion, seed] = s.split(":");
  return `${BASE}/star-3d-bench-dev/scene?scene=director&event=${kind}&stakes=${stakes}&emotion=${emotion}&seed=${seed}&clean=1${old}`;
};

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const all = [];
for (const s of scenes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(urlOf(s), { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(() => window.__frameStep && window.__cutsceneDebug && window.__cutscene && window.__styleReady !== false, null, { timeout: 300000 });
  let times;
  if (AT === "audit") times = (AUDIT[s] ?? []).map((t) => ({ t, shot: null }));
  else if (AT === "dense") times = await page.evaluate(() => window.__cutscene.cameras().flatMap((c, i) => [0.2, 0.5, 0.8].map((f) => ({ t: +(c.at + c.dur * f).toFixed(2), shot: i, preset: c.shot.preset, name: c.name ?? null }))));
  else times = await page.evaluate(() => window.__cutscene.cameras().map((c, i) => ({ t: +(c.at + Math.min(c.dur * 0.5, Math.max(0.3, c.dur - 0.3))).toFixed(2), shot: i, preset: c.shot.preset, name: c.name ?? null })));
  for (const x of times) {
    // a page that reloaded (the dev server rebuilt) brings its director back: wait for it
    await page.waitForFunction(() => window.__frameStep && window.__cutsceneDebug && window.__cutscene, null, { timeout: 300000 });
    const r = await page.evaluate(([t]) => {
      window.__frameStep.seek(t);
      const D = window.__cutsceneDebug, cam = D.camera;
      const V = cam.position.constructor;
      cam.updateMatrixWorld(true);
      const api = window.__cutscene;
      const tracks = api.cameras();
      let cur = null;
      for (const c of tracks) if (t >= c.at && t < c.at + c.dur) cur = c;
      const subj = cur?.shot?.subject && "actor" in cur.shot.subject ? cur.shot.subject.actor : null;
      const proj = (v) => v.clone().project(cam);
      const camUp = new V(0, 1, 0).applyQuaternion(cam.quaternion), camRight = new V(1, 0, 0).applyQuaternion(cam.quaternion);
      const subj2 = cur?.shot?.subject2 && "actor" in cur.shot.subject2 ? cur.shot.subject2.actor : null;
      const out = { t, preset: cur?.shot?.preset ?? null, name: cur?.name ?? null, subject: subj, subject2: subj2, people: {}, bad: [] };
      const pos = cam.position;
      // distance from a point to a segment
      const segD = (p, a, b) => { const ab = b.clone().sub(a), t2 = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t2)); };
      for (const [id, c] of D.cast) {
        const A = c.actor;
        const head = A.point("head"), chest = A.point("chest"), hips = A.point("hips");
        const front = head.clone().sub(pos).dot(new V(0, 0, -1).applyQuaternion(cam.quaternion)) > 0.05;
        // the head as a 0.13 m ball seen from the camera: its screen box
        const hs = [camUp, camUp.clone().negate(), camRight, camRight.clone().negate()].map((d) => proj(head.clone().addScaledVector(d, 0.13)));
        const headW = Math.abs(hs[2].x - hs[3].x) / 2, headH = Math.abs(hs[0].y - hs[1].y) / 2;
        const hc = proj(head);
        const sh = [A.point("shoulder.L"), A.point("shoulder.R")].map((p) => proj(p.clone().addScaledVector(camRight, 0)));
        const shoulderW = Math.abs(sh[0].x - sh[1].x) / 2 + (headW * 0.6);
        const inFrame = front && Math.abs(hc.x) < 1 && Math.abs(hc.y) < 1;
        const top = hs[0].y, sides = Math.max(Math.abs(hs[2].x), Math.abs(hs[3].x));
        // inside him: head ball, the body from chest to hips, each arm
        const dHead = pos.distanceTo(head);
        const dBody = segD(pos, chest, hips);
        const dArm = Math.min(segD(pos, A.point("shoulder.L"), A.point("hand.L")), segD(pos, A.point("shoulder.R"), A.point("hand.R")));
        // within a person's own space: closer than this, his head, body or arm fills a phone frame
        const inside = dHead < 0.3 || dBody < 0.3 || dArm < 0.22;
        out.people[id] = { headW: +headW.toFixed(2), headH: +headH.toFixed(2), shoulderW: +shoulderW.toFixed(2), screen: [+hc.x.toFixed(2), +hc.y.toFixed(2)], dCam: +dHead.toFixed(2), inFrame, inside, front };
        if (inside) out.bad.push(`inside ${id}`);
        if (id === subj && inFrame) {
          if (headW > 0.5) out.bad.push(`face ${Math.round(headW * 100)}% wide`);
          else if (shoulderW >= 0.84) out.bad.push(`body ${Math.round(shoulderW * 100)}% wide`);
          if (top > 1.0 && hc.y < 1 && headH < 0.5) out.bad.push("crop head top");
          else if (sides > 1.0 && Math.abs(hc.x) < 1 && headW > 0.2) out.bad.push("crop head side");
        }
      }
      // blocked: someone else's head nearer the lens over the subject's face, or any face filling the screen
      const sp = subj ? out.people[subj] : null;
      for (const [id, q] of Object.entries(out.people)) {
        if (id === subj || !q.front) continue;
        // the near man of an over-the-shoulder shot, and the other half of a two-shot, are there on purpose
        if (q.inFrame && q.headW > 0.5 && !(id === subj2 && out.preset === "two-shot") && out.preset !== "ots") { out.bad.push(`blocked by ${id}'s face, ${Math.round(q.headW * 100)}% wide`); continue; }
        if (sp && sp.front && q.dCam < sp.dCam - 0.2) {
          const asp = cam.aspect, dx = (q.screen[0] - sp.screen[0]) * asp, dy = q.screen[1] - sp.screen[1];
          if (Math.hypot(dx, dy) < (q.headH + sp.headH) * 0.8 && Math.abs(sp.screen[0]) < 1 && Math.abs(sp.screen[1]) < 1) out.bad.push(`blocked by ${id}'s head`);
        }
      }
      // props: inside the bounding box (3 cm shrink: a camera grazing a box is not in it)
      for (const [id, p] of D.props) {
        const g = p.group;
        if (!g || !g.visible) continue;
        g.updateMatrixWorld(true);
        let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], any = false;
        g.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          for (let i = 0; i < 8; i++) {
            const q = new V(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(o.matrixWorld);
            mn = [Math.min(mn[0], q.x), Math.min(mn[1], q.y), Math.min(mn[2], q.z)]; mx = [Math.max(mx[0], q.x), Math.max(mx[1], q.y), Math.max(mx[2], q.z)]; any = true;
          }
        });
        if (!any) continue;
        if (cur?.shot?.subject && "prop" in cur.shot.subject && cur.shot.subject.prop === id) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ahead = true;
          for (let i = 0; i < 8; i++) {
            const q = new V(i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]);
            if (q.clone().sub(pos).dot(new V(0, 0, -1).applyQuaternion(cam.quaternion)) < 0.02) ahead = false;
            const s2 = q.project(cam); x0 = Math.min(x0, s2.x); x1 = Math.max(x1, s2.x); y0 = Math.min(y0, s2.y); y1 = Math.max(y1, s2.y);
          }
          const fw = (Math.min(1, x1) - Math.max(-1, x0)) / 2, fh = (Math.min(1, y1) - Math.max(-1, y0)) / 2;
          out.prop = { id, fw: +fw.toFixed(2), fh: +fh.toFixed(2) };
          if (!ahead || fw > 0.9 || fh > 0.9) out.bad.push(`prop ${id} fills ${Math.round(Math.max(fw, fh) * 100)}%`);
        }
        const e = 0.03;
        const sz = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
        // only things you could be "inside" (not the floor, a wall, a table top 2 m across)
        if (Math.max(...sz) > 2.5) continue;
        if (pos.x > mn[0] + e && pos.x < mx[0] - e && pos.y > mn[1] + e && pos.y < mx[1] - e && pos.z > mn[2] + e && pos.z < mx[2] - e) out.bad.push(`inside prop ${id}`);
      }
      return out;
    }, [x.t]);
    r.scene = s;
    if (x.shot !== null) r.shot = x.shot;
    all.push(r);
    console.log(`${s.padEnd(22)} ${String(r.t).padStart(5)}s ${String(r.preset ?? "").padEnd(14)} ${r.bad.length ? "BAD  " + r.bad.join(", ") : "ok"}`);
  }
  await page.close();
}
await browser.close();
const bad = all.filter((r) => r.bad.length).length;
console.log(`\n${bad} of ${all.length} shots bad (${AT})`);
if (flags.out) fs.writeFileSync(flags.out, JSON.stringify({ at: AT, bad, total: all.length, shots: all }, null, 1));
