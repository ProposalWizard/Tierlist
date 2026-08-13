import { OUTCOME_TEXT, type Outcome } from "./canvasEngine";

/**
 * WHO GETS THE CREDIT.
 *
 * Lifted out of CanvasMatch so it can be tested, which it now has an earned
 * right to be: four lines that have produced two separate bugs, both invisible
 * until somebody counted. A team-mate's goal filed as yours, and a scoreline
 * that went up with nobody's name against it.
 */

export interface CreditDelta {
  shots: number; goals: number; passes: number; passesCompleted: number; chances: number; assists: number;
}

export const NO_CREDIT: CreditDelta = {
  shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0,
};

/**
 * Credit a resolved chance from WHAT ACTUALLY HAPPENED — who struck the
 * resolving shot and whether it scored — never from the scenario's SHAPE. That
 * distinction has now been the root of two separate bugs.
 *
 * The first: keying off "is this a passing scenario" dropped goals on the floor,
 * because the physics lets you shoot straight at goal in a cutback or a cross
 * without ever finding your man — ball in the net, zero credit.
 *
 * The second, and the reason this reads off the ball now: "does this scenario
 * have a finisher attached" USED to mean "you were setting somebody up". Since
 * every situation with the goal in view has a finisher attached, it came to mean
 * nothing at all — so every shot you took and missed was filed as a chance
 * created, and a match could reach half time reading SHOTS 0 after seven of them.
 *
 * Exactly one of shots/passes/chances is incremented per call, which the
 * "Chance N/N" progress counter relies on — and, since a 4-0 was found listing
 * three scorers, exactly one of goals/assists whenever the ball ends up in the
 * net.
 */
export function creditChance(
  res: Outcome,
  ctx: { youShot: boolean; receiverShot: boolean; isSimplePass: boolean },
): CreditDelta {
  const isGoal = OUTCOME_TEXT[res].kind === "goal";
  // A plain pass that reached its man and stopped there.
  if (res === "delivered") return { ...NO_CREDIT, passes: 1, passesCompleted: 1 };
  // You struck it at goal — decided at YOUR contact, and it stays your shot
  // whatever happens to it afterwards. See Ball.youStruckAtGoal: `shot` goes
  // true when a team-mate pulls the trigger too, and reading that flag here gave
  // you his goal and swallowed the assist you had just played.
  if (ctx.youShot) return { ...NO_CREDIT, shots: 1, goals: isGoal ? 1 : 0 };
  // You found a man and he had the shot.
  if (ctx.receiverShot) return { ...NO_CREDIT, chances: 1, assists: isGoal ? 1 : 0 };
  // ── A ball that went in without either of those being true ──
  //
  // A cross that curls straight in, a pass deflected past the keeper: nobody
  // struck it AT goal by isDriveAtGoal's reckoning and no team-mate touched it,
  // and it is still in the net. Both branches below used to return zero goals,
  // so the scoreline went up and nobody was credited — which is how a 4-0 came
  // to list three scorers in the feed.
  if (ctx.isSimplePass) return { ...NO_CREDIT, passes: 1, goals: isGoal ? 1 : 0 };
  return { ...NO_CREDIT, shots: 1, goals: isGoal ? 1 : 0 };
}
