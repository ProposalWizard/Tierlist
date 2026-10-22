/**
 * lib/studio/suite.ts — small pure rules for the Studio's editing suite (ported 22 Oct 2026). The two modes' names live
 * here, in one place.
 */

/** Our cuts are 30 fps (v01 is). Frame steps use this. */
export const FPS = 30

/**
 * The two tabs. Teal = review notes (what is wrong or right at a moment, for whoever cuts the video). Cobalt = edits for
 * Claude (cuts and changes Claude makes). Never mixed.
 */
export const MODE_LABEL = { review: 'Review notes', edit: 'For Claude' } as const
export const MODE_HINT = {
  review: 'Notes on the cut at a moment: fix, keep or check.',
  edit: 'Cuts and changes for Claude. Saved for Claude at once; press Done when you have given them all.',
} as const

/** Ruler step in seconds: the smallest "nice" step that leaves at least `minPx` between labels. */
export function rulerStep(pxPerSec: number, minPx = 64): number {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return steps.find((s) => s * pxPerSec >= minPx) ?? steps[steps.length - 1]
}

/** Times to sample filmstrip frames at: the middle of `count` equal slices. */
export function thumbTimes(dur: number, count: number): number[] {
  if (!(dur > 0) || count < 1) return []
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * dur * 100) / count) / 100)
}

export function nextN(items: { n: number }[]): number {
  return items.reduce((m, i) => Math.max(m, i.n), 0) + 1
}
