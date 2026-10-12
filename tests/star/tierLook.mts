import * as T0 from "three";
import { gradeToneMapping } from "../../lib/star/style3d/real/post";
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

// the switch
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
check(TIER_LOOK_DEFAULT === "new" && tierLook() === "new", "New by default");
setTierLook("old");
check(tierLook() === "old" && store.get("star-3d-tier-look") === "old", "Old is remembered on this phone");

if (problems.length) { console.error("tierLook FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("tierLook: grade tone map installs once on ACES; switch New by default, Old remembered");
