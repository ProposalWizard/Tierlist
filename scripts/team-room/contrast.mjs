/**
 * scripts/team-room/contrast.mjs — measures the Team room's text contrast in
 * both looks (Dark = Midnight slate, Light = Light C) at a phone's size and a
 * computer's. Every piece of text on each screen: its colour against the
 * colour really behind it. Anything under 4.5:1 is listed.
 *
 *   npx next dev -p 3427
 *   node scripts/team-room/contrast.mjs [--url http://localhost:3427]
 *
 * Exits 1 if any text is under 4.5:1.
 */
import { chromium } from "playwright";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3427");
export const SCREENS = [
  ["general", "&ch=general"], ["ideas", "&ch=ideas"], ["todo", "&ch=todo"], ["bugs", "&ch=bugs"], ["health", "&ch=health"],
  ["patch-notes", "&ch=patch-notes"], ["marketing", "&ch=marketing"], ["today", "&ch=today"], ["me", "&view=me"], ["board", "&view=board"],
  ["today-week", "&ch=today&tb=week"], ["today-msgs", "&ch=today&tb=messages"], ["bugs-fixed", "&ch=bugs&tb=fixed"], ["bugs-msgs", "&ch=bugs&tb=messages"], ["health-msgs", "&ch=health&tb=messages"],
  ["patch-msgs", "&ch=patch-notes&tb=messages"], ["connectors", "&ch=connectors"], ["dm", "&dm=Mikey"],
  ["bot-patch", "&bot=patch-notes"], ["bot-health", "&bot=health"], ["bot-bug", "&bot=bug"], ["bot-jobs", "&bot=jobs"], ["bot-today", "&bot=today"],
  // The AI bots (13 Nov 2026): Claude off (no key), then on with a sample spend; a person's bot as its owner and as someone else.
  ["bot-claude", "&bot=claude"], ["bot-claude-on", "&bot=claude&teamroom=claude"], ["bot-harry", "&bot=harry-bot&teamroom=claude"], ["bot-leo", "&bot=leo-bot&teamroom=claude"],
];
const SIZES = [{ name: "390x844", width: 390, height: 844, phone: true }, { name: "1440x900", width: 1440, height: 900, phone: false }];

/** Runs in the page: every visible text node under .trr-host, with its contrast. */
export function audit() {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bgOf = (el) => {
    const stack = [];
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } }
    let out = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  };
  const root = document.querySelector(".trr-host");
  if (!root) return { n: 0, low: [], min: 0 };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const low = []; let n = 0; let min = 99;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.trim();
    if (!/[A-Za-z0-9]/.test(text)) continue;
    const el = t.parentElement;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    if (el.closest("[disabled], [aria-hidden='true'], svg, .tr-av.off")) continue;
    let fg = parse(cs.color);
    const bg = bgOf(el);
    // Opacity on the way up fades the text toward what is behind it.
    let op = 1; for (let e = el; e && e !== root; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    // Text that is fully see-through on purpose (a time that only shows on hover) is not text to read yet.
    if (fg[3] * op === 0) continue;
    fg = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
    const a = lum(fg), b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    n++; if (ratio < min) min = ratio;
    if (ratio < 4.5) low.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100, cls: (el.className && String(el.className).slice(0, 50)) || el.tagName, size: cs.fontSize });
  }
  return { n, low, min: Math.round(min * 100) / 100 };
}

if (process.argv[1] && process.argv[1].endsWith("contrast.mjs")) {
  const browser = await chromium.launch();
  let bad = 0; let lowest = 99; let texts = 0;
  for (const look of ["dark", "light"]) {
    for (const size of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone, isMobile: size.phone });
      await ctx.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); localStorage.setItem("kib-tr-notify-asked", "1"); } catch { /* */ } }, look);
      const page = await ctx.newPage();
      for (const [name, q] of SCREENS) {
        await page.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".trr", { timeout: 120_000 });
        await page.waitForTimeout(700);
        const b = page.locator("[data-cookie-reject]"); if (await b.count()) await b.first().click().catch(() => {});
        const r = await page.evaluate(audit);
        texts += r.n; lowest = Math.min(lowest, r.min); bad += r.low.length;
        console.log(`${look.padEnd(5)} ${size.name.padEnd(8)} ${name.padEnd(12)} texts ${String(r.n).padStart(3)}  lowest ${r.min}:1  under 4.5: ${r.low.length}`);
        for (const l of r.low.slice(0, 8)) console.log(`      ${l.ratio}:1  "${l.text}"  .${l.cls}  ${l.size}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${texts} texts measured. Lowest ${lowest}:1. Under 4.5:1: ${bad}.`);
  process.exit(bad ? 1 : 0);
}
