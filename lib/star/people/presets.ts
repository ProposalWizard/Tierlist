/**
 * PEOPLE PRESETS — the look of every person who isn't you, in the game's toon
 * style (Style A, RUL-3D-009), picked from a library of named presets by a
 * stable hash of the person's id. The same person always looks the same; two
 * people next to each other almost never do.
 *
 * Harry, 20 Nov 2026: "doing the same for player models as we just did for
 * manager models would be ideal, if we give a lot of preset options at least
 * we can pre build all cut scenes".
 *
 * Pure (no three.js). Tested in tests/star/peoplePresets.mts. Seen on the
 * contact sheet /star-3d-bench-dev/people. NOT wired into the signing scene,
 * the office or the cut scenes yet (step 2, after Harry's OK).
 *
 * Built only from what the toon people already have:
 *   heads     the 8 Style A heads (bodies.ts TOON_HEADS): 6 kit heads, 2 suit heads; and the 4
 *             re-shaped heads (TOON_SHAPE_HEADS: broad jaw, long face, round face, older and lined)
 *   hair      15 modelled hairstyles worn on the close-cut heads (style3d/toon/hairStyles.ts: locs
 *             short, shoulder-length and tied up, short afro, high-top, twists, braids, curly top,
 *             crew cut, slick back, tied back, man bun, mullet, thinning, receding), each only on
 *             the hair texture it suits
 *   builds    Slim / Strong / Tall (TOON_BUILD_SCALE)
 *   skin      the game's 8 tones (playerIdentity.ts SKIN_TONES)
 *   hair      the game's 4 colours plus the manager drawings' 3 (managerFace.ts), and grey
 *   clothes   the shader's suit mode (coat, trousers, shirt, tie, shoes), which also draws a
 *             tracksuit or a casual set on a kit head (home3d/wear.ts does that for your clothes)
 *   haircut   new, small: the shader paints a modelled scalp or beard as skin (bald, shaved,
 *             clean-shaven) or paints stubble on (shader.ts uHairCut). Bald only on the close-cut
 *             heads, where it reads as a shaved head and not a skin-coloured hairdo.
 *   kit       the club's own home kit (kits.ts kitsOf), boots and the usual extras (sleeves,
 *             tape, a headband, a snood)
 * Known managers (managerFace.ts KNOWN) keep their broad strokes: bald stays bald, a beard stays.
 */
import { SKIN_TONES, type HairStyle, type SkinTone } from "../playerIdentity";
import { MANAGER_HAIR_COLOURS, type ManagerBeard, type ManagerLook } from "../managerFace";
import { hashId, type ToonBody, type ToonHead } from "../style3d/toon/bodies";
import { kitsOf } from "../kits";
import { TOON_HAIR_INFO, toonHairFits, type ToonHair, type HairTexture } from "../style3d/toon/hairStyles";
import { faceFor, type ToonFaceId } from "../style3d/toon/faceShape";
import { faceIdFor, type FaceId } from "../style3d/toon/faceId";
export type { HairTexture };

export type PersonRole = "manager" | "staff" | "player" | "journalist" | "agent" | "fan";
export type PresetOutfit = "suit" | "tracksuit" | "smart" | "casual" | "kit";

export type HairId = keyof typeof MANAGER_HAIR_COLOURS;
/** Darkest to fairest (ginger stands apart: never drifted into). */
const HAIR_ORDER: readonly HairId[] = ["black", "darkBrown", "brown", "chestnut", "fair", "blond"];

/**
 * HERITAGE (Harry, 20 Nov 2026: "the mixed race and the darker skinned characters are tending to
 * not have features of those ethnicities … an assistant manager who's black with a quiff"). A
 * preset's heritage sets its skin range, its hair TEXTURE and so the hairstyles it may have, and
 * its hair colours; the per-person touches stay inside it. Hair texture is never chosen apart
 * from heritage, and a style is only ever worn by a texture it suits (styleTextures). Real variety
 * inside each group: several styles, beards, ages and builds each, none of them "the" look.
 */
export type Heritage = "black" | "mixed" | "white" | "southAsian" | "eastAsian" | "mena" | "latin";
export const HERITAGE: Record<Heritage, { label: string; skin: [number, number]; textures: readonly HairTexture[]; hair: readonly HairId[] }> = {
  black: { label: "Black African / Caribbean", skin: [4, 7], textures: ["coily"], hair: ["black", "black", "darkBrown"] },
  mixed: { label: "Mixed (Black and white)", skin: [3, 5], textures: ["curly", "coily"], hair: ["black", "darkBrown", "darkBrown", "brown"] },
  white: { label: "White European", skin: [0, 2], textures: ["straight", "wavy", "curly"], hair: ["darkBrown", "brown", "chestnut", "fair", "blond", "ginger", "black"] },
  southAsian: { label: "South Asian", skin: [3, 5], textures: ["straight", "wavy"], hair: ["black", "black", "darkBrown"] },
  eastAsian: { label: "East Asian", skin: [1, 3], textures: ["straight"], hair: ["black", "black", "darkBrown"] },
  mena: { label: "Middle Eastern / North African", skin: [2, 4], textures: ["wavy", "curly"], hair: ["black", "darkBrown"] },
  latin: { label: "Latin American / Iberian", skin: [2, 4], textures: ["straight", "wavy", "curly"], hair: ["black", "darkBrown", "brown"] },
};

/**
 * A haircut on the modelled hair: scalp to skin (1 bald, 0.7 shaved), beard off, stubble painted
 * on, and a pattern cut into a close-cut scalp (1 = 360 waves, 2 = cornrows; shader.ts uHairCut.w).
 */
export interface HairCut { scalp: number; beard: number; stubble: number; pattern?: number }
export const CUTS = {
  as: { scalp: 0, beard: 0, stubble: 0 },
  stubble: { scalp: 0, beard: 0, stubble: 0.8 },
  clean: { scalp: 0, beard: 1, stubble: 0 },
  cleanStubble: { scalp: 0, beard: 1, stubble: 0.75 },
  shaved: { scalp: 0.7, beard: 0, stubble: 0 },
  bald: { scalp: 1, beard: 0, stubble: 0 },
  baldClean: { scalp: 1, beard: 1, stubble: 0 },
  baldStubble: { scalp: 1, beard: 1, stubble: 0.8 },
  waves: { scalp: 0, beard: 0, stubble: 0, pattern: 1 },
  wavesClean: { scalp: 0, beard: 1, stubble: 0, pattern: 1 },
  wavesStubble: { scalp: 0, beard: 1, stubble: 0.75, pattern: 1 },
  cornrows: { scalp: 0, beard: 0, stubble: 0, pattern: 2 },
  cornrowsClean: { scalp: 0, beard: 1, stubble: 0, pattern: 2 },
} as const satisfies Record<string, HairCut>;
export type CutId = keyof typeof CUTS;

/** Heads with a beard modelled in, and what it is. */
export const HEAD_BEARD: Partial<Record<ToonHead, ManagerBeard>> = { h3: "short", h6: "short", m1: "short", m2: "full", h7: "short", h8: "short", h9: "short", m3: "full" };
/** Heads whose hair sits close to the skull: the only ones that may go bald or shaved. */
export const CLOSE_CUT_HEADS: readonly ToonHead[] = ["h3", "h6", "m2", "h7", "h8", "h9", "m3"];
/** Heads whose close cut may carry a pattern (waves, cornrows): the tight crops. */
export const PATTERN_HEADS: readonly ToonHead[] = ["h3", "m2", "h7", "h8", "h9", "m3"];

/**
 * Which hair textures a head and cut suit. The modelled hair decides: Curls (h1) is a curly or
 * coily top; Quiff, Bun, Fringe, the crop with a side part (h6) and the swept grey (m1) are
 * straight or wavy hair; the close buzz with a line-up (h3) and the fade (m2) suit every texture;
 * bald suits everyone; waves and cornrows are coily (waves also curly) hair.
 */
export function styleTextures(head: ToonHead, cut: HairCut, hairMesh?: ToonHair): readonly HairTexture[] {
  // a modelled hairstyle decides for itself (locs, afro, high-top, twists and braids are coily hair only)
  if (hairMesh) return toonHairFits(head) ? TOON_HAIR_INFO[hairMesh].textures : [];
  if (cut.pattern === 2) return ["coily"];
  if (cut.pattern === 1) return ["coily"];
  if (cut.scalp >= 0.9) return ["straight", "wavy", "curly", "coily"];
  if (toonHairFits(head)) return ["straight", "wavy", "curly", "coily"]; // the buzz, the fade and their re-shaped heads
  if (head === "h1") return ["curly", "coily"];
  return ["straight", "wavy"];
}

/** Cloth colours (sRGB hex). */
export const COATS = {
  navy: "#1f2533", charcoal: "#2e3136", black: "#16171a", slate: "#4a5260", blue: "#2b4170",
  tan: "#8a6a48", green: "#26372e", grey: "#6b6f76", burgundy: "#4a1f27", cream: "#d8cdb6",
} as const;
export const SHIRTS = { white: "#eef0f2", paleBlue: "#c9d9ec", pink: "#e8cfd3", black: "#1b1c1f", cream: "#efe6d2", grey: "#9ea3aa" } as const;
export const TIES = { maroon: "#7a1d2b", navy: "#1d2a4a", silver: "#9aa0a8", gold: "#b08a2e", green: "#2f5a3c", black: "#141416" } as const;
type CoatId = keyof typeof COATS;
type ShirtId = keyof typeof SHIRTS;
/** "club": the club's shirt colour (a tie, a tracksuit); "open": an open collar (the tie is the shirt). */
type TieId = keyof typeof TIES | "club" | "open";

export type PlayerExtra = "none" | "sleeves" | "tape" | "headband" | "snood" | "sleevesTape";
const BOOTS = ["#141416", "#141416", "#f2f2ef", "#d61f26", "#1f4fd1", "#f07a1a", "#c9a227", "#e23c8f", "#2fb34a"] as const;

export interface PeoplePreset {
  id: string;
  name: string;
  outfit: PresetOutfit;
  roles: readonly PersonRole[];
  heritage: Heritage;
  texture: HairTexture;
  head: ToonHead;
  build: ToonBody;
  /** Index into SKIN_TONES (0 lightest … 7 darkest), inside the heritage's range; a person may sit one either side, still inside it. */
  skin: number;
  hair: HairId;
  /** 0 none … 1 white. */
  grey: number;
  cut: CutId;
  /** A modelled hairstyle on top (only on a head that wears one: hairStyles.ts toonHairFits). */
  hairMesh?: ToonHair;
  age: number;
  coat?: CoatId | "club";
  trousers?: CoatId;
  shirt?: ShirtId | "trim";
  tie?: TieId;
  extra?: PlayerExtra;
}

const S = (id: string, name: string, roles: PersonRole[], outfit: PresetOutfit, heritage: Heritage, texture: HairTexture, head: ToonHead, build: ToonBody, skin: number, hair: HairId, grey: number, cut: CutId, age: number,
  coat: CoatId | "club", shirt: ShirtId | "trim", tie: TieId, trousers?: CoatId): PeoplePreset =>
  ({ id, name, roles, outfit, heritage, texture, head, build, skin, hair, grey, cut, age, coat, shirt, tie, trousers });

/** The same preset wearing a modelled hairstyle. */
const W = (hairMesh: ToonHair, p: PeoplePreset): PeoplePreset => ({ ...p, hairMesh });

const MS: PersonRole[] = ["manager", "staff"];
/** Managers, staff, agents, journalists and fans (31 manager/staff looks). */
export const STAFF_PRESETS: readonly PeoplePreset[] = [
  // the suit heads: Grey & stubble (m1, straight hair swept back), Fade & beard (m2, a close fade)
  S("mgr-silver-fox", "Silver Fox", MS, "suit", "white", "straight", "m1", "c3", 1, "fair", 0.9, "as", 61, "navy", "white", "maroon"),
  S("mgr-clean-gaffer", "Clean-shaven Gaffer", MS, "suit", "white", "straight", "m1", "c2", 0, "brown", 0.5, "clean", 55, "charcoal", "white", "navy"),
  S("mgr-old-pro", "Old Pro", MS, "suit", "white", "wavy", "m1", "c2", 2, "darkBrown", 0.7, "cleanStubble", 64, "black", "white", "silver"),
  S("mgr-continental", "Continental", MS, "suit", "latin", "wavy", "m1", "c1", 3, "black", 0.3, "as", 48, "slate", "black", "black"),
  S("mgr-professor", "Professor", MS, "suit", "mena", "wavy", "m1", "c1", 3, "black", 0.6, "clean", 58, "tan", "cream", "green", "charcoal"),
  S("mgr-fade-beard", "Fade & Beard", MS, "suit", "black", "coily", "m2", "c2", 6, "black", 0.2, "as", 44, "navy", "white", "club"),
  S("mgr-bald-beard", "Bald & Beard", MS, "suit", "black", "coily", "m2", "c2", 5, "black", 0.35, "bald", 50, "black", "white", "gold"),
  S("mgr-bald-clean", "Clean Dome", MS, "suit", "white", "straight", "m2", "c3", 0, "brown", 0.5, "baldClean", 52, "charcoal", "paleBlue", "navy"),
  S("mgr-shaved-stubble", "Shaved & Stubble", MS, "suit", "mena", "wavy", "m2", "c1", 3, "darkBrown", 0.4, "baldStubble", 46, "blue", "white", "maroon"),
  S("mgr-young-coach", "Young Coach", MS, "suit", "white", "wavy", "m2", "c1", 2, "brown", 0.05, "clean", 38, "slate", "white", "club"),
  S("mgr-grey-fade", "Grey Fade", MS, "suit", "black", "coily", "m2", "c3", 7, "black", 0.5, "as", 62, "grey", "white", "black"),
  S("mgr-waves", "Waves & Beard", MS, "suit", "black", "coily", "m2", "c2", 6, "black", 0.1, "waves", 41, "navy", "paleBlue", "silver"),
  S("mgr-bald-stubble", "Bald & Stubble", MS, "suit", "white", "straight", "m2", "c2", 1, "brown", 0.4, "baldStubble", 52, "black", "white", "black"),
  S("trk-young-boss", "Young Boss", MS, "tracksuit", "white", "straight", "h2", "c3", 0, "brown", 0.15, "stubble", 37, "club", "trim", "club", "black"),
  S("smt-coach-fringe", "Head Coach", MS, "smart", "eastAsian", "straight", "h5", "c1", 2, "black", 0.3, "stubble", 46, "navy", "white", "open", "charcoal"),
  S("mgr-chairman", "Chairman", ["staff"], "suit", "white", "straight", "m1", "c2", 0, "fair", 0.95, "as", 68, "black", "white", "club"),
  S("mgr-director", "Director of Football", MS, "suit", "mixed", "curly", "m2", "c3", 4, "black", 0.4, "cleanStubble", 50, "navy", "paleBlue", "silver"),
  S("mgr-club-doctor", "Club Doctor", ["staff"], "suit", "southAsian", "straight", "m1", "c1", 4, "black", 0.6, "clean", 59, "grey", "white", "navy"),
  // tracksuits on the kit heads (the suit mode's long sleeves and trousers), in the club's colours
  S("trk-boss", "Tracksuit Boss", MS, "tracksuit", "black", "coily", "h3", "c2", 5, "black", 0.3, "as", 45, "club", "trim", "club", "black"),
  S("trk-touchline", "Touchline Coach", MS, "tracksuit", "white", "wavy", "h6", "c3", 1, "brown", 0.4, "cleanStubble", 42, "club", "trim", "club", "black"),
  S("trk-keeper-coach", "Goalkeeping Coach", MS, "tracksuit", "latin", "wavy", "h6", "c2", 3, "darkBrown", 0.2, "as", 40, "charcoal", "grey", "open", "black"),
  S("trk-physio", "Physio", ["staff"], "tracksuit", "eastAsian", "straight", "h5", "c1", 2, "black", 0.05, "as", 33, "club", "trim", "club", "navy"),
  S("trk-fitness", "Fitness Coach", ["staff"], "tracksuit", "black", "coily", "h3", "c2", 7, "black", 0, "baldClean", 36, "black", "grey", "open", "black"),
  S("trk-kit-man", "Kit Man", ["staff"], "tracksuit", "white", "curly", "h1", "c2", 0, "ginger", 0.5, "stubble", 55, "navy", "white", "open", "navy"),
  S("trk-interim", "Interim Boss", MS, "tracksuit", "mixed", "coily", "h3", "c3", 5, "black", 0.25, "wavesStubble", 39, "club", "trim", "club", "black"),
  S("trk-academy", "Head of Academy", ["staff"], "tracksuit", "mixed", "curly", "h1", "c1", 4, "darkBrown", 0.45, "stubble", 50, "green", "white", "open", "charcoal"),
  S("smt-assistant", "Assistant Manager", MS, "smart", "black", "coily", "h3", "c2", 7, "black", 0.3, "waves", 41, "charcoal", "white", "open"),
  S("smt-scout", "Chief Scout", ["staff"], "smart", "southAsian", "wavy", "h4", "c1", 3, "black", 0.35, "stubble", 47, "green", "cream", "open", "tan"),
  S("smt-presenter", "Presenter", ["staff", "journalist"], "suit", "black", "coily", "h3", "c1", 6, "black", 0.1, "clean", 40, "navy", "white", "navy"),
  S("smt-analyst", "Analyst", ["staff"], "smart", "white", "straight", "h2", "c1", 1, "fair", 0, "as", 31, "grey", "paleBlue", "open", "navy"),
  S("smt-owner", "Owner", ["staff"], "suit", "mena", "wavy", "m2", "c2", 2, "black", 0.55, "baldStubble", 57, "burgundy", "white", "gold", "black"),
  // agents and the press
  S("agt-super", "Super-agent", ["agent"], "smart", "mixed", "curly", "h1", "c2", 4, "black", 0.15, "as", 42, "black", "white", "open"),
  S("agt-slick", "Slick Agent", ["agent"], "smart", "white", "straight", "h2", "c1", 1, "blond", 0, "as", 36, "navy", "black", "open"),
  S("agt-old-school", "Old-school Agent", ["agent"], "suit", "mena", "wavy", "m1", "c2", 3, "black", 0.6, "clean", 57, "tan", "white", "gold", "charcoal"),
  S("agt-fixer", "The Fixer", ["agent"], "smart", "black", "coily", "m2", "c3", 7, "black", 0.2, "wavesClean", 45, "charcoal", "black", "open"),
  S("prs-pundit", "Pundit", ["journalist"], "smart", "mixed", "coily", "h3", "c2", 5, "black", 0, "cornrows", 31, "grey", "paleBlue", "open", "navy"),
  S("prs-reporter", "Reporter", ["journalist"], "smart", "southAsian", "straight", "h6", "c3", 4, "black", 0, "as", 28, "blue", "white", "open", "charcoal"),
  S("prs-veteran", "Press-box Veteran", ["journalist"], "smart", "white", "wavy", "h5", "c2", 2, "brown", 0.5, "stubble", 54, "tan", "white", "navy", "charcoal"),
  S("prs-camera", "Cameraman", ["journalist"], "casual", "latin", "wavy", "h3", "c2", 3, "darkBrown", 0.2, "as", 38, "black", "black", "open", "charcoal"),
  // fans: a casual set with the club as the "tie" (a scarf at the neck)
  S("fan-home", "Home Fan", ["fan"], "casual", "white", "curly", "h1", "c2", 1, "brown", 0, "as", 30, "slate", "trim", "club", "blue"),
  S("fan-season", "Season-ticket Holder", ["fan"], "casual", "black", "coily", "h3", "c3", 6, "black", 0.5, "clean", 58, "green", "white", "club", "charcoal"),
  S("fan-away", "Away End", ["fan"], "casual", "white", "straight", "h5", "c1", 0, "fair", 0, "stubble", 24, "club", "trim", "club", "blue"),
  S("fan-ultra", "Ultra", ["fan"], "casual", "white", "wavy", "h6", "c2", 2, "black", 0, "shaved", 27, "black", "black", "club", "black"),
  // the modelled hairstyles and the re-shaped heads (20 Nov 2026: h7 broad jaw, h8 long face, h9 round face, m3 older and lined)
  W("thinning", S("mgr-veteran-gaffer", "Veteran Gaffer", MS, "suit", "white", "straight", "m3", "c2", 1, "fair", 0.9, "clean", 66, "charcoal", "white", "maroon")),
  W("receding", S("mgr-elder-statesman", "Elder Statesman", MS, "suit", "black", "coily", "m3", "c3", 6, "black", 0.8, "as", 67, "navy", "white", "gold")),
  W("slickBack", S("mgr-weathered-boss", "Weathered Boss", MS, "suit", "white", "wavy", "m3", "c2", 2, "darkBrown", 0.6, "cleanStubble", 60, "black", "white", "silver")),
  W("locsBun", S("trk-locs-coach", "Locs Coach", MS, "tracksuit", "black", "coily", "h3", "c2", 6, "black", 0.15, "as", 43, "club", "trim", "club", "black")),
  W("locsLong", S("mgr-locs-boss", "Locs & Suit", MS, "suit", "black", "coily", "m2", "c3", 7, "black", 0.3, "as", 49, "charcoal", "white", "club")),
  W("afro", S("trk-first-team-coach", "First-team Coach", MS, "tracksuit", "black", "coily", "h9", "c2", 5, "black", 0.1, "as", 39, "club", "trim", "club", "black")),
  W("receding", S("mgr-receding-gaffer", "Receding Gaffer", MS, "suit", "latin", "wavy", "m2", "c2", 3, "black", 0.45, "cleanStubble", 53, "slate", "paleBlue", "navy")),
  W("twists", S("smt-data-analyst", "Data Analyst", ["staff"], "smart", "mixed", "coily", "h8", "c1", 4, "darkBrown", 0, "cleanStubble", 29, "grey", "white", "open", "navy")),
  W("slickBack", S("smt-sporting-director", "Sporting Director", ["staff"], "suit", "mena", "wavy", "h7", "c3", 3, "black", 0.25, "as", 47, "navy", "white", "open")),
  W("crew", S("trk-set-piece-coach", "Set-piece Coach", MS, "tracksuit", "white", "straight", "h7", "c2", 1, "brown", 0.1, "clean", 35, "club", "trim", "club", "black")),
  W("thinning", S("trk-old-physio", "Long-serving Physio", ["staff"], "tracksuit", "white", "straight", "h9", "c2", 1, "brown", 0.75, "clean", 61, "navy", "white", "open", "navy")),
  W("ponytail", S("agt-boutique", "Boutique Agent", ["agent"], "smart", "latin", "straight", "h8", "c1", 3, "black", 0.1, "stubble", 38, "cream", "black", "open", "charcoal")),
  W("curlyTop", S("agt-young", "Young Agent", ["agent"], "smart", "mixed", "curly", "h7", "c1", 3, "darkBrown", 0, "clean", 30, "burgundy", "black", "open", "black")),
  W("braids", S("prs-podcast-host", "Podcast Host", ["journalist"], "smart", "black", "coily", "h3", "c1", 5, "black", 0, "clean", 27, "green", "cream", "open", "charcoal")),
  W("locsShort", S("prs-columnist", "Columnist", ["journalist"], "smart", "black", "coily", "h9", "c2", 6, "black", 0.2, "as", 44, "tan", "white", "open", "navy")),
  W("mullet", S("fan-terrace-mullet", "Terrace Mullet", ["fan"], "casual", "white", "straight", "h9", "c2", 0, "fair", 0, "cleanStubble", 33, "club", "trim", "club", "blue")),
  W("highTop", S("fan-young", "Young Fan", ["fan"], "casual", "mixed", "coily", "h7", "c1", 4, "black", 0, "clean", 19, "grey", "trim", "club", "black")),
];

/**
 * The head-and-haircut looks a player can have: the 6 heads (beards on and off, shaved, stubble,
 * waves, cornrows), the 3 re-shaped kit heads, and the modelled hairstyles on the close-cut heads.
 */
const PLAYER_VARIANTS: readonly [ToonHead, CutId, string, ToonHair?][] = [
  ["h3", "as", "Short Locs & Beard", "locsShort"], ["h8", "clean", "Short Locs", "locsShort"],
  ["h3", "clean", "Shoulder Locs", "locsLong"], ["h7", "as", "Shoulder Locs & Beard", "locsLong"],
  ["h9", "clean", "Locs Tied Up", "locsBun"], ["h3", "as", "Locs Tied Up & Beard", "locsBun"],
  ["h3", "clean", "Short Afro", "afro"], ["h9", "as", "Short Afro & Beard", "afro"],
  ["h7", "clean", "High-top", "highTop"], ["h3", "as", "High-top & Beard", "highTop"],
  ["h3", "cleanStubble", "Twists", "twists"], ["h8", "as", "Twists & Beard", "twists"],
  ["h3", "clean", "Braids", "braids"], ["h7", "as", "Braids & Beard", "braids"],
  ["h3", "clean", "Curly Top", "curlyTop"], ["h8", "cleanStubble", "Curly Top & Stubble", "curlyTop"], ["h9", "as", "Curly Top & Beard", "curlyTop"],
  ["h7", "clean", "Crew Cut", "crew"], ["h9", "cleanStubble", "Crew Cut & Stubble", "crew"], ["h3", "as", "Crew Cut & Beard", "crew"],
  ["h8", "clean", "Slick Back", "slickBack"], ["h7", "as", "Slick Back & Beard", "slickBack"],
  ["h3", "clean", "Tied Back", "ponytail"], ["h8", "as", "Tied Back & Beard", "ponytail"],
  ["h9", "clean", "Man Bun", "manBun"], ["h3", "as", "Man Bun & Beard", "manBun"],
  ["h7", "cleanStubble", "Mullet", "mullet"],
  ["h7", "clean", "Broad-jaw Buzz"], ["h7", "as", "Broad-jaw Buzz & Beard"], ["h8", "as", "Long-face Buzz & Beard"], ["h8", "baldClean", "Long-face Shaved Head"],
  ["h9", "clean", "Round-face Buzz"], ["h9", "wavesClean", "Round-face Waves"], ["h7", "cornrowsClean", "Broad-jaw Cornrows"],
  ["h1", "as", "Curls"], ["h1", "stubble", "Curls & Stubble"],
  ["h2", "as", "Quiff"], ["h2", "stubble", "Quiff & Stubble"],
  ["h3", "as", "Buzz & Beard"], ["h3", "clean", "Buzz"], ["h3", "bald", "Shaved & Beard"], ["h3", "baldClean", "Shaved Head"],
  ["h3", "waves", "Waves & Beard"], ["h3", "wavesClean", "Waves"], ["h3", "cornrows", "Cornrows & Beard"], ["h3", "cornrowsClean", "Cornrows"],
  ["h4", "as", "Bun"], ["h4", "stubble", "Bun & Stubble"],
  ["h5", "as", "Fringe"], ["h5", "stubble", "Fringe & Stubble"],
  ["h6", "as", "Crop & Beard"], ["h6", "clean", "Crop"], ["h6", "cleanStubble", "Crop & Stubble"], ["h6", "shaved", "Skin Fade & Beard"],
];
const BUILD_WORD: Record<ToonBody, string> = { c1: "Slim", c2: "Strong", c3: "Tall" };
const EXTRAS: readonly PlayerExtra[] = ["none", "sleeves", "none", "tape", "none", "headband", "none", "snood", "sleevesTape", "none", "tape", "none"];
/** A squad's heritage mix, roughly a Premier League dressing room's (72 slots). */
const SQUAD_HERITAGE: readonly [Heritage, number][] = [["black", 21], ["white", 21], ["mixed", 12], ["mena", 6], ["southAsian", 4], ["latin", 5], ["eastAsian", 3]];

/**
 * 72 player looks: each heritage's share of a squad, each player a style his hair texture suits,
 * spread over the three builds, the heritage's skin range and hair colours, and the usual extras.
 */
export const PLAYER_PRESETS: readonly PeoplePreset[] = (() => {
  const out: PeoplePreset[] = [];
  const seen = new Set<string>();
  const turn = new Map<string, number>();
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  let i = 0;
  for (const [heritage, n] of SQUAD_HERITAGE) {
    const H = HERITAGE[heritage];
    for (let k = 0; k < n; k++, i++) {
      const texture = H.textures[k % H.textures.length];
      const fits = PLAYER_VARIANTS.filter(([h, c, , m]) => styleTextures(h, CUTS[c], m).includes(texture));
      // walk the fitting looks with a stride that visits every one before any repeats (per heritage and texture)
      let stride = Math.max(1, Math.round(fits.length * 0.38));
      while (gcd(stride, fits.length) !== 1) stride++;
      const nth = (turn.get(`${heritage}|${texture}`) ?? 0);
      turn.set(`${heritage}|${texture}`, nth + 1);
      const span = H.skin[1] - H.skin[0] + 1;
      for (let bump = 0; ; bump++) {
        const [head, cut, look, hairMesh] = fits[(nth * stride + SQUAD_HERITAGE.findIndex(([h]) => h === heritage) * 5 + bump) % fits.length];
        const build = (["c1", "c2", "c3"] as const)[(i + k + bump) % 3];
        const skin = H.skin[0] + ((k + Math.floor(k / span) + bump) % span);
        const hair = H.hair[(k * 5 + i) % H.hair.length];
        const name = `${look} · ${BUILD_WORD[build]} · ${SKIN_TONES[skin].label}`;
        if (seen.has(name) && bump < 30) continue;
        seen.add(name);
        out.push({
          id: `ply-${String(i + 1).padStart(2, "0")}`, name, outfit: "kit", roles: ["player"], heritage, texture,
          head, build, skin, hair, grey: 0, cut, hairMesh, age: 20 + ((i * 7) % 14), extra: EXTRAS[(i * 5 + k) % EXTRAS.length],
        });
        break;
      }
    }
  }
  return out;
})();

export const ALL_PRESETS: readonly PeoplePreset[] = [...STAFF_PRESETS, ...PLAYER_PRESETS];
export const presetById = (id: string) => ALL_PRESETS.find((p) => p.id === id);

/** The presets a role draws from. */
export function presetsFor(role: PersonRole): readonly PeoplePreset[] {
  return role === "player" ? PLAYER_PRESETS : STAFF_PRESETS.filter((p) => p.roles.includes(role));
}

// ── The result ──────────────────────────────────────────────────────────────

export interface PersonLookResult {
  id: string;
  role: PersonRole;
  preset: string;
  presetName: string;
  outfit: PresetOutfit;
  head: ToonHead;
  build: ToonBody;
  skin: string;
  skinId: SkinTone;
  /** The hair colour as drawn (grey already mixed in). */
  hairColour: string;
  hairId: HairId;
  grey: number;
  /** The game's hair-style words (playerIdentity.ts HAIR_STYLES): none = bald. */
  hairStyle: HairStyle;
  beard: ManagerBeard;
  age: number;
  cut: HairCut;
  /** A modelled hairstyle worn on top of the head (style3d/toon/hair.ts wearToonHair); none = the head's own hair. */
  hairMesh?: ToonHair;
  /** His face type (style3d/toon/faceShape.ts: nose, lips, eyes, brow, cheekbones, jaw, chin), one of his heritage's, and how strong (0.8 … 1.2). Put on with faceShapeApply.ts applyToonFaceShape. */
  face: ToonFaceId;
  faceK: number;
  /** His own drawn face (the face system, style3d/toon/faceId.ts): the same id, the same face. Put on with applyToonFaceId. */
  faceId: FaceId;
  /** Smart clothes (suit, tracksuit, smart, casual). */
  suit?: { coat: string; trousers: string; shirt: string; tie: string; shoes: string };
  /** Players: the club's home kit. */
  kit?: { shirt: string; trim: string; shorts?: string; socks?: string };
  accessories: { slot: string; color: string }[];
  /** Ready for people3d.ts dressPerson3d (plus a number, badge or name if the scene has them). */
  dress: {
    skin: string; hair: string; grey: number; hairCut: HairCut; hairMesh?: ToonHair; browDark?: number;
    suit?: PersonLookResult["suit"]; kit?: PersonLookResult["kit"]; accessories: { slot: string; color: string }[];
  };
}

export interface PersonLookOptions {
  /** The club: a player's kit, a tracksuit's colours, a club tie, a fan's scarf. */
  club?: string;
  /** A kit to wear instead of the club's home kit. */
  kit?: { shirt: string; trim: string; shorts?: string; socks?: string };
  /** A known manager's broad strokes (managerFace.ts managerLook): his skin, bald or not, beard, grey. */
  known?: ManagerLook;
  /** Another try at the preset (castScene uses it when two people would match). */
  salt?: number;
}

const unit = (id: string, what: string) => hashId(`${id}#${what}`) / 4294967296;

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function nearestSkin(hex: string): number {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  let best = 0, bd = Infinity;
  SKIN_TONES.forEach((t, k) => {
    const d = [0, 1, 2].reduce((s, i) => s + (p(t.hex, i) - p(hex, i)) ** 2, 0);
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}
function nearestHair(hex: string): HairId {
  return (Object.keys(MANAGER_HAIR_COLOURS) as HairId[]).find((k) => MANAGER_HAIR_COLOURS[k] === hex) ?? "brown";
}

/**
 * The skin a toon person is PAINTED in. The game's two lightest tones (Porcelain, Fair) drawn as they
 * are came out near-white under the toon light: the face's shading and lines washed out ("white
 * plastic"). On a toon person they are a touch darker and more peach, so they read as pale skin.
 * The tone itself (skinId, the game's eight) is unchanged.
 */
export function toonSkinHex(index: number): string {
  return index === 0 ? "#eac3a6" : index === 1 ? "#e0ad85" : SKIN_TONES[Math.min(7, Math.max(0, index))].hex;
}
/** How much darker than his hair a man's brows are drawn: grey and fair hair keep brows that read on the face. */
export function toonBrowDark(hair: HairId, grey: number): number {
  const fair = hair === "blond" ? 0.45 : hair === "fair" ? 0.4 : hair === "ginger" ? 0.2 : 0;
  return Math.max(fair, grey > 0.25 ? Math.min(0.6, 0.25 + grey * 0.4) : 0);
}

/** What the beard ends up as, from the head and the cut. */
export function beardOf(head: ToonHead, cut: HairCut): ManagerBeard {
  const modelled = HEAD_BEARD[head];
  if (modelled && cut.beard < 0.5) return modelled;
  return cut.stubble > 0.3 ? "stubble" : "none";
}
/** The game's hair-style word for a head and cut. */
export function hairStyleOf(head: ToonHead, cut: HairCut, hairMesh?: ToonHair): HairStyle {
  if (hairMesh) return TOON_HAIR_INFO[hairMesh].word;
  if (cut.scalp >= 0.9) return "none";
  if (cut.scalp >= 0.5 || cut.pattern || head === "h3" || head === "h7" || head === "h8" || head === "h9") return "buzz";
  if (head === "h4") return "long";
  return "short";
}

/** Does a preset fit a known manager (bald stays bald, a beard stays a beard)? */
function fitsKnown(p: PeoplePreset, k: ManagerLook): boolean {
  const cut = CUTS[p.cut];
  const bald = k.hair === "bald";
  if (bald !== (cut.scalp >= 0.9 && !p.hairMesh)) return false;
  const b = beardOf(p.head, cut);
  if (k.beard === "none" && b !== "none") return false;
  if (k.beard === "stubble" && b !== "stubble") return false;
  if ((k.beard === "short" || k.beard === "full") && (b === "none" || b === "stubble")) return false;
  return true;
}

/**
 * THE LOOK of anyone who isn't you, from a stable id (a name, a squad id, "boss"). The preset is
 * picked by the id's hash from the role's presets; then small per-person touches (a skin tone
 * either side, a hair shade either side, a little more or less grey, stubble now and then, a
 * different tie) so two people on one preset still differ.
 */
export function personLook(id: string, role: PersonRole, opts: PersonLookOptions = {}): PersonLookResult {
  let pool = presetsFor(role);
  if (opts.known) {
    // his heritage first (his skin inside the preset's range), then bald and beard
    // bald and beard first, then his heritage (his skin inside the preset's range); bald fits anyone
    const sk = nearestSkin(opts.known.skin);
    const inRange = (p: PeoplePreset) => HERITAGE[p.heritage].skin[0] <= sk && sk <= HERITAGE[p.heritage].skin[1];
    const fit = pool.filter((p) => fitsKnown(p, opts.known!));
    const both = fit.filter(inRange);
    pool = both.length ? both : opts.known.hair === "bald" && fit.length ? fit : pool.filter(inRange).length ? pool.filter(inRange) : fit.length ? fit : pool;
  }
  const salt = opts.salt ?? 0;
  return presetLook(pool[(hashId(`${id}#preset`) + salt * 7919) % pool.length], id, role, opts);
}

/**
 * One preset worn by one person (personLook's second half). `exact`: the preset as written, with
 * none of the per-person touches (the contact sheet's labelled cards).
 */
export function presetLook(preset: PeoplePreset, id: string, role: PersonRole, opts: PersonLookOptions & { exact?: boolean } = {}): PersonLookResult {
  const known = opts.known;
  const exact = !!opts.exact;

  const H = HERITAGE[preset.heritage];
  // skin: the preset's tone, or one either side inside his heritage's range (a known manager: his own)
  const ds = [-1, 0, 0, 1][hashId(`${id}#skin`) % 4];
  const skinIdx = known ? nearestSkin(known.skin) : exact ? preset.skin : Math.min(H.skin[1], Math.max(H.skin[0], preset.skin + ds));
  const skinTone = SKIN_TONES[skinIdx];

  // hair: the preset's colour, sometimes a shade either side, only ever one of his heritage's colours
  let hairId: HairId = preset.hair;
  if (known) hairId = nearestHair(known.hairColour);
  else if (!exact && hairId !== "ginger" && unit(id, "hairshift") < 0.3) {
    const k = HAIR_ORDER.indexOf(hairId) + (unit(id, "hairdir") < 0.5 ? -1 : 1);
    const next = HAIR_ORDER[Math.min(HAIR_ORDER.length - 1, Math.max(0, k))];
    if (H.hair.includes(next)) hairId = next;
  }
  const grey = known ? known.grey : exact ? preset.grey : Math.min(1, Math.max(0, preset.grey + (unit(id, "grey") - 0.5) * (preset.grey > 0 ? 0.24 : 0.06)));
  const hairColour = mixHex(MANAGER_HAIR_COLOURS[hairId], "#c9c9c9", grey);

  // the haircut: the preset's, with stubble now and then on a clean face (never on a known manager)
  const cut: HairCut = { ...CUTS[preset.cut] };
  // a modelled hairstyle that is all the hair there is (thinning, receding): the head's own scalp hair is painted as skin
  if (preset.hairMesh) cut.scalp = Math.max(cut.scalp, TOON_HAIR_INFO[preset.hairMesh].scalp);
  const bare = beardOf(preset.head, cut) === "none";
  if (!known && !exact && bare && unit(id, "stubble") < 0.2) cut.stubble = 0.55;
  if (cut.stubble > 0 && !exact) cut.stubble = Math.min(0.95, cut.stubble + (unit(id, "stubk") - 0.5) * 0.2);

  // his face: one of his heritage's face types, the same for the same id (the preset's own on a labelled card)
  const fc = exact ? { face: faceFor(preset.id, preset.heritage).face, k: 1 } : faceFor(id, preset.heritage);
  const age = exact ? preset.age : Math.round(preset.age + (unit(id, "age") - 0.5) * 6);
  const kit = opts.kit ?? (opts.club ? kitsOf(opts.club).home : undefined);
  const clubShirt = kit?.shirt ?? TIES.maroon;
  const clubTrim = kit?.trim ?? SHIRTS.white;

  let suit: PersonLookResult["suit"];
  const accessories: { slot: string; color: string }[] = [];
  if (preset.outfit !== "kit") {
    const coat = preset.coat === "club" ? clubShirt : COATS[preset.coat ?? "navy"];
    const shirt = preset.shirt === "trim" ? clubTrim : SHIRTS[preset.shirt ?? "white"];
    // a tie: the preset's, a club tie, or now and then another of the ties
    let tie: string;
    if (preset.tie === "open") tie = shirt;
    else if (preset.tie === "club") tie = preset.outfit === "tracksuit" || preset.outfit === "casual" ? clubTrim : clubShirt;
    else {
      const ties = Object.values(TIES);
      tie = !exact && unit(id, "tie") < 0.35 ? ties[hashId(`${id}#tiepick`) % ties.length] : TIES[preset.tie ?? "maroon"];
    }
    if (preset.outfit === "casual" && preset.tie === "club") tie = clubShirt;
    const trousers = COATS[preset.trousers ?? (preset.coat === "club" || !preset.coat ? "navy" : preset.coat)];
    const shoes = preset.outfit === "tracksuit" || preset.outfit === "casual" ? (unit(id, "shoes") < 0.5 ? "#f2f2ef" : "#141416") : unit(id, "shoes") < 0.8 ? "#141416" : "#4a2e1c";
    suit = { coat, trousers, shirt, tie, shoes };
  } else {
    accessories.push({ slot: "boots", color: BOOTS[hashId(`${id}#boots`) % BOOTS.length] });
    const ex = preset.extra ?? "none";
    const sleeve = kit?.shirt ?? "#141416";
    if (ex === "sleeves" || ex === "sleevesTape") accessories.push({ slot: "arms", color: sleeve });
    if (ex === "tape" || ex === "sleevesTape") accessories.push({ slot: "wrists", color: "#f2f2ef" });
    if (ex === "headband") accessories.push({ slot: "head", color: unit(id, "band") < 0.5 ? "#141416" : "#f2f2ef" });
    if (ex === "snood") accessories.push({ slot: "neck", color: "#141416" });
  }

  const beard = beardOf(preset.head, cut);
  const faceId = faceIdFor(exact ? preset.id : id, preset.heritage, {
    skin: toonSkinHex(skinIdx), hair: hairColour, hairBase: MANAGER_HAIR_COLOURS[hairId], hairId, age, beard, faceType: fc.face, faceK: fc.k, role,
  });

  return {
    faceId,
    id, role, preset: preset.id, presetName: preset.name, outfit: preset.outfit,
    head: preset.head, build: preset.build, skin: toonSkinHex(skinIdx), skinId: skinTone.id,
    hairColour, hairId, grey, hairStyle: hairStyleOf(preset.head, cut, preset.hairMesh), beard: beardOf(preset.head, cut), age, cut, hairMesh: preset.hairMesh, face: fc.face, faceK: fc.k,
    suit, kit: preset.outfit === "kit" ? kit : undefined, accessories,
    dress: { skin: toonSkinHex(skinIdx), hair: hairColour, grey: 0, hairCut: cut, hairMesh: preset.hairMesh, browDark: toonBrowDark(hairId, grey), suit, kit: preset.outfit === "kit" ? kit : undefined, accessories },
  };
}

/** What two people in one picture must not share: the same head in the same coat (or kit). */
export function lookKey(l: PersonLookResult): string {
  return `${l.head}${l.hairMesh ? `:${l.hairMesh}` : ""}|${l.suit?.coat ?? l.kit?.shirt ?? "kit"}`;
}

/**
 * A whole scene's people at once: everyone keeps his own look, except that nobody shares a head
 * and coat (or a preset) with someone earlier in the list; he moves to his next preset until he
 * doesn't. Still the same every time for the same list.
 */
export function castScene(people: readonly { id: string; role: PersonRole; club?: string; known?: ManagerLook }[]): PersonLookResult[] {
  const out: PersonLookResult[] = [];
  const keys = new Set<string>(), presets = new Set<string>();
  for (const p of people) {
    let l = personLook(p.id, p.role, { club: p.club, known: p.known });
    // a kit is shared by a whole team: there only the preset must differ
    const taken = (x: PersonLookResult) => presets.has(x.preset) || (!x.kit && keys.has(lookKey(x)));
    for (let salt = 1; salt < 60 && taken(l); salt++) {
      l = personLook(p.id, p.role, { club: p.club, known: p.known, salt });
    }
    keys.add(lookKey(l)); presets.add(l.preset);
    out.push(l);
  }
  return out;
}

/** Every head the given looks need loaded (for loadPeople3d's head list). */
export const headsOf = (looks: readonly PersonLookResult[]): ToonHead[] => Array.from(new Set(looks.map((l) => l.head)));
