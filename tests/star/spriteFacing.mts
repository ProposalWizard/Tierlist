/**
 * A RUNNING 3D FIGURE NEVER PICKS A SPRAWLED FRAME (lib/star/sprites.ts).
 *
 * v0.27 known issue: "on byline crosses two players can overlap and flip
 * between lying and standing (the 3D running frames seen side-on)". Seen from
 * the tilted camera, the jog/sprint frames for running across the screen
 * (straight across, and across-and-down) are wider than they are tall: he
 * reads as lying down. Only straight across was swapped for a standing frame,
 * so a run across with a little downward drift (facing about 23-68 degrees
 * off horizontal) flipped between standing and sprawled as his heading
 * wobbled.
 *
 * "Sprawled" is read off the baked atlas itself (index.json): a direction
 * whose frames are on average at least as wide as they are tall.
 */
import { readFileSync } from "node:fs";
import { cellDir, mirroredFacing } from "../../lib/star/sprites";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const idx = JSON.parse(readFileSync(new URL("../../public/star/sprites/index.json", import.meta.url), "utf8"));
for (const clip of ["jog", "sprint"] as const) {
  const c = idx.chars.player.clips[clip];
  const sprawled = new Set<number>();
  for (let d = 0; d < c.dirs; d++) {
    let w = 0, h = 0;
    for (let f = 0; f < c.frames; f++) { const cell = c.cells[d * c.frames + f]; w += cell[2]; h += cell[3]; }
    if (w >= h) sprawled.add(d);
  }
  check(sprawled.size > 0, `${clip}: the atlas has sprawled directions to avoid (found ${[...sprawled]})`);
  let bad = 0, flips = 0;
  for (let deg = 0; deg < 360; deg++) {
    const a = (deg * Math.PI) / 180;
    if (sprawled.has(cellDir(clip, a, c.dirs))) bad++;
    // A heading wobbling 12 degrees either way.
    const s0 = sprawled.has(cellDir(clip, a - 0.21, c.dirs));
    const s1 = sprawled.has(cellDir(clip, a + 0.21, c.dirs));
    if (s0 !== s1) flips++;
  }
  console.log(`  ${clip}: sprawled frame at ${bad} of 360 headings; standing/sprawled flips under a 12° wobble at ${flips}`);
  check(bad === 0, `${clip}: a running man never shows a sprawled frame (${bad} of 360 headings do)`);
  check(flips === 0, `${clip}: no standing/sprawled flip as his heading wobbles (${flips})`);
}
// A left-footer's kick (v0.26 known issue: "left-footers kick with the right
// in the 3D view"). The baked kick is right-footed; drawSprite flips it
// left-right about his boots and takes the frame for the mirrored heading, so
// the picture still faces the way he is kicking. Flipping the screen left-right
// sends a heading a to PI - a; the frame used must be the one that, once
// flipped, lands back on a.
{
  let wrong = 0;
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const back = Math.PI - mirroredFacing(a);
    if (Math.abs(Math.atan2(Math.sin(back - a), Math.cos(back - a))) > 1e-9) wrong++;
  }
  check(wrong === 0, `a mirrored kick faces the way he kicks (${wrong} headings wrong)`);
  check(cellDir("kick", mirroredFacing(0), 8) === 4, "a left-footer facing right uses the left-facing kick frame, flipped");
}
// Anything that is not a run keeps its own direction.
check(cellDir("idle", 0, 8) === 0 && cellDir("kick", Math.PI / 4, 8) === 1, "idle and kick keep their real facing");

if (problems.length) {
  console.error("FAIL —\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("PASS — a running 3D figure always stands up, whichever way he runs");
