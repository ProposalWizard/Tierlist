/**
 * THE ROUND MENU — the data behind tapping a person (Sims style; Harry, 20 Nov
 * 2026, 15:35: "I love the sims round bar to decide what to interact on").
 * Pure, no React. The screen is components/star/life/RoundMenu.tsx.
 *
 * FOR THE 3D WORLD (the world kit wires this in later):
 *   const menu = roundMenuFor(career, personId);        // what to draw
 *   <RoundMenu menu={menu} anchor={{ x, y }} … />       // x, y = his head on screen, px in the overlay
 *   onPick(cat, line) → const r = playRoundLine(career, personId, line, rng);
 *   setCareer(r.career); show r.reply over his head; r.delta moves his plate.
 *   "See you" (cat.id === "bye") closes the menu.
 * Small talk only: a line moves his bond / respect / grudge a little, never a
 * bar of yours and never a memory (big things are events, not small talk).
 */
import type { CareerState } from "../types";
import { meet, lifeWeek, peek, personInfo, nudge } from "./people";
import { cloneLife, lifeOf } from "./director";

export type RoundCategoryId = "friendly" | "banter" | "football" | "business" | "mean" | "bye";
/** What a line is likely to do: build bond, earn respect, a gamble, or close the talk. */
export type RoundTag = "bond" | "respect" | "risky" | "mean" | "bye";

export interface RoundLine { id: string; text: string; icon: string; tag: RoundTag }
export interface RoundCategory { id: RoundCategoryId; label: string; icon: string; color: string; lines: RoundLine[] }
export interface RoundMood { face: string; word: string }
export interface RoundMenuData {
  id: string;
  name: string;
  role: string;
  mood: RoundMood;
  /** 0-100, as on the People page. */
  bond: number;
  respect: number;
  grudge: number;
  categories: RoundCategory[];
  /** One plain hint under the menu, e.g. "He is relaxed, so jokes land better today". */
  hint: string;
  /** Events v2: a story's bubbles on this person (the gold "Stay out", today only). */
  offers?: RoundOffer[];
}

/** A story's bubble on the round menu (arcs.ts bubblesFor). */
export interface RoundOffer { id: string; arc: string; beat: string; label: string; icon: string; gold: boolean; chip: string; hint: string }

export const ROUND_COLORS: Record<RoundCategoryId, string> = {
  friendly: "#3ddc84", banter: "#facc15", football: "#4aa8ff", business: "#c4b5fd", mean: "#ff5a4d", bye: "#9aa7b8",
};

export function moodOf(b: number, g: number): RoundMood {
  if (g >= 40) return { face: "😠", word: "Angry" };
  if (b >= 65) return { face: "😄", word: "Happy" };
  if (b >= 45) return { face: "😌", word: "Relaxed" };
  if (b < 25) return { face: "😒", word: "Cold" };
  return { face: "😐", word: "Fine" };
}

/** Small talk with club staff about the club. */
const CLUB_LINES: RoundLine[] = [
  { id: "how-long", text: "How long have you been here?", icon: "🗓️", tag: "bond" },
  { id: "best-player", text: "Best player you've washed kit for?", icon: "⭐", tag: "respect" },
  { id: "the-gaffer", text: "What's the gaffer like, really?", icon: "👔", tag: "risky" },
];

const LINES: Record<Exclude<RoundCategoryId, "bye">, RoundLine[]> = {
  friendly: [
    { id: "how-are-you", text: "How are you, really?", icon: "🤝", tag: "bond" },
    { id: "lift", text: "Need a lift on Saturday?", icon: "🚗", tag: "bond" },
    { id: "good-session", text: "Good session today", icon: "👏", tag: "respect" },
  ],
  banter: [
    { id: "his-miss", text: "Wind him up about his miss", icon: "🎯", tag: "risky" },
    { id: "crossbar", text: "Crossbar challenge for lunch", icon: "🥅", tag: "bond" },
    { id: "gaffer-voice", text: "Do the gaffer's voice", icon: "🎙️", tag: "bond" },
  ],
  football: [
    { id: "their-full-back", text: "Their full-back is slow. Run at him", icon: "⚽", tag: "respect" },
    { id: "extra-work", text: "Stay for extra finishing?", icon: "🏃", tag: "bond" },
    { id: "your-position", text: "Ask what he thinks of your game", icon: "🧠", tag: "risky" },
  ],
  business: [
    { id: "agent", text: "Who is his agent?", icon: "💼", tag: "respect" },
    { id: "boots", text: "Ask about his boot deal", icon: "👟", tag: "risky" },
    { id: "invest", text: "Tell him about your investment", icon: "📈", tag: "risky" },
  ],
  mean: [
    { id: "bench", text: "Enjoy the bench, mate", icon: "😤", tag: "mean" },
    { id: "wages", text: "Mock his wages", icon: "💸", tag: "mean" },
    { id: "ignore", text: "Blank him in front of the lads", icon: "🙄", tag: "mean" },
  ],
};

/** What the menu shows for one person. A man with a grudge gets fewer kind lines
 *  and more ways to make it worse; a relaxed man takes a joke. */
export function roundMenuFor(c: CareerState, id: string, offers?: RoundOffer[]): RoundMenuData {
  const life = lifeOf(c);
  const p = peek(life, id);
  const info = personInfo(c, id);
  const mood = moodOf(p.b, p.g);
  const cat = (k: Exclude<RoundCategoryId, "bye">, label: string, icon: string): RoundCategory => ({ id: k, label, icon, color: ROUND_COLORS[k], lines: LINES[k] });
  const bye: RoundCategory = { id: "bye", label: "See you", icon: "👋", color: ROUND_COLORS.bye, lines: [] };
  // Club staff get the short ring (a kit man has no boot deal to ask about).
  const staff = info?.role && info.role !== "teammate";
  const cats: RoundCategory[] = staff
    ? [cat("friendly", "Chat", "💬"), cat("banter", "Banter", "😄"), { ...cat("football", "The club", "🏟️"), lines: CLUB_LINES }, bye]
    // A story is offering something: the short ring, so the gold bubble stands out.
    : offers?.length ? [cat("friendly", "Chat", "💬"), cat("banter", "Banter", "😄"), cat("football", "Advice", "🎓"), bye]
    : [
      cat("friendly", "Friendly", "🤝"), cat("banter", "Banter", "😂"), cat("football", "Football", "⚽"),
      cat("business", "Business", "💼"), bye, cat("mean", "Mean", "😤"),
    ];
  const hint = mood.word === "Angry" ? "He is angry with you. Kind words land worse today"
    : mood.word === "Relaxed" || mood.word === "Happy" ? `He is ${mood.word.toLowerCase()}, so jokes land better today`
    : mood.word === "Cold" ? "He does not know you well yet" : "Tap a bubble to talk to him";
  const role = info?.role === "teammate" ? "Team-mate" : info?.role === "kitman" ? "Kit man" : info?.role ?? "";
  return { id, name: info?.short ?? "Him", role, mood, bond: p.b, respect: p.r, grudge: p.g, categories: cats, hint, ...(offers?.length ? { offers } : {}) };
}

const REPLIES: Record<RoundTag, [string[], string[]]> = {
  bond: [["Go on then.", "Yeah, I'd like that.", "You're all right, you."], ["Not today, mate.", "Maybe another time."]],
  respect: [["Fair point, that.", "I noticed that too.", "Good shout."], ["Who asked you?", "I know what I'm doing."]],
  risky: [["Ha! Fair. I'll have that.", "You cheeky…", "Go on, then."], ["Not funny.", "Leave it, yeah?", "Bit much, that."]],
  mean: [["…Right.", "Say that again."], ["…Right.", "Say that again."]],
  bye: [["See you.", "Later."], ["See you.", "Later."]],
};

export interface RoundResult { career: CareerState; reply: string; delta: { bond: number; respect: number; grudge: number }; landed: boolean }

/** Play one line: his numbers move a little (a risky line can go either way,
 *  a mean one always costs). His mood shifts the odds. */
export function playRoundLine(c: CareerState, id: string, line: RoundLine, rng: () => number): RoundResult {
  const life = cloneLife(lifeOf(c));
  const now = lifeWeek(c);
  const p = meet(life, id, now, c.squad?.find((s) => s.id === id)?.name);
  const mood = moodOf(p.b, p.g).word;
  const odds = line.tag === "risky" ? (mood === "Relaxed" || mood === "Happy" ? 0.7 : mood === "Angry" ? 0.25 : 0.5)
    : line.tag === "mean" ? 0 : mood === "Angry" ? 0.45 : 0.85;
  const landed = line.tag === "bye" || rng() < odds;
  let db = 0, dr = 0, dg = 0;
  if (line.tag === "bond") { db = landed ? 2 : -1; }
  else if (line.tag === "respect") { dr = landed ? 2 : -1; }
  else if (line.tag === "risky") { if (landed) { db = 3; dr = 1; } else { db = -3; dg = 2; } }
  else if (line.tag === "mean") { db = -4; dg = 4; dr = -1; }
  const delta = { bond: nudge(p, "b", db), respect: nudge(p, "r", dr), grudge: nudge(p, "g", dg) };
  const pool = REPLIES[line.tag][landed ? 0 : 1];
  const reply = pool[Math.floor(rng() * pool.length)];
  return { career: { ...c, life }, reply, delta, landed };
}
