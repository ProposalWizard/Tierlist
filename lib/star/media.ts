import type { CareerState, Fixture, MatchStats } from "./types";

/**
 * THE PRESS
 *
 * The dilemma system fires on a timer and asks about your life. Nothing in the
 * game ever asked you about the match you had just played.
 *
 * A press question is a dilemma with a cause. It only exists because of
 * something that actually happened — a hat-trick, a derby, a thrashing, going
 * out of a cup — and what you say moves the three relationships that decide your
 * career. It is the cheapest possible way to make a result mean something beyond
 * the table, and the only place in the career where the player gets to have a
 * personality.
 *
 * Every question offers the same three shapes, which is what makes it a decision
 * rather than a quiz: back yourself (fans up, dressing room down), back the team
 * (dressing room up, fans down), or say nothing much (nobody moves far).
 */

export interface PressOption {
  label: string;
  boss: number;
  team: number;
  fans: number;
  happiness?: number;
  /** What the papers make of it. */
  outcome: string;
}

export interface PressQuestion {
  id: string;
  headline: string;
  question: string;
  options: PressOption[];
}

/** Back yourself / back the lads / give them nothing. Reused, weighted per story. */
function standard(
  id: string,
  headline: string,
  question: string,
  scale: number,
  bold: string,
  teamFirst: string,
  guarded: string,
): PressQuestion {
  const s = (n: number) => Math.round(n * scale);
  return {
    id,
    headline,
    question,
    options: [
      {
        label: bold,
        boss: s(-2), team: s(-4), fans: s(9), happiness: 2,
        outcome: "Back pages love it. The dressing room reads it too.",
      },
      {
        label: teamFirst,
        boss: s(4), team: s(8), fans: s(2),
        outcome: "The lads appreciate that one.",
      },
      {
        label: guarded,
        boss: s(2), team: s(1), fans: s(-2),
        outcome: "Nothing anybody can use. Which was the idea.",
      },
    ],
  };
}

/**
 * What the press want to talk about, if anything.
 *
 * Ordered by what would actually lead the bulletin: a derby beats a hat-trick
 * beats a thrashing. Most matches produce nothing at all, because a press
 * conference after every league fixture would be a chore rather than a moment.
 */
export function pressQuestionFor(
  career: CareerState,
  fixture: Fixture,
  stats: MatchStats,
  derby: boolean,
  rng: () => number,
): PressQuestion | null {
  const won = stats.homeScore > stats.awayScore;
  const lost = stats.homeScore < stats.awayScore;
  const margin = Math.abs(stats.homeScore - stats.awayScore);
  const knockout = !!fixture.kind && fixture.kind !== "league";

  if (derby) {
    return won
      ? standard("derby-win", "DERBY DAY", `You beat ${fixture.opponent}. How does it feel?`, 1.4,
        "“This city is ours.”",
        "“The lads were unbelievable today.”",
        "“Three points, same as any other.”")
      : standard("derby-loss", "DERBY DAY", `${fixture.opponent} got the better of you. What went wrong?`, 1.3,
        "“I did my job. Others didn't.”",
        "“We win together and we lose together.”",
        "“We'll look at it and move on.”");
  }

  if (stats.goals >= 3) {
    return standard("hat-trick", "MATCHBALL", "Three goals. Talk us through it.", 1.2,
      "“I'm the best finisher at this club.”",
      "“The service was perfect. I just applied it.”",
      "“They went in. That's all that matters.”");
  }

  if (knockout && lost) {
    return standard("cup-out", "OUT", `Out of the ${fixture.competition}. Where does that leave you?`, 1.25,
      "“We weren't good enough, and I'll say that publicly.”",
      "“Nobody in that dressing room stopped running.”",
      "“It's a long season. We go again.”");
  }

  if (lost && margin >= 3) {
    return standard("thrashing", "TAKEN APART", `${margin} goals. The supporters want an explanation.`, 1.3,
      "“That is on all of us, and I include myself.”",
      "“They're a good side. We'll be better for it.”",
      "“I'm not going to pick anyone out in public.”");
  }

  if (won && margin >= 3) {
    return standard("rout", "RUTHLESS", `${margin} clear. Statement made?`, 1.0,
      "“When we're at it, nobody in this league lives with us.”",
      "“One good afternoon. We've won nothing yet.”",
      "“Good day at the office.”");
  }

  // Anything else: occasionally, and only when there is something to say.
  if (stats.rating >= 8.4 && rng() < 0.3) {
    return standard("standout", "MAN OF THE MATCH", "You were the difference today.", 0.9,
      "“I've been the best player on the pitch for weeks.”",
      "“Any one of eleven could have had that today.”",
      "“I'll let other people judge that.”");
  }

  return null;
}
