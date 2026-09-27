import type { Template } from "./index";

/**
 * A CHEEKY KICK THAT DIDN'T COME OFF — the "cheeky-miss" event
 * (detect/personal.ts's CHEEKY_MISS; Harry, 27 Sep 2026).
 *
 * Two kinds, never mixed up: `chip` (a Panenka, or a chip in open play) and
 * `middle` (a penalty struck straight down the middle). Every line is pinned
 * to one of the two by `requires`, so a Panenka line is never written about a
 * driven penalty. All `subject: "you"`: they name you, so they must never
 * fire off somebody else's miss.
 */
export const CHEEKY_TEMPLATES: Template[] = [
  // ── Your own supporters ───────────────────────────────────────────────
  {
    id: "fan-cheeky-chip", archetype: "fan", events: ["cheeky-miss"], subject: "you",
    requires: ["chip", "short", "score"],
    body: "a panenka. A PANENKA. at {score}. {short} what are you doing",
    weight: 3,
  },
  {
    id: "fan-cheeky-middle", archetype: "fan", events: ["cheeky-miss"], subject: "you",
    requires: ["middle", "short"],
    body: "straight down the middle and he still doesn't score. {short} mate",
    weight: 3,
  },
  // ── Theirs ────────────────────────────────────────────────────────────
  {
    id: "rival-cheeky-chip", archetype: "rivalFan", events: ["cheeky-miss"], subject: "you",
    requires: ["chip", "short"],
    body: "imagine trying a panenka and missing it 😂😂 {short} is a fraud",
    weight: 3,
  },
  {
    id: "rival-cheeky-middle", archetype: "rivalFan", events: ["cheeky-miss"], subject: "you",
    requires: ["middle", "short"],
    body: "{short} hitting it straight down the middle like the keeper wasn't going to be there 😂",
    weight: 3,
  },
  // ── The papers ────────────────────────────────────────────────────────
  {
    id: "tb-cheeky-chip", archetype: "tabloid", events: ["cheeky-miss"], subject: "you",
    requires: ["chip", "short"],
    body: "PANENKA PANIC! {short|caps}'S CHEEKY CHIP GOES HORRIBLY WRONG",
    graphic: "breaking", weight: 4,
  },
  {
    id: "tb-cheeky-middle", archetype: "tabloid", events: ["cheeky-miss"], subject: "you",
    requires: ["middle", "short"],
    body: "SPOT OF BOTHER! {short|caps} GOES DOWN THE MIDDLE — AND MISSES",
    graphic: "breaking", weight: 4,
  },
  {
    id: "bs-cheeky-chip", archetype: "broadsheet", events: ["cheeky-miss"], subject: "you",
    requires: ["chip", "short", "opponent"],
    body: "{short} tried to be clever against {opponent} and got it wrong. A chip only looks inspired when it comes off; this one didn't.",
    weight: 3,
  },
  {
    id: "bs-cheeky-middle", archetype: "broadsheet", events: ["cheeky-miss"], subject: "you",
    requires: ["middle", "short", "opponent"],
    body: "{short} went straight down the middle from the spot against {opponent} and missed. It is the bravest penalty there is, and the most exposed when it goes wrong.",
    weight: 3,
  },
  // ── The pundit ────────────────────────────────────────────────────────
  {
    id: "pu-cheeky-chip", archetype: "pundit", events: ["cheeky-miss"], subject: "you",
    requires: ["chip", "short", "score"],
    body: "You chip it when you're three up. Not at {score}. {short} will hear about that one in the dressing room.",
    weight: 3,
  },
  {
    id: "pu-cheeky-middle", archetype: "pundit", events: ["cheeky-miss"], subject: "you",
    requires: ["middle", "short"],
    body: "Down the middle is a great penalty right up until it isn't. {short} has to take that more seriously.",
    weight: 3,
  },
  // ── The meme page ─────────────────────────────────────────────────────
  {
    id: "meme-cheeky", archetype: "meme", events: ["cheeky-miss"], subject: "you",
    requires: ["short"],
    body: "{short} walking back after that penalty:",
    graphic: "thumbnail", weight: 3,
  },
];
