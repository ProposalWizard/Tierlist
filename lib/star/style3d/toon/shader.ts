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
uniform sampler2D uName;
uniform float uNameOn;
uniform vec4 uNameBox;    // the name on the back: centre x, centre y, width, height
uniform vec4 uFrontNum;   // the small number on his right chest: x, y, size, on
uniform vec4 uPattern;    // kind (0 plain, 1 stripes, 2 hoops, 3 halves, 4 sleeves), stripe width, -, -
uniform vec3 uPat2;       // the pattern's second colour
uniform vec4 uCloth;      // weave strength, seam darkness, skin shade (long sleeves over skin), -
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
  // below the chin every point is kit, skin or hair: a soft mask edge (the collar, the cuffs) is
  // shared out between them, so the model's own baked colour never shows as a thin line
  float mTot = kit + skin + hairM;
  if (r.y < uFaceF.x - 0.02 && mTot > 0.05 && mTot < 1.0) { kit /= mTot; skin /= mTot; hairM /= mTot; }
  // and a torso point the mask missed altogether is cloth (the model's own red shirt showed through)
  else if (mTot <= 0.05 && r.y < uKit2.x + 0.035 && abs(r.x) < 0.3 && r.y > uLines.y) kit = 1.0;
  // the generated model's own red shirt, where the mask calls it skin (a few texels at the collar and
  // the hem: the thin red line): far redder than any skin (skin's red is under 3× its green)
  if ((r.y < uFaceF.x - 0.02 || (r.y < uFaceF.x + 0.03 && r.z < uNeck.z)) && c.r > 5.0 * c.g && c.r > 4.0 * c.b && c.r > 0.06) { kit = 1.0; skin = 0.0; hairM = 0.0; }
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
    // (everything on the arm that is not kit, wide round the elbow, so no skin shows there; the skin's
    // own shading brought to the cloth's, so the forearms are not a shade darker than the top)
    float onFore = step(0.12, abs(r.x)) * step(p3SegD(r, tE, tW, 0.0, 1.0), 0.11);
    float onElbow = step(0.12, abs(r.x)) * step(length(r - tE), 0.13);
    float onUp = step(0.12, abs(r.x)) * step(p3SegD(r, tS, tE, 0.0, 1.0), 0.13) * step(0.05, tTu);
    float sleeve = (1.0 - kit) * (1.0 - hairM) * max(max(onUp, onFore), onElbow) * (1.0 - head);
    float hand = step(0.97, p3SegT(r, tE, tW));
    float skinShade = clamp(shade / uCloth.z, 0.7, 1.2);
    col = mix(col, uSuitCoat * skinShade, sleeve * (1.0 - hand));
    // the legs are all trousers (a soft mask edge at the knee or sock top left a skin-coloured band)
    float legs = step(r.y, uLines.x) * step(uLines.z, r.y) * step(abs(r.x), 0.3) * (1.0 - onArm) * (1.0 - max(onFore, onElbow));
    col = mix(col, uSuitTrousers * skinShade, (1.0 - kit) * legs);
    kit = max(kit, legs);
  } else {
    // the shirt's own pattern (kitPattern.ts): stripes and halves on the body, hoops all over, contrast sleeves
    vec3 shirtC = uShirt;
    float pk = uPattern.x;
    if (pk > 0.5) {
      float sw = uPattern.y;
      float pat = 0.0;
      if (pk < 1.5) pat = (1.0 - onArm) * step(0.5, fract(abs(r.x) / sw));
      else if (pk < 2.5) pat = step(0.5, fract((uKit2.x - r.y) / sw));
      else if (pk < 3.5) pat = step(0.0, r.x) * (1.0 - onArm) + onArm * step(0.0, -r.x);
      else pat = max(onArm, step(0.17, abs(r.x)) * step(p3SegD(r, tS, tE, -0.3, 1.0), 0.12));
      // a plain panel behind the name and number on the back (as striped and hooped shirts have)
      float pTop = uNameOn > 0.5 ? uNameBox.y + uNameBox.w * 0.6 : uNumBox.y + uNumBox.w * 0.34;
      float panel = (uNumOn > 0.5 && r.z < 0.0 && vRestN.z < -0.25) ? step(abs(r.x), uNumBox.z * 0.42) * step(uNumBox.y - uNumBox.w * 0.36, r.y) * step(r.y, pTop) : 0.0;
      shirtC = mix(uShirt, uPat2, pat * (1.0 - panel));
    }
    part = shirtC * shirtW + uShorts * shortsW + uSocks * socksW + uBoots * bootW;
    // trims: a ring collar round the neck, cuffs (a band and a thin line above it), shorts hem, sock tops
    float nr = length(r.xz - uNeck.xz);
    float trim = shirtW * (1.0 - onArm) * step(uKit2.x - 0.02, r.y) * step(nr, 0.12);
    trim = max(trim, shirtW * onArm * step(uKit2.z - 0.055, tTu));
    trim = max(trim, shirtW * onArm * step(uKit2.z - 0.105, tTu) * step(tTu, uKit2.z - 0.085));
    trim = max(trim, shortsW * step(r.y, uKit2.y + 0.022));
    trim = max(trim, socksW * step(uLines.y - 0.03, r.y));
    // the shorts' side stripe: down the outside of each leg
    float outS = (r.x > 0.0 ? vRestN.x : -vRestN.x);
    trim = max(trim, shortsW * smoothstep(0.78, 0.86, outS) * step(abs(r.x), 0.3));
    part = mix(part, uTrim, trim);
    // the cloth: a fine weave (fading out where it would shimmer) and stitched seams
    vec2 wv = vec2(r.x + r.z, r.y) * 420.0;
    float fw = max(fwidth(wv.x), fwidth(wv.y));
    float weave = (sin(wv.x) * sin(wv.y) + 0.5 * sin((wv.x + wv.y) * 0.5)) * (1.0 - smoothstep(0.45, 1.1, fw));
    float seam = 0.0;
    // side seams of the shirt, from the armpit down
    seam = max(seam, shirtW * (1.0 - onArm) * (1.0 - smoothstep(0.035, 0.07, abs(vRestN.z))) * step(0.5, abs(vRestN.x)) * step(r.y, uShL.y - 0.08));
    // over each shoulder, neck to sleeve
    seam = max(seam, shirtW * (1.0 - onArm) * step(abs(r.z - uShL.z - 0.01), 0.006) * step(0.45, vRestN.y) * step(0.1, abs(r.x)));
    // where the sleeve joins the body
    seam = max(seam, shirtW * onArm * step(abs(tTu - 0.16), 0.012));
    // the shirt's hem and the shorts' waistband
    seam = max(seam, shirtW * step(r.y, uLines.x + 0.018) * step(uLines.x + 0.012, r.y));
    seam = max(seam, shortsW * step(uLines.x - 0.03, r.y) * step(r.y, uLines.x - 0.024));
    float clothK = (1.0 + uCloth.x * weave * (shirtW + shortsW)) * (1.0 - uCloth.y * seam);
    part *= clothK;
    if (uNumOn > 0.5 && shirtW > 0.5 && vRestN.z < -0.25 && r.z < 0.0) {
      // the number between the shoulder blades, the name arched above it
      vec2 nuv = vec2(0.5 - (r.x - uNumBox.x) / uNumBox.z, (r.y - uNumBox.y) / uNumBox.w + 0.5);
      if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) part = mix(part, uTrim, texture2D(uNum, nuv).a);
      if (uNameOn > 0.5) {
        vec2 mu = vec2(0.5 - (r.x - uNameBox.x) / uNameBox.z, (r.y - uNameBox.y) / uNameBox.w + 0.5);
        if (mu.x > 0.0 && mu.x < 1.0 && mu.y > 0.0 && mu.y < 1.0) part = mix(part, uTrim, texture2D(uName, mu).a);
      }
    }
    // a small number on his right chest (the badge is on his left)
    if (uNumOn > 0.5 && uFrontNum.w > 0.5 && shirtW > 0.5 && vRestN.z > 0.2 && r.z > 0.0) {
      vec2 fu = vec2(0.5 + (r.x - uFrontNum.x) / uFrontNum.z, (r.y - uFrontNum.y) / uFrontNum.z + 0.5);
      if (fu.x > 0.0 && fu.x < 1.0 && fu.y > 0.0 && fu.y < 1.0) part = mix(part, uTrim, texture2D(uNum, fu).a);
    }
    // the badge, his left chest
    if (uBadgeOn > 0.5 && shirtW > 0.5 && vRestN.z > 0.2 && r.z > 0.0) {
      vec2 b = vec2((r.x - 0.085) / 0.07 + 0.5, (uFrontNum.y - r.y) / 0.08 + 0.5);
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
  // a suit's or casual set's trousers over a kit body's white shorts: no brighter than the cloth
  float partShade = (uSuit > 0.5 && shirtW < 0.5) ? min(shade, 1.0) : shade;
  col = mix(col, part * partShade, kit);

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

/** The cloth: weave strength (± share of the colour) and how much darker a stitched seam is. */
export const TOON_CLOTH = { weave: 0.04, seam: 0.3 } as const;

/**
 * Where the shirt's lettering goes on a Style A body, from that head's own
 * bones and kit lines (rest pose, metres), so it is right for every head and
 * build (a build is a scale of the whole person, so the rest-pose spot holds).
 *   number: centred between the shoulder blades, its middle 0.17 m under the shoulder joints
 *   name:   arched above it, just under the collar
 *   front:  a small number on his right chest, level with the badge
 */
export function toonShirtLayout(m: { shoulderY: number; collarY: number }) {
  return {
    number: { x: 0, y: m.shoulderY - 0.17, size: 0.27 },
    name: { x: 0, y: m.shoulderY - 0.035, w: 0.3, h: 0.075 },
    front: { x: -0.085, y: m.collarY - 0.1, size: 0.075 },
  };
}

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
    uName: { value: blank as THREE.Texture }, uNameOn: { value: 0 },
    uNameBox: { value: new T.Vector4(0, 1.37, 0.3, 0.075) },
    uFrontNum: { value: new T.Vector4(-0.085, (kit.collarY ?? neckY - 0.03) - 0.1, 0.075, 1) },
    uPattern: { value: new T.Vector4(0, 0.1, 0, 0) }, uPat2: { value: new T.Color(1, 1, 1) },
    uCloth: { value: new T.Vector4(TOON_CLOTH.weave, TOON_CLOTH.seam, 0.7, 0) },
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
  mat.customProgramCacheKey = () => "people3d-toon-v4";
}
