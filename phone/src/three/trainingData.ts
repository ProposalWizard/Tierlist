/**
 * WHAT THE 3D TRAINING PITCH IS BUILT FROM, off a career: the website's components/star/Play3D.tsx
 * (`personOf`, `castFrom`, `bibsFor`, the session and the people) and Training3D.tsx (the Crossbar
 * Challenge's team-mate, his five shots), the same fields the same way. No React and no phone-only
 * imports, so the headless check (tools/training-check.ts) builds the pitch from the very same code.
 *
 * Not carried over: the team-mates' photographed faces (the website fetches each photo and fits a
 * face to the 3D head: `faceFromUrl`/`faceFrom`; it needs `createImageBitmap` and the website, and
 * Hermes has neither). Their heads are the drawn ones, as for everyone since photo faces were
 * switched off for the whole game (the brain note FACT-UI-015).
 */
import type { CareerState } from "@/lib/star/types";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { mulberry32 } from "@/lib/star/season";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { makeRng } from "@/lib/star/play3d/rng";
import { skillsOf, type Skills3 } from "@/lib/star/play3d/player";
import type { Person3 } from "@/lib/star/play3d/freeRoam";
import type { DrillDef, DrillSession } from "@/lib/star/play3d/drills";
import { applyLevelResult, highestUnlocked, starsOf } from "@/lib/star/trainingLevels";
import { rollMateShots } from "@/lib/star/training3d/crossbar";
import type { TrainingData } from "@/lib/star/training3d/scene";
import type { Play3DLook, Play3DPerson } from "@/lib/star/play3d/scene";
import type { DrillSceneData } from "./trainingScene";

export const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#5c3a1e", "#f1c27d"];
export const HAIRS = ["#1b120c", "#2b1b10", "#4a2e1c", "#0f0b08"];

/** The training seed (Training3D.tsx): one per week. */
export const trainingSeed = (career: Pick<CareerState, "season" | "week">) => career.season * 7919 + career.week * 131;

/** A squad player as a 3D man: his real numbers (missing ones from his overall), his photo, his position. */
export function personOf(p: NonNullable<CareerState["squad"]>[number], i: number): Person3 {
  const ov = p.overall ?? 65;
  const sk: Skills3 = { overall: ov, pace: p.pace ?? ov, power: p.shooting ?? ov, technique: p.dribbling ?? ov, passing: p.passing, shooting: p.shooting, dribbling: p.dribbling, defending: p.defending, physical: p.physical };
  return { id: p.id ?? `mate${i}`, name: p.name.split(" ").slice(-1)[0], skills: sk, photo: p.imageUrl ?? fakeFaceFor(p.id ?? `mate${i}`), position: p.position };
}

/** Bib colours for a free-for-all (Wembley): every other side its own. */
const BIBS = [
  { shirt: "#f59e0b", trim: "#1f2937" }, { shirt: "#7c3aed", trim: "#ffffff" }, { shirt: "#0891b2", trim: "#ffffff" },
  { shirt: "#db2777", trim: "#ffffff" }, { shirt: "#84cc16", trim: "#1f2937" }, { shirt: "#dc2626", trim: "#ffffff" },
  { shirt: "#1d4ed8", trim: "#ffffff" }, { shirt: "#f8fafc", trim: "#1f2937" },
];
const rgb = (h: string) => { const n = parseInt(h.replace("#", "").padEnd(6, "0").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
/** Five bibs, none close to your own kit's shirt (so you never look like the man you're playing against). */
export function bibsFor(shirt: string): Record<number, { shirt: string; trim: string }> {
  const [r, g, b] = /^#[0-9a-f]{6}$/i.test(shirt) ? rgb(shirt) : [0, 0, 0];
  const far = BIBS.filter((x) => { const [r2, g2, b2] = rgb(x.shirt); return Math.hypot(r - r2, g - g2, b - b2) > 130; });
  return Object.fromEntries(far.slice(0, 5).map((x, i) => [i + 1, x]));
}

/** Your numbers, up to five real team-mates (random from the squad, outfielders), and the whole outfield squad. */
export function castFrom(career: CareerState, seed: number): { you: Person3; mates: Person3[]; squad: Person3[] } {
  const s = career.skills;
  const you: Person3 = {
    id: "you", name: career.player.lastName || "You",
    skills: { overall: Math.round((s.pace + s.power + s.technique) / 3), pace: s.pace, power: s.power, technique: s.technique, passing: s.vision, shooting: Math.round((s.power + s.technique) / 2), dribbling: s.technique,
      // the career has no physical/stamina stat for you: your strength (power) stands in for fitness (the sprint bar)
      physical: s.power },
    photo: career.player.portrait,
  };
  const rng = makeRng(seed);
  const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
  const mates: Person3[] = [];
  const squad = pool.map(personOf);
  for (let i = 0; i < 5; i++) {
    if (!pool.length) { mates.push({ id: `mate${i}`, name: `Team-mate ${i + 1}`, skills: skillsOf(65) }); continue; }
    const p = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    mates.push(personOf(p, i));
  }
  return { you, mates, squad };
}

/** A drill's session off the career (Play3D.tsx): its World, HUD and result. */
export function drillSession(career: CareerState, drill: DrillDef, seed: number, cast: ReturnType<typeof castFrom>, mode?: string, options?: Record<string, string>): DrillSession {
  return drill.start!({
    seed, you: cast.you, mates: cast.mates, squad: cast.squad, mode, options,
    paceLevel: highestUnlocked(starsOf(career, "pace")),
    previewTrain: (t) => applyLevelResult(career, t.skill, t.level, t.stars).gained,
  });
}

/** Everyone on the drill's pitch, dressed (no photographed faces on the phone: see the top of this file). */
export function drillLook(career: CareerState, session: DrillSession, cast: ReturnType<typeof castFrom>, seed: number): Play3DLook {
  const people: Record<string, Play3DPerson> = {};
  const rng = makeRng(seed + 99);
  people[cast.you.id] = { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour), hairStyle: resolveHairStyle(career.player.hairStyle) };
  for (const p of session.world.players.filter((q) => !q.human && !q.keeper && !people[q.id])) {
    people[p.id] = { skin: SKINS[Math.floor(rng() * SKINS.length)], hair: HAIRS[Math.floor(rng() * HAIRS.length)], hairStyle: "short", face: null };
  }
  for (const k of session.world.players.filter((q) => q.keeper)) people[k.id] = { skin: SKINS[Math.floor(rng() * SKINS.length)], hair: HAIRS[0], hairStyle: "buzz" };
  const kit = kitsOf(career.player.club).home;
  return { kit: { shirt: kit.shirt, trim: kit.trim }, people, teamKits: session.bibs ? bibsFor(kit.shirt) : undefined };
}

/** What the drill's scene is started with (the website: `createPlay3DScene` and look H's colours). */
export function drillSceneData(career: CareerState, session: DrillSession, look: Play3DLook, onFrame: (dt: number) => void): DrillSceneData {
  const kit = kitsOf(career.player.club).home;
  return { world: session.world, look, camera: session.camera, practice: session.frame, onFrame, colours: { home: kit.shirt, home2: kit.trim, away: "#1d4ed8" } };
}

/** The Crossbar Challenge's team-mate: name, photo, ability, five shots and his look (fixed when the challenge starts). */
export function crossbarMate(career: CareerState, seed: number) {
  const rng = mulberry32(seed);
  const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
  const p = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  const id = p?.id ?? "mate";
  return {
    name: p ? p.name.split(" ").slice(-1)[0] : "Team-mate",
    face: p?.imageUrl ?? fakeFaceFor(id),
    overall: p?.overall ?? 65,
    shots: rollMateShots(p?.overall, rng),
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    hair: HAIRS[Math.floor(rng() * HAIRS.length)],
  };
}

/** The Crossbar Challenge's pitch: your look and the team-mate's, in the club's training top. */
export function crossbarSceneData(career: CareerState, mate: { skin: string; hair: string }): TrainingData {
  const kit = kitsOf(career.player.club).home;
  return {
    kit: { shirt: kit.shirt, trim: kit.trim },
    you: { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour), hairStyle: resolveHairStyle(career.player.hairStyle) },
    mate: { skin: mate.skin, hair: mate.hair, hairStyle: "short", face: null },
  };
}

/**
 * The real career match's canvas height on a screen this wide (lib/star/engineProfile.ts `realMatchHeight`: a 5:8 canvas, 24 wide of
 * margin, 384 at most): the height a swipe is measured against, so a swipe kicks as hard here as on the website. Copied as arithmetic
 * because that file pulls in the whole career.
 */
export function realMatchHeightFor(viewportW: number): number {
  const w = !(viewportW > 0) ? 384 : Math.max(200, Math.min(384, Math.round(viewportW - 24)));
  return w / (5 / 8);
}
