#!/usr/bin/env node
// scripts/look-tuner/canvases.mjs — dev probe: list a page's canvases (size, context, visible), to pick the 3D one.
import { openPhone } from "./browser.mjs";

const { browser, page } = await openPhone(process.argv[2], { waitFor: process.argv[3] || "document.querySelector('canvas')", settleMs: 8000, dsf: 1 });
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => {
  const r = c.getBoundingClientRect(); const cs = getComputedStyle(c);
  return { w: c.width, h: c.height, box: [r.x, r.y, r.width, r.height].map(Math.round), display: cs.display, vis: cs.visibility, op: cs.opacity, cls: c.className.slice(0, 60), parent: c.parentElement?.className?.slice(0, 60) };
})), null, 1));
await browser.close();
