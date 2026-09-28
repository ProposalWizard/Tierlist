import { recolourPixels, kitColours, hexToLin, numberInk, KIT_BASE, type Px, type LayerPack } from "../../lib/star/blenderRecolour";

/**
 * BLENDER RECOLOUR — the browser half of route (a) (tools/blender-footballer).
 * The page recolours a neutral-grey render into any club's kit with
 * out = base + light × Σ mask × (club − 0.5). These check the maths on
 * hand-made pixels; the page itself was filmed in a browser.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const px = (w: number, h: number, fill: number[]): Px => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  return { data, width: w, height: h };
};
const lin2byte = (l: number) => Math.round((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255);
const grey = lin2byte(KIT_BASE); // the neutral kit, as the render stores it
const lightQuarter = lin2byte(0.25); // light 1.0, stored /4

// kitA = shirt, sleeves, shorts (kitB, the socks/trim/band, stays empty);
// crestCov = the crest decal's coverage, its u,v mid-picture.
const pack = (kitA: number[], crestCov = 0, alpha = 255): LayerPack => ({
  base: px(1, 1, [grey, grey, grey, alpha]),
  light: px(1, 1, [lightQuarter, lightQuarter, lightQuarter, 255]),
  kitA: px(1, 1, [...kitA, 255]),
  kitB: px(1, 1, [0, 0, 0, 255]),
  crest: px(1, 1, [128, 128, crestCov, 255]),
  num: px(1, 1, [0, 0, 0, 255]),
});// 8-bit storage: the dark end of sRGB is steep, so allow a few steps.
const near = (a: number, b: number, tol = 10) => Math.abs(a - b) <= tol;

// A neutral kit leaves the render exactly as it was.
{
  const neutral = { shirt: [KIT_BASE, KIT_BASE, KIT_BASE], sleeve: [KIT_BASE, KIT_BASE, KIT_BASE], shorts: [KIT_BASE, KIT_BASE, KIT_BASE], socks: [KIT_BASE, KIT_BASE, KIT_BASE], trim: [KIT_BASE, KIT_BASE, KIT_BASE], band: [KIT_BASE, KIT_BASE, KIT_BASE] } as ReturnType<typeof kitColours>;
  const out = recolourPixels(pack([255, 0, 0]), neutral, null, null);
  check(out[0] === grey && out[1] === grey && out[2] === grey && out[3] === 255, `neutral kit changes nothing (${[...out]})`);
}

// Full shirt coverage under light 1.0 becomes the club's shirt colour.
{
  const kit = kitColours({ shirt: "#034694", trim: "#FFFFFF" });
  const out = recolourPixels(pack([255, 0, 0]), kit, null, null);
  const want = [0x03, 0x46, 0x94];
  check(out.slice(0, 3).every((v, i) => near(v, want[i])), `Chelsea shirt pixel is #034694 (${[...out.slice(0, 3)]})`);
  // The shorts take the trim colour (the game's two-colour kits).
  const shorts = recolourPixels(pack([0, 0, 255]), kit, null, null);
  check(shorts.slice(0, 3).every((v) => near(v, 255)), `Chelsea shorts are the trim, white (${[...shorts.slice(0, 3)]})`);
}

// A pixel that is not kit is never touched, whatever the club.
{
  const out = recolourPixels(pack([0, 0, 0]), kitColours({ shirt: "#EF0107", trim: "#FFFFFF" }), null, null);
  check(out[0] === grey && out[1] === grey && out[2] === grey, "skin and boots keep their colour");
}

// Transparent pixels stay transparent; alpha is never changed.
{
  const out = recolourPixels(pack([255, 0, 0], 0, 0), kitColours({ shirt: "#EF0107", trim: "#FFFFFF" }), null, null);
  check(out[3] === 0, "alpha 0 stays 0");
  const half = recolourPixels(pack([128, 0, 0], 0, 128), kitColours({ shirt: "#EF0107", trim: "#FFFFFF" }), null, null);
  check(half[3] === 128, "edge alpha kept");
}

// The crest decal prints the picture over the shirt where it covers (the
// render's shirt mask leaves the crest patch out, so the two never add up).
{
  const kit = kitColours({ shirt: "#034694", trim: "#FFFFFF" });
  const red = px(4, 4, [255, 0, 0, 255]);
  const out = recolourPixels(pack([0, 0, 0], 255), kit, red, null);
  check(out[0] > 200 && out[1] < 40 && out[2] < 40, `crest paints over the shirt (${[...out.slice(0, 3)]})`);
  const clear = px(4, 4, [255, 0, 0, 0]);
  const under = recolourPixels(pack([0, 0, 0], 255), kit, clear, null);
  const want = [0x03, 0x46, 0x94];
  check(under.slice(0, 3).every((v, i) => near(v, want[i])), `a see-through crest shows the shirt (${[...under.slice(0, 3)]})`);
}

// Masks are stored linear: a half-covered edge pixel is half-way between the
// grey render and the club colour in linear light. (Decoding them as sRGB
// covered it only 21% and left a pale frame round the crest — seen on the page.)
{
  const kit = kitColours({ shirt: "#000000", trim: "#FFFFFF" });
  const out = recolourPixels(pack([128, 0, 0]), kit, null, null);
  const want = lin2byte(0.5 + (128 / 255) * (0 - 0.5));
  check(near(out[0], want, 4), `half shirt coverage is half-way in linear (${out[0]} vs ${want})`);
  // Shirt edge + crest edge that add up to full coverage give the full shirt colour.
  const edge = recolourPixels(pack([128, 0, 0], 127), kit, px(4, 4, [0, 0, 0, 0]), null);
  check(near(edge[0], 0, 12), `shirt + see-through crest edges add up to the shirt (${edge[0]})`);
}

check(hexToLin("#ffffff").every((v) => v === 1), "white is linear 1");
check(numberInk({ shirt: "#034694", trim: "#FFFFFF" }) === "#034694", "a number on white shorts is in the shirt colour");
check(numberInk({ shirt: "#FFFFFF", trim: "#132257" }) === "#ffffff", "a number on navy shorts is white");

if (problems.length) { console.error("blenderRecolour FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("blenderRecolour: all passed");
