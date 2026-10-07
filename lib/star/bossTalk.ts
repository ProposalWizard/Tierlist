import type { CareerState } from "./types";
import { mulberry32 } from "./season";
import { playstyleForManager, playstyleForClub, type Playstyle } from "./playstyle";
import { bossGain, BOSS_KICKS } from "./bossPenalties";

/**
 * OFFICE TALK — one of the three manager games (Harry, 6 Oct 2026:
 * "all 3 choices for manager"; MANAGER_PLAN.md).
 *
 * The old chat (bossChat.ts) was dropped by Mikey for being "too easy to
 * read": one reply always sounded like the one he'd like. This one fixes that
 * by tying the right answer to WHO the manager is, not to which reply sounds
 * nicest.
 *
 *  - His STYLE comes from how he sets his side up (playstyle.ts): a famous
 *    name's own style, otherwise a fixed roll off his name — the same man
 *    always wants the same thing, so it can be learnt about HIM.
 *  - Each style VALUES one thing:
 *      high press        → effort        (run, chase, more)
 *      possession        → ideas         (see it, think, find the pass)
 *      low block/counter → discipline    (do your job, stick to the plan)
 *      mid-block         → professional  (steady, reliable, no drama)
 *  - 3 rounds. Each round he says a line that hints at his style without
 *    naming it. You get 3 replies, each one of those values: the one he
 *    values (+1), a neutral one (0), and the one that clashes with him (−1).
 *    Every value is the best answer for exactly one style and the clash for
 *    another, so no reply wording is "the nice one".
 *  - Your last match shifts one round: after a poor game he tests how you
 *    take it; after a good one, whether it went to your head.
 *  - Score = max(0, total). It goes through the penalties' own scale
 *    (bossGain): 3 → +6, 2 → +4, 1 → +2, 0 → −2.
 *
 * Pure: the screen is components/star/relgames/BossChat.tsx.
 */

export type BossValue = "effort" | "ideas" | "discipline" | "professional";
export type TalkStyle = "press" | "possession" | "low" | "mid";
export type Grade = "best" | "neutral" | "clash";

export const TALK_ROUNDS = BOSS_KICKS;

export const STYLE_VALUE: Record<TalkStyle, BossValue> = {
  press: "effort",
  possession: "ideas",
  low: "discipline",
  mid: "professional",
};

/** What each style can't stand: the reply that goes down worst. */
export const STYLE_CLASH: Record<TalkStyle, BossValue> = {
  press: "ideas",          // "give me freedom" — he wants you chasing
  possession: "discipline", // "nothing more, nothing less" — he wants a footballer
  low: "effort",           // "I'll chase everything" — that breaks his shape
  mid: "ideas",            // hero ball — he wants reliable
};

export const GRADE_POINTS: Record<Grade, number> = { best: 1, neutral: 0, clash: -1 };

export function styleFromPlaystyle(p: Playstyle): TalkStyle {
  if (p === "high-press") return "press";
  if (p === "possession") return "possession";
  if (p === "mid-block") return "mid";
  return "low"; // low-block and counter both sit off and want the job done
}

/** The manager's style: a famous name's real style, else a fixed roll off his name. */
export function managerTalkStyle(name: string): TalkStyle {
  const known = playstyleForManager(name);
  if (known) return styleFromPlaystyle(known.id);
  return styleFromPlaystyle(playstyleForClub(`manager:${name}`).id);
}

export type TalkTopic = "training" | "role" | "teammate" | "tactics" | "media" | "bad-game" | "good-game";
const OPEN_TOPICS: TalkTopic[] = ["training", "role", "teammate", "tactics", "media"];

/** His lines: two per style per topic. They hint; they never name the style. */
const HINTS: Record<TalkTopic, Record<TalkStyle, [string, string]>> = {
  training: {
    press: ["I had the running numbers on my desk at seven. Some of them were embarrassing.", "Training was flat today. I want it at a hundred miles an hour."],
    possession: ["I stopped the session twice today. Nobody was looking up.", "I don't want robots out there. I want players who think."],
    low: ["Somebody wandered out of position in the shape drill. Again.", "We drilled the back line for an hour today. That's how we win games."],
    mid: ["It's a long season. I want the same player on a wet Tuesday as on derby day.", "No dramas this week. That's how I like it."],
  },
  role: {
    press: ["When we lose it, I want you first to the ball. Every time.", "Our defending starts with the front players. Remember that."],
    possession: ["I want you on the ball more. Show for it, even when it's tight.", "The best players I've had wanted the ball in the hard places."],
    low: ["Your job comes first. The fancy stuff can wait.", "When I say hold, you hold. Even when the space looks lovely."],
    mid: ["I don't need a hero. I need someone I can count on.", "Do the simple things well, and keep doing them."],
  },
  teammate: {
    press: ["One of the lads stopped running in the second half. I noticed. Did you?", "I want a dressing room that hates losing a sprint."],
    possession: ["One of the lads keeps hitting it long. Panic. I hate panic.", "I want the senior lads talking the young ones through games."],
    low: ["Somebody was late for the bus. I've fined him. The group needs to see that.", "One player doing his own thing and the whole plan goes."],
    mid: ["A couple of the lads are falling out. It needs to calm down.", "The group's been noisy this week. I want it settled."],
  },
  tactics: {
    press: ["They hate being hurried. We hunt them in packs on Saturday.", "Saturday we squeeze them from the first whistle."],
    possession: ["Saturday we keep the ball. Fifty passes if that's what it takes.", "They'll sit deep on Saturday. We need to be cleverer than them."],
    low: ["Saturday we stay compact and let them come. Patience.", "Keep it tight for an hour and the game comes to us."],
    mid: ["Saturday we adapt. Whatever they do, we stay calm.", "No big plan for Saturday. Read the game, play the game."],
  },
  media: {
    press: ["The papers say we fade late on. I want them proved wrong in the last ten minutes.", "Someone wrote that we're tired. Are you tired?"],
    possession: ["The papers say we pass it sideways. They don't understand what we're building.", "A pundit called us boring. I call it control."],
    low: ["The papers say we're negative. I don't care. Clean sheets win things.", "They called us anti-football. Three points is three points."],
    mid: ["The papers want a headline. Don't give them one.", "Say nothing to the press this week. Nothing that makes a story."],
  },
  "bad-game": {
    press: ["Saturday. You stopped running after the hour. Explain that.", "Saturday. I watched you jog back twice. Twice."],
    possession: ["Saturday. You kept giving it away. What were you seeing?", "Saturday. Every time you got it, you rushed it. Why?"],
    low: ["Saturday. You left your man twice. That's not what we agreed.", "Saturday. You went walkabout. I had to change the shape for you."],
    mid: ["Saturday wasn't you. It happens. What now?", "Saturday was a bad day. Everybody has them. How are you taking it?"],
  },
  "good-game": {
    press: ["Good Saturday. Now do it again with your lungs burning.", "You were good on Saturday. I still want more legs from you."],
    possession: ["Good Saturday. I liked the pass before the goal more than the goal.", "Saturday you saw things early. That's what I want."],
    low: ["Good Saturday. And you still tracked back in the ninetieth minute. That's the bit I liked.", "Saturday you did your job and then some. Good."],
    mid: ["Good Saturday. Don't get carried away.", "Nice game on Saturday. Let's not make a fuss about it."],
  },
};

/** Your replies: one per value, per topic. All of them are reasonable things to say. */
const REPLIES: Record<TalkTopic, Record<BossValue, string>> = {
  training: {
    effort: "I'll stay out after the session and do the extra running.",
    ideas: "I've been looking at where the space opens up in the drills.",
    discipline: "Tell me where you want me and I'll be there, every rep.",
    professional: "Same as always: eat right, sleep right, turn up ready.",
  },
  role: {
    effort: "I'll chase every ball. They won't get a second on it.",
    ideas: "Give me a bit of freedom and I'll find you something.",
    discipline: "I'll do the job you set. Nothing more, nothing less.",
    professional: "I'll keep it steady. You'll always know what you get from me.",
  },
  teammate: {
    effort: "I'll set the tone. If I'm running, they'll run.",
    ideas: "I'll talk him through it and show him the other option.",
    discipline: "Rules are rules. If he's out of line, he's out of line.",
    professional: "I'll keep my head down and let my football do the talking.",
  },
  tactics: {
    effort: "I'll run them into the ground.",
    ideas: "I've watched their full-back. He turns slowly. I can use that.",
    discipline: "I'll stick to the plan, whatever happens in the game.",
    professional: "I'll be ready for whatever the game needs on the day.",
  },
  media: {
    effort: "Then I'll be the one still sprinting at the end.",
    ideas: "Let them talk. They'll see what we're doing soon enough.",
    discipline: "I don't read it. I listen to you, not them.",
    professional: "No comment from me. I'll just get on with it.",
  },
  "bad-game": {
    effort: "That's on me. I'll work twice as hard this week to put it right.",
    ideas: "I was trying things that weren't on. I've watched it back and I know why.",
    discipline: "I didn't do my job. It won't happen again.",
    professional: "One bad day. I'll reset and go again, same as always.",
  },
  "good-game": {
    effort: "Thanks, boss. I've got more running in me than that.",
    ideas: "I felt sharp. I could see things a second earlier.",
    discipline: "I just did what you asked of me.",
    professional: "Nice to hear. Next game's the one that matters now.",
  },
};

/** What he says back. Two per style per grade, so it is a reaction, not a code. */
const ANSWERS: Record<TalkStyle, Record<Grade, [string, string]>> = {
  press: {
    best: ["That's what I want. Keep that up.", "Good. Show me on the grass."],
    neutral: ["Hm. Fine.", "Right. We'll see."],
    clash: ["That's not how we play here.", "Freedom? Earn it by running first."],
  },
  possession: {
    best: ["Good. That's a footballer talking.", "Yes. Exactly that."],
    neutral: ["Okay. Moving on.", "Fine. Let's see it."],
    clash: ["I don't need a soldier. I need a footballer.", "Think for yourself out there. Please."],
  },
  low: {
    best: ["Good lad. That's what this club needs.", "That's the answer. Keep it like that."],
    neutral: ["Hm. Okay.", "Right. Fine."],
    clash: ["No. You'll do it my way.", "Chasing everything leaves holes. Not in my team."],
  },
  mid: {
    best: ["Sensible. That's what I wanted to hear.", "Good. Steady does it."],
    neutral: ["Okay. Noted.", "Right. We'll see."],
    clash: ["Calm down. Nobody needs a hero.", "Keep it simple. That's all I ask."],
  },
};

export interface TalkReply {
  text: string;
  value: BossValue;
  grade: Grade;
  answer: string;
}

export interface TalkRound {
  topic: TalkTopic;
  line: string;
  /** In the order they're shown (shuffled). */
  replies: TalkReply[];
}

export interface BossTalk {
  style: TalkStyle;
  rounds: TalkRound[];
}

const ALL_VALUES: BossValue[] = ["effort", "ideas", "discipline", "professional"];

export function gradeOf(style: TalkStyle, value: BossValue): Grade {
  if (STYLE_VALUE[style] === value) return "best";
  if (STYLE_CLASH[style] === value) return "clash";
  return "neutral";
}

/** Which round your last match takes over (if any): poor → accountability, good → humility. */
export function formTopic(lastRating: number | undefined): TalkTopic | null {
  if (lastRating === undefined || !Number.isFinite(lastRating) || lastRating <= 0) return null;
  if (lastRating < 6) return "bad-game";
  if (lastRating >= 7.5) return "good-game";
  return null;
}

function nameHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Build one talk. Pure: the same inputs and seed give the same talk. */
export function buildTalk(opts: { managerName: string; lastRating?: number; seed: number }): BossTalk {
  const style = managerTalkStyle(opts.managerName);
  const rng = mulberry32((opts.seed ^ nameHash(opts.managerName)) >>> 0);
  const pool = [...OPEN_TOPICS];
  const topics: TalkTopic[] = [];
  while (topics.length < TALK_ROUNDS) topics.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  const ft = formTopic(opts.lastRating);
  if (ft) topics[1] = ft; // the middle round: after he's settled in

  const best = STYLE_VALUE[style];
  const clash = STYLE_CLASH[style];
  const others = ALL_VALUES.filter((v) => v !== best && v !== clash);
  const rounds: TalkRound[] = topics.map((topic) => {
    const neutral = others[Math.floor(rng() * others.length)];
    const replies: TalkReply[] = [best, neutral, clash].map((value) => {
      const grade = gradeOf(style, value);
      const pair = ANSWERS[style][grade];
      return { text: REPLIES[topic][value], value, grade, answer: pair[Math.floor(rng() * 2)] };
    });
    for (let i = replies.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [replies[i], replies[j]] = [replies[j], replies[i]];
    }
    const hints = HINTS[topic][style];
    return { topic, line: hints[Math.floor(rng() * 2)], replies };
  });
  return { style, rounds };
}

/** The talk for this week of this career. */
export function talkFor(career: Pick<CareerState, "manager" | "form" | "season" | "week">, salt = 0): BossTalk {
  return buildTalk({
    managerName: career.manager?.name ?? "The manager",
    lastRating: career.form?.[0],
    seed: career.season * 7307 + career.week * 131 + salt,
  });
}

/** Points for a set of picked grades → the boss bar's move (the penalties' scale). */
export function talkHits(grades: Grade[]): number {
  return Math.max(0, grades.reduce((s, g) => s + GRADE_POINTS[g], 0));
}
export function talkGain(grades: Grade[]): number {
  return bossGain(talkHits(grades));
}
