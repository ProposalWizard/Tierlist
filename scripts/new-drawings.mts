/**
 * THE NEW BATCH'S EXTRA DRAWINGS — v0.26, for the new match view.
 *
 *   npx tsx scripts/new-drawings.mts      → lib/star/authoredScenariosNew.json
 *
 * Harry, 3 Oct 2026, handed the drawing over for one night: "feel free to have
 * a good long go at creating scenarios … based on the new pitch size" and "if I
 * wake up and u somehow had like 100 of every scenario made perfectly that
 * would be incredible."
 *
 * The thin kinds had too few drawings to make 100 different pictures from
 * (cutback 6, byline cross 5, through ball 2, build-up 2, midfield pass 6,
 * tight angle 13, corner 9, free kick 14, penalty 10). This draws more of each.
 * Each drawing is a real football shape for that kind, written down here so a
 * person can read what was drawn and why (a cutback: you on the byline, a
 * marker goal-side of you, the keeper on his near post, men attacking the
 * near post, the spot and the far post). Small random differences between
 * drawings come from a fixed seed, so running this again gives the same file.
 *
 * These are DRAWINGS in the gallery's own format (MatchScenario, real pitch
 * metres, goal line at y = 0), not served chances. They only reach the game
 * through the New library (scripts/chance-library.mts), where every picture
 * made from them is checked by rule and by eye. Classic never reads this file.
 */
import { writeFileSync } from "node:fs";
import type { MatchScenario, ScenarioPlayer } from "../lib/star/scenarios";

const OUT = new URL("../lib/star/authoredScenariosNew.json", import.meta.url);
const CX = 34;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type V = { x: number; y: number };
const r2 = (v: number) => Math.round(v * 100) / 100;

interface Draw { ball: V; you: V; gk: V; defs: V[]; mates: V[] }

/**
 * Nobody stands inside anybody: any two men nearer than `gap` are pushed
 * apart, a few passes, the ball and you never moving (you are drawn off the
 * ball on purpose). A free kick's wall is the rule's own business, so it keeps
 * the rule's 1 m shoulder-to-shoulder.
 */
function spread(d: Draw, gap: number): void {
  const movable = [d.gk, ...d.defs, ...d.mates];
  const all = [d.you, ...movable];
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const p = all[a], q = all[b];
      const dx = q.x - p.x, dy = q.y - p.y, dist = Math.hypot(dx, dy) || 0.01;
      if (dist >= gap) continue;
      const push = (gap - dist) / 2 + 0.02, ux = dx / dist, uy = dy / dist;
      const pm = p !== d.you, qm = q !== d.you;
      if (pm && qm) { p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push; }
      else if (qm) { q.x += ux * push * 2; q.y += uy * push * 2; }
      else { p.x -= ux * push * 2; p.y -= uy * push * 2; }
      moved = true;
    }
    if (!moved) break;
  }
  for (const p of movable) { p.y = Math.max(p === d.gk ? -0.2 : 0.8, p.y); p.x = Math.min(67.5, Math.max(0.5, p.x)); }
}

function scenario(kind: string, n: number, d: Draw): MatchScenario {
  spread(d, kind === "free_kick" ? 0.95 : 1.15);
  const players: ScenarioPlayer[] = [
    { id: "you", side: "you", x: r2(d.you.x), y: r2(d.you.y) },
    { id: "gk", side: "opponent", x: r2(d.gk.x), y: r2(d.gk.y), label: "GK" },
    ...d.defs.map((p, i) => ({ id: `d${i}`, side: "opponent" as const, x: r2(p.x), y: r2(p.y), label: `D${i + 1}` })),
    ...d.mates.map((p, i) => ({ id: `m${i}`, side: "teammate" as const, x: r2(p.x), y: r2(p.y), label: `M${i + 1}` })),
  ];
  const moment = kind === "corner" ? "corner" : kind === "free_kick" || kind === "penalty" ? "free_kick" : "open_play";
  return {
    id: `new-${kind}-${String(n).padStart(3, "0")}`,
    name: `${kind.replace(/_/g, " ")} ${n} (new view)`,
    kind: moment,
    camera: { centerX: CX, centerY: 17.3, viewHeight: 42, facing: "up" },
    ball: { x: r2(d.ball.x), y: r2(d.ball.y) },
    players,
    updatedAt: 1790000000000 + n,
    source: { tool: "gallery", kind, seed: null, planId: null },
  };
}

/** Each kind's own drawing hand. `rng` is fixed per kind; `s` is the side
 *  (−1 left, +1 right) the ball is on. */
const KINDS: Record<string, { count: number; draw: (rng: () => number, s: number, i: number) => Draw }> = {

  // ── THROUGH BALL ── you on the ball in midfield, their back four on a line
  // about 0.62 × your distance from goal (StatsBomb-360: 0.66), a runner
  // level with it in the gap between centre-back and full-back, a second
  // striker the other side, a midfielder behind you. Sometimes a man pressing.
  through_ball: {
    count: 18,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * rng() * 10, y: 26 + rng() * 10 };
      const dist = Math.hypot(ball.x - CX, ball.y);
      const line = dist * 0.62 + j(1.2);
      const shift = (ball.x - CX) * 0.4;
      // Centre-backs split 10–15 m (the classic builder's 10–18 m), full-backs
      // 5–6 m outside them: a back four about 21–27 m wide. A through ball
      // needs a real gap; a 7.6 m one converted 21% against classic's 40%.
      const cb = 5 + rng() * 2.5, fb = cb + 5.5 + rng() * 1.5;
      const xs = [-fb, -cb, cb, fb].map((x) => CX + shift + x + j(0.8));
      // Full-backs a yard or two up from the centre-backs, as a back four steps.
      const defs = xs.map((x, k) => ({ x, y: line + (k === 0 || k === 3 ? 1.2 + rng() : 0) + j(0.6) }));
      // The runner goes through the centre-back gap, sometimes the gap on
      // the ball's side. Level with the line or a stride behind it (classic:
      // 0.15–2.4 m), onside.
      const gap = rng() < 0.3 ? (s > 0 ? 2 : 0) : 1;
      const runner = { x: (xs[gap] + xs[gap + 1]) / 2 + j(0.8), y: Math.min(...defs.map((d) => d.y)) + 0.15 + rng() * 2.2 };
      const strike2 = { x: CX - s * (6 + rng() * 6), y: line + 2.5 + rng() * 2.5 };
      const mid = { x: ball.x - s * (7 + rng() * 4), y: ball.y + 1.5 + rng() * 4 };
      const mates = [runner, strike2, mid];
      if (rng() < 0.5) defs.splice(s > 0 ? 0 : 3, 1); // far full-back off the picture
      if (rng() < 0.35) defs.push({ x: ball.x - s * 1.5 + j(1.5), y: ball.y - 5.5 + j(0.8) }); // a man stepping to you
      const you = { x: ball.x + (rng() < 0.5 ? -1.3 : 1.3), y: ball.y + 0.2 };
      return { ball, you, gk: { x: CX + (ball.x - CX) * 0.1, y: 2 + rng() * 2 }, defs, mates };
    },
  },

  // ── BUILD-UP ── you on the ball in your own half or at halfway, a
  // centre-back square of you, a pivot ahead, a full-back wide, sometimes a
  // forward far ahead; two or three of theirs pressing and screening.
  buildup: {
    count: 18,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * rng() * 16, y: 40 + rng() * 16 };
      const cb = { x: ball.x - s * (13 + rng() * 4), y: ball.y + j(3) };
      const pivot = { x: ball.x - s * (3 + rng() * 5), y: ball.y - 9 - rng() * 4 };
      const fb = { x: s > 0 ? 62 - rng() * 4 : 6 + rng() * 4, y: ball.y - 6 - rng() * 8 };
      const mates = [cb, pivot, fb];
      if (rng() < 0.6) mates.push({ x: CX + j(9), y: ball.y - 20 - rng() * 6 });
      const press = { x: ball.x - s * 2 + j(2), y: ball.y - 6.5 + j(1) };
      const screen = { x: pivot.x + j(1.5), y: pivot.y - 2.4 - rng() * 1.2 };
      const defs = [press, screen];
      if (rng() < 0.7) defs.push({ x: (ball.x + fb.x) / 2 + j(2), y: ball.y - 9 - rng() * 4 });
      if (rng() < 0.3) defs.push({ x: cb.x + s * 4 + j(2), y: cb.y - 7 + j(2) });
      // Their last line: whoever of yours is furthest forward has a
      // centre-back level with or behind him, so nobody starts offside.
      const front = Math.min(...mates.map((m) => m.y));
      if (front < Math.min(...defs.map((d) => d.y))) {
        const fm = mates.find((m) => m.y === front)!;
        defs.push({ x: fm.x + (fm.x > CX ? -1.8 : 1.8) + j(0.5), y: front - 0.4 - rng() * 1.2 });
        if (rng() < 0.6) defs.push({ x: fm.x + (fm.x > CX ? -9 : 9) + j(2), y: front - 0.2 + j(0.8) });
      }
      const you = { x: ball.x + (rng() < 0.5 ? -1.3 : 1.3), y: ball.y + 0.2 };
      return { ball, you, gk: { x: CX, y: 0.6 }, defs, mates };
    },
  },

  // ── MIDFIELD PASS ── you between the lines-ish, 30-42 m out: a striker
  // off the shoulder, a winger wide, a central mate square or behind;
  // their midfield screen in front of you and a back line or part of one.
  midfield_pass: {
    count: 14,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * rng() * 13, y: 30 + rng() * 12 };
      const line = 17 + rng() * 5;
      const striker = { x: CX - s * (3 + rng() * 6), y: line + 0.8 + rng() * 2 };
      const winger = { x: s > 0 ? 60 - rng() * 6 : 8 + rng() * 6, y: ball.y - 6 - rng() * 6 };
      const cm = { x: ball.x - s * (9 + rng() * 3), y: ball.y + j(3) };
      const mates = [striker, winger, cm];
      if (rng() < 0.5) mates.push({ x: CX + j(5), y: line + 8 + rng() * 4 });
      const defs = [
        { x: ball.x - s * 2.5 + j(1.5), y: ball.y - 5.5 + j(1.2) },
        { x: ball.x - s * 10 + j(2), y: ball.y - 7 + j(1.5) },
      ];
      defs.push({ x: CX + j(4) - s * 2, y: line + j(0.6) });
      if (rng() < 0.6) defs.push({ x: CX + s * 8 + j(2), y: line + 0.5 + j(0.6) });
      if (rng() < 0.3) defs.push({ x: CX - s * 9 + j(2), y: line + 0.8 + j(0.6) });
      // The striker plays on the last man's shoulder — level, never past him.
      const last = Math.min(...defs.map((d) => d.y));
      striker.y = Math.max(striker.y, last + 0.3);
      winger.y = Math.max(winger.y, last + 0.6);
      const you = { x: ball.x + (rng() < 0.5 ? -1.3 : 1.3), y: ball.y + 0.2 };
      return { ball, you, gk: { x: CX + j(1), y: 1 + rng() * 3 }, defs, mates };
    },
  },

  // ── CUTBACK ── you on the byline inside the box, a marker goal-side of
  // you, the keeper on his near post, defenders on the near post, in the six
  // and on the spot; your men arriving at the near post, the spot (the
  // cut-back target), the far post and the edge of the box.
  cutback: {
    count: 40,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * (8.5 + rng() * 10.5), y: 1.2 + rng() * 3.8 }; // anywhere along the byline inside the box
      const you = { x: ball.x + s * 1.2, y: ball.y + 0.3 };
      const gk = { x: CX + s * (2.4 + rng() * 0.8), y: 0.6 + rng() * 0.6 };
      const defs = [
        { x: ball.x - s * (3.2 + rng() * 1.2), y: ball.y + 0.6 + j(0.6) },   // the man at your feet, goal-side
        { x: CX + s * (1.2 + rng() * 1.5), y: 4.2 + rng() * 1.6 },           // near post zone
        { x: CX - s * (1 + rng() * 2), y: 6.5 + rng() * 2 },                 // six-yard
        { x: CX + j(2.5), y: 10 + rng() * 2.5 },                             // the spot
      ];
      if (rng() < 0.7) defs.push({ x: CX - s * (5 + rng() * 2), y: 5 + rng() * 2.5 }); // far post
      if (rng() < 0.45) defs.push({ x: CX + j(5), y: 15 + rng() * 3 });     // edge of the box
      const target = { x: CX + s * (1.5 + rng() * 4), y: 9 + rng() * 3.5 };
      const mates = [
        target,
        { x: CX + s * (3 + rng() * 2), y: 6.2 + rng() * 1.6 },               // near post run
        { x: CX - s * (4 + rng() * 3), y: 7 + rng() * 3 },                   // far post
      ];
      if (rng() < 0.75) mates.push({ x: CX - s * rng() * 5, y: 17.5 + rng() * 4 });   // edge
      if (rng() < 0.35) mates.push({ x: CX + j(7), y: 25 + rng() * 5 });               // arriving late
      return { ball, you, gk, defs, mates };
    },
  },

  // ── BYLINE CROSS ── you wide, near the byline or a little up from it; box
  // men at the near post, the spot, the far post and the edge, each with a
  // marker goal-side; a man in the six; one closing you down.
  byline_cross: {
    count: 40,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * (17 + rng() * 14), y: rng() < 0.8 ? 1.5 + rng() * 5.5 : 7 + rng() * 6 }; // wide of the box, mostly on the byline
      const you = { x: ball.x + s * 0.9, y: ball.y + 1.4 };
      const gk = { x: CX + s * (1 + rng() * 1.2), y: 1.5 + rng() * 1 };
      const runs = [
        { x: CX + s * (3 + rng() * 2.5), y: 5.5 + rng() * 2.5 },   // near post
        { x: CX + j(2), y: 9.5 + rng() * 3 },                       // the spot
        { x: CX - s * (3 + rng() * 3), y: 6.5 + rng() * 3.5 },      // far post
      ];
      if (rng() < 0.7) runs.push({ x: CX + j(5), y: 16.5 + rng() * 3.5 }); // edge
      if (rng() < 0.3) runs.push({ x: CX - s * (8 + rng() * 3), y: 11 + rng() * 3 }); // back post, late
      const defs = runs.slice(0, 4).map((m) => ({ x: m.x + s * (0.8 + rng() * 0.6), y: m.y - 1.1 - rng() * 0.5 }));
      defs.push({ x: CX + j(1.5), y: 4 + rng() * 1.2 });                              // six-yard zone
      if (rng() < 0.6) defs.push({ x: ball.x - s * (2.5 + rng() * 1.5), y: ball.y - 1.5 + j(1) }); // closing you
      return { ball, you, gk, defs, mates: runs };
    },
  },

  // ── TIGHT ANGLE ── you inside the box, wide of the posts; the keeper on
  // his near post; a defender stepping across you, others in the six and at
  // the spot; your men central and at the far post, never in your line.
  tight_angle: {
    count: 12,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX + s * (9 + rng() * 6), y: 3.5 + rng() * 5 };
      const you = { x: ball.x + s * 1.3, y: ball.y + 0.2 };
      const gk = { x: CX + (ball.x - CX) * (0.12 + rng() * 0.15), y: 1.1 + rng() * 0.9 }; // near-post share
      const defs = [
        { x: ball.x - s * (2.4 + rng() * 1.5), y: ball.y + 1.2 + rng() * 1.2 },  // stepping across
        { x: CX - s * (0.5 + rng() * 2), y: 6 + rng() * 2 },                      // six-yard
        { x: CX + j(3), y: 11 + rng() * 3 },                                      // spot
      ];
      if (rng() < 0.6) defs.push({ x: CX - s * (6 + rng() * 2), y: 8 + rng() * 3 });
      const mates = [
        { x: CX + s * (1 + rng() * 2), y: Math.max(ball.y + 4, 10) + rng() * 2.5 }, // central, arriving
        { x: CX - s * (4.5 + rng() * 3), y: 7 + rng() * 3 },                         // far post
      ];
      if (rng() < 0.7) mates.push({ x: CX + j(6), y: 17.5 + rng() * 4 });
      return { ball, you, gk, defs, mates };
    },
  },

  // ── CORNER ── the ball on the flag, you over it. Five schemes, all real:
  // zonal six-yard line plus markers; man-for-man; a crowd at the near post;
  // a far-post overload; a short option near you. The keeper on his line.
  corner: {
    count: 64,
    draw(rng, s, i) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = s > 0 ? { x: 67.3, y: 0.7 } : { x: 0.6, y: 0.5 };
      const you = { x: ball.x - s * 0.4, y: ball.y + 1.3 };
      const gk = { x: CX + s * (0.4 + rng() * 1.2), y: 0.9 + rng() * 0.6 };
      const scheme = i % 5;
      const mates: V[] = [];
      const defs: V[] = [];
      const add = (list: V[], p: V) => list.push({ x: p.x + j(0.5), y: Math.max(1.2, p.y + j(0.4)) });
      // Your men, by scheme.
      const nearPost = { x: CX + s * (3.5 + rng() * 2), y: 5.5 + rng() * 2 };
      const spot = { x: CX + j(2.5), y: 10 + rng() * 2.5 };
      const farPost = { x: CX - s * (3.5 + rng() * 3), y: 6.5 + rng() * 3 };
      const six = { x: CX + j(2), y: 6.8 + rng() * 1.5 };
      const edge = { x: CX + j(6), y: 17.5 + rng() * 3 };
      const onKeeper = { x: gk.x + j(1), y: gk.y + 1.4 + rng() * 0.6 };
      const short = { x: ball.x - s * (9 + rng() * 4), y: 5 + rng() * 5 };
      const extraNear = { x: CX + s * (6.5 + rng() * 2), y: 8 + rng() * 2.5 };
      const extraFar = { x: CX - s * (7 + rng() * 3), y: 10 + rng() * 3 };
      const schemes: V[][] = [
        [nearPost, spot, farPost, six, edge],                         // balanced
        [nearPost, extraNear, six, spot, edge, onKeeper],             // near-post crowd
        [farPost, extraFar, spot, six, edge],                         // far-post overload
        [nearPost, spot, farPost, edge, short],                       // short option on
        [nearPost, spot, farPost, six, extraNear, edge, onKeeper],    // everyone up
      ];
      for (const p of schemes[scheme]) add(mates, p);
      // Theirs: zonal six-yard line in two schemes of five, markers for the rest.
      const zonal = scheme === 0 || scheme === 3 || (scheme === 4 && rng() < 0.5);
      if (zonal) {
        for (const dx of [-3.8, 0, 3.8]) add(defs, { x: CX + dx, y: 5.6 + rng() * 0.6 });
        add(defs, { x: CX + s * (4.6 + rng() * 0.6), y: 1.6 + rng() * 0.6 });   // near-post man
      }
      for (const m of mates) {
        if (zonal && m.y < 7.5 && Math.abs(m.x - CX) < 6) continue;           // the zone has him
        if (m.y > 16 && rng() < 0.5) continue;                                 // edge man free sometimes
        const toGoal = Math.hypot(CX - m.x, -m.y) || 1;
        const k = 1.05 + rng() * 0.35;
        add(defs, { x: m.x + ((CX - m.x) / toGoal) * k + s * 0.3, y: m.y - (m.y / toGoal) * k });
      }
      if (rng() < 0.5) add(defs, { x: CX + j(5), y: 18 + rng() * 2.5 });   // a man for the second ball
      return { ball, you, gk, defs: defs.slice(0, 8), mates: mates.slice(0, 8) };
    },
  },

  // ── FREE KICK ── 18-30 m out, never more than 8 m off centre (the
  // free-kick rule's own limit), outside the box. A wall roughly where the
  // rule will build it, two or three of theirs marking in the box, your men
  // there or standing by the ball. The wall itself is sized by the rule.
  free_kick: {
    count: 96,
    draw(rng, s) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const lat = rng() * 8;
      const dist = 18.5 + Math.pow(rng(), 0.8) * 11;
      const ball = { x: CX + s * lat, y: Math.max(17.6, Math.sqrt(Math.max(1, dist * dist - lat * lat))) };
      // The team's own stance at a free kick: a step to the right of the ball.
      const you = { x: ball.x + 1.3, y: ball.y + 0.15 };
      const gk = { x: CX - s * 0.6, y: 0.6 };
      // The wall: toward the near post, 9.15 m off.
      const np = { x: CX + s * 3.66, y: 0 };
      const ux = np.x - ball.x, uy = np.y - ball.y, ul = Math.hypot(ux, uy);
      const ax = -uy / ul * -s, ay = ux / ul * -s;
      const n = lat < 3 ? 4 : 3;
      const defs: V[] = [];
      for (let k = 0; k < n; k++) defs.push({ x: ball.x + ux / ul * 9.15 + ax * (k * 1.0 - 0.45), y: ball.y + uy / ul * 9.15 + ay * (k * 1.0 - 0.45) });
      const mates: V[] = [];
      const boxMen = 2 + Math.floor(rng() * 2);
      // Your men in the box stand off the shot's line (a free kick is a shot:
      // a team-mate in its path is a man you would hit), near post and back post.
      const lineX = (y: number) => ball.x + (CX - ball.x) * (1 - y / ball.y);
      for (let k = 0; k < boxMen; k++) {
        // More than 12.5 m from the ball, or the free-kick rule counts him
        // as part of the wall and takes him out of the box.
        const y = Math.max(4.5, Math.min(8.5 + rng() * 5, ball.y - 13.4));
        const side = k % 2 ? 1 : -1;
        const m = { x: lineX(y) + side * (4 + rng() * 5), y };
        mates.push(m);
        defs.push({ x: m.x + j(0.6) + (CX - m.x) * 0.05, y: m.y - 1.2 - rng() * 0.4 });
      }
      // The rest of their back line holds a line across the box (a real
      // defence at a direct free kick: wall, markers, and a zone in front of
      // goal), never nearer than 13 m to the ball.
      const zone = 1;
      for (let k = 0; k < zone; k++) defs.push({ x: CX + (k === 0 ? j(2) : (rng() < 0.5 ? -1 : 1) * (4 + rng() * 3)), y: Math.max(4.5, Math.min(6 + rng() * 4, ball.y - 13.4)) });
      if (rng() < 0.4) mates.push({ x: ball.x - s * (3 + rng() * 2), y: ball.y + 1.5 + rng() * 2 }); // a man by the ball
      if (rng() < 0.4) defs.push({ x: CX + j(6), y: Math.min(4.5 + rng() * 2, ball.y - 13.4) }); // one on the six, never in wall range
      return { ball, you, gk, defs, mates };
    },
  },

  // ── PENALTY ── the ball on the spot, you behind it, the keeper on his
  // line; two of yours and two of theirs on the edge of the box (the
  // drawings' own rule: exactly two and two), each side choosing a side.
  penalty: {
    count: 12,
    draw(rng) {
      const j = (a: number) => (rng() * 2 - 1) * a;
      const ball = { x: CX, y: 11 };
      const you = { x: CX + 1.3 * (rng() < 0.5 ? 1 : -1), y: 11.2 + rng() * 0.6 };
      const xs = [CX - 11 - rng() * 4, CX - 7.5 - rng() * 2, CX + 7.5 + rng() * 2, CX + 11 + rng() * 4];
      const order = rng() < 0.5 ? [0, 1, 0, 1] : [1, 0, 1, 0];
      const mates: V[] = [], defs: V[] = [];
      xs.forEach((x, k) => (order[k] ? mates : defs).push({ x: x + j(0.4), y: 17 + rng() * 0.8 }));
      return { ball, you, gk: { x: CX, y: -0.1 }, defs, mates };
    },
  },
};

const out: Record<string, MatchScenario> = {};
let seed = 0;
for (const [kind, k] of Object.entries(KINDS)) {
  seed++;
  const rng = mulberry32(0x5ce7a + seed * 7919);
  for (let i = 0; i < k.count; i++) {
    const s = i % 2 ? 1 : -1;
    const sc = scenario(kind, i + 1, k.draw(rng, s, i));
    out[sc.id] = sc;
  }
}
writeFileSync(OUT, JSON.stringify({
  _readme: "THE NEW BATCH'S EXTRA DRAWINGS (v0.26, new match view). Written by scripts/new-drawings.mts — read that file for what each kind's drawing is and why. Same format as authoredScenarios.json (MatchScenario, real pitch metres). Only the New chance library reads these (scripts/chance-library.mts); Classic never does.",
  scenarios: out,
}, null, 2) + "\n");
console.log(`${Object.keys(out).length} drawings → ${OUT.pathname}`);
