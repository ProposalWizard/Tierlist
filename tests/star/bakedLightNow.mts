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
    check(/-bk1$/.test(m.customProgramCacheKey()), "the patched shader's key is the bake's (built once, with the bake in)");
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

if (problems.length) { console.error(`bakedLightNow: ${problems.length} problem(s)\n - ` + problems.join("\n - ")); process.exit(1); }
console.log("bakedLightNow: all checks passed");
