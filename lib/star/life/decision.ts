/**
 * THE DECISION SCREENS — the data side (Harry, 20 Nov 2026, 15:35: "all three,
 * each for its job"; docs/plans/LIVING_WORLD_IDEAS.md). Pure, no React.
 *
 *  - TELLTALE: the other person or the world forces the moment. Slow-mo, grey
 *    world, a clock, 2-4 short lines with a tone tag, "… Say nothing" is a real
 *    answer and the one the clock picks.
 *  - THE TONE DIAL: press, mixed zone, training talks, dilemmas. Humble / Calm /
 *    Confident / Fiery, who is listening, "… No comment".
 *  - Anything else keeps the plain card.
 *
 * The event says which (`LifeEvent.screen`); the checker (validate.ts) makes
 * sure a Telltale or dial event has the tones and the silence it needs.
 * No number here comes from a server: the squad line is worked out from your
 * own team-mates, "Your voice" from your own answers.
 */
import type { CareerState } from "../types";
import type { LifeChoice, LifeEvent, LifeOutcome, LifeScreen, LifeState, LifeTone } from "./types";
import type { LiveChoice, LiveEvent } from "./director";
import { peek, personInfo, roleOf } from "./people";

// ── Which screen ─────────────────────────────────────────────────────────

export function screenFor(e: LifeEvent): LifeScreen {
  return e.screen === "telltale" || e.screen === "dial" ? e.screen : "card";
}

// ── Tones ────────────────────────────────────────────────────────────────

export const DIAL_TONES = ["humble", "calm", "confident", "fiery"] as const;
export type DialTone = (typeof DIAL_TONES)[number];
export const isDialTone = (t: string | undefined): t is DialTone => !!t && (DIAL_TONES as readonly string[]).includes(t);

export const TONE_LOOK: Record<LifeTone | "silent", { word: string; color: string }> = {
  humble: { word: "Humble", color: "#4aa8ff" },
  calm: { word: "Calm", color: "#35d0ba" },
  confident: { word: "Confident", color: "#3ddc84" },
  fiery: { word: "Fiery", color: "#ff5a4d" },
  honest: { word: "Honest", color: "#4aa8ff" },
  lie: { word: "Lie", color: "#f5b942" },
  kind: { word: "Kind", color: "#5eead4" },
  cold: { word: "Cold", color: "#9fb3c8" },
  brave: { word: "Brave", color: "#3ddc84" },
  reckless: { word: "Reckless", color: "#fb923c" },
  silent: { word: "Say nothing", color: "#9aa7b8" },
};

/** Where a tag sits on the dial, for "Your voice this season". */
export const DIAL_FAMILY: Record<LifeTone, DialTone> = {
  humble: "humble", honest: "humble", kind: "humble",
  calm: "calm", cold: "calm", lie: "calm",
  confident: "confident", brave: "confident", reckless: "confident",
  fiery: "fiery",
};

export const silentChoice = (live: LiveEvent): LiveChoice | undefined => live.choices.find((c) => c.choice.silent);
export const spokenChoices = (live: LiveEvent): LiveChoice[] => live.choices.filter((c) => !c.choice.silent);

// ── Who speaks ───────────────────────────────────────────────────────────

/** The slot whose line it is: the one who stays in colour. */
export function speakerSlot(e: LifeEvent): string {
  return e.speaker ?? e.cast[0]?.slot ?? "";
}
export function speakerId(live: LiveEvent): string {
  return live.cast[speakerSlot(live.event)] ?? "";
}
/** The line he says (the words in quotes in the last setup line that has
 *  any), and the rest as narration, words outside the quotes included. */
export function splitLines(live: LiveEvent): { said: string; narration: string[] } {
  const lines = live.lines.filter(Boolean);
  let i = -1;
  for (let k = lines.length - 1; k >= 0; k--) if (/["“]/.test(lines[k])) { i = k; break; }
  if (i < 0) return { said: "", narration: lines };
  const line = lines[i];
  const a = line.search(/["“]/);
  const b = Math.max(line.lastIndexOf('"'), line.lastIndexOf("”"));
  const said = b > a ? line.slice(a, b + 1) : line;
  const before = line.slice(0, a).replace(/[:\s]+$/, "").trim();
  const after = b > a ? line.slice(b + 1).trim() : "";
  // "Traore: " before a quote is only his name; anything longer is narration.
  const keep = (t: string) => t && !/^[A-Z][\w'.-]*$/.test(t);
  const narration = [...lines.slice(0, i), ...(keep(before) ? [before.endsWith(".") ? before : `${before}.`] : []), ...lines.slice(i + 1), ...(after ? [after] : [])];
  return { said, narration };
}

// ── The clock (a setting per device: Normal | Long | Off) ─────────────────

export type ClockSetting = "normal" | "long" | "off";
export const CLOCK_KEY = "kib.life.decisionClock";
export const DEFAULT_CLOCK_SECONDS = 8;

export function readClock(): ClockSetting {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(CLOCK_KEY) : null;
    return v === "long" || v === "off" ? v : "normal";
  } catch { return "normal"; }
}
export function writeClock(v: ClockSetting): void {
  try { window.localStorage.setItem(CLOCK_KEY, v); } catch { /* private window: Normal */ }
}
/** Seconds on the clock, or null for no clock. Long = twice as long. */
export function clockSecondsFor(e: LifeEvent, setting: ClockSetting): number | null {
  if (setting === "off") return null;
  const base = e.clockSeconds ?? DEFAULT_CLOCK_SECONDS;
  return setting === "long" ? base * 2 : base;
}

// ── Who is listening (a guess from the outcomes, never a promise) ─────────

export interface Listener { key: "boss" | "fans" | "team" | "speaker"; label: string; id?: string; arrows: -2 | -1 | 0 | 1 | 2; value: number }

/** Each outcome's share: the chances, the rest to a plain fallback; no chances = an even guess. */
function weights(outs: LifeOutcome[]): number[] {
  const chancy = outs.filter((o) => typeof o.chance === "number");
  if (!chancy.length) return outs.map(() => 1 / outs.length);
  const sum = chancy.reduce((a, o) => a + (o.chance ?? 0), 0);
  const rest = outs.filter((o) => typeof o.chance !== "number" && !o.if);
  return outs.map((o) => (typeof o.chance === "number" ? o.chance : rest.includes(o) ? Math.max(0, 1 - sum) / rest.length : 0));
}

const arrowsOf = (v: number): Listener["arrows"] => (v >= 6 ? 2 : v >= 2 ? 1 : v <= -6 ? -2 : v <= -2 ? -1 : 0);

export function listenersFor(c: CareerState, live: LiveEvent, choice: LifeChoice): Listener[] {
  const outs = choice.outcomes;
  const w = weights(outs);
  const sp = speakerId(live);
  const spSlot = speakerSlot(live.event);
  const spRole = sp && !sp.startsWith("oneoff:") ? roleOf(sp) : null;
  let boss = 0, fans = 0, team = 0, him = 0;
  outs.forEach((o, i) => {
    const e = o.effects ?? {};
    boss += w[i] * (e.boss ?? 0);
    fans += w[i] * ((e.fans ?? 0) + (e.fame ?? 0) * 0.3);
    team += w[i] * (e.team ?? 0);
    for (const d of o.npc ?? []) {
      const id = live.cast[d.slot];
      if (!id || id.startsWith("oneoff:")) continue;
      const feel = (d.respect ?? 0) * 0.5 + (d.bond ?? 0) - (d.grudge ?? 0) * 0.6;
      if (d.slot === spSlot) him += w[i] * feel;
      const r = roleOf(id);
      if (r === "manager") boss += w[i] * feel * 0.5;
      if (r === "teammate") team += w[i] * (d.bond ?? 0) * 0.2;
    }
  });
  const out: Listener[] = [];
  if (spRole !== "manager") out.push({ key: "boss", label: "Boss", arrows: arrowsOf(boss), value: boss });
  out.push({ key: "fans", label: "Fans", arrows: arrowsOf(fans), value: fans });
  out.push({ key: "team", label: "Dressing room", arrows: arrowsOf(team), value: team });
  if (spRole) out.push({ key: "speaker", label: spRole === "manager" ? "Boss" : personInfo(c, sp)?.short ?? "Him", id: sp, arrows: arrowsOf(him / 2), value: him });
  return out;
}

/** "He has a grudge: he may twist it." when the man you answer holds one. */
export function twistWarning(c: CareerState, live: LiveEvent): string | null {
  const sp = speakerId(live);
  if (!sp || sp.startsWith("oneoff:")) return null;
  const g = peek(c.life ?? ({ people: {} } as unknown as LifeState), sp).g;
  return g >= 30 ? `${personInfo(c, sp)?.short ?? "He"} has a grudge: he may twist it.` : null;
}

// ── "7 of your 11 team-mates would have…" (your own squad, no server) ─────

type Family = "humble" | "calm" | "bold" | "fiery" | "sly" | "quiet";
const FAMILY_OF: Record<LifeTone | "silent", Family> = {
  humble: "humble", honest: "humble", kind: "humble", calm: "calm", cold: "calm", lie: "sly",
  confident: "bold", brave: "bold", reckless: "bold", fiery: "fiery", silent: "quiet",
};
const WOULD: Record<LifeTone | "silent", string> = {
  honest: "been straight with him too", humble: "kept it humble too", kind: "done the kind thing too", calm: "kept their cool too",
  cold: "shut him down too", lie: "lied too", confident: "backed themselves too", brave: "done the brave thing too",
  reckless: "taken the risk too", fiery: "bitten back too", silent: "said nothing too",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** A team-mate's character, the same every time: from who he is and his age.
 *  (Team-mates have no stored personality yet; this is the stand-in.) */
export function temperament(id: string, age?: number): Record<Family, number> {
  const fams: Family[] = ["humble", "calm", "bold", "fiery", "sly", "quiet"];
  const t = {} as Record<Family, number>;
  fams.forEach((f, i) => { t[f] = 0.2 + ((hash(`${id}|${f}|${i}`) % 1000) / 1000) * 0.8; });
  t.sly *= 0.55; // most men would rather not lie to a face
  const a = age ?? 25;
  if (a >= 29) { t.calm += 0.25; t.humble += 0.15; t.fiery -= 0.1; }
  if (a <= 21) { t.fiery += 0.2; t.bold += 0.2; t.calm -= 0.1; }
  return t;
}

export interface SquadVerdict { same: number; of: number; phrase: string; tone: LifeTone | "silent" }

/** Your XI (the 11 best team-mates): how many would have answered your way,
 *  out of the answers this event offered. */
export function squadVerdict(c: CareerState, live: LiveEvent, choiceId: string): SquadVerdict | null {
  const picked = live.choices.find((x) => x.id === choiceId)?.choice;
  if (!picked) return null;
  const mine: LifeTone | "silent" | undefined = picked.silent ? "silent" : picked.tone;
  if (!mine) return null;
  const offered = Array.from(new Set(live.choices.map((x) => (x.choice.silent ? "silent" : x.choice.tone)).filter(Boolean) as (LifeTone | "silent")[]));
  const xi = [...(c.squad ?? [])].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, 11);
  if (!xi.length) return null;
  let same = 0;
  for (const p of xi) {
    const t = temperament(p.id, p.age);
    let best = offered[0], bw = -1;
    for (const o of offered) { const v = t[FAMILY_OF[o]]; if (v > bw) { bw = v; best = o; } }
    if (FAMILY_OF[best] === FAMILY_OF[mine]) same++;
  }
  return { same, of: xi.length, phrase: WOULD[mine], tone: mine };
}

// ── Your voice this season ───────────────────────────────────────────────

export interface Voice { humble: number; calm: number; confident: number; fiery: number; silent: number; total: number }

export function voiceOf(c: CareerState): Voice {
  const v = c.life?.voice;
  const z = { humble: 0, calm: 0, confident: 0, fiery: 0, silent: 0, total: 0 };
  if (!v || v[0] !== c.season) return z;
  const [, h, ca, co, f, s] = v;
  return { humble: h, calm: ca, confident: co, fiery: f, silent: s, total: h + ca + co + f + s };
}

/** Count one answer (resolve.ts calls this). A new season starts from zero. */
export function noteVoice(life: LifeState, season: number, ch: LifeChoice): void {
  if (!ch.silent && !ch.tone) return;
  const v: NonNullable<LifeState["voice"]> = life.voice && life.voice[0] === season ? [...life.voice] as NonNullable<LifeState["voice"]> : [season, 0, 0, 0, 0, 0];
  const idx = ch.silent ? 5 : 1 + DIAL_TONES.indexOf(DIAL_FAMILY[ch.tone!]);
  v[idx] += 1;
  life.voice = v;
}

// ── "X will remember that." ──────────────────────────────────────────────

export interface Remembered { slot: string; who: string; tag: string }

/** The notice, only when a memory was really written (the promise Telltale broke). */
export function rememberNotice(list: Remembered[] | undefined): { who: string; line: string; why: string } | null {
  if (!list?.length) return null;
  const person = list.find((r) => r.slot !== "squad" && r.slot !== "you");
  const r = person ?? list.find((x) => x.slot === "squad") ?? list[0];
  const why = r.tag.replace(/-/g, " ");
  const nice = why.charAt(0).toUpperCase() + why.slice(1) + ".";
  if (person) return { who: person.who, line: "will remember that.", why: nice };
  if (r.slot === "squad") return { who: "The dressing room", line: "will remember that.", why: nice };
  return { who: "People", line: "will remember that.", why: nice };
}
