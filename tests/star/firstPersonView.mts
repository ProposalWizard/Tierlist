import {
  cameraFor, project, unprojectAtDepth, groundAt, aimOnPlane,
  EYE, FOCAL_K, HORIZON_F, NEAR,
} from "../../lib/star/firstPersonView";
import { newRun } from "../../lib/star/firstPersonDribble";

/**
 * THE FIRST-PERSON CAMERA'S PROJECTION MATH.
 *
 * The same idiom as scenarioRender.mts: no canvas anywhere in this file,
 * just the divide-by-depth projection and its inverse, checked the way
 * pxFromPitch/pitchFromPx are checked there — a screen pixel and the world
 * point it was computed from must always agree.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const W = 480, H = 800;

function mkCam(x: number, y: number) {
  const run = newRun({ pace: 60, oppStrength: 50, rng: () => 0.5 });
  run.x = x; run.y = y;
  return cameraFor(run, W, H);
}

// ── cameraFor derives focal/horizon from canvas size ──────────────────────
{
  const cam = mkCam(34, 40);
  check(Math.abs(cam.focal - FOCAL_K * W) < 1e-9, "focal follows FOCAL_K * W");
  check(Math.abs(cam.horizon - HORIZON_F * H) < 1e-9, "horizon follows HORIZON_F * H");
  check(cam.eye === EYE, "default eye height is EYE");
  check(cam.x === 34 && cam.y === 40, "camera sits at the run's own position");
}

// ── project / unprojectAtDepth are exact inverses ──────────────────────────
{
  const cam = mkCam(34, 40);
  const points: { x: number; y: number; z: number }[] = [
    { x: 34, y: 0, z: 0 }, { x: 34, y: 0, z: 2.44 },
    { x: 30.34, y: 0, z: 0 }, { x: 37.66, y: -1.2, z: 2.44 },
    { x: 28, y: 12, z: 0 }, { x: 40, y: 20, z: 1.1 },
  ];
  for (const p of points) {
    const depth = cam.y - p.y;
    if (depth <= NEAR) continue;
    const proj = project(cam, p.x, p.y, p.z);
    check(proj !== null, `(${p.x},${p.y},${p.z}) projects (depth=${depth})`);
    if (!proj) continue;
    const back = unprojectAtDepth(cam, proj.px, proj.py, depth);
    check(
      Math.abs(back.x - p.x) < 1e-6 && Math.abs(back.y - p.y) < 1e-6 && Math.abs(back.z - p.z) < 1e-6,
      `(${p.x},${p.y},${p.z}) survives project -> unprojectAtDepth -> (${back.x.toFixed(3)},${back.y.toFixed(3)},${back.z.toFixed(3)})`,
    );
  }
}

// ── A point on your own lane always projects to screen centre ─────────────
{
  const cam = mkCam(34, 40);
  for (const depth of [1, 5, 20, 45]) {
    const proj = project(cam, cam.x, cam.y - depth, 0);
    check(!!proj && Math.abs(proj.px - W / 2) < 1e-6, `u=0 lands on screen centre at depth ${depth}`);
  }
}

// ── Linearity: doubling the lateral offset doubles the screen offset ──────
{
  const cam = mkCam(34, 40);
  const depth = 10;
  const a = project(cam, cam.x + 3, cam.y - depth, 0);
  const b = project(cam, cam.x + 6, cam.y - depth, 0);
  check(!!a && !!b, "both points project");
  if (a && b) {
    const da = a.px - W / 2, db = b.px - W / 2;
    check(Math.abs(db - 2 * da) < 1e-6, `doubling lateral offset doubles screen offset (${da.toFixed(3)} -> ${db.toFixed(3)})`);
  }
}

// ── scale halves exactly when depth doubles ────────────────────────────────
{
  const cam = mkCam(34, 40);
  const near = project(cam, cam.x, cam.y - 5, 0);
  const far = project(cam, cam.x, cam.y - 10, 0);
  check(!!near && !!far, "both project");
  if (near && far) {
    check(Math.abs(far.scale - near.scale / 2) < 1e-9, `scale halves when depth doubles (${near.scale.toFixed(4)} -> ${far.scale.toFixed(4)})`);
  }
}

// ── A ground point's py decreases monotonically toward the horizon and
// never crosses it, as depth grows ────────────────────────────────────────
{
  const cam = mkCam(34, 40);
  let prevPy = Infinity;
  for (const depth of [1, 2, 4, 8, 16, 32]) {
    const proj = project(cam, cam.x, cam.y - depth, 0);
    check(!!proj, `ground point at depth ${depth} projects`);
    if (!proj) continue;
    check(proj.py < prevPy, `py decreases as depth grows (depth ${depth}: py=${proj.py.toFixed(2)})`);
    check(proj.py > cam.horizon, `py never crosses the horizon (depth ${depth}: py=${proj.py.toFixed(2)} > ${cam.horizon})`);
    prevPy = proj.py;
  }
}

// ── project(depth <= NEAR) and groundAt(above horizon) both refuse rather
// than exploding or returning a negative depth ────────────────────────────
{
  const cam = mkCam(34, 40);
  check(project(cam, cam.x, cam.y - NEAR / 2, 0) === null, "project nearer than NEAR returns null");
  check(project(cam, cam.x, cam.y + 1, 0) === null, "project behind the camera returns null");
  check(groundAt(cam, W / 2, cam.horizon) === null, "groundAt exactly on the horizon returns null");
  check(groundAt(cam, W / 2, cam.horizon - 50) === null, "groundAt above the horizon (sky) returns null");
  const ground = groundAt(cam, W / 2, cam.horizon + 50);
  check(ground !== null && ground.y < cam.y, "groundAt below the horizon returns a real point ahead of the camera");
}

// ── aimOnPlane: the screen centre maps to the camera's own lane on the
// goal plane, and a plane behind the camera is refused ───────────────────
{
  const cam = mkCam(34, 12);
  const centre = aimOnPlane(cam, W / 2, cam.horizon + 100, 0);
  check(centre !== null && Math.abs(centre.x - 34) < 1e-6, `screen centre aims at your own lane on the goal plane (${centre?.x.toFixed(3)})`);
  check(aimOnPlane(cam, W / 2, cam.horizon + 100, 20) === null, "a plane behind the camera (y > cam.y) is refused");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the first-person camera's projection and its inverse always agree");
