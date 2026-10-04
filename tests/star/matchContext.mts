import {
  newMatch, advanceUntilInvolved, resolveScenario, noteServedKind, weightKinds, playstyleAt,
  type HiddenMatchInputs, type ScenarioResult, type Zone, type MatchContext,
} from "../../lib/star/hiddenMatch";
import { rollKind, SETTLED_ONE_ON_ONE } from "../../lib/star/chanceMaker";
import { withoutSwitchedOff } from "../../lib/star/switchedOffKinds";
import type { ScenarioKind } from "../../lib/star/canvasEngine";
import {
  ENERGY_FULL_MATCH_LOW, ENERGY_FULL_MATCH_MEDIUM, ENERGY_FULL_MATCH_HIGH,
  fatigueCut, tiredKickSkills,
} from "../../lib/star/energy";

/**
 * MATCH CONTEXT (v0.26, Harry): playstyle, the strength gap, team-mates,
 * fans, your stats, energy cost and fatigue, and fewer back-to-back repeats
 * of the same kind of chance. Measured over whole simulated matches with a
 * stand-in player; the kind is rolled the way the chance maker rolls it
 * (rollKind). Bounds sit around the numbers measured when this was built —
 * the report lists the before/after of each.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function standIn(zone: Zone, rng: () => number): ScenarioResult {
  const r = rng();
  if (zone === "box") return r < 0.24 ? "goal" : r < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return r < 0.11 ? "goal" : r < 0.6 ? "saved" : r < 0.85 ? "delivered" : "lost";
  return r < 0.72 ? "delivered" : "lost";
}

interface Result { perMatch: number; b2b: number; conceded: number; share: (k: string) => number }

function measure(inputs: HiddenMatchInputs, opts: { note?: boolean; n?: number } = {}): Result {
  const n = opts.n ?? 800;
  let chances = 0, pairs = 0, same = 0, conc = 0;
  const mix: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(1 + i * 7919);
    const st = newMatch(rng);
    let last: string | null = null;
    while (st.minute < 90) {
      const step = advanceUntilInvolved(st, inputs, rng, 90);
      if (!step.request) break;
      const req = step.request;
      let kind: string;
      if (req.dribble) kind = "dribble";
      else {
        let offered = withoutSwitchedOff(req.kinds);
        if (req.pattern !== "transition" && offered.includes("one_on_one") && rng() >= SETTLED_ONE_ON_ONE) {
          const kept = offered.filter((k) => k !== "one_on_one");
          if (kept.length) offered = kept;
        }
        kind = rollKind({ ...req, kinds: offered }, inputs.position ?? "ST", rng);
        if (opts.note) noteServedKind(st, kind as ScenarioKind);
      }
      chances++;
      mix[kind] = (mix[kind] ?? 0) + 1;
      if (last !== null) { pairs++; if (last === kind) same++; }
      last = kind;
      resolveScenario(st, standIn(req.zone, rng));
    }
    conc += st.oppScore;
  }
  return {
    perMatch: chances / n,
    b2b: same / Math.max(1, pairs),
    conceded: conc / n,
    share: (k) => (mix[k] ?? 0) / Math.max(1, chances),
  };
}

const base = (o: Partial<HiddenMatchInputs> = {}): HiddenMatchInputs => ({
  teamStrength: 75, oppStrength: 75, playerSkill: 60, pace: 60, freeKick: 50,
  position: "ST", livePenalties: true, home: true, ...o,
});
const ctx = (c: MatchContext = {}) => ({ context: c });

// ── 0. No context, no noted kinds: the request list is untouched ──
{
  const st = newMatch(mulberry32(3));
  const kinds: ScenarioKind[] = ["cutback", "byline_cross", "tight_angle"];
  check(weightKinds(kinds, st, base()) === kinds, "no context: weightKinds must hand back the very same list");
  check(weightKinds(["corner"], st, base(ctx({ playstyle: "attacking" }))).length === 1, "a set piece (one kind) is never multiplied");
  check(playstyleAt(undefined, 50) === "balanced", "absent playstyle reads as balanced");
  check(playstyleAt({ playstyle: "defensive", playstyleChanges: [{ minute: 40, playstyle: "attacking" }] }, 39) === "defensive"
    && playstyleAt({ playstyle: "defensive", playstyleChanges: [{ minute: 40, playstyle: "attacking" }] }, 40) === "attacking",
    "a mid-match playstyle switch takes over from its own minute");
}

// ── 1. The strength gap: chances per match ──
// Before v0.26 (no context): −25 4.47 · −10 5.68 · 0 6.63 · +10 7.50 · +25 9.34.
{
  const per = [-25, -10, 0, 10, 25].map((g) => measure(base({ oppStrength: 75 - g, ...ctx() })).perMatch);
  const old = [-25, 25].map((g) => measure(base({ oppStrength: 75 - g })).perMatch);
  console.log("gap −25/−10/0/+10/+25 chances:", per.map((x) => x.toFixed(2)).join(" "), " (no context −25/+25:", old.map((x) => x.toFixed(2)).join(" "), ")");
  for (let i = 1; i < per.length; i++) check(per[i] > per[i - 1], "chances must rise with the gap in your favour");
  check(Math.abs(per[2] - 6.63) < 0.25, `level game unchanged (~6.63), got ${per[2].toFixed(2)}`);
  check(per[0] < old[0] - 0.4, `−25: fewer chances than before (${old[0].toFixed(2)}), got ${per[0].toFixed(2)}`);
  check(per[4] > old[1] + 0.4, `+25: more chances than before (${old[1].toFixed(2)}), got ${per[4].toFixed(2)}`);
}

// ── 2. Playstyle ──
{
  const strongOpp = (ps: "defensive" | "balanced" | "attacking") => measure(base({ oppStrength: 100, ...ctx({ playstyle: ps }) }));
  const def = strongOpp("defensive"), bal = strongOpp("balanced"), att = strongOpp("attacking");
  console.log(`v a side 25 better — chances D/B/A: ${def.perMatch.toFixed(2)} ${bal.perMatch.toFixed(2)} ${att.perMatch.toFixed(2)}; conceded ${def.conceded.toFixed(2)} ${bal.conceded.toFixed(2)} ${att.conceded.toFixed(2)}`);
  check(def.perMatch > bal.perMatch + 0.4, "Defensive gets you into the game against a much better side");
  check(def.conceded < bal.conceded && att.conceded > bal.conceded, "Defensive concedes less, Attacking more");
  const deep = (r: Result) => r.share("buildup") + r.share("midfield_pass") + r.share("through_ball") + r.share("long_range");
  const box = (r: Result) => r.share("one_on_one") + r.share("cutback") + r.share("byline_cross") + r.share("tight_angle");
  const level = (ps: "defensive" | "balanced" | "attacking") => measure(base(ctx({ playstyle: ps })));
  const lD = level("defensive"), lB = level("balanced"), lA = level("attacking");
  console.log(`level game — deep share D/B/A ${(100 * deep(lD)).toFixed(1)} ${(100 * deep(lB)).toFixed(1)} ${(100 * deep(lA)).toFixed(1)}; box share ${(100 * box(lD)).toFixed(1)} ${(100 * box(lB)).toFixed(1)} ${(100 * box(lA)).toFixed(1)}`);
  check(deep(lD) > deep(lB) + 0.05, "Defensive: more build-up/deep chances");
  check(box(lA) > box(lB) + 0.03, "Attacking: more box chances");
  check(deep(lA) < deep(lB) - 0.03, "Attacking: less build-up");
  check(lA.conceded > lB.conceded && lD.conceded < lB.conceded, "concede a little more on Attacking, less on Defensive (level game)");
}

// ── 3. Team-mates (strongest) and fans (small) ──
{
  const rel = [20, 60, 100].map((r) => measure(base({ position: "CAM", ...ctx({ teamRelationship: r }) })).perMatch);
  const fans = [20, 50, 100].map((f) => measure(base({ position: "CAM", ...ctx({ fanRelationship: f }) })).perMatch);
  console.log("CAM team-mates 20/60/100:", rel.map((x) => x.toFixed(2)).join(" "), " fans 20/50/100:", fans.map((x) => x.toFixed(2)).join(" "));
  check(rel[0] < rel[1] - 0.4 && rel[2] > rel[1] + 0.3, "team-mates move how often the ball finds you");
  check(fans[0] < fans[1] && fans[2] > fans[1], "fans move it a little");
  check((fans[2] - fans[0]) < (rel[2] - rel[0]) / 2, "team-mates matter much more than fans");
}

// ── 4. Your stats lean the kind, gently ──
{
  const m = (s: MatchContext["skills"]) => measure(base({ position: "CAM", ...ctx({ skills: s }) }));
  const flat = m({ pace: 50, power: 50, technique: 50, vision: 50 });
  const shooter = m({ pace: 50, power: 95, technique: 95, vision: 50 });
  const passer = m({ pace: 50, power: 50, technique: 50, vision: 95 });
  console.log(`long range flat/shooter ${(100 * flat.share("long_range")).toFixed(1)} ${(100 * shooter.share("long_range")).toFixed(1)}; through ball flat/passer ${(100 * flat.share("through_ball")).toFixed(1)} ${(100 * passer.share("through_ball")).toFixed(1)}`);
  check(shooter.share("long_range") > flat.share("long_range") * 1.08, "power+technique lean toward long range");
  check(passer.share("through_ball") > flat.share("through_ball") * 1.06, "vision leans toward through balls");
  check(shooter.share("long_range") < flat.share("long_range") * 1.6, "gentle: never locks you into one kind");
}

// ── 5. Back-to-back repeats of the same kind ──
// Before: a striker saw the same kind twice running 18.2% of the time.
{
  const before = measure(base());
  const after = measure(base(), { note: true });
  console.log(`same kind back to back: ${(100 * before.b2b).toFixed(1)}% → ${(100 * after.b2b).toFixed(1)}%`);
  check(after.b2b < before.b2b * 0.75, "noting served kinds cuts back-to-back repeats by a quarter or more");
  check(Math.abs(after.perMatch - before.perMatch) < 0.01, "repeat weighting changes WHICH chance, never how many");
}

// ── 6. Energy: cost per mode, and fatigue on your stats ──
{
  check(ENERGY_FULL_MATCH_HIGH >= 115, `High costs much more than before (95), got ${ENERGY_FULL_MATCH_HIGH}`);
  check(ENERGY_FULL_MATCH_LOW <= 25 && ENERGY_FULL_MATCH_MEDIUM === 60, "Low cheaper, Medium unchanged");
  const at = (e: number) => tiredKickSkills({ power: 80, technique: 80 }, e).power;
  console.log("power 80 at energy 100/80/50/19:", [100, 80, 50, 19].map((e) => at(e).toFixed(1)).join(" "));
  check(at(100) === 80 && at(80) > 79, "80 energy is about full strength");
  check(at(19) < 56, "19 energy is clearly weaker");
  for (let e = 0; e < 100; e++) check(fatigueCut(e) >= fatigueCut(e + 1), "fatigue never grows as energy rises");
}

if (problems.length) {
  console.error("FAIL\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("matchContext: all checks passed");
