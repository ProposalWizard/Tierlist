import { OUTCOME_TEXT, type Outcome, type Identity, type Runner, type Scenario } from "./canvasEngine";

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
  ctx: {
    youShot: boolean; receiverShot: boolean; isSimplePass: boolean;
    /** From assistFor (below): false when another team-mate played the ball
     *  between your touch and the scorer's. Absent means true. */
    assistYours?: boolean;
  },
): CreditDelta {
  const isGoal = OUTCOME_TEXT[res].kind === "goal";
  // Touch Mode's own continuation (Boot.extraTouch) — a genuinely uncontested
  // touch of your own that just repositions the same attempt, never a new
  // shot or pass. Checked first, same as `delivered` below, so it can never
  // fall through into the generic "you struck it" branch and get credited
  // as a shot it never was.
  if (res === "touchOn") return NO_CREDIT;
  // A plain pass that reached its man and stopped there.
  if (res === "delivered") return { ...NO_CREDIT, passes: 1, passesCompleted: 1 };
  // You struck it at goal — decided at YOUR contact, and it stays your shot
  // whatever happens to it afterwards. See Ball.youStruckAtGoal: `shot` goes
  // true when a team-mate pulls the trigger too, and reading that flag here gave
  // you his goal and swallowed the assist you had just played.
  if (ctx.youShot) return { ...NO_CREDIT, shots: 1, goals: isGoal ? 1 : 0 };
  // You found a man and he had the shot. The assist is yours only if nobody
  // else in your shirt played it in between (see assistFor).
  if (ctx.receiverShot) {
    const yours = ctx.assistYours !== false;
    return { ...NO_CREDIT, passes: 1, passesCompleted: 1, assists: isGoal && yours ? 1 : 0 };
  }
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

// ── WHOSE ASSIST IS IT? ───────────────────────────────────────────────────────
//
// Harry, playing a real match (1 Oct 2026 review, 14:28): "I still get an
// assist for that even though I wasn't the one who actually assisted him." You
// passed, a team-mate scored — but somebody else in your shirt played the ball
// in between, and the old rule gave you the assist anyway: `creditChance` saw
// "a team-mate shot" and stopped looking. Measured on the real engine (pass to
// the runner, played out; tests/star/assistCredit.mts): 14% of the team-mate
// goals you were credited with had another man's shot in between (his shot
// saved or blocked, a different man put the rebound in), and with a captain's
// lay-off ordered, 75% did (your pass, his lay-off, a third man scored).
//
// The rule now: the assist goes to the last team-mate who played the ball
// before the scorer struck it — a lay-off, or a shot that came back off the
// keeper, the post or a defender. If nobody else touched it, it is yours. The
// rebound rule stays as it was for your own shot (your shot saved and put in
// by a team-mate is still your assist), and the same now holds for his.

/** One team-mate play of the ball during a chance, in the order they happened. */
export interface MatePlay {
  kind: "shot" | "layoff";
  /** Stable per man for the chance: his identity id, or his slot when he has none. */
  key: string;
  who?: Identity;
}

/** The scenario fields read before a tick, to see what the tick did. */
export interface MatePlayProbe {
  receivedBy: Runner | null | undefined;
  receiverShots: number;
  relayed: boolean;
  followerShot: boolean;
}

export function probeMatePlays(sc: Scenario): MatePlayProbe {
  return {
    receivedBy: sc.receivedBy,
    receiverShots: sc.receiverShots ?? 0,
    relayed: sc.relayed === true,
    followerShot: sc.follower.shot === true,
  };
}

/** Who a Runner is, for comparing touches. The man in the box is rebuilt as a
 *  fresh Runner every tick he can receive, so he is keyed as the follower. */
function keyOf(sc: Scenario, r: Runner | null | undefined): { key: string; who?: Identity } {
  if (!r) return { key: "unknown" };
  if (r.who) return { key: `id:${r.who.id}`, who: r.who };
  if (r === sc.runner) return { key: "runner" };
  const i = sc.secondaryRunners.indexOf(r);
  if (i >= 0) return { key: `support${i}` };
  return { key: sc.follower.who ? `id:${sc.follower.who.id}` : "follower", who: sc.follower.who };
}

/**
 * Compare the scenario after a stepBall tick with the probe taken before it,
 * and append whatever team-mate play happened: a lay-off (`relayed` flips on)
 * or a shot (`receiverShots` goes up — the follower's poke-in when his `shot`
 * flag flipped, otherwise the man who has the ball).
 */
export function noteMatePlays(plays: MatePlay[], before: MatePlayProbe, sc: Scenario): void {
  if (!before.relayed && sc.relayed === true) {
    plays.push({ kind: "layoff", ...keyOf(sc, before.receivedBy) });
  }
  if ((sc.receiverShots ?? 0) > before.receiverShots) {
    if (!before.followerShot && sc.follower.shot === true) {
      const who = sc.follower.who;
      plays.push({ kind: "shot", key: who ? `id:${who.id}` : "follower", who });
    } else {
      plays.push({ kind: "shot", ...keyOf(sc, sc.receivedBy) });
    }
  }
}

/**
 * Whose assist a team-mate's goal is, from the plays logged during the chance.
 * The scorer is whoever struck last; the assist is the last play before it by
 * anybody else. Nobody else → yours.
 */
export function assistFor(plays: MatePlay[]): { yours: boolean; by?: MatePlay } {
  let last = -1;
  for (let i = plays.length - 1; i >= 0; i--) if (plays[i].kind === "shot") { last = i; break; }
  if (last < 0) return { yours: true };
  const scorer = plays[last].key;
  for (let i = last - 1; i >= 0; i--) {
    if (plays[i].key !== scorer) return { yours: false, by: plays[i] };
  }
  return { yours: true };
}
