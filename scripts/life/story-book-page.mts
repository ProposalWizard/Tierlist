/**
 * THE STORY BOOK PAGE: every story of the living world, in full, as one page (Harry, 28 Nov 2026:
 * "an artifact with EVERY single story in full so I can analyse every single one").
 *
 * Run:  npx tsx scripts/life/story-book-page.mts [--out <folder>]
 * Writes <folder>/data.json (the book, turned into plain English: nothing left out) and
 * <folder>/index.html (the page; it reads data.json). Re-run whenever a story changes.
 * Read-only on the repo: it never touches a story file.
 *
 * What it reads: lib/star/life/book/arcs/*.json (every story), book/events.json (the older one-off
 * events, only to see which memories they write), the engine files (arcs.ts, cond.ts, resolve.ts,
 * talk.ts, drill.ts, pool.ts) for what each field means. The meaning of each field is written
 * out in the comments next to the code that explains it, so a change in the engine can be matched here.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { POOL } from "../../lib/star/life/pool";
import { ROUND_LIBRARY, challenge } from "../../lib/star/life/drill";
import { parseCond } from "../../lib/star/life/cond";
import { validateArc } from "../../lib/star/life/validateArcs";
import { STORY_ARCS } from "../../lib/star/life/book/arcs/index";
import { WAITING_ARCS } from "../../lib/star/life/arcBook";

/* eslint-disable @typescript-eslint/no-explicit-any */
type A = any;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const ARC_DIR = path.join(ROOT, "lib/star/life/book/arcs");
const argOut = process.argv.indexOf("--out");
const OUT = argOut > 0 ? path.resolve(process.argv[argOut + 1]) : path.join(ROOT, "story-book-out");

// ───────────────────────── markers inside strings (the page turns them into little chips) ─────────────────────────
const PH0 = "", PH1 = "", IF0 = "", IF1 = "", IFS = "";
const ph = (s: string) => `${PH0}${s}${PH1}`;

// ───────────────────────── words for roles, places, moments ─────────────────────────
/** pick → plain words (people.ts ROLE_TITLE is "Your dad"; here we want a lower-case noun). */
const ROLE_PLAIN: Record<string, string> = {
  squad: "team-mate", manager: "manager (the gaffer)", agent: "agent", dad: "dad", mum: "mum", brother: "brother", sister: "sister",
  partner: "partner", pal: "old school friend", physio: "physio", kitman: "kit man", groundsman: "groundsman", canteen: "canteen lady/man",
  chairman: "chairman", coach: "first-team coach", fan: "season-ticket fan by the tunnel", kidfan: "young fan", reporter: "local reporter",
  neighbour: "neighbour", rival: "rival (plays for another club)", legend: "club legend", sponsor: "sponsor's rep", referee: "referee",
  tabloid: "tabloid reporter", broadsheet: "broadsheet writer", stranger: "a stranger (one-off, never remembered)", social: "the team-mate a social action is with",
  memory: "whoever holds a memory", carried: "carried over from the story before",
};
const ORDER_WORDS: Record<string, string> = {
  "bond-desc": "the one who likes you most", "bond-asc": "the one who likes you least", "grudge-desc": "the one with the biggest grudge against you",
  random: "picked at random", youngest: "the youngest", best: "the best player (highest overall)",
};
const MOMENT_WORDS: Record<string, string> = {
  "arrive:training": "when you arrive at training", "home:evening": "on an evening at home", "after-match": "straight after a match",
  walkout: "in the tunnel just before a match", "season-end": "at the end of the season", "leave:casino": "as you leave the casino",
  driving: "while you are driving", followUp: "as a follow-up (it is called by an earlier beat)", "social:drive": "on a drive with a team-mate", "social:races": "at the races",
};
const TEMPLATE_WORDS: Record<string, string> = {
  "phone-call": "A phone call", "text-thread": "A text thread on your phone", "feed-post": "A post on your feed", "talk-scene": "A scene (a still picture with people in a place)",
};
const SCREEN_WORDS: Record<string, string> = {
  telltale: "Telltale screen: the other person speaks, you answer from a short list (slow-motion look, the clock can run out and pick the silent answer)",
  dial: "The tone dial (football press-style answers: humble, calm, confident, fiery)",
  card: "A plain card: lines, then your choices",
};
const AREA_WORDS: Record<string, string> = { compound: "the training ground", home: "your home", stadium: "the stadium", town: "in town", away: "away from home", driving: "on the road", training: "the training ground" };
function placeWords(p: string): string {
  const [a, b] = p.split(":");
  const spot = (b ?? "").replace(/-/g, " ").replace(/\b(\d)\b/g, (m) => ({ "1": "one", "2": "two", "3": "three" } as A)[m] ?? m);
  const area = AREA_WORDS[a] ?? a;
  return b ? `${area[0].toUpperCase()}${area.slice(1)}: ${spot}` : `${area[0].toUpperCase()}${area.slice(1)}`;
}

// ───────────────────────── numbers in words ─────────────────────────
const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const nw = (n: number) => (Number.isInteger(n) && n >= 0 && n <= 12 ? NUM_WORD[n] : String(n));
const sgn = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
function oneIn(p: number): string {
  if (p >= 0.999) return "every time";
  const n = 1 / p;
  const r = Math.round(n);
  if (p > 0.6) return `${Math.round(p * 100)} times in 100`;
  return Math.abs(n - r) / n < 0.12 ? `about 1 time in ${r}` : `about ${Math.round(p * 100)} times in 100`;
}
function careersIn(p: number): string {
  const n = Math.round(1 / p);
  return `${Math.round(p * 100)} careers in every 100 (about 1 career in ${n})`;
}
function weeksWords(r: [number, number]): string {
  const [a, b] = r;
  if (a === b) return a === 0 ? "straight away" : `${nw(a)} week${a === 1 ? "" : "s"} later`;
  if (a === 0) return `straight away, or up to ${nw(b)} week${b === 1 ? "" : "s"} later`;
  return `${nw(a)} to ${nw(b)} weeks later`;
}
function seasonsWords(r: [number, number]): string {
  const [a, b] = r;
  if (a === b) return `${nw(a)} season${a === 1 ? "" : "s"} later`;
  return `${nw(a)} to ${nw(b)} seasons later`;
}

// ───────────────────────── conditions in plain English (mirrors lib/star/life/cond.ts) ─────────────────────────
const FACT_WORDS: Record<string, string> = {
  age: "your age", season: "the season number of your career", week: "the week of the season", clubApps: "your appearances for this club", fame: "your fame",
  reputation: "your reputation", energy: "your energy", boss: "your standing with the gaffer (boss bar)", team: "the team bar", fans: "the fans bar",
  starLevel: "your star level", moneyWeeks: "your money, counted in weeks of your own wage", carTier: "the level of your best car (0 = none)",
  divisionLevel: "your league level (1 = Premier League, 2 = Championship, 3 = League One, 4 = League Two, 5 = National League, 6 = its North/South)",
  lastRating: "your rating in your last match", lastGoals: "your goals in your last match", seasonGoals: "your goals this season", matchFitness: "your match fitness", overall: "your overall skill (average of pace, power, technique, vision)",
};
const FLAG_WORDS: Record<string, string> = { lastLost: "you lost your last match", lastWon: "you won your last match", injured: "you are injured", hasPartner: "you have a partner", captain: "you are the captain" };
const OP_WORDS: Record<string, string> = { ">=": "at least", "<=": "at most", ">": "more than", "<": "less than", "==": "exactly" };
const PERSON_NUM: Record<string, string> = { bond: "bond with you", respect: "respect for you", grudge: "grudge against you", age: "age", overall: "overall rating", goals: "goals this season" };

class Ctx {
  slots: Record<string, A> = {};
  promises: Record<string, A> = {};
  clocks: A[] = [];
  beatTitle: (id: string) => string = (id) => id;
  constructor(public arc: A) {
    for (const c of arc.cast ?? []) this.slots[c.slot] = c;
    this.promises = arc.promises ?? {};
    this.clocks = arc.clocks ?? [];
    this.beatTitle = (id) => { const t = arc.beats.find((b: A) => b.id === id)?.title; return t ? fillText(t, this) : id; };
  }
  addCast(list: A[]) { for (const c of list ?? []) if (!this.slots[c.slot]) this.slots[c.slot] = c; }
  /** "the kit man", "the team-mate (kid)": the person in a slot. */
  who(slot: string): string {
    if (slot === "you") return "you";
    if (slot === "squad") return "the squad";
    const c = this.slots[slot];
    if (!c) return slot;
    const base = ROLE_PLAIN[c.pick] ?? c.pick;
    return c.pick === "squad" ? `the ${base} “${slot}”` : `the ${base.replace(/ \(.*/, "")}`;
  }
  /** shorter: "kit man", "team-mate “kid”" */
  tag(slot: string): string { return this.who(slot).replace(/^the /, ""); }
}

function personCondWords(src: string): string {
  let s = src.trim();
  const neg = s.startsWith("!");
  if (neg) s = s.slice(1).trim();
  let w: string;
  let m: RegExpExecArray | null;
  if (s === "samePosition") w = neg ? "does not play your position" : "plays your position";
  else if (s === "new") w = neg ? "is not a new signing" : "is a new signing";
  else if (s === "veteran") w = neg ? "is not a veteran" : "is a veteran (31 or older)";
  else if ((m = /^mem\((.+)\)$/.exec(s))) w = `${neg ? "does not remember" : "remembers"} ${tagList(m[1])}`;
  else if ((m = /^([a-z]+)(>=|<=|==|>|<)(-?[\d.]+)$/.exec(s))) w = `${neg ? "NOT: " : ""}${PERSON_NUM[m[1]] ?? m[1]} ${OP_WORDS[m[2]]} ${m[3]}`;
  else w = s;
  return w;
}
function tagList(s: string): string {
  const tags = s.split("|").map((t) => t.trim().replace(/^'|'$/g, "").replace(/-/g, " "));
  return tags.map((t) => `“${t}”`).join(" or ");
}
function v2ValWords(x: string, cx: Ctx): string {
  const t = x.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  const q = /^'([a-z0-9-]*)'$/.exec(t);
  if (q) return `“${q[1]}”`;
  let m: RegExpExecArray | null;
  if ((m = /^arc\.clock\(([a-z0-9-]+)\)$/.exec(t))) { const cl = cx.clocks.find((c: A) => c.id === m![1]); return `the clock “${cl ? cl.label.replace(/\{[a-z]+\.[a-z]+\}/g, "…") : m[1]}” (segments filled)`; }
  if ((m = /^arc\.([a-zA-Z]+)$/.exec(t))) return `the story note “${m[1]}”`;
  if (t === "talk.mood") return "the talk's mood";
  if ((m = /^activity\.(score|tens|oppScore)$/.exec(t))) return ({ score: "the game score (balls that counted)", tens: "the game score ×10", oppScore: "his score in the game" } as A)[m[1]];
  return t;
}
function atomWords(raw: string, cx: Ctx): string {
  let s = raw.trim();
  const neg = s.startsWith("!");
  if (neg) s = s.slice(1).trim();
  const N = (pos: string, negs: string) => (neg ? negs : pos);
  let m: RegExpExecArray | null;
  if (s.includes("&&") && !/^squad\.any\(/.test(s)) return raw.split("&&").map((p) => atomWords(p, cx)).join(" and ");
  if ((m = /^said:([a-z0-9-]+)$/.exec(s))) return N(`you said “${m[1].replace(/-/g, " ")}” earlier in this talk`, `you did not say “${m[1].replace(/-/g, " ")}” in this talk`);
  if ((m = /^promise\(([a-z0-9-]+)\)$/.exec(s))) { const p = cx.promises[m[1]]; const t = p ? `“${p.text.replace(/\{[a-z]+\.[a-z]+\}/g, "…")}”` : m[1]; return N(`the promise ${t} has been made and is still open (or kept)`, `the promise ${t} has not been made, or was broken`); }
  if (s === "sameClub" || s === "sameClub(arc.start)") return N("you are still at the club where this story began", "you have left the club where this story began");
  if ((m = /^activity\.(won|lost|abandoned)$/.exec(s))) return N(`in the game you ${({ won: "won", lost: "lost", abandoned: "stopped (walked away)" } as A)[m[1]]}`, `in the game you did not ${({ won: "win", lost: "lose", abandoned: "stop" } as A)[m[1]]}`);
  if (s === "minigame.won" || s === "minigame.lost") return N(`you ${s.endsWith("won") ? "won" : "lost"} the mini-game`, `you did not ${s.endsWith("won") ? "win" : "lose"} the mini-game`);
  if (FLAG_WORDS[s]) { const w = FLAG_WORDS[s]; return neg ? `NOT: ${w}` : w; }
  if ((m = /^owns:([a-z]+)$/.exec(s))) return N(`you own a ${m[1]}`, `you do not own a ${m[1]}`);
  if ((m = /^flag:([a-z0-9-]+)$/.exec(s))) return N(`the life flag “${m[1]}” is set`, `the life flag “${m[1]}” is not set`);
  if ((m = /^cast\.([a-z]+)$/.exec(s))) return N(`${cx.who(m[1])} is in this story`, `${cx.who(m[1])} is not in this story`);
  if ((m = /^outscored\(([a-z]+)\)$/.exec(s))) return N(`you have scored at least as many this season as ${cx.who(m[1])}`, `${cx.who(m[1])} has scored more than you this season`);
  if ((m = /^mem\(([a-z]+),(.+)\)$/.exec(s))) {
    const who = m[1] === "squad" ? "the squad" : m[1] === "you" ? "people (about you)" : cx.who(m[1]);
    return N(`${who} remember${m[1] === "squad" || m[1] === "you" ? "" : "s"} ${tagList(m[2])}`, `${who} do${m[1] === "squad" || m[1] === "you" ? "" : "es"} not remember ${tagList(m[2])}`);
  }
  if ((m = /^squad\.any\((.+)\)$/.exec(s))) { const parts = m[1].split("&&").map((p) => personCondWords(p)); return N(`some team-mate ${parts.join(" and ")}`, `no team-mate ${parts.join(" and ")}`); }
  if ((m = /^(roll)(>=|<=|==|>|<)([\d.]+)$/.exec(s))) {
    const v = Number(m[3]);
    if (m[2] === "<" || m[2] === "<=") return N(`a dice roll comes up (${Math.round(v * 100)} chances in 100)`, `the dice roll does not come up (${Math.round(v * 100)} chances in 100)`);
    return `dice roll ${OP_WORDS[m[2]]} ${v}`;
  }
  // numbers: facts, person numbers (slot.bond), story values (arc.x), clocks, activity
  const o = /(>=|<=|==|>|<)/.exec(s);
  if (o) {
    const l = s.slice(0, o.index).trim(), r = s.slice(o.index + o[1].length).trim();
    let left: string;
    if (FACT_WORDS[l]) left = FACT_WORDS[l];
    else if ((m = /^([a-z]+)\.(bond|respect|grudge|age|overall|goals)$/.exec(l))) left = `${cx.who(m[1])}'s ${PERSON_NUM[m[2]]}`;
    else left = v2ValWords(l, cx);
    const right = v2ValWords(r, cx);
    const txt = `${left} ${o[1] === "==" ? "is" : "is " + OP_WORDS[o[1]]} ${right}`;
    return neg ? `NOT: ${txt}` : txt;
  }
  return raw;
}
/** A whole condition: alternatives with || ; all-of with && (the engine's closed language). */
function condWords(src: string, cx: Ctx): string {
  if (!src) return "always";
  const alts = splitTop(src, "||");
  return alts.map((a) => atomWords(a, cx)).join("  —or—  ");
}
function splitTop(src: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && src.startsWith(sep, i)) { out.push(cur); cur = ""; i += sep.length - 1; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
/** The plain "all of" atoms of a list of conditions (alternatives with || are skipped; nothing inside brackets counts). */
function topAtoms(list: string[]): string[] {
  const out: string[] = [];
  for (const c of list) { if (splitTop(c, "||").length > 1) continue; for (const a of splitTop(c, "&&")) out.push(a.trim()); }
  return out;
}
/** A list of conditions that must all hold. */
const allWords = (list: string[] | undefined, cx: Ctx): string[] => (list ?? []).map((c) => condWords(c, cx));

// ───────────────────────── lines of text (the {placeholders}) ─────────────────────────
function fillText(src: string | undefined, cx: Ctx): string {
  if (!src) return "";
  let s = src.replace(/\{if ([^}]+)\}([\s\S]*?)\{\/if\}/g, (_, cond: string, body: string) => {
    const k = cond.trim();
    const slot = /^(!?)([a-z]+)$/.exec(k);
    const words = slot ? (slot[1] ? `${cx.who(slot[2])} is not in the story` : `${cx.who(slot[2])} is in the story`) : condWords(k, cx);
    return `${IF0}${words}${IFS}${fillText(body, cx)}${IF1}`;
  });
  s = s.replace(/\{([a-z]+)\.([a-zA-Z]+)\}/g, (all, slot: string, key: string) => {
    if (slot === "arc") return ph(`story note: ${key}`);
    if (slot === "activity") return ph(key === "tens" ? "score ×10" : key === "score" ? "balls that counted" : `game ${key}`);
    if (slot === "you") return ph(({ name: "your full name", short: "your surname", club: "your club", number: "your shirt number", horse: "your horse", age: "your age" } as A)[key] ?? `you.${key}`);
    const who = cx.tag(slot);
    const k = ({ short: who, name: who, outlet: `${who}'s paper`, age: `${who}'s age`, initial: `${who}'s initial`, signoff: `${who}'s sign-off`, from: `where ${who} is from`, club: "your club", position: `${who}'s position` } as A)[key];
    return ph(k ?? all);
  });
  return s.replace(/\s{2,}/g, " ").trim();
}
/** Plain text of a filled line, for search and for the premise (markers dropped, chips kept as words). */
export const strip = (s: string) => s.replace(new RegExp(`${IF0}[^${IFS}]*${IFS}`, "g"), "").replace(new RegExp(`[${PH0}${PH1}${IF0}${IF1}${IFS}]`, "g"), "");

// ───────────────────────── items / unlocks words ─────────────────────────
const ITEM_WORDS: Record<string, [string, string]> = {
  "item:dens-ball-bag": ["the kit man's ball bag", "“the kit man's hundred” becomes a drill in your own garden."],
};
function unlockWords(code: string): string {
  const [kind, rest] = code.includes(":") ? code.split(":") : ["garden", code];
  const w = rest.replace(/-/g, " ");
  if (kind === "garden") return `a garden unlock: “${w}”`;
  if (kind === "trophy") return `a trophy: “${w}” (shown on the kit room door)`;
  return `${kind}: ${w}`;
}
export { PH0, PH1, IF0, IF1, IFS };

/** The page itself (index.html). It reads data.json next to it. */
const PAGE_HTML: string = String.raw`<title>The Story Book</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one long reading page. Sticky tab and search bar on top; each story a collapsible card; script-style speech (speaker bold, line after it), effects in a quieter mono. */
:root {
  --bg: #f3f5f1; --surface: #ffffff; --ink: #15211b; --muted: #596861; --line: #d8dfd9; --accent: #17754a; --accent-weak: #e2f1e8;
  --gold: #8a5b00; --gold-weak: #fbefd0; --red: #a8321c; --red-weak: #fbe4de; --violet: #5b4aa8; --violet-weak: #ebe7f9; --blue: #1d5fa8; --blue-weak: #e1ecf8;
  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --font-head: "Space Grotesk", "Inter", system-ui, sans-serif; --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0e1511; --surface: #16201b; --ink: #e6eee8; --muted: #95a79c; --line: #2a3830; --accent: #4cc58a; --accent-weak: #153326;
    --gold: #e3b24d; --gold-weak: #33290f; --red: #f08a74; --red-weak: #38201b; --violet: #b3a6f2; --violet-weak: #262144; --blue: #82b7ee; --blue-weak: #172a40; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0e1511; --surface: #16201b; --ink: #e6eee8; --muted: #95a79c; --line: #2a3830; --accent: #4cc58a; --accent-weak: #153326;
  --gold: #e3b24d; --gold-weak: #33290f; --red: #f08a74; --red-weak: #38201b; --violet: #b3a6f2; --violet-weak: #262144; --blue: #82b7ee; --blue-weak: #172a40; color-scheme: dark;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { scroll-behavior: auto; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-ui); font-size: 15px; line-height: 1.5; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 56px; overflow-wrap: anywhere; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 30; background: var(--bg); }
.wrap { max-width: 1040px; margin: 0 auto; }
h1, h2, h3, h4 { font-family: var(--font-head); margin: 0; text-wrap: balance; line-height: 1.2; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
a { color: var(--accent); }
.mono { font-family: var(--font-mono); }
.grey { color: var(--muted); }
.tiny { font-size: 12px; }

/* top */
.top { padding-top: 28px; padding-bottom: 14px; }
.top h1 { font-size: clamp(28px, 6vw, 44px); letter-spacing: -0.02em; }
.top .sub { margin: 6px 0 0; color: var(--muted); font-size: 16px; max-width: 62ch; }
.notice { margin: 16px 0 0; padding: 11px 14px; border: 1px solid var(--gold); background: var(--gold-weak); color: var(--ink); border-radius: 8px; font-weight: 500; }
.stamp { margin: 10px 0 0; font-size: 13px; color: var(--muted); }

/* summary */
.sum { margin-top: 18px; display: grid; gap: 18px; }
.nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 10px; }
.num { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.num b { display: block; font-family: var(--font-head); font-size: 26px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.num span { font-size: 12.5px; color: var(--muted); }
.breaks { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
.brk h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 8px; font-family: var(--font-ui); font-weight: 600; }
.brow { display: grid; grid-template-columns: minmax(0, 11fr) 5fr; gap: 8px; align-items: center; margin: 3px 0; font-size: 13.5px; }
.brow .lab { min-width: 0; display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.brow .lab i { font-style: normal; font-variant-numeric: tabular-nums; color: var(--muted); }
.brow .track { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
.brow .fill { height: 100%; background: var(--accent); border-radius: 4px; }
.brk.scroll .rows { max-height: 260px; overflow: auto; padding-right: 6px; }

/* sticky bar */
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 20; background: var(--bg); border-bottom: 1px solid var(--line); padding: 8px 0 8px; margin-top: 18px; }
.tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { border: 0; background: transparent; padding: 7px 11px; border-radius: 999px; font-weight: 600; font-size: 14px; color: var(--muted); white-space: nowrap; }
.tab[aria-selected="true"] { background: var(--ink); color: var(--bg); }
.tab .n { font-weight: 500; opacity: .75; margin-left: 4px; font-variant-numeric: tabular-nums; }
.tools { display: flex; gap: 10px; margin-top: 8px; align-items: center; }
.actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.search { flex: 1 1 120px; min-width: 0; padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.btn { border: 1px solid var(--line); background: var(--surface); padding: 8px 11px; border-radius: 8px; font-size: 13.5px; font-weight: 500; }
.btn:hover { border-color: var(--accent); }
.btn[aria-pressed="true"] { background: var(--accent-weak); border-color: var(--accent); }
.count { font-size: 13px; text-align: right; max-width: 38%; color: var(--muted); font-variant-numeric: tabular-nums; }

/* filters */
.filters { margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
.fgrp label.t { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 5px; font-weight: 600; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 3px 10px; font-size: 13px; }
.chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.filters select { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.checks label { display: flex; gap: 8px; align-items: center; margin: 3px 0; font-size: 14px; }

.toc { margin-top: 12px; }
.toc > summary { cursor: pointer; font-weight: 600; padding: 6px 0; }
.toc ol { columns: 3 260px; column-gap: 24px; margin: 8px 0 0; padding-left: 28px; font-size: 14px; }
.toc li { break-inside: avoid; margin: 2px 0; }

/* story cards */
.list { margin-top: 12px; display: grid; gap: 8px; }
.story { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; scroll-margin-top: 120px; }
.story[data-open="1"] { border-color: var(--accent); }
.shead { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: start; padding: 11px 12px 11px 14px; }
.stoggle { all: unset; display: block; cursor: pointer; min-width: 0; }
.stoggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.st-title { font-family: var(--font-head); font-weight: 700; font-size: 18px; line-height: 1.25; }
.st-no { font-family: var(--font-mono); font-size: 12px; color: var(--muted); font-weight: 400; margin-right: 6px; }
.st-prem { margin-top: 3px; color: var(--muted); font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.story[data-open="1"] .st-prem { display: block; -webkit-line-clamp: unset; }
.tags { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 5px; }
.tag { font-size: 12px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
.tag.size { color: var(--ink); font-weight: 600; }
.tag.t-game { background: var(--blue-weak); color: var(--blue); border-color: transparent; }
.tag.t-item { background: var(--gold-weak); color: var(--gold); border-color: transparent; }
.tag.t-link { background: var(--violet-weak); color: var(--violet); border-color: transparent; }
.tag.t-wait { background: var(--red-weak); color: var(--red); border-color: transparent; }
.copy { align-self: start; font-size: 12.5px; padding: 5px 9px; }
.chev { display: none; }
.sbody { padding: 4px 14px 18px; border-top: 1px solid var(--line); }
.facts { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13.5px; color: var(--muted); margin: 10px 0 4px; }
.facts b { color: var(--ink); font-weight: 600; }
.ids { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); margin-top: 14px; }

.sec { margin-top: 22px; }
.sec > h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent); font-family: var(--font-ui); font-weight: 700; padding-bottom: 5px; border-bottom: 1px solid var(--line); margin-bottom: 8px; }
.sec > h3 .c { color: var(--muted); font-weight: 500; letter-spacing: 0; text-transform: none; }
.kv { margin: 4px 0; }
.kv > b { font-weight: 600; }
ul.plain { margin: 4px 0 4px; padding-left: 20px; }
ul.plain li { margin: 2px 0; }
.person { margin: 6px 0; padding: 8px 10px; background: var(--bg); border-radius: 8px; font-size: 14px; }
.person b { font-weight: 600; }
.pool { font-size: 13px; color: var(--muted); margin-top: 3px; }
.pool li { margin: 1px 0; }

/* beats */
.beat { margin-top: 18px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--surface); }
.bhead { padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--line); }
.bhead .no { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); font-weight: 700; }
.bhead h4 { font-size: 17px; margin-top: 1px; }
.bhead .hint { font-size: 13.5px; color: var(--muted); margin-top: 2px; }
.bmeta { padding: 10px 14px 4px; display: grid; gap: 6px; font-size: 13.5px; }
.bmeta .row { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; }
.bmeta .row > b { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding-top: 2px; }
.bmeta ul { margin: 0; padding-left: 16px; }
.bbody { padding: 6px 14px 14px; }
.narr { font-style: italic; color: var(--ink); margin: 8px 0; padding-left: 12px; border-left: 3px solid var(--line); }
.narr .lab { font-style: normal; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-right: 6px; font-weight: 600; }
.node { margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--line); scroll-margin-top: 150px; }
.node:first-of-type { border-top: 0; margin-top: 8px; padding-top: 0; }
.nlab { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
.say { margin: 5px 0; }
.say b.spk { font-family: var(--font-head); font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; font-size: 13px; margin-right: 8px; color: var(--accent); }
.replies { list-style: none; margin: 8px 0 0 0; padding: 0; counter-reset: rp; }
.reply { counter-increment: rp; margin: 8px 0 0 18px; padding: 6px 0 6px 12px; border-left: 2px solid var(--line); position: relative; }
.reply::before { content: counter(rp) "."; position: absolute; left: -20px; top: 6px; font-weight: 700; color: var(--accent); font-family: var(--font-head); }
.rl { font-weight: 500; }
.tone { font-size: 11.5px; padding: 0 7px; border-radius: 999px; background: var(--bg); border: 1px solid var(--line); color: var(--muted); margin-right: 6px; white-space: nowrap; font-weight: 500; vertical-align: 1px; }
.silent { background: var(--violet-weak); color: var(--violet); border-color: transparent; }
.req { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
.req::before { content: "Only shown if "; font-weight: 600; }
.does { list-style: none; margin: 4px 0 0; padding: 0; font-family: var(--font-mono); font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.does li { margin: 2px 0; display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 8px; }
.k { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 0; color: var(--muted); opacity: .9; }
.k-end, .k-end + span { color: var(--accent); font-weight: 600; }
.k-item, .k-item + span { color: var(--gold); font-weight: 600; }
.k-promise, .k-promise + span { color: var(--violet); }
.k-mem { color: var(--blue); }
.k-next { color: var(--accent); }
.goes { margin-top: 5px; font-size: 13px; }
.goes a { text-decoration: none; border-bottom: 1px dotted var(--accent); }
.oc { margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: var(--bg); }
.oc .when { font-size: 12px; font-weight: 700; color: var(--accent); }
.oc .otext { margin: 3px 0 0; }
.oc .does { margin-top: 5px; }
.oc + .oc { margin-top: 6px; }
.endtag { font-size: 11.5px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
.game { margin: 12px 0 0; padding: 12px 12px; border: 2px solid var(--blue); border-radius: 10px; background: var(--blue-weak); color: var(--ink); }
.game h5 { margin: 0; font-family: var(--font-head); font-size: 16px; }
.game .gm { font-size: 13px; color: var(--muted); margin: 2px 0 6px; }
.game .gt { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--blue); margin: 10px 0 3px; }
.game ul { margin: 2px 0; padding-left: 18px; font-size: 13.5px; }
.game table { border-collapse: collapse; width: 100%; font-size: 13px; }
.game td, .game th { text-align: left; vertical-align: top; padding: 4px 6px 4px 0; border-top: 1px solid var(--line); }
.game .scroll { overflow-x: auto; }
.game details summary { cursor: pointer; font-size: 13px; color: var(--blue); font-weight: 600; margin-top: 4px; }
.cond { background: var(--gold-weak); border-radius: 4px; padding: 0 3px; }
.cond .cw { font-size: 11.5px; font-weight: 600; color: var(--gold); font-style: normal; margin-right: 4px; }
.cond .cw::before { content: "if "; }
.ph { background: var(--violet-weak); color: var(--violet); border-radius: 4px; padding: 0 4px; font-size: 0.92em; font-style: normal; }
.var { margin-top: 10px; }
.var summary { cursor: pointer; font-weight: 600; font-size: 13.5px; }

/* endings, promises */
.card2 { margin: 8px 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
.card2 h4 { font-size: 15.5px; }
.card2 .lab { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 700; margin-top: 8px; }
.card2 p { margin: 3px 0; }

/* visuals */
.vgrp { margin: 8px 0; }
.vgrp h4 { font-size: 13px; font-family: var(--font-ui); font-weight: 700; margin-bottom: 3px; }
.vrow { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 8px; padding: 5px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
.vst { justify-self: start; font-size: 11.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; height: fit-content; text-align: center; white-space: nowrap; }
.vst.exists { background: var(--accent-weak); color: var(--accent); }
.vst.partly { background: var(--gold-weak); color: var(--gold); }
.vst.needs { background: var(--red-weak); color: var(--red); }
.vrow .vn { font-weight: 600; }
.vrow .vt { color: var(--muted); font-size: 13px; }

/* indexes */
.view[hidden] { display: none; }
.lead { margin: 14px 0 6px; color: var(--muted); max-width: 70ch; }
.irow { margin: 8px 0; padding: 12px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; display: grid; gap: 4px; }
.irow .nm { font-weight: 700; font-family: var(--font-head); font-size: 16px; }
.irow .sm { font-size: 13.5px; color: var(--muted); }
.irow .kind { font-size: 11.5px; padding: 1px 8px; border-radius: 999px; font-weight: 700; margin-right: 6px; background: var(--gold-weak); color: var(--gold); }
.irow .kind.skill { background: var(--blue-weak); color: var(--blue); }
.irow .kind.taken { background: var(--red-weak); color: var(--red); }
.odd { margin: 8px 0; padding: 10px 12px; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--gold); border-radius: 8px; }
.odd.k-dead { border-left-color: var(--red); }
.odd.k-waiting { border-left-color: var(--blue); }
.odd .who { font-weight: 700; font-family: var(--font-head); }
.odd .wh { font-size: 12.5px; color: var(--muted); }
.odd .kd { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--muted); }
.who2 { margin: 6px 0; }
.who2 summary { cursor: pointer; font-weight: 600; }
.who2 ul { margin: 4px 0 8px; padding-left: 20px; font-size: 14px; }
.empty { padding: 28px 0; text-align: center; color: var(--muted); }
@media (max-width: 560px) {
  .bmeta .row { grid-template-columns: 1fr; gap: 0; }
  .vrow { grid-template-columns: 1fr; gap: 2px; }
  .does li { grid-template-columns: 52px minmax(0, 1fr); }
  .shead { grid-template-columns: 1fr; }
  .copy { justify-self: start; }
  .st-title { font-size: 17px; }
  .tab { padding: 6px 8px; font-size: 13px; }
  .tabs { gap: 0; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>

<div class="wrap">
  <header class="top">
    <h1>The Story Book</h1>
    <p class="sub">Every story in full: who is in it, when it starts, every line, every choice and what it does, every ending, and what would have to be drawn.</p>
    <p class="notice">These stories are not switched on in a real career yet.</p>
    <p class="stamp" id="stamp">Loading the book…</p>
  </header>

  <section class="sum" id="summary" aria-label="Summary"></section>

  <div class="bar" id="bar">
    <div class="tabs" role="tablist" id="tabs"></div>
    <div class="tools">
      <input class="search" id="q" type="search" placeholder="Search title, person, any word of the text" aria-label="Search" autocomplete="off">
      <span class="count" id="count" aria-live="polite"></span>
    </div>
  </div>

  <div class="view" id="view-stories">
    <div class="actions">
      <button class="btn" id="fbtn" aria-pressed="false" aria-controls="filters">Filters</button>
      <button class="btn" id="expand">Expand all</button>
      <button class="btn" id="collapse">Collapse all</button>
    </div>
    <div class="filters" id="filters" hidden></div>
    <details class="toc" id="toc"><summary>Contents</summary><ol id="toclist"></ol></details>
    <div class="list" id="list"></div>
  </div>
  <div class="view" id="view-items" hidden></div>
  <div class="view" id="view-links" hidden></div>
  <div class="view" id="view-oddities" hidden></div>
</div>

<script>
(function () {
  var PH0 = "", PH1 = "", IF0 = "", IF1 = "", IFS = "";
  var D = null, S = [], byId = {};
  var state = { q: "", sizes: {}, tones: {}, role: "", batch: "", stage: "", game: false, item: false, from: false, link: false, wait: false, tab: "stories" };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "text") e.textContent = attrs[k]; else if (k === "class") e.className = attrs[k]; else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]); }
    if (kids) for (var i = 0; i < kids.length; i++) { var c = kids[i]; if (c === null || c === undefined || c === false) continue; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    return e;
  }
  /* Turn a marked string into DOM: chips for the {placeholders}, a gold "if" span for {if …}. */
  function fmt(s) {
    var root = document.createDocumentFragment(), stack = [root], cur = root, buf = "";
    function flush() { if (buf) { cur.appendChild(document.createTextNode(buf)); buf = ""; } }
    var inCw = false, cw = null;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === PH0) { flush(); var p = h("span", { class: "ph" }); cur.appendChild(p); stack.push(p); cur = p; }
      else if (ch === IF0) { flush(); var c = h("span", { class: "cond" }); cw = h("span", { class: "cw" }); c.appendChild(cw); cur.appendChild(c); stack.push(c); cur = cw; inCw = true; }
      else if (ch === IFS) { flush(); cur = stack[stack.length - 1]; inCw = false; }
      else if (ch === PH1 || ch === IF1) { flush(); stack.pop(); cur = stack[stack.length - 1]; }
      else buf += ch;
    }
    flush();
    return root;
  }
  function plain(s) { return String(s || "").replace(new RegExp(IF0 + "[^" + IFS + "]*" + IFS, "g"), "").replace(new RegExp("[" + PH0 + PH1 + IF0 + IF1 + IFS + "]", "g"), ""); }
  function span(s, cls) { var e = h("span", cls ? { class: cls } : null); e.appendChild(fmt(s)); return e; }
  function p(s, cls) { var e = h("p", cls ? { class: cls } : null); e.appendChild(fmt(s)); return e; }
  function ul(items, cls) { if (!items || !items.length) return null; var u = h("ul", { class: cls || "plain" }); items.forEach(function (t) { var li = h("li"); li.appendChild(fmt(t)); u.appendChild(li); }); return u; }
  function sec(title, count, kids) { var s = h("section", { class: "sec" }, [h("h3", null, [title, count !== undefined && count !== null ? h("span", { class: "c", text: "  " + count }) : null])]); (kids || []).forEach(function (k) { if (k) s.appendChild(k); }); return s; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ───────── effects lists ───────── */
  var KLAB = { bar: "bar", money: "money", person: "person", mem: "memory", story: "story", next: "next", end: "ends", item: "item", promise: "promise", flag: "flag", game: "game", train: "skill", talk: "talk", cost: "cost" };
  function replyKind(t) { if (t.indexOf("MAKES A PROMISE") === 0) return "promise"; if (t.indexOf("Story note") === 0) return "story"; if (t.indexOf("His mood") === 0 || t.indexOf("Remembered") === 0) return "talk"; if (t.indexOf("This answer") === 0) return "cost"; return "story"; }
  function does(list, isReply) {
    if (!list || !list.length) return null;
    var u = h("ul", { class: "does" });
    list.forEach(function (d) {
      var k = isReply ? replyKind(String(d.t || d)) : d.k, t = isReply ? String(d) : d.t;
      var li = h("li", null, [h("span", { class: "k k-" + k, text: KLAB[k] || k })]);
      li.appendChild(span(t));
      u.appendChild(li);
    });
    return u;
  }

  /* ───────── a story's body (built the first time it opens) ───────── */
  function outcomeBox(o) {
    var box = h("div", { class: "oc", "data-k": "outcome", "data-key": o.key });
    if (o.when) box.appendChild(h("div", { class: "when", text: o.when }));
    if (o.text) box.appendChild(p(o.text, "otext"));
    else box.appendChild(h("p", { class: "otext grey", text: "(no text; only the effects below)" }));
    var d = does(o.does); if (d) box.appendChild(d);
    return box;
  }
  function activityBox(a, nodeId) {
    var g = h("div", { class: "game", "data-k": "game" }, [h("h5", null, ["GAME: ", span(a.name)]), h("div", { class: "gm", text: a.modeWords })]);
    if (a.notBuilt) g.appendChild(h("p", { class: "tiny", text: "This game mode is not built yet, so the story waits (it never plays)." }));
    if (a.intro) g.appendChild(h("p", null, ["Intro shown: ", span(a.intro)]));
    var facts = [];
    if (a.setup && a.setup.length) facts = facts.concat(a.setup);
    facts.push("score counted as: " + a.score);
    if (a.winRule) facts.push(a.winRule);
    facts.push("you can walk away from it: " + (a.canAbandon ? "yes (the result is “stopped”)" : "no"));
    (a.cost || []).forEach(function (c) { facts.push("playing it " + c); });
    if (a.stakes) facts.push(a.stakes);
    g.appendChild(h("div", { class: "gt", text: "Set-up" })); g.appendChild(ul(facts));
    if (a.rounds && a.rounds.length) {
      g.appendChild(h("div", { class: "gt", text: "Rounds and balls (in order)" }));
      var tb = h("table"); tb.appendChild(h("tr", null, [h("th", { text: "Ball" }), h("th", { text: "Round" }), h("th", { text: "What you have to do" }), h("th", { text: "He says" })]));
      a.rounds.forEach(function (r) { r.balls.forEach(function (b, i) { var tr = h("tr"); tr.appendChild(h("td", { text: String(b.n) })); var td = h("td"); td.appendChild(span(r.name)); tr.appendChild(td); var t2 = h("td"); t2.appendChild(span(b.words)); tr.appendChild(t2); var t3 = h("td"); t3.appendChild(span(b.call)); tr.appendChild(t3); tb.appendChild(tr); }); });
      g.appendChild(h("div", { class: "scroll" }, [tb]));
      var cards = ul(a.rounds.map(function (r) { return "Round " + r.n + " card: " + r.name + (r.line ? " — “" + r.line + "”" : ""); })); if (cards) { g.appendChild(h("div", { class: "gt", text: "Round cards" })); g.appendChild(cards); }
    }
    if (a.callerLines && a.callerLines.length) { var d1 = h("details"); d1.appendChild(h("summary", { text: "His counting lines (" + a.callerLines.length + ")" })); d1.appendChild(ul(a.callerLines)); g.appendChild(d1); }
    if (a.reactions && a.reactions.length) { var d2 = h("details"); d2.appendChild(h("summary", { text: "His reaction lines (" + a.reactions.length + ")" })); d2.appendChild(ul(a.reactions.map(function (r) { return r.k + ": " + r.v; }))); g.appendChild(d2); }
    g.appendChild(h("div", { class: "gt", text: "If the phone cannot run it" })); g.appendChild(h("p", { class: "tiny", text: a.fallback }));
    return g;
  }
  function nodeBlock(b, n) {
    var el = h("div", { class: "node", id: "n-" + b._k + "-" + n.id });
    var lab = "Moment " + n.idx + (n.screen ? " · " + n.screen : "");
    el.appendChild(h("div", { class: "nlab", text: lab }));
    n.say.forEach(function (l) { var d = h("p", { class: "say", "data-k": "say" }, [h("b", { class: "spk", text: n.who || "Narrator" })]); d.appendChild(fmt(l)); el.appendChild(d); });
    if (n.activity) el.appendChild(activityBox(n.activity, n.id));
    if (n.result && n.result.length) {
      var rl = h("ul", { class: "plain" });
      n.result.forEach(function (r) { var li = h("li"); li.appendChild(document.createTextNode("When the game ends: " + r.cond + " → ")); var a = h("a", { href: "#", "data-goto": "n-" + b._k + "-" + r.to }); a.appendChild(fmt(r.toTitle)); li.appendChild(a); rl.appendChild(li); });
      el.appendChild(h("div", { class: "nlab", text: "What happens after the game" })); el.appendChild(rl);
    }
    if (n.replies.length) {
      var ol = h("ol", { class: "replies" });
      n.replies.forEach(function (r) {
        var li = h("li", { class: "reply", "data-k": "choice" });
        var rl = h("div", { class: "rl" });
        if (r.tone) rl.appendChild(h("span", { class: "tone", text: r.tone }));
        if (r.silent) rl.appendChild(h("span", { class: "tone silent", text: "says nothing" }));
        rl.appendChild(fmt(r.label)); li.appendChild(rl);
        if (r.note) li.appendChild(h("div", { class: "tiny grey", text: "Shown under the story strip: " + r.note }));
        if (r.requires.length) { var rq = h("div", { class: "req" }); rq.appendChild(document.createTextNode(r.requires.join("; "))); li.appendChild(rq); }
        var d = does(r.does, true); if (d) li.appendChild(d);
        if (r.goto) { var g = h("div", { class: "goes" }); g.appendChild(document.createTextNode(r.gotoIsGame ? "Plays the game → " : "Goes on to → ")); var a = h("a", { href: "#", "data-goto": "n-" + b._k + "-" + r.goto }); a.appendChild(fmt(r.gotoTitle)); g.appendChild(a); li.appendChild(g); }
        if (r.end) { li.appendChild(h("div", { class: "endtag", text: "Ends the talk (“" + r.end + "”). What happens:" })); r.outcomes.forEach(function (o) { li.appendChild(outcomeBox(o)); }); }
        ol.appendChild(li);
      });
      el.appendChild(ol);
    }
    return el;
  }
  function beatBlock(s, b, bi) {
    b._k = s.slug + "-" + bi;
    var head = h("div", { class: "bhead" }, [h("div", { class: "no", text: (b.n ? "Beat " + b.n + " of " + b.mainOf : "Side beat (no number on the main line)") + (b.kind === "card" ? " · a card with choices" : " · a talk") }), h("h4"), b.hint ? h("div", { class: "hint" }) : null]);
    head.querySelector("h4").appendChild(fmt(b.title)); if (b.hint) { head.querySelector(".hint").appendChild(document.createTextNode("Quest-log line: ")); head.querySelector(".hint").appendChild(fmt(b.hint)); }
    var el = h("section", { class: "beat", id: "b-" + b._k, "data-k": "beat" }, [head]);
    var meta = h("div", { class: "bmeta" });
    function row(label, kids) { if (!kids) return; var r = h("div", { class: "row" }, [h("b", { text: label })]); var c = h("div"); if (Array.isArray(kids)) kids.forEach(function (x) { if (x) c.appendChild(x); }); else c.appendChild(kids); r.appendChild(c); meta.appendChild(r); }
    row("When it comes", ul(b.timing.concat(b.extra)));
    row("Needs", b.requires.length ? ul(b.requires) : h("span", { class: "grey", text: "nothing extra" }));
    row("How it arrives", ul(b.entry));
    var wh = ["Looks like: " + b.where.template + ".", "Place: " + b.where.place + ".", "Screen: " + b.where.screen + ".", "Plays " + b.where.moments.join(" or ") + "."];
    row("Where it shows", ul(wh));
    if (b.variants.length) row("Variants", ul(b.variants.map(function (v) { return "If " + v.cond + ": " + v.what; })));
    if (b.look.length) row("Card look", ul(b.look));
    if (b.newPeople.length) row("New people", ul(b.newPeople.map(function (x) { return x.label + " joins here. " + x.how; })));
    el.appendChild(meta);
    var body = h("div", { class: "bbody" });
    b.setup.forEach(function (l) { var d = h("p", { class: "narr", "data-k": "narr" }, [h("span", { class: "lab", text: "Scene" })]); d.appendChild(fmt(l)); body.appendChild(d); });
    if (b.talkStart) body.appendChild(h("p", { class: "tiny grey", text: b.talkStart }));
    (b.nodes || []).forEach(function (n) { body.appendChild(nodeBlock(b, n)); });
    if (b.choices) {
      var ol = h("ol", { class: "replies" });
      b.choices.forEach(function (c) {
        var li = h("li", { class: "reply", "data-k": "choice" });
        var rl = h("div", { class: "rl" });
        if (c.tone) rl.appendChild(h("span", { class: "tone", text: c.tone }));
        if (c.silent) rl.appendChild(h("span", { class: "tone silent", text: "says nothing" }));
        rl.appendChild(fmt(c.label)); li.appendChild(rl);
        if (c.requires.length) li.appendChild(h("div", { class: "req", text: c.requires.join("; ") }));
        var d = does(c.does, true); if (d) li.appendChild(d);
        c.outcomes.forEach(function (o) { li.appendChild(outcomeBox(o)); });
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }
    if (b.otherEnds && b.otherEnds.length) {
      body.appendChild(h("div", { class: "nlab", text: "Other ways this talk ends" }));
      b.otherEnds.forEach(function (x) { body.appendChild(h("div", { class: "endtag", text: "“" + x.key + "” — reached by: " + x.via })); x.outcomes.forEach(function (o) { body.appendChild(outcomeBox(o)); }); });
    }
    if (b.callbacks.length) {
      body.appendChild(h("div", { class: "nlab", text: "Callback lines (spoken later, when the memory is held)" }));
      b.callbacks.forEach(function (c) { var d = h("p", { class: "say" }, [h("span", { class: "tiny grey", text: "If " + c.memory + " (in " + c.where + "): " })]); d.appendChild(fmt(c.line)); body.appendChild(d); });
    }
    if (b.unreachedNodes && b.unreachedNodes.length) body.appendChild(h("p", { class: "tiny grey", text: "Moments that no reply leads to: " + b.unreachedNodes.join(", ") }));
    el.appendChild(body);
    return el;
  }
  function visuals(s) {
    var v = s.visuals, labs = { exists: "exists today", partly: "partly exists", needs: "needs making" };
    function grp(title, list) {
      if (!list.length) return null;
      var g = h("div", { class: "vgrp" }, [h("h4", { text: title + " (" + list.length + ")" })]);
      list.forEach(function (x) { var r = h("div", { class: "vrow" }, [h("span", { class: "vst " + x.status, text: labs[x.status] })]); var c = h("div"); c.appendChild(h("div", { class: "vn" })); c.firstChild.appendChild(fmt(x.name)); c.appendChild(h("div", { class: "vt", text: x.note + (x.where ? " (" + x.where + ")" : "") })); r.appendChild(c); g.appendChild(r); });
      return g;
    }
    var all = [].concat(v.people, v.places, v.props, v.cutscenes, v.phone, v.games);
    var need = all.filter(function (x) { return x.status === "needs"; }).length, part = all.filter(function (x) { return x.status === "partly"; }).length;
    return sec("Visuals needed", need + " need making, " + part + " partly exist, " + (all.length - need - part) + " exist", [
      h("p", { class: "tiny grey", text: "Worked out from this story's own people, places, objects and moments. The prop list comes from words found in the text, so check it by eye." }),
      grp("People", v.people), grp("Places", v.places), grp("Props, objects and special items", v.props), grp("Cut-scene moments", v.cutscenes), grp("Phone screens", v.phone), grp("Games", v.games)]);
  }
  function buildBody(s) {
    var b = h("div", { class: "sbody" });
    var c = s.counts;
    b.appendChild(h("div", { class: "facts" }, [
      h("span", null, ["Size ", h("b", { text: s.size })]), h("span", null, ["Owner ", h("b", { text: s.owner })]), h("span", null, [h("b", { text: s.batch })]), h("span", null, [h("b", { text: s.stage })]),
      h("span", null, [h("b", { text: String(c.beats) }), " beats · ", h("b", { text: String(c.say) }), " speech lines · ", h("b", { text: String(c.choices) }), " choices · ", h("b", { text: String(c.endings) }), " endings" + (c.games ? " · " + c.games + " game" + (c.games > 1 ? "s" : "") : "")])]));
    if (s.waiting) b.appendChild(h("p", { class: "notice", text: "This story waits for the game mode “" + s.waiting + "”, which is not built. It is checked but can never play yet." }));
    b.appendChild(h("p", null, [h("b", { text: "In one go: " }), fmt(s.summary)]));
    if (s.tones.length || s.who.length) b.appendChild(h("p", { class: "tiny grey", text: "Tone: " + s.tones.join(", ") + ". About: " + s.who.join(", ") + "." }));

    var cast = s.cast.map(function (x) { var d = h("div", { class: "person" }, [h("b", { text: cap(x.label) }), x.optional ? " (optional) " : " "]); d.appendChild(document.createTextNode("— " + x.how)); if (x.pool) { var pl = h("ul", { class: "pool" }); x.pool.forEach(function (q) { pl.appendChild(h("li", { text: q.name + ", " + q.age + ", from " + q.from + ". " + q.manner + " Look preset: " + q.look + "." })); }); d.appendChild(h("div", { class: "pool" }, ["The career gets one of:", pl])); } return d; });
    var np = s.newPeople.map(function (x) { return h("div", { class: "person" }, [h("b", { text: cap(x.label) }), " joins at the beat “" + plain(x.beat) + "”. " + x.how]); });
    var sp = s.speakers.length ? h("p", { class: "tiny" }, ["Speaking parts (lines spoken): " + s.speakers.map(function (x) { return x.name + " " + x.n; }).join(" · ")]) : null;
    b.appendChild(sec("Who is in it", s.cast.length + (s.cast.length === 1 ? " person" : " people"), cast.concat(np.length ? [h("p", { class: "tiny grey", text: "New people who come in later:" })] : [], np, [sp])));

    var st = s.start, sl = [];
    sl.push(h("div", { class: "kv" }, [h("b", { text: "Moment: " }), "it can only begin " + st.moments.join(" or ") + "."]));
    var cl = h("div", { class: "kv" }, [h("b", { text: "Conditions on you: " })]); if (st.conditions.length) cl.appendChild(ul(st.conditions)); else cl.appendChild(document.createTextNode("none beyond the moment.")); sl.push(cl);
    sl.push(h("div", { class: "kv" }, [h("b", { text: "Chance: " }), st.chanceText]));
    sl.push(h("div", { class: "kv" }, [h("b", { text: "Share of careers: " }), st.careersText]));
    sl.push(h("div", { class: "kv grey" }, ["Pacing for every story: at most one new story at a moment, at least three weeks after the last one began, and at most 12 stories open at once."]));
    if (st.needs.length) sl.push(h("div", { class: "kv" }, [h("b", { text: "Needs another story: " }), st.needs.map(function (n) { return "“" + n.title + "” must have left the memory “" + n.tag + "”"; }).join("; ") + "."]));
    else sl.push(h("div", { class: "kv" }, [h("b", { text: "Needs another story: " }), "no. It can begin in a career that has met no other story."]));
    b.appendChild(sec("When it can start", null, sl));

    if (s.vars.length || s.clocks.length) {
      var d = h("details", { class: "var" }, [h("summary", { text: "Story notes and clocks the story keeps" })]);
      if (s.vars.length) d.appendChild(h("p", { class: "tiny" }, ["Notes (name = starting value): " + s.vars.map(function (v) { return v.k + " = " + v.v; }).join(" · ")]));
      s.clocks.forEach(function (k) { var q = h("p", { class: "tiny" }); q.appendChild(document.createTextNode("Clock “")); q.appendChild(fmt(k.label)); q.appendChild(document.createTextNode("”: " + k.segments + " segments, starts when beat “" + plain(k.startsAt) + "” plays, moves " + k.ticks + ". When full, beat “" + plain(k.onFull) + "” comes up.")); d.appendChild(q); });
      b.appendChild(d);
    }
    var beatsSec = sec("The story, beat by beat", s.beats.length + " beats", []);
    s.beats.forEach(function (bt, i) { beatsSec.appendChild(beatBlock(s, bt, i)); });
    b.appendChild(beatsSec);
    if (s.promises.length) {
      var ps = s.promises.map(function (pr) {
        var el = h("div", { class: "card2", "data-k": "promise" }, [h("h4")]); el.firstChild.appendChild(fmt(pr.text));
        el.appendChild(h("p", { class: "tiny", text: "Promised to: " + pr.to + ". Due: " + pr.due + ". Phone list says: “" + pr.dueText + "”." }));
        if (pr.remind) { var rr = h("p", { class: "tiny" }); rr.appendChild(fmt(pr.remind)); el.appendChild(rr); }
        var kb = h("p", { class: "tiny" }); kb.appendChild(fmt(pr.keptBy)); el.appendChild(kb);
        if (pr.madeBy.length) el.appendChild(h("p", { class: "tiny", text: "Made by: " + pr.madeBy.join("; ") }));
        [["If kept", pr.kept], ["If broken", pr.broken]].forEach(function (x) { if (!x[1]) return; el.appendChild(h("div", { class: "lab", text: x[0] })); if (x[1].text) el.appendChild(p(x[1].text)); var d = does(x[1].does); if (d) el.appendChild(d); });
        return el;
      });
      b.appendChild(sec("Promises", s.promises.length, ps));
    }
    var es = s.ends.map(function (e) {
      var el = h("div", { class: "card2", "data-k": "ending" }, [h("h4")]); el.firstChild.appendChild(fmt(e.title));
      el.appendChild(p(e.text));
      el.appendChild(h("div", { class: "lab", text: "How you reach it" }));
      if (e.reachedBy.length) { el.appendChild(ul(e.reachedBy.map(function (r) { return r.where + " " + r.how + (r.cond ? " (" + r.cond + ")" : ""); }))); } else el.appendChild(h("p", { class: "tiny", text: "Nothing reaches this ending." }));
      el.appendChild(h("div", { class: "lab", text: "What it leaves behind" }));
      var d = does(e.leaves); if (d) el.appendChild(d); else el.appendChild(h("p", { class: "tiny grey", text: "Nothing but the ending itself." }));
      if ((e.unlocks && e.unlocks.length) || (e.blocks && e.blocks.length)) { el.appendChild(h("div", { class: "lab", text: "Later stories" })); el.appendChild(ul((e.unlocks || []).map(function (x) { return "Feeds " + x; }).concat((e.blocks || []).map(function (x) { return "Blocks " + x; })))); }
      return el;
    });
    b.appendChild(sec("Endings", s.ends.length, es));
    b.appendChild(visuals(s));
    var items = D.items.filter(function (x) { return x.story === s.id; });
    var ll = s.linksIn.map(function (l) { return "Needs/blocked by " + l.fromTitle + " (“" + l.tag + "”, " + l.kind + ")"; }).concat(s.linksOut.map(function (l) { return "Feeds " + l.toTitle + " (“" + l.tag + "”, " + l.kind + ")"; }));
    if (items.length || ll.length) {
      var k = [];
      if (items.length) k.push(h("p", { class: "tiny" }, [h("b", { text: "Items and unlocks it gives: " }), items.map(function (x) { return x.name + " (at " + plain(x.beat) + ")"; }).join("; ")]));
      if (ll.length) k.push(h("div", null, [h("p", { class: "tiny" }, [h("b", { text: "Links to other stories:" })]), ul(ll)]));
      b.appendChild(sec("Items and links", null, k));
    }
    b.appendChild(h("div", { class: "ids", text: "id " + s.id + (s.code ? " · code " + s.code : "") + " · file book/arcs/" + s.file + " · order in the book " + s.order }));
    return b;
  }

  /* ───────── the list of cards ───────── */
  function toneChips(s) { return s.tones.map(function (t) { return h("span", { class: "tag", text: t }); }); }
  function roleLabel(k) { for (var i = 0; i < D.roleFilter.length; i++) if (D.roleFilter[i].key === k) return D.roleFilter[i].label; return k; }
  function copyLink(slug, btn) {
    var url = location.href.split("#")[0] + "#story-" + slug;
    function done(t) { var old = btn.textContent; btn.textContent = t; setTimeout(function () { btn.textContent = old; }, 1400); }
    function fallback() { var i = h("input", { value: url, style: "position:fixed;opacity:0;left:0;top:0" }); document.body.appendChild(i); i.select(); try { document.execCommand("copy"); done("Copied"); } catch (e) { done("Select it in the address bar"); } document.body.removeChild(i); }
    try { navigator.clipboard.writeText(url).then(function () { done("Copied"); }, fallback); } catch (e) { fallback(); }
  }
  function toggle(s, open) {
    var el = s._el, want = open === undefined ? el.getAttribute("data-open") !== "1" : open;
    if (want && !s._body) { s._body = buildBody(s); el.appendChild(s._body); }
    if (s._body) s._body.hidden = !want;
    el.setAttribute("data-open", want ? "1" : "0");
    s._btn.setAttribute("aria-expanded", want ? "true" : "false");
  }
  function buildCard(s, i) {
    var tags = [h("span", { class: "tag size", text: s.size }, null)].concat(toneChips(s));
    s.roles.slice(0, 4).forEach(function (r) { tags.push(h("span", { class: "tag", text: roleLabel(r) })); });
    tags.push(h("span", { class: "tag", text: s.batchKey === "b1" ? "batch 1" : s.batchKey === "b2" ? "batch 2" : "batch 3" }));
    if (s.flags.hasGame) tags.push(h("span", { class: "tag t-game", text: "has a game" }));
    if (s.flags.givesItem) tags.push(h("span", { class: "tag t-item", text: "gives an item" }));
    if (s.flags.startsFromOther) tags.push(h("span", { class: "tag t-link", text: "starts from another story" }));
    else if (s.flags.usesLink) tags.push(h("span", { class: "tag t-link", text: "linked to another story" }));
    if (s.flags.waiting) tags.push(h("span", { class: "tag t-wait", text: "not playable yet" }));
    var btn = h("button", { class: "stoggle", "aria-expanded": "false", type: "button" }, [
      h("div", { class: "st-title" }, [h("span", { class: "st-no", text: "#" + (i + 1) })]),
      h("div", { class: "st-prem" }), h("div", { class: "tags" }, tags)]);
    btn.querySelector(".st-title").appendChild(document.createTextNode(plain(s.title)));
    btn.querySelector(".st-prem").textContent = s.premise;
    var cp = h("button", { class: "btn copy", type: "button", title: "Copy a link to this story", text: "Copy link" });
    var el = h("article", { class: "story", id: "story-" + s.slug, "data-open": "0" }, [h("div", { class: "shead" }, [btn, cp])]);
    btn.addEventListener("click", function () { toggle(s); });
    cp.addEventListener("click", function () { copyLink(s.slug, cp); });
    s._el = el; s._btn = btn;
    return el;
  }

  /* ───────── search and filters ───────── */
  function collect(o, out) { if (typeof o === "string") out.push(o); else if (Array.isArray(o)) for (var i = 0; i < o.length; i++) collect(o[i], out); else if (o && typeof o === "object") for (var k in o) { if (k.charAt(0) === "_") continue; collect(o[k], out); } }
  function blobOf(s) { if (s._blob) return s._blob; var out = []; collect(s, out); s._blob = plain(out.join(" ")).toLowerCase(); return s._blob; }
  function matches(s) {
    var q = state.q.trim().toLowerCase();
    if (q) { var parts = q.split(/\s+/), bl = blobOf(s); for (var i = 0; i < parts.length; i++) if (bl.indexOf(parts[i]) < 0) return false; }
    var sz = Object.keys(state.sizes).filter(function (k) { return state.sizes[k]; }); if (sz.length && sz.indexOf(s.size) < 0) return false;
    var tn = Object.keys(state.tones).filter(function (k) { return state.tones[k]; }); if (tn.length && !tn.some(function (t) { return s.tones.indexOf(t) >= 0; })) return false;
    if (state.role && s.roles.indexOf(state.role) < 0) return false;
    if (state.batch && s.batchKey !== state.batch) return false;
    if (state.stage && s.stage !== state.stage) return false;
    if (state.game && !s.flags.hasGame) return false;
    if (state.item && !s.flags.givesItem) return false;
    if (state.from && !s.flags.startsFromOther) return false;
    if (state.link && !s.flags.usesLink) return false;
    if (state.wait && !s.flags.waiting) return false;
    return true;
  }
  var qTimer = null;
  function applyFilters() {
    var n = 0, toc = document.getElementById("toclist"); toc.innerHTML = "";
    S.forEach(function (s, i) { var ok = matches(s); s._el.hidden = !ok; if (ok) { n++; var li = h("li"); var a = h("a", { href: "#story-" + s.slug, "data-open": s.slug, text: plain(s.title) }); li.appendChild(a); toc.appendChild(li); } });
    state.n = n;
    updateCount();
    var es = document.getElementById("empty");
    if (!n && !es) document.getElementById("list").appendChild(h("div", { class: "empty", id: "empty", text: "No story matches. Clear a filter or a word." })); else if (n && es) es.remove();
    document.querySelector("#toc > summary").textContent = "Contents (" + n + ")";
  }
  function updateCount() {
    var c = document.getElementById("count");
    if (state.tab === "stories") c.textContent = state.n + " of " + S.length + " match";
    else if (state.tab === "items") c.textContent = (state.cnt || 0) + " of " + D.items.length + " match";
    else if (state.tab === "links") c.textContent = (state.cnt || 0) + " of " + D.links.length + " match";
    else c.textContent = (state.cnt || 0) + " of " + D.oddities.length + " match";
  }

  function buildFilters() {
    var f = document.getElementById("filters"), sizes = ["small", "medium", "big"];
    function chips(title, items, key) { var g = h("div", { class: "fgrp" }, [h("label", { class: "t", text: title })]); var c = h("div", { class: "chips" }); items.forEach(function (x) { var b = h("button", { class: "chip", type: "button", "aria-pressed": "false", text: x.label + (x.n !== undefined ? " " + x.n : "") }); b.addEventListener("click", function () { state[key][x.k] = !state[key][x.k]; b.setAttribute("aria-pressed", state[key][x.k] ? "true" : "false"); applyFilters(); }); c.appendChild(b); }); g.appendChild(c); return g; }
    function select(title, key, opts) { var g = h("div", { class: "fgrp" }, [h("label", { class: "t", for: "f-" + key, text: title })]); var sel = h("select", { id: "f-" + key }); sel.appendChild(h("option", { value: "", text: "Any" })); opts.forEach(function (o) { sel.appendChild(h("option", { value: o.k, text: o.label })); }); sel.addEventListener("change", function () { state[key] = sel.value; applyFilters(); }); g.appendChild(sel); return g; }
    function count(fn) { return S.filter(fn).length; }
    f.appendChild(chips("Size", sizes.map(function (x) { return { k: x, label: x, n: count(function (s) { return s.size === x; }) }; }), "sizes"));
    f.appendChild(chips("Tone", D.summary.byTone.map(function (t) { return { k: t.k, label: t.k, n: t.n }; }), "tones"));
    f.appendChild(select("Person (role in the cast)", "role", D.roleFilter.map(function (r) { return { k: r.key, label: r.label + " (" + count(function (s) { return s.roles.indexOf(r.key) >= 0; }) + ")" }; })));
    f.appendChild(select("Batch", "batch", [{ k: "b1", label: "Batch 1 (20–21 Nov)" }, { k: "b2", label: "Batch 2 (27 Nov)" }, { k: "b3", label: "Batch 3 (28 Nov)" }]));
    f.appendChild(select("Career stage", "stage", D.stages.map(function (x) { return { k: x.key, label: x.label + " (" + count(function (s) { return s.stage === x.key; }) + ")" }; })));
    var g = h("div", { class: "fgrp checks" }, [h("label", { class: "t", text: "Only stories that…" })]);
    [["game", "have a game", function (s) { return s.flags.hasGame; }], ["item", "give an item or unlock", function (s) { return s.flags.givesItem; }], ["from", "start from another story", function (s) { return s.flags.startsFromOther; }], ["link", "are linked to another story (give or take a memory)", function (s) { return s.flags.usesLink; }], ["wait", "are not playable yet", function (s) { return s.flags.waiting; }]].forEach(function (x) {
      var id = "f-" + x[0], cb = h("input", { type: "checkbox", id: id }); cb.addEventListener("change", function () { state[x[0]] = cb.checked; applyFilters(); });
      g.appendChild(h("label", { for: id }, [cb, " " + x[1] + " (" + count(x[2]) + ")"]));
    });
    f.appendChild(g);
    var clr = h("button", { class: "btn", type: "button", text: "Clear all filters" }); clr.addEventListener("click", function () { state.q = ""; state.sizes = {}; state.tones = {}; state.role = ""; state.batch = ""; state.stage = ""; state.game = state.item = state.from = state.link = state.wait = false; document.getElementById("q").value = ""; f.innerHTML = ""; buildFilters(); applyFilters(); });
    f.appendChild(h("div", { class: "fgrp" }, [clr]));
  }

  /* ───────── summary ───────── */
  function buildSummary() {
    var T = D.summary.totals, el = document.getElementById("summary"), nums = h("div", { class: "nums" });
    [[T.stories, "stories"], [T.beats, "beats"], [T.speech, "lines of speech"], [T.choices, "choices"], [T.endings, "endings"], [T.outcomes, "outcomes written"], [T.games, "games"], [T.promises, "promises"], [T.items, "items and unlocks given"], [T.links, "links between stories"], [T.waiting, "not playable yet"], [T.oddities, "oddities found"]].forEach(function (x) { nums.appendChild(h("div", { class: "num" }, [h("b", { text: String(x[0]) }), h("span", { text: x[1] })])); });
    el.appendChild(nums);
    var br = h("div", { class: "breaks" });
    function brk(title, list, scroll) { var max = Math.max.apply(null, list.map(function (x) { return x.n; })); var d = h("div", { class: "brk" + (scroll ? " scroll" : "") }, [h("h3", { text: title })]); var rows = h("div", { class: "rows" }); list.forEach(function (x) { rows.appendChild(h("div", { class: "brow" }, [h("div", { class: "lab" }, [h("span", { text: x.k }), h("i", { text: String(x.n) })]), h("div", { class: "track" }, [h("div", { class: "fill", style: "width:" + Math.round(x.n / max * 100) + "%" })])])); }); d.appendChild(rows); return d; }
    br.appendChild(brk("By size", D.summary.bySize)); br.appendChild(brk("By tone", D.summary.byTone, true)); br.appendChild(brk("By person in the cast", D.summary.byRole, true)); br.appendChild(brk("By batch", D.summary.byBatch)); br.appendChild(brk("By career stage", D.summary.byStage)); br.appendChild(brk("Who speaks the most (lines)", D.summary.speakers, true));
    el.appendChild(br);
    var tot = h("p", { class: "tiny grey", text: "Also in the stories: " + T.otherLines + " more lines (the counting lines and reactions inside games, plus callback lines), " + T.variants + " place-or-opening variants, " + T.narration + " lines of scene narration. “Speech lines” counts every line a person says inside a talk." });
    el.appendChild(tot);
  }

  /* ───────── index tabs ───────── */
  function storyLink(id, title) { var a = h("a", { href: "#story-" + id.replace(/^arc-/, ""), "data-open": id.replace(/^arc-/, "") }); a.appendChild(fmt(title)); return a; }
  function buildItems() {
    var v = document.getElementById("view-items");
    v.innerHTML = "";
    v.appendChild(h("p", { class: "lead", text: "Everything a story gives you or takes away: items, garden unlocks, trophies, skills that go up for good. Each row says which story, which beat, what you chose, which ending, and any condition." }));
    var q = state.q.trim().toLowerCase(), list = D.items.filter(function (x) { return !q || plain([x.name, x.desc, x.storyTitle, x.beat, x.via, x.kind].join(" ")).toLowerCase().indexOf(q) >= 0; });
    state.cnt = list.length; updateCount();
    var KN = { item: "item", unlock: "unlock", trophy: "trophy", skill: "skill", taken: "taken" };
    list.forEach(function (x) {
      var r = h("div", { class: "irow" }, [h("div", null, [h("span", { class: "kind " + x.kind, text: KN[x.kind] || x.kind })])]);
      var nm = h("div", { class: "nm" }); nm.appendChild(fmt(x.name)); r.firstChild.appendChild(nm); r.firstChild.style.display = "block";
      if (x.desc) { var d = h("div", { class: "sm" }); d.appendChild(fmt(x.desc)); r.appendChild(d); }
      var w = h("div", { class: "sm" }); w.appendChild(document.createTextNode("From the story ")); w.appendChild(storyLink(x.story, x.storyTitle)); if (x.storyWaiting) w.appendChild(document.createTextNode(" (a story that cannot play yet)")); w.appendChild(document.createTextNode(", at the beat “")); w.appendChild(fmt(x.beat)); w.appendChild(document.createTextNode("”.")); r.appendChild(w);
      var how = h("div", { class: "sm" }); how.appendChild(document.createTextNode("You get it by choosing ")); how.appendChild(fmt(x.via)); how.appendChild(document.createTextNode(x.end ? ", which ends the talk as “" + x.end + "”." : ".")); r.appendChild(how);
      if (x.cond) { var c = h("div", { class: "sm" }); c.appendChild(document.createTextNode("Only if ")); c.appendChild(fmt(x.cond)); r.appendChild(c); }
      v.appendChild(r);
    });
    if (!list.length) v.appendChild(h("div", { class: "empty", text: "Nothing matches." }));
  }
  function buildLinks() {
    var v = document.getElementById("view-links"); v.innerHTML = "";
    v.appendChild(h("p", { class: "lead", text: "Which stories unlock or block which. A story reaches another only through a memory (or a flag) it leaves behind. The rest of the book does not depend on each other: they only share people." }));
    var q = state.q.trim().toLowerCase(), list = D.links.filter(function (l) { return !q || plain([l.fromTitle, l.toTitle, l.tag, l.detail].join(" ")).toLowerCase().indexOf(q) >= 0; });
    state.cnt = list.length; updateCount();
    list.forEach(function (l) {
      var r = h("div", { class: "irow" });
      var t = h("div", { class: "nm" }); if (l.from) t.appendChild(storyLink(l.from, l.fromTitle)); else t.appendChild(document.createTextNode(l.fromTitle)); t.appendChild(document.createTextNode(l.kind === "needs" ? "  →  feeds  →  " : "  →  blocks  →  ")); t.appendChild(storyLink(l.to, l.toTitle)); r.appendChild(t);
      var d = h("div", { class: "sm" }); d.appendChild(fmt(l.detail)); r.appendChild(d);
      r.appendChild(h("div", { class: "sm", text: "Written at: " + plain(l.writtenAt) + ". Read at: " + l.readAt + (l.startsStory ? " (it decides whether the second story can start at all)" : " (inside the second story)") + "." }));
      v.appendChild(r);
    });
    if (!list.length) v.appendChild(h("div", { class: "empty", text: "Nothing matches." }));
    var withLinks = {}; D.links.forEach(function (l) { withLinks[l.from] = 1; withLinks[l.to] = 1; });
    v.appendChild(h("p", { class: "lead", text: (S.length - Object.keys(withLinks).filter(function (k) { return byId[k]; }).length) + " of " + S.length + " stories have no link to any other story." }));
    v.appendChild(h("h3", { text: "Who turns up in which stories", style: "margin-top:22px" }));
    v.appendChild(h("p", { class: "lead", text: "The same person is kept for good in a career (one kit man, one mum, one chairman…), so a role that appears in many stories is one person meeting you again and again. This is not an unlock chain, but the stories share that person's bond, respect, grudge and memories." }));
    D.roleFilter.forEach(function (r) {
      var ss = S.filter(function (s) { return s.roles.indexOf(r.key) >= 0; });
      var d = h("details", { class: "who2" }, [h("summary", { text: cap(r.label) + " — " + ss.length + " stories" })]);
      var u = h("ul"); ss.forEach(function (s) { var li = h("li"); li.appendChild(storyLink(s.id, s.title)); u.appendChild(li); }); d.appendChild(u); v.appendChild(d);
    });
  }
  function buildOddities() {
    var v = document.getElementById("view-oddities"); v.innerHTML = "";
    v.appendChild(h("p", { class: "lead", text: "Things that look broken, contradictory or unfinished, found by reading every story against the engine. Nothing was changed or hidden. " + D.oddities.length + " found. The engine's own checker (validateArc) passes on every story; these are things it does not look for." }));
    var q = state.q.trim().toLowerCase(), list = D.oddities.filter(function (o) { return !q || (o.story + " " + o.where + " " + o.what).toLowerCase().indexOf(q) >= 0; });
    state.cnt = list.length; updateCount();
    var KD = { waiting: "Waiting for a game that is not built", "dead-end": "Can never happen", "dead-read": "Waits for something nothing writes", "dead-branch": "Part of a list can never be chosen", size: "Size looks off", check: "Worth a look", dice: "Dice", checker: "Engine checker" };
    var groups = {}; list.forEach(function (o) { (groups[o.kind] = groups[o.kind] || []).push(o); });
    Object.keys(groups).forEach(function (k) {
      v.appendChild(h("h3", { text: (KD[k] || k) + " (" + groups[k].length + ")", style: "margin:20px 0 6px" }));
      groups[k].forEach(function (o) {
        var s = byId[o.story], r = h("div", { class: "odd " + (k === "dead-end" || k === "dead-read" || k === "dead-branch" ? "k-dead" : k === "waiting" ? "k-waiting" : "") });
        var w = h("div", { class: "who" }); if (s) w.appendChild(storyLink(s.id, s.title)); else w.textContent = "The whole book"; r.appendChild(w);
        r.appendChild(h("div", { class: "wh", text: o.where })); var t = h("div"); t.appendChild(fmt(o.what)); r.appendChild(t);
        v.appendChild(r);
      });
    });
    if (!list.length) v.appendChild(h("div", { class: "empty", text: "Nothing matches." }));
  }

  /* ───────── tabs, routing ───────── */
  var TABS = [["stories", "Stories"], ["items", "Items"], ["links", "Links"], ["oddities", "Oddities"]];
  function buildTabs() {
    var t = document.getElementById("tabs");
    TABS.forEach(function (x) {
      var n = x[0] === "stories" ? S.length : x[0] === "items" ? D.items.length : x[0] === "links" ? D.links.length : D.oddities.length;
      var b = h("button", { class: "tab", role: "tab", type: "button", id: "tab-" + x[0], "aria-selected": "false" }, [x[1], h("span", { class: "n", text: String(n) })]);
      b.addEventListener("click", function () { setTab(x[0]); history.replaceState(null, "", x[0] === "stories" ? location.pathname + location.search : "#" + x[0]); });
      t.appendChild(b);
    });
  }
  function setTab(name) {
    state.tab = name;
    TABS.forEach(function (x) { document.getElementById("tab-" + x[0]).setAttribute("aria-selected", x[0] === name ? "true" : "false"); document.getElementById("view-" + x[0]).hidden = x[0] !== name; });
    if (name === "items") buildItems(); else if (name === "links") buildLinks(); else if (name === "oddities") buildOddities(); else applyFilters();
    updateCount();
  }
  function openStory(slug, scroll) {
    var s = null; for (var i = 0; i < S.length; i++) if (S[i].slug === slug) s = S[i];
    if (!s) return;
    setTab("stories");
    if (s._el.hidden) { state.q = ""; document.getElementById("q").value = ""; state.sizes = {}; state.tones = {}; state.role = state.batch = state.stage = ""; state.game = state.item = state.from = state.link = state.wait = false; document.getElementById("filters").innerHTML = ""; buildFilters(); applyFilters(); }
    toggle(s, true);
    if (scroll !== false) setTimeout(function () { s._el.scrollIntoView(); }, 30);
  }
  function route() {
    var hs = location.hash.replace(/^#/, "");
    if (!hs) return;
    if (hs.indexOf("story-") === 0) openStory(hs.slice(6));
    else if (hs === "items" || hs === "links" || hs === "oddities" || hs === "stories") setTab(hs);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a") : null; if (!a) return;
    var g = a.getAttribute("data-goto"); if (g) { e.preventDefault(); var t = document.getElementById(g); if (t) t.scrollIntoView(); return; }
    var o = a.getAttribute("data-open"); if (o) { e.preventDefault(); history.replaceState(null, "", "#story-" + o); openStory(o); }
  });
  window.addEventListener("hashchange", route);

  /* expand / collapse all (a few at a time so a phone does not freeze) */
  function expandAll(done) {
    var list = S.filter(function (s) { return !s._el.hidden; }), i = 0, btn = document.getElementById("expand");
    btn.textContent = "Expanding…";
    (function step() { var end = Math.min(list.length, i + 8); for (; i < end; i++) toggle(list[i], true); if (i < list.length) requestAnimationFrame(step); else { btn.textContent = "Expand all"; if (done) done(); } })();
  }
  function collapseAll() { S.forEach(function (s) { if (s._body) toggle(s, false); }); }
  window.__bookExpandAll = function () { return new Promise(function (res) { var save = S.map(function (s) { return s._el.hidden; }); S.forEach(function (s) { s._el.hidden = false; }); expandAll(res); }); };
  window.__bookCounts = function () {
    var q = function (sel) { return document.querySelectorAll(sel).length; };
    var uniq = {}; document.querySelectorAll('[data-k="outcome"]').forEach(function (e) { uniq[e.getAttribute("data-key")] = 1; });
    return { beats: q('[data-k="beat"]'), say: q('[data-k="say"]'), narr: q('[data-k="narr"]'), choices: q('[data-k="choice"]'), endings: q('[data-k="ending"]'), outcomesUnique: Object.keys(uniq).length, games: q('[data-k="game"]'), promises: q('[data-k="promise"]'), storiesOpen: document.querySelectorAll('.story[data-open="1"]').length };
  };

  /* ───────── start ───────── */
  fetch("data.json").then(function (r) { return r.json(); }).then(function (data) {
    D = data; S = D.stories; S.forEach(function (s) { byId[s.id] = s; });
    S.forEach(function (s) { blobOf(s); });
    document.getElementById("stamp").textContent = S.length + " stories, as the book stood on " + D.built.date + " (commit " + D.built.commit + "). Rebuilt from the story files by scripts/life/story-book-page.mts.";
    buildSummary(); buildTabs(); buildFilters();
    var list = document.getElementById("list");
    S.forEach(function (s, i) { list.appendChild(buildCard(s, i)); });
    document.getElementById("q").addEventListener("input", function () { state.q = this.value; clearTimeout(qTimer); qTimer = setTimeout(function () { if (state.tab === "stories") applyFilters(); else if (state.tab === "items") buildItems(); else if (state.tab === "links") buildLinks(); else buildOddities(); }, 160); });
    document.getElementById("fbtn").addEventListener("click", function () { var f = document.getElementById("filters"); f.hidden = !f.hidden; this.setAttribute("aria-pressed", f.hidden ? "false" : "true"); });
    document.getElementById("expand").addEventListener("click", function () { expandAll(); });
    document.getElementById("collapse").addEventListener("click", collapseAll);
    setTab("stories"); route();
    window.__bookReady = true;
  }).catch(function (e) { document.getElementById("stamp").textContent = "The book could not be loaded: " + e; });
})();
</script>
`;

// ═══════════════════════════ BUILDING ONE STORY ═══════════════════════════

interface Does { k: string; t: string }
interface Collector {
  mem: { tag: string; slot: string; role: string; beat: string; via: string; end?: string; strength: number }[];
  flags: { flag: string; beat: string; via: string }[];
  items: { code: string; kind: string; name: string; desc: string; beat: string; via: string; end?: string; cond?: string }[];
  reach: { end: string; beat: string; beatTitle: string; key: string; cond?: string; chance?: number; kind: "talk" | "card"; choiceLabel?: string }[];
  schedules: { from: string; to: string }[];
  promisesMade: Record<string, string[]>;
  tagsRead: { tag: string; slot: string; neg: boolean; where: string; first: boolean }[];
  flagsRead: { flag: string; neg: boolean; where: string; first: boolean }[];
  used: { vars: Set<string>; setVars: Set<string> };
}

function actionWords(cost: A): string[] {
  const out: string[] = [];
  if (!cost) return out;
  if (cost.weekAction) out.push(`uses ${nw(cost.weekAction)} of your week's actions (${cost.weekAction === 1 ? "a day" : "days"})`);
  if (cost.moneyWeeks) out.push(`costs ${cost.moneyWeeks} week${cost.moneyWeeks === 1 ? "" : "s"} of your own wage`);
  if (cost.energy) out.push(`${cost.energy < 0 ? "costs" : "gives"} ${Math.abs(cost.energy)} energy`);
  return out;
}

function varValWords(v: any): string {
  if (typeof v !== "string") return String(v);
  if (v === "activity.tens") return "your game score ×10";
  if (v === "activity.score") return "the balls that counted in the game";
  const m = /^max\(([a-z]+),activity\.tens\)$/.exec(v);
  if (m) return `the higher of the old “${m[1]}” and your game score ×10`;
  return `“${v}”`;
}

function doesOf(o: A, cx: Ctx, col: Collector, loc: { beat: string; beatTitle: string; via: string; end?: string }, cond?: string): Does[] {
  const out: Does[] = [];
  const cw = cond ? condWords(cond, cx) : undefined;
  const fx = o.effects ?? {};
  const bar = (label: string, n: number) => out.push({ k: "bar", t: `${label} ${sgn(n)}` });
  if (fx.boss) bar("Boss (the gaffer's opinion of you)", fx.boss);
  if (fx.team) bar("Team (dressing-room mood)", fx.team);
  if (fx.fans) bar("Fans", fx.fans);
  if (fx.fame) bar("Fame", fx.fame);
  if (fx.reputation) bar("Reputation", fx.reputation);
  if (fx.matchFitness) bar("Match fitness", fx.matchFitness);
  if (fx.energy) bar("Energy", fx.energy);
  if (fx.moneyWeeks) out.push({ k: "money", t: fx.moneyWeeks > 0 ? `Money: you are paid ${fx.moneyWeeks} week${fx.moneyWeeks === 1 ? "" : "s"} of your own wage` : `Money: ${Math.abs(fx.moneyWeeks)} week${fx.moneyWeeks === -1 ? "" : "s"} of your own wage is taken` });
  if (fx.scandal) out.push({ k: "bar", t: "A scandal goes on this season's record" });
  if (fx.take === "car") { out.push({ k: "item", t: "Your best car is taken from you for good" }); col.items.push({ code: "take:car", kind: "taken", name: "Your best car is TAKEN from you for good", desc: "", beat: loc.beatTitle, via: loc.via, end: loc.end, cond: cw }); }
  if (fx.kibCans) { out.push({ k: "item", t: `KIB cans: ${Object.entries(fx.kibCans).map(([k, n]) => `${sgn(n as number)} ${k}`).join(", ")}` }); col.items.push({ code: "kib", kind: "item", name: `KIB cans: ${Object.entries(fx.kibCans).map(([k, n]) => `${sgn(n as number)} ${k}`).join(", ")}`, desc: "", beat: loc.beatTitle, via: loc.via, end: loc.end, cond: cw }); }
  if (fx.flag) { out.push({ k: "flag", t: `Sets the life flag “${fx.flag}”` }); col.flags.push({ flag: fx.flag, beat: loc.beatTitle, via: loc.via }); }
  for (const d of o.npc ?? []) {
    const bits = [d.bond ? `bond ${sgn(d.bond)}` : "", d.respect ? `respect ${sgn(d.respect)}` : "", d.grudge ? `grudge ${sgn(d.grudge)}` : ""].filter(Boolean);
    if (bits.length) out.push({ k: "person", t: `${cx.tag(d.slot)}: ${bits.join(" · ")}` });
  }
  for (const r of o.remember ?? []) {
    const tag = String(r.tag).replace(/-/g, " ");
    const who = r.slot === "squad" ? "The whole squad will remember" : r.slot === "you" ? "Word gets round about you" : `${cx.tag(r.slot)} will remember`;
    out.push({ k: "mem", t: `${who}: “${tag}” (strength ${r.strength} of 3)` });
    col.mem.push({ tag: r.tag, slot: r.slot, role: cx.slots[r.slot]?.pick ?? r.slot, beat: loc.beatTitle, via: loc.via, end: loc.end, strength: r.strength });
  }
  if (o.noteSquad) { out.push({ k: "mem", t: `The whole squad will remember: “${String(o.noteSquad).replace(/-/g, " ")}” (strength 3 of 3)` }); col.mem.push({ tag: o.noteSquad, slot: "squad", role: "squad", beat: loc.beatTitle, via: loc.via, end: loc.end, strength: 3 }); }
  const a = o.arc ?? {};
  for (const [k, v] of Object.entries(a.set ?? {})) { out.push({ k: "story", t: `Story note “${k}” is set to ${varValWords(v)}` }); col.used.setVars.add(k); }
  for (const [k, n] of Object.entries(a.add ?? {})) { out.push({ k: "story", t: `Story note “${k}” goes up by ${n}` }); col.used.setVars.add(k); }
  if (o.train) { const tw = `${Object.entries(o.train).map(([k, n]) => `${k} ${sgn(n as number)}`).join(", ")}`; out.push({ k: "train", t: `Training: ${tw} (your skill goes up for good)` }); col.items.push({ code: `train:${tw}`, kind: "skill", name: `A skill goes up for good: ${tw}`, desc: "", beat: loc.beatTitle, via: loc.via, end: loc.end, cond: cw }); }
  if (o.give) {
    const w = ITEM_WORDS[o.give] ?? o.giveWords ?? [o.give.replace(/^item:/, "").replace(/-/g, " "), ""];
    out.push({ k: "item", t: `GIVES YOU an item: ${fillText(w[0], cx)}${w[1] ? ` — ${fillText(w[1], cx)}` : ""}` });
    col.items.push({ code: o.give, kind: "item", name: fillText(w[0], cx), desc: fillText(w[1] ?? "", cx), beat: loc.beatTitle, via: loc.via, end: loc.end, cond: cw });
  }
  if (o.unlock) {
    for (const u of String(o.unlock).split("+").filter(Boolean)) {
      out.push({ k: "item", t: `UNLOCKS ${unlockWords(u)}` });
      col.items.push({ code: u.includes(":") ? u : `garden:${u}`, kind: u.startsWith("trophy:") ? "trophy" : "unlock", name: unlockWords(u), desc: "", beat: loc.beatTitle, via: loc.via, end: loc.end, cond: cw });
    }
  }
  if (o.objective) {
    const ob = o.objective;
    out.push({ k: "game", t: `Sets a match objective: “${fillText(ob.text, cx)}” — you have ${ob.window?.matches} matches. If it is met, beat “${cx.beatTitle(ob.onMet)}” comes up; if it is missed, beat “${cx.beatTitle(ob.onMiss)}” comes up. (Met when: ${condWords(ob.met, cx)})` + (ob.why ? ` Why: ${fillText(ob.why, cx)}` : "") });
    col.schedules.push({ from: loc.beat, to: ob.onMet }, { from: loc.beat, to: ob.onMiss });
  }
  if (o.promise) { out.push({ k: "promise", t: promiseMadeWords(o.promise, cx) }); (col.promisesMade[o.promise] ??= []).push(`${loc.beatTitle} › ${loc.via}`); }
  for (const id of o.promiseBroken ?? []) out.push({ k: "promise", t: `Breaks the promise “${fillText(cx.promises[id]?.text ?? id, cx)}” (no second penalty: this ending already says what happened)` });
  if (a.retry) out.push({ k: "next", t: `Beat “${cx.beatTitle(a.retry)}” is wiped and can play again` });
  if (a.reopen) out.push({ k: "next", t: `The story is re-opened and beat “${cx.beatTitle(a.reopen)}” can play` });
  if (a.check) out.push({ k: "story", t: `(Data field “check: ${a.check}” is on this ending. The engine does not read it, so it does nothing.)` });
  if (a.next) {
    const nx = cx.beatTitle(a.next);
    const when = a.afterWeeks ? weeksWords(a.afterWeeks) : "straight away (the next moment that fits)";
    out.push({ k: "next", t: `Next: beat “${nx}” — ${when}${a.nextIf ? `, but only if ${condWords(a.nextIf, cx)}` : ""}` });
    col.schedules.push({ from: loc.beat, to: a.next });
  }
  if (a.end) {
    const e = cx.arc.ends.find((x: A) => x.id === a.end);
    out.push({ k: "end", t: `THE STORY ENDS: “${e ? fillText(e.title, cx) : a.end}”` });
  }
  if (o.followUp) out.push({ k: "next", t: `Follow-up event “${o.followUp.event}” ${weeksWords(o.followUp.afterWeeks)}` });
  return out;
}

function promiseMadeWords(id: string, cx: Ctx): string {
  const p = cx.promises[id];
  if (!p) return `Makes the promise “${id}”`;
  const due = p.due?.weeks ? `due within ${nw(p.due.weeks[1])} week${p.due.weeks[1] === 1 ? "" : "s"}` : p.due?.beat ? `due at beat “${cx.beatTitle(p.due.beat)}”` : "";
  return `MAKES A PROMISE to ${cx.who(p.to)}: “${fillText(p.text, cx)}” (${due}; phone list says “${p.dueText}”)`;
}

/** Outcomes of one choice or one talk ending, labelled the way the engine picks (resolve.ts pickOutcome). */
function outcomeViews(outs: A[], cx: Ctx, col: Collector, loc: { beat: string; beatTitle: string; via: string; end?: string }) {
  const anyChance = outs.some((o) => typeof o.chance === "number");
  return outs.map((o, i) => {
    let when = "";
    if (o.if && typeof o.chance === "number") when = `If ${condWords(o.if, cx)}, then ${Math.round(o.chance * 100)} in 100 (${oneIn(o.chance)})`;
    else if (o.if) when = `If ${condWords(o.if, cx)}`;
    else if (typeof o.chance === "number") when = `Dice: ${Math.round(o.chance * 100)} in 100 (${oneIn(o.chance)})`;
    else if (outs.length > 1) when = i === 0 && outs.some((x, j) => j > 0 && !x.if) ? "Otherwise (nothing above applied)" : "Otherwise";
    const text = fillText(o.text, cx);
    const does = doesOf(o, cx, col, loc, o.if);
    // Ends that stop the story: remember how to reach them.
    if (o.arc?.end) col.reach.push({ end: o.arc.end, beat: loc.beat, beatTitle: loc.beatTitle, key: loc.end ?? "", cond: o.if ? condWords(o.if, cx) : undefined, chance: o.chance, kind: loc.end ? "talk" : "card", choiceLabel: loc.end ? undefined : loc.via });
    return { when, text, does };
  });
}

const TONE_WORDS: Record<string, string> = { humble: "humble", calm: "calm", confident: "confident", fiery: "fiery", honest: "honest", lie: "a lie", kind: "kind", cold: "cold", brave: "brave", reckless: "reckless" };

// ───────────────────────── games ─────────────────────────
const MODE_WORDS: Record<string, string> = {
  challenge: "Challenge: a list of rounds on the real match engine (ten balls at most)",
  "strike-drill": "Strike drill: the kit man's hundred, on the real match engine (ten balls, each judged against its own target; shown in tens)",
  crossbar: "Crossbar contest: shots at the bar against his own rolled shots",
  "feed-drill": "Feed drill: you pass through a gate of cones and a team-mate's shot is rolled",
  "head-tennis": "Head tennis (not built yet)", "two-touch": "Two-touch keep-ups (not built yet for stories)", "duel-1v1": "A one-on-one duel (not built yet)",
  penalties: "A penalty (not built yet)", "testimonial-match": "A testimonial match (not built yet)", gym: "The gym (not built yet for stories)", karting: "Karting (not built yet)",
  drive: "A drive (not built yet)", "pace-sprint": "A sprint (not built yet for stories)", "five-a-side": "Five-a-side (not built yet for stories)",
};
const WIN_RULE: Record<string, string> = {
  challenge: "“Won” = at least half of the balls counted. (Source: ActivityHost finish: score ≥ ceil(balls ÷ 2).)",
  "strike-drill": "“Won” = at least half of the balls counted (ActivityHost); the story's own result rows decide what happens next.",
  crossbar: "“Won” = you hit the bar more often than he does. Each of his shots hits the bar 32 times in 100, rolled when the game starts.",
  "feed-drill": "Each of his shots goes in with a chance of 25 in 100 plus up to 50 more for how good your pass through the gate was. “Won” = at least half of the balls end in his goal.",
};
const TARGET_WORDS = (t: A): string => {
  switch (t.kind) {
    case "corner": return `low into the ${t.side === "L" ? "left" : "right"} corner (under 1 m high, within 1.4 m of the post)`;
    case "half": return `anywhere in the ${t.side === "L" ? "left" : "right"} half of the goal, under the bar`;
    case "bar": return "off the crossbar";
    case "tyre": return "through the tyre hung from the bar";
    case "bucket": return "knock the bucket over on the line (low, under 0.7 m)";
    case "past": return "past the keeper: any goal";
    default: return t.kind;
  }
};
const LIGHT_WORDS: Record<string, string> = { "dusk-one-lamp": "dusk with one lamp on", floodlit: "floodlit" };

function dialLine(k: string, v: any, cx: Ctx): string | null {
  if (Array.isArray(v)) return `${k}: ${v.map((x) => String(x).replace(/-/g, " ")).join(" and ")}`;
  if (v && typeof v === "object" && "if" in v) return `${k}: ${condWords(v.if, cx)} → ${v.then}, otherwise ${v.else}`;
  if (v && typeof v === "object" && v.slot) return `${k}: ${cx.who(v.slot)}${v.else ? ` (or ${cx.who(v.else)} if he is not there)` : ""}`;
  if (v && typeof v === "object") return `${k}: ${JSON.stringify(v)}`;
  if (k === "light") return `light: ${LIGHT_WORDS[v] ?? String(v).replace(/-/g, " ")}`;
  if (k === "from") return `shooting from: ${v}`;
  if (k === "keeper") return `keeper in goal: ${v ? "yes" : "no"}`;
  if (k === "targets") return `targets: ${(v as string[]).map((t) => t.replace(/-/g, " ")).join(" and ")}`;
  if (k === "balls") return `balls: ${v}`;
  if (k === "shots") return `shots: ${v}`;
  if (k === "feed") return `balls are fed: ${String(v).replace(/-/g, " ")}`;
  return `${k}: ${String(v).replace(/-/g, " ")}`;
}

function activityView(act: A, cx: Ctx) {
  const dials = act.dials ?? {};
  const view: any = {
    name: fillText(act.name, cx), mode: act.mode, modeWords: MODE_WORDS[act.mode] ?? act.mode, intro: fillText(act.intro ?? "", cx),
    score: act.score, canAbandon: !!act.canAbandon, cost: actionWords(act.cost), winRule: WIN_RULE[act.mode] ?? "", target: act.target,
    setup: [] as string[], rounds: [] as any[], callerLines: [] as string[], reactions: [] as { k: string; v: string }[], fallback: null as string | null, stakes: null as string | null,
    notBuilt: !(act.mode in WIN_RULE),
  };
  for (const [k, v] of Object.entries(dials)) {
    if (k === "rounds" || k === "lines" || k === "keeperSlot") continue;
    const l = dialLine(k, v, cx);
    if (l) view.setup.push(l);
  }
  if (act.caller) {
    view.setup.push(`the one calling it / counting: ${cx.who(act.caller.slot)}`);
    if (act.caller.lines) view.callerLines = act.caller.lines.map((l: string) => fillText(l, cx));
    if (act.caller.useLinesOf) view.setup.push(`counts with the same lines as: ${act.caller.useLinesOf}`);
  }
  if (dials.keeperSlot) view.setup.push(`in goal for keeper rounds: ${cx.who(dials.keeperSlot)}`);
  if (act.showBest) view.setup.push(`shows your best (“${act.showBest}”) during the game`);
  if (act.target) view.setup.push(`ten out of ten is the target (${act.target})`);
  if (act.stakes) {
    const w = act.stakes.wager?.moneyWeeks;
    view.stakes = `Stakes: ${w ? `a wager of ${typeof w === "object" ? `${w.then} weeks if ${condWords(w.if, cx)}, else ${w.else} weeks` : `${w} weeks`} of your wage` : ""}${act.stakes.toCharity ? "; it goes to charity" : ""}`;
  }
  if (dials.rounds) {
    const specs = dials.rounds as A[];
    const ch = challenge(specs as any);
    let ballNo = 0;
    specs.forEach((sp, ri) => {
      const lib = (ROUND_LIBRARY as any)[sp.kind];
      const feeds = ch.feeds.filter((f: A) => f.roundNo === ri);
      const round = { n: ri + 1, kind: sp.kind, name: fillText(sp.name ?? lib?.name ?? sp.kind, cx), line: fillText(sp.line ?? lib?.line ?? "", cx), balls: [] as any[] };
      for (const f of feeds) {
        ballNo++;
        const bits = [`from ${f.dist} m`, TARGET_WORDS(f.target)];
        if (f.dark) bits.push("in the dark: he shouts which side");
        if (f.keeper) bits.push(`${cx.who(dials.keeperSlot ?? act.caller?.slot ?? "")} in goal`);
        if (f.double) bits.push("DOUBLE OR NOWT: hit it for twenty points, miss and ten come off");
        round.balls.push({ n: ballNo, label: fillText(f.label, cx), words: bits.join(" · "), call: fillText(f.call ?? "", cx), diff: f.diff });
      }
      view.rounds.push(round);
    });
  }
  if (dials.lines) view.reactions = Object.entries(dials.lines).map(([k, v]) => ({ k, v: fillText(v as string, cx) }));
  if (act.fallback) {
    const f = act.fallback;
    view.fallback = `If the phone cannot run the game: a dice roll against your ${f.stat}. At ${f.target} it is 50 in 100; every 4 points above that adds 10 (never under 10 or over 90 in 100).`;
  } else view.fallback = "No dice fallback is set (the checker wants one for a game the phone cannot run).";
  return view;
}

// ───────────────────────── beats ─────────────────────────
function entryWords(e: A, cx: Ctx, endKeys: string[]): string[] {
  if (!e) return [];
  const out: string[] = [];
  if (e.kind === "offer") {
    out.push(`It shows as a gold bubble “${fillText(e.bubble ?? "", cx)}” on ${cx.who(e.on)}'s round-menu${e.hint ? ` (hint: ${fillText(e.hint, cx)})` : ""}. TODAY ONLY: it is gone when the week turns.`);
    out.push(`If you walk past it, the talk's ending “${e.ifIgnored}” plays${endKeys.includes(e.ifIgnored) ? "" : " (MISSING)"}.`);
  } else if (e.kind === "standing") {
    out.push(`A standing bubble “${fillText(e.bubble ?? "", cx)}” sits on ${cx.who(e.on)}'s round-menu while the beat is open${e.hint ? ` (hint: ${fillText(e.hint, cx)})` : ""}.`);
  } else if (e.kind === "invite") {
    out.push(`It arrives as a ${e.via === "text-thread" ? "text message" : e.via ?? "text"} from ${cx.who(e.from)}: ${fillText(e.text ?? "", cx)}`);
    const labels = e.labels ?? {};
    for (const ch of e.choices ?? []) out.push(`Answer “${ch}”: ${fillText(labels[ch] ?? ch, cx)}${ch === "attend" ? ` (goes on into the talk${e.cost ? "; " + actionWords(e.cost).join(", ") : ""})` : ` (plays the ending “@${ch}”)`}`);
    if (e.clash) out.push(`Clash: if ${condWords(e.clash.if, cx)}, going also ${actionWords(e.clash.cost).join(", ")}. ${fillText(e.clash.line, cx)}`);
  }
  return out;
}

function timingWords(arc: A, beat: A, cx: Ctx, scheduledBy: string[], isFirst: boolean): string[] {
  const out: string[] = [];
  const a = beat.after;
  if (isFirst && !a) out.push("This is where the story starts. It plays at its first moment that fits (see “When it can start”).");
  else if (!a) out.push("No fixed delay: it can play at any fitting moment once the story is running.");
  if (a?.beat) {
    const gap = a.weeks ? weeksWords(a.weeks).replace(" later", "") : a.seasons ? seasonsWords(a.seasons).replace(" later", "") : "";
    out.push(`${gap ? gap + " after" : "Right after"} beat “${cx.beatTitle(a.beat)}” was played.`);
  }
  if (a?.clock) {
    const cl = arc.clocks.find((c: A) => c.id === a.clock);
    out.push(`When the clock “${cl ? fillText(cl.label, cx) : a.clock}” is full (${cl?.segments} segments; it ticks ${cl?.tick?.map((t: A) => `${t.by} at each ${t.on === "season-end" ? "season end" : t.on}`).join(", ")}).`);
  }
  if (a?.objective) out.push("When the match objective it set is met or missed (see the beat that sets the objective).");
  if (scheduledBy.length) out.push(`Also scheduled directly by: ${scheduledBy.join("; ")}.`);
  if (beat.repeat) out.push(`It can come round again: every ${beat.repeat.everyWeeks} weeks, up to ${beat.repeat.max} times.`);
  return out;
}

// ═══════════════════════════ ONE STORY ═══════════════════════════

function castHow(c: A): string {
  const parts: string[] = [];
  if (c.pick === "squad") {
    parts.push("A team-mate from your own squad");
    const w = (c.where ?? []).map((x: string) => personCondWords(x));
    if (w.length) parts.push(`who ${w.join(" and ")}`);
    if (c.order) parts.push(`(${ORDER_WORDS[c.order] ?? c.order} if several fit)`);
  } else if (POOL[c.pick]) parts.push(`The ${ROLE_PLAIN[c.pick] ?? c.pick}: the career is given one person for this role the first time it is needed and keeps that person for good`);
  else if (c.pick === "manager") parts.push("Your current manager (changes if you get a new one)");
  else parts.push(`The career's own ${ROLE_PLAIN[c.pick] ?? c.pick}: one person per career, named from the career's seed and kept for good`);
  if (c.optional) parts.push("OPTIONAL: if nobody fits, the story still plays without him");
  if (c.bindAt) parts.push(`not met until beat “${c.bindAt}” (he is chosen then)`);
  if (c.tags?.length) parts.push(`whoever holds the memory ${c.tags.map((t: string) => `“${t}”`).join(" or ")}`);
  return parts.join("; ") + ".";
}

function stageOf(first: A, cx: Ctx): { stage: string; key: string } {
  const atoms = topAtoms([...(first.requires ?? []), ...(first.event.trigger.requires ?? [])]);
  const ages = (re: RegExp) => atoms.map((a) => re.exec(a)).filter(Boolean).map((m) => Number(m![1]));
  const max = Math.min(99, ...ages(/^age<=(\d+)$/)), min = Math.max(0, ...ages(/^age>=(\d+)$/));
  if (max <= 19) return { stage: `Academy years (you are ${max} or younger)`, key: "academy" };
  if (max <= 23) return { stage: `Early career (you are ${max} or younger)`, key: "early" };
  if (min >= 30) return { stage: `Late career (you are ${min} or older)`, key: "late" };
  if (min >= 24) return { stage: `Established (you are ${min} or older)`, key: "established" };
  return { stage: "Any stage of a career", key: "any" };
}

function allConds(arc: A): { src: string; beat: string; first: boolean; where: string }[] {
  const out: { src: string; beat: string; first: boolean; where: string }[] = [];
  arc.beats.forEach((b: A, bi: number) => {
    const push = (src: any, where: string) => { if (typeof src === "string" && src) out.push({ src, beat: b.id, first: bi === 0, where }); };
    for (const r of b.requires ?? []) push(r, "beat requires");
    const e = b.event;
    for (const r of e.trigger.requires ?? []) push(r, "trigger requires");
    for (const c of e.cast ?? []) for (const w of c.where ?? []) push(w, "cast where");
    for (const v of e.variants ?? []) push(v.if, "variant");
    const t = e.talk;
    if (t) {
      if (t.start && typeof t.start === "object") push(t.start.if, "talk start");
      for (const n of Object.values<A>(t.nodes)) {
        for (const r of n.replies ?? []) for (const q of r.requires ?? []) push(q, "reply requires");
        for (const row of n.result ?? []) push(row[0], "game result");
        if (n.activity?.dials?.from?.if) push(n.activity.dials.from.if, "game set-up");
      }
      for (const outs of Object.values<A>(t.ends)) for (const o of outs) { push(o.if, "outcome if"); push(o.arc?.nextIf, "next if"); push(o.objective?.met, "objective met"); }
    }
    for (const ch of e.choices ?? []) { for (const r of ch.requires ?? []) push(r, "choice requires"); for (const o of ch.outcomes ?? []) { push(o.if, "outcome if"); push(o.arc?.nextIf, "next if"); } }
    if (e.entry?.clash) push(e.entry.clash.if, "clash");
    for (const cb of e.callbacks ?? []) push(`${cb.ifMemory}`.replace(/^([a-z]+):(.+)$/, "mem($1,'$2')"), "callback");
  });
  for (const p of Object.values<A>(arc.promises ?? {})) for (const o of [p.kept, p.broken]) if (o?.if) out.push({ src: o.if, beat: "", first: false, where: "promise" });
  return out;
}

function buildStory(arc: A, file: string, order: number, batch: { label: string; key: string }, events: A) {
  const cx = new Ctx(arc);
  for (const b of arc.beats) cx.addCast(b.event.cast);
  const col: Collector = { mem: [], flags: [], items: [], reach: [], schedules: [], promisesMade: {}, tagsRead: [], flagsRead: [], used: { vars: new Set(), setVars: new Set() } };
  const first = arc.beats[0];
  const mainOf = Math.max(0, ...arc.beats.map((b: A) => b.n ?? 0));

  // who schedules each beat (an ending's `next`), for "when it comes"
  const scheduledBy: Record<string, string[]> = {};
  const scan = (beat: A, outs: A[], via: string) => {
    for (const o of outs) if (o.arc?.next) (scheduledBy[o.arc.next] ??= []).push(`“${beat.title}” › ${via}${o.arc.afterWeeks ? ` (${weeksWords(o.arc.afterWeeks)})` : ""}`);
  };
  for (const b of arc.beats) {
    for (const [k, outs] of Object.entries<A>(b.event.talk?.ends ?? {})) scan(b, outs, `ending “${k}”`);
    for (const ch of b.event.choices ?? []) scan(b, ch.outcomes, `choice “${fillText(ch.label, cx)}”`);
  }

  const speakers: Record<string, number> = {};
  let sayCount = 0, narrCount = 0, choiceCount = 0, outcomeCount = 0, gameCount = 0, callbackCount = 0, variantCount = 0;

  const beats = arc.beats.map((beat: A, bi: number) => {
    const e = beat.event;
    const loc0 = { beat: beat.id, beatTitle: beat.title, via: "" };
    const endKeys = Object.keys(e.talk?.ends ?? {});
    const newPeople = (e.cast ?? []).filter((c: A) => !(arc.cast ?? []).some((x: A) => x.slot === c.slot)).map((c: A) => ({ slot: c.slot, label: cx.tag(c.slot), how: castHow(c) }));
    const setup = (e.setup ?? []).map((s: string) => fillText(s, cx));
    narrCount += setup.length;
    const requires = [...allWords(beat.requires, cx), ...allWords(e.trigger.requires, cx)];
    const extra: string[] = [];
    if (e.trigger.once) extra.push("It can only ever play once in a career.");
    if (e.trigger.cooldownWeeks) extra.push(`After it, wait at least ${e.trigger.cooldownWeeks} weeks before another “${e.trigger.group}” beat.`);
    if (e.trigger.maxPerCareer) extra.push(`At most ${e.trigger.maxPerCareer} times in a career.`);
    const look: string[] = [];
    if (beat.look?.chip) look.push(`Time chip on the screen: “${beat.look.chip}”`);
    if (beat.look?.art) look.push(`Card picture: ${beat.look.art}`);
    if (beat.look?.big) look.push(`Big number/emoji on the card: ${beat.look.big}${beat.look.bigSub ? ` (“${beat.look.bigSub}”)` : ""}`);
    if (beat.look?.note) look.push(`Drawn as a paper note: line ${beat.look.note.line} of the message${beat.look.note.sign ? `, signed “${beat.look.note.sign}”` : ""}${beat.look.note.foot ? `, footer “${beat.look.note.foot}”` : ""}`);
    const variants = (e.variants ?? []).map((v: A) => {
      variantCount++;
      const bits: string[] = [];
      if (v.template) bits.push(`shows as ${TEMPLATE_WORDS[v.template] ?? v.template}`);
      if (v.place) bits.push(`at ${placeWords(v.place)}`);
      if (v.setupSwap) bits.push(`the opening line is swapped for: ${fillText(v.setupSwap, cx)}`);
      return { cond: condWords(v.if, cx), what: bits.join("; ") };
    });
    const callbacks = (e.callbacks ?? []).map((cb: A) => { callbackCount++; return { memory: String(cb.ifMemory).replace(/-/g, " "), where: cb.where, line: fillText(cb.line, cx) }; });
    const entry = entryWords(e.entry, cx, endKeys);

    const rec: any = {
      id: beat.id, n: beat.n ?? null, mainOf, title: fillText(beat.title, cx), hint: fillText(beat.hint ?? "", cx),
      timing: timingWords(arc, beat, cx, scheduledBy[beat.id] ?? [], bi === 0), requires, extra,
      where: { template: TEMPLATE_WORDS[e.template] ?? e.template, templateKey: e.template, place: placeWords(e.place), placeKey: e.place, screen: SCREEN_WORDS[e.screen] ?? e.screen, moments: e.trigger.when.map((m: string) => MOMENT_WORDS[m] ?? m), category: e.category },
      entry, look, variants, setup, newPeople, callbacks,
      kind: e.talk ? "talk" : "card", speaker: e.speaker ? cx.tag(e.speaker) : "",
    };

    if (e.talk) {
      const t = e.talk;
      // The reading order: from the start node, following the replies.
      const startIds = typeof t.start === "string" ? [t.start] : [t.start.then, t.start.else];
      const seen: string[] = [];
      const q = [...startIds];
      while (q.length) {
        const id = q.shift()!;
        if (!id || seen.includes(id) || !t.nodes[id]) continue;
        seen.push(id);
        const n = t.nodes[id];
        for (const r of n.replies ?? []) if (r.goto) q.push(r.goto);
        for (const row of n.result ?? []) q.push(row[1]);
      }
      const unreached = Object.keys(t.nodes).filter((id) => !seen.includes(id));
      const order = [...seen, ...unreached];
      rec.unreachedNodes = unreached;
      rec.talkStart = typeof t.start === "string" ? `Opens at moment “${t.start}”.` : `Opens at moment “${t.start.then}” if ${condWords(t.start.if, cx)}, otherwise at “${t.start.else}”.`;
      // End views, built once (so memories and items are written down once), shown under every reply that uses them.
      const endViews: Record<string, any[]> = {};
      const via: Record<string, string[]> = {};
      for (const id of order) for (const r of t.nodes[id].replies ?? []) if (r.end) (via[r.end] ??= []).push(`“${fillText(r.label, cx)}”`);
      if (e.entry?.ifIgnored) (via[e.entry.ifIgnored] ??= []).push("(you walk past the offer and it runs out)");
      if (e.entry?.kind === "invite") for (const ch of e.entry.choices ?? []) if (ch !== "attend") (via[`@${ch}`] ??= []).push(`(invite answer: ${ch})`);
      for (const [k, outs] of Object.entries<A>(t.ends)) {
        const loc = { ...loc0, via: (via[k] ?? ["(not reached by any reply)"]).join(" or "), end: k };
        endViews[k] = outcomeViews(outs, cx, col, loc).map((v, i) => ({ ...v, key: `${beat.id}/${k}/${i}`, endId: outs[i].arc?.end ?? null }));
        outcomeCount += outs.length;
      }
      const nodeTitle = (id: string) => { const n = t.nodes[id]; const l = (n?.say ?? [])[0] ?? n?.activity?.name ?? id; const tt = strip(fillText(l, cx)).replace(/\s+/g, " ").trim(); return tt.length > 80 ? tt.slice(0, 78).replace(/\s+\S*$/, "") + "…" : tt; };
      rec.nodes = order.map((id, idx) => {
        const n = t.nodes[id];
        const say = (n.say ?? []).map((s: string) => fillText(s, cx));
        sayCount += say.length;
        if (n.who && say.length) speakers[cx.tag(n.who)] = (speakers[cx.tag(n.who)] ?? 0) + say.length;
        const replies = (n.replies ?? []).map((r: A) => {
          choiceCount++;
          const does: string[] = [];
          if (r.mood) does.push(`His mood towards you ${r.mood > 0 ? "warms" : "cools"} (${sgn(r.mood)}) for the rest of this talk`);
          if (r.set?.length) does.push(`Remembered for the rest of this talk: ${r.set.map((x: string) => `“${x}”`).join(", ")}`);
          for (const [k, v] of Object.entries(r.var ?? {})) { does.push(`Story note “${k}” is set to ${varValWords(v)}`); col.used.setVars.add(k); }
          if (r.promise) { does.push(promiseMadeWords(r.promise, cx)); (col.promisesMade[r.promise] ??= []).push(`${beat.title} › “${fillText(r.label, cx)}”`); }
          for (const w of actionWords(r.cost)) does.push(`This answer ${w}`);
          return {
            id: r.id, label: fillText(r.label, cx), tone: r.tone ? (TONE_WORDS[r.tone] ?? r.tone) : "", silent: !!r.silent, note: r.note ?? "",
            requires: allWords(r.requires, cx), does,
            goto: r.goto ?? null, gotoTitle: r.goto ? nodeTitle(r.goto) : "", gotoIsGame: !!(r.goto && t.nodes[r.goto]?.activity),
            end: r.end ?? null, outcomes: r.end ? (endViews[r.end] ?? []) : [],
          };
        });
        let act: any = null;
        if (n.activity) { act = activityView(n.activity, cx); gameCount++; }
        const result = (n.result ?? []).map((row: A) => ({ cond: row[0] ? condWords(row[0], cx) : "Otherwise (nothing above applied)", to: row[1], toTitle: nodeTitle(row[1]) }));
        return { id, idx: idx + 1, who: n.who ? cx.tag(n.who) : "", screen: n.screen ? SCREEN_WORDS[n.screen] : "", say, replies, activity: act, result };
      });
      // endings of the talk that no reply of this talk reaches (walking past an offer, invite answers)
      const used = new Set<string>();
      for (const id of order) for (const r of t.nodes[id].replies ?? []) if (r.end) used.add(r.end);
      rec.otherEnds = Object.keys(t.ends).filter((k) => !used.has(k)).map((k) => ({ key: k, via: (via[k] ?? ["(no reply and no entry leads here)"]).join(" or "), outcomes: endViews[k] }));
      rec.ends = {};
    } else {
      rec.choices = (e.choices ?? []).map((ch: A) => {
        choiceCount++;
        const label = fillText(ch.label, cx);
        const loc = { ...loc0, via: `“${label}”` };
        const views = outcomeViews(ch.outcomes, cx, col, loc).map((v, i) => ({ ...v, key: `${beat.id}/${ch.id}/${i}`, endId: ch.outcomes[i].arc?.end ?? null }));
        outcomeCount += ch.outcomes.length;
        const does: string[] = [];
        for (const w of actionWords(ch.cost)) does.push(`This answer ${w}`);
        if (ch.minigame) does.push(ch.minigame.kind === "horse-race" ? "A horse race against your own horse decides the outcome (if you have no horse, it is a loss)" : `A skill check on your ${ch.minigame.stat} (target ${ch.minigame.target}): chance of winning is 50 in 100 at the target, +10 for each 4 points above, between 10 and 90`);
        return { id: ch.id, label, tone: ch.tone ? (TONE_WORDS[ch.tone] ?? ch.tone) : "", silent: !!ch.silent, requires: allWords(ch.requires, cx), does, outcomes: views };
      });
      const lines = setup.length;
      void lines;
    }
    return rec;
  });

  // Reading statistics for things used in text and conditions
  const condsAll = allConds(arc);
  for (const c of condsAll) {
    for (const m of c.src.matchAll(/arc\.(?!clock\()([a-zA-Z]+)/g)) col.used.vars.add(m[1]);
    for (const m of c.src.matchAll(/(!?)mem\(([a-z]+),([^)]+)\)/g)) for (const t of m[3].split("|")) col.tagsRead.push({ tag: t.trim().replace(/'/g, ""), slot: m[2], neg: m[1] === "!", where: c.where, first: c.first });
    for (const m of c.src.matchAll(/(!?)mem\(((?:'[a-z0-9-]+'\|?)+)\)/g)) for (const t of m[2].split("|")) col.tagsRead.push({ tag: t.trim().replace(/'/g, ""), slot: "squad member", neg: m[1] === "!", where: c.where, first: c.first });
    for (const m of c.src.matchAll(/(!?)flag:([a-z0-9-]+)/g)) col.flagsRead.push({ flag: m[2], neg: m[1] === "!", where: c.where, first: c.first });
  }

  // Promises
  const promises = Object.values<A>(arc.promises ?? {}).map((p) => {
    const loc = { beat: "", beatTitle: `promise “${fillText(p.text, cx)}”`, via: "kept or broken" };
    const o = (x: A, which: string) => x ? { text: fillText(x.text ?? "", cx), does: doesOf(x, cx, col, { ...loc, via: which }, x.if) } : null;
    const keptBy = p.keptBy ?? {};
    return {
      id: p.id, to: cx.tag(p.to), text: fillText(p.text, cx), dueText: p.dueText,
      due: p.due?.weeks ? `within ${nw(p.due.weeks[1])} week${p.due.weeks[1] === 1 ? "" : "s"} of making it (broken automatically after that)` : p.due?.beat ? `when beat “${cx.beatTitle(p.due.beat)}” plays` : "",
      remind: p.remind ? (typeof p.remind === "string" ? `A text a week before: ${fillText(p.remind, cx)}` : `Reminded at beat “${cx.beatTitle(p.remind.beat)}”`) : "",
      keptBy: (() => {
        const kbeat = arc.beats.find((x: A) => x.id === keptBy.beat);
        const isCard = kbeat && !kbeat.event.talk;
        const ends = (keptBy.ends ?? []).map((x: string) => (isCard ? kbeat.event.choices.find((c: A) => c.id === x) : null)).map((c: A, i: number) => (isCard ? (c ? `choosing “${fillText(c.label, cx)}”` : `the choice “${keptBy.ends[i]}”`) : `the talk ending “${keptBy.ends[i]}”`));
        return `Kept when beat “${cx.beatTitle(keptBy.beat)}” ${keptBy.played ? "is reached (its game is played)" : ""}${ends.length ? `${keptBy.played ? ", or" : "ends with"} ${ends.join(" or ")}` : ""}.`;
      })(),
      kept: o(p.kept, "promise kept"), broken: o(p.broken, "promise broken"), madeBy: col.promisesMade[p.id] ?? [],
    };
  });

  // Endings
  const ends = arc.ends.map((en: A) => {
    const reach = col.reach.filter((r) => r.end === en.id);
    const reachedBy = reach.map((r) => {
      const b = beats.find((x: any) => x.id === r.beat);
      const nm = b ? `${b.n ? `Beat ${b.n}: ` : "Side beat: "}“${b.title}”` : r.beatTitle;
      let how = "";
      if (r.kind === "talk") {
        const beat = arc.beats.find((x: A) => x.id === r.beat);
        const vias: string[] = [];
        for (const n of Object.values<A>(beat.event.talk.nodes)) for (const rp of n.replies ?? []) if (rp.end === r.key) vias.push(`“${strip(fillText(rp.label, cx))}”`);
        if (beat.event.entry?.ifIgnored === r.key) vias.push("walking past the offer (it runs out)");
        if (beat.event.entry?.kind === "invite") for (const ch of beat.event.entry.choices ?? []) if (r.key === `@${ch}`) vias.push(`answering the invitation: ${ch}`);
        how = vias.length ? `by choosing ${vias.join(" or ")}` : `through the talk ending “${r.key}” (no reply leads to it)`;
      } else how = `by choosing ${r.choiceLabel}`;
      const cond = [r.cond ? `only if ${r.cond}` : "", typeof r.chance === "number" ? `${Math.round(r.chance * 100)} in 100 (${oneIn(r.chance)})` : ""].filter(Boolean).join(", ");
      return { where: nm, how, cond };
    });
    const leaves: Does[] = [];
    const seenT = new Set<string>();
    for (const b of beats) {
      const views: any[] = [...(b.nodes ?? []).flatMap((n: any) => n.replies.flatMap((r: any) => r.outcomes)), ...(b.otherEnds ?? []).flatMap((x: any) => x.outcomes), ...(b.choices ?? []).flatMap((c: any) => c.outcomes)];
      for (const v of views) if (v.endId === en.id) for (const d of v.does) if (!seenT.has(d.t) && d.k !== "end") { seenT.add(d.t); leaves.push(d); }
    }
    return { id: en.id, title: fillText(en.title, cx), text: fillText(en.text, cx), reachedBy, leaves, reachedCount: reach.length };
  });

  const clocks = (arc.clocks ?? []).map((c: A) => ({ id: c.id, label: fillText(c.label, cx), segments: c.segments, ticks: c.tick.map((t: A) => `${t.by} segment at each ${t.on === "season-end" ? "season end" : t.on}`).join(", "), startsAt: cx.beatTitle(c.startsAt), onFull: cx.beatTitle(c.onFull) }));
  const vars = Object.entries(arc.vars ?? {}).map(([k, v]) => ({ k, v: String(v) }));
  const stage = stageOf(first, cx);

  // Starting
  const startCond = [...allWords(first.requires, cx), ...allWords(first.event.trigger.requires, cx)];
  const moments = first.event.trigger.when.map((m: string) => MOMENT_WORDS[m] ?? m);
  const st = arc.start;
  const chanceText = st ? `Each time that moment comes up and the conditions fit, it starts ${Math.round(st.chance * 100)} times in 100 (${oneIn(st.chance)}). The roll is the career's own, so careers do not all meet it in the same week.` : "It has no start roll: it always starts when its first beat can.";
  const careersText = st?.careers !== undefined ? `Only ${careersIn(st.careers)} can ever meet this story (rolled once per career from the player's name).` : "Every career can meet it (it has no per-career limit).";

  // People
  const cast = (arc.cast ?? []).map((c: A) => ({ slot: c.slot, role: c.pick, label: c.pick === "squad" ? `team-mate “${c.slot}”` : (ROLE_PLAIN[c.pick] ?? c.pick).replace(/ \(.*/, ""), how: castHow(c), optional: !!c.optional, pool: POOL[c.pick] ? POOL[c.pick].map((p: A) => ({ name: `${p.first} ${p.last}`, age: p.age, from: p.from, manner: p.manner, look: p.look })) : null }));
  const spk = Object.entries(speakers).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));

  const text0 = first.event.setup?.[0] ?? first.event.talk?.nodes?.[typeof first.event.talk.start === "string" ? first.event.talk.start : first.event.talk.start.then]?.say?.[0] ?? "";
  const premise = strip(fillText(text0, cx)).replace(/\s+/g, " ").trim();

  const sizeMissing = !arc.size;
  return {
    id: arc.id, slug: arc.id.replace(/^arc-/, ""), file, order, code: arc.code ?? "", title: fillText(arc.title, cx), size: arc.size ?? "unspecified", sizeMissing,
    tones: arc.about?.tone ?? [], who: arc.about?.who ?? [], roles: Array.from(new Set((arc.cast ?? []).map((c: A) => c.pick))), owner: cx.tag(arc.owner),
    batch: batch.label, batchKey: batch.key, summary: fillText(arc.summary, cx), premise: premise.length > 220 ? premise.slice(0, 217).replace(/\s+\S*$/, "") + "…" : premise,
    stage: stage.stage, stageKey: stage.key, waiting: arc.needsActivity ?? "",
    start: { moments, conditions: startCond, chanceText, careersText, chance: st?.chance ?? null, careers: st?.careers ?? null, needs: [] as any[] },
    cast, newPeople: beats.flatMap((b: any) => b.newPeople.map((p: any) => ({ ...p, beat: b.title }))), vars, clocks, beats, promises, ends, speakers: spk,
    counts: { beats: beats.length, say: sayCount, narration: narrCount, choices: choiceCount, outcomes: outcomeCount, endings: ends.length, promises: promises.length, games: gameCount, callbacks: callbackCount, variants: variantCount },
    _col: col, _raw: arc,
  };
}

// ═══════════════════════════ VISUALS ("what would have to be drawn or filmed") ═══════════════════════════
type Status = "exists" | "partly" | "needs";
interface Vis { name: string; status: Status; note: string; where?: string }

const PERSON_VISUAL: Record<string, [Status, string]> = {
  squad: ["exists", "A real squad player: his drawn head and his 3D player (Style A people) exist for every squad member."],
  manager: ["exists", "The gaffer: manager look presets (mgr-*) and his still picture (face-gaffer, cut-gaffer, corridor-gaffer) exist."],
  kitman: ["exists", "All four kit men have a look preset (Den trk-old-physio, Ray trk-kit-man, Sol trk-academy, Mick mgr-bald-stubble). Drawn stills (face, cut-out, pitch two, van, stadium) exist for Den only."],
  groundsman: ["partly", "Look presets are chosen for all three groundsmen (trk-touchline, trk-kit-man, mgr-old-pro). No drawn stills exist."],
  physio: ["partly", "Look preset trk-physio / trk-old-physio exists for the physios. No drawn stills."],
  reporter: ["partly", "Look preset smt-analyst is chosen for the three reporters. No drawn stills."],
  legend: ["partly", "Look presets (mgr-old-pro, mgr-silver-fox, mgr-grey-fade) exist for the three legends. No drawn stills."],
  agent: ["partly", "Staff look presets exist (smt-sporting-director and others); no fixed pick for the agent and no still."],
  chairman: ["partly", "A preset exists (mgr-chairman); no fixed pick for this person and no still."],
  coach: ["partly", "Coach presets exist (trk-first-team-coach, trk-set-piece-coach, others); no fixed pick and no still."],
  fan: ["partly", "Fan presets exist (fan-season, fan-home, fan-ultra …); no fixed pick and no still."],
  kidfan: ["partly", "A young-fan preset exists (fan-young); a kid still (face-kid) exists for the academy kid, not for this fan."],
  tabloid: ["partly", "Press presets exist (smt-presenter, smt-analyst); no fixed look for this reporter and no still."],
  broadsheet: ["partly", "Press presets exist (smt-analyst); no fixed look for this writer and no still."],
  sponsor: ["partly", "Business presets exist (smt-owner and others); no fixed look for the rep and no still."],
  rival: ["partly", "A rival is a player from another club: player looks exist; the one chosen needs a fixed look and a different kit."],
  referee: ["needs", "No referee look exists as a person (only the whistle-blower in the match); needs a look, a kit and a still."],
  canteen: ["needs", "Needs a look (an apron, a hairnet) and a still. The drawn head is generated, there is no 3D look preset for this person."],
  dad: ["needs", "Needs a fixed look (age, build, clothes) and a still. Only the drawn head is generated per career."],
  mum: ["needs", "Needs a fixed look (age, build, clothes) and a still. Only the drawn head is generated per career."],
  brother: ["needs", "Needs a fixed look and a still. Only the drawn head is generated per career."],
  sister: ["needs", "Needs a fixed look and a still. Only the drawn head is generated per career."],
  partner: ["needs", "Needs a fixed look and a still. Only the drawn head is generated per career."],
  pal: ["needs", "Needs a fixed look and a still. Only the drawn head is generated per career."],
  neighbour: ["needs", "Needs a fixed look and a still. Only the drawn head is generated per career."],
  stranger: ["needs", "A one-off person: needs a generic look and a drawn head."],
};

function placeVisual(key: string): [Status, string] {
  const [a, b = ""] = key.split(":");
  if (a === "home") {
    if (b === "") return ["exists", "The 3D house exists (rooms you walk through: lounge, kitchen, bedroom, hallway …)."];
    if (b === "sofa") return ["exists", "The 3D house's lounge (the sofa) exists."];
    if (b === "kitchen") return ["exists", "The 3D house's kitchen exists."];
    if (b === "bed") return ["exists", "The 3D house's bedroom exists."];
    if (b === "door" || b === "hall") return ["exists", "The 3D house's hallway and front door exist."];
    if (b === "garden" || b === "driveway") return ["exists", "The 3D garden exists (the driveway is the garden's edge)."];
    if (b === "mums-kitchen") return ["partly", "A 3D kitchen exists, but it is yours; your mum's kitchen needs its own look."];
    return ["partly", "The 3D house exists; this spot is not a named room."];
  }
  if (a === "compound") {
    if (/^pitch/.test(b)) return ["partly", "A training-ground cut-scene location and 3D pitches exist; a drawn still of pitch two exists only with the kit man. A 3D training compound with its surroundings is not built yet."];
    if (b === "dressing-room" || b === "changing-room") return ["exists", "The dressing room cut-scene location exists (3D)."];
    if (b === "corridor") return ["partly", "No 3D corridor; a drawn still outside the boot room exists with the gaffer."];
    if (b === "office") return ["exists", "The manager's office exists (3D and as a cut-scene location)."];
    if (b === "gym") return ["partly", "The gym room exists, but only on the world-kit test page (not in a career)."];
    if (b === "boardroom" || b === "meeting-room") return ["partly", "The manager's office exists; a boardroom needs its own look."];
    return ["needs", `The ${b.replace(/-/g, " ")} at the training ground needs a 3D room or a drawn still.`];
  }
  if (a === "stadium") {
    if (b === "pitch") return ["exists", "The 3D stadium pitch exists (match view, cut scenes)."];
    if (b === "tunnel") return ["exists", "The tunnel exists as a cut-scene location."];
    if (b === "dressing-room") return ["exists", "The dressing room cut-scene location exists."];
    return ["needs", `The stadium's ${b.replace(/-/g, " ")} needs a 3D place or a drawn still (a night-time stadium still exists with the kit man).`];
  }
  if (a === "town") {
    if (b === "casino") return ["exists", "The 3D casino exists."];
    if (b === "studio" || b === "radio-studio") return ["partly", "A press-room cut-scene location exists; a radio studio needs its own look."];
    return ["needs", `${b.replace(/-/g, " ")} in town needs a 3D place or a drawn still.`];
  }
  if (a === "away") {
    if (b === "stadium") return ["exists", "The 3D stadium exists (shown in the away kit)."];
    return ["needs", `Away: ${b.replace(/-/g, " ")} needs a place.`];
  }
  if (a === "driving") return ["needs", "No 3D road or car interior exists in the career (a driving scene is only planned)."];
  return ["needs", "Needs a place."];
}

/** Things named in the text, looked for by word. Status says whether the game already has the object. */
const PROP_VOCAB: [RegExp, string, Status, string][] = [
  [/\bball(s)?\b/i, "Football(s)", "exists", "Cut-scene prop “ball” exists."],
  [/\bboots?\b/i, "Football boots", "exists", "Cut-scene prop “boots” exists."],
  [/\b(shirt|jersey)\b/i, "A shirt", "exists", "Cut-scene prop “shirt” (with name and number) exists."],
  [/\barmband\b/i, "The captain's armband", "exists", "Cut-scene prop “armband” exists."],
  [/\b(trophy|cup|silverware)\b/i, "A trophy / cup", "exists", "Cut-scene props “trophy-cup” and “trophy-league” exist."],
  [/\bmedal\b/i, "A medal", "exists", "Cut-scene prop “medal” exists."],
  [/\b(phone|mobile)\b/i, "A phone", "exists", "Cut-scene prop “phone” exists; the phone screens are in the game."],
  [/\b(camera|photographer|photo|photos|lens)\b/i, "A camera", "exists", "Cut-scene prop “camera” exists."],
  [/\b(microphone|mic|radio|commentary)\b/i, "A microphone", "exists", "Cut-scene props “mic” and “mic-stand” exist."],
  [/\bclipboard\b/i, "A clipboard", "exists", "Cut-scene prop “clipboard” exists."],
  [/\b(water bottle|bottle)\b/i, "A water bottle", "exists", "Cut-scene prop “water-bottle” exists."],
  [/\b(flag|corner flag)\b/i, "A flag", "exists", "Cut-scene props “flag” and “corner-flag” exist."],
  [/\b(champagne)\b/i, "Champagne", "exists", "Cut-scene prop “champagne” exists."],
  [/\bscarf\b/i, "A scarf", "exists", "Cut-scene prop “scarf” exists."],
  [/\b(contract|paperwork)\b/i, "A contract", "exists", "Cut-scene prop “contract” exists."],
  [/\bpen\b/i, "A pen", "exists", "Cut-scene prop “pen” exists."],
  [/\bchairs?\b/i, "A chair", "exists", "Cut-scene prop “chair” exists."],
  [/\b(kit bag|ball bag|bag)\b/i, "A bag", "exists", "Cut-scene prop “bag” exists (the kit man's ball bag has its own item)."],
  [/\b(award|statue)\b/i, "An award", "exists", "Cut-scene prop “award-statue” exists."],
  [/\b(car|cars|motor|jag|porsche|merc)\b/i, "A car", "exists", "3D cars exist (the shop and the garage)."],
  [/\b(sofa|settee)\b/i, "A sofa", "exists", "In the 3D house lounge."],
  [/\b(tyre|bucket)\b/i, "A tyre / a bucket (a drill prop)", "partly", "They are targets in the drill engine; no 3D model."],
  [/\b(envelope|letter|note|notes|card|postcard)\b/i, "A letter / envelope / card", "needs", "Needs a prop (a paper note exists only as a phone-card picture)."],
  [/\b(whistle)\b/i, "A whistle", "needs", "Needs a prop."],
  [/\b(flowers|bouquet)\b/i, "Flowers", "needs", "Needs a prop."],
  [/\b(ring|wedding)\b/i, "A ring / wedding things", "needs", "Needs props and a place."],
  [/\b(cake|candles)\b/i, "A cake", "needs", "Needs a prop."],
  [/\b(tea|coffee|mug|cup of tea|soup)\b/i, "A mug / a drink / soup", "needs", "Needs a prop."],
  [/\b(newspaper|headline|front page)\b/i, "A newspaper / headline", "needs", "Needs a prop (a feed-post card exists for online posts)."],
  [/\b(tickets?)\b/i, "Tickets", "needs", "Needs a prop."],
  [/\b(guitar|song|piano|speaker)\b/i, "An instrument / speaker", "needs", "Needs a prop."],
  [/\b(laptop|tv|screen|big screen)\b/i, "A laptop / a TV / a screen", "needs", "Needs a prop."],
  [/\b(keys|wallet|passport)\b/i, "Keys / a wallet / a passport", "needs", "Needs a prop."],
  [/\b(van|bus|coach)\b/i, "A van / a bus", "needs", "No 3D van or bus (a drawn van still exists with the kit man)."],
  [/\b(suit|tie|dinner jacket)\b/i, "A suit / dinner clothes", "partly", "Suit outfits exist for managers; none for you or for the others in this story."],
  [/\b(horse|racecourse|races)\b/i, "A horse / the races", "exists", "Your 3D horse and the races exist in the game."],
  [/\b(gym|weights|treadmill)\b/i, "Gym equipment", "partly", "The gym room exists on a test page only."],
  [/\b(garden)\b/i, "The garden", "exists", "The 3D garden exists."],
  [/\b(shop)\b/i, "The shop", "exists", "The 3D shop exists."],
];

const CUT_SCENE_MATCH: [RegExp, string][] = [
  [/\b(sign(ed|ing)? (a |the |your )?contract|contract signing|put pen to paper)\b/i, "Contract signing (hand-made, exists)"],
  [/\b(scores?|scored|goal celebration|celebrat)/i, "Goal celebration (hand-made, exists)"],
  [/\b(lift(s|ed)? the trophy|trophy lift|lifts? the cup)\b/i, "Trophy lift (hand-made, exists)"],
  [/\b(tunnel|walk(s|ed)? out|walkout)\b/i, "Walk-out (hand-made, exists)"],
  [/\b(press conference|mixed zone|journalists)\b/i, "Press conference (hand-made, exists)"],
  [/\b(retire|last game|guard of honour|farewell|testimonial)\b/i, "Farewell (hand-made, exists)"],
  [/\b(mentor|legend)\b/i, "The Icon (a mentor scene, hand-made, exists)"],
];

function visualsOf(story: any, raw: A, cx: Ctx) {
  const people: Vis[] = [];
  const seenRole = new Set<string>();
  const slotsUsed: A[] = [];
  for (const c of raw.cast ?? []) slotsUsed.push(c);
  for (const b of raw.beats) for (const c of b.event.cast ?? []) if (!slotsUsed.some((x) => x.slot === c.slot)) slotsUsed.push(c);
  for (const c of slotsUsed) {
    if (seenRole.has(c.slot)) continue;
    seenRole.add(c.slot);
    const [st, note] = PERSON_VISUAL[c.pick] ?? ["needs", "Needs a look."];
    people.push({ name: `${cx.tag(c.slot)}${c.optional ? " (optional)" : ""}`, status: st, note });
  }
  people.push({ name: "You (the player)", status: "exists", note: "Your 3D player and drawn head exist (Your look)." });

  const places: Vis[] = [];
  const placeKeys = new Map<string, string[]>();
  for (const b of raw.beats) {
    const keys = [b.event.place, ...(b.event.variants ?? []).map((v: A) => v.place).filter(Boolean)];
    for (const k of keys) { const arr = placeKeys.get(k) ?? []; if (!arr.includes(b.title)) arr.push(b.title); placeKeys.set(k, arr); }
  }
  for (const [k, titles] of placeKeys) { const [st, note] = placeVisual(k); places.push({ name: placeWords(k), status: st, note, where: `beats: ${titles.map((t) => `“${strip(fillText(t, cx))}”`).join(", ")}` }); }

  // Props: words in the text of the story, found by looking.
  const blob = JSON.stringify([raw.title, raw.summary, raw.beats.map((b: A) => [b.title, b.event.setup, Object.values(b.event.talk?.nodes ?? {}).map((n: A) => [n.say, (n.replies ?? []).map((r: A) => r.label)]), Object.values(b.event.talk?.ends ?? {}).map((o: A) => o.map((x: A) => x.text)), (b.event.choices ?? []).map((c: A) => [c.label, c.outcomes.map((x: A) => x.text)])]), raw.ends.map((e: A) => [e.title, e.text])]).replace(/\\"/g, '"');
  const props: Vis[] = [];
  for (const [re, name, st, note] of PROP_VOCAB) { const m = re.exec(blob); if (m) props.push({ name, status: st, note, where: `the word “${m[0].toLowerCase()}” appears in the text` }); }
  for (const it of story._col.items) if (it.kind === "item" || it.kind === "trophy" || it.kind === "unlock") props.push({ name: `Special item given: ${it.name}`, status: it.code === "item:dens-ball-bag" ? "partly" : "needs", note: it.code === "item:dens-ball-bag" ? "A drill unlock exists (the garden corner); the bag has no 3D model of its own." : "A picture or 3D model of this item and its place in the game needs making.", where: `given at: ${it.beat}` });

  // Cut scene moments
  const cuts: Vis[] = [];
  for (const e of raw.ends) cuts.push({ name: `Closing picture for the ending “${strip(fillText(e.title, cx))}”`, status: "needs", note: "The cut-scene director can play any scene script, but none is written for this ending." });
  for (const b of raw.beats) {
    const text = `${b.title} ${(b.event.setup ?? []).join(" ")}`;
    for (const [re, label] of CUT_SCENE_MATCH) if (re.test(text)) cuts.push({ name: `Beat “${strip(fillText(b.title, cx))}” looks like: ${label}`, status: "partly", note: "A similar hand-made scene exists; it would need this story's people and props." });
  }
  const seenCut = new Set<string>();
  const cutsU = cuts.filter((c) => (seenCut.has(c.name) ? false : (seenCut.add(c.name), true)));

  // Phone screens
  const phone: Vis[] = [];
  for (const b of raw.beats) {
    const t = b.event.template;
    if (t === "phone-call" || t === "text-thread" || t === "feed-post") phone.push({ name: `${t === "phone-call" ? "Phone call" : t === "text-thread" ? "Text thread" : "Feed post"}: “${strip(fillText(b.title, cx))}”`, status: "exists", note: `The ${t === "phone-call" ? "call card" : t === "text-thread" ? "message thread card" : "feed card"} exists (StoryCards / EventCard).` });
    if (b.event.entry?.kind === "invite") phone.push({ name: `Invitation text: “${strip(fillText(b.title, cx))}”`, status: "exists", note: "The invite screen (a text with three answers) exists." });
    for (const v of b.event.variants ?? []) if (v.template === "phone-call" || v.template === "text-thread") phone.push({ name: `Variant of “${strip(fillText(b.title, cx))}” as a ${v.template === "phone-call" ? "phone call" : "text thread"}`, status: "exists", note: "The card exists." });
  }
  for (const p of Object.values<A>(raw.promises ?? {})) if (p.remind && typeof p.remind === "string") phone.push({ name: `Reminder text for the promise “${strip(fillText(p.text, cx))}”`, status: "exists", note: "The promise reminder text and the phone promise list exist." });
  if (Object.keys(raw.promises ?? {}).length) phone.push({ name: "The phone's promise list", status: "exists", note: "The promises screen exists." });

  // Games
  const GAME_VIS: Record<string, [Status, string]> = {
    challenge: ["exists", "Runs on the real match engine; the round cards and the caller exist."], "strike-drill": ["exists", "Den's hundred exists (the chalk-door and the drill screens)."], crossbar: ["exists", "The crossbar contest exists."], "feed-drill": ["exists", "The feed drill exists."],
    "two-touch": ["partly", "A 3D Two Touch drill exists; it is not wired to stories."], "pace-sprint": ["partly", "A 3D Pace Sprint drill exists; it is not wired to stories."], "five-a-side": ["partly", "A five-a-side component exists; it is not wired to stories."],
    penalties: ["partly", "Trial penalties exist; not wired to stories."], gym: ["partly", "The gym room exists on a test page; not wired to stories."],
    "head-tennis": ["needs", "Not built."], "duel-1v1": ["needs", "Not built."], "testimonial-match": ["needs", "Not built."], karting: ["needs", "Not built (a kart track place also needs making)."], drive: ["needs", "Not built (no 3D driving)."],
  };
  const games: Vis[] = [];
  for (const b of story.beats) for (const n of b.nodes ?? []) if (n.activity) { const [st, note] = GAME_VIS[n.activity.mode] ?? ["needs", "Not built."]; games.push({ name: `${n.activity.name} (${n.activity.mode})`, status: st, note, where: `beat “${strip(b.title)}”` }); }
  return { people, places, props, cutscenes: cutsU, phone, games };
}

// ═══════════════════════════ MAIN ═══════════════════════════
function git(args: string): string { try { return execSync(`git ${args}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } }

function batchOf(file: string): { label: string; key: string } {
  const subj = git(`log --diff-filter=A --format=%s -- lib/star/life/book/arcs/${file}`).split("\n").pop() ?? "";
  if (/Story batch 3/i.test(subj)) return { label: "Batch 3 (28 Nov 2026)", key: "b3" };
  if (/Story batch 2/i.test(subj)) return { label: "Batch 2 (27 Nov 2026)", key: "b2" };
  if (/arcs batch|Events v2|kit man/i.test(subj) || subj) return { label: "Batch 1 (20–21 Nov 2026, the first 60)", key: "b1" };
  return { label: "Batch unknown", key: "b0" };
}

const events = JSON.parse(fs.readFileSync(path.join(ARC_DIR, "../events.json"), "utf8"));
const fileList = fs.readdirSync(ARC_DIR).filter((f) => f.endsWith(".json"));
const byId = new Map<string, { file: string; arc: any }>();
for (const f of fileList) { const arc = JSON.parse(fs.readFileSync(path.join(ARC_DIR, f), "utf8")); byId.set(arc.id, { file: f, arc }); }
const orderIds = ["arc-hundred-balls", ...(STORY_ARCS as A[]).map((a) => a.id)];
for (const id of byId.keys()) if (!orderIds.includes(id)) orderIds.push(id);

const stories: any[] = orderIds.filter((id) => byId.has(id)).map((id, i) => {
  const { file, arc } = byId.get(id)!;
  const s = buildStory(arc, file, i + 1, batchOf(file), events);
  return s;
});
const storyById = new Map(stories.map((s) => [s.id, s]));

// ───────── memories, flags: who writes, who reads → the links between stories ─────────
interface Writer { story: string; beat: string; via: string; role: string; end?: string }
const tagWriters = new Map<string, Writer[]>();
for (const s of stories) for (const m of s._col.mem) (tagWriters.get(m.tag) ?? tagWriters.set(m.tag, []).get(m.tag)!).push({ story: s.id, beat: m.beat, via: m.via, role: m.slot, end: m.end });
const eventWriters = new Map<string, string[]>();
for (const ev of events.events ?? []) for (const ch of ev.choices ?? []) for (const o of ch.outcomes ?? []) for (const r of o.remember ?? []) (eventWriters.get(r.tag) ?? eventWriters.set(r.tag, []).get(r.tag)!).push(ev.title);
const flagWriters = new Map<string, Writer[]>();
for (const s of stories) for (const f of s._col.flags) (flagWriters.get(f.flag) ?? flagWriters.set(f.flag, []).get(f.flag)!).push({ story: s.id, beat: f.beat, via: f.via, role: "" });
for (const ev of events.events ?? []) for (const ch of ev.choices ?? []) for (const o of ch.outcomes ?? []) if (o.effects?.flag) (eventWriters.get(`flag:${o.effects.flag}`) ?? eventWriters.set(`flag:${o.effects.flag}`, []).get(`flag:${o.effects.flag}`)!).push(ev.title);

const links: any[] = [];
const linkKey = new Set<string>();
const oddities: { story: string; where: string; what: string; kind: string }[] = [];
const odd = (s: any, where: string, what: string, kind = "check") => oddities.push({ story: s?.id ?? "", where, what, kind });

for (const s of stories) {
  const seenRead = new Set<string>();
  for (const r of s._col.tagsRead) {
    const k = `${r.tag}|${r.neg}|${r.first}`;
    if (seenRead.has(k)) continue;
    seenRead.add(k);
    const ws = (tagWriters.get(r.tag) ?? []).filter((w) => w.story !== s.id);
    const ownWrites = (tagWriters.get(r.tag) ?? []).some((w) => w.story === s.id);
    const evs = eventWriters.get(r.tag) ?? [];
    if (!ws.length && !ownWrites && !evs.length) odd(s, `a condition (${r.where})`, `waits for the memory “${r.tag.replace(/-/g, " ")}”, but nothing in the stories, promises or older events ever writes it, so this condition never holds${r.neg ? " (it is a “not” condition, so it is always true)" : ""}.`, "dead-read");
    for (const w of ws) {
      const key = `${w.story}>${s.id}|${r.tag}|${r.neg}`;
      if (linkKey.has(key)) continue;
      linkKey.add(key);
      const from = storyById.get(w.story)!;
      links.push({ from: from.id, fromTitle: from.title, to: s.id, toTitle: s.title, kind: r.neg ? "blocks" : "needs", tag: r.tag.replace(/-/g, " "), writtenAt: `${strip(w.beat)} › ${w.via}`, readAt: r.where, startsStory: r.first, detail: r.neg ? `If you have “${r.tag.replace(/-/g, " ")}” (left by “${from.title}”), “${s.title}” is blocked (the condition says NOT).` : `“${s.title}” needs “${r.tag.replace(/-/g, " ")}”, left by “${from.title}” (${strip(w.beat)}).` });
      if (r.first && !r.neg) s.start.needs.push({ story: from.id, title: from.title, tag: r.tag.replace(/-/g, " ") });
    }
    for (const evt of evs) if (!ws.length && !ownWrites) links.push({ from: "", fromTitle: `older event: ${evt}`, to: s.id, toTitle: s.title, kind: r.neg ? "blocks" : "needs", tag: r.tag.replace(/-/g, " "), writtenAt: "an older one-off event", readAt: r.where, startsStory: r.first, detail: `“${s.title}” reads the memory “${r.tag.replace(/-/g, " ")}”, written by the older event “${evt}”.` });
  }
  for (const r of s._col.flagsRead) {
    const ws = (flagWriters.get(r.flag) ?? []).filter((w) => w.story !== s.id);
    const own = (flagWriters.get(r.flag) ?? []).some((w) => w.story === s.id);
    const evs = eventWriters.get(`flag:${r.flag}`) ?? [];
    if (!ws.length && !own && !evs.length) odd(s, `a condition (${r.where})`, `waits for the life flag “${r.flag}”, which nothing sets.`, "dead-read");
    for (const w of ws) { const from = storyById.get(w.story)!; const key = `${w.story}>${s.id}|flag:${r.flag}`; if (linkKey.has(key)) continue; linkKey.add(key); links.push({ from: from.id, fromTitle: from.title, to: s.id, toTitle: s.title, kind: r.neg ? "blocks" : "needs", tag: `flag “${r.flag}”`, writtenAt: `${strip(w.beat)} › ${w.via}`, readAt: r.where, startsStory: r.first, detail: `Flag “${r.flag}” set by “${from.title}”.` }); }
  }
}
for (const s of stories) {
  s.linksOut = links.filter((l) => l.from === s.id).map((l) => ({ to: l.to, toTitle: l.toTitle, kind: l.kind, tag: l.tag }));
  s.linksIn = links.filter((l) => l.to === s.id).map((l) => ({ from: l.from, fromTitle: l.fromTitle, kind: l.kind, tag: l.tag }));
  // Tags this story writes that no story reads: kept as person memories (still seen by the People page and callbacks).
  const written = new Set<string>(s._col.mem.map((m: A) => m.tag));
  s.unlocksLater = links.filter((l) => l.from === s.id && l.kind === "needs").map((l) => `“${l.toTitle}” (needs “${l.tag}”)`);
  s.blocksLater = links.filter((l) => l.from === s.id && l.kind === "blocks").map((l) => `“${l.toTitle}” (blocked by “${l.tag}”)`);
  void written;
}
// attach "unlocks later / blocks later" to the endings that wrote the tags
for (const s of stories) {
  for (const e of s.ends) {
    const tags = new Set<string>(s._col.mem.filter((m: A) => m.end && true).map((m: A) => m.tag));
    void tags;
    e.unlocks = links.filter((l) => l.from === s.id && l.kind === "needs" && s._col.mem.some((m: A) => m.tag.replace(/-/g, " ") === l.tag && endHasTag(s, e.id, m)));
    e.blocks = links.filter((l) => l.from === s.id && l.kind === "blocks" && s._col.mem.some((m: A) => m.tag.replace(/-/g, " ") === l.tag && endHasTag(s, e.id, m)));
    e.unlocks = e.unlocks.map((l: A) => `“${l.toTitle}” (gets “${l.tag}”)`);
    e.blocks = e.blocks.map((l: A) => `“${l.toTitle}” (blocked by “${l.tag}”)`);
  }
}
function endHasTag(s: any, endId: string, m: A): boolean {
  // the memory was written by an outcome that ends the story with endId, or by any outcome of the same talk ending
  for (const b of s.beats) {
    const views: any[] = [...(b.nodes ?? []).flatMap((n: any) => n.replies.flatMap((r: any) => r.outcomes)), ...(b.otherEnds ?? []).flatMap((x: any) => x.outcomes), ...(b.choices ?? []).flatMap((c: any) => c.outcomes)];
    for (const v of views) if (v.endId === endId && v.does.some((d: any) => d.k === "mem" && d.t.includes(`“${m.tag.replace(/-/g, " ")}”`))) return true;
  }
  return false;
}

// ───────── items index ─────────
const items: any[] = [];
for (const s of stories) {
  for (const it of s._col.items) {
    const beat = s.beats.find((b: any) => b.title === it.beat);
    items.push({ story: s.id, storyTitle: s.title, kind: it.kind, name: it.name, desc: it.desc, code: it.code, beat: it.beat, beatN: beat?.n ?? null, storyWaiting: !!storyById.get(s.id)?.waiting, via: it.via, end: it.end ?? "", cond: it.cond ? it.cond : "" });
  }
  s.gives = Array.from(new Set(s._col.items.map((i: A) => `${i.kind}:${i.name}`)));
}
// de-duplicate identical (story, name, beat, via)
const itemSeen = new Set<string>();
const itemsU = items.filter((i) => { const k = `${i.story}|${i.name}|${i.beat}|${i.via}|${i.cond}`; if (itemSeen.has(k)) return false; itemSeen.add(k); return true; });
for (const i of itemsU) { const s = storyById.get(i.story)!; i.endingTitle = ""; void s; }

// ───────── visuals per story ─────────
for (const s of stories) {
  const cx = new Ctx(s._raw);
  for (const b of s._raw.beats) cx.addCast(b.event.cast);
  s.visuals = visualsOf(s, s._raw, cx);
  s.flags = {
    hasGame: s.counts.games > 0, givesItem: s._col.items.some((i: A) => i.kind === "item" || i.kind === "trophy" || i.kind === "unlock"), givesAnything: s._col.items.length > 0,
    startsFromOther: s.start.needs.length > 0, waiting: !!s.waiting, hasPromise: s.promises.length > 0, usesLink: s.linksIn.length > 0 || s.linksOut.length > 0,
  };
}

// ───────── oddities (things that look broken or contradictory) ─────────
const SLOT_FIX = /\{([a-z]+)\.([a-zA-Z]+)\}/g;
for (const s of stories) {
  const raw: A = s._raw;
  const cx = new Ctx(raw);
  for (const b of raw.beats) cx.addCast(b.event.cast);
  // the engine's own checker
  try { for (const p of validateArc(raw)) odd(s, "engine checker", p, "checker"); } catch (e) { odd(s, "engine checker", `crashed: ${(e as Error).message}`, "checker"); }
  if (s.waiting) odd(s, "whole story", `needs the game mode “${s.waiting}”, which is not built. The story is checked but never plays (arcBook.ts WAITING_ARCS).`, "waiting");
  if (s.sizeMissing) odd(s, "whole story", "has no “size” (small / medium / big).");
  // endings
  for (const e of s.ends) if (e.reachedCount === 0) odd(s, `ending “${e.title}”`, "is defined but nothing in the story ends it this way, so no career can reach it.", "dead-end");
  for (const r of s._col.reach) if (!raw.ends.some((e: A) => e.id === r.end)) odd(s, `beat “${r.beatTitle}”`, `ends the story with “${r.end}”, which is not one of the story's endings.`, "dead-end");
  // beats reachable?
  const reach = new Set<string>([raw.beats[0].id]);
  let grew = true;
  const scheduledTo = new Set(s._col.schedules.map((x: A) => x.to));
  while (grew) {
    grew = false;
    for (const b of raw.beats) {
      if (reach.has(b.id)) continue;
      const a = b.after;
      let ok = false;
      if (scheduledTo.has(b.id)) ok = s._col.schedules.some((x: A) => x.to === b.id && reach.has(x.from));
      if (!ok && !a) ok = true;
      if (!ok && a?.beat) ok = reach.has(a.beat);
      if (!ok && a?.clock) { const cl = raw.clocks.find((c: A) => c.id === a.clock); ok = !!cl && reach.has(cl.startsAt); }
      if (!ok && a?.objective) ok = s._col.schedules.length > 0;
      if (ok) { reach.add(b.id); grew = true; }
    }
  }
  for (const b of raw.beats) if (!reach.has(b.id)) odd(s, `beat “${b.title}”`, "no earlier beat leads to this beat, so it can never play.", "dead-end");
  // outcome lists: a chance-less outcome with no condition before others hides them
  const lists: [string, A[]][] = [];
  for (const b of raw.beats) {
    for (const [k, outs] of Object.entries<A>(b.event.talk?.ends ?? {})) lists.push([`beat “${b.title}”, talk ending “${k}”`, outs]);
    for (const ch of b.event.choices ?? []) lists.push([`beat “${b.title}”, choice “${strip(fillText(ch.label, cx))}”`, ch.outcomes]);
  }
  for (const [where, outs] of lists) {
    const plain = outs.map((o, i) => [o, i] as [A, number]).filter(([o]) => typeof o.chance !== "number");
    const firstOpen = plain.findIndex(([o]) => !o.if);
    if (firstOpen >= 0 && firstOpen < plain.length - 1) odd(s, where, `an outcome with no condition and no chance comes before ${plain.length - 1 - firstOpen} more outcome(s) in the list. The game picks the first one that applies, so the later ones can never be chosen.`, "dead-branch");
    const sum = outs.reduce((a, o) => a + (typeof o.chance === "number" ? o.chance : 0), 0);
    const byIf = new Map<string, number>();
    for (const o of outs) if (typeof o.chance === "number") byIf.set(o.if ?? "", (byIf.get(o.if ?? "") ?? 0) + o.chance);
    for (const [k, v] of byIf) if (v > 1.0001) odd(s, where, `the dice chances${k ? ` under “${k}”` : ""} add up to ${Math.round(v * 100)} in 100, more than 100.`);
    if (outs.length > 1 && outs.every((o) => typeof o.chance === "number" && !o.if) && sum < 0.9999) odd(s, where, `the dice chances add up to ${Math.round(sum * 100)} in 100 and there is no fallback, so the last outcome takes the rest.`, "dice");
    for (const o of outs) if (!String(o.text ?? "").trim() && !o.arc?.end) odd(s, where, "an outcome has no text.");
  }
  // placeholders that name a person who is not in the story
  const allStrings: [string, string][] = [];
  const walkStr = (o: any, where: string) => { if (typeof o === "string") allStrings.push([where, o]); else if (Array.isArray(o)) o.forEach((x) => walkStr(x, where)); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walkStr(v, where); };
  for (const b of raw.beats) walkStr({ s: b.event.setup, t: b.event.talk, c: b.event.choices, cb: b.event.callbacks, v: b.event.variants, e: b.event.entry, look: b.look, title: b.title, hint: b.hint }, b.title);
  walkStr(raw.ends, "endings"); walkStr(raw.promises, "promises"); walkStr(raw.clocks, "clocks");
  const badSlots = new Map<string, string>();
  for (const [where, str] of allStrings) for (const m of str.matchAll(SLOT_FIX)) { const sl = m[1]; if (["arc", "activity", "you"].includes(sl)) continue; if (!cx.slots[sl]) badSlots.set(`${sl}.${m[2]}`, where); }
  for (const [k, w] of badSlots) odd(s, `beat “${strip(fillText(w, cx))}”`, `the line uses {${k}}, but nobody in the story has that slot, so it will read “someone”.`);
  // story notes read but never set
  const read = s._col.used.vars as Set<string>, setv = s._col.used.setVars as Set<string>;
  for (const v of read) if (!(v in (raw.vars ?? {})) && !setv.has(v)) odd(s, "story notes", `a condition reads the story note “${v}”, which is never set and has no starting value.`, "dead-read");
  // promises nobody makes; promises kept by an ending the beat does not have
  for (const p of s.promises) if (!p.madeBy.length) odd(s, `promise “${p.text}”`, "no choice or ending ever makes this promise.", "dead-end");
  for (const p of Object.values<A>(raw.promises ?? {})) {
    const b = raw.beats.find((x: A) => x.id === p.keptBy?.beat);
    if (b) for (const k of p.keptBy.ends ?? []) if (!(k in (b.event.talk?.ends ?? {})) && !(b.event.choices ?? []).some((c: A) => c.id === k)) odd(s, `promise “${strip(fillText(p.text, cx))}”`, `is kept by the ending “${k}” of beat “${b.title}”, which that beat does not have.`, "dead-end");
  }
  // age windows that cannot hold
  for (const b of raw.beats) {
    const atoms = topAtoms([...(b.requires ?? []), ...(b.event.trigger.requires ?? [])]);
    const mx = atoms.map((a) => /^age<=(\d+)$/.exec(a)).find(Boolean), mn = atoms.map((a) => /^age>=(\d+)$/.exec(a)).find(Boolean);
    if (mx && mn && Number(mn[1]) > Number(mx[1])) odd(s, `beat “${b.title}”`, `needs you to be at least ${mn[1]} and at most ${mx[1]}: impossible.`, "dead-end");
    for (const c of [...(b.requires ?? []), ...(b.event.trigger.requires ?? [])]) { const p = parseCond(c); if (typeof p === "string") odd(s, `beat “${b.title}”`, `a condition does not parse: ${p}`, "checker"); }
  }
  // fields the engine never reads
  for (const b of raw.beats) for (const [k, outs] of Object.entries<A>(b.event.talk?.ends ?? {})) for (const o of outs) if (o.arc?.check) odd(s, `beat “${strip(fillText(b.title, cx))}”, talk ending “${k}”`, `the ending carries the data field “check: ${o.arc.check}”. The engine (arcs.ts) never reads it, so it does nothing.`, "check");
  // size versus what the README says (small: one talk and a callback; medium: 3-4 beats and a promise; big: 5-7 beats across seasons, with a game)
  const main = Math.max(0, ...raw.beats.map((b: A) => b.n ?? 0));
  if (raw.size === "big" && s.counts.games === 0) odd(s, "whole story", "is marked big, but has no game (the README says a big story has a game).", "size");
  if (raw.size === "small" && main > 3) odd(s, "whole story", `is marked small but has ${main} beats on the main line.`, "size");
  if (raw.size === "medium" && s.promises.length === 0 && s.counts.games === 0 && main < 3) odd(s, "whole story", `is marked medium but has only ${main} main-line beat(s), no promise and no game.`, "size");
}
// duplicate codes and titles
const codeSeen = new Map<string, string>();
for (const s of stories) { if (!s.code) continue; if (codeSeen.has(s.code)) odd(s, "whole story", `shares the code “${s.code}” with ${codeSeen.get(s.code)}.`, "checker"); codeSeen.set(s.code, s.id); }
const titleSeen = new Map<string, string>();
for (const s of stories) { const t = strip(s.title).toLowerCase(); if (titleSeen.has(t)) odd(s, "whole story", `has the same title as “${strip(storyById.get(titleSeen.get(t)!)!.title)}” (${titleSeen.get(t)}).`); titleSeen.set(t, s.id); }
const waitingIds = new Set((WAITING_ARCS as A[]).map((a) => a.id));
for (const s of stories) if (!!s.waiting !== waitingIds.has(s.id)) odd(s, "whole story", "the book and WAITING_ARCS disagree about whether the story plays.");

// ───────── summary ─────────
const tally = (fn: (s: any) => string[]) => { const m: Record<string, number> = {}; for (const s of stories) for (const k of new Set(fn(s))) m[k] = (m[k] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })); };
const sum = (f: (s: any) => number) => stories.reduce((a, s) => a + f(s), 0);
const totals = {
  stories: stories.length, beats: sum((s) => s.counts.beats), speech: sum((s) => s.counts.say), narration: sum((s) => s.counts.narration), choices: sum((s) => s.counts.choices), outcomes: sum((s) => s.counts.outcomes),
  endings: sum((s) => s.counts.endings), promises: sum((s) => s.counts.promises), games: sum((s) => s.counts.games), callbacks: sum((s) => s.counts.callbacks), variants: sum((s) => s.counts.variants),
  items: itemsU.length, links: links.length,
  otherLines: stories.reduce((a, s) => a + s.beats.reduce((b: number, x: any) => b + (x.callbacks?.length ?? 0) + (x.nodes ?? []).reduce((c: number, n: any) => c + (n.activity ? n.activity.callerLines.length + n.activity.reactions.length : 0), 0), 0), 0), oddities: oddities.length, waiting: stories.filter((s) => s.waiting).length,
};
const summary = {
  totals,
  bySize: tally((s) => [s.size]), byTone: tally((s) => s.tones), byRole: tally((s) => s.roles.map((r: string) => ROLE_PLAIN[r]?.replace(/ \(.*/, "") ?? r)), byBatch: tally((s) => [s.batch]), byStage: tally((s) => [s.stage]),
  speakers: (() => { const m: Record<string, number> = {}; for (const s of stories) for (const p of s.speakers) m[p.name] = (m[p.name] ?? 0) + p.n; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })); })(),
};
// ───────── write ─────────
const head = git("rev-parse --short HEAD");
const branch = git("rev-parse --abbrev-ref HEAD");
const today = new Date().toISOString().slice(0, 10);
const roleFilter = Array.from(new Set(stories.flatMap((s) => s.roles))).map((r) => ({ key: r as string, label: (ROLE_PLAIN[r as string] ?? (r as string)).replace(/ \(.*/, "") })).sort((a, b) => a.label.localeCompare(b.label));
for (const s of stories) { delete s._col; delete s._raw; }
const data = {
  built: { date: today, commit: head, branch, count: stories.length, note: "Built from lib/star/life/book/arcs by scripts/life/story-book-page.mts" },
  summary, roleFilter, stories, items: itemsU, links, oddities,
  stages: Array.from(new Set(stories.map((s) => s.stage))).map((x) => ({ key: x, label: x })),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "data.json"), JSON.stringify(data));
const tpl = process.env.STORY_BOOK_TEMPLATE ? fs.readFileSync(process.env.STORY_BOOK_TEMPLATE, "utf8") : PAGE_HTML;
fs.writeFileSync(path.join(OUT, "index.html"), tpl);
const kb = (fs.statSync(path.join(OUT, "data.json")).size / 1024 / 1024).toFixed(2);
console.log(`Story Book: ${stories.length} stories, ${totals.beats} beats, ${totals.speech} speech lines, ${totals.choices} choices, ${totals.endings} endings, ${totals.outcomes} outcomes, ${totals.games} games, ${totals.items} item rows, ${links.length} links, ${oddities.length} oddities`);
console.log(`Wrote ${OUT}/data.json (${kb} MB) and index.html. Built ${today}, ${branch} at ${head}.`);
