import {
  FIVE_VIEW, FIVE_PITCH, FIVE_PITCH_W, FIVE_PITCH_L, FIVE_HALFWAY_Y,
  KICK_FLOOR_Y, insideFivePitch, leftPitch, mirror, clampToPitch,
} from "../../lib/star/fiveASide/geometry";
import { buildScenario, VIEW_ASPECT } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { POST_L, POST_R, NET_DEPTH, CX } from "../../lib/star/pitch";

/**
 * THE ONE CLAIM THE WHOLE FEATURE RESTS ON.
 *
 * A real five-a-side pitch fits entirely inside the fixed rectangle the match
 * engine already frames every corner in. If that is true, the five-a-side can
 * be played by the live engine with no changes to it at all — same physics,
 * same keeper, same drag-to-aim. If it is false, the feature is a rewrite of
 * the match engine, which the project's governing rule forbids.
 *
 * So the first test does not check our arithmetic against our own arithmetic.
 * It builds a REAL corner through the engine's own `buildScenario` and
 * compares our frame against the frame the engine actually produced. If the
 * engine's camera is ever retuned, this fails loudly instead of the
 * five-a-side quietly drifting out of frame.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// ── Our frame IS the engine's corner frame ──────────────────────────────
{
  // A corner is the one situation the engine frames the whole width of the
  // attacking third in, and it exposes that frame as `crossSwitchView`.
  let found = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sc = buildScenario("corner", mulberry32(seed));
    const cut = sc.crossSwitchView;
    if (!cut) continue;
    found++;
    check(near(cut.x1, FIVE_VIEW.x1), `corner frame x1 ${cut.x1} vs ours ${FIVE_VIEW.x1}`);
    check(near(cut.x2, FIVE_VIEW.x2), `corner frame x2 ${cut.x2} vs ours ${FIVE_VIEW.x2}`);
    check(near(cut.y1, FIVE_VIEW.y1), `corner frame y1 ${cut.y1} vs ours ${FIVE_VIEW.y1}`);
    check(near(cut.y2, FIVE_VIEW.y2), `corner frame y2 ${cut.y2} vs ours ${FIVE_VIEW.y2}`);
  }
  check(found > 30, `expected real corner scenarios to compare against, got ${found}`);
}

// ── …and it is a real camera frame, not an arbitrary rectangle ──────────
{
  const w = FIVE_VIEW.x2 - FIVE_VIEW.x1;
  const h = FIVE_VIEW.y2 - FIVE_VIEW.y1;
  check(near(w / h, VIEW_ASPECT), `the frame must keep the engine's aspect (${w / h} vs ${VIEW_ASPECT})`);
  check(near(h, 42), `the engine's frame is 42 m deep, got ${h}`);
  check(near((FIVE_VIEW.x1 + FIVE_VIEW.x2) / 2, CX), "the frame is centred on the pitch");
}

// ── The pitch fits inside it, with real margin ──────────────────────────
{
  const margin = {
    left: FIVE_PITCH.x1 - FIVE_VIEW.x1,
    right: FIVE_VIEW.x2 - FIVE_PITCH.x2,
    behind: FIVE_VIEW.y2 - FIVE_PITCH.y2,
  };
  check(margin.left > 1, `grass to the left of the touchline (${margin.left.toFixed(3)} m)`);
  check(margin.right > 1, `grass to the right of the touchline (${margin.right.toFixed(3)} m)`);
  check(margin.behind > 1, `room behind your own goal (${margin.behind.toFixed(3)} m)`);
  check(FIVE_VIEW.y1 < -NET_DEPTH, "the far net is inside the frame, not cut off by it");

  check(FIVE_PITCH_W === 24 && FIVE_PITCH_L === 36, "the pitch is a real small-sided 24 x 36");
  check(
    FIVE_PITCH_W < 45 && FIVE_PITCH_L < 45 && FIVE_PITCH_W > 15 && FIVE_PITCH_L > 20,
    "the pitch is genuinely small-sided, neither a five-a-side cage nor a full pitch",
  );

  // The goal you are shooting at has to be ON the pitch, or you can never score.
  check(POST_L > FIVE_PITCH.x1 && POST_R < FIVE_PITCH.x2, "both posts are inside the touchlines");
  check(FIVE_PITCH.y1 === 0, "you attack the engine's own goal line");
  check(near(FIVE_HALFWAY_Y, 18), `halfway is halfway (${FIVE_HALFWAY_Y})`);
}

// ── The drag floor matches the engine's own, derived not copied ─────────
{
  // The engine keeps a strikeable ball out of the bottom fifth of the frame
  // so there is room to drag backwards. We build our own scenarios, so we
  // have to apply the same rule — and it must be the SAME rule.
  const engineFloor = FIVE_VIEW.y2 - (FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2;
  check(near(KICK_FLOOR_Y, engineFloor), `drag floor ${KICK_FLOOR_Y} should match the engine's ${engineFloor}`);
  check(near(KICK_FLOOR_Y, 29.1), `the floor works out at 29.1 m, got ${KICK_FLOOR_Y}`);
  // It has to leave a real playing area, or every restart is in your own half.
  check(KICK_FLOOR_Y > FIVE_HALFWAY_Y, "there is still room to take a kick in your own half");
  check(KICK_FLOOR_Y < FIVE_PITCH.y2, "…and the floor is genuinely inside the pitch");
}

// ── On the pitch, off the pitch, and which way it went ──────────────────
{
  check(insideFivePitch({ x: CX, y: 18 }), "the centre spot is on the pitch");
  check(insideFivePitch({ x: FIVE_PITCH.x1, y: 0 }), "a corner flag counts as on");
  check(!insideFivePitch({ x: FIVE_PITCH.x1 - 0.5, y: 18 }), "half a metre over the touchline is off");
  check(!insideFivePitch({ x: CX, y: -1 }), "over the goal line is off");

  check(leftPitch({ x: CX, y: 18 }) === null, "a ball in play has not left");
  check(leftPitch({ x: CX, y: -2 }) === "goal-line-theirs", "past their goal line");
  check(leftPitch({ x: CX, y: 40 }) === "goal-line-ours", "past our own goal line");
  check(leftPitch({ x: 10, y: 18 }) === "touchline", "over the touchline");
  // A ball over BOTH near a corner flag is a goal-line ball, not a throw-in.
  check(
    leftPitch({ x: 10, y: -2 }) === "goal-line-theirs",
    "a ball over the goal line near the flag is a goal-line ball, not a touchline one",
  );
}

// ── Mirroring the pitch is exactly reversible ───────────────────────────
{
  // The other side's attacks are handed to the engine mirrored and mirrored
  // back for the screen. If this is not an exact involution, their attacks
  // land in the wrong place — and the drift would be small enough to look
  // like a physics bug rather than a maths one.
  for (let i = 0; i < 2000; i++) {
    const p = {
      x: FIVE_PITCH.x1 + Math.random() * FIVE_PITCH_W,
      y: FIVE_PITCH.y1 + Math.random() * FIVE_PITCH_L,
    };
    const back = mirror(mirror(p));
    check(near(back.x, p.x, 1e-12) && near(back.y, p.y, 1e-12), "mirroring twice returns the same point");
  }
  // A mirrored point is still on the pitch — otherwise their attack starts
  // out of play.
  for (let i = 0; i < 500; i++) {
    const p = {
      x: FIVE_PITCH.x1 + Math.random() * FIVE_PITCH_W,
      y: FIVE_PITCH.y1 + Math.random() * FIVE_PITCH_L,
    };
    check(insideFivePitch(mirror(p)), "a mirrored point is still on the pitch");
  }
  // The two goals swap, which is the whole point of it.
  check(near(mirror({ x: CX, y: 0 }).y, FIVE_PITCH.y2), "their goal mirrors onto ours");
  check(near(mirror({ x: CX, y: FIVE_PITCH.y2 }).y, 0), "and ours onto theirs");
  check(near(mirror({ x: CX, y: 18 }).x, CX), "the centre spot mirrors onto itself");
}

// ── Clamping puts a restart on the pitch and never off it ───────────────
{
  for (const p of [{ x: -50, y: -50 }, { x: 999, y: 999 }, { x: CX, y: 18 }]) {
    const c = clampToPitch(p);
    check(insideFivePitch(c), `clamping ${JSON.stringify(p)} put it on the pitch`);
  }
  const inset = clampToPitch({ x: -50, y: -50 }, 2);
  check(
    inset.x >= FIVE_PITCH.x1 + 2 && inset.y >= FIVE_PITCH.y1 + 2,
    "an inset keeps a restart off the very line",
  );
  const already = { x: CX, y: 18 };
  const untouched = clampToPitch(already);
  check(untouched.x === already.x && untouched.y === already.y, "a point already on the pitch is unchanged");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the five-a-side pitch fits inside the frame the engine already uses for a corner");
