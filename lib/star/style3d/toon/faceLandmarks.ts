/**
 * WHERE EACH STYLE A HEAD'S FACE IS (rest pose, metres, his left at +x).
 * Measured off each head's own painted picture by the bench's Faces page
 * (/star-3d-bench-dev/faces, lib/star/style3d/toon/faceMeasure.ts); written
 * here by scripts/bench3d/faces.mjs. Do not edit by hand: measure again.
 */
import type { ToonHead } from "./bodies";

export interface ToonFaceLandmarks {
  /** Each eye opening: centre x, centre y, half width, half height (his right first). */
  eyes: [[number, number, number, number], [number, number, number, number]];
  /** Each iris: centre x, centre y, radius. */
  iris: [[number, number, number], [number, number, number]];
  /** The skin's depth at the irises. */
  eyeZ: number;
  browY: number;
  /** The nose tip. */
  nose: [number, number, number];
  /** The mouth: centre x, the line between the lips (y), half width, depth. */
  mouth: [number, number, number, number];
  chinY: number;
  /** The head's own paint (sRGB): the eye white, the lid's skin, the lash line. */
  colors: { white: string; lid: string; lash: string };
}

export const TOON_FACE_LANDMARKS: Partial<Record<ToonHead, ToonFaceLandmarks>> = {
  h1: {"eyes":[[-0.0485,1.6422,0.0171,0.0118],[0.044,1.6426,0.0201,0.0111]],"iris":[[-0.0504,1.6462,0.0098],[0.0419,1.6462,0.0104]],"eyeZ":0.1468,"browY":1.675,"nose":[-0.006,1.5986,0.1932],"mouth":[0.0001,1.5547,0.0153,0.1712],"chinY":1.5047,"colors":{"white":"#cdc2ba","lid":"#a1613b","lash":"#3a281d"}},
  h2: {"eyes":[[-0.048,1.6541,0.0161,0.0115],[0.042,1.6542,0.0189,0.0104]],"iris":[[-0.0459,1.6578,0.0095],[0.0394,1.6578,0.01]],"eyeZ":0.1418,"browY":1.6848,"nose":[0.002,1.6147,0.1915],"mouth":[0.0016,1.5783,0.0285,0.1643],"chinY":1.5233,"colors":{"white":"#d7d5d6","lid":"#cd835a","lash":"#3f2d24"}},
  h3: {"eyes":[[-0.0515,1.6776,0.0176,0.0098],[0.0439,1.6776,0.0193,0.0098]],"iris":[[-0.0504,1.6799,0.0098],[0.0424,1.6799,0.0103]],"eyeZ":0.1458,"browY":1.7064,"nose":[-0.006,1.622,0.1931],"mouth":[-0.0001,1.5809,0.0325,0.1734],"chinY":1.5209,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  h4: {"eyes":[[-0.0405,1.6466,0.0134,0.0061],[0.0406,1.647,0.015,0.0063]],"iris":[[-0.0396,1.6473,0.0074],[0.0389,1.648,0.0084]],"eyeZ":0.1547,"browY":1.6688,"nose":[0,1.6024,0.197],"mouth":[0.0009,1.5693,0.022,0.1742],"chinY":1.5143,"colors":{"white":"#e2d8d1","lid":"#c27d53","lash":"#41291a"}},
  h5: {"eyes":[[-0.0433,1.6534,0.0151,0.007],[0.0419,1.6533,0.0152,0.0074]],"iris":[[-0.0429,1.6537,0.009],[0.0419,1.6539,0.0092]],"eyeZ":0.146,"browY":1.6799,"nose":[0.004,1.6098,0.1832],"mouth":[-0.0008,1.5717,0.0214,0.162],"chinY":1.5247,"colors":{"white":"#f5f1ec","lid":"#d89b75","lash":"#372519"}},
  h6: {"eyes":[[-0.0464,1.6741,0.0173,0.0065],[0.0381,1.6744,0.0163,0.0071]],"iris":[[-0.0429,1.6761,0.0072],[0.0376,1.6776,0.0085]],"eyeZ":0.1553,"browY":1.6953,"nose":[0.004,1.6322,0.1977],"mouth":[-0.0039,1.5931,0.028,0.1709],"chinY":1.5321,"colors":{"white":"#ecf2ee","lid":"#d6855f","lash":"#3a271c"}},
  m1: {"eyes":[[-0.0519,1.6371,0.0178,0.0099],[0.0467,1.6384,0.0214,0.0106]],"iris":[[-0.0541,1.637,0.0119],[0.0454,1.639,0.0125]],"eyeZ":0.1652,"browY":1.6615,"nose":[-0.002,1.5809,0.2149],"mouth":[0,1.546,0.022,0.1881],"chinY":1.511,"colors":{"white":"#e0d8cc","lid":"#aa754b","lash":"#412f20"}},
  m2: {"eyes":[[-0.0485,1.6614,0.0189,0.0086],[0.0476,1.6612,0.019,0.0092]],"iris":[[-0.0476,1.6617,0.0097],[0.0456,1.6615,0.0103]],"eyeZ":0.1631,"browY":1.693,"nose":[-0.002,1.6126,0.213],"mouth":[0.0001,1.5837,0.0325,0.1953],"chinY":1.5487,"colors":{"white":"#c1bbb0","lid":"#8c4f32","lash":"#301d12"}},
  // the re-shaped heads: their base head's spots moved by the same rule as the mesh (tools/hair3d/reshape_heads.mjs prints these lines)
  h7: {"eyes":[[-0.0515,1.6776,0.0176,0.0098],[0.0439,1.6776,0.0193,0.0098]],"iris":[[-0.0504,1.6799,0.0098],[0.0424,1.6799,0.0103]],"eyeZ":0.1458,"browY":1.7064,"nose":[-0.0066,1.622,0.1931],"mouth":[-0.0001,1.5809,0.0374,0.1734],"chinY":1.5189,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  h8: {"eyes":[[-0.0501,1.6992,0.0171,0.0104],[0.0427,1.6992,0.0188,0.0104]],"iris":[[-0.0493,1.7016,0.0096],[0.0415,1.7016,0.0101]],"eyeZ":0.1458,"browY":1.7284,"nose":[-0.0054,1.6348,0.1931],"mouth":[-0.0001,1.5853,0.0293,0.1734],"chinY":1.5209,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  h9: {"eyes":[[-0.0521,1.6774,0.0177,0.0099],[0.0445,1.6775,0.0194,0.0099]],"iris":[[-0.051,1.6798,0.0098],[0.0429,1.6798,0.0104]],"eyeZ":0.1463,"browY":1.7064,"nose":[-0.0063,1.622,0.1932],"mouth":[-0.0004,1.5809,0.0348,0.1736],"chinY":1.5256,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}},
  m3: {"eyes":[[-0.0481,1.661,0.0188,0.0083],[0.0472,1.6608,0.0189,0.0089]],"iris":[[-0.0472,1.6613,0.0096],[0.0452,1.6611,0.0102]],"eyeZ":0.1632,"browY":1.693,"nose":[-0.002,1.6106,0.216],"mouth":[0.0001,1.5832,0.0324,0.196],"chinY":1.5487,"colors":{"white":"#c1bbb0","lid":"#8c4f32","lash":"#301d12"}},
};
