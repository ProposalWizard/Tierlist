import { viewportFor, pxFromPitch, pitchFromPx, VIEW_ASPECT, type Facing } from "../../lib/star/scenarioRender";
import { PITCH_W, HALF_LEN } from "../../lib/star/pitch";

/**
 * THE SCENARIO EDITOR'S COORDINATE MATH.
 *
 * Reported directly: dragging a player in the editor put him down "off to
 * the side" of the actual cursor. The old SVG version mapped a click
 * through the element's own bounding box, which is only exact when that
 * box's aspect ratio happens to match the viewBox's — it rarely does once
 * CSS is involved. `pxFromPitch`/`pitchFromPx` are the forward and inverse
 * of the SAME projection the real match itself uses (canvasEngine.ts's flat
 * Viewport/Facing model) — what has to hold here is that they really are
 * exact inverses of each other, for all three camera facings, so a screen
 * pixel and the pitch point it was computed from always agree.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const W = 480, H = 900; // an arbitrary canvas backing-store size

// ── viewportFor: centre + height, at the real match's own aspect ratio ────
{
  const vp = viewportFor(34, 20, 40);
  check(Math.abs((vp.x2 - vp.x1) - 40 * VIEW_ASPECT) < 1e-9,
    `the width follows from height × VIEW_ASPECT (${vp.x2 - vp.x1})`);
  check(Math.abs((vp.y2 - vp.y1) - 40) < 1e-9, `the height is exactly what was asked for (${vp.y2 - vp.y1})`);
  check(Math.abs((vp.x1 + vp.x2) / 2 - 34) < 1e-9, "centred on the requested X");
  check(Math.abs((vp.y1 + vp.y2) / 2 - 20) < 1e-9, "centred on the requested Y");
}

// ── pxFromPitch / pitchFromPx are exact inverses, every facing ────────────
{
  const vp = viewportFor(PITCH_W / 2, 16, 40);
  for (const facing of ["up", "left", "right"] as Facing[]) {
    const points = [
      { x: PITCH_W / 2, y: 16 }, { x: 0, y: 0 }, { x: PITCH_W, y: HALF_LEN * 2 },
      { x: 12.5, y: 8 }, { x: 55.8, y: 24.2 },
    ];
    for (const p of points) {
      const screen = pxFromPitch(p.x, p.y, W, H, vp, facing);
      const back = pitchFromPx(screen.px, screen.py, W, H, vp, facing);
      check(Math.abs(back.x - p.x) < 1e-6 && Math.abs(back.y - p.y) < 1e-6,
        `${facing}: (${p.x},${p.y}) survives px → pitch and back (${back.x.toFixed(3)},${back.y.toFixed(3)})`);
    }
  }
}

// ── A click at the exact centre of the frame lands on the camera's centre ──
{
  for (const facing of ["up", "left", "right"] as Facing[]) {
    const vp = viewportFor(30, 50, 60);
    const centre = pitchFromPx(W / 2, H / 2, W, H, vp, facing);
    check(Math.abs(centre.x - 30) < 1e-6 && Math.abs(centre.y - 50) < 1e-6,
      `${facing}: the middle of the canvas is genuinely the camera's own centre (${centre.x.toFixed(2)},${centre.y.toFixed(2)})`);
  }
}

// ── Points genuinely off the real pitch clamp onto it, never negative or
// beyond it — a click merely outside the current camera CROP is not this:
// the pitch is 105m long and a tight framing only shows part of it, so
// dragging a little past the edge of the frame still lands somewhere real
// on the pitch. Only a point that would fall off the pitch ITSELF clamps. ──
{
  const vp = viewportFor(PITCH_W / 2, 16, 40);
  const farLeft = pitchFromPx(-W * 50, 200, W, H, vp, "up");
  check(farLeft.x === 0, `far enough left clamps to the touchline, not negative (${farLeft.x})`);
  const farRight = pitchFromPx(W * 50, 200, W, H, vp, "up");
  check(farRight.x === PITCH_W, `and far enough right clamps to the far touchline (${farRight.x})`);
  const farUp = pitchFromPx(200, -H * 50, W, H, vp, "up");
  check(farUp.y === 0, `far enough above clamps to the goal line (${farUp.y})`);
  const farDown = pitchFromPx(200, H * 50, W, H, vp, "up");
  check(farDown.y === HALF_LEN * 2, `far enough below clamps to the far end (${farDown.y})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a screen pixel and the pitch point it maps to always agree, in every camera facing");
