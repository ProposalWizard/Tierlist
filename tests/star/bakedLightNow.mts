import * as T from "three";
import { bakedLightNow } from "../../lib/star/look/bakedLight";
import { installShadowCache } from "../../lib/star/three3d/shadowCache";

/**
 * LAG PASS 3 (9 Oct 2026): the baked light patches a place's materials the
 * moment it is made, before its pictures arrive, so no lit shader is built a
 * second time mid-play. Until the pictures switch it on it must draw exactly
 * as unpatched (uBkOn 0), and a set with no pictures must stay off for good.
 * Also: the shadow cache frees a light's two kept maps when asked (forget).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// no network here: every file "is missing"
(globalThis as any).fetch = async () => ({ ok: false, json: async () => null, blob: async () => null });

{
  const b = bakedLightNow(T, "stadium", "golden");
  check(!!b, "bakedLightNow gives a baked light straight away (no waiting for files)");
  if (b) {
    const g = new T.Group();
    const lit = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
    const flat = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
    g.add(lit, flat);
    b.apply(g);
    const m = lit.material as any;
    check(m.userData.bakeOn === true, "a lit material is patched at once, before any picture loads");
    check((flat.material as any).userData.bakeOn !== true, "an unlit material is left alone");
    check(/-bk[1-9]\d*$/.test(m.customProgramCacheKey()), "the patched shader's key is the bake's (built once, with the bake in)");
    const sh: any = { uniforms: {}, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <aomap_fragment>" };
    m.onBeforeCompile(sh, null);
    check(sh.uniforms.uBkOn?.value === 0, "until its pictures arrive the bake is off (uBkOn 0: the picture is as unpatched)");
    check(/if \(uBkOn > 0\.5\)/.test(sh.fragmentShader), "every baked line sits behind the uBkOn switch");
    await b.ready;
    check(sh.uniforms.uBkOn.value === 0, "a set whose files are missing stays off for good");
    const key = m.customProgramCacheKey();
    b.apply(g);
    check(m.customProgramCacheKey() === key, "patching again changes nothing (no second build)");
    b.dispose();
  }
}

{
  // forget(): a light's kept maps are freed now, and a later frame makes fresh ones
  const sm: any = { enabled: true, autoUpdate: true, needsUpdate: false, type: T.PCFSoftShadowMap, render() {} };
  const r: any = { shadowMap: sm };
  const sc = installShadowCache(T, r);
  const sun = new T.DirectionalLight(); sun.castShadow = true; sun.shadow.mapSize.set(256, 256);
  const scene = new T.Scene(); scene.add(sun);
  const box = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial()); box.castShadow = true; scene.add(box);
  sm.render([sun], scene, new T.PerspectiveCamera());
  const map: any = sun.shadow.map;
  check(!!map, "the cache gave the light its maps");
  let freed = 0;
  const orig = T.WebGLRenderTarget.prototype.dispose;
  T.WebGLRenderTarget.prototype.dispose = function (this: any) { freed++; return orig.call(this); };
  sc.forget(sun);
  T.WebGLRenderTarget.prototype.dispose = orig;
  check(freed === 2, `forget frees both kept maps (freed ${freed})`);
  check(sun.shadow.map === null, "and the light no longer points at a freed map");
  sm.render([sun], scene, new T.PerspectiveCamera());
  check(!!sun.shadow.map && sun.shadow.map !== map, "the next shadow frame makes fresh maps");
}

{
  // TEXTURE PACK SWITCH (14 Oct 2026, Harry: "all the players were black" in Light and Bright).
  // The 3D match builds a new look (and a new baked light) on a pack switch; the men stay.
  // The new light must take the men's materials over cleanly: wrapped once, one set of bake
  // lines in the shader (two failed to compile: black men), its own uniforms, a new program key.
  const man = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const m = man.material as any;
  const compile = () => {
    const sh: any = { uniforms: {}, vertexShader: "#include <common>\n#include <project_vertex>", fragmentShader: "#include <common>\n#include <aomap_fragment>" };
    m.onBeforeCompile(sh, null);
    return sh;
  };
  const count = (s: string, w: string) => s.split(w).length - 1;
  const a = bakedLightNow(T, "stadium", "day")!;
  a.apply(man);
  const keyA = m.customProgramCacheKey();
  const onBefore = m.onBeforeCompile;
  a.dispose();
  check(m.userData.bakeOn === false, "the old light's dispose switches its bake off");
  for (const pack of ["bright", "light", "real"]) {
    const b = bakedLightNow(T, "stadium", "day")!;
    b.apply(man);
    const sh = compile();
    const decl = count(sh.fragmentShader, "uniform highp sampler3D uBkVol");
    check(m.onBeforeCompile === onBefore, `${pack}: the man's material is wrapped once, not again by each new light`);
    check(decl === 1, `${pack}: one bake declaration in the shader (found ${decl})`);
    check(count(sh.fragmentShader, "if (uBkOn > 0.5)") === 1, `${pack}: one bake block in the shader`);
    check(count(sh.vertexShader, "vBkW = ") === 1, `${pack}: one bake block in the vertex shader`);
    check(sh.uniforms.uBkOn === m.userData.bakeU.uBkOn, `${pack}: the shader reads the NEW light's uniforms`);
    check(m.customProgramCacheKey() !== keyA, `${pack}: a new program key (the old program's uniforms are the old light's)`);
    // an older light disposed late leaves the new one's bake on
    a.dispose();
    check(m.userData.bakeOn === true && compile().uniforms.uBkOn === m.userData.bakeU.uBkOn, `${pack}: disposing an older light again leaves the new bake alone`);
    b.dispose();
  }
}

if (problems.length) { console.error(`bakedLightNow: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("bakedLightNow: all checks passed");
