/**
 * EVERYONE ELSE — managers, chairmen, journalists, fans, team-mates and
 * opponents, made by the same human builder (human.ts) from a seed, so each
 * club's manager is always the same man.
 *
 *   npcPerson("manager", clubName)      → { actor (for the cut-scene cast), spec, look }
 *   npcPerson("player", "Arsenal#7")    → a player for that shirt
 *
 * Variety (Harry, 9 Oct 2026: "we need more manager options"): ages 35–70,
 * slim / average / heavy, every skin tone, bald / receding / grey / slicked /
 * curly / short hair, clean / stubble / beard / moustache, glasses, and suit +
 * tie, suit open collar, club tracksuit, coat + scarf, quarter-zip.
 */
import type { HumanSpec, HairStyle, Outfit } from "./human";
import { SKIN_TONES } from "../playerIdentity";
import type { PersonModel } from "../people3d";

export type NpcRole = "manager" | "chairman" | "journalist" | "fan" | "player" | "build" | "head";

export interface NpcPerson {
  /** For lib/star/cutscene/people.ts Cast.actor(). */
  actor: { model: PersonModel; skin: string; hair: string; grey: number; beard: number; kit?: { shirt: string; trim: string }; human: HumanSpec };
  spec: HumanSpec;
  /** In words, for a test page. */
  label: string;
}

/** A small, stable random stream from any text. */
export function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const pick = <X>(r: () => number, list: readonly X[]) => list[Math.floor(r() * list.length) % list.length];
const pickW = <X>(r: () => number, list: readonly [X, number][]) => {
  const t = list.reduce((a, [, w]) => a + w, 0);
  let x = r() * t;
  for (const [v, w] of list) { x -= w; if (x <= 0) return v; }
  return list[list.length - 1][0];
};
const between = (r: () => number, a: number, b: number) => a + (b - a) * r();

const HAIR_COLOURS = ["#120c09", "#2a1a12", "#3d2616", "#5a3a22", "#8a6440", "#b88a4a"];
const SUITS = ["#1f2a44", "#25282f", "#121316", "#3a3f4a", "#4a3a2c", "#2c3a2e"];
const TIES = ["#7a1626", "#1b2f6b", "#2d5a3a", "#5a2a6b", "#b08a2a", "#202020"];
const SHIRTS = ["#f4f4f2", "#dfe8f4", "#f2ece0", "#e6eef0"];

function heritageFor(r: () => number, skinIdx: number): HumanSpec["heritage"] {
  // Darker tones lean African, middle tones mixed, lighter tones caucasian or Asian — always a blend.
  const d = skinIdx / 7;
  return { african: Math.max(0, d - 0.25) * 1.3 + r() * 0.2, caucasian: Math.max(0, 0.85 - d) + r() * 0.2, asian: r() < 0.2 ? between(r, 0.3, 0.8) : r() * 0.15 };
}

function faceFor(r: () => number): HumanSpec["face"] {
  const f = () => between(r, -0.8, 0.8);
  return { jaw: f(), chin: f(), cheeks: f(), nose: f(), long: f() * 0.7, round: Math.max(0, f()), square: Math.max(0, f()), lips: f() * 0.6, eyes: f() * 0.5 };
}

export function npcPerson(role: NpcRole | string, key: string, club?: { shirt: string; trim: string }): NpcPerson {
  if (role === "build") return buildPreset(key);
  if (role === "head") {
    const fh: Record<string, NonNullable<HumanSpec["facialHair"]>> = { buzz: "stubble", curly: "beard", receding: "moustache", sides: "goatee" };
    const skins = [2, 6, 3, 7, 1, 4, 5, 0];
    const i = ["buzz", "short", "crop", "side", "slick", "curly", "long", "receding"].indexOf(key);
    const spec: HumanSpec = { hair: key as HairStyle, facialHair: fh[key] ?? "none", outfit: "kit", heritage: { african: skins[i] / 7, caucasian: 1 - skins[i] / 7 } };
    return { actor: { model: "player", skin: SKIN_TONES[skins[i]].hex, hair: skins[i] > 4 ? "#120c09" : "#3d2616", grey: 0, beard: 0, kit: { shirt: "#1b3f8f", trim: "#ffffff" }, human: spec }, spec, label: key };
  }
  const r = seeded(`${role}:${key}`);
  const kit = club ?? { shirt: pick(r, ["#b3202c", "#1b3f8f", "#f2f2f2", "#0d6b3a", "#6a1d4a", "#f1c40f"]), trim: pick(r, ["#ffffff", "#111111", "#f1c40f"]) };
  const skinIdx = Math.floor(r() * SKIN_TONES.length);
  const skin = SKIN_TONES[skinIdx].hex;
  const hairC = skinIdx >= 4 ? pick(r, HAIR_COLOURS.slice(0, 2)) : pick(r, HAIR_COLOURS);

  if (role === "player") {
    const spec: HumanSpec = {
      height: between(r, 1.7, 1.94), build: between(r, -0.4, 0.3), muscle: between(r, 0, 0.8), age: between(r, 19, 34),
      shoulders: between(r, -0.3, 0.6), legs: between(r, -0.3, 0.4), neck: between(r, 0, 0.6), face: faceFor(r), heritage: heritageFor(r, skinIdx),
      hair: pickW(r, [["short", 4], ["buzz", 3], ["curly", 2], ["slick", 1], ["long", 1]] as [HairStyle, number][]),
      facialHair: pickW(r, [["none", 5], ["stubble", 3], ["beard", 1]] as [NonNullable<HumanSpec["facialHair"]>, number][]),
      outfit: "kit",
    };
    return { actor: { model: "player", skin, hair: hairC, grey: 0, beard: 0, kit, human: spec }, spec, label: `player ${spec.hair}` };
  }

  const age = role === "chairman" ? between(r, 52, 76) : role === "manager" ? between(r, 35, 70) : role === "journalist" ? between(r, 24, 58) : between(r, 18, 66);
  const buildKind = pickW(r, [["slim", 3], ["average", 4], ["heavy", role === "chairman" ? 4 : 2]] as [string, number][]);
  const build = buildKind === "slim" ? between(r, -0.7, -0.3) : buildKind === "heavy" ? between(r, 0.4, 0.9) : between(r, -0.15, 0.2);
  const grey = Math.max(0, Math.min(1, (age - 38) / 25 + between(r, -0.2, 0.2)));
  const hair = pickW(r, [
    ["none", age > 45 ? 2 : 0.6], ["receding", age > 40 ? 3 : 1], ["sides", age > 50 ? 2 : 0.3], ["slick", 3], ["short", 3], ["curly", 1.2], ["buzz", 1.5],
  ] as [HairStyle, number][]);
  const facialHair = pickW(r, [["none", 5], ["stubble", 3], ["beard", 2], ["moustache", age > 45 ? 1 : 0.3], ["goatee", 0.8]] as [NonNullable<HumanSpec["facialHair"]>, number][]);
  const outfit: Outfit = role === "fan" ? pick(r, ["casual", "tracksuit", "coat"] as Outfit[])
    : role === "journalist" ? pick(r, ["shirt", "quarterzip", "suitOpen", "coat"] as Outfit[])
      : role === "chairman" ? pickW(r, [["suit", 6], ["suitOpen", 2], ["coat", 2]] as [Outfit, number][])
        : pickW(r, [["suit", 4], ["suitOpen", 3], ["tracksuit", 3], ["quarterzip", 2], ["coat", 2]] as [Outfit, number][]);
  const club2 = outfit === "tracksuit" || outfit === "quarterzip" || role === "fan";
  const spec: HumanSpec = {
    height: between(r, 1.68, 1.93), build, muscle: between(r, -0.6, 0.2), belly: buildKind === "heavy" ? between(r, 0.3, 0.9) : buildKind === "average" && age > 45 ? between(r, 0, 0.35) : 0,
    age, shoulders: between(r, -0.3, 0.3), neck: buildKind === "heavy" ? between(r, 0.2, 0.7) : between(r, -0.3, 0.3),
    face: faceFor(r), heritage: heritageFor(r, skinIdx), hair, facialHair, outfit,
    glasses: r() < (role === "journalist" ? 0.45 : role === "chairman" ? 0.35 : 0.22),
    scarf: outfit === "coat" ? r() < 0.75 : role === "fan" && r() < 0.6,
    colours: {
      main: club2 ? kit.shirt : pick(r, SUITS), second: club2 ? kit.trim : pick(r, SHIRTS), accent: club2 ? kit.trim : pick(r, [...TIES, kit.shirt]),
      trousers: club2 && outfit === "tracksuit" ? kit.shirt : pick(r, SUITS), shoes: pick(r, ["#16110e", "#2a1a12", "#121212"]), scarf: kit.shirt,
      frames: pick(r, ["#1c1c1f", "#5a3a22", "#8a8a8f", "#b08a2a"]),
    },
  };
  const beard = facialHair === "beard" ? 0.85 : facialHair === "stubble" ? 0.35 : facialHair === "goatee" || facialHair === "moustache" ? 0.5 : 0;
  return {
    actor: { model: "manager", skin, hair: hairC, grey, beard, human: spec },
    spec,
    label: `${role}, ${Math.round(age)}, ${buildKind}, ${hair}, ${facialHair}, ${outfit}${spec.glasses ? ", glasses" : ""}`,
  };
}

/** The bench's build presets (the same man, built eight ways). */
function buildPreset(name: string): NpcPerson {
  const base: HumanSpec = { hair: "short", outfit: "kit", height: 1.8 };
  const presets: Record<string, HumanSpec> = {
    lean: { ...base, build: -0.8, muscle: 0.2 },
    base: { ...base },
    muscle: { ...base, muscle: 1, shoulders: 0.6, neck: 0.6 },
    heavy: { ...base, build: 0.9, muscle: 0.3, belly: 0.4 },
    short: { ...base, height: 1.66, legs: -0.3, hair: "buzz" },
    tall: { ...base, height: 1.98, legs: 0.4, build: -0.2, hair: "curly" },
    keeper: { ...base, height: 1.93, outfit: "keeper", shoulders: 0.4 },
    old: { ...base, age: 62, build: 0.4, belly: 0.5, hair: "receding", facialHair: "beard", outfit: "tracksuit", colours: { main: "#b3202c", second: "#f5f1e6", accent: "#f5f1e6" } },
  };
  const spec = presets[name] ?? base;
  return {
    actor: { model: spec.outfit?.startsWith("kit") || spec.outfit === "keeper" ? "player" : "manager", skin: SKIN_TONES[3].hex, hair: "#2a1a12", grey: name === "old" ? 0.6 : 0, beard: 0, kit: { shirt: "#b3202c", trim: "#f5f1e6" }, human: spec },
    spec,
    label: name,
  };
}
