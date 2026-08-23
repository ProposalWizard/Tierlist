import type { Template } from "./index";

/**
 * SUPPORTERS.
 *
 * The accounts with no editorial standards, which is what makes them the ones
 * that read like people. A fan account does not report a result; it has a
 * feeling about it, in lower case, without a full stop.
 *
 * The rival is the same machinery with the sign flipped — see `allegiance()` in
 * select.ts, which inverts their interest so they show up for your bad
 * afternoons and stay away from the good ones. Almost everything that makes them
 * feel like rivals is that one flip, not the words here.
 */

export const SOCIAL_TEMPLATES: Template[] = [
  // ── Your supporters ───────────────────────────────────────────────────────
  {
    id: "fan-goal", archetype: "fan", tags: ["goal"], frames: ["celebrate", "hype"], requires: ["short"],
    body: "{short} you absolute beauty",
    weight: 3,
  },
  {
    id: "fan-goal-2", archetype: "fan", tags: ["goal"], frames: ["celebrate", "hype"],
    body: "im actually shaking. what a player",
    weight: 2,
  },
  {
    id: "fan-hattrick", archetype: "fan", events: ["hat-trick", "four-goals", "five-goals"],
    requires: ["short"],
    body: "{short|caps}!!!! get in!!! best in the league and its not close",
    weight: 4,
  },
  {
    id: "fan-late", archetype: "fan", events: ["late-winner"], requires: ["minute"],
    body: "{minute}th minute. i have lost my voice. worth it",
    weight: 4,
  },
  {
    id: "fan-screamer", archetype: "fan", events: ["screamer", "special-goal"],
    body: "have you SEEN that goal. rewind it. again. again",
    weight: 3,
  },
  {
    id: "fan-derby", archetype: "fan", events: ["derby-win"], excludes: ["derbyName"],
    body: "there is no better feeling than beating that lot. none",
    weight: 4,
  },
  {
    id: "fan-derby-named", archetype: "fan", events: ["derby-win"], requires: ["derbyName"],
    body: "WE'VE WON THE {derbyName|caps}. i am never getting over this",
    weight: 4,
  },
  {
    id: "fan-derby-loss", archetype: "fan", events: ["derby-loss"], frames: ["lament"],
    excludes: ["derbyName"],
    body: "not talking to anyone until next season",
    weight: 3,
  },
  {
    id: "fan-derby-loss-named", archetype: "fan", events: ["derby-loss"], frames: ["lament"],
    requires: ["derbyName"],
    body: "losing the {derbyName|lower} to THEM. i can't be seen in public",
    weight: 3,
  },
  {
    id: "fan-comeback", archetype: "fan", events: ["comeback"], requires: ["deficit"],
    body: "{deficit} down at half time and we won. this club will kill me",
    weight: 3,
  },
  {
    id: "fan-loss", archetype: "fan", events: ["loss", "hammered", "collapse"], frames: ["lament"],
    body: "same every year. every single year",
    weight: 2,
  },
  {
    id: "fan-crisis", archetype: "fan", events: ["losing-run", "into-the-drop"], frames: ["lament"],
    requires: ["matches"],
    body: "{matches} in a row now. someone do something",
  },
  {
    id: "fan-top", archetype: "fan", events: ["went-top", "champions"],
    body: "TOP OF THE LEAGUE. dont care if its temporary. framing it",
    weight: 3,
  },
  {
    id: "fan-debut", archetype: "fan", events: ["debut", "club-debut"],
    body: "remember the name. absolutely remember the name",
  },
  {
    id: "fan-milestone", archetype: "fan", tags: ["milestone"], requires: ["milestone"],
    body: "{milestone} for this man. getting the shirt printed",
  },
  {
    id: "fan-trophy", archetype: "fan", events: ["trophy", "champions"],
    body: "WE WON IT. WE ACTUALLY WON IT",
    weight: 4,
  },
  {
    id: "fan-transfer", archetype: "fan", events: ["unveiling", "transfer-done"],
    body: "signing done. right. now we're talking",
  },
  {
    id: "fan-farewell", archetype: "fan", events: ["farewell"],
    body: "gutted. genuinely gutted. all the best {short} 💔",
  },
  {
    id: "fan-generic", archetype: "fan",
    body: "{us}-{them}. on to the next one",
    weight: 0.5,
  },

  // ── Theirs ────────────────────────────────────────────────────────────────
  {
    id: "rival-shame", archetype: "rivalFan", tags: ["shame"], frames: ["mock"], requires: ["margin"],
    body: "{margin} goals 😂 and they were talking about europe in august",
    weight: 3,
  },
  {
    id: "rival-loss", archetype: "rivalFan", events: ["loss", "hammered", "embarrassed"], frames: ["mock"],
    body: "lost again. never gets old",
    weight: 2,
  },
  {
    id: "rival-collapse", archetype: "rivalFan", events: ["collapse"], requires: ["lead"],
    body: "{lead} up and they still found a way. textbook",
    weight: 3,
  },
  {
    id: "rival-derby", archetype: "rivalFan", events: ["derby-loss"], frames: ["mock", "joke"],
    excludes: ["derbyName"],
    body: "sing about the derby again lads. go on",
    weight: 4,
  },
  {
    id: "rival-derby-named", archetype: "rivalFan", events: ["derby-loss"], frames: ["mock", "joke"],
    requires: ["derbyName"],
    body: "another {derbyName|lower} to add to the pile. keep counting",
    weight: 4,
  },
  {
    id: "rival-derby-win", archetype: "rivalFan", events: ["derby-win"], frames: ["mock"],
    excludes: ["derbyName"],
    body: "one win in how many. behave",
  },
  {
    id: "rival-derby-win-named", archetype: "rivalFan", events: ["derby-win"], frames: ["mock"],
    requires: ["derbyName"],
    body: "one {derbyName|lower} in how many years. behave",
  },
  {
    id: "rival-drop", archetype: "rivalFan", events: ["into-the-drop", "relegated", "losing-run"], frames: ["mock"],
    body: "enjoy the trip down 👋",
    weight: 3,
  },
  {
    id: "rival-hype", archetype: "rivalFan", tags: ["goal", "award"], frames: ["mock"],
    body: "one good game and it's ballon d'or talk again",
    weight: 2,
  },
  {
    id: "rival-drought", archetype: "rivalFan", events: ["drought", "out-of-form", "anonymous"],
    frames: ["mock"], requires: ["matches"],
    body: "{matches} games without a goal. worth every penny that",
  },
  {
    id: "rival-slip", archetype: "rivalFan", events: ["lost-top", "out-of-europe", "collapse", "run-ended"],
    frames: ["mock", "joke"],
    body: "and just like that the title talk goes quiet again 🤫",
    weight: 3,
  },
  {
    id: "rival-table", archetype: "rivalFan", tags: ["table", "title"], requires: ["position"],
    body: "{position|ordinal}. remind me what they were shouting about in august",
    weight: 2,
  },
  {
    id: "rival-quiet", archetype: "rivalFan", tags: ["table", "title", "shame", "streak"],
    body: "quiet on here tonight isn't it 👀",
    weight: 2,
  },
  {
    id: "rival-generic", archetype: "rivalFan",
    body: "not our problem 😌",
    weight: 0.5,
  },

  // ── Team-mates, and you ───────────────────────────────────────────────────
  {
    id: "mate-goal", archetype: "teammate", tags: ["goal"], requires: ["short"],
    body: "big three points. {short} 🔥🔥",
    weight: 3,
  },
  {
    id: "mate-hattrick", archetype: "teammate", events: ["hat-trick", "four-goals", "five-goals"],
    body: "matchball for the big man 🎯 unreal",
    weight: 3,
  },
  {
    id: "mate-win", archetype: "teammate", events: ["win", "rout", "derby-win"],
    body: "job done. onto the next 💪 {club}",
    weight: 2,
  },
  {
    id: "mate-loss", archetype: "teammate", events: ["loss", "hammered"],
    body: "not good enough today. we'll be better. thanks for travelling 🙏",
  },
  {
    id: "mate-milestone", archetype: "teammate", tags: ["milestone", "award"],
    body: "deserves everything he gets. proud of you brother 🤝",
    weight: 2,
  },
  {
    id: "mate-trophy", archetype: "teammate", events: ["trophy", "champions"],
    body: "CHAMPIONS 🏆🏆🏆 what a group of lads",
    weight: 4,
  },
  {
    id: "mate-debut", archetype: "teammate", events: ["debut", "club-debut"],
    body: "welcome to it 🤝 first of many",
  },
  {
    id: "mate-generic", archetype: "teammate",
    body: "onto the next one 💪",
    weight: 0.5,
  },

  // ── The meme page ─────────────────────────────────────────────────────────
  {
    id: "meme-poll-shame", archetype: "meme", tags: ["shame"], frames: ["joke", "mock"],
    body: "Who is to blame for that?",
    graphic: "poll", weight: 3,
  },
  {
    id: "meme-poll-form", archetype: "meme", events: ["in-form", "red-hot", "scoring-run"], frames: ["joke"],
    body: "Best player in the league right now?",
    graphic: "poll", weight: 2,
  },
  {
    id: "meme-thumb", archetype: "meme", tags: ["drama"], frames: ["joke", "mock"],
    body: "the {opponent} defence watching that go in:",
    graphic: "thumbnail", weight: 2,
  },
  {
    id: "meme-collapse", archetype: "meme", events: ["collapse", "hammered"], frames: ["joke"],
    body: "nobody:\n{club} at 2-0 up:",
    weight: 2,
  },
  {
    id: "meme-manager", archetype: "meme", tags: ["manager"], frames: ["joke"],
    body: "{manager} clearing his desk like:",
    graphic: "thumbnail",
  },
  {
    id: "meme-generic", archetype: "meme", frames: ["joke", "mock"],
    body: "football is a simple game and then {club} play it",
    weight: 0.5,
  },
];
