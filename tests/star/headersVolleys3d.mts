/**
 * HEADERS & VOLLEYS (lib/star/play3d/headersVolleys.ts), the fully 3D drill.
 * (Not the 2D engine's header/volley finishes: that's headersVolleys.mts.)
 *
 * Checked: ten crosses a session; the points (header 2, volley 3, other 1);
 * the ring is where the cross really comes down; a strike in the air is a
 * header or a volley by height. Then Harry's measure: a bot that runs to the
 * ring and strikes as it arrives, 300 crosses (30 sessions) against a 60 and
 * an 80 keeper, average crossers (65) and an average you (65).
 */
import { STEP, CX } from "../../lib/star/play3d/constants";
import { skillsOf } from "../../lib/star/play3d/player";
import { makeHeadersVolleys, HV_CROSSES, HV_POINTS, MEET_Z, type HvState } from "../../lib/star/play3d/headersVolleys";
import type { World } from "../../lib/star/play3d/world";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const person = (id: string, ov = 65) => ({ id, name: id, skills: skillsOf(ov) });

function session(seed: number, keeper: number, bot = true, defender = true): { world: World; state: HvState } {
  const r = makeHeadersVolleys({ seed, bot, defender, keeperOverall: keeper, you: person("you"), leftBack: person("lb"), rightBack: person("rb") });
  for (let i = 0; i < 120 * 150 && !r.state.over; i++) { r.world.step(STEP); r.world.drain(); }
  return r;
}

// ── 1. The rules ──
{
  check(HV_POINTS.header === 2 && HV_POINTS.volley === 3 && HV_POINTS.other === 1, "header 2, volley 3, any other goal 1");
  const { state } = session(5, 66);
  check(state.over && state.log.length === HV_CROSSES, `ten crosses, then it ends (${state.log.length})`);
  const pts = state.log.reduce((a, l) => a + l.points, 0);
  check(pts === state.points && state.points === state.headerGoals * 2 + state.volleyGoals * 3 + state.otherGoals, "points add up: 2 a header, 3 a volley, 1 any other");
  check(state.log.every((l, i) => l.from === (i % 2 ? "right" : "left")), "the full-backs take turns, left first");
  // an idle you scores nothing (only your strikes count)
  const idle = session(6, 66, false);
  check(idle.state.over && idle.state.points === 0 && idle.state.struck === 0, "standing still: no strikes, no points");
}

// ── 2. The ring is honest: where it comes down through the height you meet it at ──
{
  let worst = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = makeHeadersVolleys({ seed, keeperOverall: 66, defender: false, you: person("you"), leftBack: person("lb"), rightBack: person("rb") });
    const w = r.world;
    let ring: { x: number; y: number } | null = null, kind = r.state.kind;
    for (let i = 0; i < 120 * 6 && !r.state.over; i++) {
      w.step(STEP); w.drain();
      if (r.state.phase === "flight" && !ring && w.markers[0]) { ring = { ...w.markers[0] }; kind = r.state.kind; }
      if (ring && kind !== "low" && w.ball.vz < 0 && Math.abs(w.ball.z - MEET_Z[kind!]) < 0.06) {
        worst = Math.max(worst, Math.hypot(w.ball.x - ring.x, w.ball.y - ring.y)); n++; break;
      }
    }
  }
  check(n >= 8 && worst < 0.45, `the ring is where it comes down (${n} crosses, worst ${worst.toFixed(2)} m off)`);
}

// ── 3. The measure ──
const measured: Record<number, { goals: number; pts: number; crosses: number }> = {};
for (const keeper of [60, 80]) {
  let crosses = 0, struck = 0, on = 0, goals = 0, pts = 0, heads = 0, volleys = 0, others = 0, cleared = 0;
  for (let s = 1; s <= 30; s++) {
    const { state } = session(s * 13, keeper);
    crosses += state.log.length; struck += state.struck; on += state.onTarget; goals += state.goals; pts += state.points;
    heads += state.headerGoals; volleys += state.volleyGoals; others += state.otherGoals;
    cleared += state.log.filter((l) => l.result.startsWith("Cleared")).length;
  }
  measured[keeper] = { goals, pts, crosses };
  console.log(`headers & volleys, keeper ${keeper}: ${crosses} crosses — reached (struck) ${(100 * struck / crosses).toFixed(0)}%, on target ${(100 * on / crosses).toFixed(0)}%, `
    + `${(10 * goals / crosses).toFixed(1)} goals per 10 (${heads} headers, ${volleys} volleys, ${others} first-time), ${(10 * pts / crosses).toFixed(1)} points per 10, defender cleared ${(100 * cleared / crosses).toFixed(0)}%`);
  check(struck / crosses > 0.6, `the bot reaches most crosses (${(100 * struck / crosses).toFixed(0)}%)`);
  check(heads > 0 && volleys > 0 && others > 0, "headers, volleys and first-time goals all happen");
}
check(measured[60].goals > measured[80].goals, "a better keeper lets in fewer");
const g60 = 10 * measured[60].goals / measured[60].crosses, g80 = 10 * measured[80].goals / measured[80].crosses;
check(g60 <= 5.5 && g80 >= 2, `an average you scores roughly 3-5 of 10 (keeper 60: ${g60.toFixed(1)}, 80: ${g80.toFixed(1)})`);
void CX;

if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("headersVolleys3d: all checks pass");
