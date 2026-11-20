/**
 * THE DRAWN FACE (the face system, faceId.ts): GLSL pieces the Style A body shader (shader.ts)
 * compiles in for a person with a FaceId (`#define TOON_FACEID`, set by faceIdApply.ts). Everyone
 * else's shader is exactly as before and pays nothing.
 *
 * Harry on the mock-ups (20 Nov 2026): the features must sit IN the face, the skin tone must be
 * even, beards must read as hair. So:
 *   - THE CANVAS (FI_CANVAS): on the front of the head the file's own painted eyes, brows, lips
 *     and beard are painted out and the skin is the picked tone, evenly: only a little of the
 *     file's own light and dark is kept (most of it round the nose), none of its dark patches;
 *   - THE FEATURES (FI_DRAW) are worked out per pixel from where the point sits on the head's
 *     own surface (rest pose, the measured spots), so they follow the surface and are lit by the
 *     scene's own light with the rest of the skin; each has the shading that seats it: a socket's
 *     shade, the lid's shadow on the eyeball, a fold over the lid, a soft edge and a shade under
 *     the lips, shade down the sides of the nose;
 *   - facial hair is a soft-edged field that follows the jaw (round the head, not across the
 *     picture), its edge broken into hairs, stubble as fine dots; from far it is an even tint;
 *   - fine detail (freckles, hairs, folds) fades out as the face gets small on screen, so a far
 *     face is clean and cheap.
 */

/** Uniforms and helpers (after TOON_HEAD). */
export const FI_HEAD = /* glsl */ `
#ifdef TOON_FACEID
uniform vec4 uFiLm1;   // the face's middle x, each eye's distance from it, eye y, brow y
uniform vec4 uFiLm2;   // nose tip y, nose tip z, mouth line y, chin y
uniform vec4 uFiLm3;   // mouth half width (the head's own), the head's middle z, the file has a painted beard (0/1), detail (1 full … 0 none)
uniform vec4 uFiEye;   // half width, up, low, tilt
uniform vec4 uFiEye2;  // gap, dy, iris radius, crease
uniform vec4 uFiEye3;  // hood, socket, lash, under-eye
uniform vec4 uFiEye4;  // how round the opening is (0 flat-topped … 1 round), the inner corner dropped (0..1), -, -
uniform vec4 uFiBrowA; // height, thickness, arch, tilt
uniform vec4 uFiBrowB; // length, gap, taper, peak
uniform vec4 uFiMouth; // half width, upper lip, lower lip, lip tone
uniform vec4 uFiMarks; // freckles, age, blush, mole (0/1)
uniform vec4 uFiMole;  // mole x, mole y, mouth dy, brow density
uniform vec4 uFiBeard; // cheeks, chin, moustache, density
uniform vec4 uFiBeard2; // cheek line, strap, soul patch, length
uniform vec3 uFiIris, uFiLip, uFiBrowC;
uniform vec4 uFiExA;   // upper lid (1 open), lower lid up, gaze x, gaze y
uniform vec4 uFiExB;   // brows up, sad, angry, one brow up
uniform vec4 uFiExC;   // smile, open, wide, smirk
uniform vec4 uFiExD;   // teeth, press, tear, blink
float fiHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fiNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fiHash(i), fiHash(i + vec2(1.0, 0.0)), f.x), mix(fiHash(i + vec2(0.0, 1.0)), fiHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fiBell(float d, float s) { return exp(-(d * d) / (s * s)); }
#define TN_BEARD_OFF 0.0
#define TN_STUBBLE 0.0
#else
#define TN_BEARD_OFF uHairCut.y
#define TN_STUBBLE uHairCut.z
#endif
`;

/** Before the skin is painted: the canvas. Sets fiSkinC, fiCan; edits hairM, skin, kit. */
export const FI_CANVAS = /* glsl */ `
  float fiX = r.x - uFiLm1.x, fiAx = abs(fiX);
  float fiEyeY = uFiLm1.z, fiBrowY = uFiLm1.w, fiNoseY = uFiLm2.x, fiNoseZ = uFiLm2.y, fiChinY = uFiLm2.w, fiZb = uFiLm3.y, fiZc = uFiLm3.y - 0.02;
  float fiMouthY = uFiLm2.z + uFiMole.z;
  float fiAA = max(max(fwidth(r.x), fwidth(r.y)) * 0.75, 0.00004);
  // fine detail fades as the face gets small on screen (and with the quality asked for)
  float fiDet = uFiLm3.w * (1.0 - smoothstep(0.0004, 0.0011, fiAA));
  float fiFront = head * smoothstep(fiZc, fiZc + 0.03, r.z);
  // the file's own brows (hair in the mask) and, on a head painted with a beard, that beard: skin now
  float fiBrowBand = step(fiEyeY - 0.03, r.y) * (1.0 - smoothstep(fiBrowY + 0.012, fiBrowY + 0.02, r.y)) * step(fiAx, 0.09) * step(fiNoseZ - 0.085, r.z);
  // (the sideburn that is left ends on a slant, not a square stump)
  float fiLowFace = (1.0 - smoothstep(fiEyeY - 0.024, fiEyeY - 0.012, r.y - max(r.z - fiZc, 0.0) * 0.5)) * uFiLm3.z;
  float fiKill = head * max(fiBrowBand * step(fiZc - 0.02, r.z), fiLowFace * step(fiZb - 0.075, r.z));
  float fiWasHair = hairM * fiKill;
  hairM *= 1.0 - fiKill;
  float fiCan = max(fiFront * (1.0 - smoothstep(0.3, 0.7, hairM)), smoothstep(0.2, 0.6, fiWasHair));
  // the even skin: the picked tone; a little of the file's own light and dark, none of its dark patches;
  // round the nose (nostrils, the wings' shade) most of it is kept
  const vec3 fiY = vec3(0.2126, 0.7152, 0.0722);
  float fiSh = clamp(pow(max(dot(c, fiY), 1e-5) / max(dot(uSkinAvg, fiY), 1e-4), 0.85), 0.35, 1.3);
  float fiNoseK = fiBell(fiX, 0.022) * fiBell(r.y - (fiNoseY + 0.002), 0.017) * smoothstep(fiNoseZ - 0.06, fiNoseZ - 0.03, r.z);
  float fiKeep = mix(0.25 * smoothstep(0.74, 0.92, fiSh), 0.8, fiNoseK) * step(0.5, mk.g) * (1.0 - step(0.02, fiWasHair));
  vec3 fiSkinC = uSkinTone * (1.0 + (min(fiSh, 1.08) - 1.0) * fiKeep);
  kit *= 1.0 - fiCan;
  skin = max(skin * (1.0 - fiKill * step(0.5, hairM)), fiCan);
`;

/** Where the old moving face was: marks, facial hair, eyes, brows, mouth. */
export const FI_DRAW = /* glsl */ `
  if (fiFront > 0.01 && r.y > fiChinY - 0.07) {
    float fiSk = (1.0 - smoothstep(0.3, 0.7, hairM)) * fiFront;
    float fiMw0 = uFiMouth.x;
    float fiLipTop = fiMouthY + uFiMouth.y, fiLipBot = fiMouthY - uFiMouth.z;

    // ── the skin's own marks and shade ──
    col = mix(col, col * vec3(1.1, 0.87, 0.85), uFiMarks.z * fiBell(fiAx - 0.05, 0.024) * fiBell(r.y - (fiEyeY - 0.045), 0.02) * fiSk);
    // the face's own form, so the even skin is not flat: darker under the jaw and brow, a touch darker round to the sides
    col *= 1.0 - fiSk * (0.2 * smoothstep(0.15, 0.75, -vRestN.y) + 0.12 * (1.0 - smoothstep(0.1, 0.7, vRestN.z)));
    {
      // the toon light kept working across the face (the head's own painted shading did this before it was
      // evened out): a soft-edged shade on the side of the nose, the cheek and the jaw away from the light,
      // a hollow under each cheekbone, so the features sit in the head's own form
      vec3 fn = normalize(vRestN);
      float side = 1.0 - smoothstep(0.02, 0.2, dot(fn, normalize(vec3(0.5, 0.42, 0.76))));
      float hollow = fiBell(fiAx - 0.058, 0.02) * fiBell(r.y - (fiMouthY + 0.024), 0.02);
      float temple = fiBell(fiAx - 0.07, 0.018) * fiBell(r.y - (fiEyeY + 0.004), 0.022);
      col *= 1.0 - fiSk * (0.17 * side + 0.07 * hollow + 0.05 * temple);
      // and a little light on the cheekbones, the nose's ridge and the chin
      float hi = fiBell(fiAx - 0.047, 0.016) * fiBell(r.y - (fiEyeY - 0.03), 0.011) + 0.8 * fiBell(fiX, 0.006) * smoothstep(fiNoseY - 0.004, fiNoseY + 0.006, r.y) * (1.0 - smoothstep(fiEyeY - 0.02, fiEyeY - 0.004, r.y));
      col *= 1.0 + 0.05 * fiSk * hi;
    }
    // the nose: the shadow it casts under its tip, the two nostrils, the crease round each wing
    {
      float ny = r.y - fiNoseY;
      float nSh = fiBell(fiX, 0.021) * fiBell(ny + 0.012, 0.004);
      float nos = 1.0 - smoothstep(0.6, 1.0, length(vec2((fiAx - 0.0115) / 0.0058, (ny + 0.0078 + 0.08 * (fiAx - 0.0115)) / 0.0024)));
      float wing = (1.0 - smoothstep(0.0006, 0.0022, abs(length(vec2((fiAx - 0.0135) / 1.0, (ny + 0.003) * 0.85)) - 0.0125))) * step(0.0135, fiAx) * smoothstep(-0.013, -0.008, ny) * (1.0 - smoothstep(0.003, 0.009, ny));
      col *= 1.0 - fiSk * (0.26 * nSh + 0.55 * nos + 0.22 * wing);
    }
    // shade down each side of the nose: the nose reads without a drawn outline
    col *= 1.0 - 0.07 * fiSk * fiBell(fiAx - 0.014, 0.006) * smoothstep(fiNoseY + 0.004, fiNoseY + 0.02, r.y) * (1.0 - smoothstep(fiEyeY - 0.014, fiEyeY + 0.002, r.y));
    if (uFiMarks.x > 0.0 && fiDet > 0.03) {
      vec2 cell = floor(r.xy / 0.0038), fo = vec2(fiHash(cell), fiHash(cell + 7.3));
      float d = length((fract(r.xy / 0.0038) - 0.25 - 0.5 * fo) * 0.0038);
      float zone = max(fiBell(fiAx - 0.034, 0.03) * fiBell(r.y - (fiEyeY - 0.038), 0.02), 0.8 * fiBell(fiX, 0.014) * fiBell(r.y - (fiNoseY + 0.018), 0.016));
      float fr = (1.0 - smoothstep(0.00045, 0.00095, d)) * step(1.0 - 0.72 * uFiMarks.x, fiHash(cell + 3.1));
      col = mix(col, col * vec3(0.74, 0.6, 0.52), fr * zone * fiDet * fiSk * 0.85);
    }
    if (uFiMarks.w > 0.5) {
      float d = length(vec2(fiX - uFiMole.x, r.y - (fiMouthY + uFiMole.y)));
      col = mix(col, uSkinTone * 0.32, (1.0 - smoothstep(0.0008, 0.0011 + fiAA * 1.5, d)) * fiSk * 0.9 * uFiLm3.w);
    }
    if (uFiMarks.y > 0.01) {
      // age: the fold from the nose's wing to the mouth corner, two lines on the forehead, crow's feet
      float ty = clamp((fiNoseY + 0.002 - r.y) / (fiNoseY + 0.002 - (fiMouthY - 0.008)), 0.0, 1.0);
      float fxl = mix(0.021, fiMw0 + 0.012, pow(ty, 0.7)) + 0.004 * sin(ty * 3.1416);
      float fold = (1.0 - smoothstep(0.0004, 0.0018, abs(fiAx - fxl))) * smoothstep(0.02, 0.2, ty) * (1.0 - smoothstep(0.8, 1.0, ty));
      col *= 1.0 - 0.2 * fold * uFiMarks.y * fiSk;
      float fh = 0.0;
      for (int k = 0; k < 2; k++) {
        float fy = fiBrowY + 0.026 + float(k) * 0.013 - 0.004 * (fiX / 0.05) * (fiX / 0.05);
        fh = max(fh, (1.0 - smoothstep(0.0004, 0.0016, abs(r.y - fy))) * (1.0 - smoothstep(0.03, 0.046, fiAx)));
      }
      col *= 1.0 - 0.22 * fh * smoothstep(0.35, 0.8, uFiMarks.y) * fiSk * fiDet;
    }

    float fiBeardK = 0.0;
    // ── facial hair: one soft shape that follows the jaw, shaded as toon hair, thinning to stubble at its edges ──
    if (uFiBeard.x + uFiBeard.y + uFiBeard.z > 0.0) {
      float th = atan(fiAx, max(r.z - fiZb, 1e-4));           // 0 the middle of the face … ~1.5 at the ear
      vec2 hp = vec2(th * 0.1, r.y);                           // metres round the face, metres up
      float len = uFiBeard2.w, dens = uFiBeard.w;
      float full = smoothstep(0.08, 0.45, len);                // 0 stubble … 1 a beard
      // its edge wanders in soft tufts (more on a longer beard); stubble has no edge to wander
      float ed = (fiNoise(hp / 0.0055) - 0.5) * mix(0.0015, 0.0045, full);
      float mwb = fiMw0 + 0.0085;                              // a moustache and a goatee reach a little past the mouth's corners
      float eG = mix(0.009, 0.003, full);                      // how soft an edge is: stubble fades, a beard has an edge
      float offNeck = smoothstep(fiNoseZ - 0.1, fiNoseZ - 0.075, r.z + (fiAx * fiAx) * 9.0);    // the neck's front is well behind the chin
      // the cheeks and jaw: under a cheek line that runs from the sideburn, dips, and meets the moustache's end
      float yCheek = mix(fiMouthY + 0.002, fiMouthY + 0.03, uFiBeard2.x) - 0.016 * uFiBeard2.y;    // (a chin strap: a low line, hugging the jaw)
      float yTop = mix(yCheek, fiEyeY - 0.006, pow(smoothstep(0.45, 1.38, th), 1.5)) - 0.005 * sin(3.1416 * smoothstep(0.35, 1.3, th));
      float yJaw = mix(fiChinY + 0.002, fiMouthY + 0.014, smoothstep(0.6, 1.4, th));
      yTop -= 0.012 * uFiBeard2.y * sin(3.1416 * smoothstep(0.3, 1.35, th));
      float under = smoothstep(yJaw - 0.028, yJaw - 0.013, r.y) * offNeck;      // it ends under the jaw, never on the neck
      // (the cheek's upper edge is feathered: the hair thins out up the cheek over a centimetre or two)
      float feather = mix(0.026, 0.013, full);
      float cheek = (1.0 - smoothstep(yTop - feather, yTop + 0.003, r.y + ed)) * smoothstep(0.1, 0.24, th) * (1.0 - smoothstep(1.4, 1.56, th)) * under;
      // round the mouth: one shield-shaped piece (wide at the mouth, narrower to the chin, its top under the nose
      // and drooping to the corners), of which a style wears the moustache, the chin, or both joined at the sides
      float tG = (r.y - fiChinY) / max(fiMouthY - fiChinY, 0.01);
      float wG = mwb * (1.0 - 0.42 * pow(clamp(1.0 - tG, 0.0, 1.0), 1.6));
      float inG = 1.0 - smoothstep(wG - eG, wG + eG, fiAx + ed);
      float topM = fiNoseY - 0.0165 - 0.0075 * pow(min(fiAx / mwb, 1.2), 2.0) - 0.003 * fiBell(fiX, 0.003) * full;
      float botM = fiMouthY - 0.005 * smoothstep(fiMw0 * 0.75, mwb, fiAx);
      float mo = inG * (1.0 - smoothstep(topM - eG, topM + eG * 0.4, r.y + ed * 0.4)) * smoothstep(botM - 0.002, botM + 0.002, r.y);
      // (under the lower lip the skin is bare unless he wears a patch there; stubble covers it)
      float soulK = max(uFiBeard2.z, 1.0 - full);
      float kuB = sqrt(max(0.0, 1.0 - (fiAx / fiMw0) * (fiAx / fiMw0)));
      float chinTop = fiMouthY - (uFiMouth.z * 0.8 * pow(kuB, 0.8) + mix(0.007 * kuB * kuB, 0.0, soulK)) + 0.003 * soulK;    // it comes up to the lower lip's own edge
      float chin = inG * (1.0 - smoothstep(chinTop - eG, chinTop + eG * 0.4, r.y + ed * 0.4)) * under;
      float join = inG * smoothstep(fiMw0 - 0.003, fiMw0 + 0.003, fiAx) * (1.0 - smoothstep(botM - 0.001, botM + 0.003, r.y)) * under;
      float D = max(max(cheek * uFiBeard.x, chin * uFiBeard.y), max(mo * uFiBeard.z, join * min(uFiBeard.y, uFiBeard.z)));
      if (D > 0.003) {
        // a toon beard, shaded as the toon hair is: lighter on the planes that face up to the light, darker on
        // its underside and under the lower lip; fine hairs break its edge close up; from far it is one clean
        // soft shape. Stubble is a shadow in the skin, strongest on the chin and jaw, fading up the cheek.
        float strokes = fiNoise(vec2(hp.x / 0.0009 + r.y * 110.0, hp.y / 0.0045)) - 0.5;
        float hairy = strokes * fiDet;
        float Dh = clamp(D + hairy * 0.9 * D * (1.0 - D) * 2.0, 0.0, 1.0);
        float halo = smoothstep(0.03, 0.5, D), core = smoothstep(0.42, 0.9, Dh);
        float aStub = dens * (0.5 * halo + 0.2 * smoothstep(0.5, 1.0, D)) * (1.0 + 0.2 * hairy);
        float aFull = dens * (0.26 * halo + 0.72 * core);
        float alpha = mix(aStub, aFull, full);
        vec3 fn = normalize(vRestN);
        float lit = smoothstep(0.3, 0.52, dot(fn, normalize(vec3(0.3, 0.72, 0.62))));
        float underK = smoothstep(0.05, 0.6, -fn.y);
        float lipSh = fiBell(fiX, fiMw0 * 0.9) * fiBell(r.y - (fiLipBot - 0.007), 0.006);
        float up = clamp((r.y - (yJaw - 0.01)) / max(yTop - yJaw + 0.01, 0.02), 0.0, 1.0);     // 0 along the jaw … 1 at the cheek line
        float vol = 0.86 + 0.3 * lit + 0.3 * smoothstep(0.25, 0.95, up) * smoothstep(0.25, 0.5, th) - 0.42 * underK - 0.22 * lipSh + 0.3 * hairy;
        vec3 hc = uHairK * 0.72 * vol + vec3(0.016, 0.013, 0.011) * lit;
        vec3 sc = mix(col * 0.52, uHairK * 0.8, 0.5);
        col = mix(col, min(mix(sc, hc, full), vec3(1.0)), alpha * fiSk);
        // a beard is hair: it does not take the face's lift or the skin's light
        tnSkin *= 1.0 - alpha * full * core;
      }
      // the lips of a bearded mouth sit back in it: toned to the skin, no shine
      fiBeardK = (0.35 + 0.65 * full) * dens * max(uFiBeard.y, uFiBeard.z);
    }

    // ── eyes and brows ──
    vec3 fiLashC = mix(uFiBrowC * 0.3, vec3(0.012), 0.5);
    float fiEyeK = 0.0;
    for (int i = 0; i < 2; i++) {
      float s = i == 0 ? -1.0 : 1.0;
      vec2 e = vec2(s * (uFiLm1.y + uFiEye2.x), fiEyeY + uFiEye2.y);
      vec2 qb = vec2((fiX - e.x) * s, r.y - e.y);                 // +x towards his ear
      if (abs(qb.x) > 0.055 || abs(qb.y) > 0.06) continue;
      vec2 q = qb;
      q.y -= uFiEye.w * q.x;
      float w = uFiEye.x, t = q.x / w;
      // the socket's own shade: the eye sits in the face, under the brow
      float sock = fiBell(q.x, w * 1.2) * fiBell(q.y - uFiEye.y * 1.0, uFiEye.y * 1.5 + 0.003);
      col *= 1.0 - (0.03 + 0.38 * uFiEye3.y) * sock * fiSk;
      float inEye = 0.0;
      if (abs(t) < 1.35) {
        float k = sqrt(max(0.0, 1.0 - t * t));
        // the opening: its high point a little towards the nose, the lid's skin over the top of a hooded eye
        float peak = 1.0 - 0.2 * (t - 0.12) * (t - 0.12);
        // a round eye's top is a full arc; a narrow or single-lidded eye's is flatter, its inner corner dropped
        float top0 = uFiEye.y * pow(k, mix(1.05, 0.5, uFiEye4.x)) * peak * (1.0 - 0.34 * uFiEye3.x) * (1.0 - 0.45 * uFiEye4.y * smoothstep(-0.2, -1.0, t));
        float bot0 = -uFiEye.z * pow(k, mix(1.3, 0.8, uFiEye4.x));
        float op = uFiExA.x * (1.0 - uFiExD.w);
        float bot = mix(bot0, bot0 + (top0 - bot0) * 0.42, clamp(uFiExA.y, 0.0, 1.0));
        float top = mix(bot0, top0, clamp(op, 0.0, 1.0)) + max(0.0, op - 1.0) * uFiEye.y * 0.6 * k;
        top = max(top, bot);
        float topMax = max(top0, top);
        float inX = 1.0 - smoothstep(0.96, 1.0, abs(t));
        inEye = inX * smoothstep(bot - fiAA, bot + fiAA, q.y) * (1.0 - smoothstep(top - fiAA, top + fiAA, q.y));
        float lidZone = inX * smoothstep(bot0 - fiAA, bot0 + fiAA, q.y) * (1.0 - smoothstep(topMax - fiAA, topMax + fiAA, q.y));
        // the lids' skin over the rest opening (a blink, a heavy lid, a squint)
        col = mix(col, uSkinTone * 0.92, lidZone * (1.0 - inEye));
        // the eyeball: darker to its corners, the upper lid's shadow across its top
        vec3 ew = vec3(0.9, 0.88, 0.855) * mix(0.8, 1.0, pow(k, 0.6));
        float ir = uFiEye2.z;
        vec2 ic = vec2(uFiExA.z * s * w * 0.3, (top0 + bot0) * 0.5 + uFiEye.y * 0.05 + uFiExA.w * uFiEye.y * 0.34);
        vec2 qi = q - ic;
        float dI = length(qi) / ir;
        vec3 iris = uFiIris * mix(1.5, 0.78, smoothstep(-0.8, 0.6, qi.y / ir));
        iris *= mix(1.0, 0.82 + 0.36 * fiHash(vec2(floor(atan(qi.y, qi.x) * 9.0), 3.0)), 0.35 * fiDet * smoothstep(0.4, 0.6, dI));
        iris = mix(iris, uFiIris * 0.26, smoothstep(0.72, 0.98, dI));
        iris = mix(iris, vec3(0.012), 1.0 - smoothstep(0.38, 0.46, dI));
        // the catch light: always on the side the light comes from
        float hl = length(vec2(qi.x * s - 0.3 * ir, qi.y - 0.34 * ir)) / ir;
        iris = mix(iris, vec3(1.0), (1.0 - smoothstep(0.15, 0.25, hl)) * 0.95);
        ew = mix(ew, iris, 1.0 - smoothstep(0.94, 1.04, dI));
        ew *= mix(0.66, 1.0, smoothstep(0.0, uFiEye.y * 0.42, top - q.y));
        col = mix(col, ew, inEye);
        // the lash line on the upper lid's edge, heavier to the outer corner
        float lt = (0.0008 + 0.0009 * uFiEye3.z) * (0.62 + 0.58 * smoothstep(-1.0, 1.0, t));
        float lash = (1.0 - smoothstep(lt - fiAA, lt + fiAA, abs(q.y - (top + lt * 0.6)))) * (1.0 - smoothstep(1.0, 1.1, abs(t)));
        // a sloped eye's lash line runs on past the outer corner, along the slope: up on an upturned eye, down on a downturned one
        float wing = smoothstep(0.07, 0.15, abs(uFiEye.w)) * (1.0 - smoothstep(lt * 0.9 - fiAA, lt * 0.9 + fiAA, abs(q.y - lt * 0.4) + lt * 1.2 * smoothstep(1.0, 1.32, t))) * step(0.98, t) * (1.0 - step(1.32, t));
        col = mix(col, fiLashC, max(lash, wing) * 0.95);
        // the lower lid: a thin soft line under the outer two thirds
        float low = (1.0 - smoothstep(0.0003, 0.0004 + fiAA * 2.0, abs(q.y - bot + 0.0004))) * inX * smoothstep(-0.7, 0.1, t) * 0.38;
        col = mix(col, uSkinTone * 0.5, low);
        // the fold above the lid; a hooded eye has the lid's soft shadow in its place
        float cy = topMax + uFiEye.y * 0.36 * k + 0.0012;
        float cr = (1.0 - smoothstep(0.0003, 0.0004 + fiAA * 2.0, abs(q.y - cy))) * (1.0 - smoothstep(0.7, 1.0, abs(t))) * uFiEye2.w * smoothstep(0.4, 0.8, op) * 0.5 * fiDet;
        col = mix(col, uSkinTone * 0.56, cr * fiSk);
        // a hooded eye: the lid's heavy fold sits on the lash line, a band of shade over the opening
        col *= 1.0 - 0.46 * uFiEye3.x * (1.0 - smoothstep(0.0, uFiEye.y * 0.75 + 0.002, q.y - topMax)) * step(topMax, q.y) * (1.0 - smoothstep(0.85, 1.2, abs(t))) * (1.0 - inEye) * fiSk;
        // the line under the eye (older, tired)
        float ue = (1.0 - smoothstep(0.0005, 0.0016, abs(q.y - (bot0 - 0.0058 - 0.002 * t * t)))) * (1.0 - smoothstep(0.45, 0.9, abs(t + 0.1)));
        col *= 1.0 - 0.24 * ue * uFiEye3.w * fiSk * (0.4 + 0.6 * fiDet);
        // a tear on his right cheek
        fiEyeK = max(fiEyeK, inEye);
      }
      // the brow: a soft-edged band of short hairs
      float xin = -1.0 + uFiBrowB.y, xout = xin + uFiBrowB.x;
      float bt = (qb.x / 0.021 - xin) / (xout - xin);
      if (bt > -0.15 && bt < 1.15) {
        float side = clamp(s * uFiExB.w, -1.0, 1.0);
        float up = uFiExB.x * (1.0 + side) + 0.5 * max(side, 0.0) * (1.0 - uFiExB.x);
        float sad = uFiExB.y, ang = uFiExB.z;
        float inner = (1.0 - bt) * (1.0 - bt);
        float yb = uFiBrowA.x + uFiBrowA.w * (bt - 0.5) + uFiBrowA.z * sin(3.1416 * pow(clamp(bt, 0.0, 1.0), uFiBrowB.w))
          + up * 0.0075 + sad * (0.008 * inner - 0.0025 * bt) - ang * (0.0085 * inner - 0.002 * bt) - ang * 0.0015;
        float bth = 2.6 * uFiBrowA.y * mix(1.0, uFiBrowB.z, smoothstep(0.3, 1.0, bt)) * mix(0.8, 1.0, smoothstep(0.0, 0.2, bt));
        float ends = smoothstep(-0.03, 0.1, bt) * (1.0 - smoothstep(0.9, 1.03, bt));
        float dy = qb.y - yb;
        float brow = ends * (1.0 - smoothstep(bth * 0.36 - fiAA, bth * 0.5 + fiAA, abs(dy)));
        // hairs: slanted strokes, the top edge feathered, so a thick brow is hair and not a slab
        float hn = fiHash(vec2(floor(bt * 46.0 - dy / bth * 9.0), 1.0));
        brow *= 1.0 - fiDet * (0.12 * hn + 0.4 * step(0.5, hn) * smoothstep(bth * 0.15, bth * 0.5, dy));
        // the brow ridge's soft shade just under it
        col *= 1.0 - 0.06 * ends * fiBell(dy + bth * 0.9, bth * 0.6) * fiSk * (1.0 - inEye);
        col = mix(col, uFiBrowC, brow * uFiMole.w * (1.0 - inEye) * fiFront);
      }
    }
    tfEyesK = max(tfEyesK, fiEyeK);
    if (uFiExD.z > 0.01) {
      float tr = uFiExD.z * (1.0 - smoothstep(0.0012, 0.002, length(vec2(fiX + (uFiLm1.y + uFiEye2.x) - 0.004, (r.y - (fiEyeY - 0.02)) * 0.55))));
      col = mix(col, vec3(0.85, 0.93, 1.0), tr * 0.7);
    }

    // ── the mouth ──
    float mw = fiMw0 * (1.0 + 0.16 * uFiExC.z + 0.1 * max(uFiExC.x, 0.0) - 0.12 * uFiExD.y);
    float mu = fiX / mw;
    if (abs(mu) < 1.4 && abs(r.y - fiMouthY) < 0.035) {
      float sm_ = uFiExC.x + uFiExC.w * mu;                       // a smile on one side: a smirk
      float ku = sqrt(max(0.0, 1.0 - mu * mu));
      float y0 = fiMouthY + sm_ * mw * 0.34 * mu * mu - sm_ * 0.0015;
      float gap = uFiExC.y * 0.0155 * pow(ku, 0.6);
      float bow = 1.0 - 0.2 * exp(-(mu * mu) / 0.03);
      float upT = uFiMouth.y * pow(ku, 0.55) * bow * (1.0 - 0.35 * uFiExD.y) * (1.0 - 0.25 * max(uFiExC.x, 0.0)) * (1.0 - 0.4 * fiBeardK);
      float loT = uFiMouth.z * pow(ku, 0.8) * (1.0 - 0.35 * uFiExD.y) * (1.0 - 0.15 * max(uFiExC.x, 0.0)) * (1.0 - 0.2 * fiBeardK);
      float inM = 1.0 - smoothstep(0.95, 1.0, abs(mu));
      float v = r.y - y0;
      float se = 0.0008 + fiAA;                                   // the lips' edge is soft: they are skin, not a sticker
      // a soft shade under the lower lip seats the mouth in the face
      col *= 1.0 - 0.13 * fiBell(mu, 0.7) * fiBell(v + gap + loT + 0.003, 0.0034) * fiSk;
      float upper = inM * smoothstep(-fiAA, fiAA, v) * (1.0 - smoothstep(upT - se, upT + se * 0.6, v));
      float lower = inM * (1.0 - smoothstep(-gap - fiAA, -gap + fiAA, v)) * smoothstep(-gap - loT - se, -gap - loT + se * 0.6, v);
      float inside = inM * (1.0 - smoothstep(-fiAA, fiAA, v)) * smoothstep(-gap - fiAA, -gap + fiAA, v) * step(0.0006, gap);
      // the lips: his skin, a little darker and redder (never a bright slab); in a beard darker, greyer, no shine
      vec3 lipC = mix(uSkinTone, uFiLip, uFiMouth.w * 0.85);
      lipC = mix(lipC, vec3(dot(lipC, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.12, 0.94, 0.94), 0.1);
      vec3 lipB = mix(uSkinTone, uFiLip, 0.6);
      lipC = mix(lipC, mix(lipB, vec3(dot(lipB, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.1, 0.95, 0.93), 0.45) * 0.68, fiBeardK);
      vec3 lipU = lipC * 0.82;
      vec3 lipL = lipC * (mix(0.98, 1.0 + 0.08 * (1.0 - fiBeardK), smoothstep(-gap - loT, -gap - loT * 0.35, v)) + 0.1 * (1.0 - fiBeardK) * fiBell(mu, 0.45) * fiBell((v + gap + loT * 0.5) / max(loT, 1e-4), 0.28));
      col = mix(col, lipU, upper);
      col = mix(col, lipL, lower);
      vec3 mc = vec3(0.07, 0.016, 0.02);
      float th_ = min(0.003 + uFiExD.x * 0.004, gap * 0.45 + uFiExD.x * 0.004);
      float teeth = smoothstep(0.15, 0.3, uFiExC.y + uFiExD.x) * (1.0 - smoothstep(th_ - fiAA, th_ + fiAA, -v)) * (1.0 - smoothstep(0.7, 0.9, abs(mu)));
      mc = mix(mc, vec3(0.86, 0.83, 0.78), teeth);
      col = mix(col, mc, inside);
      // the line between the lips, deeper at the corners
      float line = (1.0 - smoothstep(0.0004, 0.0005 + fiAA * 2.0, abs(v))) * (1.0 - smoothstep(1.0, 1.08, abs(mu))) * (1.0 - step(0.0006, gap) * inM);
      col = mix(col, uFiLip * 0.24, line * 0.85);
      float corner = (1.0 - smoothstep(0.0008, 0.0022, length(vec2((abs(mu) - 1.02) * mw, v)))) * 0.5;
      col = mix(col, uSkinTone * 0.5, corner * fiSk);
    }
  }
`;
