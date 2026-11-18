// Stills of the admin look at phone and computer size, with what was measured.
// usage: node scripts/admin-look/shots.mjs <base url> <out dir> [look]
// Run a dev server first (npm run dev). Prints page heights, console errors,
// what sits under the chat bubble, and the lowest text contrast on each page.
import { chromium } from "playwright";
import fs from "node:fs";

const [base = "http://localhost:3000", out = "docs/stills/admin-look-built", look = "house"] = process.argv.slice(2);
const PAGES = [
  ["admin-home", "/admin"],
  ["game-home", "/admin/star"],
  ["group-page", "/admin/star/g/career"],
  ["marketing-board", "/admin/marketing"],
  ["videos", "/admin/videos"],
  ...(process.env.MORE ? process.env.MORE.split(",").map((u, i) => [`more-${i}`, u]) : []),
];
const SIZES = [[390, 844, 2], [1440, 900, 1]];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [w, h, dpr] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await ctx.addInitScript((l) => { try { localStorage.setItem("kib-admin-look-2", l); localStorage.setItem("kib-admin-side-folded", "0"); localStorage.setItem("kib-cookie-consent", "no"); } catch {} }, look);
  for (const [name, url] of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|supabase|fetch/i.test(m.text())) errors.push(m.text().slice(0, 140)); });
    await page.goto(base + url, { waitUntil: "networkidle", timeout: 240000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const m = await page.evaluate(({ W, H }) => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.1; };
      const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.backgroundImage !== "none" && /url|gradient/.test(s.backgroundImage)) return null; const a = rgb(s.backgroundColor); if (a.length && (a.length < 4 || a[3] > 0.9)) return a; if (a.length === 4 && a[3] > 0.05) return null; } return [255, 255, 255]; };
      const root = document.querySelector(".ash, .bc") || document.body;
      const low = []; let min = 99; let n = 0, pills = 0, caps = 0; const sizes = new Set(), radii = new Set();
      for (const e of root.querySelectorAll("*")) {
        if (!vis(e) || e.closest(".tr-vars, [data-recorder-pill], .trr-page, svg, video, canvas, img")) continue;
        const s = getComputedStyle(e); const r = e.getBoundingClientRect();
        const painted = (rgb(s.backgroundColor)[3] ?? 1) > 0.05 && s.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(s.borderTopWidth) > 0;
        const rad = parseFloat(s.borderTopLeftRadius);
        if (painted && rad > 0 && r.width > 12) radii.add(Math.min(rad, 50));
        if (painted && r.height < 44 && r.width > r.height * 1.3 && rad >= r.height / 2 - 1 && r.height > 10 && !e.matches(".ash-pill-sw")) pills++;
        const own = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
        if (!own) continue;
        const inMenu = e.closest(".ash-side"); if (inMenu && getComputedStyle(inMenu).transform !== "none") continue;
        sizes.add(parseFloat(s.fontSize));
        if (s.textTransform === "uppercase" && parseFloat(s.letterSpacing) > 0.5) caps++;
        const bg = bgOf(e); if (!bg) continue;
        const a = lum(rgb(s.color)), b = lum(bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        n++; min = Math.min(min, cr); if (cr < 4.5) low.push(`${cr.toFixed(2)} "${e.textContent.trim().slice(0, 28)}" .${String(e.className).split(" ")[0]}`);
      }
      const fab = document.querySelector(".tr-fab"); let under = "no bubble";
      if (fab) { const r = fab.getBoundingClientRect(); fab.style.visibility = "hidden"; const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); fab.style.visibility = ""; under = el ? (el.closest("a,button,section,li,p") || el).className.toString().slice(0, 40) || el.tagName : "nothing"; }
      return { min: +min.toFixed(2), height: document.documentElement.scrollHeight, wide: document.documentElement.scrollWidth > W + 1, texts: n, low, pills, caps, sizes: [...sizes].sort((x, y) => x - y), radii: [...radii].sort((x, y) => x - y), under };
    }, { W: w, H: h });
    await page.screenshot({ path: `${out}/${name}-${w}.png` });
    console.log(`${name} @${w}: height ${m.height}${m.wide ? " SIDEWAYS SCROLL" : ""} · ${m.texts} texts, ${m.low.length} under 4.5:1 (lowest ${m.min}:1) · pills ${m.pills} · tracked caps ${m.caps} · sizes ${m.sizes.join("/")} · corners ${m.radii.join("/")} · under bubble: ${m.under} · errors ${errors.length}`);
    for (const l of m.low.slice(0, 12)) console.log("   low:", l);
    for (const e of errors.slice(0, 3)) console.log("   error:", e);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
