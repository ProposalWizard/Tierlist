import type { Archetype } from "../types";
import type { Template } from "./index";

/**
 * COLD EDITS: WHAT THE EDIT PAGES SAY (Leo, 31 Oct 2026: "not rlly seeing
 * like cold football edits"; switch part "coldEdits").
 *
 * The accounts that post the new edits (media/clipStyle.ts COLD_BY_PERSONA:
 * the edits page, the hype and POV pages, meme pages, numbers pages, clip
 * pages) get lines that say what the video under them is: "cold." over a
 * cold edit, "aura" over an aura edit, "run it back" over a rewind, the
 * numbers over a stat card, "every angle" over the angles edit. Each line
 * names its edit (`videoStyle`), and feed.ts gives the post that edit, so
 * the words always fit the video.
 *
 * Joined onto an account's own lines only with the part on (templates/index.ts
 * choosePersonaTemplate): with it off nothing here is ever read. Every line
 * carries `graphic: "goalVideo"` (they all talk about a video), so it is only
 * ever posted with a playable video of your goal. Invented accounts, no real
 * people or brands.
 */
type Spec = Omit<Template, "id" | "archetype" | "persona">;
type Kind = NonNullable<Template["videoStyle"]>;

function bank(persona: string, archetype: Archetype, specs: Spec[]): Template[] {
  return specs.map((s, i) => ({ ...s, id: `ft-${persona}-cold-${i + 1}`, archetype, persona }));
}

// A line about YOUR goal, over the named edit of it.
const v = (videoStyle: Kind, body: string, weight = 4, requires: string[] = ["short"]): Spec =>
  ({ tags: ["goal"], subject: "you", requires, body, weight, graphic: "goalVideo", videoStyle });
/** Your two-or-more-goal games: a montage only of those (one goal would be the angles edit). */
const MULTI = ["brace", "hat-trick", "four-goals", "five-goals"];

export const COLD_TWITTER: Template[] = [
  ...bank("edits", "meme", [
    v("cold", "{short}. cold. 🥶"),
    v("cold", "{short} vs {oppS} edit 🥶 #fyp #edit", 4, ["short", "oppS"]),
    v("cold", "the colour stays on the shirt. everything else goes grey. {short} 🥶"),
    v("cold", "the drop hits when the ball hits the net. {short}. #edit 🎧"),
    v("rewind", "rewind it. watch it again. {short} 🔁"),
    v("angles", "every angle of this {short} finish 🎥"),
    v("aura", "aura edit: {short} ✨ #fyp"),
    v("cold", "cold edit no. {number}: {short} 🥶", 3, ["short", "number"]),
    v("cold", "made this {short} edit at 2am. no regrets 🥶 sound on"),
  ]),
  ...bank("hype", "meme", [
    v("aura", "{short} aura +1000 ✨"),
    v("aura", "aura farming in a {oppS} game. {short}. ✨", 4, ["short", "oppS"]),
    v("aura", "main character energy. {short} ✨ 🎥"),
    v("cold", "{short} is HIM. the edit says it all 🥶"),
  ]),
  ...bank("pov", "meme", [
    v("cold", "pov: you just watched {short} do that live 🥶"),
    v("cold", "pov: the beat drops and {short} scores 🎧"),
    v("aura", "pov: {short} in slow-mo and the whole ground goes quiet ✨"),
  ]),
  ...bank("matchday", "meme", [
    v("cold", "matchday feeling: {short} 🥶 #edit"),
    v("angles", "{short} vs {oppS}, from every camera 🎞", 4, ["short", "oppS"]),
    v("rewind", "this {short} goal on a loop all week 🔁"),
  ]),
  ...bank("commentBot", "meme", [
    v("cold", "comments under this {short} edit: \"cold\" \"cold\" \"colder\" \"🥶\""),
    v("cold", "top comment on the {short} edit: \"the beat drop timing is illegal\" 🎧"),
  ]),
  ...bank("meme", "meme", [
    v("rewind", "wait… run it back. {short} 🔁"),
    v("rewind", "rewinding this {short} goal until the tape breaks 📼"),
    v("cold", "{short} when the beat drops 🥶"),
  ]),
  ...bank("ratio", "meme", [
    v("rewind", "rewind it as many times as you like, {oppS} still conceded that 📼", 4, ["short", "oppS"]),
    v("rewind", "run it back. {short} cooked them 🔁"),
  ]),
  ...bank("nostalgia", "meme", [
    v("rewind", "this {short} goal already looks like an old tape 📼"),
    v("rewind", "rewind to the day {short} did this 📼"),
  ]),
  ...bank("sundayLeague", "meme", [
    v("rewind", "sunday league keeper watching this {short} rewind 📼😭"),
    v("rewind", "our striker on sunday after seeing the {short} rewind: \"i can do that\" 🔁"),
  ]),
  ...bank("ranker", "meme", [
    v("statCard", "rate this {short} goal 1-10 (numbers in the video) 📊"),
    v("cold", "{short}, the cold edit. 1-10? 🥶"),
  ]),
  ...bank("xg", "stats", [
    v("statCard", "the numbers on this {short} finish (in the video) 📊"),
    v("statCard", "distance, shot speed, finish: the {short} goal on one card 📊🎥"),
  ]),
  ...bank("facts", "stats", [
    v("statCard", "{short}: the goal, the speed, the distance. watch the card 📊"),
    v("statCard", "just a reminder {short} hit it like that 📊🎥"),
  ]),
  ...bank("rater", "stats", [
    v("statCard", "{short} goal, by the numbers 🎥📊"),
  ]),
  ...bank("quiz", "meme", [
    v("statCard", "guess the shot speed before the card shows it. {short} 🎥📊"),
    v("statCard", "ball knowledge test: how far out was {short}? answer in the video 📊"),
  ]),
  ...bank("wonderkid", "stats", [
    v("statCard", "{short}, by the numbers 📊🎥"),
    { ...v("montage", "every {short} goal from the game in one video. remember the name 🎞"), tags: undefined, events: MULTI },
  ]),
  ...bank("clips", "aggregator", [
    v("angles", "{short} vs {oppS}: every angle 🎥", 4, ["short", "oppS"]),
    v("angles", "every angle. {short}. 🎥"),
    { ...v("montage", "all of {short}'s goals from the game, one video 🎞"), tags: undefined, events: MULTI },
  ]),
  ...bank("kidFan", "fan", [
    v("aura", "made an aura edit of {short} ✨✨ my best one yet"),
    v("aura", "{short} aura edit for my mum's facebook ✨"),
  ]),
  ...bank("streamer", "fan", [
    v("cold", "clipped {short} for an edit after stream. cold 🥶"),
    v("aura", "chat made me make a {short} aura edit ✨ 🎥"),
  ]),
];

/** Lines by persona id (read only with "coldEdits" on). */
export const COLD_BY_PERSONA_LINES = new Map<string, Template[]>();
for (const t of COLD_TWITTER) {
  const list = COLD_BY_PERSONA_LINES.get(t.persona!) ?? [];
  list.push(t);
  COLD_BY_PERSONA_LINES.set(t.persona!, list);
}
