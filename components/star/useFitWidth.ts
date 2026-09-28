"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * SHRINK A BANNER WORD UNTIL IT FITS THE PITCH IT SITS ON.
 *
 * The match's big banner words (GOAL, DEFLECTED, SAVED…) are sized for a
 * full-width pitch (~366 px on a phone). The phone's Kickabout app plays the
 * same match on a ~226 px pitch, where the same 48 px word ran off both edges.
 *
 * This measures the text's own width (the widest line, so a two-word banner
 * that wraps is measured line by line) against the width of the box it sits
 * in, and only ever makes the font SMALLER — never bigger — until the text is
 * at most `fraction` of that width. A banner that already fits keeps the size
 * its class gives it, exactly as before.
 *
 * `key` is whatever changes when the text does (the banner's word).
 */
export function useFitWidth(
  ref: RefObject<HTMLElement | null>,
  key: unknown,
  fraction = 0.9,
  minPx = 12,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    el.style.fontSize = ""; // back to the class's own size before measuring
    const target = box.clientWidth * fraction;
    if (!(target > 0)) return;
    for (let i = 0; i < 10; i++) {
      const w = naturalWidth(el);
      if (!(w > target)) break;
      const cur = parseFloat(getComputedStyle(el).fontSize);
      if (!(cur > minPx)) break;
      el.style.fontSize = `${Math.max(minPx, cur * (target / w) * 0.98)}px`;
    }
  }, [ref, key, fraction, minPx]);
}

/**
 * The text's laid-out width plus the element's own side padding, in CSS px,
 * with any transform on the element (the pop-in animation scales it) taken
 * back out so the number is the same whatever frame of the animation it is.
 */
function naturalWidth(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect().width;
  const box = el.getBoundingClientRect().width;
  const scale = el.offsetWidth > 0 && box > 0 ? box / el.offsetWidth : 1;
  const cs = getComputedStyle(el);
  return text / scale + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
}
