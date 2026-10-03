/**
 * The 3D signing scene's words and settings (/star-3d-area-dev/signing, and
 * the career's signing when Settings → "3D signing scene (beta)" is on).
 *
 * The scene itself is live three.js: lib/star/signing3dScene.ts (the office,
 * camera and timeline) and lib/star/signing3dRig.ts (the people). This file
 * is plain data and small pure helpers, so it can be tested and imported
 * anywhere without pulling three.js in.
 */
import { useSyncExternalStore } from "react";
import { ACCESSORIES } from "./store/catalogue";

/** A line across the desk. "talk" = over your shoulder at him; "reply" =
 *  over his shoulder at you. */
export interface SigningLine { who: "boss" | "you"; shot: "talk" | "reply"; text: string }

const WORD_NUM = ["no", "one", "two", "three", "four", "five", "six"];

/** The approved script, with the real seasons and shirt number dropped in. */
export function signingLines(t: { seasons?: number | null; number?: number | null; kind?: "trial" | "transfer" } = {}): SigningLine[] {
  const seasons = t.seasons ?? 2;
  const len = seasons >= 1 && seasons < WORD_NUM.length ? WORD_NUM[seasons] : String(seasons);
  const lenWords = `${len[0].toUpperCase()}${len.slice(1)} season${seasons === 1 ? "" : "s"}`;
  const shirt = t.number != null ? `, the number ${t.number} shirt` : "";
  return [
    // A transfer has no trial behind it: he has been watching you play.
    t.kind === "transfer"
      ? { who: "boss", shot: "talk", text: "Sit down, son. I've wanted you here for a while." }
      : { who: "boss", shot: "talk", text: "Sit down, son. I watched every kick of that trial." },
    { who: "you", shot: "reply", text: "Thanks, boss. I want to play." },
    { who: "boss", shot: "talk", text: `You'll get your chance. ${lenWords}${shirt}.` },
    { who: "you", shot: "reply", text: "Where do I sign?" },
    { who: "boss", shot: "talk", text: "Read it first. Then it's yours." },
  ];
}

/** The fixed sample in the test area (Enfield Town, 2 seasons, #39). */
export const SIGNING_LINES = signingLines({ seasons: 2, number: 39 });

export const SAMPLE_TERMS = {
  club: "Enfield Town",
  manager: "Oscar Bianchi",
  playerName: "Sam Carter",
  seasons: 2,
  wage: 35,
  number: 39,
  position: "ST",
};

/** The contract's rows, in the order they are printed. */
export function contractRows(t: { seasons?: number | null; wage?: number | null; number?: number | null; position?: string | null; season?: string | null }): [string, string][] {
  const money = (n: number) => `★${Math.round(n).toLocaleString("en-GB")}`;
  const rows: [string, string][] = [
    ["Length", t.seasons ? `${t.seasons} season${t.seasons === 1 ? "" : "s"}` : ""],
    ["From", t.season ?? ""],
    ["Wage", t.wage ? `${money(t.wage)} / wk` : ""],
    ["Shirt", t.number != null ? `#${t.number}` : ""],
    ["Position", t.position ?? ""],
  ];
  return rows.filter(([, v]) => v);
}

/** What the scene needs to know about each accessory worn. */
export interface WornAccessory { id: string; slot: string; color: string; color2?: string; stripes?: string[] }

/**
 * The accessories that show in 3D, from the career's equipped slots.
 * Celebrations are moves, not things you wear, so they never show here.
 */
export function wornAccessories(equipped: Record<string, string> | undefined): WornAccessory[] {
  const out: WornAccessory[] = [];
  for (const [slot, id] of Object.entries(equipped ?? {})) {
    const a = ACCESSORIES.find((x) => x.id === id && x.slot === slot);
    if (!a || a.slot === "celebration") continue;
    out.push({ id: a.id, slot: a.slot, color: a.color, color2: a.color2, stripes: a.stripes });
  }
  return out;
}

/** The Star Pass reward that shows on your face. */
export const AVIATORS_CARD = "pass-gold-aviators";

/** Which store accessories have a 3D model in the signing scene, and which don't. */
export const SIGNING3D_ACCESSORY_SLOTS = ["head", "neck", "arms", "wrists", "hands", "boots", "armband"] as const;

// ── The Settings switch: "3D signing scene (beta)", per device, off by default ──

export const SIGNING_3D_KEY = "star-signing-3d";
let stored: boolean | undefined;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SIGNING_3D_KEY) === "on";
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SIGNING_3D_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function signing3dOn(): boolean {
  if (stored === undefined) stored = read();
  return stored;
}

export function setSigning3d(on: boolean): void {
  try { localStorage.setItem(SIGNING_3D_KEY, on ? "on" : "off"); } catch { /* in-memory still changes */ }
  stored = on;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The switch, re-rendering when Settings flips it. Off on the server. */
export function useSigning3d(): boolean {
  return useSyncExternalStore(subscribe, signing3dOn, () => false);
}
