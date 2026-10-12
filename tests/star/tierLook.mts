import * as T0 from "three";
import { gradeToneMapping, vignetteCells } from "../../lib/star/style3d/real/post";
import { gradeSlot, gradeExposure, slotGrade, gradeToneMapGlsl, GRADE_SLOTS } from "../../lib/star/style3d/real/toneGrade";
import { tierLook, setTierLook, TIER_LOOK_DEFAULT } from "../../lib/star/three3d/tierLook";

/**
 * 3D QUALITY LOOK (12 Oct 2026): Medium and Low buy High's look back cheaply.
 * Low's colour grade lives in three's CustomToneMapping (no extra pass): it must
 * replace only the empty stub, once, keep ACES under it, and the switch must
 * default to New and remember Old.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// a copy of three's chunks (the real module namespace is frozen)
const T: any = { ...T0, ShaderChunk: { ...T0.ShaderChunk } };
const before: string = T.ShaderChunk.tonemapping_pars_fragment;
check(before.includes("vec3 CustomToneMapping( vec3 color ) { return color; }"), "three's stub is where we expect it (three updated?)");
const tm = gradeToneMapping(T);
const after: string = T.ShaderChunk.tonemapping_pars_fragment;
check(tm === T0.CustomToneMapping, "the grade is used through CustomToneMapping");
check(!after.includes("{ return color; }"), "the stub is replaced");
check(after.includes("ACESFilmicToneMapping( color );"), "the grade sits on three's own ACES");
gradeToneMapping(T);
check(T.ShaderChunk.tonemapping_pars_fragment === after, "installing twice changes nothing");
check(after.split("vec3 ACESFilmicToneMapping").length === before.split("vec3 ACESFilmicToneMapping").length, "ACES itself untouched");

// round 2: the grade follows the place and the time of day (a slot carried on the exposure)
const slots = new Set<number>();
for (const tod of ["day", "golden", "night"] as const) { slots.add(gradeSlot("stadium", tod)); slots.add(gradeSlot("enhance", tod)); }
slots.add(gradeSlot("enhance", "indoor"));
check(slots.size === 7 && !slots.has(0) && Math.max(...slots) < GRADE_SLOTS, "seven distinct slots, none is round 1's fixed grade");
for (const s of slots) {
  const e = gradeExposure(0.95, s), k = Math.floor(e / 16 + 1e-4);
  check(k === s && Math.abs(e - k * 16 - 0.95) < 1e-9, `slot ${s} and the exposure come back out of the tone map's one number`);
}
const night = slotGrade(gradeSlot("stadium", "night"))!, golden = slotGrade(gradeSlot("stadium", "golden"))!;
check(night.tint[2] > night.tint[0] && golden.tint[0] > golden.tint[2], "night grades cool, golden hour warm (round 1 was warm at night)");
check(night.lut === "night" && golden.lut === "golden" && slotGrade(gradeSlot("enhance", "indoor"))!.lut === null, "each outdoor slot carries its own LUT; indoors none");
const glsl = gradeToneMapGlsl();
check(glsl.includes(`HG_TINT[${GRADE_SLOTS}]`) && !glsl.includes("texture"), "the grade reads no texture");
check(!/NaN|Infinity/.test(glsl), "no broken numbers in the shader");
// the vignette leaves the middle of the screen untouched
const cells = vignetteCells(0.3);
check(cells.length > 0 && cells.length < 144 && !cells.includes(6 * 12 + 6), "the vignette ring skips the centre");

// the switch
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
check(TIER_LOOK_DEFAULT === "new" && tierLook() === "new", "New by default");
setTierLook("old");
check(tierLook() === "old" && store.get("star-3d-tier-look") === "old", "Old is remembered on this phone");

if (problems.length) { console.error("tierLook FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`tierLook: grade tone map installs once; ${slots.size} place/time slots; vignette ring ${cells.length}/144 cells at 0.3; switch New by default, Old remembered`);
