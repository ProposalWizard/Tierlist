// Scene: a written plan as a phone page, scrolled steadily top to bottom.
// node scripts/film/scenes/doc-scroll.mjs <page.html> <out.mp4> [seconds=18]
// Make the page first (Markdown → plain white page, 16 px text, tables fit 390):
//   python3 -c "import markdown; ..." (see the injuries clip: chat6/film) or any md→html.
// Holds on the title, then scrolls at a steady pace with a short pause at
// each section heading (h2), and holds on the end. Prints the page's width
// check (scrollWidth must be 390: no sideways scroll).
import { phone, startRec, stopRec } from "/home/user/film-leo/scripts/film/rec.mjs";
import path from "node:path";

const [html, out, secArg = "18"] = process.argv.slice(2);
const total = Number(secArg);
const { browser, page } = await phone({ touches: false });
try {
  await page.goto("file://" + path.resolve(html));
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, vh: innerHeight,
    heads: [...document.querySelectorAll("h2")].map((e) => e.getBoundingClientRect().top + scrollY),
  }));
  console.log(`width ${m.sw}, height ${m.h}, ${m.heads.length} headings`);
  const maxY = m.h - m.vh;
  const pause = 0.35, hold = 1.0;
  const pauses = m.heads.filter((y) => y > 40 && y < maxY).map((y) => y - 12);
  const moveSec = Math.max(4, total - 2 * hold - pauses.length * pause);
  const speed = maxY / moveSec; // px per second
  const r = await startRec(page);
  await page.waitForTimeout(hold * 1000);
  let y = 0; let next = 0; let last = Date.now();
  while (y < maxY) {
    await page.waitForTimeout(33);
    const now = Date.now(); y = Math.min(maxY, y + speed * (now - last) / 1000); last = now;
    if (next < pauses.length && y >= pauses[next]) { y = pauses[next]; await page.evaluate((y) => scrollTo(0, y), y); next++; await page.waitForTimeout(pause * 1000); last = Date.now(); continue; }
    await page.evaluate((y) => scrollTo(0, y), y);
  }
  await page.waitForTimeout(hold * 1000);
  await stopRec(r, out, { holdEnd: 0.3 });
} finally { await browser.close(); }
