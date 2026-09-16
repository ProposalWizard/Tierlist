import { OUTCOME_TEXT } from "../../lib/star/canvasEngine";
import { creditChance, NO_CREDIT } from "../../lib/star/credit";

/**
 * TOUCH MODE'S OWN PURE HALF.
 *
 * Boot.extraTouch — requested directly: "these boots give the player an
 * extra touch... u do a normal aim and kick... HOWEVER with this touch
 * mode on ur player chases the ball and if he gets to it then the game
 * stops again and he has another aim and kick thing again."
 *
 * Almost all of the actual mechanism is a CanvasMatch.tsx-level remap of
 * stepBall's own "short" into the new "touchOn" Outcome, and a matching
 * chain branch in resolveOutcome — React-component code this suite can't
 * reach, same limitation every other pointer/gesture fix in this codebase
 * has always had. What IS pure, exported, and worth a real regression test
 * is creditChance's own "touchOn" branch: a genuinely uncontested touch of
 * your own that repositions the same attempt is not a new shot or a new
 * pass, and credit.ts's own doc records two real historical bugs from
 * exactly this class of mistake (a team-mate's goal filed as yours; a
 * scoreline with nobody credited) — worth a real check, not an assumption.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── touchOn is declared neutral, never a goal ────────────────────────────
{
  check(OUTCOME_TEXT.touchOn.kind === "neutral", `touchOn is a neutral outcome, never "goal" (${OUTCOME_TEXT.touchOn.kind})`);
}

// ── touchOn never credits a shot, a pass, or a chance — whatever the
// surrounding context claims. Fuzzed across every ctx combination, since
// the whole point of checking it first in creditChance is that NOTHING
// downstream (youShot, receiverShot, isSimplePass) can override it. ──────
{
  let wrong = 0;
  for (const youShot of [true, false]) {
    for (const receiverShot of [true, false]) {
      for (const isSimplePass of [true, false]) {
        const d = creditChance("touchOn", { youShot, receiverShot, isSimplePass });
        if (JSON.stringify(d) !== JSON.stringify(NO_CREDIT)) wrong++;
      }
    }
  }
  check(wrong === 0, `touchOn credits nothing at all, under any context (${wrong}/8 combinations got something)`);
}

// ── …and, for real contrast, an ordinary shot right next to it still
// credits normally — touchOn's early return isn't accidentally swallowing
// every outcome, just its own. ───────────────────────────────────────────
{
  const goalShot = creditChance("goal", { youShot: true, receiverShot: false, isSimplePass: false });
  check(goalShot.shots === 1 && goalShot.goals === 1, `a real goal you struck still credits shots+goals normally (${JSON.stringify(goalShot)})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — Touch Mode's own touchOn outcome is neutral and never credited as a shot or pass");
