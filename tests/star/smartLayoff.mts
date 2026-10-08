import { buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, type Outcome, type ScenarioKind } from "../../lib/star/canvasEngine";
function mulberry32(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DT = 1 / 180;
/**
 * SMART LAY-OFFS (Leo, 8 Oct 2026: "if a passer is really good … they should
 * know the run of the player they've been told to pass to … get the pass off
 * before the player gets offside").
 *
 * You send A on a run and tell B to lay it off to him, then pass to B. A good
 * passer takes a quicker touch, releases it before A crosses the line, leads
 * A into his run and lifts it over a man in the lane. A weak one does what B
 * always did. The same 158 chances for both.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function run(passing: number) {
  const out: Record<string, number> = {}; let n = 0, aGets = 0, relays = 0, bFirst = 0, aFirst = 0;
  for (const kind of ["through_ball", "cutback", "one_on_one", "tight_angle"] as ScenarioKind[])
  for (let seed = 0; seed < 300; seed++) {
    const rng = mulberry32(seed * 977 + kind.length * 31);
    const sc = buildScenario(kind, rng, 65, 65, 60);
    initDefenders(sc, rng);
    const B = sc.runner; const A = sc.secondaryRunners[0];
    if (!B || !A || !sc.receiver) continue;
    const ys = sc.defenders.map(d => d.y).concat([sc.keeper.y]).sort((a, b) => a - b);
    const line = ys[1];
    if (A.pos.y < line + 1) continue;  // A starts onside
    const gx = (sc.goal.x1 + sc.goal.x2) / 2;
    A.commandedTo = { x: A.pos.x + (gx - A.pos.x) * 0.3, y: Math.max(3, line - 9) };
    sc.relayTo = A;
    const who = { id: "b", name: "B", shortName: "B", position: "CM", passing, overall: passing, shooting: 75 };
    B.who = who;
    // a little aim time: A sets off
    for (let t = 0; t < 0.3; t += 1 / 60) {
      const c = A.commandedTo!; const dx = c.x - A.pos.x, dy = c.y - A.pos.y, g = Math.hypot(dx, dy);
      if (g < 0.6) break; const st = Math.min(g, A.speed / 60); A.pos.x += dx / g * st; A.pos.y += dy / g * st; A.moving = true;
    }
    const t = B.pos; const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
    const ball = launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, Math.min(.95, .2 + d / 32), { cx: 0, cy: -0.2 }, { power: 60, technique: 60 }, rng);
    if (A.offside || B.offside) continue;
    let res: Outcome | null = null; let firstBy: any = null;
    for (let i = 0; i < 3000 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball); stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
      res = stepBall(ball, sc, rng, DT); if (!firstBy && sc.receivedBy) firstBy = sc.receivedBy;
    }
    if (firstBy !== B) continue; // B must be the one told to lay it off
    n++; if (sc.relayed) relays++; if (sc.receivedBy === A) aGets++;
    out[res ?? "none"] = (out[res ?? "none"] ?? 0) + 1;
  }
  const p = (k: string) => ((out[k] ?? 0) * 100 / n).toFixed(0) + "%";
  const res = { n, offside: (out.offside ?? 0) / n, goal: (out.goal ?? 0) / n };
  console.log(`  passer ${passing}: n ${n} | lay-off played ${(relays * 100 / n).toFixed(0)}% | runner gets it ${(aGets * 100 / n).toFixed(0)}% | offside ${p("offside")} | goal ${p("goal")} | defenders win it ${((((out.tackled ?? 0) + (out.blocked ?? 0)) * 100) / n).toFixed(0)}%`);
  return res;
}
const top = run(88), weak = run(55);
check(top.n >= 100, `enough lay-offs to judge (${top.n})`);
check(top.offside <= 0.08, `a top passer rarely plays his man offside (${(top.offside * 100).toFixed(0)}%)`);
check(top.offside < weak.offside - 0.05, `a top passer plays his man offside less than a weak one (${(top.offside * 100).toFixed(0)}% v ${(weak.offside * 100).toFixed(0)}%)`);
check(top.goal >= weak.goal, `a top passer's lay-offs score at least as often (${(top.goal * 100).toFixed(0)}% v ${(weak.goal * 100).toFixed(0)}%)`);
if (problems.length) { console.error("smartLayoff FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("smartLayoff: all checks passed");
