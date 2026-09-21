import { buildScenario, type Scenario } from "../../lib/star/canvasEngine";
import { formationOf } from "../../lib/star/formations";
import { PLAYSTYLES } from "../../lib/star/playstyle";
import {
  applyFormationShape, defensiveLineOf, targetBlock, scoutTacticsFor,
  type ShapeInput,
} from "../../lib/star/formationShape";

/**
 * THE FORMATION POSITIONAL LAYER — measured, not assumed.
 *
 * Proves the layer does something real, with numbers: a low block sits
 * measurably deeper than a high press; a back five is measurably wider than a
 * back four; a weak side vs a strong opponent drops deeper than an even game and
 * a strong side pushes up; the keeper's depth tracks the line; and the whole
 * thing is a strict no-op when there's no formation/playstyle info, so nothing
 * existing can regress.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const note: string[] = [];

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const back4 = formationOf("433"), back5 = formationOf("352");

const input = (fId: string, style: keyof typeof PLAYSTYLES, atk: number, def: number): ShapeInput => ({
  formation: formationOf(fId), playstyle: PLAYSTYLES[style], attackerStrength: atk, defenderStrength: def,
});

/** A fresh long_range scenario for a given seed (deterministic). */
function longRange(seed: number): Scenario {
  return buildScenario("long_range", mulberry32(seed), 62, 60, 55);
}

const meanY = (sc: Scenario) => sc.defenders.reduce((s, d) => s + d.y, 0) / sc.defenders.length;
const backLineSpan = (sc: Scenario, backN: number) => {
  const xs = [...sc.defenders].sort((a, b) => a.y - b.y).slice(0, backN).map(d => d.x);
  return Math.max(...xs) - Math.min(...xs);
};

// ── 1. defensiveLineOf ──────────────────────────────────────────────────────
{
  check(defensiveLineOf(formationOf("433")).count === 4 && !defensiveLineOf(formationOf("433")).isBack5,
    "4-3-3 is a back four");
  check(defensiveLineOf(formationOf("442")).count === 4, "4-4-2 is a back four");
  check(defensiveLineOf(formationOf("4231")).count === 4, "4-2-3-1 is a back four");
  const s352 = defensiveLineOf(formationOf("352"));
  check(s352.count === 5 && s352.isBack5, "3-5-2 defends as a back five");
  check(defensiveLineOf(formationOf("3421")).isBack5, "3-4-2-1 defends as a back five");
  check(defensiveLineOf(formationOf("532")).count === 5, "5-3-2 is a back five");
}

// ── 2. Strict no-op when input is absent, and for kinds it doesn't touch ─────
{
  // null input → byte-identical, on an APPLIED kind.
  for (const seed of [1, 2, 3, 7, 99]) {
    const sc = longRange(seed);
    const before = JSON.stringify(sc);
    applyFormationShape(sc, null);
    check(JSON.stringify(sc) === before, `null input is a strict no-op (seed ${seed})`);
  }
  // A kind the layer doesn't touch → byte-identical even WITH a real input.
  // Only the genuinely-excluded kinds: dead balls with their own bespoke
  // setups, and the two with no goal in frame. one_on_one / through_ball used
  // to be listed here, back when the layer covered just long_range +
  // tight_angle — two real in-game screenshots ("6 defenders and non in
  // formation", "far too open... in the box") proved that scope wrong, so the
  // box kinds are now SHAPED and are asserted separately below.
  for (const kind of ["corner", "penalty", "free_kick", "midfield_pass", "buildup"] as const) {
    const sc = buildScenario(kind, mulberry32(50), 62, 60, 55);
    const before = JSON.stringify(sc);
    applyFormationShape(sc, input("442", "mid-block", 65, 65));
    check(JSON.stringify(sc) === before, `${kind} is left untouched by the layer`);
  }
  // Sanity: an APPLIED kind with a real input DOES change something.
  {
    const sc = longRange(4);
    const before = JSON.stringify(sc);
    applyFormationShape(sc, input("442", "high-press", 65, 65));
    check(JSON.stringify(sc) !== before, "long_range with a real input actually repositions the block");
  }
}

// ── 3. Low block sits DEEPER than high press (same formation, same seeds) ────
{
  const N = 250;
  let lowSum = 0, highSum = 0;
  for (let s = 0; s < N; s++) {
    const lo = longRange(1000 + s); applyFormationShape(lo, input("442", "low-block", 65, 65));
    const hi = longRange(1000 + s); applyFormationShape(hi, input("442", "high-press", 65, 65));
    lowSum += meanY(lo); highSum += meanY(hi);
  }
  const low = lowSum / N, high = highSum / N;
  note.push(`line depth: low-block mean ${low.toFixed(2)}m from goal vs high-press ${high.toFixed(2)}m (Δ ${(high - low).toFixed(2)}m higher up)`);
  check(low < high - 3, `a low block sits at least 3m deeper than a high press (low ${low.toFixed(2)} < high ${high.toFixed(2)})`);
}

// ── 4. Back five is WIDER than back four (same seeds, same playstyle) ────────
{
  const N = 250;
  let s4 = 0, s5 = 0;
  for (let s = 0; s < N; s++) {
    const a = longRange(2000 + s); applyFormationShape(a, input("433", "mid-block", 65, 65));
    const b = longRange(2000 + s); applyFormationShape(b, input("352", "mid-block", 65, 65));
    s4 += backLineSpan(a, 4); s5 += backLineSpan(b, 5);
  }
  const w4 = s4 / N, w5 = s5 / N;
  note.push(`back-line width: back-four ${w4.toFixed(2)}m vs back-five ${w5.toFixed(2)}m (Δ ${(w5 - w4).toFixed(2)}m wider)`);
  check(w5 > w4 + 1.5, `a back five is measurably wider than a back four (${w5.toFixed(2)} > ${w4.toFixed(2)})`);
}

// ── 5. Strength gap slides the block: weak deep, strong high ────────────────
{
  const N = 250;
  let weak = 0, even = 0, strong = 0;
  for (let s = 0; s < N; s++) {
    const w = longRange(3000 + s); applyFormationShape(w, input("442", "mid-block", 88, 45)); // you strong, they weak → they drop
    const e = longRange(3000 + s); applyFormationShape(e, input("442", "mid-block", 65, 65));
    const g = longRange(3000 + s); applyFormationShape(g, input("442", "mid-block", 45, 88)); // they strong → they push up
    weak += meanY(w); even += meanY(e); strong += meanY(g);
  }
  const wk = weak / N, ev = even / N, st = strong / N;
  note.push(`strength slide: weak-defence ${wk.toFixed(2)}m < even ${ev.toFixed(2)}m < strong-defence ${st.toFixed(2)}m from goal`);
  check(wk < ev - 1, `a weak side vs a strong opponent sits deeper than an even game (${wk.toFixed(2)} < ${ev.toFixed(2)})`);
  check(st > ev + 1, `a strong side vs a weak opponent pushes up (${st.toFixed(2)} > ${ev.toFixed(2)})`);
}

// ── 6. The keeper's depth tracks the line ───────────────────────────────────
{
  const N = 250;
  let kLow = 0, kHigh = 0;
  for (let s = 0; s < N; s++) {
    const lo = longRange(4000 + s); applyFormationShape(lo, input("442", "low-block", 65, 65));
    const hi = longRange(4000 + s); applyFormationShape(hi, input("442", "high-press", 65, 65));
    kLow += lo.keeper.y; kHigh += hi.keeper.y;
  }
  const low = kLow / N, high = kHigh / N;
  note.push(`keeper off-line: low-block ${low.toFixed(2)}m vs high-press ${high.toFixed(2)}m`);
  check(high > low + 0.5, `the keeper sits further off his line with a high line than a low block (${high.toFixed(2)} > ${low.toFixed(2)})`);
  check(low >= 1 && high <= 7, `keeper depth stays realistic (Table 5: ~1.7-4m for a 20-30m ball) — low ${low.toFixed(2)}, high ${high.toFixed(2)}`);
}

// ── 7. Placement rules are respected (goal-side of keeper, inside frame) ─────
{
  let bad = 0, total = 0;
  for (let s = 0; s < 200; s++) {
    const sc = longRange(5000 + s);
    applyFormationShape(sc, input("352", "high-press", 88, 45));
    const vp = sc.viewport;
    for (const d of sc.defenders) {
      total++;
      const behindKeeper = d.y < sc.keeper.y;                 // goal-side of the keeper
      const pastBall = d.y > sc.ball.y - 1;                   // must stay goal-side of the ball
      const outOfFrame = vp ? (d.x < vp.x1 - 0.1 || d.x > vp.x2 + 0.1 || d.y < vp.y1 - 0.1 || d.y > vp.y2 + 0.1) : false;
      if (behindKeeper || pastBall || outOfFrame) bad++;
    }
  }
  check(bad === 0, `every repositioned defender is goal-side of the keeper, goal-side of the ball, and inside the frame (${bad}/${total} broke a rule)`);
}

// ── 8. targetBlock matches the measured baseline (a worked number) ──────────
{
  // Even game, mid-block, back four, ball 25m out central → line ≈ 0.66×25 = 16.5m.
  const t = targetBlock(input("442", "mid-block", 65, 65), 34, 25);
  note.push(`targetBlock @25m, mid-block, even: line ${t.lineY.toFixed(1)}m, keeper ${t.keeperY.toFixed(1)}m, span ${t.span.toFixed(1)}m`);
  check(Math.abs(t.lineY - 16.5) < 1.5, `mid-block back line at 25m sits ~16.5m from goal (got ${t.lineY.toFixed(1)})`);
  // A back five's target span is wider than a back four's at the same ball spot.
  const s4 = targetBlock(input("433", "mid-block", 65, 65), 34, 25).span;
  const s5 = targetBlock(input("352", "mid-block", 65, 65), 34, 25).span;
  check(s5 > s4, `back-five target span wider than back-four (${s5.toFixed(1)} > ${s4.toFixed(1)})`);
}

// ── 9. scoutTacticsFor — the plain-English read ─────────────────────────────
{
  // A low-block side you're favoured against reads as deep and counter-warned.
  const t = scoutTacticsFor("Everton", 85, 55);
  check(typeof t.summary === "string" && t.summary.includes("Everton"), "scout summary names the opponent");
  check(t.favourite === "you", `strong-vs-weak reads you as favourite (got ${t.favourite})`);

  // Deterministic per club, and a genuine low-block side reads deep.
  const lowClub = scoutTacticsFor("Nottingham Forest", 55, 85); // underdog vs a strong side
  check(lowClub.favourite === "them", `underdog reads the opponent as favourite (got ${lowClub.favourite})`);

  // Same club, same inputs → identical read (deterministic).
  const a = scoutTacticsFor("Aston Villa", 70, 70);
  const b = scoutTacticsFor("Aston Villa", 70, 70);
  check(a.summary === b.summary && a.lineHeight === b.lineHeight, "scout read is deterministic per club/inputs");

  // The strength gap moves the line-height band: same club, opposite gaps.
  const club = "Brighton";
  const asFav = scoutTacticsFor(club, 90, 50);   // they drop
  const asDog = scoutTacticsFor(club, 50, 90);   // they push up
  const order = ["very deep", "deep", "medium", "high", "very high"];
  check(order.indexOf(asFav.lineHeight) <= order.indexOf(asDog.lineHeight),
    `${club} sits no higher when you're favourite than when they are (fav ${asFav.lineHeight} vs dog ${asDog.lineHeight})`);
}

// ── The two invariants the owner's in-game screenshots demanded ─────────────
// "my attackers are ALL offside" and "the defending team is far too open and
// would never leave a gap like that in the box". Both measured across every
// shaped kind × several formations × several playstyles, worst-case matchup.
{
  const SHAPED = ["long_range", "tight_angle", "one_on_one", "cutback",
    "volley", "header", "byline_cross", "through_ball"] as const;
  let offside = 0, judged = 0, emptyChannel = 0, boxScenes = 0;
  for (const kind of SHAPED) {
    for (const f of ["433", "532", "352", "4231"]) {
      for (const s of ["high-press", "low-block", "mid-block"] as const) {
        for (let i = 0; i < 20; i++) {
          const sc = buildScenario(kind, mulberry32(7700 + i), 62, 60, 55);
          applyFormationShape(sc, input(f, s, 90, 55)); // biggest gap = worst case
          const ys = sc.defenders.map(d => d.y);
          ys.push(sc.keeper.y);
          if (ys.length < 2) continue;
          ys.sort((a, b) => a - b);
          const line = ys[1];
          judged++;
          const atts: { y: number }[] = [];
          if (sc.runner) atts.push(sc.runner.pos);
          for (const r of sc.secondaryRunners) atts.push(r.pos);
          atts.push(sc.follower);
          if (atts.some(a => a.y < line - 0.01)) offside++;
          if (sc.ball.y <= 24) {
            boxScenes++;
            if (!sc.defenders.some(d => Math.abs(d.x - 34) <= 6.5)) emptyChannel++;
          }
        }
      }
    }
  }
  check(offside === 0, `no attacker is ever left offside by the layer (${offside}/${judged})`);
  check(emptyChannel === 0,
    `a box defence never leaves the central channel empty (${emptyChannel}/${boxScenes})`);
  note.push(`invariants: offside ${offside}/${judged}, empty central channel ${emptyChannel}/${boxScenes}`);
}

console.log(note.map(n => "  · " + n).join("\n"));
if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the block reshapes by formation, playstyle and strength gap, and no-ops cleanly when it should");
