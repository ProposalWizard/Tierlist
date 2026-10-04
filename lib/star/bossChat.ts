import type { CareerState } from "./types";
import type { ManagerStyle } from "./manager";
import { recentForm } from "./selection";

/**
 * TALK TO YOUR MANAGER — the boss's relationship game (Mikey, 4 Oct 2026,
 * relationships revamp). Not a reflex game: a short chat. He raises
 * something from your real situation, you pick one of three replies, and
 * whether it lands depends on that situation and on his style
 * (trusting / demanding / rotational, manager.ts).
 *
 * Pure: the screen is components/star/relgames/BossChat.tsx.
 */

export type Topic = "benched" | "flying" | "slump" | "settling";

export interface Reply {
  text: string;
  /** Does it land with this manager, in this situation? */
  lands: boolean;
  /** What he says back. */
  answer: string;
}

export interface Chat {
  topic: Topic;
  opener: string;
  replies: Reply[];
}

/** What he wants to talk about: your last few matches and your place. */
export function topicFor(career: Pick<CareerState, "status" | "form">): Topic {
  const form = recentForm(career.form);
  if (career.status === "Substitute" || career.status === "Squad") return "benched";
  if (form >= 7.5) return "flying";
  if (form > 0 && form < 6) return "slump";
  return "settling";
}

export function chatFor(career: Pick<CareerState, "status" | "form" | "manager" | "player">): Chat {
  const topic = topicFor(career);
  const style: ManagerStyle = career.manager?.style ?? "trusting";
  const form = recentForm(career.form);
  const name = career.player.firstName;
  switch (topic) {
    case "benched": return {
      topic,
      opener: `${name}, you've been on the bench. You want to know why.`,
      replies: [
        { text: "I'll show you in training. Watch me.", lands: style !== "rotational" || form >= 6.5,
          answer: style === "rotational" ? "Good. Everyone gets their chance here." : "That's what I want to hear." },
        { text: "I deserve to start. You know I do.", lands: form >= 7.2 && style !== "demanding",
          answer: form >= 7.2 ? "Your numbers say you might be right." : "Deserve it? Prove it first." },
        { text: "Whatever you think is best, boss.", lands: style === "rotational",
          answer: style === "rotational" ? "That attitude gets you minutes." : "I need you hungrier than that." },
      ],
    };
    case "flying": return {
      topic,
      opener: `Good spell, ${name}. Everyone's talking about you.`,
      replies: [
        { text: "It's the lads. They make it easy for me.", lands: true, answer: "That's the right attitude. Keep it." },
        { text: "I want my contract looked at.", lands: form >= 8.2 && style === "trusting",
          answer: form >= 8.2 && style === "trusting" ? "Fair enough. Leave it with me." : "Now? Don't get ahead of yourself." },
        { text: "I've got more in me. Push me harder.", lands: style === "demanding",
          answer: style === "demanding" ? "Oh, I will." : "Steady. Don't burn yourself out." },
      ],
    };
    case "slump": return {
      topic,
      opener: `Your form's dropped off, ${name}. Talk to me.`,
      replies: [
        // Owning up always lands: there is always one right answer.
        { text: "I know. I'll fix it. No excuses.", lands: true,
          answer: "Good. I'll hold you to that." },
        { text: "The way we play doesn't suit me.", lands: false, answer: "Then adapt. The system isn't changing for you." },
        { text: "Give me a run of games and I'll find it.", lands: style === "trusting",
          answer: style === "trusting" ? "You'll get your run. Don't waste it." : "Runs are earned, not given." },
      ],
    };
    default: return {
      topic,
      opener: `How are you settling in, ${name}?`,
      replies: [
        { text: "Loving it. Ready for whatever you need.", lands: true, answer: "Good lad." },
        { text: "I'd like to know where I stand.", lands: style === "trusting",
          answer: style === "trusting" ? "Keep doing what you're doing and you'll play." : "You'll know when I pick the team." },
        { text: "I want more of the ball in games.", lands: style === "demanding" && form >= 6.8,
          answer: style === "demanding" && form >= 6.8 ? "Then demand it out there." : "Earn it first." },
      ],
    };
  }
}
