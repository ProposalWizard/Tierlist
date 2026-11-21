/**
 * THE 3D PHONE'S GLASS (RUL-UI-008): where the real phone screen sits on the
 * picture of the hand holding the phone (public/star/phone3d/hand.webp, from
 * tools/phone3d/hand_phone_gta.py). One home for these numbers: the test page
 * (/star-phone3d-dev) and the game (components/star/HousePhone.tsx) both read it.
 *
 * The picture is a 390 x 844 phone screen (rendered 780 x 1688). The phone UI
 * is a normal 368 x 666 page box bent onto the glass's four corners with a CSS
 * matrix3d, so the browser itself sends each tap to the button under the finger.
 */

/** The stage the picture is drawn for, in CSS px. */
export const STAGE = { w: 390, h: 844 };
/** The glass's corners on the stage: tl, tr, br, bl (fable/final2.json, halved). */
export const QUAD: [number, number][] = [[96.9, 146.3], [293.95, 176.0], [265.5, 607.3], [43.25, 587.05]];
/** The phone screen box that is bent onto the glass, in CSS px. */
export const SCREEN = { w: 368, h: 666, radius: 46 };

/** The CSS matrix3d that bends a w x h box onto four points (tl, tr, br, bl). */
export function quadMatrix(w: number, h: number, q: [number, number][]): string {
  const src: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [], B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  // Gaussian elimination
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      B[r] -= f * B[c];
    }
  }
  const [a, b, c2, d, e, f, g, hh] = B.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c2},${f},0,1)`;
}

/** The glass's bend, worked out once. */
export const GLASS_MATRIX = quadMatrix(SCREEN.w, SCREEN.h, QUAD);
