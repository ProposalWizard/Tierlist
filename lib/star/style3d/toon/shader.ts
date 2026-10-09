/**
 * STYLE A — the toon body material (Harry, 9 Oct 2026: picked 7/10, "SOOOO
 * much better than realistic"). The Blender recipe (tools/styletest/render.py,
 * option A) brought to the phone, on the scene's OWN lights (no new lights),
 * under the scene's own post and LUT:
 *
 *   - stepped light: each light's N·L becomes 3 bands (shadow side, a warm
 *     mid band, a warm lit band), so form reads as flat painted shapes;
 *   - the shadow side's sky/ambient light a touch cooler (Style A's purple shadow);
 *   - a warm rim on the lit edge (golden hour);
 *   - the ink outline is the body's inverted hull (people3d.ts outlineMaterial,
 *     one extra draw of the same mesh: cheaper on a phone than a full-screen
 *     edge pass, which needs a depth/normal pass of the whole scene);
 *   - a textured, recolourable kit: the body's texture keeps the cloth's own
 *     folds as grey, a mask texture says kit / skin / hair; the shirt, shorts,
 *     socks and boots take the club's colours by rest-pose height; the trim
 *     colours the collar, cuffs, shorts hem and sock tops; the number on the
 *     back; a badge on the chest (a crest picture if given, else a shield in
 *     the club's colours);
 *   - managers and staff: the same body in a suit (coat and trousers, white
 *     shirt, tie, black shoes), never a kit.
 *
 * The body shader's own uniforms (people3d.ts FRAG_HEAD) are shared, so
 * dressPerson3d paints a toon body exactly as any other 3D person.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** The three bands, on N·L (0..1). Shared with tests (tests/star/toonPeople.mts). */
export const TOON_BANDS = { shadowBelow: 0.08, midBelow: 0.42, mid: [0.62, 0.55, 0.5] as const, lit: [1.06, 1.0, 0.9] as const };

/** What one light's N·L becomes (the GLSL below does the same). */
/** The soft look (Harry, 9 Oct: "no dark band across the face"): two bands with a soft edge. */
export const TOON_SOFT = { low: [0.42, 0.38, 0.44] as const, lit: [1.04, 0.98, 0.9] as const, edge: [0.1, 0.32] as const };

export function toonBand(dotNL: number): readonly [number, number, number] {
  if (dotNL < TOON_BANDS.shadowBelow) return [0, 0, 0];
  if (dotNL < TOON_BANDS.midBelow) return TOON_BANDS.mid;
  return TOON_BANDS.lit;
}

const v3 = (a: readonly number[]) => `vec3(${a.map((x) => x.toFixed(3)).join(", ")})`;

const TOON_HEAD = `
uniform sampler2D uMask;
uniform float uSuit;
uniform vec3 uSuitCoat, uSuitTrousers, uSuitShirt, uSuitTie, uShoes;
uniform vec4 uKit2;       // collar y, shorts low y, sleeve t, -
uniform sampler2D uBadge;
uniform float uBadgeOn;   // 0 none, 1 shield, 2 picture
uniform vec4 uShade;      // soft bands (0/1), face lift, hair sheen (0/1), -
float tnLitEdge = 0.0;
float tnFace = 0.0;       // this point is face skin (set before the lights)
vec3 toonStep(float d) {
  if (uShade.x > 0.5) {
    // two soft bands: the shade side stays warm and readable, never a hard dark stripe
    float dd = clamp(d + tnFace * uShade.y, 0.0, 1.0);
    return mix(${v3(TOON_SOFT.low)}, ${v3(TOON_SOFT.lit)}, smoothstep(${TOON_SOFT.edge[0].toFixed(3)}, ${TOON_SOFT.edge[1].toFixed(3)}, dd));
  }
  return d < ${TOON_BANDS.shadowBelow.toFixed(3)} ? vec3(0.0) : d < ${TOON_BANDS.midBelow.toFixed(3)} ? ${v3(TOON_BANDS.mid)} : ${v3(TOON_BANDS.lit)};
}`;

/** After map_fragment: the kit, skin, hair, suit, number and badge. Then the
 *  accessories (people3d.ts's own, appended by patchToonBody). */
const TOON_BODY = `
{
  vec3 r = vRest;
  vec3 c = diffuseColor.rgb;
  vec3 mk = texture2D(uMask, vMapUv).rgb;
  float kit = mk.r, skin = mk.g, hairM = mk.b;
  float lum = max(c.r, max(c.g, c.b));
  float shade = clamp(pow(max(c.g, 1e-4), 1.0 / 2.2) / 0.7, 0.25, 1.4);
  float head = smoothstep(uFaceF.x - 0.045, uFaceF.x - 0.025, r.y);
  vec3 col = c;
  col = mix(col, min(c * uSkinK, vec3(1.0)), skin);
  col = mix(col, min(uHairK * (dot(c, vec3(0.2126, 0.7152, 0.0722)) / uHairL), vec3(1.0)), hairM);
  tnFace = skin * head * smoothstep(0.1, 0.5, vRestN.z);
  if (uShade.z > 0.5) {
    // stylised hair: one flat colour (the sculpted strands smoothed away) and a painted sheen band
    float sheen = smoothstep(0.25, 0.4, vRestN.y) * (1.0 - smoothstep(0.62, 0.78, vRestN.y));
    vec3 flat_ = uHairK * mix(0.85, 1.0, smoothstep(0.0, 0.6, vRestN.y));
    col = mix(col, min(flat_ * (1.0 + 0.9 * sheen) + sheen * 0.04, vec3(1.0)), hairM);
  }

  float shirtW = step(uLines.x, r.y);
  float bootW = 1.0 - step(uLines.z, r.y);
  float shortsW = step(uLines.y, r.y) * (1.0 - shirtW);
  float socksW = max(0.0, 1.0 - shirtW - shortsW - bootW);
  bool tL = r.x > 0.0;
  vec3 tS = tL ? uShL : uShR; vec3 tE = tL ? uElL : uElR;
  float tTu = p3SegT(r, tS, tE);
  float onArm = step(0.12, abs(r.x)) * step(p3SegD(r, tS, tE, 0.0, 1.0), 0.11) * step(0.05, tTu);
  vec3 part;
  if (uSuit > 0.5) {
    part = uSuitCoat * shirtW + uSuitTrousers * (shortsW + socksW) + uShoes * bootW;
    // the white shirt and tie in the coat's V, front only
    float v = shirtW * step(0.0, r.z) * step(abs(r.x), (r.y - (uKit2.x - 0.24)) * 0.38) * step(r.y, uKit2.x + 0.02);
    vec3 sh = mix(uSuitShirt, uSuitTie, step(abs(r.x), 0.014) * step(r.y, uKit2.x - 0.03));
    part = mix(part, sh, v);
    // long sleeves and trousers over what is bare skin in the kit
    vec3 tW = tL ? uWrL : uWrR;
    float onFore = step(0.12, abs(r.x)) * step(p3SegD(r, tE, tW, 0.0, 1.0), 0.09);
    float sleeve = skin * max(onArm, onFore) * (1.0 - head);
    float hand = step(0.97, p3SegT(r, tE, tW));
    col = mix(col, uSuitCoat * shade, sleeve * (1.0 - hand));
    col = mix(col, uSuitTrousers * shade, skin * step(r.y, uLines.x) * step(uLines.z, r.y) * step(abs(r.x), 0.3) * (1.0 - onArm));
  } else {
    part = uShirt * shirtW + uShorts * shortsW + uSocks * socksW + uBoots * bootW;
    // trims: collar, cuffs, shorts hem, sock tops
    float trim = shirtW * step(uKit2.x - 0.022, r.y) * step(abs(r.x), 0.12);
    trim = max(trim, shirtW * onArm * step(uKit2.z - 0.07, tTu));
    trim = max(trim, shortsW * step(r.y, uKit2.y + 0.022));
    trim = max(trim, socksW * step(uLines.y - 0.03, r.y));
    part = mix(part, uTrim, trim);
    if (uNumOn > 0.5 && shirtW > 0.5 && vRestN.z < -0.25 && r.z < 0.0) {
      vec2 nuv = vec2(0.5 - (r.x - uNumBox.x) / uNumBox.z, (r.y - uNumBox.y) / uNumBox.w + 0.5);
      if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) part = mix(part, uTrim, texture2D(uNum, nuv).a);
    }
    // the badge, his left chest
    if (uBadgeOn > 0.5 && shirtW > 0.5 && vRestN.z > 0.2 && r.z > 0.0) {
      vec2 b = vec2((r.x - 0.085) / 0.07 + 0.5, (uKit2.x - 0.1 - r.y) / 0.08 + 0.5);
      if (b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 1.0) {
        if (uBadgeOn > 1.5) {
          vec4 bt = texture2D(uBadge, vec2(b.x, 1.0 - b.y));
          part = mix(part, bt.rgb, bt.a);
        } else {
          float u = abs(b.x - 0.5) * 2.0;
          float w = b.y < 0.55 ? 1.0 : sqrt(max(0.0, 1.0 - (b.y - 0.55) / 0.45));
          float inS = step(u, w * 0.92) * step(0.04, b.y);
          float inner = step(u, w * 0.62) * step(0.2, b.y) * step(b.y, 0.86);
          vec3 fill = mix(uTrim, uShirt * 0.55 + uTrim * 0.45, step(0.5, fract((b.x + b.y) * 3.0)));
          part = mix(part, mix(uTrim, fill, inner), inS);
        }
      }
    }
  }
  col = mix(col, part * shade, kit);

  if (uFaceOn > 0.5) {
    vec2 fp = vec2(uFaceA.x + r.x * uFaceA.z, uFaceA.y - (r.y - uFaceF.y) * uFaceA.w);
    vec2 e = (fp - uFaceO.xy) / uFaceO.zw;
    float oval = 1.0 - smoothstep(0.7, 1.0, length(e));
    float facing = smoothstep(0.15, 0.5, vRestN.z) * step(uFaceF.w - 0.11, r.z);
    float inside = step(0.0, fp.x) * step(fp.x, 1.0) * step(0.0, fp.y) * step(fp.y, 1.0);
    vec4 ph = texture2D(uFaceTex, vec2(fp.x, 1.0 - fp.y));
    p3Face = oval * facing * inside * ph.a;
    col = mix(col, ph.rgb * uFaceK, p3Face);
  }
`;

/** Uniforms a toon body adds to people3d's own. */
export function toonUniforms(T: Three, mask: THREE.Texture, kit: { collarY?: number; shortsLoY?: number; sleeveT?: number }, neckY: number) {
  const blank = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  blank.needsUpdate = true;
  return {
    uMask: { value: mask },
    uSuit: { value: 0 },
    uSuitCoat: { value: new T.Color("#1f2533") }, uSuitTrousers: { value: new T.Color("#232733") },
    uSuitShirt: { value: new T.Color("#eef0f2") }, uSuitTie: { value: new T.Color("#7a1d2b") }, uShoes: { value: new T.Color("#141416") },
    uKit2: { value: new T.Vector4(kit.collarY ?? neckY - 0.03, kit.shortsLoY ?? 0.65, kit.sleeveT ?? 0.75, 0) },
    uBadge: { value: blank as THREE.Texture }, uBadgeOn: { value: 1 },
    uShade: { value: new T.Vector4(0, 0.35, 0, 0) },
  };
}

/**
 * Turn a body's MeshStandardMaterial into Style A. `head` and `accessories`
 * are people3d.ts's own shader pieces (its uniforms, and the arm/head
 * accessories), passed in so this file never imports people3d.
 */
export function patchToonBody(T: Three, mat: THREE.MeshStandardMaterial, u: Record<string, { value: unknown }>, head: string, accessories: string) {
  mat.metalness = 0;
  mat.roughness = 0.9;
  mat.envMapIntensity = 0.8;
  const lightsPars = (T.ShaderChunk as Record<string, string>).lights_physical_pars_fragment
    .replace("vec3 irradiance = dotNL * directLight.color;", "vec3 irradiance = toonStep(dotNL) * directLight.color;\n\ttnLitEdge = max(tnLitEdge, step(0.42, dotNL) * dot(directLight.color, vec3(0.33)));")
    // The highlight keeps the real light falloff. With the cel band's light (full even at a grazing
    // angle) the GGX term, which divides by the light's angle, blew up to single white pixels along
    // the silhouette that the bloom turned into glowing squares (Harry, 9 Oct 2026).
    .replace("reflectedLight.directSpecular += irradiance * BRDF_GGX(", "reflectedLight.directSpecular += (dotNL * directLight.color) * BRDF_GGX(");
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>${head}${TOON_HEAD}`)
      .replace("#include <map_fragment>", `#include <map_fragment>${TOON_BODY}${accessories}`)
      .replace("#include <lights_physical_pars_fragment>", lightsPars)
      // the shadow side: sky light a touch cooler (Style A's purple shadows)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= vec3(0.9, 0.9, 1.06);")
      .replace("#include <opaque_fragment>", `{
  // a warm rim on the lit edge (golden hour)
  float tnF = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
  float tnRim = step(0.72, tnF) * step(0.05, tnLitEdge);
  // capped: a bright lamp close by (the shop's spots) made the rim burn white through the bloom
  outgoingLight += tnRim * 0.35 * vec3(1.0, 0.75, 0.45) * diffuseColor.rgb * clamp(tnLitEdge, 0.5, 1.2);
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => "people3d-toon-v3";
}
